import { cn } from "@/lib/utils";

/**
 * A waterline over a roofline: the oasis and the house in one mark.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950",
        className,
      )}
      // Corner radius scales with the mark rather than sitting at a fixed 9px.
      // A radius tuned for 28px reads as a rounded square at 40 and as a
      // circle at 18, and the mark stops looking like the same mark.
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.62, height: size * 0.62 }}
      >
        <path d="M3 10.5 12 4l9 6.5" />
        <path d="M5.5 12.5V19" />
        <path d="M18.5 12.5V19" />
        <path d="M3 19c1.4 0 1.4-1.2 2.8-1.2S7.2 19 8.6 19s1.4-1.2 2.8-1.2S12.8 19 14.2 19s1.4-1.2 2.8-1.2S18.4 19 19.8 19H21" />
      </svg>
    </span>
  );
}

/**
 * The mark and the name.
 *
 * Type is set at 0.58 of the mark and tracked in as it grows. Letter spacing
 * that looks right on a 16px word looks loose at 24px, which is the single
 * most common reason a scaled up wordmark reads as amateur.
 */
export function Wordmark({ className, size = 28 }: { className?: string; size?: number }) {
  const fontSize = size * 0.58;
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: size * 0.26 }}>
      <Logo size={size} />
      <span
        className="font-semibold text-fg"
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
