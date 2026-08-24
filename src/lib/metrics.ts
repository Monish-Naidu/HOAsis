import type { Community } from "@/lib/data/community";
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

/** Balance sitting above deposit insurance at a single institution. */
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

export function yieldOpportunity(c: Community) {
  const { balance, blendedApy } = interestSummary(c);
  const recommended = c.savingsOffers.find((o) => o.recommended) ?? c.savingsOffers[0];
  const current = c.bankAccounts.find((a) => a.kind === "reserve");
  const movable = c.bankAccounts
    .filter((a) => a.kind === "reserve")
    .reduce((t, a) => t + a.balanceCents, 0);
  const gainAnnual = recommended
    ? Math.round((movable * (recommended.apy - (current?.apy ?? 0))) / 100)
    : 0;
  return { balance, blendedApy, recommended, offers: c.savingsOffers, movable, gainAnnual, current };
}

export function complianceSummary(c: Community) {
  const overdue = c.complianceItems.filter((x) => x.status === "overdue");
  const dueSoon = c.complianceItems.filter((x) => x.status === "due-soon");
  const inProgress = c.complianceItems.filter((x) => x.status === "in-progress");
  const compliant = c.complianceItems.filter((x) => x.status === "compliant");
  return {
    overdue,
    dueSoon,
    inProgress,
    compliant,
    // "Next" means the soonest deadline still ahead. Anything past is overdue.
    nextDeadline: [...c.complianceItems]
      .filter((x) => x.dueDate && x.status !== "compliant" && daysFromToday(x.dueDate) >= 0)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0],
    openCount: overdue.length + dueSoon.length + inProgress.length,
    score: c.complianceItems.length ? compliant.length / c.complianceItems.length : 1,
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
