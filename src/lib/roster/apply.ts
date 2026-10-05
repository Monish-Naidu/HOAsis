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

/**
 * The rows as the database is sent them.
 *
 * The preview matches a row to a home already on the register ignoring case,
 * and says "will be updated". The database matches the label exactly. So a
 * county export in capitals ("1428 WILLOW CREEK LANE") against a register
 * in title case was promised an update and got forty new homes, each billed
 * beside the one it duplicated. A row that matches a home ignoring case is
 * sent under the register's own spelling, so the exact match finds it and
 * the preview's promise holds.
 */
export function rowsForImport(rows: RosterRow[], existingUnits: string[] = []): Json {
  const exact = new Set(existingUnits);
  const bySpelling = new Map<string, string>();
  for (const label of existingUnits) {
    const key = label.trim().toLowerCase();
    if (!bySpelling.has(key)) bySpelling.set(key, label);
  }
  return rows.map((r) => {
    const unit = exact.has(r.unit) ? r.unit : (bySpelling.get(r.unit.trim().toLowerCase()) ?? r.unit);
    const row: Record<string, string | number> = {
      unit,
      address: r.address,
      name: r.name,
      email: r.email,
      phone: r.phone,
    };
    if (r.openingBalanceCents !== undefined) row.opening_balance_cents = r.openingBalanceCents;
    return row;
  });
}

/**
 * Every home's label as the database holds it, read fresh so the spelling
 * sent matches what is there now and not what a screen loaded a while ago.
 * A page at a time, since the API stops at a thousand rows without saying so.
 */
async function registerLabels(associationId: string): Promise<string[]> {
  const labels: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseBrowser()
      .from("units")
      .select("label")
      .eq("association_id", associationId)
      .order("label")
      .order("id")
      .range(from, from + 999);
    // Importing blind is how the duplicates were made. Better to stop.
    if (error) throw new Error(`Could not check the homes already on the register: ${error.message}`);
    labels.push(...(data ?? []).map((u) => u.label as string));
    if ((data ?? []).length < 1000) return labels;
  }
}

export async function importRoster(
  associationId: string,
  rows: RosterRow[],
  asOf: string,
): Promise<ImportOutcome> {
  const existing = await registerLabels(associationId);
  const { data, error } = await supabaseBrowser().rpc("import_households", {
    p_association_id: associationId,
    p_rows: rowsForImport(rows, existing),
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
