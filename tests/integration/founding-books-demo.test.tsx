import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppStateProvider, useAppState } from "@/lib/app-state";
import { createdCommunities } from "@/lib/data/created-communities";
import { emptyDraft, finalizeDraft, type CommunityDraft } from "@/lib/data/new-community";
import { foundingBooksFor, withBooks, withExtras } from "@/app/start/books";

/**
 * The look-around copy of founding keeps the same books the signed-in path
 * saves: the budget year, the first bill and each home's opening balance to
 * the cent, after a reload, and once only when setup is finished twice.
 */

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

const draft: CommunityDraft = withBooks(
  {
    ...emptyDraft(),
    name: "Alder Court",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 12_000,
    dueDay: 1,
    founder: { name: "Pat", email: "pat@example.com", unit: "1" },
    households: [
      withExtras(
        { name: "Marcus Bell", email: "", unit: "2" },
        { phone: "425-555-0114", openingBalanceCents: 18_550 },
      ),
      withExtras({ name: "Rosa Lind", email: "", unit: "3" }, { openingBalanceCents: -2_001 }),
      { name: "", email: "", unit: "4" },
    ],
  },
  { fiscalYearStart: "07-01", billingStartsOn: "2099-01-01", openingAsOf: "2026-10-15" },
);

afterEach(() => {
  window.localStorage.clear();
});

function openingLines(community: ReturnType<typeof useAppState>["community"]) {
  return Object.values(community.homeCharges)
    .flat()
    .filter((line) => line.label === "Balance brought forward");
}

describe("founding in the demo with books", () => {
  it("keeps the exact dates and cents, after a reload, and once on a second finish", () => {
    const final = finalizeDraft(draft);
    const books = foundingBooksFor(draft, final, "2026-10-15");

    const first = renderHook(() => useAppState(), { wrapper });
    act(() => {
      first.result.current.createCommunity(final, books);
    });
    const made = first.result.current.community;
    expect(made.association.fiscalYearStart).toBe("07-01");
    expect(made.nextChargeDate).toBe("2099-01-01");
    expect(made.homes.find((h) => h.unit === "2")?.balanceCents).toBe(18_550);
    expect(made.homes.find((h) => h.unit === "3")?.balanceCents).toBe(-2_001);
    expect(openingLines(made).map((l) => [l.date, l.amountCents])).toEqual([
      ["2026-10-15", 18_550],
      ["2026-10-15", -2_001],
    ]);
    first.unmount();

    // A reload reads the same community back from this browser.
    const again = renderHook(() => useAppState(), { wrapper });
    expect(again.result.current.community.id).toBe(made.id);
    expect(openingLines(again.result.current.community)).toEqual(openingLines(made));

    // Finishing setup a second time replaces the copy rather than adding one.
    act(() => {
      again.result.current.createCommunity(final, books);
    });
    expect(createdCommunities().filter((c) => c.id === made.id)).toHaveLength(1);
    expect(again.result.current.community.homes).toHaveLength(made.homes.length);
    const lines = openingLines(again.result.current.community);
    expect(lines).toHaveLength(2);
    expect(lines.reduce((sum, l) => sum + l.amountCents, 0)).toBe(16_549);
  });
});
