import { cn } from "@/lib/utils";

/**
 * The oasis in a circle: a palm over a dune, with the waterline beneath it.
 *
 * This is the mark Monish's friend drew, redrawn as an open stroke rather than
 * traced from the screenshot, so it stays crisp at 18px in a sidebar and at
 * 96px on a marketing page. It is a single `currentColor` stroke with no fill,
 * which is what lets it sit on the navy hero and on a white sidebar without a
 * second copy of the artwork.
 *
 * Every path is drawn to finish inside the ring rather than being clipped to
 * it. A `<clipPath>` needs an id, and an id repeated by the header mark and
 * the footer mark on the same page is invalid; trimming the curves by hand
 * costs nothing and leaves the mark a single self-contained element.
 *
 * The old mark was a filled navy square holding a roofline. That container is
 * gone on purpose: the drawn circle is the container now, and keeping both
 * would put a box inside a box.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Weight is in user units against a 40 unit box. The drawn logo is
      // thinner, 0.89 here, which lands well under a pixel at every size the
      // mark is actually used at and renders as grey mush; 1.3 is the thinnest
      // that stays solid at 24px.
      strokeWidth={1.3}
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* The ring is two arcs, not a circle: it breaks at about five o'clock
          and again at seven, and the lower arc doubles as the far edge of the
          water. Drawing a closed circle and laying the water over it is the
          obvious shortcut and it loses the thing that makes the water read as
          water rather than as a line across a coin. */}
      <path d="M3.15 24.3A17.5 17.5 0 1 1 36.85 24.3" />
      <path d="M8.07 32.8A17.5 17.5 0 0 0 32.16 32.59" />

      {/* Dune: a tall ridge left of centre, and a smaller one stepping down to
          the shore in front of it. */}
      <path d="M10.7 24.6 16.6 19.9 22.7 25.2" />
      <path d="M14 27.9 16 26.4 17.9 27.9" />

      {/* Palm. The trunk is dead vertical at 26, and the crown is eight fronds
          around its head at 11. The top pair rise and hook, and the right one
          crosses the ring rather than stopping at it, which is what the drawing
          does. The outer pair reach furthest and arc over before dropping; the
          rest fall away. */}
      <path d="M25.95 27.4c-.15-5.5-.1-11 .1-16.4" />
      <path d="M26 11c-1.4-3-2.2-4.8-3.7-5.3-.7-.2-1.3.2-1.5.9" />
      <path d="M26 11c-2-1.4-3.5-1.8-5.5-1.1-1.3.5-1.9 1.3-1.8 2.2" />
      <path d="M26 11c-1.7 0-3.4.2-4.3 1.4-.8 1.1-.5 3 .2 4.3" />
      <path d="M26 11c-.5 1.3-1 2.2-2 3-.6.5-1.2 1-1.6 1.6" />
      <path d="M26 11c1.4-3 2.4-5.4 4.2-5.8 1-.2 1.9.3 2 1.2" />
      <path d="M26 11c2.5-1.8 5.5-2 7.9-.4 1.2.8 1.9 2.1 2 3.3" />
      <path d="M26 11c1.9.2 3.8.8 5 2.1.9.9 1.3 1.7 1.4 2.6" />
      <path d="M26 11c.6 1.3 1.2 2.2 2 3 .6.6.9 1.4 1 2.2" />

      {/* The water. The shore runs the full width behind the island; below it
          a current leaves the shore on the right and sweeps down to the left,
          and one short line sits inside the lens it makes with the ring. */}
      <path d="M4.5 28.3c2.4-.5 4.8-.7 7.2-.3 4.3.6 9.3.5 14.3-.2 3-.4 6.5.2 10 .5" />
      <path d="M27 28.1c-3 .8-5.5 1.5-8.5 2.7-3 1.2-6 2-8.5 2.4" />
      <path d="M30 31.9c-2 .7-4 1-6 1.2-1.8.2-3.6.5-5.2 1" />
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
 * "HOAsis" is one weight and one colour throughout. The temptation is to set
 * "HOA" apart from "sis"; the drawn logo does not, and splitting it turns a
 * name into an explanation.
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
        HOAsis
      </span>
    </span>
  );
}
