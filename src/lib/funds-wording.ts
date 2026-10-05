import type { BankAccount } from "@/lib/types";

/**
 * The bank behind a total on the association funds page: "BECU", or "BECU and
 * Chase" when the money sits in more than one place, or nothing when no
 * account of that kind is connected yet.
 */
export function bankLine(accounts: BankAccount[], which: "operating" | "reserve"): string {
  const names = accounts
    .filter((a) => (which === "operating" ? a.kind === "operating" : a.kind !== "operating"))
    .map((a) => a.institution.trim())
    .filter(Boolean);
  const unique = [...new Set(names)];
  return unique.length > 1 ? `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}` : (unique[0] ?? "");
}
