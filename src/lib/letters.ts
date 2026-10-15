import type { Community } from "@/lib/data/community";
import { renderTemplate, type MessageTemplate } from "@/lib/data/templates";
import { type CollectionPolicy, type CollectionStage, stageFor } from "@/lib/collections";
import type { Home } from "@/lib/types";
import { homeLabel } from "@/lib/wording";
import { money, todayIsoDate } from "@/lib/utils";
import { duesTerms, homeDues } from "@/lib/home-types";

/**
 * Which letter a household is owed, and what it says once filled in.
 *
 * The collection policy places every past due household on a ladder; each
 * rung has one letter. The board never picks a letter for a group, because a
 * group is never on one rung: the household four days behind gets the friendly
 * reminder, the one at ninety gets the notice of intent, and the same send
 * button does both. Selective enforcement is the defence an owner raises
 * against a lien, and "everyone got the letter their account was due" is the
 * answer.
 */

/** The template trigger for each rung. `null` where the policy owes nothing yet. */
function letterTrigger(stage: CollectionStage): MessageTemplate["trigger"] | null {
  switch (stage) {
    case "reminder":
      return "past-due";
    case "late-notice":
      return "late-notice";
    case "demand":
    case "counsel":
      return "collections";
    default:
      return null;
  }
}

/** The letter a household is due today, or null when it is not yet at the reminder day. */
export function dueLetter(
  home: Home,
  policy: CollectionPolicy,
  templates: MessageTemplate[],
): MessageTemplate | null {
  if (home.daysPastDue <= 0) return null;
  const trigger = letterTrigger(stageFor(home.daysPastDue, policy));
  if (!trigger) return null;
  return templates.find((t) => t.trigger === trigger) ?? null;
}

/**
 * Every token, filled from this household's record.
 *
 * Subject and body share one map. They drifted apart once, and the board sent
 * notices whose subject line still said {{unit}}.
 */
function letterFields(home: Home, community: LetterCommunity): Record<string, string> {
  return {
    owner: home.displayName,
    // The home in the community's own words ("Lot 12"), as every screen has
    // it. The templates used to say "unit {{unit}}" for a subdivision.
    unit: homeLabel(community, home.unit),
    balance: money(home.balanceCents),
    days_past_due: String(home.daysPastDue),
    association: community.settings.displayName,
    // The rate of the day, so a letter sent after a change took effect never
    // quotes the amount before it.
    dues: money(homeDues(duesTerms(community.association, todayIsoDate()), home)),
    portal_link: "yourhoasis.com/resident/pay",
  };
}

type LetterCommunity = Pick<Community, "association" | "settings" | "profile" | "homeCharges">;

/** Whether a late fee is on this home's statement, the only time a letter may say one was applied. */
export function lateFeePosted(
  community: Pick<Community, "homeCharges">,
  home: Pick<Home, "id">,
): boolean {
  return (community.homeCharges[home.id] ?? []).some(
    (l) => l.kind === "charge" && (l.category === "late_fee" || /late fee/i.test(l.label)),
  );
}

/**
 * The template with the word "unit" taken out in front of the home's own
 * label, and the sentence about a late fee taken out when none was posted.
 *
 * A policy with a $0 fee sent "A late fee has been applied" to an owner who
 * was charged nothing. The sentence stays when a fee is on the statement.
 */
function adapt(text: string, feePosted: boolean): string {
  const named = text.replace(/\bunit\s+(\{\{unit\}\})/gi, "$1");
  return feePosted ? named : named.replace(/ ?A late fee has been applied[^.\n]*\./i, "");
}

/** A template with this household's figures in it, ready to send. */
export function renderLetter(
  template: Pick<MessageTemplate, "subject" | "body">,
  home: Home,
  community: LetterCommunity,
): { subject: string; body: string } {
  const fields = letterFields(home, community);
  const feePosted = lateFeePosted(community, home);
  return {
    subject: renderTemplate(adapt(template.subject, feePosted), fields),
    body: renderTemplate(adapt(template.body, feePosted), fields),
  };
}
