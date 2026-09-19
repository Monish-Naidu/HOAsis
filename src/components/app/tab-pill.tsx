"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A background that travels between selected tabs instead of cutting.
 *
 * The pill is one absolutely positioned element behind the row. When the
 * selection changes it moves and resizes to the new tab's box, which reads as
 * one object moving rather than two objects swapping. That is the whole trick
 * behind an iOS segmented control, and it costs one measurement per change.
 *
 * The children keep rendering their own text and icons. This only owns the
 * background, so a tab is still a plain link and still works before hydration
 * and with JavaScript off; it simply does not slide.
 */
export function TabPill({
  children,
  activeKey,
  orientation = "horizontal",
  className,
  pillClassName,
}: {
  children: React.ReactNode;
  /** Changes whenever the selection does, which is what triggers the move. */
  activeKey: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
  pillClassName?: string;
}) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const frame = useRef<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  /**
   * Measures the element marked current and parks the pill on it.
   *
   * Deliberately a ref callback rather than an effect. React re-invokes a ref
   * whose identity changed, and this one changes with `activeKey`, so a new
   * selection re-measures without a single setState inside an effect body.
   *
   * The animation frame is because the paint immediately after a route change
   * still has the old geometry.
   */
  const measure = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const park = () => {
      // By key first, then by aria-current. The key lookup is what makes this
      // callback genuinely depend on the selection rather than only being
      // re-created by it.
      const active =
        node.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(activeKey)}"]`) ??
        node.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) {
        setBox(null);
        return;
      }
      setBox({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
      });
    };
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(park);
    // The rows move without the selection changing: a section appears once
    // the association loads, the setup row leaves when the plan is done, a
    // badge widens. The pill follows the row rather than the moment.
    if (typeof ResizeObserver !== "undefined") {
      observer.current = new ResizeObserver(() => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(park);
      });
      observer.current.observe(node);
    }
  }, [activeKey]);

  return (
    <div
      ref={measure}
      data-active={activeKey}
      className={cn("relative", orientation === "vertical" ? "block" : "flex", className)}
    >
      <span
        aria-hidden
        className={cn(
          "tab-pill pointer-events-none absolute left-0 top-0 rounded-lg bg-brand-soft",
          pillClassName,
        )}
        style={
          box
            ? {
                transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
                width: box.w,
                height: box.h,
                opacity: 1,
              }
            : { opacity: 0 }
        }
      />
      {children}
    </div>
  );
}
