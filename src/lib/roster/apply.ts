import { supabaseBrowser } from "@/lib/supabase/client";
import { refreshRemote } from "@/lib/data/remote-store";
import type { RosterRow } from "@/lib/roster/csv";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Sending a roster to the database.
 *
 * One call to `import_households` (migration 0056) for every row that passed
 * the preview: homes and seats are created or filled in, opening balances
 * become one dated statement line each. Then the community is reloaded so
 * the register shows what just landed.
 */

export interface ImportOutcome {
  created: number;
  updated: number;
  balances: number;
  skipped: number;
}

export function rowsForImport(rows: RosterRow[]): Json {
  return rows.map((r) => {
    const row: Record<string, string | number> = {
      unit: r.unit,
      address: r.address,
      name: r.name,
      email: r.email,
      phone: r.phone,
    };
    if (r.openingBalanceCents !== undefined) row.opening_balance_cents = r.openingBalanceCents;
    return row;
  });
}

export async function importRoster(
  associationId: string,
  rows: RosterRow[],
  asOf: string,
): Promise<ImportOutcome> {
  const { data, error } = await supabaseBrowser().rpc("import_households", {
    p_association_id: associationId,
    p_rows: rowsForImport(rows),
    p_as_of: asOf,
  });
  if (error) throw new Error(error.message);
  await refreshRemote();
  const out = (data ?? {}) as Partial<ImportOutcome>;
  return {
    created: out.created ?? 0,
    updated: out.updated ?? 0,
    balances: out.balances ?? 0,
    skipped: out.skipped ?? 0,
  };
}

/**
 * Where the books start: the fiscal year, and the first due date this
 * product bills. Anything due before that date lives in the opening
 * balances, so the daily run leaves it alone (issue_assessment, 0056).
 */
export async function setBooksStart(
  associationId: string,
  books: { fiscalYearStart?: string; billingStartsOn?: string | null },
): Promise<void> {
  const row: { fiscal_year_start?: string; billing_starts_on?: string | null } = {};
  if (books.fiscalYearStart) row.fiscal_year_start = books.fiscalYearStart;
  if (books.billingStartsOn !== undefined) row.billing_starts_on = books.billingStartsOn;
  if (!Object.keys(row).length) return;
  const { error } = await supabaseBrowser().from("associations").update(row).eq("id", associationId);
  if (error) throw new Error(error.message);
}
