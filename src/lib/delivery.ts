import type { ISODate, Home } from "@/lib/types";

/**
 * How a notice is allowed to reach somebody.
 *
 * Email works and is wired to a provider. Text and in-app did not exist, and
 * the reason this file is mostly rules rather than plumbing is that the
 * plumbing is the easy half. The hard half is that **not every notice may go
 * by every channel**, and getting that wrong does not fail loudly: the message
 * sends, everybody assumes the association gave notice, and the defect surfaces
 * at the hearing or the foreclosure where the notice is the thing being
 * challenged.
 *
 * Three constraints run through everything here.
 *
 *   **Some notices must go on paper.** Which ones differs by state, but the
 *   shape is consistent: anything that starts a clock somebody can lose a
 *   house at the end of. A lien warning, a preforeclosure notice, and in most
 *   states a fine or hearing notice, need mail and often certified mail. An
 *   emailed one is not a cheaper version of that. It is not notice.
 *
 *   **Text needs consent, and it is a different consent from email.** The TCPA
 *   turns on prior express consent for an automated text to a mobile number,
 *   and the safe reading is an explicit opt in recorded with a date. Having
 *   somebody's phone number is not consent. Neither is a line in the CC&Rs.
 *
 *   **Text also needs the carriers to know who you are.** Application to
 *   person traffic on a normal ten digit number has to be registered through
 *   The Campaign Registry, brand and campaign, which needs the association's
 *   EIN. Unregistered traffic is filtered or dropped, silently, which is the
 *   worst possible failure for a delinquency reminder. So SMS is gated on
 *   registration rather than offered and quietly broken.
 *
 * None of this is legal advice, and the state specific half belongs in the
 * compliance register where it can carry a citation.
 */

export type Channel = "email" | "sms" | "portal" | "mail";

export type NoticeKind =
  | "general"
  | "dues-reminder"
  | "meeting-notice"
  | "budget-ratification"
  | "violation-notice"
  | "hearing-notice"
  | "lien-warning";

export interface NoticeRule {
  kind: NoticeKind;
  label: string;
  /**
   * Whether paper is the only thing that counts as having given notice.
   *
   * Where true, the electronic copy is a courtesy. Sending it does not
   * discharge the duty and the screen has to say so, because a board that
   * believes it has given notice is in a worse position than one that knows it
   * has not.
   */
  mailIsTheNotice: boolean;
  /** Why, in the terms a board will meet it in. */
  why: string;
  /** Channels that may carry it in addition to, or instead of, mail. */
  electronic: Channel[];
}

export const NOTICE_RULES: NoticeRule[] = [
  {
    kind: "general",
    label: "General announcement",
    mailIsTheNotice: false,
    why: "Nothing turns on it, so whatever reaches people is fine.",
    electronic: ["email", "sms", "portal"],
  },
  {
    kind: "dues-reminder",
    label: "Dues reminder",
    mailIsTheNotice: false,
    why: "A reminder is not a demand. Once it becomes a formal delinquency notice the rules change, and several states then require certified mail.",
    electronic: ["email", "sms", "portal"],
  },
  {
    kind: "meeting-notice",
    label: "Notice of a members' meeting",
    mailIsTheNotice: false,
    why: "Most states now allow electronic delivery where the owner agreed to it. Where they did not, this one goes by mail.",
    electronic: ["email", "portal"],
  },
  {
    kind: "budget-ratification",
    label: "Budget summary and ratification meeting",
    mailIsTheNotice: false,
    why: "Deliverable electronically where the owner consented. The deadline is the part that bites, not the channel.",
    electronic: ["email", "portal"],
  },
  {
    kind: "violation-notice",
    label: "Notice of violation",
    mailIsTheNotice: true,
    why: "It starts a cure period and can end in a fine. Several states require mail, and a texted notice of violation is the first thing an owner disputes.",
    electronic: ["email", "portal"],
  },
  {
    kind: "hearing-notice",
    label: "Notice of a hearing",
    mailIsTheNotice: true,
    why: "The owner's chance to be heard rests on it having arrived. Mail, and keep the proof.",
    electronic: ["email", "portal"],
  },
  {
    kind: "lien-warning",
    label: "Lien or preforeclosure warning",
    mailIsTheNotice: true,
    why: "This is the one somebody can lose a house at the end of. Certified mail in most states, with the receipt kept. Nothing electronic substitutes.",
    electronic: ["email"],
  },
];

export function noticeRule(kind: NoticeKind): NoticeRule {
  return NOTICE_RULES.find((r) => r.kind === kind) ?? NOTICE_RULES[0];
}

/* -------------------------------------------------------------------------- */
/* Consent                                                                     */
/* -------------------------------------------------------------------------- */

export interface ChannelConsent {
  /** When they opted in. Absent means they never did. */
  grantedOn?: ISODate;
  /** How it was captured, so it can be produced if challenged. */
  how?: string;
  /** When they said stop. Beats any grant. */
  revokedOn?: ISODate;
}

export interface ContactConsent {
  email?: ChannelConsent;
  sms?: ChannelConsent;
}

/**
 * Whether this household has actually agreed to be texted.
 *
 * Revocation wins, always and immediately. STOP is not a preference to be
 * weighed against the association's need to reach somebody, and there is no
 * override anywhere in this product.
 */
export function hasConsent(consent: ChannelConsent | undefined): boolean {
  if (!consent?.grantedOn) return false;
  if (!consent.revokedOn) return true;
  return consent.revokedOn < consent.grantedOn;
}

export interface Reachability {
  channel: Channel;
  /** Whether it can carry this notice to this household, right now. */
  usable: boolean;
  /** Why not, in words a board can act on. */
  blocker?: string;
}

export interface SmsReadiness {
  /** Whether the association can send application to person text at all. */
  registered: boolean;
  /** What is still missing. */
  missing: string[];
}

/**
 * How a given notice can reach one household.
 *
 * Returns every channel with a verdict rather than a filtered list, because
 * "we could not text them" is information a board needs and a silently shorter
 * list is not.
 */
export function reachability(
  home: Home,
  kind: NoticeKind,
  consent: ContactConsent | undefined,
  sms: SmsReadiness,
): Reachability[] {
  const rule = noticeRule(kind);
  const allowed = new Set(rule.electronic);

  return [
    {
      channel: "email",
      usable: allowed.has("email") && home.email.trim().length > 0,
      blocker: !allowed.has("email")
        ? `${rule.label} cannot go by email`
        : home.email.trim()
          ? undefined
          : "No email on file",
    },
    {
      channel: "sms",
      usable:
        allowed.has("sms") &&
        sms.registered &&
        home.phone.trim().length > 0 &&
        hasConsent(consent?.sms),
      blocker: !allowed.has("sms")
        ? `${rule.label} cannot go by text`
        : !sms.registered
          ? "The association is not registered to send text yet"
          : !home.phone.trim()
            ? "No mobile number on file"
            : !hasConsent(consent?.sms)
              ? "They have not agreed to be texted"
              : undefined,
    },
    {
      channel: "portal",
      // Always available. Signing in is consent to see your own association's
      // messages, and nothing is being pushed at anybody.
      usable: allowed.has("portal"),
      blocker: allowed.has("portal") ? undefined : `${rule.label} cannot go in the portal alone`,
    },
    {
      channel: "mail",
      usable: home.address.trim().length > 0,
      blocker: home.address.trim() ? undefined : "No mailing address on file",
    },
  ];
}

/**
 * Whether sending this electronically actually discharges the duty.
 *
 * The question a board never thinks to ask, and the one that decides whether a
 * fine survives. Where mail is the notice, the emailed copy is a courtesy and
 * saying otherwise on screen would be the product misleading them.
 */
export function electronicIsEnough(kind: NoticeKind): boolean {
  return !noticeRule(kind).mailIsTheNotice;
}

/**
 * What is still missing before the association can text anybody.
 *
 * Stated as a gate rather than as a maybe. Unregistered application to person
 * traffic gets filtered by the carriers without an error anybody sees, so
 * offering an SMS button that silently does nothing is worse than offering
 * none at all.
 */
export function smsReadiness(input: {
  /** The association's EIN, needed to register a brand. */
  ein?: string;
  /** Whether a brand has been registered with The Campaign Registry. */
  brandRegistered?: boolean;
  /** Whether a campaign has been approved against that brand. */
  campaignApproved?: boolean;
}): SmsReadiness {
  const missing: string[] = [];
  if (!input.ein?.trim()) missing.push("An EIN for the association");
  if (!input.brandRegistered) missing.push("A registered brand with The Campaign Registry");
  if (!input.campaignApproved) missing.push("An approved campaign for association notices");
  return { registered: missing.length === 0, missing };
}

/**
 * The window a text may be sent in.
 *
 * Eight in the morning to nine at night, in the recipient's local time, which
 * is the TCPA's line and is not waivable by consent. A dues reminder that
 * arrives at 6am is a complaint whether or not it was legal.
 */
export const QUIET_HOURS = { earliest: 8, latest: 21 } as const;

export function withinSendingHours(hour: number): boolean {
  return hour >= QUIET_HOURS.earliest && hour < QUIET_HOURS.latest;
}

export interface AudienceBreakdown {
  total: number;
  byChannel: Record<Channel, number>;
  /** Households this notice cannot lawfully reach any way but paper. */
  mailOnly: number;
  /** Households with no way of being reached at all. */
  unreachable: number;
  mailIsTheNotice: boolean;
}

/** How a whole roster splits across channels for one kind of notice. */
export function audienceFor(
  homes: Home[],
  kind: NoticeKind,
  consentByHome: Record<string, ContactConsent>,
  sms: SmsReadiness,
): AudienceBreakdown {
  const byChannel: Record<Channel, number> = { email: 0, sms: 0, portal: 0, mail: 0 };
  let unreachable = 0;

  for (const home of homes) {
    const rows = reachability(home, kind, consentByHome[home.id], sms);
    for (const row of rows) if (row.usable) byChannel[row.channel] += 1;
    if (!rows.some((r) => r.usable)) unreachable += 1;
  }

  const rule = noticeRule(kind);
  return {
    total: homes.length,
    byChannel,
    mailOnly: rule.mailIsTheNotice ? homes.length : 0,
    unreachable,
    mailIsTheNotice: rule.mailIsTheNotice,
  };
}
