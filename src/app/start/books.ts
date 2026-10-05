import type { CommunityDraft, DraftHousehold } from "@/lib/data/new-community";

/**
 * Where the books start, asked in the wizard and carried on the draft.
 *
 * `CommunityDraft` is the shape the whole product creates associations from
 * and it has no fiscal year, no first bill and no opening balances; those
 * arrive after founding, through the wizard's own follow-up call. They ride
 * on the draft object as extra fields so a reload, a "look around" copy and
 * the round trip through the confirmation email all keep them, and this file
 * is the one place that knows they are there.
 */

export interface Books {
  /** "MM-DD". Calendar year unless the board says otherwise. */
  fiscalYearStart: string;
  /**
   * The first due date this product bills, or null for "from the founding
   * date". Anything due before it stays inside the opening balances.
   */
  billingStartsOn: string | null;
  /** The day the opening balances are true, for an association already running. */
  openingAsOf: string;
}

/** What a roster row may carry beyond the fields the draft knows. */
export interface HouseholdExtras {
  phone?: string;
  openingBalanceCents?: number;
}

type WithBooks = CommunityDraft & { books?: Books };

export function defaultBooks(today: string): Books {
  return { fiscalYearStart: "01-01", billingStartsOn: null, openingAsOf: today };
}

export function booksOf(draft: CommunityDraft, today: string): Books {
  return (draft as WithBooks).books ?? defaultBooks(today);
}

export function withBooks(draft: CommunityDraft, books: Books): CommunityDraft {
  return { ...draft, books } as WithBooks;
}

export function extrasOf(household: DraftHousehold): HouseholdExtras {
  const h = household as DraftHousehold & HouseholdExtras;
  return { phone: h.phone, openingBalanceCents: h.openingBalanceCents };
}

export function withExtras(household: DraftHousehold, extras: HouseholdExtras): DraftHousehold {
  return { ...household, ...extras } as DraftHousehold;
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The next date dues fall due on or after `from`, for the wizard's default
 * first bill. The founding date is what the daily run assumes; offering the
 * next due day makes the default explicit and lets the board push it out.
 * The one in `@/lib/utils`, which the data layer uses too.
 */
export { nextDueOnOrAfter } from "@/lib/utils";

/**
 * Which homes need the follow-up call after founding: any with a phone or
 * an opening balance, keyed by the label create_association gave them.
 */
export function householdsNeedingBooks(draft: CommunityDraft): (DraftHousehold & HouseholdExtras)[] {
  return draft.households
    .map((h) => ({ ...h, ...extrasOf(h) }))
    .filter((h) => h.unit.trim() && ((h.phone ?? "").trim() || h.openingBalanceCents !== undefined));
}

/**
 * Today off the wall clock, as YYYY-MM-DD.
 *
 * The product pins its clock per association so demo dates never drift, and
 * that is right everywhere but here: a real board founding a real
 * association needs the real date for "balances as of" and "first bill".
 * Only the books question and the follow-up call read it, and the books
 * question is never in the prerendered HTML, so there is nothing to mismatch.
 */
export function wallToday(): string {
  return new Date().toISOString().slice(0, 10);
}
