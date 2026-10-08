import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import { startingBalancesLine } from "@/app/board/money/opening-balances";

describe("startingBalancesLine", () => {
  const [op, res] = [
    { ...mehrMeadows.bankAccounts[0], id: "op", kind: "operating" as const },
    { ...mehrMeadows.bankAccounts[0], id: "rs", kind: "reserve" as const },
  ];
  const line = (accountId: string, amountCents: number) => ({
    ...mehrMeadows.ledger[0],
    id: `o-${accountId}`,
    accountId,
    amountCents,
    date: "2025-10-01",
    category: "Opening balance" as const,
  });

  it("lists operating and reserve together", () => {
    const c = { ...mehrMeadows, bankAccounts: [op, res], ledger: [line("op", 2_400_000), line("rs", 13_500_000)] };
    expect(startingBalancesLine(c, 0)).toBe("Starting balances: $24,000 operating, $135,000 reserve as of Oct 1, 2025");
  });

  it("says when nothing is set, and counts accounts still to set", () => {
    const none = { ...mehrMeadows, bankAccounts: [op], ledger: [] };
    expect(startingBalancesLine(none, 1)).toBe("Starting balances: not set yet");
    const some = { ...mehrMeadows, bankAccounts: [op, res], ledger: [line("op", 100_000)] };
    expect(startingBalancesLine(some, 1)).toBe("Starting balances: $1,000 operating as of Oct 1, 2025, 1 account still to set");
  });
});
