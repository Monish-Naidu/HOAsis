import type { Community } from "@/lib/data/community";
import { billingPhase } from "@/lib/billing";
import type { ISODate } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { homeCount } from "@/lib/metrics";

/**
 * Whether a real association is ready to collect from real residents.
 *
 * The setup plan asks about records: a bank, a budget, a document. This
 * asks the seven questions a board president asks the week they go live,
 * and every answer is read off the records, never off a stored tick:
 *
 *   the roster is in, dues are set, Stripe will take a card, the first bill
 *   is on the calendar, the invitations went out, somebody got in, and the
 *   software will still be here after the free days.
 *
 * Each row links to where it gets fixed. Derived only: two screens showing
 * different answers to "can we take a payment" is the failure this product
 * is positioned against.
 *
 * No longer rendered as a list of its own (2026-10-04): the setup list holds
 * what it checked, and reads `billingStatus` from here. The function stays
 * because it is the one place the seven questions are answered together.
 */

export type GoLiveKey =
  | "roster"
  | "dues"
  | "stripe"
  | "first-bill"
  | "invites"
  | "joined"
  | "billing";

export interface GoLiveItem {
  key: GoLiveKey;
  label: string;
  /** What the records say, in one line. */
  detail: string;
  done: boolean;
  /** Not done yet, and it is time to worry. */
  urgent?: boolean;
  href: string;
  /** The verb on the link. */
  action: string;
}

export interface GoLive {
  items: GoLiveItem[];
  done: number;
  total: number;
  /** Money can move: roster, dues, Stripe and a scheduled bill. */
  canCollect: boolean;
  allDone: boolean;
}

/**
 * Whether the association has a card on file, and where the free days stand.
 *
 * Read by the setup list as well, which is why it is a function of its own:
 * the list shows this one row of what used to be the go-live checklist.
 */
export function billingStatus(community: Community, today: ISODate) {
  const a = community.association;
  const phase = a.trialEndsOn
    ? billingPhase(
        {
          status: a.subscriptionStatus ?? "trialing",
          trialEndsOn: a.trialEndsOn,
          homes: homeCount(community),
          hasSubscription: Boolean(a.billing?.subscriptionId),
        },
        today,
      )
    : null;
  const done = phase?.phase === "active" || Boolean(a.billing?.subscriptionId);
  const detail = done
    ? a.billing?.last4
      ? `${a.billing.brand ?? "Card"} ••${a.billing.last4} on file`
      : "Subscription active"
    : phase?.phase === "trialing"
      ? `Free until ${formatDate(phase.endsOn, "long")}, ${phase.daysLeft} days left`
      : phase?.phase === "ended"
        ? `The free days ended ${formatDate(phase.endsOn, "long")}`
        : "The free period starts when you create the association";
  const urgent = !done && (phase?.phase === "ended" || (phase?.phase === "trialing" && phase.closing));
  return { phase, done, detail, urgent: Boolean(urgent) };
}

/** The label an opening balance carries on a statement. */
export const OPENING_LINE = /brought forward/i;
const DUES = /dues/i;

export function goLiveChecklist(community: Community, today: ISODate): GoLive {
  const a = community.association;
  const homes = community.homes;
  const president = homes.find((o) => o.boardRole === "President");

  const otherHomes = homes.filter((o) => o.id !== president?.id);
  const named = otherHomes.filter((o) => !o.placeholder);
  const rosterDone = otherHomes.length > 0;

  const duesDone = a.duesCents > 0;

  const stripeDone = Boolean(a.stripeChargesEnabled);

  const issued = Object.values(community.homeCharges).some((lines) =>
    lines.some((l) => l.kind === "charge" && DUES.test(l.label) && !OPENING_LINE.test(l.label)),
  );
  const next = community.nextChargeDate;
  const scheduled = duesDone && Boolean(next) && next >= today;

  const reachable = named.filter((o) => o.email.trim());
  const invitesSent = community.emailLog.some((e) => e.category === "invite" && !e.error);
  const residents = community.accounts.filter((acct) => acct.role === "resident" || acct.homeId !== president?.id);
  const joined = residents.length > 0;
  const invitesDone = invitesSent || (reachable.length > 0 && reachable.every((o) => residents.some((r) => r.homeId === o.id)));

  const billing = billingStatus(community, today);
  const billingDone = billing.done;

  const items: GoLiveItem[] = [
    {
      key: "roster",
      label: "Homes added",
      detail: rosterDone
        ? `${homes.length} homes listed, ${named.length} with an owner named`
        : "Only your own home is listed",
      done: rosterDone,
      href: "/board/homeowners/import",
      action: rosterDone ? "Add more" : "Import a spreadsheet",
    },
    {
      key: "dues",
      label: "Dues and due day set",
      detail: duesDone
        ? `Every home is billed ${a.duesCadence}`
        : "No amount yet, so nothing can be billed",
      done: duesDone,
      href: "/board/settings",
      action: duesDone ? "Change" : "Set dues",
    },
    {
      key: "stripe",
      label: "Online payments on",
      detail: stripeDone
        ? a.stripePayout
          ? `Cards and bank payments settle to ${a.stripePayout.bank} ••${a.stripePayout.last4}`
          : "Cards and bank payments settle to the association"
        : a.stripeAccountId
          ? "Started, not finished. Stripe still needs something from the treasurer"
          : "Owners cannot pay online until online payments are approved",
      done: stripeDone,
      href: "/board/settings#money",
      action: a.stripeAccountId ? "Finish setting up online payments" : "Set up online payments",
    },
    {
      key: "first-bill",
      label: "First bill scheduled",
      detail: issued
        ? `Dues have been billed. Next bill ${formatDate(next, "long")}`
        : scheduled
          ? `First bill goes out ${formatDate(next, "long")}. Anything owed before that sits in the opening balances`
          : "No bill on the calendar",
      done: issued || scheduled,
      href: "/board/money",
      action: "Open Finances",
    },
    {
      key: "invites",
      label: "Invitations sent",
      detail: invitesDone
        ? invitesSent
          ? `${community.emailLog.filter((e) => e.category === "invite" && !e.error).length} invitation emails sent`
          : "Every owner with an email has signed in"
        : reachable.length
          ? `${reachable.length} ${reachable.length === 1 ? "owner has" : "owners have"} an email and no invitation yet`
          : "No owner has an email address yet",
      done: invitesDone,
      href: "/board/homeowners",
      action: reachable.length ? "Invite" : "Add emails",
    },
    {
      key: "joined",
      label: "A resident signed in",
      detail: joined
        ? `${residents.length} ${residents.length === 1 ? "resident has" : "residents have"} an account`
        : "Nobody but you has signed in yet",
      done: joined,
      href: "/board/homeowners",
      action: "See who is waiting",
    },
    {
      key: "billing",
      label: "Card on file before the trial ends",
      detail: billing.detail,
      done: billingDone,
      urgent: billing.urgent,
      href: "/board/settings#money",
      action: "Add a card",
    },
  ];

  const done = items.filter((i) => i.done).length;
  const collect = ["roster", "dues", "stripe", "first-bill"] as GoLiveKey[];
  return {
    items,
    done,
    total: items.length,
    canCollect: items.filter((i) => collect.includes(i.key)).every((i) => i.done),
    allDone: done === items.length,
  };
}
