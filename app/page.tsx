// File: app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import Intro from "./components/Intro";
import FloatingParticles from "./components/FloatingParticles";
import HeroCarousel from "./components/HeroCarousel";
import type { CarouselRing } from "./components/HeroCarousel";

/* ── Types ── */
type Group = CarouselRing & {
  title: string;
  image_url?: string | null;
  interest?: string | null;
  city?: string | null;
  area?: string | null;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string;
};

type Section = {
  id: string;
  title: string;
  subtitle: string | null;
  sort_order: number;
  groups: Group[];
};

/* ══════════════════════════════════════════════════
   HOME
══════════════════════════════════════════════════ */
export default function Home() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselRings, setCarouselRings] = useState<Group[]>([]);

  /* ── Load Supabase Data ── */
  useEffect(() => {
    async function load() {
      const { data: secData, error: secErr } = await supabase
        .from("homepage_sections")
        .select("id,title,subtitle,sort_order")
        .order("sort_order", { ascending: true });

      if (secErr) {
        console.error("Sections load error:", secErr);
        setLoading(false);
        return;
      }

      const { data: itemData, error: itemErr } = await supabase
        .from("homepage_section_items")
        .select("section_id, sort_order, group_id");

      if (itemErr) {
        console.error("Items load error:", itemErr);
        setLoading(false);
        return;
      }

      const groupIds = [...new Set((itemData ?? []).map((i: any) => i.group_id))];
      const groupMap: Record<string, Group> = {};

      if (groupIds.length > 0) {
        const { data: groupData } = await supabase
          .from("groups")
          .select("*")
          .in("id", groupIds);

        for (const g of groupData ?? []) {
          groupMap[(g as any).id] = g as Group;
        }
      }

      const built: Section[] = (secData ?? []).map((s: any) => {
        const items = (itemData ?? [])
          .filter((i: any) => i.section_id === s.id)
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((i: any) => groupMap[i.group_id])
          .filter(Boolean) as Group[];

        return {
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          sort_order: s.sort_order,
          groups: items,
        };
      });

      setSections(built);

      const { data: featData } = await supabase
        .from("groups")
        .select("*")
        .not("poster_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      const sectionRings = built.flatMap((s) => s.groups);
      const uniqueRings: Group[] = [];
      const seen = new Set<string>();

      for (const r of [...(featData ?? []), ...sectionRings]) {
        if (r && !seen.has(r.id)) {
          seen.add(r.id);
          uniqueRings.push(r as Group);
        }
      }

      setCarouselRings(uniqueRings.slice(0, 10));
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen text-white bg-[#02050d] overflow-x-hidden">
      <Intro />

      {/* ════════ HERO SECTION ════════ */}
      <section className="relative w-full overflow-hidden">
        <FloatingParticles count={18} />

        {/* Panoramic Landmark Wallpaper */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] sm:h-[400px] lg:h-[480px] overflow-hidden">
          <img
            src="/landmarks-wallpaper.jpg"
            alt="Indian landmarks skyline"
            className="w-full h-full object-cover object-[center_25%] sm:object-[center_20%] opacity-85"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fallbackTried) {
                img.dataset.fallbackTried = "1";
                img.src = "/banner.png";
              }
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(2,5,13,0.3) 0%, rgba(2,5,13,0.05) 30%, rgba(2,5,13,0.7) 75%, #02050d 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(2,5,13,0.65) 100%)",
            }}
          />
        </div>

        {/* Hero Title & Actions */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 lg:pt-36 pb-2 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-2.5">
            <span className="h-[1px] w-6 sm:w-10 bg-gradient-to-r from-transparent to-sky-400/60" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.26em] text-sky-300/80">
              The Circle Platform
            </span>
            <span className="h-[1px] w-6 sm:w-10 bg-gradient-to-l from-transparent to-sky-400/60" />
          </div>

          <h1
            className="font-bold tracking-tight text-[30px] sm:text-[46px] lg:text-[54px] leading-[1.08]"
            style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', serif" }}
          >
            <span className="block text-white">Where People,</span>
            <span className="block text-white">Places and Interests</span>
            <span className="block text-white">
              Form{" "}
              <span className="italic bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                Circles.
              </span>
            </span>
          </h1>

          <p className="mt-2.5 text-xs sm:text-sm text-white/65 leading-relaxed max-w-md mx-auto">
            Curated communities for people, cities and shared passions.
          </p>

          <div className="mt-4 flex items-center justify-center gap-3">
            <a
              href="/join"
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
                boxShadow: "0 0 24px rgba(14,165,233,0.35)",
              }}
            >
              Explore Rings
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* 3D Carousel (Directly underneath with zero dead margin) */}
          <div className="mt-3 sm:mt-5">
            <HeroCarousel rings={carouselRings} loading={loading} />
          </div>
        </div>
      </section>

      {/* ════════ ADMIN SECTIONS (FEATURED RINGS) ════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {loading && <Row title="Featured Rings" subtitle="" items={[]} loading={true} />}
        {!loading && sections.length === 0 && (
          <div className="text-center text-white/30 text-xs py-8">
            No sections yet — create them in Admin.
          </div>
        )}
        {!loading &&
          sections.map((s) => (
            <Row
              key={s.id}
              title={s.title}
              subtitle={s.subtitle ?? ""}
              items={s.groups}
              loading={false}
            />
          ))}
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="border-t border-white/[0.06] bg-black/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div>© {new Date().getFullYear()} CityRing. Built for real communities.</div>
          <div className="flex items-center gap-5">
            <a href="/about" className="hover:text-white transition">About</a>
            <a href="/rules" className="hover:text-white transition">Rules</a>
            <a href="/contact" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ══════════════════════════════════════════════════
   ROW — Clean Ring Poster Horizontal Scroller
══════════════════════════════════════════════════ */
function Row({
  title,
  subtitle,
  items,
  loading,
}: {
  title: string;
  subtitle: string;
  items: Group[];
  loading: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-sky-400" />
            <h3
              className="text-base sm:text-lg font-bold tracking-tight text-white"
              style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', serif" }}
            >
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] sm:text-xs text-white/45 pl-3">{subtitle}</p>
          )}
        </div>
        {title && (
          <a
            href="/join"
            className="text-xs text-white/60 hover:text-sky-300 whitespace-nowrap transition flex items-center gap-1"
          >
            See all <ArrowRight className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-[#02050d] to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-[#02050d] to-transparent z-10" />

        {loading ? (
          <div className="flex gap-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-28 sm:w-36 h-36 sm:h-48 bg-white/[0.03] rounded-xl border border-white/[0.04]"
              />
            ))}
          </div>
        ) : (
          <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {items.map((g) => (
              <a
                key={g.id}
                href={`/rings/${g.id}`}
                className="block w-28 sm:w-36 flex-shrink-0 group"
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black border border-white/[0.06] group-hover:border-sky-400/30 transition-all duration-300">
                  <img
                    src={g.poster_url || "/poster-fallback.png"}
                    alt={g.title ?? "Ring poster"}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-1.5 text-xs text-center text-white/75 group-hover:text-white truncate transition-colors">
                  {g.title}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}