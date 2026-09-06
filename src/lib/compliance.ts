import type { Community } from "@/lib/data/community";
import type { StateCode } from "@/lib/data/library";
import {
  CITED_STATES,
  GENERAL_OBLIGATIONS,
  STATE_OBLIGATIONS,
  type Obligation,
} from "@/lib/data/obligations";
import type { ComplianceStatus } from "@/lib/types";
import { addDays, daysFromToday } from "@/lib/utils";

/**
 * The compliance register, derived rather than hand written.
 *
 * The old one was a fixture with chapter level citations and a note saying not
 * to deepen it without a legal pass. That note was right, and the register it
 * guarded was worth very little: a list of plausible obligations with dates
 * somebody typed. This version reads from `src/lib/data/obligations.ts`, where
 * every cited row traces to a library article that carries its own sources.
 *
 * The line it holds is the same one the governing documents decision draws.
 * **We compute deadlines and we do not judge compliance.** A due date is
 * arithmetic on a fiscal year and a cadence, and it is either passed or it is
 * not. Whether the association actually met an obligation is something a board
 * marks, because we cannot see the filed report, and a register that guessed
 * would be telling a board it was safe on the strength of nothing.
 *
 * Coverage is stated rather than implied. Four states have obligations written
 * with their own citations; the rest get the general list, which carries a
 * cadence and no statute, and the screen says which it is looking at.
 */

export interface RegisterItem {
  key: string;
  label: string;
  evidence: string;
  citation?: string;
  /** True when the row came from that state's own researched article. */
  cited: boolean;
  cadence: Obligation["cadence"];
  dueDate?: string;
  daysUntil?: number;
  status: ComplianceStatus;
  clockDays?: number;
  article?: string;
  href?: string;
  /** Binds from the association's first day rather than from its first year. */
  fromDayOne: boolean;
  /** The day the board marked it done, when the mark still covers this due date. */
  doneOn?: string;
}

export interface ComplianceRegister {
  state: string;
  /** Whether this state's obligations carry their own citations yet. */
  cited: boolean;
  items: RegisterItem[];
  overdue: RegisterItem[];
  dueSoon: RegisterItem[];
  /** The soonest thing with a date on it. */
  next?: RegisterItem;
  /** For a community that has only just been founded. */
  dayOne: RegisterItem[];
}

/** The month a fiscal year starts, from "MM-DD". */
function fiscalStartMonth(community: Community): number {
  const [month] = community.association.fiscalYearStart.split("-").map(Number);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1;
}

/**
 * When an obligation next falls due.
 *
 * Annual duties land at the end of the fiscal year unless the statute pins a
 * month, budgets land before the year starts, and anything measured in days
 * from a request has no date at all until somebody asks. Returning undefined
 * for that last case is the point: a made up date on a records request would
 * be a deadline nobody actually has.
 */
function nextDue(obligation: Obligation, community: Community): string | undefined {
  if (obligation.cadence === "on-request" || obligation.cadence === "ongoing") return undefined;

  const [year] = community.asOf.split("-").map(Number);
  const startMonth = fiscalStartMonth(community);

  // A budget has to be with owners before the year it covers begins, so it
  // falls due in the month before the fiscal year starts.
  const month =
    obligation.dueMonth ??
    (obligation.cadence === "each-budget"
      ? ((startMonth + 10) % 12) + 1
      : ((startMonth + 10) % 12) + 1);

  const candidate = `${year}-${String(month).padStart(2, "0")}-28`;
  // If this year's date has already gone, the duty is next year's.
  return candidate < community.asOf
    ? `${year + 1}-${String(month).padStart(2, "0")}-28`
    : candidate;
}

function statusFor(dueDate: string | undefined, cadence: Obligation["cadence"]): ComplianceStatus {
  if (!dueDate) return cadence === "on-request" ? "compliant" : "in-progress";
  const days = daysFromToday(dueDate);
  if (days < 0) return "overdue";
  if (days <= 45) return "due-soon";
  return "in-progress";
}

/**
 * What this association owes, and when.
 *
 * State rows replace a general row of the same shape rather than sitting
 * alongside it, so a Washington board sees "RCW 23.95.255, due the month you
 * were formed in" instead of both that and a vaguer duplicate.
 */
export function complianceRegister(community: Community): ComplianceRegister {
  const code = community.association.state as StateCode;
  const stateRows = STATE_OBLIGATIONS[code] ?? [];
  const cited = CITED_STATES.includes(code);

  // A state row covering the same ground as a general one wins. Matching is by
  // the tail of the key, so "wa-records-response" replaces "records-response".
  const covered = new Set(stateRows.map((o) => o.key.replace(/^[a-z]{2}-/, "")));
  const general = GENERAL_OBLIGATIONS.filter((o) => !covered.has(o.key));

  // The board's own marks. A mark covers the due date it was made against:
  // anything inside the year (or three, for a triennial study) before it.
  const done = community.settings.complianceDone ?? {};
  const covers = (key: string, dueDate: string | undefined, cadence: Obligation["cadence"]) => {
    const on = done[key];
    if (!on) return undefined;
    if (!dueDate) return on;
    const window = cadence === "triennial" ? 3 * 365 : 365;
    return on > addDays(dueDate, -window) && on <= dueDate ? on : undefined;
  };

  const items: RegisterItem[] = [...stateRows, ...general].map((obligation) => {
    const dueDate = nextDue(obligation, community);
    const doneOn = covers(obligation.key, dueDate, obligation.cadence);
    return {
      key: obligation.key,
      label: obligation.label,
      evidence: obligation.evidence,
      citation: obligation.citation,
      cited: Boolean(obligation.citation),
      cadence: obligation.cadence,
      dueDate,
      daysUntil: dueDate ? daysFromToday(dueDate) : undefined,
      status: doneOn ? "compliant" : statusFor(dueDate, obligation.cadence),
      clockDays: obligation.clockDays,
      article: obligation.article,
      href: obligation.href,
      fromDayOne: Boolean(obligation.fromDayOne),
      doneOn,
    };
  });

  // The master policy, when Settings knows its renewal date. Lapsed cover is
  // the one deadline every director is personally exposed on, so it sits in
  // the same list as the state's paperwork rather than on its own screen.
  const renewal = community.association.insuranceExpiresOn;
  if (renewal) {
    const doneOn = covers("insurance-renewal", renewal, "annual");
    items.unshift({
      key: "insurance-renewal",
      label: "Renew the master insurance policy",
      evidence: `The renewed declarations page from ${community.association.insuranceCarrier || "the carrier"}, showing the new term.`,
      cited: false,
      cadence: "annual",
      dueDate: renewal,
      daysUntil: daysFromToday(renewal),
      status: doneOn ? "compliant" : statusFor(renewal, "annual"),
      href: "/board/settings#insurance",
      fromDayOne: false,
      doneOn,
    });
  }

  const dated = items.filter((i) => i.dueDate && i.status !== "compliant");

  return {
    state: community.association.stateName,
    cited,
    items,
    overdue: items.filter((i) => i.status === "overdue"),
    dueSoon: items.filter((i) => i.status === "due-soon"),
    next: [...dated].sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0],
    dayOne: items.filter((i) => i.fromDayOne),
  };
}
