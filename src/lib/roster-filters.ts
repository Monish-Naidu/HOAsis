import type { Home } from "@/lib/types";

/**
 * The roster's filter chips, and the count on each.
 *
 * The count and the list under a chip come from the same predicate, so a chip
 * that says 7 can never open a list of 6. Homes with nobody on record are
 * neither paid up nor on autopay nor missing an email: there is no person to
 * say it of.
 */
export const HOME_FILTERS = ["all", "paid-up", "past-due", "autopay", "no-email"] as const;
export type HomeFilter = (typeof HOME_FILTERS)[number];

export const HOME_FILTER_LABEL: Record<HomeFilter, string> = {
  all: "All",
  "paid-up": "Paid up",
  "past-due": "Past due",
  autopay: "Autopay on",
  "no-email": "No email on file",
};

type FilterFields = Pick<Home, "daysPastDue" | "placeholder" | "autopay" | "email">;

export function matchesHomeFilter(o: FilterFields, filter: HomeFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "paid-up":
      return o.daysPastDue === 0 && !o.placeholder;
    case "past-due":
      return o.daysPastDue > 0;
    case "autopay":
      return o.autopay && !o.placeholder;
    case "no-email":
      return !o.placeholder && !o.email.trim();
  }
}

export function homeFilterCounts(homes: readonly FilterFields[]): Record<HomeFilter, number> {
  const counts = {} as Record<HomeFilter, number>;
  for (const f of HOME_FILTERS) counts[f] = homes.filter((o) => matchesHomeFilter(o, f)).length;
  return counts;
}
