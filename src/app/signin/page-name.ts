import { residentTabFor } from "@/components/app/resident-nav";
import { routeFor } from "@/lib/board-routes";

/**
 * What to call the page a visitor was sent here from, for the line above the
 * form: "Sign in to open Pay". Null when the destination is not a page worth
 * naming (the join flow, a path the app does not know), so no line is shown.
 *
 * A link under /c/<slug> keeps its slug in `next`; the slug is the
 * association, not the page, so it is dropped before the path is matched.
 */
export function pageNameFor(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  const path = next.split(/[?#]/)[0].replace(/^\/c\/[^/]+/, "") || "/";
  if (path === "/") return "your association";
  if (path === "/resident/report" || path.startsWith("/resident/report/"))
    return "Report a problem";
  if (path === "/board" || path.startsWith("/board/")) return routeFor(path)?.label ?? "that page";
  if (path === "/resident" || path.startsWith("/resident/")) {
    return residentTabFor(path)?.label ?? "that page";
  }
  return null;
}
