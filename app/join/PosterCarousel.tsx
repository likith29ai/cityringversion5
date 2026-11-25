"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Ring } from "./rings";

/**
 * Layered, perspective poster carousel.
 *
 * - Every poster box takes the image's REAL aspect ratio (measured by preloading),
 *   so posters are never forced into squares and never cropped.
 * - The centre poster is full size; neighbours sit behind and to the sides.
 * - Side positions are computed from the real poster widths, so mixed
 *   portrait / square / landscape posters still tuck in neatly.
 */

const DEFAULT_RATIO = 3 / 4; // used until a poster's real ratio is known
const MIN_RATIO = 0.5; // extreme ratios are letterboxed (object-fit: contain), never cropped
const MAX_RATIO = 1.3;
const PRELOAD_RADIUS = 4;

type Look = {
  scale: number;
  z: number;
  rot: number;
  dim: number;
  opacity: number;
  overlap: number;
};

// index = |distance from active|
const LOOKS: Look[] = [
  { scale: 1, z: 0, rot: 0, dim: 0, opacity: 1, overlap: 0 },
  { scale: 0.86, z: -110, rot: 14, dim: 0.46, opacity: 1, overlap: 0.34 },
  { scale: 0.72, z: -220, rot: 18, dim: 0.66, opacity: 0.95, overlap: 0.3 },
  { scale: 0.6, z: -320, rot: 20, dim: 0.85, opacity: 0, overlap: 0.3 },
];
const MAX_D = LOOKS.length - 1;

const clampRatio = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));

/**
 * With at least this many rings the carousel wraps around, so posters always
 * sit on both sides of the centre. (7 = every visible slot is unique, so the
 * wrap-around happens off-screen and never "teleports" a visible poster.)
 */
export const LOOP_MIN = 2 * MAX_D + 1;

/** Signed distance from the active slide, shortest way round when looping. */
function distance(i: number, active: number, n: number, loop: boolean) {
  if (!loop) return i - active;
  const raw = (((i - active) % n) + n) % n;
  return raw > n / 2 ? raw - n : raw;
}

type Entry = { id: string; ring?: Ring };
const SKELETON: Entry[] = Array.from({ length: 5 }, (_, i) => ({ id: `sk-${i}` }));

type Props = {
  rings: Ring[];
  loading: boolean;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onOpen: (ring: Ring) => void;
  /** If true, clicking a side poster opens it instead of bringing it to the centre. */
  sideClickOpens?: boolean;
  /** Shown instead of posters when there is nothing to display. */
  emptyState?: React.ReactNode;
};

export default function PosterCarousel({
  rings,
  loading,
  activeIndex,
  onActiveChange,
  onOpen,
  sideClickOpens = false,
  emptyState,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const requested = useRef<Set<string>>(new Set());

  const entries: Entry[] = loading
    ? SKELETON
    : rings.map((ring) => ({ id: ring.id, ring }));
  const n = entries.length;
  const loop = !loading && n >= LOOP_MIN;
  const idx = loading ? 2 : Math.min(Math.max(activeIndex, 0), Math.max(n - 1, 0));

  // ── measure the stage ────────────────────────────────────
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── learn each poster's real aspect ratio by preloading nearby images ─
  useEffect(() => {
    if (loading) return;
    const count = rings.length;
    for (let d = -PRELOAD_RADIUS; d <= PRELOAD_RADIUS; d++) {
      const at = idx + d;
      const ring = count >= LOOP_MIN ? rings[((at % count) + count) % count] : rings[at];
      if (!ring || !ring.poster_url || requested.current.has(ring.id)) continue;
      requested.current.add(ring.id);

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const r = img.naturalWidth / img.naturalHeight;
        setRatios((p) => ({ ...p, [ring.id]: r > 0 && isFinite(r) ? r : DEFAULT_RATIO }));
      };
      img.onerror = () => {
        setFailed((p) => ({ ...p, [ring.id]: true }));
        setRatios((p) => ({ ...p, [ring.id]: DEFAULT_RATIO }));
      };
      img.src = ring.poster_url;
    }
  }, [rings, idx, loading]);

  const ratioOf = (i: number) => {
    const e = entries[i];
    return clampRatio((e && ratios[e.id]) || DEFAULT_RATIO);
  };

  // ── navigation ───────────────────────────────────────────
  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), n - 1);
      if (clamped !== idx) onActiveChange(clamped);
    },
    [idx, n, onActiveChange]
  );

  const go = useCallback(
    (delta: number) => {
      if (n < 2) return;
      goTo(loop ? (((idx + delta) % n) + n) % n : idx + delta);
    },
    [idx, n, loop, goTo]
  );

  const drag = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const wheelLock = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY };
    window.addEventListener(
      "pointerup",
      (ev) => {
        const s = drag.current;
        drag.current = null;
        if (!s) return;
        const dx = ev.clientX - s.x;
        const dy = ev.clientY - s.y;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          suppressClick.current = true;
          window.setTimeout(() => (suppressClick.current = false), 60);
          go(dx < 0 ? 1 : -1);
        }
      },
      { once: true }
    );
  }

  function onWheel(e: React.WheelEvent) {
    // only react to horizontal trackpad swipes; vertical scrolling stays with the page
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
      const now = Date.now();
      if (now - wheelLock.current > 380) {
        wheelLock.current = now;
        go(e.deltaX > 0 ? 1 : -1);
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "Home") { e.preventDefault(); goTo(0); }
    else if (e.key === "End") { e.preventDefault(); goTo(n - 1); }
  }

  function onSlideClick(i: number) {
    if (suppressClick.current || loading) return;
    const ring = rings[i];
    if (!ring) return;
    if (i === idx || sideClickOpens) onOpen(ring);
    else onActiveChange(i);
  }

  // ── geometry ─────────────────────────────────────────────
  let H = 0;
  const xs = new Map<number, number>();

  if (size && size.h > 0 && n > 0) {
    H = Math.max(size.h - 8, 120);
    // keep the centre poster comfortably inside narrow screens
    const centreW = ratioOf(idx) * H;
    const fit = Math.min(1, (size.w * 0.8) / centreW);
    H = H * fit;

    const wOf = (i: number) => ratioOf(i) * H;
    const wc = wOf(idx);
    for (const dir of [1, -1]) {
      let edge = wc / 2;
      for (let k = 1; k <= MAX_D; k++) {
        let j = idx + dir * k;
        if (loop) j = ((j % n) + n) % n;
        else if (j < 0 || j >= n) break;
        const look = LOOKS[k];
        const w = wOf(j) * look.scale;
        const left = edge - w * look.overlap;
        xs.set(j, dir * (left + w / 2));
        edge = left + w;
      }
    }
    xs.set(idx, 0);
  }

  const active = entries[idx]?.ring;

  return (
    <div
      id="rings-stage"
      ref={stageRef}
      className="cr-stage"
      role="region"
      aria-roledescription="carousel"
      aria-label="Ring posters"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <div className="cr-floor" aria-hidden="true" />

      {!loading && n === 0 && <div className="cr-stage-empty">{emptyState}</div>}

      {size &&
        n > 0 &&
        entries.map((entry, i) => {
          const d = distance(i, idx, n, loop);
          const ad = Math.abs(d);
          if (ad > MAX_D) return null;

          const look = LOOKS[ad];
          const sign = d === 0 ? 0 : d < 0 ? 1 : -1; // left cards turn to face the centre
          const w = ratioOf(i) * H;
          const x = xs.get(i) ?? 0;
          const ring = entry.ring;
          const showImage = !!ring && !!ring.poster_url && !failed[ring.id];
          const known = !!ring && ratios[ring.id] !== undefined;

          return (
            <div
              key={entry.id}
              className="cr-slide"
              data-pos={d === 0 ? "center" : d < 0 ? "left" : "right"}
              aria-hidden={ad >= MAX_D ? true : undefined}
              style={{
                width: w,
                height: H,
                opacity: look.opacity,
                zIndex: 50 - ad * 10,
                pointerEvents: ad >= MAX_D ? "none" : "auto",
                transform: `translate(-50%, -50%) translate3d(${x}px, 0, ${look.z}px) rotateY(${sign * look.rot}deg) scale(${look.scale})`,
                ["--d" as string]: ad,
              }}
            >
              {ring ? (
                <button
                  type="button"
                  className="cr-poster"
                  tabIndex={d === 0 ? 0 : -1}
                  aria-label={
                    d === 0 || sideClickOpens
                      ? `Open ${ring.title}`
                      : `Show ${ring.title}`
                  }
                  onClick={() => onSlideClick(i)}
                >
                  {showImage ? (
                    <img
                      src={ring.poster_url as string}
                      alt={`${ring.title} poster`}
                      draggable={false}
                      className={`cr-poster-img${known ? " is-ready" : ""}`}
                    />
                  ) : (
                    <span className="cr-poster-fallback">
                      <span className="cr-poster-fallback-tag">{ring.interest}</span>
                      <span className="cr-poster-fallback-title">{ring.title}</span>
                    </span>
                  )}
                  <span className="cr-dim" style={{ opacity: look.dim }} />
                </button>
              ) : (
                <div className="cr-poster cr-poster--skeleton" />
              )}
            </div>
          );
        })}

      <p className="cr-sr" aria-live="polite">
        {active ? `${active.title}, ring ${idx + 1} of ${n}` : ""}
      </p>
    </div>
  );
}
