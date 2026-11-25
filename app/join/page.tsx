"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Fraunces } from "next/font/google";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Users, Zap } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import {
  ALL,
  EMPTY_FILTERS,
  deriveOptions,
  filterRings,
  platformLabel,
  ringLocation,
  type Ring,
  type RingFilters,
} from "./rings";
import CinematicBackdrop, { HeroPortal } from "./Atmosphere";
import PosterCarousel, { LOOP_MIN } from "./PosterCarousel";
import FilterBar from "./FilterBar";
import "./join.css";

// Display serif for the oversized editorial headline (loaded only on this page)
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });

export default function JoinPage() {
  const router = useRouter();

  const [rings, setRings] = useState<Ring[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [filters, setFilters] = useState<RingFilters>(EMPTY_FILTERS);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetch rings from Supabase (same query as before)
  useEffect(() => {
    let cancelled = false;
    async function loadGroups() {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Error loading groups:", error);
        setLoadError(true);
      } else {
        setRings((data as Ring[]) || []);
      }
      setLoading(false);
    }
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const options = useMemo(() => deriveOptions(rings, filters.city), [rings, filters.city]);
  const filtered = useMemo(() => filterRings(rings, filters), [rings, filters]);
  const areaAvailable = useMemo(() => rings.some((r) => (r.area ?? "").trim() !== ""), [rings]);

  // If the city changes and the chosen area no longer exists there, drop it.
  useEffect(() => {
    if (filters.area !== ALL && !options.areas.includes(filters.area)) {
      setFilters((f) => ({ ...f, area: ALL }));
    }
  }, [options.areas, filters.area]);

  // Any filter change starts the carousel from the first match.
  useEffect(() => {
    setActiveIndex(0);
  }, [filters]);

  const patchFilters = useCallback(
    (patch: Partial<RingFilters>) => setFilters((f) => ({ ...f, ...patch })),
    []
  );

  const count = filtered.length;
  const safeIndex = Math.min(activeIndex, Math.max(count - 1, 0));
  const activeRing = filtered[safeIndex];

  const openRing = useCallback((r: Ring) => router.push(`/ring/${r.id}`), [router]);
  const canLoop = count >= LOOP_MIN;
  const step = (delta: number) =>
    setActiveIndex(
      canLoop
        ? (safeIndex + delta + count) % count
        : Math.min(Math.max(safeIndex + delta, 0), Math.max(count - 1, 0))
    );

  function exploreRings() {
    const stage = document.getElementById("rings-stage");
    stage?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      stage?.querySelector<HTMLElement>('[data-pos="center"] button')?.focus({ preventScroll: true });
    }, 350);
  }

  // Real numbers from the database, never invented.
  const cityNames = useMemo(
    () => Array.from(new Set(rings.map((r) => r.city).filter(Boolean))),
    [rings]
  );

  // Gentle parallax of the sunset arch as you move through the rings
  const shift = count > 1 ? (safeIndex / (count - 1) - 0.5) * -80 : 0;

  return (
    <main className={`cr-join ${fraunces.variable}`}>
      <CinematicBackdrop />

      <section className="cr-hero" style={{ ["--cr-shift" as string]: `${shift}px` }}>
        <HeroPortal />

        <div className="cr-hero-top">
          <div className="cr-hero-copy">
            <p className="cr-eyebrow cr-intro" style={{ ["--i" as string]: 0 }}>
              Curated communities
            </p>
            <h1 className="cr-title">
              <span className="cr-title-line cr-intro" style={{ ["--i" as string]: 1 }}>
                Find your
              </span>
              <span className="cr-title-line cr-intro" style={{ ["--i" as string]: 2 }}>
                Right <span className="cr-title-accent">Ring</span>
              </span>
            </h1>
            <p className="cr-lede cr-intro" style={{ ["--i" as string]: 3 }}>
              Private, focused groups for your city, interests, and lifestyle.
            </p>
            <div className="cr-hero-actions cr-intro" style={{ ["--i" as string]: 4 }}>
              <button type="button" className="cr-btn" onClick={exploreRings}>
                Explore Rings
                <ArrowRight aria-hidden="true" />
              </button>
              <a href="/register" className="cr-textlink">
                Not a member? Register
              </a>
            </div>
          </div>

          <ul className="cr-stats cr-intro" style={{ ["--i" as string]: 3 }} aria-label="CityRing at a glance">
            <li>
              <Users aria-hidden="true" />
              <div>
                <strong>{loading ? "–" : rings.length}</strong>
                <span>Active rings</span>
              </div>
            </li>
            <li>
              <MapPin aria-hidden="true" />
              <div>
                <strong>
                  {loading ? "–" : cityNames.length === 1 ? cityNames[0] : cityNames.length}
                </strong>
                <span>{cityNames.length === 1 ? "Current city" : "Cities"}</span>
              </div>
            </li>
            <li>
              <Zap aria-hidden="true" />
              <div>
                <strong>Curated</strong>
                <span>Not random, by design</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="cr-stage-wrap">
          <PosterCarousel
            rings={filtered}
            loading={loading}
            activeIndex={safeIndex}
            onActiveChange={setActiveIndex}
            onOpen={openRing}
            emptyState={
              loadError ? (
                <>
                  <p>We couldn’t load the rings.</p>
                  <button type="button" className="cr-ghost" onClick={() => setReloadKey((k) => k + 1)}>
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <p>No rings match these filters.</p>
                  <button type="button" className="cr-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </button>
                </>
              )
            }
          />

          {activeRing && (
            <div className="cr-caption" key={activeRing.id}>
              <div className="cr-caption-main">
                <h2 className="cr-caption-title">{activeRing.title}</h2>
                <div className="cr-caption-meta">
                  {activeRing.interest && <span className="cr-chip">{activeRing.interest}</span>}
                  <span className="cr-caption-loc">
                    <MapPin aria-hidden="true" />
                    {ringLocation(activeRing)}
                  </span>
                  {activeRing.platforms?.map((p) => (
                    <span key={p} className="cr-chip cr-chip--quiet">
                      {platformLabel(p)}
                    </span>
                  ))}
                </div>
                {activeRing.description && (
                  <p className="cr-caption-desc">{activeRing.description}</p>
                )}
              </div>

              <div className="cr-caption-actions">
                <div className="cr-pager" role="group" aria-label="Browse rings">
                  <button
                    type="button"
                    className="cr-round"
                    aria-label="Previous ring"
                    onClick={() => step(-1)}
                    disabled={!canLoop && safeIndex === 0}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <span className="cr-count">
                    {safeIndex + 1} <i>/</i> {count}
                  </span>
                  <button
                    type="button"
                    className="cr-round"
                    aria-label="Next ring"
                    onClick={() => step(1)}
                    disabled={!canLoop && safeIndex >= count - 1}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
                <button type="button" className="cr-btn" onClick={() => openRing(activeRing)}>
                  View ring
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="cr-filters-wrap">
        <FilterBar
          options={options}
          filters={filters}
          onChange={patchFilters}
          onClear={() => setFilters(EMPTY_FILTERS)}
          resultCount={count}
          totalCount={rings.length}
          areaAvailable={areaAvailable}
        />
      </section>
    </main>
  );
}
