import type { Community } from "@/lib/data/community";
import { renderTemplate, type MessageTemplate } from "@/lib/data/templates";
import { type CollectionPolicy, type CollectionStage, stageFor } from "@/lib/collections";
import type { Owner } from "@/lib/types";
import { money } from "@/lib/utils";

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
export function letterTrigger(stage: CollectionStage): MessageTemplate["trigger"] | null {
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
  owner: Owner,
  policy: CollectionPolicy,
  templates: MessageTemplate[],
): MessageTemplate | null {
  if (owner.daysPastDue <= 0) return null;
  const trigger = letterTrigger(stageFor(owner.daysPastDue, policy));
  if (!trigger) return null;
  return templates.find((t) => t.trigger === trigger) ?? null;
}

/**
 * Every token, filled from this household's record.
 *
 * Subject and body share one map. They drifted apart once, and the board sent
 * notices whose subject line still said {{unit}}.
 */
export function letterFields(
  owner: Owner,
  community: Pick<Community, "association" | "settings">,
): Record<string, string> {
  return {
    owner: owner.displayName,
    unit: owner.unit,
    balance: money(owner.balanceCents),
    days_past_due: String(owner.daysPastDue),
    association: community.settings.displayName,
    dues: money(community.association.duesCents),
    portal_link: "yourhoasis.com/resident/pay",
  };
}

/** A template with this household's figures in it, ready to send. */
export function renderLetter(
  template: Pick<MessageTemplate, "subject" | "body">,
  owner: Owner,
  community: Pick<Community, "association" | "settings">,
): { subject: string; body: string } {
  const fields = letterFields(owner, community);
  return {
    subject: renderTemplate(template.subject, fields),
    body: renderTemplate(template.body, fields),
  };
}
