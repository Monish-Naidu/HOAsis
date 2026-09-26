import type { Account, Capabilities, Capability } from "@/lib/types";

/** Nobody but the President can hold the permissions capability. */
export const GRANTABLE: Capability[] = [
  "finances",
  "requests",
  "documents",
  "communications",
  "voting",
  "vendors",
  "compliance",
  "forum",
  "settings",
];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  finances: "Money and reserves",
  requests: "Requests and violations",
  documents: "Documents",
  communications: "Communications",
  voting: "Voting and meetings",
  vendors: "Vendors and payables",
  compliance: "Compliance register",
  forum: "Forum moderation",
  settings: "Community settings",
  permissions: "Grant capabilities to others",
};

/** Builds a capability set, with permissions off unless this is the President. */
export function caps(on: Capability[], permissions = false): Capabilities {
  const base = Object.fromEntries(
    [...GRANTABLE, "permissions"].map((c) => [c, false]),
  ) as Capabilities;
  for (const c of on) base[c] = true;
  base.permissions = permissions;
  return base;
}

export const NO_CAPABILITIES = caps([]);

/**
 * What each office can do before anyone adjusts it.
 *
 * Boards change every year, so these are a starting point rather than a rule.
 * The President can widen or narrow any of them, except their own. Written
 * for a real board, not the demo (Monish, 2026-09-26): the Vice President
 * stands in for the President and sees everything except the power to
 * change seats; the Treasurer runs the money and the letters about it; the
 * Secretary keeps the records, the minutes and the correspondence.
 *
 * Only the President holds `permissions`, which is why an association
 * always has exactly one: the founder is President by construction and the
 * office moves through "Transfer presidency", never by leaving it empty.
 */
export const DEFAULT_ROLE_CAPABILITIES: Record<string, Capability[]> = {
  president: [...GRANTABLE],
  "vice-president": [...GRANTABLE],
  treasurer: ["finances", "vendors", "documents", "communications", "compliance"],
  secretary: ["documents", "communications", "voting", "requests", "compliance", "forum"],
  resident: [],
};

/** The defaults before 2026-09-26, so seats still carrying them can be moved forward. */
export const LEGACY_ROLE_CAPABILITIES: Record<string, Capability[]> = {
  "vice-president": ["requests", "documents", "communications", "voting", "forum"],
  treasurer: ["finances", "vendors", "documents"],
  secretary: ["documents", "communications", "voting", "compliance", "forum"],
};

/**
 * Seeded accounts. Everyone here owns a unit, so everyone can use the resident
 * side; the admin role is a wrapper on top of that, not a separate identity.
 */
export const accounts: Account[] = [
  {
    id: "acct-arya",
    ownerId: "own-007",
    name: "Arya Mehr",
    email: "arya.mehr@example.com",
    unit: "7",
    role: "president",
    capabilities: caps([...GRANTABLE], true),
  },
  {
    id: "acct-dana",
    ownerId: "own-019",
    name: "Dana Whitcomb",
    email: "dana.whitcomb@example.com",
    unit: "19",
    role: "treasurer",
    capabilities: caps(["finances", "vendors", "requests", "documents", "compliance"]),
  },
  {
    id: "acct-sofia",
    ownerId: "own-031",
    name: "Sofia Bergman",
    email: "s.bergman@example.com",
    unit: "31",
    role: "secretary",
    capabilities: caps(["documents", "communications", "voting", "requests", "compliance", "forum"]),
  },
  {
    id: "acct-ellis",
    ownerId: "own-071",
    name: "Ellis Wright",
    email: "ellis.wright@example.com",
    unit: "71",
    role: "vice-president",
    capabilities: caps(["requests", "voting", "communications", "forum"]),
  },
  {
    id: "acct-monish",
    ownerId: "own-042",
    name: "Monish Naidu",
    email: "monish.naidu@example.com",
    unit: "42",
    role: "resident",
    capabilities: NO_CAPABILITIES,
  },
  {
    id: "acct-nina",
    ownerId: "own-015",
    name: "Nina Sharma",
    email: "nina.sharma@example.com",
    unit: "15",
    role: "resident",
    capabilities: NO_CAPABILITIES,
  },
];

export const DEFAULT_ACCOUNT_ID = "acct-monish";

export function accountById(id: string) {
  return accounts.find((a) => a.id === id);
}

export function isAdmin(account: Account) {
  return account.role !== "resident";
}
