import type { Community } from "@/lib/data/community";
import type { LedgerCategory } from "@/lib/types";
import { complianceRegister } from "@/lib/compliance";
import { daysFromToday } from "@/lib/utils";

/**
 * Derived figures, as pure functions of one community.
 *
 * Nothing here is stored. Collection rate, percent funded, budget pace, and
 * the rest are all computed from the underlying records every time, so the
 * number on a summary tile cannot drift from the number on the detail screen.
 *
 * Taking the community as an argument rather than importing fixtures is what
 * makes a second association possible, and is also exactly the shape these
 * become once the data comes from a server.
 */

export function cashPosition(c: Community) {
  const operating = c.bankAccounts
    .filter((a) => a.kind === "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const reserve = c.bankAccounts
    .filter((a) => a.kind !== "operating")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  return { operating, reserve, total: operating + reserve };
}

export function delinquency(c: Community) {
  const past = c.owners.filter((o) => o.daysPastDue > 0);
  const billed = c.owners.length || 1;
  return {
    past,
    totalCents: past.reduce((sum, o) => sum + o.balanceCents, 0),
    byBucket: {
      grace: past.filter((o) => o.standing === "grace"),
      late: past.filter((o) => o.standing === "late"),
      collections: past.filter((o) => o.standing === "collections"),
    },
    collectionRate: (billed - past.length) / billed,
    autopayRate: c.owners.filter((o) => o.autopay).length / billed,
  };
}

export function budgetSummary(c: Community) {
  const income = c.budget.filter((b) => b.kind === "income");
  const expense = c.budget.filter((b) => b.kind === "expense");
  const sum = (rows: typeof c.budget, key: "annualCents" | "ytdActualCents") =>
    rows.reduce((total, r) => total + r[key], 0);
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
    /**
     * Share of budget spent or collected, or undefined when there is no budget
     * to measure against. A new association has an income line and no expense
     * lines, and dividing by that zero printed "NaN% of budget".
     */
    incomePace: sum(income, "annualCents") > 0 ? incomeYtd / sum(income, "annualCents") : undefined,
    expensePace:
      sum(expense, "annualCents") > 0 ? expenseYtd / sum(expense, "annualCents") : undefined,
    netAnnual: sum(income, "annualCents") - sum(expense, "annualCents"),
    yearElapsed: c.yearElapsed,
  };
}

export function reserveSummary(c: Community) {
  const funded = c.reserveComponents.reduce((t, x) => t + x.fundedCents, 0);
  const required = c.reserveComponents.reduce((t, x) => t + x.replacementCostCents, 0);
  return {
    funded,
    required,
    // An association with no study is not fully funded, it is unmeasured.
    percentFunded: required === 0 ? 0 : funded / required,
    hasStudy: c.reserveComponents.length > 0,
    urgent: c.reserveComponents
      .filter((x) => x.remainingLifeYears <= 3)
      .sort((a, b) => a.remainingLifeYears - b.remainingLifeYears),
  };
}

/** The calendar years the ledger touches, newest first, for the chart filter. */
export function ledgerYears(c: Community): number[] {
  const years = new Set<number>();
  for (const e of c.ledger) years.add(Number(e.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/**
 * Money in and money out of the association, one row per month of the given
 * calendar year, January through December.
 *
 * Reserve transfers are excluded from both sides: moving cash between the
 * association's own accounts is neither income nor spending, and counting it
 * would inflate every month a board does the responsible thing.
 *
 * Figures, not pixels, so the same rows can back a chart and a CSV.
 */
export function monthlyFlows(c: Community, year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    inCents: 0,
    outCents: 0,
  }));
  for (const e of c.ledger) {
    if (e.category === "Reserve transfer") continue;
    if (Number(e.date.slice(0, 4)) !== year) continue;
    const row = months[Number(e.date.slice(5, 7)) - 1];
    if (e.amountCents >= 0) row.inCents += e.amountCents;
    else row.outCents += -e.amountCents;
  }
  return months;
}

/**
 * Where the association's money went in the given year, largest first.
 *
 * The top five categories keep their own line; everything after folds into
 * "Other", because a sixth slice is where a donut stops being readable.
 * Money moved into reserves is shown as its own category, "Reserve
 * contributions", counting only the operating side of the transfer so the
 * receiving entry cannot double it.
 */
export function spendingByCategory(c: Community, year: number) {
  const totals = new Map<string, number>();
  for (const e of c.ledger) {
    if (e.amountCents >= 0) continue;
    if (Number(e.date.slice(0, 4)) !== year) continue;
    const label: LedgerCategory | "Reserve contributions" =
      e.category === "Reserve transfer" ? "Reserve contributions" : e.category;
    totals.set(label, (totals.get(label) ?? 0) - e.amountCents);
  }
  const sorted = [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents);
  const top = sorted.slice(0, 5);
  const otherCents = sorted.slice(5).reduce((t, r) => t + r.cents, 0);
  const rows = otherCents > 0 ? [...top, { category: "Other", cents: otherCents }] : top;
  const totalCents = rows.reduce((t, r) => t + r.cents, 0);
  return {
    rows: rows.map((r) => ({ ...r, share: totalCents ? r.cents / totalCents : 0 })),
    totalCents,
  };
}

export function interestSummary(c: Community) {
  const reserveAccounts = c.bankAccounts.filter((a) => a.kind !== "operating");
  const balance = reserveAccounts.reduce((t, a) => t + a.balanceCents, 0);
  const earnedYtd = c.bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0);
  const blendedApy = balance
    ? reserveAccounts.reduce((t, a) => t + a.apy * a.balanceCents, 0) / balance
    : 0;
  return {
    reserveAccounts,
    balance,
    earnedYtd,
    blendedApy,
    projectedAnnual: Math.round((balance * blendedApy) / 100),
  };
}

/**
 * Balance sitting above deposit insurance at a single institution.
 *
 * This matters more now that reserve cash lives in one savings account rather
 * than being spread across a CD and a sweep. A single account holding several
 * hundred thousand dollars is the normal shape for a funded association, and
 * the coverage limit is per depositor per bank, so the excess is genuinely at
 * risk rather than a technicality.
 */
export function insuranceExposure(c: Community) {
  const byInstitution = new Map<string, { balance: number; limit: number }>();
  for (const a of c.bankAccounts) {
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


/**
 * The badge on the nav, from the same source as the screen behind it.
 *
 * This used to count a hand written fixture while the register counted
 * something else, which is the exact drift this product is positioned
 * against: two surfaces disagreeing about one number. Both now derive from
 * `complianceRegister`.
 */
export function complianceSummary(c: Community) {
  const register = complianceRegister(c);
  return {
    overdue: register.overdue,
    dueSoon: register.dueSoon,
    nextDeadline: register.next,
    // What the badge shows: things a board has a date on and has not passed.
    openCount: register.overdue.length + register.dueSoon.length,
    total: register.items.length,
  };
}

export function payoutSpeed(c: Community) {
  const byMethod = (m: "ach" | "check") => {
    const rows = c.payouts.filter((p) => p.method === m);
    if (!rows.length) return 0;
    return (
      rows.reduce(
        (t, p) => t + (daysFromToday(p.expectedDate) - daysFromToday(p.issuedDate)),
        0,
      ) / rows.length
    );
  };
  return { ach: byMethod("ach"), check: byMethod("check") };
}

export function vendorGaps(c: Community) {
  return {
    missingW9: c.vendors.filter((v) => !v.w9OnFile),
    noAch: c.vendors.filter((v) => !v.achEnabled),
    expiringCoi: c.vendors.filter(
      (v) => v.coiExpires && daysFromToday(v.coiExpires) < 60 && daysFromToday(v.coiExpires) >= 0,
    ),
  };
}

export type CalendarKind =
  | "meeting"
  | "event"
  | "ballot-opens"
  | "ballot-closes"
  | "deadline";

/** Everything dated that a resident might want on a calendar. */
export function calendarEntries(c: Community) {
  const rows: {
    id: string;
    date: string;
    title: string;
    detail?: string;
    kind: CalendarKind;
    href?: string;
  }[] = [];

  for (const m of c.meetings) {
    rows.push({
      id: `cal-${m.id}`,
      date: m.date,
      title: m.title,
      detail: `${m.time} · ${m.location}`,
      kind: "meeting",
      href: "/resident/vote",
    });
  }
  for (const b of c.ballots) {
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

/**
 * Owner correspondence, measured from the threads themselves.
 *
 * Every figure here used to be a literal on the screen, which meant a brand new
 * association with five households and no messages was told it had delivered 88
 * of them. A number nobody can trace is worse than no number.
 */
export function communicationsSummary(c: Community) {
  const threads = c.threads;
  const messages = threads.flatMap((t) => t.messages);
  const outbound = messages.filter((m) => m.direction === "outbound");

  // Board reply time: for each inbound message, how long until the next
  // outbound one in the same thread.
  const gaps: number[] = [];
  for (const thread of threads) {
    const ordered = [...thread.messages].sort((a, b) => (a.at < b.at ? -1 : 1));
    for (let i = 0; i < ordered.length - 1; i++) {
      if (ordered[i].direction !== "inbound") continue;
      const reply = ordered.slice(i + 1).find((m) => m.direction === "outbound");
      if (!reply) continue;
      gaps.push(daysBetween(ordered[i].at, reply.at));
      break;
    }
  }

  return {
    threadCount: threads.length,
    unread: threads.filter((t) => t.unread).length,
    sent: outbound.length,
    /** Households we hold an email for, which is who a notice can actually reach. */
    reachable: c.owners.filter((o) => o.email.trim().length > 0).length,
    households: c.owners.length,
    /** Undefined when nothing has been answered yet, rather than zero. */
    avgReplyDays: gaps.length
      ? Math.round((gaps.reduce((t, g) => t + g, 0) / gaps.length) * 10) / 10
      : undefined,
  };
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * The association's own slug, for record URLs and export filenames.
 *
 * Derived from the display name rather than the community id, because the id
 * carries a disambiguating suffix that nobody should see in a filename.
 */
export function communitySlug(c: Community): string {
  return (
    c.settings.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "association"
  );
}

/** Where an association publishes the records it has to make available. */
export function publicRecordsUrl(c: Community): string {
  return `${communitySlug(c).replace(/-/g, "")}.hoasis.app/records`;
}

/* -------------------------------------------------------------------------- */
/* Shared costs: what the association pays on everyone's behalf.               */
/* -------------------------------------------------------------------------- */

/**
 * The most recent bill for each active shared cost, with its trend.
 *
 * `changeYearOverYear` compares against the same month a year earlier rather
 * than last month, because every utility is seasonal and a December to January
 * comparison says nothing. A board that sees "water is up 6% on last July"
 * knows whether to look for a leak; "water is up 40% on January" is just
 * summer.
 */
export function sharedCostSummary(c: Community) {
  const active = c.sharedCosts.filter((s) => s.active);

  const rows = active.map((cost) => {
    const bills = c.sharedCostBills
      .filter((b) => b.sharedCostId === cost.id)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const latest = bills.at(-1);
    const yearAgo = bills.at(-13);
    const trailingYear = bills.slice(-12).reduce((t, b) => t + b.totalCents, 0);

    return {
      cost,
      bills,
      latest,
      trailingYearCents: trailingYear,
      /** What one home paid over the last twelve months, on average. */
      perHomeYearCents: latest?.homes ? Math.round(trailingYear / latest.homes) : 0,
      changeYearOverYear:
        latest && yearAgo && yearAgo.totalCents > 0
          ? (latest.totalCents - yearAgo.totalCents) / yearAgo.totalCents
          : undefined,
    };
  });

  const monthlyCents = rows.reduce((t, r) => t + (r.latest?.totalCents ?? 0), 0);
  const homes = rows[0]?.latest?.homes ?? c.owners.length;

  return {
    rows,
    enabled: active.length > 0,
    monthlyCents,
    /** What the average home pays a month for everything the association passes on. */
    perHomeMonthlyCents: homes ? Math.round(monthlyCents / homes) : 0,
    trailingYearCents: rows.reduce((t, r) => t + r.trailingYearCents, 0),
  };
}

/**
 * Every month of one shared cost, oldest first, for a chart.
 *
 * Returns the figures rather than pixels so the same numbers can be exported to
 * CSV, which is what a treasurer actually wants at budget time.
 */
export function sharedCostTrend(c: Community, sharedCostId: string) {
  const cost = c.sharedCosts.find((s) => s.id === sharedCostId);
  const bills = c.sharedCostBills
    .filter((b) => b.sharedCostId === sharedCostId)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const peak = bills.reduce((m, b) => Math.max(m, b.totalCents), 0);
  return { cost, bills, peakCents: peak };
}

/* -------------------------------------------------------------------------- */
/* Special assessments: the ones that end.                                     */
/* -------------------------------------------------------------------------- */

export function assessmentProgress(c: Community) {
  const rows = c.specialAssessments.map((a) => {
    const collected = Math.min(a.collectedCents, a.totalCents);
    const remaining = a.totalCents - collected;
    const paidInstallments = a.totalCents
      ? Math.floor((collected / a.totalCents) * a.installments)
      : 0;
    return {
      assessment: a,
      collectedCents: collected,
      remainingCents: remaining,
      percent: a.totalCents ? collected / a.totalCents : 0,
      installmentsPaid: paidInstallments,
      installmentsLeft: Math.max(0, a.installments - paidInstallments),
      /** What one home still owes on it, on average. Buyers ask this. */
      perHomeRemainingCents: c.owners.length
        ? Math.round(remaining / c.owners.length)
        : remaining,
    };
  });
  return {
    rows,
    active: rows.filter((r) => r.assessment.status === "active"),
    /** Nothing to show, which is the state most associations are in. */
    enabled: rows.length > 0,
    outstandingCents: rows.reduce((t, r) => t + r.remainingCents, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Records: what is on file, and what is not.                                  */
/* -------------------------------------------------------------------------- */

/**
 * The records an association is expected to hold, whatever state it is in.
 *
 * Every state's records statute is worded differently and most enumerate more
 * than this. These are the ones that appear on essentially every list, that a
 * buyer's lender asks for by name, and that an owner is entitled to inspect.
 * Anything state specific belongs in the compliance register, which cites its
 * own statute; this is the floor.
 */
const EXPECTED_RECORDS = [
  {
    key: "declaration",
    label: "Declaration or CC&Rs",
    match: /declaration|cc&r|covenant/i,
    why: "The recorded document that creates the association. Every closing needs it.",
  },
  {
    key: "bylaws",
    label: "Bylaws",
    match: /bylaw/i,
    why: "How the association governs itself. An owner disputing a fine will ask for this first.",
  },
  {
    key: "articles",
    label: "Articles of Incorporation",
    match: /articles of incorporation/i,
    why: "Proof the association exists as a corporation. A bank asks for it to open an account.",
  },
  {
    key: "rules",
    label: "Rules and Regulations",
    match: /rules|regulation/i,
    why: "A fine for breaking a rule that is not written down does not survive a challenge.",
  },
  {
    key: "budget",
    label: "Current adopted budget",
    match: /budget/i,
    why: "Owners are entitled to it, and most states require it be delivered before the year starts.",
  },
  {
    key: "financials",
    label: "Most recent financial statements",
    match: /financial statement|balance sheet|income statement/i,
    why: "The annual figures owners can inspect. Lenders ask for the last two years.",
  },
  {
    key: "reserve",
    label: "Reserve study",
    match: /reserve stud/i,
    why: "Several states require one, and a buyer's lender uses it to judge the association.",
  },
  {
    key: "insurance",
    label: "Insurance certificate",
    match: /insurance|certificate of coverage|policy/i,
    why: "Owners need it for their own HO-6 policy, and it is requested at every closing.",
  },
  {
    key: "minutes",
    label: "Meeting minutes",
    match: /minutes/i,
    why: "The record of what the board decided. Usually the most requested document there is.",
  },
] as const;

/**
 * Which expected records are on file, and which are not.
 *
 * The old summary counted documents, which told a board nothing they could act
 * on. What a board can act on is the gap, so the gap is what this returns.
 */
export function recordsGaps(c: Community) {
  const names = c.documents.map((d) => d.name);
  const rows = EXPECTED_RECORDS.map((record) => ({
    ...record,
    onFile: names.some((name) => record.match.test(name)),
  }));
  const missing = rows.filter((r) => !r.onFile);
  return {
    rows,
    missing,
    onFileCount: rows.length - missing.length,
    total: rows.length,
    /** Nothing missing, which is worth saying plainly rather than not saying. */
    complete: missing.length === 0,
  };
}
