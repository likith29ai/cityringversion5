// File: app/components/FloatingParticles.tsx
"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
}

export default function FloatingParticles({ count = 30 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate particles only on the client (after mount) to avoid hydration mismatch
  useEffect(() => {
    const generated: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      drift: (Math.random() - 0.5) * 60,
      opacity: Math.random() * 0.5 + 0.1,
    }));
    setParticles(generated);
  }, [count]);

  // Render nothing on server / first paint — avoids hydration mismatch entirely
  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: `radial-gradient(circle, rgba(56, 189, 248, ${p.opacity}) 0%, transparent 70%)`,
            "--duration": `${p.duration}s`,
            "--delay": `${p.delay}s`,
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}