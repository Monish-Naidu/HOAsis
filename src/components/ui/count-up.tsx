"use client";

import { useCallback } from "react";
import { money } from "@/lib/utils";

/**
 * A figure that counts up to itself on first paint.
 *
 * The server renders the final number, so the page is right before any
 * JavaScript runs and stays right if none ever does. On the client a ref
 * callback (not an effect, so nothing sets state after render) writes the
 * intermediate frames straight into the node's text and lands on exactly
 * the string the server rendered. Eight hundred milliseconds, eased out,
 * which is long enough to notice and short enough not to wait for.
 *
 * Money stays integer cents the whole way through `money()`. Reduced motion
 * skips the count and shows the figure.
 */
export function CountUp({
  cents,
  value,
  kind = "money",
  showCents = false,
  suffix = "",
  className,
}: {
  /** For `kind="money"`. */
  cents?: number;
  /** For `kind="number"` or `kind="percent"`. */
  value?: number;
  kind?: "money" | "number" | "percent";
  showCents?: boolean;
  suffix?: string;
  className?: string;
}) {
  const target = kind === "money" ? (cents ?? 0) : (value ?? 0);
  const format = useCallback(
    (n: number) => {
      if (kind === "money") return money(Math.round(n), { cents: showCents }) + suffix;
      if (kind === "percent") return `${Math.round(n)}%${suffix}`;
      return `${Math.round(n).toLocaleString("en-US")}${suffix}`;
    },
    [kind, showCents, suffix],
  );

  const attach = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node || target === 0) return;
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Only once per node. A re-render that keeps the node must not restart.
      if (node.dataset.counted === "1") return;
      node.dataset.counted = "1";

      const final = format(target);
      const duration = 800;
      let start: number | null = null;
      const frame = (now: number) => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        node.textContent = t >= 1 ? final : format(target * eased);
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    [target, format],
  );

  return (
    <span ref={attach} className={className}>
      {format(target)}
    </span>
  );
}
