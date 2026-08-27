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
      // Weight is in user units against a 40 unit box, so the mark holds the
      // same optical line at every size. The drawn logo is thinner still,
      // around 0.7 here, which lands under a pixel anywhere it actually gets
      // used and renders as grey mush; 1.3 is the thinnest that stays black.
      strokeWidth={1.3}
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <circle cx="20" cy="20" r="16.4" />

      {/* Dune: a main ridge and a smaller one stepping down in front of it. */}
      <path d="M9.9 25.6 16.5 20 21.7 24.9" />
      <path d="M10.8 27.2 13.6 24.5 16.3 27" />

      {/* Palm. The trunk rises just right of centre and the crown is a burst
          of eight fronds around its head, four a side, long and short
          alternating. Fewer than that and the mark reads as a shrub. */}
      <path d="M25.2 27.5c-.6-5.3-.7-10.6-.3-15.9" />
      <path d="M25 11.6c-1-2.8-3.4-4.4-6-4.4" />
      <path d="M25 11.6c-2.9-2.6-6.1-3.1-8.4.7" />
      <path d="M25 11.6c-3.5-.2-5.7 2.2-6 5.4" />
      <path d="M25 11.6c-1.9.4-3 2.1-3.1 4.6" />
      <path d="M25 11.6c.8-3.2 2.9-5 5.3-5.2" />
      <path d="M25 11.6c2.5-2.9 6.1-2.9 8.6-.2" />
      <path d="M25 11.6c3.3-.6 5.6 1.5 6 4.2" />
      <path d="M25 11.6c1.7.3 2.8 2.2 2.8 4.9" />

      {/* Shoreline, then the water below it. Three strokes rather than one:
          a flat line under an island reads as a rule, a bowl and a lens read
          as water. */}
      <path d="M5.9 27.7c4.4-.5 8.8-.7 13.2-.4 5.1.3 10.3.2 15.4-.2" />
      <path d="M7.4 29.8c2.4 3.7 8 6.6 14 6.6 4 0 7.7-2.3 10.5-7" />
      <path d="M12.4 32.5c4.6 2.4 9.9 2.3 15.9-.4" />
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
