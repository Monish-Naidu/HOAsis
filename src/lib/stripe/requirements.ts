/**
 * Stripe's onboarding requirements, in a treasurer's words.
 *
 * A connected account carries a list of requirement entries whose
 * `description` is a machine path such as
 * `identity.business_details.id_numbers.us_ein`,
 * `representative.date_of_birth.day` or `external_account`. Settings shows
 * the treasurer one plain sentence per thing they still have to do, not
 * thirty paths, so the paths are grouped here by the thing they are about.
 *
 * Pure, no Stripe import: tested in tests/unit/stripe-requirements.test.ts.
 * Older (v1) names such as `id_numbers`, `external_account` and
 * `representative` map the same way, so the table works whichever shape a
 * requirement arrives in.
 */

export interface RequirementEntry {
  description: string;
  awaiting_action_from?: "user" | "stripe" | string;
}

/** Ordered: the sentence the treasurer sees first is the one that unblocks most. */
const RULES: Array<{ test: RegExp; sentence: string }> = [
  {
    test: /(^|\.)id_numbers(\.|$)|us_ein|tax_id/,
    sentence: "the EIN or a Social Security number",
  },
  { test: /(^|\.)external_account(\.|$)/, sentence: "a bank account for payouts" },
  {
    test: /terms_of_service|tos_acceptance/,
    sentence: "agreement to Stripe's terms",
  },
  {
    test: /^representative(\.|$)|(^|\.)representative(\.|$)/,
    sentence: "the person who represents the association",
  },
  {
    test: /^owners(\.|$)|persons_provided|(^|\.)owners(\.|$)|directors|executives/,
    sentence: "who serves on the board",
  },
  {
    test: /business_details\.address|(^|\.)address(\.|$)/,
    sentence: "the association's mailing address",
  },
  { test: /business_details\.phone|support\.phone|(^|\.)phone$/, sentence: "a phone number" },
  { test: /business_url|support\.url|(^|\.)url$/, sentence: "the association's web address" },
  {
    test: /product_description|statement_descriptor|(^|\.)mcc$/,
    sentence: "a short description of what residents pay for",
  },
  { test: /(^|\.)documents?(\.|$)|verification/, sentence: "a document that proves the details" },
];

/** One plain sentence for one Stripe requirement path, or null when it is not one a treasurer can act on. */
export function describeRequirement(description: string): string | null {
  const path = description.trim();
  if (!path) return null;
  for (const rule of RULES) {
    if (rule.test.test(path)) return rule.sentence;
  }
  return null;
}

/**
 * Every distinct sentence for the entries the treasurer (not Stripe) still
 * owes, in the order of RULES, so the list reads the same whatever order
 * Stripe sent it in. An entry nobody has a sentence for becomes "a few more
 * details" once, at the end, so the row never says nothing is needed when
 * something is.
 */
export function plainNeeds(entries: RequirementEntry[]): string[] {
  const ours = entries.filter((e) => (e.awaiting_action_from ?? "user") === "user");
  const found = new Set<string>();
  let unknown = false;
  for (const entry of ours) {
    const sentence = describeRequirement(entry.description);
    if (sentence) found.add(sentence);
    else unknown = true;
  }
  const ordered = RULES.map((r) => r.sentence).filter((s) => found.has(s));
  if (unknown) ordered.push("a few more details");
  return ordered;
}

/** "the EIN, a bank account for payouts, and the person who represents the association". */
export function joinNeeds(needs: string[]): string {
  if (needs.length === 0) return "";
  if (needs.length === 1) return needs[0];
  if (needs.length === 2) return `${needs[0]} and ${needs[1]}`;
  return `${needs.slice(0, -1).join(", ")}, and ${needs[needs.length - 1]}`;
}
