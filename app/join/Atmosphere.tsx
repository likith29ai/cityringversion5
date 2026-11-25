/**
 * Cinematic atmosphere shared by the redesigned pages.
 * Styles live in ./join.css.
 * No client JS: motion is pure CSS and switches off for reduced-motion.
 */

// Deterministic skyline so server and client markup always match.
function buildSkyline() {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blocks: { x: number; y: number; w: number; h: number }[] = [];
  let x = 0;
  while (x < 1000) {
    const w = 16 + rnd() * 34;
    const tall = rnd() > 0.88;
    const h = tall ? 95 + rnd() * 70 : 22 + rnd() * 62;
    blocks.push({ x, y: 200 - h, w, h });
    x += w - 1;
  }
  return blocks;
}

const SKYLINE = buildSkyline();

/** Fixed full-screen atmosphere: charcoal base, drifting rose/ember/plum light, vignette, grain. */
export default function CinematicBackdrop() {
  return (
    <div className="cr-backdrop" aria-hidden="true">
      <div className="cr-aurora cr-aurora--rose" />
      <div className="cr-aurora cr-aurora--ember" />
      <div className="cr-aurora cr-aurora--plum" />
      <div className="cr-vignette" />
      <div className="cr-grain" />
    </div>
  );
}

/**
 * Sunset arch with a city silhouette. Render it INSIDE a `position: relative`
 * hero so it scrolls with the content. Drive the parallax with `--cr-shift`.
 */
export function HeroPortal() {
  return (
    <div className="cr-portal" aria-hidden="true">
      <div className="cr-portal-disc">
        <svg
          className="cr-portal-skyline"
          viewBox="0 0 1000 200"
          preserveAspectRatio="none"
        >
          {SKYLINE.map((b, i) => (
            <rect
              key={i}
              x={b.x.toFixed(1)}
              y={b.y.toFixed(1)}
              width={(b.w + 1).toFixed(1)}
              height={b.h.toFixed(1)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
