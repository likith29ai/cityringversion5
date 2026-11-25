// File: app/components/RingCarousel3D.tsx
"use client";

import React, {
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Plane,
  useTexture,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
} from "@react-three/postprocessing";
import type { Texture, Group as ThreeGroup } from "three";
import gsap from "gsap";

/* -------------------------------------------------
   Public type – matches Supabase ring data
------------------------------------------------- */
export interface CarouselRing {
  id: string;
  name: string;
  poster_url: string;
}

/* -------------------------------------------------
   Props for the carousel component
------------------------------------------------- */
interface RingCarouselProps {
  rings: CarouselRing[];
  loading?: boolean;
}

/* -------------------------------------------------
   Internal scene props
------------------------------------------------- */
interface SceneProps {
  rings: CarouselRing[];
  rotationStep: number;
  hoveredIndex: number | null;
}

/* -------------------------------------------------
   Poster plane – uses MeshStandardMaterial so we can
   set emissive (bright‑on‑hover) properties.
------------------------------------------------- */
function PosterPlane({
  texture,
  position,
  rotation,
  isHovered,
}: {
  texture: Texture;
  position: [number, number, number];
  rotation: [number, number, number];
  isHovered: boolean;
}) {
  const scale = isHovered ? 1.2 : 1;
  const emissiveIntensity = isHovered ? 0.4 : 0;

  return (
    <Plane
      args={[1.15 * scale, 1.7 * scale]}
      position={position}
      rotation={rotation}
    >
      <meshStandardMaterial
        map={texture}
        toneMapped={false}
        emissive={isHovered ? "#ffffff" : "#000000"}
        emissiveIntensity={emissiveIntensity}
      />
    </Plane>
  );
}

/* -------------------------------------------------
   Three‑js scene – rendered inside Canvas
------------------------------------------------- */
function CarouselScene({
  rings,
  rotationStep,
  hoveredIndex,
}: SceneProps) {
  const groupRef = useRef<ThreeGroup | null>(null);

  // Load all poster textures (fallback if a URL is missing)
  const textures = useTexture(
    rings.map((ring) => ring.poster_url || "/poster-fallback.png")
  ) as Texture[];

  /* ---- GSAP step animation (when navigation buttons are pressed) ---- */
  useEffect(() => {
    if (!groupRef.current || rings.length < 2) return;

    const angle = (Math.PI * 2) / rings.length;

    const tween = gsap.to(groupRef.current.rotation, {
      y: -rotationStep * angle,
      duration: 1,
      ease: "power3.inOut",
    });

    // Cleanup – kill the tween when effect re‑runs or component unmounts
    return () => {
      tween.kill();
    };
  }, [rotationStep, rings.length]);

  /* ---- Inertia‑style continuous rotation (idle drift) ---- */
  const rotationSpeed = useRef(0); // radians per second
  useFrame((_, delta) => {
    if (groupRef.current && rotationSpeed.current !== 0) {
      groupRef.current.rotation.y += rotationSpeed.current * delta;
    }
  });

  /* ---- Give a short spin impulse after each manual step ---- */
  const applySpinImpulse = useCallback(() => {
    const target = 0.4; // rad/s
    const duration = 0.8;

    const tween = gsap.fromTo(
      rotationSpeed,
      { current: 0 },
      {
        current: target,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          rotationSpeed.current = (gsap.getProperty(
            rotationSpeed,
            "current"
          ) as number);
        },
        onComplete: () => {
          gsap.to(rotationSpeed, {
            current: 0,
            duration: 0.6,
            ease: "power2.in",
            onUpdate: () => {
              rotationSpeed.current = (gsap.getProperty(
                rotationSpeed,
                "current"
              ) as number);
            },
          });
        },
      }
    );

    return () => tween.kill();
  }, []);

  /* ---- Fire impulse whenever the step changes ---- */
  useEffect(() => {
    if (rotationStep !== 0) applySpinImpulse();
  }, [rotationStep, applySpinImpulse]);

  /* ---- Geometry ---- */
  const radius = rings.length <= 3 ? 1.9 : 2.7;

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => {
        const angle = (i * Math.PI * 2) / rings.length;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;

        const isHovered = hoveredIndex === i;

        return (
          <PosterPlane
            key={ring.id}
            texture={textures[i]}
            position={[x, 0, z]}
            rotation={[0, angle, 0]}
            isHovered={isHovered}
          />
        );
      })}
    </group>
  );
}

/* -------------------------------------------------
   Exported carousel component – loading, auto‑rotate,
   manual navigation, swipe, hover, and post‑processing.
------------------------------------------------- */
export default function RingCarousel3D({
  rings,
  loading = false,
}: RingCarouselProps) {
  const [rotationStep, setRotationStep] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const startX = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- Reduced‑motion preference ---- */
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  /* ---- Manual navigation (buttons & swipe) ---- */
  const moveCarousel = (direction: number) => {
    if (rings.length < 2) return;
    setRotationStep((c) => c + direction);
    setAutoPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAutoPaused(false), 5_000);
  };

  /* ---- Automatic rotation every 4.5 s (paused when user interacts) ---- */
  useEffect(() => {
    if (rings.length < 2 || autoPaused || prefersReduced) return;

    const interval = setInterval(() => {
      setRotationStep((c) => c + 1);
    }, 4_500);
    return () => clearInterval(interval);
  }, [rings.length, autoPaused, prefersReduced]);

  /* ---- Cleanup timer on unmount ---- */
  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  /* ---- Mobile swipe handling ---- */
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const diff = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(diff) > 50) moveCarousel(diff > 0 ? -1 : 1);
  };

  /* ---- Loading / empty states ---- */
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="w-40 h-56 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (rings.length === 0) return null;

  /* -------------------------------------------------
     Render Canvas with post‑processing (bloom + DOF)
  ------------------------------------------------- */
  return (
    <div
      className="relative w-full h-[300px] sm:h-[380px] lg:h-[430px]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        frameloop={prefersReduced ? "never" : "always"}
      >
        {/* Camera placed a bit lower for a more intimate view */}
        <PerspectiveCamera makeDefault position={[0, 0.3, 6]} fov={45} />

        {/* Soft ambient light + a subtle directional light for highlights */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 5, 5]} intensity={0.4} color="#88c0ff" />

        {/* Post‑processing – gentle bloom & shallow depth‑of‑field */}
        <EffectComposer multisampling={8}>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            height={300}
            opacity={0.7}
          />
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
        </EffectComposer>

        <Suspense fallback={null}>
          <CarouselScene
            rings={rings}
            rotationStep={rotationStep}
            hoveredIndex={hoveredIndex}
          />
        </Suspense>
      </Canvas>

      {/* Navigation arrows – only when more than one ring */}
      {rings.length > 1 && (
        <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
          <button
            type="button"
            aria-label="Previous Ring"
            onClick={() => moveCarousel(-1)}
            className="pointer-events-auto w-10 h-10 rounded-full border border-sky-400/40 bg-black/60 text-white hover:bg-sky-500/30 transition"
          >
            &#9664;
          </button>
          <button
            type="button"
            aria-label="Next Ring"
            onClick={() => moveCarousel(1)}
            className="pointer-events-auto w-10 h-10 rounded-full border border-sky-400/40 bg-black/60 text-white hover:bg-sky-500/30 transition"
          >
            &#9654;
          </button>
        </div>
      )}

      {/* Hover detection – maps cursor to a poster index */}
      <div
        className="absolute inset-0"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          // Simple angle‑to‑index conversion (posters lie on a circle)
          const angle = Math.atan2(x, -y);
          const index = Math.round(((angle + Math.PI) / (2 * Math.PI)) * rings.length) % rings.length;
          setHoveredIndex(index);
        }}
        onMouseLeave={() => setHoveredIndex(null)}
        style={{ cursor: "grab" }}
      />
    </div>
  );
}