import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The ExpressHOA hummingbird, replicated from the low-poly render Monish
 * brought on 2026-09-01: a fan of three gradient wing blades, a faceted body
 * leaning from head to tail, a needle beak, and twin tail streamers. A
 * hummingbird is small, fast, and precise, and it hovers exactly as long as
 * the task takes, which is the brand's whole argument
 * (docs/design/brand-expresshoa.md).
 *
 * The blues are fixed rather than tokens: this is artwork, like the device
 * bezels, and the ramp was chosen to hold on white, the light hero, and navy
 * alike. Gradient ids come from `useId`, because the mark renders more than
 * once per page (header and footer) and duplicated SVG defs ids are how one
 * copy quietly borrows the other's colors.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  const uid = useId();
  const id = (name: string) => `${name}${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id("w1")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#e8f1ff" />
          <stop offset="1" stopColor="#7fb0f7" />
        </linearGradient>
        <linearGradient id={id("w2")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#b9d4fe" />
          <stop offset="1" stopColor="#5c96f2" />
        </linearGradient>
        <linearGradient id={id("w3")} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#7fb0f7" />
          <stop offset="1" stopColor="#2f6fe0" />
        </linearGradient>
        <linearGradient id={id("bd")} x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#5c96f2" />
          <stop offset="1" stopColor="#2257c9" />
        </linearGradient>
        <linearGradient id={id("tl")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b8bf5" />
          <stop offset="1" stopColor="#1e49a8" />
        </linearGradient>
      </defs>
      {/* The wing fan, back blade to front. */}
      <polygon points="48,42 6,16 20,3" fill={url("w1")} />
      <polygon points="51,42 26,2 42,9" fill={url("w2")} />
      <polygon points="58,46 47,7 63,17" fill={url("w3")} />
      {/* Tail streamers. */}
      <polygon points="40,62 12,78 3,91 30,72" fill={url("tl")} />
      <polygon points="38,66 13,96 30,75" fill="#2f6fe0" />
      <polygon points="43,64 30,84 43,71" fill="#1e49a8" />
      {/* Body, then head over the wing roots. */}
      <polygon points="48,38 64,36 60,52 42,52" fill={url("bd")} />
      <polygon points="42,52 60,52 48,68 36,62" fill="#2257c9" />
      <polygon points="56,24 66,28 64,37 52,34" fill="#4b8bf5" />
      <polygon points="52,34 64,37 60,45 48,42" fill="#3567d8" />
      {/* The needle. */}
      <polygon points="64,30 98,26 65,34" fill="#1b3e8c" />
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
    <span className={cn("inline-flex items-center text-fg", className)} style={{ gap: size * 0.2 }}>
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
