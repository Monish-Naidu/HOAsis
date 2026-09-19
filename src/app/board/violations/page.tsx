import { EnforcementQueue } from "@/components/app/enforcement-queue";
import { NoticesBoard } from "@/components/app/notices-board";
import { moduleOn } from "@/lib/modules";

export const metadata = { title: "Notices" };

/**
 * Notices, simple, since the 2026-09-19 launch scope: open or resolved, and
 * three things a board can do. The full enforcement queue (neighbour reports,
 * city notices, the stage ladder, reporting patterns) is one switch away in
 * `lib/modules.ts` for the board that asks for it.
 */
export default function BoardViolations() {
  return moduleOn("enforcement-full") ? <EnforcementQueue /> : <NoticesBoard />;
}
