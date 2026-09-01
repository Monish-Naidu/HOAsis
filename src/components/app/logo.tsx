import { cn } from "@/lib/utils";

/**
 * The ExpressHOA hummingbird, drawn as folded paper: two raised wing blades,
 * a needle beak, a forked tail. A hummingbird is small, fast, and precise,
 * and it hovers exactly as long as the task takes, which is the brand's whole
 * argument (docs/design/brand-expresshoa.md).
 *
 * Every shape fills with `currentColor` inherited from a `text-accent`
 * wrapper, so the mark flips with the theme like any other accent. The wings
 * are the same color at partial opacity rather than a second blue: one hue
 * keeps the mark crisp on any surface. The eye is a true hole, cut with an
 * even-odd subpath instead of painted in a background color, so the mark can
 * sit on the hero, a card, or the navy rail without carrying a wrong-colored
 * dot around.
 *
 * The beak is deliberately chunkier than the concept render's: a needle that
 * thin disappears entirely at the 18px the sidebar uses.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("inline-block shrink-0 text-accent", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Rear wing, then front wing, then the bird over both. */}
      <path d="M15 6 L25 16.5 L12.5 19.5 Z" fill="currentColor" opacity={0.45} />
      <path d="M25 4 L29.5 16 L16.5 18 Z" fill="currentColor" opacity={0.75} />
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M12 30 L18 20 L26 16 L33.5 15.8 L36 18.2 L30 24 L20 32 Z
           M29.2 18.8 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0 Z"
      />
      <path d="M33.5 16.2 L47 12 L35.8 20.4 Z" fill="currentColor" />
      <path d="M13 29 L2 39 L15 33 Z" fill="currentColor" />
      <path d="M14 33 L9 46 L18 34.5 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The mark and the name.
 *
 * Type is set at 0.58 of the mark and tracked in as it grows. Letter spacing
 * that looks right on a 16px word looks loose at 24px, which is the single
 * most common reason a scaled up wordmark reads as amateur.
 *
 * "Express" wears the ink and "HOA" wears the accent, per the 2026-09-01
 * brand concept. One weight throughout: the color split carries the rhythm,
 * and adding a weight change on top would be two voices saying one word.
 */
export function Wordmark({ className, size = 28 }: { className?: string; size?: number }) {
  const fontSize = size * 0.58;
  return (
    <span className={cn("inline-flex items-center text-fg", className)} style={{ gap: size * 0.22 }}>
      <Logo size={size} />
      <span
        className="font-semibold"
        style={{
          fontSize,
          letterSpacing: `${-0.014 - Math.min(size, 48) * 0.0004}em`,
          lineHeight: 1,
        }}
      >
        Express<span className="text-accent">HOA</span>
      </span>
    </span>
  );
}
