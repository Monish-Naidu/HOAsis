"use client";

import { usePathname } from "next/navigation";
import { IconTile } from "@/components/ui/primitives";
import { sectionFor } from "@/lib/board-routes";

/**
 * The section's icon, lit, beside a page title.
 *
 * Derived from the route table rather than passed by each page, so the tile
 * on the Finances header is the same glyph and the same teal as the row in
 * the rail that opened it, and a page under a section (a homeowner's
 * opening balances, a document import) wears its section's tile. So does a
 * page folded under another row: Voting wears Meetings' tile, because
 * Meetings is the row that is lit while it is open. Nothing outside the
 * board routes, so the primitive renders nothing elsewhere.
 */
export function RouteTile() {
  const pathname = usePathname();
  const route = sectionFor(pathname);
  if (!route) return null;
  return (
    <IconTile
      icon={route.icon}
      tint={route.tint ?? "blue"}
      variant="solid"
      size="lg"
      className="pop-in mt-0.5"
    />
  );
}
