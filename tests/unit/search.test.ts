import { describe, expect, it } from "vitest";
import {
  boardIndex,
  boardPages,
  boardShortcuts,
  createRecentStore,
  groupHits,
  prepareIndex,
  residentIndex,
  residentPages,
  residentShortcuts,
  searchHits,
  searchIndex,
  type SearchHit,
} from "@/lib/search";
import { mehrMeadows } from "@/lib/data/communities";
import { dueLetter, renderLetter } from "@/lib/letters";
import { policyFor } from "@/lib/collections";

/**
 * Search is how year three finds year one. Every record the tabs show has to
 * be findable by the words a board member would actually type, and a resident
 * must never find another household's business.
 */
describe("the search index", () => {
  const index = boardIndex(mehrMeadows);

  it("finds a household by name, member, or unit", () => {
    const rhea = mehrMeadows.homes.find((o) => o.displayName === "Rhea Calloway")!;
    expect(searchHits(index, "calloway")[0].title).toBe("Rhea Calloway");
    expect(searchHits(index, rhea.email).some((h) => h.title === "Rhea Calloway")).toBe(true);
    expect(searchHits(index, `unit ${rhea.unit}`).some((h) => h.title === "Rhea Calloway")).toBe(true);
  });

  it("finds an ended meeting by an agenda line, and links to its row", () => {
    const ended = mehrMeadows.meetings.find((m) => m.status === "ended");
    if (!ended) return;
    const word = ended.agenda[0].split(" ").find((w) => w.length > 5)!;
    const hit = searchHits(index, word).find((h) => h.id === `mtg-${ended.id}`);
    expect(hit, `"${word}" did not find the meeting`).toBeTruthy();
    expect(hit!.href).toBe(`/board/meetings#mtg-${ended.id}`);
  });

  it("reads a meeting and a ballot by their dates, as the screens do", () => {
    // Nothing writes "ended" for a real association's meeting, and a ballot
    // stays "open" until somebody presses Close now. Search said scheduled
    // and open for both while their own pages said ended and closed.
    const past = {
      ...mehrMeadows,
      meetings: [{ ...mehrMeadows.meetings[0], id: "gone", status: "scheduled" as const, date: "2020-01-01" }],
      ballots: [
        { ...mehrMeadows.ballots[0], id: "shut", audience: "owners" as const, status: "open" as const, closesDate: "2020-01-01" },
      ],
    };
    for (const hits of [boardIndex(past), residentIndex(past, past.homes[0])]) {
      expect(hits.find((h) => h.id === "mtg-gone")!.subtitle).toMatch(/· ended$/);
      const ballot = hits.find((h) => h.id === "bal-shut")!.subtitle;
      expect(ballot).toContain("closed · closes Jan 1, 2020");
      expect(ballot).not.toContain("open");
    }
  });

  it("sends a transaction to its own year, not this month", () => {
    const oldest = [...mehrMeadows.ledger].sort((a, b) => a.date.localeCompare(b.date))[0];
    const year = oldest.date.slice(0, 4);
    const hit = searchHits(index, oldest.description, 200).find((h) => h.id === `tx-${oldest.id}`)!;
    expect(hit.href).toContain(`from=${year}-01-01`);
    expect(hit.href).toContain(`to=${year}-12-31`);
  });

  it("requires every word, and ranks a title match above a body match", () => {
    expect(searchHits(index, "zzzz calloway")).toHaveLength(0);
    const hits = searchHits(index, "pool");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title.toLowerCase()).toContain("pool");
  });

  it("groups by tab and caps each group", () => {
    const groups = groupHits(searchHits(index, "2026", 200), 3);
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) expect(g.hits.length).toBeLessThanOrEqual(3);
  });

  it("gives a resident only their own requests and notices", () => {
    const mine = mehrMeadows.homes.find((o) => mehrMeadows.requests.some((r) => r.homeId === o.id))!;
    const hits = residentIndex(mehrMeadows, mine);
    const requests = hits.filter((h) => h.kind === "request");
    expect(requests.length).toBeGreaterThan(0);
    const theirs = mehrMeadows.requests.filter((r) => r.homeId !== mine.id);
    for (const r of theirs) expect(hits.some((h) => h.id === `req-${r.id}`)).toBe(false);
    expect(hits.some((h) => h.kind === "household" || h.kind === "transaction")).toBe(false);
    expect(hits.filter((h) => h.kind === "document").every((h) => !h.subtitle.includes("board"))).toBe(true);
  });
});

describe("the search index, typed the way people type", () => {
  const index = boardIndex(mehrMeadows);

  it("finds a household by a few letters, a typo, a phone number, or the unit alone", () => {
    expect(searchHits(index, "callo")[0].title).toBe("Rhea Calloway");
    expect(searchHits(index, "caloway")[0].title).toBe("Rhea Calloway");
    expect(searchHits(index, "CALLOWAY")[0].title).toBe("Rhea Calloway");
    const rhea = mehrMeadows.homes.find((o) => o.displayName === "Rhea Calloway")!;
    expect(searchHits(index, rhea.phone.replace(/\D/g, "")).some((h) => h.title === "Rhea Calloway")).toBe(true);
    expect(searchHits(index, rhea.unit).some((h) => h.id === `own-${rhea.id}`)).toBe(true);
  });

  it("opens a household expanded, not the roster it is somewhere on", () => {
    const rhea = mehrMeadows.homes.find((o) => o.displayName === "Rhea Calloway")!;
    expect(searchHits(index, "calloway")[0].href).toContain(`open=${rhea.id}`);
  });

  it("finds a transaction by its month and a synonym for its category", () => {
    const dues = mehrMeadows.ledger.find((e) => e.category === "Assessments")!;
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][
      Number(dues.date.slice(5, 7)) - 1
    ];
    const hits = searchHits(index, `${month} dues`, 200);
    expect(hits.some((h) => h.id === `tx-${dues.id}`), `"${month} dues" did not find the assessment`).toBe(true);
  });

  it("finds a transaction by its amount, typed with or without the dollars", () => {
    const e = mehrMeadows.ledger.find((x) => Math.abs(x.amountCents) % 100 !== 0) ?? mehrMeadows.ledger[0];
    const dollars = (Math.abs(e.amountCents) / 100).toFixed(2);
    const whole = String(Math.floor(Math.abs(e.amountCents) / 100));
    expect(searchHits(index, `$${dollars}`, 200).some((h) => h.id === `tx-${e.id}`)).toBe(true);
    expect(searchHits(index, whole, 200).some((h) => h.id === `tx-${e.id}`)).toBe(true);
  });

  it("finds a request by its reference", () => {
    const r = mehrMeadows.requests[0];
    expect(searchHits(index, r.reference)[0].id).toBe(`req-${r.id}`);
  });

  it("carries highlight ranges on the words that matched", () => {
    const [top] = searchIndex(prepareIndex(index), "calloway");
    expect(top.item.title).toBe("Rhea Calloway");
    expect(top.titleRanges).toEqual([{ start: 5, end: 13 }]);
  });
});

describe("pages and shortcuts", () => {
  const all = () => true;
  const none = () => false;

  it("offers every board page by name and by the words people use for it", () => {
    const pages = prepareIndex(boardPages(mehrMeadows, all));
    expect(searchIndex(pages, "settings")[0].item.href).toBe("/board/settings");
    expect(searchIndex(pages, "money")[0].item.title).toBe("Finances");
    expect(searchIndex(pages, "past due")[0].item.title).toBe("Past due");
    expect(searchIndex(pages, "roster")[0].item.title).toBe("Homeowners");
  });

  it("puts an exact page name above the records that mention it", () => {
    const index = prepareIndex([...boardPages(mehrMeadows, all), ...boardIndex(mehrMeadows)]);
    expect(searchIndex(index, "vendors")[0].item.kind).toBe("page");
    expect(searchIndex(index, "meetings")[0].item.kind).toBe("page");
  });

  it("offers a seat only the pages its capabilities open", () => {
    const pages = boardPages(mehrMeadows, none);
    expect(pages.map((p) => p.href)).toEqual(["/board"]);
    const vendorsOnly = boardPages(mehrMeadows, (c) => c === "vendors");
    expect(vendorsOnly.some((p) => p.href === "/board/vendors")).toBe(true);
    expect(vendorsOnly.some((p) => p.href === "/board/money")).toBe(false);
    expect(vendorsOnly.some((p) => p.href === "/board/money/transactions")).toBe(false);
  });

  it("offers a resident their pages, with dues meaning Pay, and never a board page", () => {
    const pages = residentPages(mehrMeadows);
    expect(pages.every((p) => p.href.startsWith("/resident"))).toBe(true);
    const prepared = prepareIndex(pages);
    expect(searchIndex(prepared, "dues")[0].item.href).toBe("/resident/pay");
    expect(searchIndex(prepared, "text size")[0].item.href).toBe("/resident/settings");
    expect(searchIndex(prepared, "homeowners")).toHaveLength(0);
  });

  it("turns a dollar amount into Record a payment and Find transactions for the board", () => {
    const hits = boardShortcuts("$285.00", mehrMeadows, all);
    expect(hits.map((h) => h.title)).toEqual(["Record a payment of $285.00", "Find transactions for $285.00"]);
    expect(hits[0].href).toBe("/board/vendors?record=1&amount=285.00");
    expect(hits[1].href).toContain("/board/money/transactions?q=285.00");
    expect(boardShortcuts("285", mehrMeadows, all)[0].title).toBe("Record a payment of $285.00");
    expect(boardShortcuts("285", mehrMeadows, (c) => c === "finances").map((h) => h.title)).toEqual([
      "Find transactions for $285.00",
    ]);
    expect(boardShortcuts("285", mehrMeadows, none)).toHaveLength(0);
    expect(boardShortcuts("calloway", mehrMeadows, all)).toHaveLength(0);
  });

  it("turns a unit number into Open home, only for a seat that may open the roster", () => {
    const rhea = mehrMeadows.homes.find((o) => o.displayName === "Rhea Calloway")!;
    const hits = boardShortcuts(`unit ${rhea.unit}`, mehrMeadows, all);
    expect(hits.some((h) => h.href === `/board/homeowners?open=${rhea.id}`)).toBe(true);
    // A bare number that is a unit is the home, not fifty-five dollars.
    const bare = boardShortcuts(rhea.unit, mehrMeadows, all);
    expect(bare.some((h) => h.subtitle.includes("Rhea Calloway"))).toBe(true);
    expect(bare.some((h) => h.title.startsWith("Record a payment"))).toBe(false);
    expect(boardShortcuts(`$${rhea.unit}`, mehrMeadows, all)[0].title).toBe(`Record a payment of $${rhea.unit}.00`);
    // Without the roster, the number is only ever money.
    const vendorsOnly = boardShortcuts(rhea.unit, mehrMeadows, (c) => c === "vendors");
    expect(vendorsOnly.some((h) => h.title.startsWith("Open"))).toBe(false);
    expect(vendorsOnly.map((h) => h.title)).toEqual([`Record a payment of $${rhea.unit}.00`]);
  });

  it("gives a resident Pay for an amount and their own home only for a unit", () => {
    const home = mehrMeadows.homes.find((o) => !o.placeholder)!;
    const other = mehrMeadows.homes.find((o) => o.id !== home.id && o.unit !== home.unit)!;
    expect(residentShortcuts("120", mehrMeadows, home)[0].href).toBe("/resident/pay");
    expect(residentShortcuts(home.unit, mehrMeadows, home)[0].href).toBe("/resident/account");
    // Somebody else's unit is not theirs to open; the number is only money.
    expect(residentShortcuts(other.unit, mehrMeadows, home).map((h) => h.href)).toEqual(["/resident/pay"]);
  });

  it("lists Shortcuts before every other group", () => {
    const index = prepareIndex([...boardPages(mehrMeadows, all), ...boardIndex(mehrMeadows)]);
    const rows: SearchHit[] = [...searchIndex(index, "285").map((s) => s.item), ...boardShortcuts("285", mehrMeadows, all)];
    const groups = groupHits(rows);
    expect(groups[0].section).toBe("Shortcuts");
  });
});

describe("a resident's own account", () => {
  it("finds their charges by month and amount, and nobody else's", () => {
    const home = mehrMeadows.homes.find((o) => (mehrMeadows.homeCharges[o.id] ?? []).length > 0)!;
    const line = mehrMeadows.homeCharges[home.id].find((l) => l.kind === "charge")!;
    const hits = residentIndex(mehrMeadows, home);
    const mine = hits.filter((h) => h.kind === "charge");
    expect(mine.length).toBe(mehrMeadows.homeCharges[home.id].length);
    expect(searchHits(hits, line.label).some((h) => h.id === `chg-${line.id}`)).toBe(true);
    expect(searchHits(hits, String(Math.abs(line.amountCents) / 100), 200).some((h) => h.id === `chg-${line.id}`)).toBe(true);
    expect(residentIndex(mehrMeadows, null).some((h) => h.kind === "charge")).toBe(false);
  });
});

describe("recent choices", () => {
  const fake = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
  };
  const hit = (id: string, title: string): SearchHit => ({
    id,
    kind: "household",
    section: "Homeowners",
    title,
    subtitle: "",
    href: `/board/homeowners?open=${id}`,
    date: "",
    keywords: "",
    tint: "violet",
  });

  it("keeps the last five, newest first, without repeats, and never a shortcut", () => {
    const storage = fake();
    const store = createRecentStore(storage);
    for (let i = 1; i <= 7; i++) store.remember(hit(`o${i}`, `Owner ${i}`));
    store.remember(hit("o3", "Owner 3"));
    expect(store.getSnapshot().map((e) => e.id)).toEqual(["o3", "o7", "o6", "o5", "o4"]);
    store.remember({ ...hit("s", "Pay $285.00"), kind: "shortcut", section: "Shortcuts" });
    expect(store.getSnapshot()[0].id).toBe("o3");
    expect(JSON.parse(storage.map.get("hoasis-search-recent")!)).toHaveLength(5);
  });

  it("reads back what it stored, ignores junk, and clears", () => {
    const storage = fake();
    createRecentStore(storage).remember(hit("a", "Anna"));
    expect(createRecentStore(storage).getSnapshot()[0].title).toBe("Anna");
    storage.setItem("hoasis-search-recent", "not json");
    expect(createRecentStore(storage).getSnapshot()).toEqual([]);
    const store = createRecentStore(fake());
    let told = 0;
    store.subscribe(() => told++);
    store.remember(hit("a", "Anna"));
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
    expect(told).toBe(2);
  });
});

describe("the letter a household is due", () => {
  const policy = policyFor(mehrMeadows.settings);

  it("follows the ladder, and nothing goes before the reminder day", () => {
    for (const o of mehrMeadows.homes) {
      const letter = dueLetter(o, policy, mehrMeadows.templates);
      if (o.daysPastDue < policy.reminderDay) expect(letter).toBeNull();
      else if (o.daysPastDue < policy.lateNoticeDay) expect(letter?.trigger).toBe("past-due");
      else if (o.daysPastDue < policy.demandDay) expect(letter?.trigger).toBe("late-notice");
      else expect(letter?.trigger).toBe("collections");
    }
  });

  it("fills every token from that household's own record", () => {
    const home = mehrMeadows.homes.find((o) => o.daysPastDue >= policy.lateNoticeDay)!;
    const template = dueLetter(home, policy, mehrMeadows.templates)!;
    const letter = renderLetter(template, home, mehrMeadows);
    expect(letter.subject).not.toContain("{{");
    expect(letter.body).not.toContain("{{");
    expect(letter.body).toContain(home.displayName);
    expect(letter.body).toContain(`unit ${home.unit}`);
    expect(letter.body).toContain(String(home.daysPastDue));
  });
});
