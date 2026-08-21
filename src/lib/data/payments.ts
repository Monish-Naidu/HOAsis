import type { PaymentInstrument } from "@/lib/payments/instruments";

/**
 * Seeded payment instruments.
 *
 * Only masks, brands, and expiry live here, which is exactly what a processor
 * would hand back. There is no card number in this file and there never should
 * be one, in any environment.
 */
export const paymentInstruments: PaymentInstrument[] = [
  {
    id: "pm-ach-becu",
    ownerId: "own-042",
    kind: "ach",
    label: "BECU checking",
    mask: "2288",
    institution: "BECU",
    accountType: "checking",
    isDefault: true,
    addedDate: "2024-03-02",
    token: "tok_ach_seed_2288",
  },
  {
    id: "pm-card-visa",
    ownerId: "own-042",
    kind: "card",
    label: "Visa",
    mask: "4402",
    brand: "visa",
    expMonth: 11,
    expYear: 2027,
    isDefault: false,
    addedDate: "2025-06-14",
    token: "tok_card_seed_4402",
  },
  {
    id: "pm-ach-arya",
    ownerId: "own-007",
    kind: "ach",
    label: "BECU checking",
    mask: "4471",
    institution: "BECU",
    accountType: "checking",
    isDefault: true,
    addedDate: "2023-01-09",
    token: "tok_ach_seed_4471",
  },
];

/** Institutions the linking flow offers. Stands in for an aggregator's list. */
export const supportedInstitutions = [
  { id: "becu", name: "BECU", accounts: [{ type: "checking" as const, mask: "2288" }, { type: "savings" as const, mask: "9014" }] },
  { id: "chase", name: "Chase", accounts: [{ type: "checking" as const, mask: "5567" }] },
  { id: "wafd", name: "WaFd Bank", accounts: [{ type: "checking" as const, mask: "3310" }] },
  { id: "coastal", name: "Coastal Community Bank", accounts: [{ type: "checking" as const, mask: "7742" }, { type: "savings" as const, mask: "1180" }] },
  { id: "sound", name: "Sound Credit Union", accounts: [{ type: "checking" as const, mask: "6621" }] },
];
