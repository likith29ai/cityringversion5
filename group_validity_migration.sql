-- =====================================================================
-- CityRing: OPTIONAL GROUP VALIDITY  (additive, idempotent migration)
-- Run once in Supabase -> SQL Editor.
--
-- What it does:
--   1. Adds 3 columns to public.groups (existing groups -> validity OFF)
--   2. Adds a sanity CHECK constraint
--   3. Adds a BEFORE INSERT trigger on public.join_requests that blocks
--      new join requests for UPCOMING / EXPIRED groups (DB-level
--      enforcement, works for any RPC or direct insert)
--   4. Adds admin_set_group_validity() so the admin page can edit ONLY
--      the validity columns
--
-- What it does NOT do:
--   - No table is dropped/recreated, no row is modified or deleted
--   - request_join_group() / request_join_group_v2() are NOT replaced
--   - No existing policy is changed
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Columns (nullable / default false => all existing groups untouched)
-- ---------------------------------------------------------------------
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS validity_enabled boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_at         timestamptz NULL,
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz NULL;


-- ---------------------------------------------------------------------
-- 2) Validation: if validity is enabled, both dates must exist and
--    expiry must be later than start. (Existing rows have it disabled,
--    so they all satisfy this.)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'groups_validity_dates_check'
      AND conrelid = 'public.groups'::regclass
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_validity_dates_check
      CHECK (
        validity_enabled = false
        OR (start_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at > start_at)
      );
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 3) DB-level enforcement of validity on join requests
--
--    Why a trigger instead of editing the RPCs?
--    Your PDF contains several historical versions of request_join_group
--    and request_join_group_v2 and I cannot see which one is live. A
--    BEFORE INSERT trigger protects every code path (v2, v1, gmail
--    branch, "all" plan branch, even a direct insert) without rewriting
--    any of that logic.
--
--    Because the insert happens inside the RPC's transaction, the
--    exception rolls the whole call back, so no membership slot
--    (groups_used) is consumed when a join is refused.
--
--    If the exact same request already exists, the trigger lets the row
--    through so the RPC's own ON CONFLICT / "already_requested" handling
--    behaves exactly as before.
--
--    Only INSERTs are checked. Admin approve/reject (UPDATE) is unaffected.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_group_validity_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g RECORD;
BEGIN
  -- Duplicate of an existing request: leave to the RPC's existing duplicate handling
  IF EXISTS (
    SELECT 1 FROM public.join_requests jr
    WHERE jr.profile_id   = NEW.profile_id
      AND jr.group_id     = NEW.group_id
      AND jr.network_mode IS NOT DISTINCT FROM NEW.network_mode
  ) THEN
    RETURN NEW;
  END IF;

  SELECT validity_enabled, start_at, expires_at
    INTO g
  FROM public.groups
  WHERE id = NEW.group_id;

  IF NOT FOUND THEN
    RETURN NEW;  -- FK on group_id handles missing groups
  END IF;

  IF COALESCE(g.validity_enabled, false) THEN
    IF g.start_at IS NOT NULL AND now() < g.start_at THEN
      RAISE EXCEPTION 'GROUP_NOT_STARTED';
    END IF;
    IF g.expires_at IS NOT NULL AND now() >= g.expires_at THEN
      RAISE EXCEPTION 'GROUP_EXPIRED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_validity_on_join ON public.join_requests;
CREATE TRIGGER trg_enforce_group_validity_on_join
  BEFORE INSERT ON public.join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_group_validity_on_join();


-- ---------------------------------------------------------------------
-- 4) Admin RPC: updates ONLY the validity columns of ONE group.
--    Used by /admin/groups (Manage groups). Title, description, city,
--    interest, poster, platforms etc. are never touched.
--
--    Admin check uses the public.admins table (matched on the logged-in
--    user's email). Make sure your admin email is in that table:
--        SELECT * FROM public.admins;
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_group_validity(
  _group_id   uuid,
  _enabled    boolean,
  _start_at   timestamptz,
  _expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admins a
    WHERE lower(a.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  ) THEN
    RAISE EXCEPTION 'NOT_ADMIN: only admins can change group validity';
  END IF;

  IF _enabled THEN
    IF _start_at IS NULL OR _expires_at IS NULL THEN
      RAISE EXCEPTION 'Start and expiry date & time are required when validity is enabled';
    END IF;
    IF _expires_at <= _start_at THEN
      RAISE EXCEPTION 'Expiry must be later than the start date';
    END IF;

    UPDATE public.groups
       SET validity_enabled = true,
           start_at         = _start_at,
           expires_at       = _expires_at
     WHERE id = _group_id;
  ELSE
    UPDATE public.groups
       SET validity_enabled = false,
           start_at         = NULL,
           expires_at       = NULL
     WHERE id = _group_id;
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_group_validity(uuid, boolean, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_group_validity(uuid, boolean, timestamptz, timestamptz) TO authenticated;


-- =====================================================================
-- VERIFY (optional, read-only)
-- =====================================================================
-- a) Columns exist and every existing group is OFF:
--    SELECT validity_enabled, count(*) FROM public.groups GROUP BY 1;
--
-- b) Trigger exists:
--    SELECT tgname FROM pg_trigger WHERE tgname = 'trg_enforce_group_validity_on_join';
--
-- c) Your admin email is in the admins table (needed by the admin page):
--    SELECT * FROM public.admins;
--
-- =====================================================================
-- ROLLBACK (only if you ever want to remove the feature)
-- =====================================================================
-- DROP TRIGGER  IF EXISTS trg_enforce_group_validity_on_join ON public.join_requests;
-- DROP FUNCTION IF EXISTS public.enforce_group_validity_on_join();
-- DROP FUNCTION IF EXISTS public.admin_set_group_validity(uuid, boolean, timestamptz, timestamptz);
-- ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_validity_dates_check;
-- ALTER TABLE public.groups DROP COLUMN IF EXISTS validity_enabled,
--                           DROP COLUMN IF EXISTS start_at,
--                           DROP COLUMN IF EXISTS expires_at;
