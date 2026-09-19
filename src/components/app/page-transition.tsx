"use client";

import { usePathname } from "next/navigation";

/**
 * Every page rises in, a section at a time.
 *
 * Keyed on the path, so moving between tabs remounts the wrapper and the new
 * page plays the same short settle the individual screens already used one
 * at a time. The wrapper is a `.stagger` parent: each direct child of the
 * page (header, then card, then card) lands a beat after the one before, so
 * a route change reads as the page arriving rather than switching. Reduced
 * motion turns it off in globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="stagger">
      {children}
    </div>
  );
}
