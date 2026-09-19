"use client";

import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";

/**
 * The bird, at rest and at work.
 *
 * A hummingbird hovers exactly as long as the task takes, which is the
 * brand's whole argument, so it is what the product shows while it waits
 * instead of a grey ring. One mark, one motion: a small hover, nothing that
 * competes with the page. `Arriving` is the same bird settling onto the
 * page, for the moments that deserve one: an association founded, a plan
 * finished.
 */
export function HummingbirdLoader({
  label = "One moment",
  size = 36,
  className,
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-3 text-fg-muted", className)}
    >
      <span className="bird-hover inline-flex">
        <Logo size={size} />
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  );
}

export function HummingbirdArriving({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("bird-arrive inline-flex", className)} aria-hidden>
      <Logo size={size} />
    </span>
  );
}
