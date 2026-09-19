"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Every page rises in, a section at a time, from the side it came from.
 *
 * Keyed on the path, so moving between tabs remounts the wrapper and the new
 * page plays the same short settle the individual screens already used one
 * at a time. The wrapper is a `.stagger` parent: each direct child of the
 * page (header, then card, then card) lands a beat after the one before.
 *
 * Given the rail's order, the page also knows which way it moved: a section
 * further down the rail enters from the right, one further up from the
 * left, so the app reads as a row of rooms rather than a deck of cards. A
 * page inside the same section, or a first paint, simply rises. Reduced
 * motion turns all of it off in globals.css.
 */
export function PageTransition({
  children,
  order = [],
}: {
  children: React.ReactNode;
  /** The rail's hrefs, top to bottom. */
  order?: string[];
}) {
  const pathname = usePathname();
  // The previous path is state derived from the current one: when the path
  // changes, the direction is worked out from where it was, and then it is
  // where it is. Adjusting state during render is React's own pattern for
  // this; an effect would paint one frame in the wrong direction first.
  const [travel, setTravel] = useState({ path: pathname, dir: 0 });
  if (travel.path !== pathname) {
    setTravel({ path: pathname, dir: direction(order, travel.path, pathname) });
  }
  const dir = travel.path === pathname ? travel.dir : direction(order, travel.path, pathname);
  return (
    <div
      key={pathname}
      className={cn("stagger", dir > 0 && "page-from-right", dir < 0 && "page-from-left")}
    >
      {children}
    </div>
  );
}

/** Which rail row a path belongs to, longest match first. */
function rowOf(order: string[], path: string): number {
  let best = -1;
  let bestLength = -1;
  order.forEach((href, index) => {
    const match = path === href || path.startsWith(`${href}/`);
    if (match && href.length > bestLength) {
      best = index;
      bestLength = href.length;
    }
  });
  return best;
}

function direction(order: string[], from: string, to: string): number {
  const a = rowOf(order, from);
  const b = rowOf(order, to);
  if (a === -1 || b === -1 || a === b) return 0;
  return b > a ? 1 : -1;
}
