import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterRow } from "@/lib/roster/csv";

/**
 * Homes given their own dues after an import or a founding: a call to
 * set_home_dues for each home that has one, looked up by its label, with a
 * failure said once every home has been tried and the import left standing.
 */

const calls = vi.hoisted(() => ({
  rpc: [] as { name: string; args: Record<string, unknown> }[],
  refused: new Set<string>(),
  units: [] as { id: string; label: string }[],
}));

vi.mock("@/lib/data/remote-store", () => ({ refreshRemote: vi.fn(async () => undefined) }));

vi.mock("@/lib/supabase/client", () => {
  const units = () => {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) builder[m] = () => builder;
    builder.range = () => Promise.resolve({ data: calls.units, error: null });
    return builder;
  };
  return {
    supabaseBrowser: () => ({
      from: () => units(),
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.rpc.push({ name, args });
        if (name === "set_home_dues" && calls.refused.has(args.p_unit_id as string)) {
          return { data: null, error: { message: "You cannot change dues for that home" } };
        }
        return { data: name === "import_households" ? { created: 2, updated: 0, balances: 0, skipped: 0 } : null, error: null };
      },
    }),
  };
});

// The suite's setup file has already loaded the real client, so the module
// under test is loaded afresh, after the doubles above are in place.
vi.resetModules();
const { importRoster, setHomeDues } = await import("@/lib/roster/apply");

const row = (unit: string, duesCents?: number): RosterRow => ({
  line: 2, name: "", email: "", unit, address: "", phone: "", problems: [], ...(duesCents ? { duesCents } : {}),
});

beforeEach(() => {
  calls.rpc = [];
  calls.refused = new Set();
  calls.units = [
    { id: "u-201", label: "201" },
    { id: "u-202", label: "202" },
    { id: "u-102", label: "102" },
  ];
});

describe("setHomeDues", () => {
  it("calls set_home_dues once for each home, by its label", async () => {
    const saved = await setHomeDues("a-1", [
      { unit: "201", duesCents: 28_500 },
      { unit: " 202 ", duesCents: 34_000 },
    ]);
    expect(saved).toBe(2);
    expect(calls.rpc).toEqual([
      { name: "set_home_dues", args: { p_unit_id: "u-201", p_dues_cents: 28_500 } },
      { name: "set_home_dues", args: { p_unit_id: "u-202", p_dues_cents: 34_000 } },
    ]);
  });

  it("does nothing for no homes", async () => {
    expect(await setHomeDues("a-1", [])).toBe(0);
    expect(calls.rpc).toEqual([]);
  });

  it("tries every home, then says how many were not saved", async () => {
    calls.refused.add("u-201");
    await expect(
      setHomeDues("a-1", [
        { unit: "201", duesCents: 1 },
        { unit: "202", duesCents: 2 },
        { unit: "999", duesCents: 3 },
      ]),
    ).rejects.toThrow(/2 of 3 homes did not get their own dues amount/);
    // The home that could be saved was.
    expect(calls.rpc.some((c) => (c.args.p_unit_id as string) === "u-202")).toBe(true);
  });
});

describe("importRoster with a Dues column", () => {
  it("imports the homes, then sets only the homes that have an amount", async () => {
    const outcome = await importRoster("a-1", [row("201", 28_500), row("102")], "2026-10-01");
    expect(calls.rpc.map((c) => c.name)).toEqual(["import_households", "set_home_dues"]);
    expect(calls.rpc[1].args).toEqual({ p_unit_id: "u-201", p_dues_cents: 28_500 });
    expect(outcome).toMatchObject({ created: 2, dues: 1 });
    expect(outcome.duesError).toBeUndefined();
  });

  it("leaves the import standing and says so when an amount was refused", async () => {
    calls.refused.add("u-201");
    const outcome = await importRoster("a-1", [row("201", 28_500)], "2026-10-01");
    expect(outcome.created).toBe(2);
    expect(outcome.dues).toBe(0);
    expect(outcome.duesError).toMatch(/1 of 1 homes did not get their own dues amount/);
  });

  it("makes no dues call, and adds no dues fields, for a file without amounts", async () => {
    const outcome = await importRoster("a-1", [row("102")], "2026-10-01");
    expect(calls.rpc.map((c) => c.name)).toEqual(["import_households"]);
    expect(outcome).toEqual({ created: 2, updated: 0, balances: 0, skipped: 0 });
  });
});
