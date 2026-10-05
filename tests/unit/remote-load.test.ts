import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCommunity } from "@/lib/data/remote";

/**
 * Loading a real association, against a database double.
 *
 * Three dozen reads go out at once and most may fail without harm. Three may
 * not: with no homes, no seats or no statement lines the association still
 * renders, and what it says is false. These prove a failure in one of those
 * is thrown, by name, where the store can put it in front of a person.
 */

const ASSOCIATION = {
  id: "assoc-1",
  name: "Maple Ridge Owners",
  city: "Bothell",
  state: "WA",
  origin: "existing",
  due_day: 1,
  dues_cents: 30_000,
  dues_cadence: "quarterly",
  fiscal_year_start: "07-01",
  billing_starts_on: null,
  late_after_day: 10,
  join_code: "MAPLE1",
  settings: {},
};

const OVERVIEW = {
  units: [],
  ledger: { count: 0, first_on: null, months: [], accounts: [] },
  statements: { months: [] },
};

type Result = { data: unknown; error: { message: string } | null };

/** Every table answers with the rows given (none, by default), except the ones told to fail. */
function database(failing: Record<string, string> = {}, rows: Record<string, unknown[]> = {}): SupabaseClient {
  const answer = (table: string): Result =>
    failing[table] ? { data: null, error: { message: failing[table] } } : { data: rows[table] ?? [], error: null };
  const from = (table: string) => {
    const builder: Record<string, unknown> = {
      single: async (): Promise<Result> =>
        table === "associations" && !failing[table] ? { data: ASSOCIATION, error: null } : answer(table),
      then: (done: (value: Result) => unknown, failed?: (reason: unknown) => unknown) =>
        Promise.resolve(answer(table)).then(done, failed),
    };
    for (const method of ["select", "eq", "gte", "lt", "in", "is", "neq", "order", "range", "limit"]) {
      builder[method] = () => builder;
    }
    return builder;
  };
  const rpc = async (name: string): Promise<Result> =>
    name === "association_overview" ? { data: OVERVIEW, error: null } : { data: null, error: null };
  return { from, rpc } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("loadCommunity", () => {
  it("loads an association with nothing in it yet", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T18:00:00Z"));
    const community = await loadCommunity(database(), "assoc-1");

    expect(community.id).toBe("assoc-1");
    expect(community.owners).toEqual([]);
    // Quarterly from July, due on the 1st, opened October 4: the next bill is
    // January 1, and three months and a few days of the fiscal year are gone.
    expect(community.nextChargeDate).toBe("2027-01-01");
    expect(community.yearElapsed).toBeCloseTo((3 + 4 / 30) / 12, 10);
  });

  it("keeps a line waiting on review out of the budget's actuals", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T18:00:00Z"));
    const line = { description: "Deposit", counterparty: "BECU", category: "Assessments", bank_account_id: null };
    const community = await loadCommunity(
      database({}, {
        ledger_entries: [
          { ...line, id: "held", occurred_on: "2026-08-12", amount_cents: 57_000, confirmed_at: null },
          { ...line, id: "kept", occurred_on: "2026-08-03", amount_cents: 28_500, confirmed_at: "2026-08-03T10:00:00Z" },
        ],
      }),
      "assoc-1",
    );

    // Both lines are on the ledger, one of them marked as waiting.
    expect(community.ledger.map((e) => [e.id, e.status])).toEqual([
      ["held", "needs-review"],
      ["kept", "cleared"],
    ]);
    // Only the confirmed one is income so far this fiscal year.
    expect(community.budget).toHaveLength(1);
    expect(community.budget[0]).toMatchObject({ category: "Assessments", ytdActualCents: 28_500 });
  });

  it("shows a saved bank or card only while whoever saved it still holds a seat on the home", async () => {
    // Saved methods are kept by home and row level security hands a member
    // every row on theirs, so after a sale the buyer's pay screen showed the
    // seller's bank by name and last four.
    const seat = { association_id: "assoc-1", unit_id: "unit-1", role: "resident", capabilities: [], views: [], starts_on: "2024-01-01" };
    const method = { association_id: "assoc-1", unit_id: "unit-1", kind: "ach", mask: "0000", is_default: false, added_on: "2026-01-01", detail: {} };
    const community = await loadCommunity(
      database({}, {
        units: [{ id: "unit-1", association_id: "assoc-1", label: "12", address: "12 Maple Way", home_type: null, created_at: "2024-01-01T00:00:00Z" }],
        memberships: [
          { ...seat, id: "m-seller", profile_id: "seller", full_name: "Sam Seller", ends_on: "2026-09-01" },
          { ...seat, id: "m-buyer", profile_id: "buyer", full_name: "Bea Buyer", starts_on: "2026-09-01", ends_on: null },
          { ...seat, id: "m-spouse", profile_id: "spouse", full_name: "Cal Buyer", starts_on: "2026-09-01", ends_on: null },
        ],
        payment_instruments: [
          { ...method, id: "pi-seller", profile_id: "seller", label: "Seller's credit union", mask: "4471" },
          { ...method, id: "pi-buyer", profile_id: "buyer", label: "Buyer's bank" },
          // A co-owner's is still shared: the co-owner is still here.
          { ...method, id: "pi-spouse", profile_id: "spouse", label: "Spouse's card", kind: "card" },
          // From before savers were recorded. Charged by nobody, shown to nobody.
          { ...method, id: "pi-nobody", profile_id: null, label: "Old stand-in" },
        ],
      }),
      "assoc-1",
    );

    expect(community.instruments.map((i) => i.id)).toEqual(["pi-buyer", "pi-spouse"]);
    expect(JSON.stringify(community.instruments)).not.toContain("4471");
  });

  it("reads each home's own dues onto its owner, and the budget bills every home by the rule", async () => {
    const unit = { association_id: "assoc-1", address: "", home_type: null, created_at: "2024-01-01T00:00:00Z" };
    const community = await loadCommunity(
      database({}, {
        units: [
          { ...unit, id: "unit-1", label: "101", dues_cents: null },
          { ...unit, id: "unit-2", label: "201", dues_cents: 40_000 },
        ],
      }),
      "assoc-1",
    );
    const own = Object.fromEntries(community.owners.map((o) => [o.unit, o.duesCents]));
    expect(own).toEqual({ "101": undefined, "201": 40_000 });
    // $300 association amount for the first, $400 for the second, four quarterly bills a year.
    expect(community.budget.find((b) => b.category === "Assessments")?.annualCents).toBe((30_000 + 40_000) * 4);
  });

  it.each([
    ["units", "the homes"],
    ["memberships", "the roster"],
    ["charges", "the statements"],
  ])("refuses to render without %s, and says which read failed", async (table, what) => {
    // Read as empty, a failed read here showed an association with no
    // homes, signed the member out of it, or handed everyone a blank
    // statement, none of it with a word of warning.
    await expect(loadCommunity(database({ [table]: "connection reset" }), "assoc-1")).rejects.toThrow(
      `Could not load ${what}: connection reset`,
    );
  });

  it("still loads when a secondary read fails", async () => {
    // One flaky table that only decorates the page must not lock every
    // member out of the association.
    const community = await loadCommunity(database({ vendors: "timeout", activity: "timeout" }), "assoc-1");
    expect(community.id).toBe("assoc-1");
    expect(community.vendors).toEqual([]);
  });
});
