/**
 * The raw rows a records export reads, and how the demo builds them.
 *
 * Every screen in this product reads a `Community` bundle, and the export
 * reads the same one, but three of its areas cannot come from the bundle:
 * a real association loads a window of statement and ledger lines, three
 * hundred email rows and a hundred activity rows, while a records request
 * asks for all of them. So the export has its own row types, the demo fills
 * them from the fixtures and a signed-in person fills them with paged reads
 * under row level security (`loadAnnualRecords`, `loadCompleteRecords`).
 *
 * Keeping the types here, plain and serializable, is what lets the file
 * builders in `annual.ts` and `complete.ts` work without knowing which of
 * the two worlds supplied the rows.
 */

import type { Community } from "@/lib/data/community";
import { CAPABILITY_LABEL } from "@/lib/data/accounts";
import { HOME_TYPE_LABEL } from "@/lib/home-types";
import type {
  Activity,
  Capability,
  EmailLogEntry,
  LedgerEntry,
  SpecialAssessment,
} from "@/lib/types";

/** One line of a home's statement, as the `charges` table holds it. */
export interface StatementLineRow {
  homeId: string;
  /** The day the line falls due, which is the day the statement shows. */
  date: string;
  label: string;
  kind: "charge" | "payment" | "credit";
  /** The database's own name for the line: "dues", "late_fee" and so on. */
  category?: string;
  /** Positive for a charge, negative for a payment or a credit. Cents. */
  amountCents: number;
}

/** One online payment as the `payments` table holds it, settlement and all. */
export interface OnlinePaymentRow {
  homeId: string;
  amountCents: number;
  processorFeeCents: number;
  platformFeeCents: number;
  /** What was given back, where the association refunded part of it. */
  refundedCents: number;
  rail: string;
  state: string;
  createdAt: string;
  settledAt?: string;
}

/** One home on the register, retired homes included. */
interface HomeRecord {
  id: string;
  unit: string;
  address: string;
  /** Detached, townhome or condo, where the association has said. */
  homeType?: string;
  /** This home's own regular assessment, where it differs. Cents. */
  duesCents?: number;
  /** Set the day the home stopped being a home (0099). Its records stay. */
  retiredOn?: string;
}

/** One person's seat on a home, past seats included. */
interface SeatRecord {
  homeId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  /** The areas the seat may change and may see, as words. */
  access: string;
  startsOn: string;
  endsOn?: string;
}

/** What a fiscal or calendar window of the export reads. */
export interface YearRecords {
  /** Every home's label by id, so a retired home's lines can name it. */
  labels: Map<string, string>;
  statement: StatementLineRow[];
  ledger: LedgerEntry[];
  emailLog: EmailLogEntry[];
  activity: Activity[];
}

/** Everything a complete export reads on top of the year's collections. */
export interface CompleteRecords extends YearRecords {
  homes: HomeRecord[];
  seats: SeatRecord[];
  onlinePayments: OnlinePaymentRow[];
  specialAssessments: SpecialAssessment[];
}

/** A window of days, `from` and `to` included. */
export interface RecordsWindow {
  from: string;
  to: string;
}

/** True for a date, or the day of a full timestamp, inside the window. */
export function inWindow(day: string, window: RecordsWindow): boolean {
  const iso = day.slice(0, 10);
  return iso >= window.from && iso <= window.to;
}

/**
 * The demo's rows for a window. The fixtures hold every line, so a window
 * is a filter; nothing is capped and nothing needs fetching.
 */
export function yearRecordsFromCommunity(c: Community, window: RecordsWindow): YearRecords {
  const labels = new Map(c.homes.map((h) => [h.id, h.unit]));
  // homeCharges is keyed by the home's id, so each flattened row carries it.
  const statement: StatementLineRow[] = [];
  for (const [homeId, lines] of Object.entries(c.homeCharges)) {
    for (const line of lines) {
      if (!inWindow(line.date, window)) continue;
      statement.push({
        homeId,
        date: line.date,
        label: line.label,
        kind: line.kind,
        ...(line.category ? { category: line.category } : {}),
        amountCents: line.amountCents,
      });
    }
  }
  return {
    labels,
    statement,
    ledger: c.ledger.filter((e) => inWindow(e.date, window)),
    emailLog: c.emailLog.filter((e) => inWindow(e.sentAt, window)),
    activity: (c.activity ?? []).filter((a) => inWindow(a.at, window)),
  };
}

/** The areas a seat holds, as the access grid's own words. */
export function accessWords(seat: { capabilities: string[]; views: string[] }): string {
  const word = (c: string) => CAPABILITY_LABEL[c as Capability] ?? c;
  const words = [...seat.capabilities, ...seat.views].map(word).filter(Boolean);
  return words.length ? [...new Set(words)].join(", ") : "None";
}

/**
 * The demo's rows for a complete export. The fixtures carry every record as
 * statement lines, so there is nothing to page: the file builders get the
 * whole of what the demo association owns.
 */
export function completeRecordsFromCommunity(c: Community): CompleteRecords {
  const seats: SeatRecord[] = [];
  for (const account of c.accounts) {
    const home = c.homes.find((h) => h.id === account.homeId);
    seats.push({
      homeId: account.homeId,
      name: account.name,
      email: account.email,
      ...(home?.phone ? { phone: home.phone } : {}),
      role: account.role,
      access: accessWords({
        capabilities: Object.entries(account.capabilities)
          .filter(([, on]) => on)
          .map(([name]) => name),
        views: Object.entries(account.views)
          .filter(([, on]) => on)
          .map(([name]) => name),
      }),
      startsOn: home?.moveInDate ?? "",
    });
  }
  // A seat that ended is the home's previous owner, and a records request is
  // exactly the person who asks who held the home when.
  for (const home of c.homes) {
    for (const past of home.previousOwners ?? []) {
      seats.push({
        homeId: home.id,
        name: past.name,
        email: "",
        role: "resident",
        access: "None",
        startsOn: past.from,
        endsOn: past.to,
      });
    }
  }
  return {
    labels: new Map(c.homes.map((h) => [h.id, h.unit])),
    homes: c.homes.map((h) => ({
      id: h.id,
      unit: h.unit,
      address: h.address,
      ...(h.homeType ? { homeType: HOME_TYPE_LABEL[h.homeType].short } : {}),
      ...(h.duesCents !== undefined ? { duesCents: h.duesCents } : {}),
    })),
    seats,
    statement: yearRecordsFromCommunity(c, EVERYTHING).statement,
    onlinePayments: (c.pendingPayments ?? []).map((p) => ({
      homeId: p.unitId,
      amountCents: p.amountCents,
      processorFeeCents: 0,
      platformFeeCents: 0,
      // The fixtures hold no refunds: a demo payment is in flight or failed.
      refundedCents: 0,
      rail: p.rail,
      state: p.state,
      createdAt: p.createdAt,
    })),
    ledger: c.ledger,
    emailLog: c.emailLog,
    activity: c.activity ?? [],
    specialAssessments: c.specialAssessments,
  };
}

/** The window that holds every day, for an export that is not scoped to one. */
const EVERYTHING: RecordsWindow = { from: "0000-01-01", to: "9999-12-31" };
