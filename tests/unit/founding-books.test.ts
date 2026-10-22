import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCommunity, emptyDraft, finalizeDraft } from "@/lib/data/new-community";
import { foundingBooksFor, withBooks, withExtras } from "@/app/start/books";
import {
  booksDone,
  clearPendingBooks,
  finishFoundingBooks,
  openingTotals,
  pendingBooksFor,
  pendingBooksStore,
  savePendingBooks,
  withFoundingBooks,
  type FoundingBooks,
  type PendingBooks,
} from "@/lib/founding-books";

/**
 * A founded association's books, from the moment it exists until they land:
 * what is kept, what a failed or repeated save does, and the demo's copy of
 * the same rules.
 */

const BOOKS: FoundingBooks = {
  fiscalYearStart: "07-01",
  billingStartsOn: "2026-11-01",
  openingAsOf: "2026-10-15",
  rows: [
    {
      line: 0,
      name: "Marcus Bell",
      email: "",
      unit: "2",
      address: "",
      phone: "425-555-0114",
      openingBalanceCents: 18_550,
      problems: [],
    },
    {
      line: 0,
      name: "Rosa Lind",
      email: "",
      unit: "3",
      address: "",
      phone: "",
      openingBalanceCents: -2_001,
      problems: [],
    },
    {
      line: 0,
      name: "",
      email: "",
      unit: "4",
      address: "",
      phone: "",
      openingBalanceCents: 0,
      problems: [],
    },
  ],
};

const PENDING: PendingBooks = {
  associationId: "assoc-1",
  associationName: "Alder Court",
  userId: "user-1",
  books: BOOKS,
  datesSaved: false,
  rosterSaved: false,
};

const mine = () => pendingBooksFor(pendingBooksStore.getSnapshot(), "user-1");

afterEach(() => {
  pendingBooksStore.reset();
  window.localStorage.clear();
});

describe("finishFoundingBooks", () => {
  it("saves the dates and then the roster, with the exact figures, and records both", async () => {
    const dates = vi.fn(async () => {});
    const roster = vi.fn(async () => ({}));
    const after = await finishFoundingBooks(PENDING, { dates, roster });
    expect(dates).toHaveBeenCalledWith("assoc-1", {
      fiscalYearStart: "07-01",
      billingStartsOn: "2026-11-01",
    });
    expect(roster).toHaveBeenCalledWith("assoc-1", BOOKS.rows, "2026-10-15");
    expect(booksDone(after)).toBe(true);
    expect(after.problem).toBeUndefined();
  });

  it("stops at a failed date save, says so, and keeps every figure on the device", async () => {
    const roster = vi.fn(async () => ({}));
    const after = await finishFoundingBooks(PENDING, {
      dates: async () => {
        throw new Error("network down");
      },
      roster,
    });
    expect(roster).not.toHaveBeenCalled();
    expect(after.datesSaved).toBe(false);
    expect(after.problem).toBe(
      "The budget year and first bill date were not saved (network down).",
    );
    expect(mine()).toEqual(after);
    expect(mine()?.books).toEqual(BOOKS);
  });

  it("keeps the saved dates when the roster fails, and a retry sends only the roster", async () => {
    const dates = vi.fn(async () => {});
    const failed = await finishFoundingBooks(PENDING, {
      dates,
      roster: async () => {
        throw new Error("import_households is down");
      },
    });
    expect(failed.datesSaved).toBe(true);
    expect(failed.rosterSaved).toBe(false);
    expect(failed.problem).toMatch(/opening balances and phone numbers were not saved/);

    const roster = vi.fn(async () => ({}));
    const done = await finishFoundingBooks(mine()!, { dates, roster });
    expect(dates).toHaveBeenCalledTimes(1);
    expect(roster).toHaveBeenCalledTimes(1);
    expect(roster).toHaveBeenCalledWith("assoc-1", BOOKS.rows, "2026-10-15");
    expect(booksDone(done)).toBe(true);
    expect(done.problem).toBeUndefined();
  });

  it("repeats an uncertain step with the same arguments, not new ones", async () => {
    // The import landed but its answer was lost: the next try sends the
    // identical rows, which import_households matches by label and replaces.
    const roster = vi
      .fn<(id: string, rows: unknown, asOf: string) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({});
    const dates = async () => {};
    await finishFoundingBooks(PENDING, { dates, roster });
    await finishFoundingBooks(mine()!, { dates, roster });
    expect(roster.mock.calls[0]).toEqual(roster.mock.calls[1]);
  });

  it("does not call the import when no home has anything to send", async () => {
    const roster = vi.fn(async () => ({}));
    const after = await finishFoundingBooks(
      { ...PENDING, books: { ...BOOKS, rows: [] } },
      { dates: async () => {}, roster },
    );
    expect(roster).not.toHaveBeenCalled();
    expect(booksDone(after)).toBe(true);
  });
});

describe("pending books on a shared device", () => {
  const OTHER: PendingBooks = {
    associationId: "assoc-2",
    associationName: "Elm Row",
    userId: "user-2",
    books: { ...BOOKS, fiscalYearStart: "01-01", rows: [BOOKS.rows[0]] },
    datesSaved: true,
    rosterSaved: false,
  };

  it("offers the books only to the person who founded the association", () => {
    const all = { "user-1": PENDING };
    expect(pendingBooksFor(all, "user-1")).toBe(PENDING);
    expect(pendingBooksFor(all, "user-2")).toBeNull();
    expect(pendingBooksFor(all, null)).toBeNull();
    expect(pendingBooksFor({}, "user-1")).toBeNull();
    expect(pendingBooksFor(all, "toString")).toBeNull();
  });

  it("keeps one founder's books when another founder saves, retries and clears theirs", async () => {
    savePendingBooks(PENDING);
    savePendingBooks(OTHER);
    await finishFoundingBooks(OTHER, { dates: async () => {}, roster: async () => ({}) });
    expect(pendingBooksFor(pendingBooksStore.getSnapshot(), "user-2")?.rosterSaved).toBe(true);
    clearPendingBooks("user-2");

    expect(pendingBooksStore.getSnapshot()).toEqual({ "user-1": PENDING });
    expect(mine()?.books).toEqual(BOOKS);
    expect(pendingBooksFor(pendingBooksStore.getSnapshot(), "user-2")).toBeNull();
  });

  it("reads the single record an older version kept, and drops one filed under another id", async () => {
    // A fresh copy of the module, so the store reads storage instead of its cache.
    async function stored(value: unknown) {
      window.localStorage.setItem("hoasis:pending-books", JSON.stringify(value));
      vi.resetModules();
      const fresh = await import("@/lib/founding-books");
      return fresh.pendingBooksStore.getSnapshot();
    }
    expect(await stored(PENDING)).toEqual({ "user-1": PENDING });
    expect(await stored(null)).toEqual({});
    expect(await stored({ "user-2": PENDING })).toEqual({});
  });
});

describe("openingTotals", () => {
  it("counts the homes with a balance and sums their cents exactly", () => {
    expect(openingTotals(BOOKS)).toEqual({ homes: 3, cents: 16_549 });
  });
});

describe("foundingBooksFor", () => {
  it("resolves the first bill and keeps each home's balance and phone", () => {
    const draft = withBooks(
      {
        ...emptyDraft(),
        name: "Alder Court",
        dueDay: 1,
        founder: { name: "Pat", email: "pat@example.com", unit: "1" },
        households: [
          withExtras(
            { name: "Marcus Bell", email: "", unit: "2" },
            { openingBalanceCents: 18_550 },
          ),
          { name: "", email: "", unit: "3" },
        ],
      },
      { fiscalYearStart: "07-01", billingStartsOn: null, openingAsOf: "2026-10-15" },
    );
    const books = foundingBooksFor(draft, finalizeDraft(draft), "2026-10-15");
    expect(books.fiscalYearStart).toBe("07-01");
    expect(books.billingStartsOn).toBe("2026-11-01");
    expect(books.openingAsOf).toBe("2026-10-15");
    expect(books.rows.map((r) => [r.unit, r.openingBalanceCents])).toEqual([["2", 18_550]]);
  });
});

describe("withFoundingBooks, the demo's copy", () => {
  const draft = {
    ...emptyDraft(),
    name: "Alder Court",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 12_000,
    dueDay: 1,
    founder: { name: "Pat", email: "pat@example.com", unit: "1" },
    households: [
      { name: "Marcus Bell", email: "", unit: "2" },
      { name: "Rosa Lind", email: "", unit: "3" },
      { name: "", email: "", unit: "4" },
    ],
  };
  const plain = buildCommunity(draft, "2026-10-15");

  it("puts each opening balance on its home as one dated line, to the cent", () => {
    const built = withFoundingBooks(plain, BOOKS, 1);
    const home = (unit: string) => built.homes.find((h) => h.unit === unit)!;
    expect(home("2").balanceCents).toBe(18_550);
    expect(home("2").phone).toBe("425-555-0114");
    expect(home("3").balanceCents).toBe(-2_001);
    expect(built.homeCharges[home("2").id]).toEqual([
      {
        id: `${home("2").id}-opening`,
        date: "2026-10-15",
        label: "Balance brought forward",
        kind: "charge",
        amountCents: 18_550,
        balanceAfterCents: 18_550,
      },
    ]);
    // A zero balance is a balance of zero, with no line.
    expect(home("4").balanceCents).toBe(0);
    expect(built.homeCharges[home("4").id]).toEqual([]);
    // The founder's own home was not in the rows.
    expect(built.homeCharges[home("1").id]).toEqual([]);
  });

  it("moves the budget year and the next bill to the dates given", () => {
    const built = withFoundingBooks(plain, BOOKS, 1);
    expect(built.association.fiscalYearStart).toBe("07-01");
    expect(built.nextChargeDate).toBe("2026-11-01");
  });

  it("gives the same community when the same books are applied twice", () => {
    const once = withFoundingBooks(plain, BOOKS, 1);
    expect(withFoundingBooks(once, BOOKS, 1)).toEqual(once);
    const lines = Object.values(withFoundingBooks(once, BOOKS, 1).homeCharges).flat();
    expect(lines).toHaveLength(2);
    expect(lines.reduce((sum, l) => sum + l.amountCents, 0)).toBe(16_549);
  });
});
