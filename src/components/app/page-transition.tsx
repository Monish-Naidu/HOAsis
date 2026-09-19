"use client";

import { usePathname } from "next/navigation";

/**
 * Every page rises in.
 *
 * Keyed on the path, so moving between tabs remounts the wrapper and the
 * new page plays the same short settle the individual screens already
 * used one at a time. Reduced motion turns it off in globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-rise">
      {children}
    </div>
  );
}
