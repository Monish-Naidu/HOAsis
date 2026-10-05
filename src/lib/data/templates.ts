import type { ID } from "@/lib/types";

/**
 * Message templates.
 *
 * Collections letters are the messages a board sends most and dreads writing
 * most, because the wording carries legal weight and the tone carries the
 * relationship. Templates fix both: the board writes it once, calmly, and
 * every subsequent send is consistent.
 *
 * Tokens are substituted at send time from the owner record, so no one is
 * hand-typing a balance into a letter and getting it wrong.
 */
export interface MessageTemplate {
  id: ID;
  name: string;
  description: string;
  subject: string;
  body: string;
  /** Which situation this template is the default for. */
  trigger: "past-due" | "late-notice" | "collections" | "welcome" | "general";
  updatedDate: string;
}

/** Every token the substitution step understands. */
export const TEMPLATE_TOKENS = [
  { token: "{{owner}}", meaning: "Owner name" },
  { token: "{{unit}}", meaning: "Unit number" },
  { token: "{{balance}}", meaning: "Amount owed" },
  { token: "{{days_past_due}}", meaning: "Days since the due date" },
  { token: "{{association}}", meaning: "Community name" },
  { token: "{{dues}}", meaning: "Monthly dues" },
  { token: "{{portal_link}}", meaning: "Direct link to pay" },
] as const;

export const messageTemplates: MessageTemplate[] = [
  {
    id: "tpl-past-due",
    name: "Friendly reminder",
    description: "First contact. Assumes it was an oversight, because it usually was.",
    trigger: "past-due",
    subject: "{{association}}: dues reminder for unit {{unit}}",
    body: `Hello {{owner}},

Our records show a balance of {{balance}} on unit {{unit}}, {{days_past_due}} days past the due date. If you have already sent payment, thank you and please ignore this note.

You can pay online at {{portal_link}}. Paying by bank transfer is free to you and costs the association the least, which keeps dues where they are.

If something has come up, reply to this message. A payment plan is available and it is far easier to arrange now than later.

The {{association}} Board`,
    updatedDate: "2026-03-14",
  },
  {
    id: "tpl-late-notice",
    name: "Late notice with fee",
    description: "Sent once a late fee has been applied. Firmer, still not adversarial.",
    trigger: "late-notice",
    subject: "{{association}}: late dues on unit {{unit}}",
    body: `{{owner}},

Unit {{unit}} carries a balance of {{balance}} and is now {{days_past_due}} days past due. A late fee has been applied under the association's collection policy.

Please bring the account current at {{portal_link}}, or contact the board to arrange a payment plan. Continued non-payment moves the account to the association's attorney, which adds cost for everyone.

The {{association}} Board`,
    updatedDate: "2026-03-14",
  },
  {
    id: "tpl-collections",
    name: "Notice of intent to refer",
    description: "The last step before the attorney. Have this reviewed by your attorney.",
    trigger: "collections",
    subject: "{{association}}: notice regarding unit {{unit}}",
    body: `{{owner}},

This is formal notice that unit {{unit}} carries a balance of {{balance}}, now {{days_past_due}} days past due.

If the balance is not brought current or a written payment plan is not agreed within 30 days of this notice, the board intends to refer the account to the association's attorney. Costs of collection may be added to the amount owed.

You may pay at {{portal_link}} or contact the board to discuss terms.

The {{association}} Board`,
    updatedDate: "2026-03-14",
  },
  {
    id: "tpl-welcome",
    name: "Welcome to the community",
    description: "Sent when a new owner is added to the roster.",
    trigger: "welcome",
    subject: "Welcome to {{association}}",
    body: `Welcome {{owner}},

You now have access to the {{association}} portal at {{portal_link}}. Dues are {{dues}} a month, and setting up autopay takes about a minute.

The governing documents, the current budget, and past meeting minutes are all in the portal. If anything is unclear, ask. Nobody expects a new owner to know how this works.

The {{association}} Board`,
    updatedDate: "2026-01-15",
  },
];

/** Fills the tokens a template declares. Unknown tokens are left visible on purpose. */
export function renderTemplate(
  body: string,
  values: Partial<Record<string, string>>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, token: string) => values[token] ?? match);
}
