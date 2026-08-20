import { cn } from "@/lib/utils";

/**
 * A waterline over a roofline: the oasis and the house in one mark.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[9px] bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950",
        className,
      )}
      style={{ width: size, height: size }}
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

export function Wordmark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo size={size} />
      <span
        className="font-semibold tracking-[-0.02em] text-fg"
        style={{ fontSize: size * 0.54 }}
      >
        HOAsis
      </span>
    </span>
  );
}
