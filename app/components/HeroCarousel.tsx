// File: app/components/HeroCarousel.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";

export interface CarouselRing {
  id: string;
  name: string;
  title?: string;
  poster_url: string;
}

interface HeroCarouselProps {
  rings: CarouselRing[];
  loading?: boolean;
}

export default function HeroCarousel({
  rings,
  loading = false,
}: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = rings.length;

  /* ── Auto-rotate ── */
  useEffect(() => {
    if (count < 2 || autoPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % count);
    }, 4000);
    return () => clearInterval(interval);
  }, [count, autoPaused]);

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  /* ── Navigate ── */
  const goTo = useCallback(
    (direction: number) => {
      if (count < 2) return;
      setActiveIndex((prev) => (prev + direction + count) % count);
      setAutoPaused(true);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => setAutoPaused(false), 6000);
    },
    [count]
  );

  /* ── GSAP animate cards ── */
  useEffect(() => {
    if (!containerRef.current || count === 0) return;
    const cards = containerRef.current.querySelectorAll<HTMLElement>("[data-card]");

    cards.forEach((card, i) => {
      let offset = i - activeIndex;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;

      const absOffset = Math.abs(offset);
      const isVisible = absOffset <= 2;

      // Fan layout: each card shifts sideways and back into Z
      const xShift = offset * 130;
      const zShift = -absOffset * 80;
      const rotation = -offset * 12;
      const cardScale = Math.max(0.65, 1 - absOffset * 0.14);
      const cardOpacity = isVisible ? Math.max(0.35, 1 - absOffset * 0.28) : 0;

      gsap.to(card, {
        x: xShift,
        z: zShift,
        rotateY: rotation,
        scale: cardScale,
        opacity: cardOpacity,
        zIndex: 50 - absOffset,
        duration: 0.7,
        ease: "power2.out",
        display: isVisible ? "block" : "none",
      });
    });
  }, [activeIndex, count]);

  /* ── Swipe ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(diff) > 40) goTo(diff > 0 ? -1 : 1);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="w-full h-[220px] sm:h-[300px] flex items-center justify-center">
        <div className="flex gap-3 items-end">
          <div className="w-24 h-32 rounded-xl bg-white/5 animate-pulse" />
          <div className="w-32 h-44 rounded-xl bg-white/5 animate-pulse" />
          <div className="w-24 h-32 rounded-xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div
      className="relative w-full h-[220px] sm:h-[280px] lg:h-[340px] select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Glowing reflection ellipse ── */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 w-[75%] sm:w-[55%] h-[40px] sm:h-[55px] z-0">
        <div
          className="orbit-ring w-full h-full rounded-[50%]"
          style={{
            background: "radial-gradient(ellipse, rgba(56,189,248,0.12) 0%, transparent 70%)",
            boxShadow: "0 0 60px rgba(56,189,248,0.1), 0 0 120px rgba(56,189,248,0.05)",
          }}
        />
      </div>

      {/* ── Card track ── */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center"
        style={{ perspective: "1000px" }}
      >
        {rings.map((ring, i) => {
          let offset = i - activeIndex;
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;
          const absOffset = Math.abs(offset);
          const isActive = i === activeIndex;

          return (
            <div
              key={ring.id}
              data-card
              className="absolute cursor-pointer"
              onClick={() => {
                if (!isActive) {
                  setActiveIndex(i);
                  setAutoPaused(true);
                  if (resumeTimer.current) clearTimeout(resumeTimer.current);
                  resumeTimer.current = setTimeout(() => setAutoPaused(false), 6000);
                }
              }}
              style={{
                width: "clamp(120px, 28vw, 170px)",
                transformStyle: "preserve-3d",
                zIndex: 50 - absOffset,
              }}
            >
              <div
                className="rounded-2xl overflow-hidden transition-shadow duration-500"
                style={{
                  aspectRatio: "3 / 4.2",
                  boxShadow: isActive
                    ? "0 0 25px rgba(56,189,248,0.35), 0 15px 50px rgba(0,0,0,0.5)"
                    : "0 8px 30px rgba(0,0,0,0.4)",
                  border: isActive
                    ? "1.5px solid rgba(56,189,248,0.5)"
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <img
                  src={ring.poster_url || "/poster-fallback.png"}
                  alt={ring.title || ring.name || "Ring"}
                  className="w-full h-full object-cover"
                  draggable={false}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (!img.dataset.tried) {
                      img.dataset.tried = "1";
                      img.src = "/poster-fallback.png";
                    }
                  }}
                />
                {/* Title at bottom */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 pt-6">
                  <p className="text-white text-[11px] sm:text-xs font-semibold truncate">
                    {ring.title || ring.name}
                  </p>
                </div>
                {/* Active glow */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ boxShadow: "inset 0 0 20px rgba(56,189,248,0.1)" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Navigation — small, subtle, no dots ── */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => goTo(-1)}
            className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:border-sky-400/40 transition-all flex items-center justify-center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => goTo(1)}
            className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:border-sky-400/40 transition-all flex items-center justify-center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}