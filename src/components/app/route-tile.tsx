"use client";

import { usePathname } from "next/navigation";
import { IconTile } from "@/components/ui/primitives";
import { routeFor } from "@/lib/board-routes";

/**
 * The section's icon, lit, beside a page title.
 *
 * Derived from the route table rather than passed by each page, so the tile
 * on the Finances header is the same glyph and the same teal as the row in
 * the rail that opened it, and a page under a section (a homeowner's
 * opening balances, a document import) wears its section's tile. A page
 * with its own line in the route table wears its own glyph: Voting under
 * Meetings wore a video camera beside the word "Voting", and Notices wore
 * the requests inbox. Nothing outside the board routes, so the primitive
 * renders nothing elsewhere.
 */
export function RouteTile() {
  const pathname = usePathname();
  const route = routeFor(pathname);
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
