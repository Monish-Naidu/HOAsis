/**
 * Repository layer.
 *
 * Screens import from here and nowhere else. Every function is async and
 * returns plain serializable data, so the day this moves to Supabase the
 * change is confined to this file.
 */

import { budget, YEAR_ELAPSED, type BudgetLine } from "./budget";
import {
  amenities,
  announcements,
  association,
  bankAccounts,
  events,
  reserveComponents,
  savingsOffers,
} from "./association";
import { complianceItems } from "./compliance";
import { documents } from "./documents";
import {
  ledgerEntries,
  ownerCharges,
  paymentMethods,
  payouts,
  vendors,
} from "./ledger";
import { threads } from "./messages";
import { accounts, accountById, CAPABILITY_LABEL, DEFAULT_ACCOUNT_ID, GRANTABLE, isAdmin, NO_CAPABILITIES } from "./accounts";
import { architecturalForms, communityAmenities, communitySettings } from "./settings";
import { forumCategories, forumPosts } from "./forum";
import { paymentInstruments, supportedInstitutions } from "./payments";
import { messageTemplates, renderTemplate, TEMPLATE_TOKENS } from "./templates";
import {
  articleBySlug,
  articlesForState,
  libraryArticles,
  LIBRARY_REDIRECTS,
  LIBRARY_TOPICS,
  STATES,
} from "./library";
import { ballots, meetings } from "./voting";
import { boardMembers, currentOwner, owners, CURRENT_OWNER_ID } from "./owners";
import { requests, violations } from "./requests";
import { daysFromToday } from "@/lib/utils";
import { NotFoundError } from "@/lib/core/errors";

export {
  accounts,
  accountById,
  amenities,
  architecturalForms,
  CAPABILITY_LABEL,
  communityAmenities,
  communitySettings,
  DEFAULT_ACCOUNT_ID,
  forumCategories,
  forumPosts,
  GRANTABLE,
  isAdmin,
  NO_CAPABILITIES,
  articleBySlug,
  articlesForState,
  libraryArticles,
  LIBRARY_REDIRECTS,
  LIBRARY_TOPICS,
  messageTemplates,
  paymentInstruments,
  renderTemplate,
  STATES,
  supportedInstitutions,
  TEMPLATE_TOKENS,
  announcements,
  association,
  bankAccounts,
  boardMembers,
  budget,
  complianceItems,
  CURRENT_OWNER_ID,
  currentOwner,
  documents,
  events,
  ledgerEntries,
  owners,
  ownerCharges,
  paymentMethods,
  payouts,
  requests,
  reserveComponents,
  savingsOffers,
  ballots,
  meetings,
  threads,
  vendors,
  violations,
  violations as allViolations,
  YEAR_ELAPSED,
};
export type { BudgetLine };

/* -------------------------------------------------------------------------- */
/* Indexes                                                                     */
/*                                                                             */
/* Built once at module load. Screens look records up by id on every render,   */
/* and a Map turns those repeated linear scans into constant time.             */
/* -------------------------------------------------------------------------- */

export const ownersById: ReadonlyMap<string, (typeof owners)[number]> = new Map(
  owners.map((owner) => [owner.id, owner]),
);

export const accountsById: ReadonlyMap<string, (typeof accounts)[number]> = new Map(
  accounts.map((account) => [account.id, account]),
);

export const requestsByReference: ReadonlyMap<string, (typeof requests)[number]> = new Map(
  requests.map((request) => [request.reference, request]),
);

export const ballotsById: ReadonlyMap<string, (typeof ballots)[number]> = new Map(
  ballots.map((ballot) => [ballot.id, ballot]),
);

/* -------------------------------------------------------------------------- */
/* Derived selectors. Computed, never hardcoded, so the numbers can't drift.   */
/* -------------------------------------------------------------------------- */

export function cashPosition() {
  const operating = bankAccounts
    .filter((a) => a.kind === "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const reserve = bankAccounts
    .filter((a) => a.kind !== "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  return { operating, reserve, total: operating + reserve };
}

export function reconciliation() {
  const needsReview = ledgerEntries.filter((e) => e.status === "needs-review");
  const pending = ledgerEntries.filter((e) => e.status === "pending");
  const cleared = ledgerEntries.filter((e) => e.status === "cleared");
  const duplicates = ledgerEntries.filter((e) => e.duplicateOfId);
  const staleFeeds = bankAccounts.filter((a) => a.status !== "live");
  return {
    needsReview,
    pending,
    cleared,
    duplicates,
    staleFeeds,
    /** The whole product promise: does every report draw from the same set? */
    tiesOut: needsReview.length === 0,
    lastSyncMinutes: Math.min(...bankAccounts.map((a) => a.syncedMinutesAgo)),
  };
}

export function delinquency() {
  const past = owners.filter((o) => o.daysPastDue > 0);
  const totalCents = past.reduce((sum, o) => sum + o.balanceCents, 0);
  const byBucket = {
    grace: past.filter((o) => o.standing === "grace"),
    late: past.filter((o) => o.standing === "late"),
    collections: past.filter((o) => o.standing === "collections"),
  };
  const billedThisMonth = owners.length;
  const currentCount = owners.length - past.length;
  return {
    past,
    totalCents,
    byBucket,
    /** Share of billed owners with nothing outstanding. */
    collectionRate: currentCount / billedThisMonth,
    autopayRate: owners.filter((o) => o.autopay).length / owners.length,
  };
}

export function budgetSummary() {
  const income = budget.filter((b) => b.kind === "income");
  const expense = budget.filter((b) => b.kind === "expense");
  const sum = (rows: BudgetLine[], key: "annualCents" | "ytdActualCents") =>
    rows.reduce((t, r) => t + r[key], 0);
  const incomeYtd = sum(income, "ytdActualCents");
  const expenseYtd = sum(expense, "ytdActualCents");
  return {
    income,
    expense,
    incomeAnnual: sum(income, "annualCents"),
    expenseAnnual: sum(expense, "annualCents"),
    incomeYtd,
    expenseYtd,
    netYtd: incomeYtd - expenseYtd,
    netAnnual: sum(income, "annualCents") - sum(expense, "annualCents"),
    yearElapsed: YEAR_ELAPSED,
  };
}

export function reserveSummary() {
  const funded = reserveComponents.reduce((t, c) => t + c.fundedCents, 0);
  const required = reserveComponents.reduce((t, c) => t + c.replacementCostCents, 0);
  const urgent = reserveComponents
    .filter((c) => c.remainingLifeYears <= 3)
    .sort((a, b) => a.remainingLifeYears - b.remainingLifeYears);
  return {
    funded,
    required,
    percentFunded: funded / required,
    urgent,
  };
}

/* -------------------------------------------------------------------------- */
/* Reserve cash: what it holds, what it earns, what it could earn.             */
/* -------------------------------------------------------------------------- */

export function interestSummary() {
  const reserveAccounts = bankAccounts.filter((a) => a.kind !== "operating");
  const balance = reserveAccounts.reduce((t, a) => t + a.balanceCents, 0);
  const earnedYtd = bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0);
  // Weighted average yield across reserve cash.
  const blendedApy = balance
    ? reserveAccounts.reduce((t, a) => t + a.apy * a.balanceCents, 0) / balance
    : 0;
  const projectedAnnual = Math.round((balance * blendedApy) / 100);
  return { reserveAccounts, balance, earnedYtd, blendedApy, projectedAnnual };
}

/** Balance sitting above deposit insurance at a single institution. */
export function insuranceExposure() {
  const byInstitution = new Map<string, { balance: number; limit: number }>();
  for (const a of bankAccounts) {
    const row = byInstitution.get(a.institution) ?? { balance: 0, limit: a.insuredLimitCents };
    row.balance += a.balanceCents;
    byInstitution.set(a.institution, row);
  }
  const rows = [...byInstitution.entries()].map(([institution, r]) => ({
    institution,
    balance: r.balance,
    limit: r.limit,
    uninsured: Math.max(0, r.balance - r.limit),
  }));
  return { rows, totalUninsured: rows.reduce((t, r) => t + r.uninsured, 0) };
}


export function complianceSummary() {
  const overdue = complianceItems.filter((c) => c.status === "overdue");
  const dueSoon = complianceItems.filter((c) => c.status === "due-soon");
  const inProgress = complianceItems.filter((c) => c.status === "in-progress");
  const compliant = complianceItems.filter((c) => c.status === "compliant");
  // "Next" means the soonest deadline still ahead of us. Anything already past
  // is counted as overdue, not as something upcoming.
  const nextDeadline = [...complianceItems]
    .filter((c) => c.dueDate && c.status !== "compliant" && daysFromToday(c.dueDate) >= 0)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
  return {
    overdue,
    dueSoon,
    inProgress,
    compliant,
    nextDeadline,
    openCount: overdue.length + dueSoon.length + inProgress.length,
    score: compliant.length / complianceItems.length,
  };
}

export function openRequests() {
  return requests.filter((r) => !["approved", "denied", "closed"].includes(r.status));
}

export function requestsForOwner(ownerId: string) {
  return requests
    .filter((r) => r.ownerId === ownerId)
    .sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1));
}

export function requestByReference(reference: string) {
  return requestsByReference.get(reference);
}

/** Requests with a statutory or bylaw clock, soonest first. */
export function requestsOnClock() {
  return requests
    .filter((r) => r.dueDate && !["approved", "denied", "closed"].includes(r.status))
    .map((r) => ({ ...r, daysLeft: daysFromToday(r.dueDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function ownerBalanceDue() {
  const next = ownerCharges.find((c) => c.kind === "charge" && daysFromToday(c.date) >= 0);
  return {
    balanceCents: currentOwner.balanceCents,
    nextChargeDate: next?.date,
    nextChargeCents: next?.amountCents ?? association.duesCents,
    autopay: currentOwner.autopay,
  };
}

/* -------------------------------------------------------------------------- */
/* Assistant context                                                           */
/*                                                                             */
/* A serializable snapshot the in-app assistant answers from. Every number it  */
/* can say comes from here, so it cannot invent one.                           */
/* -------------------------------------------------------------------------- */

export function assistantContext() {
  const due = ownerBalanceDue();
  const cash = cashPosition();
  const interest = interestSummary();
  const reserve = reserveSummary();
  const mine = requestsForOwner(CURRENT_OWNER_ID);
  const lastPayment = ownerCharges.find((c) => c.kind === "payment");
  const live = liveMeeting();

  return {
    owner: {
      name: currentOwner.members[0],
      unit: currentOwner.unit,
      balanceCents: due.balanceCents,
      nextChargeDate: due.nextChargeDate,
      standing: currentOwner.standing,
      daysPastDue: currentOwner.daysPastDue,
      autopay: currentOwner.autopay,
      lastPayment: lastPayment
        ? {
            date: lastPayment.date,
            amountCents: Math.abs(lastPayment.amountCents),
            method: lastPayment.method,
            appliedTo: lastPayment.appliedTo?.map((a) => a.label) ?? [],
          }
        : undefined,
    },
    association: {
      name: association.name,
      duesCents: association.duesCents,
      unitCount: association.unitCount,
      operatingCents: cash.operating,
      reserveCents: cash.reserve,
      interestYtdCents: interest.earnedYtd,
      blendedApy: interest.blendedApy,
      reservePercentFunded: reserve.percentFunded,
    },
    methods: paymentMethods.map((m) => ({
      label: m.label,
      kind: m.kind,
      feeCents: m.feeCents,
      feePercent: m.feePercent,
    })),
    meetings: upcomingMeetings().map((m) => ({
      title: m.title,
      date: m.date,
      time: m.time,
      location: m.location,
      dialIn: m.dialIn,
      status: m.status,
    })),
    liveMeeting: live ? { title: live.title, attendees: live.attendees.length } : undefined,
    events: events.map((e) => ({ title: e.title, date: e.date, time: e.time, location: e.location })),
    ballots: ballots
      .filter((b) => b.audience === "owners" && b.status === "open")
      .map((b) => ({
        title: b.title,
        closesDate: b.closesDate,
        voted: Boolean(b.myVoteOptionId),
      })),
    requests: mine.map((r) => ({
      reference: r.reference,
      title: r.title,
      status: r.status,
      submittedDate: r.submittedDate,
    })),
    documentCount: documents.filter((d) => d.visibility !== "board").length,
    amenities: amenities.map((a) => ({ name: a.name, status: a.status, detail: a.detail })),
  };
}

export type AssistantContext = ReturnType<typeof assistantContext>;

/** Everything dated that a resident might want on a calendar. */
export function calendarEntries() {
  const rows: {
    id: string;
    date: string;
    title: string;
    detail?: string;
    kind: "meeting" | "event" | "ballot-opens" | "ballot-closes" | "deadline";
    href?: string;
  }[] = [];

  for (const m of meetings) {
    rows.push({
      id: `cal-${m.id}`,
      date: m.date,
      title: m.title,
      detail: `${m.time} · ${m.location}`,
      kind: "meeting",
      href: "/resident/vote",
    });
  }
  for (const e of events) {
    // Meetings already come from the meeting records.
    if (e.kind === "meeting") continue;
    rows.push({
      id: `cal-${e.id}`,
      date: e.date,
      title: e.title,
      detail: `${e.time} · ${e.location}`,
      kind: e.kind === "deadline" ? "deadline" : "event",
    });
  }
  for (const b of ballots) {
    if (b.audience !== "owners") continue;
    if (b.status === "scheduled") {
      rows.push({
        id: `cal-${b.id}-open`,
        date: b.opensDate,
        title: b.title,
        detail: "Voting opens",
        kind: "ballot-opens",
        href: "/resident/vote",
      });
    }
    if (b.status === "open" || b.status === "scheduled") {
      rows.push({
        id: `cal-${b.id}-close`,
        date: b.closesDate,
        title: b.title,
        detail: "Last day to vote",
        kind: "ballot-closes",
        href: "/resident/vote",
      });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function publicDocuments() {
  return documents.filter((d) => d.visibility === "public");
}

export function unreadThreadCount() {
  return threads.filter((t) => t.unread).length;
}

export function vendorGaps() {
  return {
    missingW9: vendors.filter((v) => !v.w9OnFile),
    noAch: vendors.filter((v) => !v.achEnabled),
    expiringCoi: vendors.filter(
      (v) => v.coiExpires && daysFromToday(v.coiExpires) < 60 && daysFromToday(v.coiExpires) >= 0,
    ),
  };
}

export function payoutsAwaitingApproval() {
  return payouts.filter((p) => p.approvals.length < p.approvalsRequired);
}

/* -------------------------------------------------------------------------- */
/* Voting + meetings                                                           */
/* -------------------------------------------------------------------------- */

export function openBallots() {
  return ballots.filter((b) => b.status === "open");
}

export function ballotsForOwners() {
  return ballots.filter((b) => b.audience === "owners");
}

/** Turnout and approval, derived from the option tallies. */
export function ballotTally(ballotId: string) {
  const ballot = ballotsById.get(ballotId);
  if (!ballot) throw new NotFoundError("no such ballot", { ballotId });
  const cast = ballot.options.reduce((t, o) => t + o.votes, 0);
  const leading = [...ballot.options].sort((a, b) => b.votes - a.votes)[0];
  return {
    ballot,
    cast,
    turnout: ballot.eligible ? cast / ballot.eligible : 0,
    quorumMet: cast >= ballot.quorumRequired,
    quorumProgress: ballot.quorumRequired ? Math.min(1, cast / ballot.quorumRequired) : 1,
    leading,
    share: (optionVotes: number) => (cast ? optionVotes / cast : 0),
    /** Amendments need a share of ALL interests, not just those who voted. */
    shareOfEligible: (optionVotes: number) =>
      ballot.eligible ? optionVotes / ballot.eligible : 0,
    daysLeft: daysFromToday(ballot.closesDate),
  };
}

export function liveMeeting() {
  return meetings.find((m) => m.status === "live");
}

export function upcomingMeetings() {
  return meetings
    .filter((m) => m.status !== "ended")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function meetingById(id?: string) {
  return id ? meetings.find((m) => m.id === id) : undefined;
}

/** Ballots this resident can still act on. */
export function ballotsAwaitingMyVote() {
  return ballots.filter(
    (b) => b.audience === "owners" && b.status === "open" && !b.myVoteOptionId,
  );
}

/** Average days from invoice to funds landing, by rail. The vendor ACH pitch. */
export function payoutSpeed() {
  const byMethod = (m: "ach" | "check") => {
    const rows = payouts.filter((p) => p.method === m);
    if (!rows.length) return 0;
    const total = rows.reduce(
      (t, p) => t + (daysFromToday(p.expectedDate) - daysFromToday(p.issuedDate)),
      0,
    );
    return total / rows.length;
  };
  return { ach: byMethod("ach"), check: byMethod("check") };
}
