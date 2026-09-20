import { describe, expect, it } from "vitest";
import { boardIndex, groupHits, residentIndex, searchHits } from "@/lib/search";
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
    const rhea = mehrMeadows.owners.find((o) => o.displayName === "Rhea Calloway")!;
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
    const mine = mehrMeadows.owners.find((o) => mehrMeadows.requests.some((r) => r.ownerId === o.id))!;
    const hits = residentIndex(mehrMeadows, mine);
    const requests = hits.filter((h) => h.kind === "request");
    expect(requests.length).toBeGreaterThan(0);
    const theirs = mehrMeadows.requests.filter((r) => r.ownerId !== mine.id);
    for (const r of theirs) expect(hits.some((h) => h.id === `req-${r.id}`)).toBe(false);
    expect(hits.some((h) => h.kind === "household" || h.kind === "transaction")).toBe(false);
    expect(hits.filter((h) => h.kind === "document").every((h) => !h.subtitle.includes("board"))).toBe(true);
  });
});

describe("the letter a household is due", () => {
  const policy = policyFor(mehrMeadows.settings);

  it("follows the ladder, and nothing goes before the reminder day", () => {
    for (const o of mehrMeadows.owners) {
      const letter = dueLetter(o, policy, mehrMeadows.templates);
      if (o.daysPastDue < policy.reminderDay) expect(letter).toBeNull();
      else if (o.daysPastDue < policy.lateNoticeDay) expect(letter?.trigger).toBe("past-due");
      else if (o.daysPastDue < policy.demandDay) expect(letter?.trigger).toBe("late-notice");
      else expect(letter?.trigger).toBe("collections");
    }
  });

  it("fills every token from that household's own record", () => {
    const owner = mehrMeadows.owners.find((o) => o.daysPastDue >= policy.lateNoticeDay)!;
    const template = dueLetter(owner, policy, mehrMeadows.templates)!;
    const letter = renderLetter(template, owner, mehrMeadows);
    expect(letter.subject).not.toContain("{{");
    expect(letter.body).not.toContain("{{");
    expect(letter.body).toContain(owner.displayName);
    expect(letter.body).toContain(`unit ${owner.unit}`);
    expect(letter.body).toContain(String(owner.daysPastDue));
  });
});
