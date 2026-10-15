import { describe, expect, it } from "vitest";
import { loadAnnualRecords, loadCompleteRecords } from "@/lib/data/remote";

/**
 * The reads behind a records export, against a double of the client.
 *
 * These are the rows a records request asks for and the screens deliberately
 * do not hold: every charge, every line of the books, the whole email log and
 * the whole activity log. Two things here are worth pinning. The window is
 * exact (a charge due on the first day of the year is in it, one due on the
 * last day is too, and an email sent on the evening of the last day is in it,
 * which a naive `<= date` on a timestamp would drop). And a read longer than
 * a page comes back whole, because a records export that stops at a thousand
 * rows is a records export with the books missing.
 */

type Row = Record<string, unknown>;

/** A client that filters, orders and pages the way the real one does. */
function client(tables: Record<string, Row[]>) {
  const seen: { table: string; ranges: [number, number][] }[] = [];
  function from(table: string) {
    const filters: [string, unknown][] = [];
    const order: [string, boolean][] = [];
    let range: [number, number] = [0, Number.MAX_SAFE_INTEGER];
    const record = { table, ranges: [] as [number, number][] };
    seen.push(record);

    const builder: Record<string, unknown> = {};
    const chain =
      (name: string) =>
      (...args: unknown[]) => {
        if (name === "order") {
          const options = (args[1] ?? {}) as { ascending?: boolean };
          order.push([String(args[0]), options.ascending !== false]);
        } else filters.push([name, args]);
        return builder;
      };
    for (const name of ["eq", "gte", "lte", "lt", "is", "in"]) builder[name] = chain(name);
    builder.order = chain("order");
    builder.select = () => builder;
    builder.range = (start: number, end: number) => {
      range = [start, end];
      record.ranges.push(range);
      return builder;
    };
    builder.then = (done: (value: unknown) => unknown, failed?: (reason: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          let rows = [...(tables[table] ?? [])];
          for (const [op, args] of filters) {
            const [column, value] = args as [string, unknown];
            rows = rows.filter((row) => {
              const cell = row[column];
              if (op === "eq") return cell === value;
              if (op === "gte") return String(cell) >= String(value);
              if (op === "lte") return String(cell) <= String(value);
              if (op === "lt") return String(cell) < String(value);
              if (op === "is") return value === null ? cell === null : cell === value;
              if (op === "in") return (value as unknown[]).includes(cell);
              return true;
            });
          }
          // Ordered the way Postgres orders: the first key decides, the rest
          // break its ties. Sorting once per key would not.
          rows.sort((a, b) => {
            for (const [column, ascending] of order) {
              const x = String(a[column]);
              const y = String(b[column]);
              if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          return { data: rows.slice(range[0], range[1] + 1), error: null };
        })
        .then(done, failed);
    return builder;
  }
  return { from, seen } as unknown as Parameters<typeof loadAnnualRecords>[0] & {
    seen: typeof seen;
  };
}

const association = "assoc-1";

function charge(id: string, dueOn: string, unitId = "unit-1"): Row {
  return {
    id,
    association_id: association,
    unit_id: unitId,
    due_on: dueOn,
    created_at: `${dueOn}T00:00:00Z`,
    label: "Monthly assessment",
    kind: "charge",
    amount_cents: 28_500,
    category: "dues",
  };
}

function ledgerRow(id: string, occurredOn: string, amountCents: number): Row {
  return {
    id,
    association_id: association,
    occurred_on: occurredOn,
    description: "Grounds",
    counterparty: "Cascade Grounds Co.",
    category: "Landscaping",
    bank_account_id: "acct-operating",
    amount_cents: amountCents,
    confirmed_at: `${occurredOn}T00:00:00Z`,
  };
}

describe("reading one year of records", () => {
  const tables = {
    units: [
      { id: "unit-1", association_id: association, label: "7", address: "7 Alder Way" },
      { id: "unit-2", association_id: association, label: "8", address: "8 Alder Way" },
    ],
    charges: [
      charge("c-before", "2025-12-31"),
      charge("c-first", "2026-01-01", "unit-2"),
      charge("c-mid", "2026-06-15"),
      charge("c-last", "2026-12-31"),
      charge("c-after", "2027-01-01"),
    ],
    ledger_entries: [
      ledgerRow("l-1", "2026-03-01", -45_000),
      ledgerRow("l-2", "2025-03-01", -1_000),
    ],
    email_log: [
      {
        id: "e-1",
        association_id: association,
        to_email: "owner@example.com",
        unit_id: "unit-2",
        category: "billing",
        subject: "Your bill",
        sent_at: "2026-12-31T23:30:00Z",
        status: "delivered",
        error: null,
      },
      {
        id: "e-2",
        association_id: association,
        to_email: "owner@example.com",
        unit_id: null,
        category: "billing",
        subject: "Last year",
        sent_at: "2025-12-31T23:30:00Z",
        status: null,
        error: null,
      },
    ],
    activity: [
      {
        id: "a-1",
        association_id: association,
        at: "2026-07-04T09:00:00Z",
        actor_id: "acct-1",
        actor_name: "Dana Whitcomb",
        subject_kind: "payout",
        subject_id: "po-1",
        summary: "Paid a vendor",
        details: { amount: 1 },
      },
      {
        id: "a-2",
        association_id: association,
        at: "2025-07-04T09:00:00Z",
        actor_id: null,
        actor_name: "System",
        subject_kind: "bill",
        subject_id: null,
        summary: "Posted bills",
        details: null,
      },
    ],
  };

  it("takes the lines inside the window and leaves the ones outside it", async () => {
    const rows = await loadAnnualRecords(client(tables), association, {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(rows.statement.map((line) => line.homeId)).toEqual(["unit-1", "unit-1", "unit-2"]);
    expect(rows.statement.map((line) => line.date)).toEqual([
      "2026-12-31",
      "2026-06-15",
      "2026-01-01",
    ]);
    expect(rows.statement.every((line) => line.kind === "charge")).toBe(true);
    expect(rows.statement[0].category).toBe("dues");
    expect(rows.ledger.map((entry) => entry.id)).toEqual(["l-1"]);
  });

  it("keeps an email sent at 11:30pm on the last day of the year", async () => {
    const rows = await loadAnnualRecords(client(tables), association, {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(rows.emailLog.map((email) => email.id)).toEqual(["e-1"]);
    // The unit's own label, not its id: the CSV names a home.
    expect(rows.emailLog[0].unit).toBe("8");
  });

  it("scopes the activity log to the window too", async () => {
    const rows = await loadAnnualRecords(client(tables), association, {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(rows.activity.map((action) => action.id)).toEqual(["a-1"]);
    expect(rows.activity[0].details).toEqual({ amount: 1 });
  });

  it("names a home the register has stopped carrying", async () => {
    const rows = await loadAnnualRecords(client(tables), association, {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(rows.labels.get("unit-2")).toBe("8");
  });

  it("reads a year longer than a page whole, in order, once", async () => {
    const many = Array.from({ length: 2_400 }, (_, i) =>
      charge(`c-${String(i).padStart(4, "0")}`, "2026-05-01"),
    );
    const fake = client({ ...tables, charges: many });
    const rows = await loadAnnualRecords(fake, association, {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(rows.statement).toHaveLength(2_400);
    // Pages were asked for, not one call that quietly stopped at a thousand.
    const chargePages = fake.seen.filter((call) => call.table === "charges");
    expect(chargePages.length).toBeGreaterThanOrEqual(3);
    expect(chargePages.flatMap((call) => call.ranges)[0]).toEqual([0, 999]);
  });
});

describe("reading everything for a complete export", () => {
  const tables = {
    units: [
      {
        id: "unit-1",
        association_id: association,
        label: "7",
        address: "7 Alder Way",
        home_type: "single-family",
        dues_cents: 31_000,
        retired_on: null,
      },
      {
        id: "unit-old",
        association_id: association,
        label: "912",
        address: "912 Old Mill Road",
        home_type: null,
        dues_cents: null,
        retired_on: "2025-11-30",
      },
    ],
    memberships: [
      {
        id: "m-1",
        association_id: association,
        unit_id: "unit-1",
        full_name: "Dana Whitcomb",
        invited_email: "dana@example.com",
        phone: "555-0100",
        role: "treasurer",
        capabilities: ["finances", "settings"],
        views: ["communications"],
        starts_on: "2021-04-01",
        ends_on: null,
      },
      {
        id: "m-2",
        association_id: association,
        unit_id: "unit-1",
        full_name: "Rowan Whitcomb",
        invited_email: null,
        phone: null,
        role: "resident",
        capabilities: [],
        views: [],
        starts_on: "2014-02-01",
        ends_on: "2021-03-31",
      },
    ],
    charges: [charge("c-1", "2019-01-01")],
    ledger_entries: [ledgerRow("l-1", "2019-03-01", -45_000)],
    email_log: [],
    activity: [],
    payments: [
      {
        id: "p-1",
        association_id: association,
        unit_id: "unit-1",
        amount_cents: 28_500,
        processor_fee_cents: 300,
        platform_fee_cents: 100,
        refunded_cents: 10_000,
        rail: "ach",
        state: "settled",
        created_at: "2026-05-01T10:00:00Z",
        settled_at: "2026-05-03T10:00:00Z",
      },
    ],
    special_assessments: [
      {
        id: "sa-1",
        association_id: association,
        title: "Roof",
        reason: "Hail",
        total_cents: 12_000_000,
        allocation: "equal",
        installments: 12,
        first_due_on: "2026-01-01",
        ballot_id: null,
        levied_at: "2025-12-01T00:00:00Z",
      },
      {
        id: "sa-2",
        association_id: association,
        title: "Fence",
        reason: "Proposed",
        total_cents: 500_000,
        allocation: "equal",
        installments: 1,
        first_due_on: "2027-01-01",
        ballot_id: "b-1",
        levied_at: null,
      },
    ],
  };

  it("keeps every line ever, not a window of them", async () => {
    const rows = await loadCompleteRecords(client(tables), association);
    expect(rows.statement).toHaveLength(1);
    expect(rows.statement[0].date).toBe("2019-01-01");
    expect(rows.ledger).toHaveLength(1);
  });

  it("keeps a retired home and its own assessment", async () => {
    const rows = await loadCompleteRecords(client(tables), association);
    const retired = rows.homes.find((home) => home.id === "unit-old")!;
    expect(retired.retiredOn).toBe("2025-11-30");
    expect(retired.unit).toBe("912");
    const live = rows.homes.find((home) => home.id === "unit-1")!;
    expect(live.homeType).toBe("Detached");
    expect(live.duesCents).toBe(31_000);
  });

  it("keeps a seat that closed, and says what each seat opens", async () => {
    const rows = await loadCompleteRecords(client(tables), association);
    expect(rows.seats).toHaveLength(2);
    const closed = rows.seats.find((seat) => seat.endsOn === "2021-03-31")!;
    expect(closed.name).toBe("Rowan Whitcomb");
    expect(closed.access).toBe("None");
    const live = rows.seats.find((seat) => !seat.endsOn)!;
    expect(live.access).toContain("Finances");
    expect(live.access).toContain("Messages");
  });

  it("carries a payment's fees, refund and settlement", async () => {
    const rows = await loadCompleteRecords(client(tables), association);
    expect(rows.onlinePayments[0]).toMatchObject({
      homeId: "unit-1",
      amountCents: 28_500,
      processorFeeCents: 300,
      platformFeeCents: 100,
      refundedCents: 10_000,
      settledAt: "2026-05-03T10:00:00Z",
    });
  });

  it("says a levy is proposed until the board levies it", async () => {
    const rows = await loadCompleteRecords(client(tables), association);
    // Newest first due date, so the proposed fence is the first row.
    expect(rows.specialAssessments.map((a) => a.status)).toEqual(["proposed", "active"]);
    expect(rows.specialAssessments[0].ballotId).toBe("b-1");
    expect(rows.specialAssessments[0].title).toBe("Fence");
  });
});
