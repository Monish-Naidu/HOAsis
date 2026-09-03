import { EnforcementQueue } from "@/components/app/enforcement-queue";

export const metadata = { title: "Violations" };

/**
 * Enforcement, on its own page since the 2026-09-01 design and as one queue
 * since 2026-09-03. Reports from neighbours, the board's own notices and
 * anything the city has sent share a list, split by what is waiting on the
 * board rather than by where it came from.
 */
export default function BoardViolations() {
  return <EnforcementQueue />;
}
