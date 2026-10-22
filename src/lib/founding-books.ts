import { PersistedStore } from "@/lib/core/store";
import { isRecord } from "@/lib/core/guards";
import type { Community } from "@/lib/data/community";
import type { RosterRow } from "@/lib/roster/csv";
import { addDays, nextDueOnOrAfter } from "@/lib/utils";
import { yearElapsedFrom } from "@/lib/data/new-community";

/**
 * Where a new association's books start, carried from founding to saved.
 *
 * The dates and the opening balances are not founding parameters: they land
 * after `create_association`, in calls of their own. Either can fail once the
 * association already exists, and a retry must neither found it again nor lose
 * what the founder typed. So the exact values, and the association they belong
 * to, are written to this device before the first of those calls and cleared
 * only once both have landed.
 *
 * localStorage, unlike the wizard's sessionStorage progress: a founder who
 * closes the tab after a failure still has a real association waiting for
 * these figures, and the next visit has to offer them back.
 */

export interface FoundingBooks {
  /** "MM-DD". */
  fiscalYearStart: string;
  /** The first due date billed here, YYYY-MM-DD. Already resolved, never "the default". */
  billingStartsOn: string;
  /** The day the opening balances are true, YYYY-MM-DD. */
  openingAsOf: string;
  /** Homes with a phone or an opening balance, keyed by the label founding gave them. */
  rows: RosterRow[];
}

export interface PendingBooks {
  associationId: string;
  associationName: string;
  /** Whose they are, so another person signing in on this device is not offered them. */
  userId: string;
  books: FoundingBooks;
  datesSaved: boolean;
  rosterSaved: boolean;
  /** What went wrong on the last attempt, in words for the founder. */
  problem?: string;
}

function isPendingBooks(value: unknown): value is PendingBooks | null {
  if (value === null) return true;
  if (!isRecord(value) || !isRecord(value.books)) return false;
  return (
    typeof value.associationId === "string" &&
    typeof value.userId === "string" &&
    typeof value.books.fiscalYearStart === "string" &&
    typeof value.books.billingStartsOn === "string" &&
    typeof value.books.openingAsOf === "string" &&
    Array.isArray(value.books.rows)
  );
}

export const pendingBooksStore = new PersistedStore<PendingBooks | null>(
  "hoasis:pending-books",
  null,
  { validate: isPendingBooks },
);

export function savePendingBooks(pending: PendingBooks): void {
  pendingBooksStore.set(pending);
}

export function clearPendingBooks(): void {
  pendingBooksStore.set(null);
}

/** The books this person still has to save, or null. */
export function pendingBooksFor(
  pending: PendingBooks | null,
  userId: string | null | undefined,
): PendingBooks | null {
  return pending && userId && pending.userId === userId ? pending : null;
}

/** The opening balances in a set of books: how many homes, and their sum in cents. */
export function openingTotals(books: FoundingBooks): { homes: number; cents: number } {
  const withBalance = books.rows.filter((r) => r.openingBalanceCents !== undefined);
  return {
    homes: withBalance.length,
    cents: withBalance.reduce((sum, r) => sum + (r.openingBalanceCents ?? 0), 0),
  };
}

export interface BooksWriters {
  dates: (
    associationId: string,
    books: { fiscalYearStart: string; billingStartsOn: string },
  ) => Promise<void>;
  roster: (associationId: string, rows: RosterRow[], asOf: string) => Promise<unknown>;
}

function said(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "it was not saved";
}

/**
 * Saves whatever is still unsaved, dates first, and says where it stopped.
 *
 * Dates go first because `billing_starts_on` is what keeps the daily run off
 * the periods the opening balances cover. Each step is recorded as soon as it
 * lands, so a retry repeats only what did not. Repeating a step that did land
 * but whose answer was lost is safe: the dates are a plain update, and
 * `import_households` (0056, 0106) matches homes by label and replaces a
 * home's opening line rather than adding one.
 */
export async function finishFoundingBooks(
  pending: PendingBooks,
  write: BooksWriters,
): Promise<PendingBooks> {
  let state: PendingBooks = { ...pending, problem: undefined };
  const { books } = state;
  if (!state.datesSaved) {
    try {
      await write.dates(state.associationId, {
        fiscalYearStart: books.fiscalYearStart,
        billingStartsOn: books.billingStartsOn,
      });
    } catch (error) {
      state = {
        ...state,
        problem: `The budget year and first bill date were not saved (${said(error)}).`,
      };
      savePendingBooks(state);
      return state;
    }
    state = { ...state, datesSaved: true };
    savePendingBooks(state);
  }
  if (!state.rosterSaved) {
    try {
      if (books.rows.length) await write.roster(state.associationId, books.rows, books.openingAsOf);
    } catch (error) {
      state = {
        ...state,
        problem: `The opening balances and phone numbers were not saved (${said(error)}).`,
      };
      savePendingBooks(state);
      return state;
    }
    state = { ...state, rosterSaved: true };
    savePendingBooks(state);
  }
  return state;
}

export function booksDone(pending: PendingBooks): boolean {
  return pending.datesSaved && pending.rosterSaved;
}

/**
 * A demo association with its books applied the way the database applies them.
 *
 * The same rules as the signed-in path: the fiscal year and the first bill
 * move the next charge date, a home's opening balance is one dated "Balance
 * brought forward" line that replaces any earlier one, a zero balance leaves
 * no line, and a phone fills only a blank one. Applying the same books twice
 * gives the same community.
 */
export function withFoundingBooks(
  community: Community,
  books: FoundingBooks,
  dueDay: number,
): Community {
  const byUnit = new Map(books.rows.map((r) => [r.unit.trim(), r]));
  const homes = community.homes.map((home) => {
    const row = byUnit.get(home.unit.trim());
    if (!row) return home;
    return {
      ...home,
      phone: home.phone || row.phone.trim(),
      ...(row.openingBalanceCents === undefined ? {} : { balanceCents: row.openingBalanceCents }),
    };
  });

  const homeCharges = { ...community.homeCharges };
  for (const home of community.homes) {
    const amount = byUnit.get(home.unit.trim())?.openingBalanceCents;
    if (amount === undefined) continue;
    const others = (homeCharges[home.id] ?? []).filter((line) => line.id !== `${home.id}-opening`);
    homeCharges[home.id] =
      amount === 0
        ? others
        : [
            {
              id: `${home.id}-opening`,
              date: books.openingAsOf,
              label: "Balance brought forward",
              kind: "charge" as const,
              amountCents: amount,
              balanceAfterCents: amount,
            },
            ...others,
          ];
  }

  // As the signed-in data layer reads it (nextChargeDateFor in remote.ts):
  // the first bill, unless that is already behind tomorrow.
  const tomorrow = addDays(community.asOf, 1);
  const from = books.billingStartsOn > tomorrow ? books.billingStartsOn : tomorrow;
  return {
    ...community,
    nextChargeDate: nextDueOnOrAfter(
      from,
      dueDay,
      community.association.duesCadence,
      books.fiscalYearStart,
    ),
    association: { ...community.association, fiscalYearStart: books.fiscalYearStart },
    yearElapsed: yearElapsedFrom(books.fiscalYearStart, community.asOf),
    homes,
    homeCharges,
  };
}
