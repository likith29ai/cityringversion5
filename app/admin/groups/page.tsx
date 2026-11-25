"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import GroupValidityFields, {
  EMPTY_VALIDITY,
  validateValidity,
  ValidityFormState,
} from "../../components/GroupValidityFields";
import {
  formatDuration,
  formatIst,
  getValidityStatus,
  hasValidity,
  isoToIstInput,
  istInputToIso,
  useNow,
  ValidityStatus,
} from "../../lib/groupValidity";

type GroupRow = {
  id: string;
  title: string;
  city: string;
  interest: string;
  area?: string | null;
  created_at?: string | null;
  validity_enabled?: boolean | null;
  start_at?: string | null;
  expires_at?: string | null;
};

const STATUS_LABEL: Record<ValidityStatus, { text: string; cls: string }> = {
  upcoming: { text: "Upcoming", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  active: { text: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expiring_soon: { text: "Expiring soon", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  expired: { text: "Expired", cls: "bg-red-50 text-red-700 border-red-200" },
};

function formFromGroup(g: GroupRow): ValidityFormState {
  if (!hasValidity(g)) return EMPTY_VALIDITY;
  return { enabled: true, start: isoToIstInput(g.start_at), expiry: isoToIstInput(g.expires_at) };
}

export default function ManageGroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ValidityFormState>(EMPTY_VALIDITY);
  const [saving, setSaving] = useState(false);
  const [areaInput, setAreaInput] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [onlyMissingArea, setOnlyMissingArea] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // re-evaluate statuses once a minute
  const now = useNow(60000);

  async function loadGroups() {
    setLoading(true);
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      setGroups((data as GroupRow[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (onlyMissingArea && (g.area || "").trim()) return false;
      if (!q) return true;
      return [g.title, g.city, g.interest, g.area].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [groups, query, onlyMissingArea]);

  // existing areas, offered as suggestions so spellings stay consistent
  const areaSuggestions = useMemo(() => {
    const set = new Set(groups.map((g) => (g.area || "").trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [groups]);

  function openEditor(g: GroupRow) {
    setMsg(null);
    if (editingId === g.id) {
      setEditingId(null);
      return;
    }
    setEditingId(g.id);
    setForm(formFromGroup(g));
    setAreaInput(g.area || "");
  }

  const formError = validateValidity(form);

  async function save(g: GroupRow) {
    if (saving || formError) return;
    setSaving(true);
    setMsg(null);
    try {
      // Only the three validity fields are written (via a DB function that touches nothing else)
      const { error } = await supabase.rpc("admin_set_group_validity", {
        _group_id: g.id,
        _enabled: form.enabled,
        _start_at: form.enabled ? istInputToIso(form.start) : null,
        _expires_at: form.enabled ? istInputToIso(form.expiry) : null,
      });
      if (error) throw new Error(error.message);

      setMsg({
        type: "success",
        text: form.enabled ? "✅ Validity saved." : "✅ Validity disabled for this group.",
      });
      await loadGroups();
    } catch (e) {
      setMsg({ type: "error", text: (e instanceof Error && e.message) || "Failed to save validity." });
    } finally {
      setSaving(false);
    }
  }

  async function saveArea(g: GroupRow) {
    if (savingArea) return;
    setSavingArea(true);
    setMsg(null);
    try {
      // Only the area column is written (via a DB function that touches nothing else)
      const clean = areaInput.trim().replace(/\s+/g, " ");
      const { error } = await supabase.rpc("admin_set_group_area", {
        _group_id: g.id,
        _area: clean || null,
      });
      if (error) throw new Error(error.message);
      setMsg({ type: "success", text: clean ? "✅ Area saved." : "✅ Area cleared for this group." });
      await loadGroups();
    } catch (e) {
      setMsg({ type: "error", text: (e instanceof Error && e.message) || "Failed to save area." });
    } finally {
      setSavingArea(false);
    }
  }

  return (
    <main>
      <h1 className="text-4xl font-bold">Manage groups</h1>
      <p className="mt-2 text-zinc-600">
        View existing groups and set their Area, or set, change, extend or remove their validity (start /
        expiry). Only the field you save is edited — everything else about a group stays untouched.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title, city or interest…"
        className="mt-6 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400"
      />

      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={onlyMissingArea}
          onChange={(e) => setOnlyMissingArea(e.target.checked)}
        />
        Show only groups without an Area
      </label>

      {loading && <p className="mt-6 text-sm text-zinc-500">Loading groups…</p>}
      {loadError && <p className="mt-6 text-sm text-red-600">Failed to load groups: {loadError}</p>}
      {!loading && !loadError && filtered.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">No groups found.</p>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map((g) => {
          const status = getValidityStatus(g, now);
          const open = editingId === g.id;
          return (
            <div key={g.id} className="bg-white border rounded-2xl shadow-sm">
              <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{g.title}</div>
                  <div className="mt-0.5 text-sm text-zinc-600">
                    {g.city} · {g.interest} · {(g.area || "").trim() ? g.area : <span className="text-amber-600">No area</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {status ? (
                      <>
                        <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${STATUS_LABEL[status].cls}`}>
                          {STATUS_LABEL[status].text}
                        </span>
                        <span className="text-zinc-500">
                          {formatIst(g.start_at)} → {formatIst(g.expires_at)} ({formatDuration(g.start_at, g.expires_at)})
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-semibold text-zinc-600">
                        No validity
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditor(g)}
                  className="px-3 py-2 rounded-xl text-sm border bg-white border-zinc-200 hover:bg-zinc-50 transition"
                >
                  {open ? "Close" : "Edit"}
                </button>
              </div>

              {open && (
                <div className="border-t p-4 sm:p-5">
                  <div
                    style={{ padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Area</div>
                    <div className="flex flex-wrap gap-3">
                      <input
                        value={areaInput}
                        onChange={(e) => setAreaInput(e.target.value)}
                        list="area-suggestions"
                        placeholder="e.g. Koramangala"
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "white", flex: "1 1 220px" }}
                      />
                      <datalist id="area-suggestions">
                        {areaSuggestions.map((a) => (
                          <option key={a} value={a} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => saveArea(g)}
                        disabled={savingArea}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${
                          savingArea ? "bg-zinc-400 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800"
                        }`}
                      >
                        {savingArea ? "Saving…" : "Save area"}
                      </button>
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.7, display: "block", marginTop: 8 }}>
                      Leave empty and save to remove the area. Only the Area is changed.
                    </span>
                  </div>

                  <div className="mt-4">
                    <GroupValidityFields value={form} onChange={setForm} showExtend />
                  </div>

                  {msg && (
                    <div
                      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                        msg.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-red-200 bg-red-50 text-red-800"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => save(g)}
                      disabled={saving || !!formError}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${
                        saving || formError ? "bg-zinc-400 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800"
                      }`}
                    >
                      {saving ? "Saving…" : "Save validity"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2.5 rounded-xl text-sm border bg-white border-zinc-200 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
