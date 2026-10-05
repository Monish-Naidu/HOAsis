import { placeLabel } from "@/lib/community-links";
import { yearElapsedFrom, type PreviousSetup } from "@/lib/data/new-community";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import type {
  Activity,
  Account,
  BoardTerm,
  Capability,
  ChargeLine,
  CommunityHistory,
  CommunitySettings,
  LedgerEntry,
  Owner,
  Payout,
} from "@/lib/types";
import { caps } from "./accounts";
import { architecturalForms } from "./settings";
import { messageTemplates } from "./templates";
import { fileTypeOf, fromDbVisibility, SIGNED_URL_SECONDS } from "@/lib/documents";
import { duesFor } from "@/lib/home-types";
import { compareStatement } from "@/lib/statement";
import { savedByCurrentMember } from "@/lib/stripe/saved-method-owner";
import { addDays, clockTime, nextDueOnOrAfter } from "@/lib/utils";

/**
 * Loading a real association out of Postgres.
 *
 * The shape returned here is the same `Community` bundle the fixtures produce,
 * which is what lets two dozen screens work against a database without any of
 * them knowing one exists. The seam was drawn for this.
 *
 * Every query runs as the signed in person, so row level security does the
 * scoping rather than a `where` clause we could forget. That has a pleasant
 * consequence: this one function returns a resident's view to a resident and a
 * treasurer's view to a treasurer, because the database returns different rows
 * to each of them. Nothing here branches on who is asking.
 *
 * Collections whose tables do not exist yet come back empty rather than being
 * filled with fixture data. An association that has never held a vote has no
 * ballots, and showing it somebody else's would be worse than showing none.
 */

/** What a board can reach for an association they belong to. */
export interface RemoteCommunitySummary {
  id: string;
  name: string;
  role: string;
  capabilities: Capability[];
  /** The address in links: /c/<slug>. Made by the database, stable. */
  slug: string;
  /** The one this person chose to land in. At most one is true. */
  isHome: boolean;
  /** "Bothell, WA": what tells two associations with one name apart. */
  place: string;
}

/** The associations this person currently belongs to. */
export async function loadMyAssociations(
  supabase: SupabaseClient,
): Promise<RemoteCommunitySummary[]> {
  const { data, error } = await supabase.rpc("my_associations");
  if (error) throw new Error(`Could not load your associations: ${error.message}`);
  const rows = (data ?? []) as {
    association_id: string; name: string; role: string; capabilities: Capability[]; slug: string | null; is_home?: boolean | null;
  }[];
  // The town, so a person on two boards called Maple Ridge can tell them
  // apart. Read straight off the table; RLS scopes it to their own.
  const places = new Map<string, string>();
  if (rows.length) {
    const { data: towns } = await supabase
      .from("associations")
      .select("id, city, state")
      .in("id", rows.map((r) => r.association_id));
    for (const t of towns ?? []) places.set(t.id, placeLabel(t.city, t.state));
  }
  return rows.map((row) => ({
    id: row.association_id,
    name: row.name,
    role: row.role,
    capabilities: row.capabilities ?? [],
    slug: row.slug ?? row.association_id,
    isHome: Boolean(row.is_home),
    place: places.get(row.association_id) ?? "",
  }));
}

/**
 * The next bill an association will issue, looking from `today`.
 *
 * On its cadence and counted from its fiscal year, the way the daily run
 * bills, and not before the first bill the board set. Looking starts the day
 * after today, so on a due day "next" is the following period and not the
 * bill issued this morning.
 */
export function nextChargeDateFor(
  today: string,
  a: {
    due_day: number;
    dues_cadence: "monthly" | "quarterly" | "annually";
    fiscal_year_start?: string | null;
    billing_starts_on?: string | null;
  },
): string {
  const tomorrow = addDays(today, 1);
  const from = a.billing_starts_on && a.billing_starts_on > tomorrow ? a.billing_starts_on : tomorrow;
  return nextDueOnOrAfter(from, a.due_day, a.dues_cadence, a.fiscal_year_start ?? "01-01");
}

/**
 * Every row a query matches, a page at a time.
 *
 * The API stops at a thousand rows and says nothing about it. Forty homes
 * billed monthly pass a thousand statement lines in the second year, and a
 * single read handed back the newest thousand: statements began mid-history,
 * a delinquent's age was counted from whatever charge happened to be oldest in
 * the page, and the bank balance was a sum of a fraction of the books. The id
 * breaks ties in the ordering so no row lands on two pages or none.
 */
async function everyRow<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  /** Pages to ask for before the first has said whether there is more. */
  expect = 1,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  // The first page says whether there is more. After that, pages go out a
  // few at a time: ten years of statements is ten pages, and read one after
  // another they were fourteen seconds before the first number appeared.
  // Results are appended in page order, so the rows stay sorted. A caller
  // that knows the read spans two pages asks for both at once.
  const opening = await Promise.all(
    Array.from({ length: Math.max(1, expect) }, (_, i) => page(i * 1000, i * 1000 + 999)),
  );
  const rows: T[] = [];
  for (const { data, error } of opening) {
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return { data: rows, error: null };
  }
  const BATCH = 4;
  for (let from = 1000 * opening.length; ; from += 1000 * BATCH) {
    const batch = await Promise.all(
      Array.from({ length: BATCH }, (_, i) => page(from + i * 1000, from + i * 1000 + 999)),
    );
    for (const { data, error } of batch) {
      if (error) return { data: null, error };
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) return { data: rows, error: null };
    }
  }
}

/**
 * A payout's status, read defensively. The column is text, and one row with a
 * word the board screens do not know used to take the whole Vendors page
 * down. Anything unknown reads as the step it is actually at.
 */
function payoutStatus(raw: string, approvals: number, required: number): Payout["status"] {
  if (raw === "paid" || raw === "in-transit" || raw === "scheduled" || raw === "needs-approval") return raw;
  return approvals >= required ? "scheduled" : "needs-approval";
}

/** What `association_funds` returns: the part of the books an owner may see. */
interface FundsSummary {
  accounts: { id: string; kind: string; institution: string; balance_cents: number }[];
  by_category: { category: string; in_cents: number; out_cents: number }[];
  recent: {
    id: string;
    occurred_on: string;
    description: string;
    counterparty: string;
    category: string;
    amount_cents: number;
    bank_account_id: string | null;
  }[];
}

function fundsActual(funds: FundsSummary, category: string, kind: "income" | "expense"): number {
  const row = funds.by_category.find((c) => c.category === category);
  return row ? Number(kind === "income" ? row.in_cents : row.out_cents) : 0;
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Standing derived from how long money has been owed, not stored separately. */
function standingFor(daysPastDue: number, balanceCents: number): Owner["standing"] {
  if (balanceCents <= 0) return "current";
  if (daysPastDue > 90) return "collections";
  if (daysPastDue > 30) return "late";
  return "grace";
}

/** What `association_overview` returns: the sums of the rows the app does not load. */
interface Overview {
  units: {
    unit_id: string;
    balance_cents: number;
    line_count: number;
    carried_cents: number;
    oldest_open_due_on: string | null;
    late_fees_owed_cents: number;
  }[];
  ledger: {
    count: number;
    first_on: string | null;
    months: { month: string; category: string; in_cents: number; out_cents: number; count: number }[];
    accounts: { bank_account_id: string; balance_cents: number; interest_ytd_cents: number }[];
  };
  statements: {
    months: { month: string; kind: string; cents: number; count: number }[];
  };
}

/**
 * How many months of lines come down with the association.
 *
 * Two years covers every period the screens open by default (this month,
 * this year, the last twelve months, last year) and the current fiscal
 * year whenever it starts. Everything earlier is summed by the server and
 * fetched line by line only when a screen asks for it.
 */
const WINDOW_MONTHS = 24;

/** The first day of the month `WINDOW_MONTHS` back, counting the current one. */
export function historyWindowFrom(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const zero = y * 12 + (m - 1) - (WINDOW_MONTHS - 1);
  return `${Math.floor(zero / 12)}-${String((zero % 12) + 1).padStart(2, "0")}-01`;
}

type ChargeRow = {
  id: string;
  unit_id: string;
  due_on: string;
  created_at: string;
  label: string;
  kind: "charge" | "payment" | "credit";
  amount_cents: number;
  /** "dues", "late_fee" and so on. Tables written before it existed leave it out. */
  category?: string | null;
};

/**
 * A home's statement lines, newest first, each carrying the balance after it.
 *
 * Walked oldest first from the balance carried into the first row, so a
 * statement that starts two years in still reads the same running figure
 * the balance view sums. Shown newest first like the fixture's statements:
 * five years in, oldest first put the owner's last payment a hundred and
 * twenty lines down the page.
 */
export function statementLines(rows: ChargeRow[], carriedCents = 0): ChargeLine[] {
  let running = carriedCents;
  const lines: ChargeLine[] = [];
  // By date, and on one date the charge before the payment that settles it,
  // so the running balance never dips before the bill it pays. Two lines of
  // one kind keep the order they were written in.
  for (const c of [...rows].sort((x, y) => compareStatement({ date: x.due_on, kind: x.kind }, { date: y.due_on, kind: y.kind }) || x.created_at.localeCompare(y.created_at))) {
    running += c.amount_cents;
    lines.push({
      id: c.id,
      date: c.due_on,
      label: c.label,
      kind: c.kind,
      amountCents: c.amount_cents,
      balanceAfterCents: running,
      ...(c.category ? { category: c.category } : {}),
    });
  }
  return lines.reverse();
}

type LedgerRow = {
  id: string;
  occurred_on: string;
  description: string;
  counterparty: string;
  category: string;
  bank_account_id: string | null;
  amount_cents: number;
  confirmed_at: string | null;
};

function ledgerLine(e: LedgerRow): LedgerEntry {
  return {
    id: e.id,
    date: e.occurred_on,
    description: e.description,
    counterparty: e.counterparty,
    category: e.category as LedgerEntry["category"],
    accountId: e.bank_account_id ?? "unassigned",
    amountCents: e.amount_cents,
    status: e.confirmed_at ? "cleared" : "needs-review",
  };
}

/** Every ledger line before a day, for a screen that asked to see earlier. */
export async function loadLedgerBefore(
  supabase: SupabaseClient,
  associationId: string,
  before: string,
): Promise<LedgerEntry[]> {
  const { data, error } = await everyRow((from, to) =>
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("association_id", associationId)
      .lt("occurred_on", before)
      .order("occurred_on", { ascending: false })
      .order("id")
      .range(from, to),
  );
  if (error) throw new Error(`Could not load earlier transactions: ${error.message}`);
  return (data ?? []).map(ledgerLine);
}

/** One home's whole statement, every line, for a screen that asked to see earlier. */
export async function loadWholeStatement(
  supabase: SupabaseClient,
  unitId: string,
): Promise<ChargeLine[]> {
  const { data, error } = await everyRow((from, to) =>
    supabase.from("charges").select("*").eq("unit_id", unitId).order("due_on", { ascending: false }).order("id").range(from, to),
  );
  if (error) throw new Error(`Could not load the earlier statement: ${error.message}`);
  return statementLines(data ?? []);
}

export async function loadCommunity(
  supabase: SupabaseClient,
  associationId: string,
): Promise<Community> {
  const today = new Date().toISOString().slice(0, 10);
  const windowFrom = historyWindowFrom(today);

  // One round trip per table rather than a nested select, because the shapes
  // are flat and a failure is easier to attribute when it is not buried in a
  // join. Fired together, so the latency is one trip's worth.
  //
  // Statement and ledger lines come down for the last two years only. What
  // came before is summed on the server by association_overview: each home's
  // balance and standing, the ledger by month, each account's balance. Ten
  // years of a forty home association was 15,000 rows in 60 calls and six
  // seconds before the first number; the sums are one call.
  const [
    association, units, memberships, charges, banks, ledger, overviewCall,
    requests, documents, meetings, ballots, ballotOptions, tallies, turnout, myVotes,
    posts, vendors, amenities, announcementRows,
    instruments, payoutRows, reportRows, violationRows, threadRows, articleRows,
    budgetRows, reserveRows, templateRows, formRows, sharedCostRows, sharedBillRows,
    paymentRows, replyRows, actionRows, joinRows, emailRows, termRows, activityRows,
  ] = await Promise.all([
    supabase.from("associations").select("*").eq("id", associationId).single(),
    supabase.from("units").select("*").eq("association_id", associationId),
    // Every seat, closed ones included: a closed seat is a previous owner
    // on the home's record. Current holders are picked out below.
    supabase.from("memberships").select("*").eq("association_id", associationId).order("starts_on"),
    // Forty homes billed monthly is two pages of two years, so both go out at once.
    everyRow((from, to) => supabase.from("charges").select("*").eq("association_id", associationId).gte("due_on", windowFrom).order("due_on", { ascending: false }).order("id").range(from, to), 2),
    supabase.from("bank_accounts").select("*").eq("association_id", associationId),
    everyRow((from, to) => supabase.from("ledger_entries").select("*").eq("association_id", associationId).gte("occurred_on", windowFrom).order("occurred_on", { ascending: false }).order("id").range(from, to)),
    supabase.rpc("association_overview", { p_association_id: associationId, p_from: windowFrom }),
    supabase.from("requests").select("*").eq("association_id", associationId).order("submitted_on", { ascending: false }),
    // Files open through short lived signed links, made here as soon as
    // the rows arrive rather than after everything else has, so a row is
    // a plain link on every screen. Storage applies the same visibility rule
    // as the table, so a resident is only ever handed links to what they
    // may read.
    supabase.from("documents").select("*").eq("association_id", associationId).order("updated_on", { ascending: false })
      .then(async (result) => {
        const paths = (result.data ?? [])
          .map((d) => d.storage_path)
          .filter((path): path is string => Boolean(path));
        const urlByPath = new Map<string, string>();
        if (paths.length) {
          const { data: signed } = await supabase.storage.from("documents").createSignedUrls(paths, SIGNED_URL_SECONDS);
          for (const item of signed ?? []) {
            if (item.path && item.signedUrl && !item.error) urlByPath.set(item.path, item.signedUrl);
          }
        }
        return { ...result, urlByPath };
      }),
    supabase.from("meetings").select("*").eq("association_id", associationId).order("held_on"),
    supabase.from("ballots").select("*").eq("association_id", associationId).order("closes_on"),
    supabase.from("ballot_options").select("*").order("position"),
    supabase.from("ballot_tallies").select("*"),
    supabase.from("ballot_turnout").select("ballot_id, homes_voted").eq("association_id", associationId),
    supabase.from("votes").select("*"),
    supabase.from("posts").select("*").eq("association_id", associationId).order("created_at", { ascending: false }),
    supabase.from("vendors").select("*").eq("association_id", associationId),
    supabase.from("amenities").select("*").eq("association_id", associationId),
    supabase.from("announcements").select("*").eq("association_id", associationId).order("posted_on", { ascending: false }),
    // Each of these is scoped by row level security as well as by the filter:
    // a resident's instruments are their own, a report is its reporter's, and
    // the board's tables come back empty for anyone else.
    supabase.from("payment_instruments").select("*").eq("association_id", associationId).order("added_on"),
    everyRow((from, to) => supabase.from("payouts").select("*").eq("association_id", associationId).order("issued_on", { ascending: false }).order("id").range(from, to)),
    supabase.from("violation_reports").select("*").eq("association_id", associationId).order("submitted_on", { ascending: false }),
    supabase.from("violations").select("*").eq("association_id", associationId).order("opened_on", { ascending: false }),
    everyRow((from, to) => supabase.from("threads").select("*").eq("association_id", associationId).order("updated_on", { ascending: false }).order("id").range(from, to)),
    supabase.from("governing_articles").select("*").eq("association_id", associationId).order("position"),
    supabase.from("budget_lines").select("*").eq("association_id", associationId).order("position"),
    supabase.from("reserve_components").select("*").eq("association_id", associationId).order("remaining_life_years"),
    supabase.from("message_templates").select("*").eq("association_id", associationId),
    supabase.from("forms").select("*").eq("association_id", associationId).order("updated_on"),
    supabase.from("shared_costs").select("*").eq("association_id", associationId),
    supabase.from("shared_cost_bills").select("*").eq("association_id", associationId).order("period_end", { ascending: false }),
    // Money in flight. RLS scopes a resident to their own unit's rows; settled
    // payments already show as statement lines, so only the unfinished matter.
    supabase.from("payments").select("*").eq("association_id", associationId).in("state", ["pending", "failed"]).order("created_at", { ascending: false }),
    everyRow((from, to) => supabase.from("post_replies").select("*").eq("association_id", associationId).order("created_at").order("id").range(from, to)),
    // Board-only rows. RLS hands a resident nothing here, and nothing is
    // what their screens show, so the same query serves both.
    supabase.from("action_items").select("*").eq("association_id", associationId).order("created_at"),
    supabase.from("join_requests").select("*").eq("association_id", associationId).order("created_at", { ascending: false }),
    supabase.from("email_log").select("*").eq("association_id", associationId).order("sent_at", { ascending: false }).limit(300),
    supabase.from("board_terms").select("*").eq("association_id", associationId).order("starts_on"),
    // The newest hundred board actions; RLS answers nothing for a seat
    // that may not open Settings, and the card says so.
    supabase.from("activity").select("*").eq("association_id", associationId).order("at", { ascending: false }).limit(100),
  ]);

  const urlByPath = documents.urlByPath;

  if (association.error || !association.data) {
    throw new Error(`Could not load that association: ${association.error?.message ?? "not found"}`);
  }

  const a = association.data;

  // Three reads cannot be allowed to fail quietly, because what an empty
  // answer says is false: no homes, nobody seated (which signs the member
  // out of their own association), and statements with nothing on them. The
  // other tables are left to come back empty, since one flaky secondary
  // read should not lock every member out.
  const needed: [string, { error: { message: string } | null }][] = [
    ["the homes", units],
    ["the roster", memberships],
    ["the statements", charges],
  ];
  for (const [what, result] of needed) {
    if (result.error) throw new Error(`Could not load ${what}: ${result.error.message}`);
  }

  if (overviewCall.error) {
    throw new Error(`Could not load that association: ${overviewCall.error.message}`);
  }
  const overview = overviewCall.data as Overview;
  const unitSummary = new Map(overview.units.map((u) => [u.unit_id, u]));
  const accountSummary = new Map(overview.ledger.accounts.map((b) => [b.bank_account_id, b]));

  // An owner cannot read the bank accounts or the ledger, and should not: a
  // payment's line names the household that paid. What they may know comes
  // from one function instead: balances, this year's totals by category, and
  // recent spending. Only asked when the tables came back empty, which is
  // what they do for anyone without the finances capability.
  const fundsCall =
    (banks.data ?? []).length || (ledger.data ?? []).length
      ? null
      : await supabase.rpc("association_funds", { p_association_id: associationId });
  const funds = ((fundsCall?.data ?? null) as FundsSummary | null);
  // A failed call is not an empty association. Saying $0 in every fund
  // is worse than saying nothing, so the page is told it could not ask.
  const fundsUnavailable = Boolean(fundsCall?.error);

  // Display preferences with no column of their own live in a jsonb patch.
  const stored = (a.settings ?? {}) as Partial<CommunitySettings>;
  const unitRows = units.data ?? [];
  const everySeat = memberships.data ?? [];
  const memberRows = everySeat.filter((m) => m.ends_on === null);
  const chargeRows = charges.data ?? [];

  // One membership per home for display purposes. A home with two names on
  // title is one bill, so the first current holder names the household.
  const holderByUnit = new Map<string, (typeof memberRows)[number]>();
  for (const m of memberRows) {
    if (!holderByUnit.has(m.unit_id)) holderByUnit.set(m.unit_id, m);
  }

  // Everyone who holds a seat on each home today, by account. A saved bank
  // or card is shown only while the person who saved it is one of them.
  const seatedByUnit = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!m.profile_id) continue;
    const seated = seatedByUnit.get(m.unit_id);
    if (seated) seated.push(m.profile_id);
    else seatedByUnit.set(m.unit_id, [m.profile_id]);
  }

  const owners: Owner[] = unitRows.map((unit) => {
    const holder = holderByUnit.get(unit.id);
    const summary = unitSummary.get(unit.id);
    const balanceCents = Number(summary?.balance_cents ?? 0);
    // The oldest unpaid charge sets how far past due a household is. Money
    // is applied oldest first, so what is still owed is the newest charges
    // whose amounts add up to the balance; the oldest of those is the one
    // the clock runs from. The server finds it from the whole statement,
    // since the charge a three year delinquent's clock runs from is older
    // than any line the app loads.
    const oldestOpen = summary?.oldest_open_due_on ?? null;
    const daysPastDue =
      balanceCents > 0 && oldestOpen ? Math.max(0, daysBetween(oldestOpen, today)) : 0;

    const members = memberRows
      .filter((m) => m.unit_id === unit.id)
      .map((m) => m.full_name)
      .filter(Boolean);

    // Each person's seat, so the board can end one of two. A seat with an
    // office or a capability is not offered: remove_owner would refuse it.
    const seats = memberRows
      .filter((m) => m.unit_id === unit.id && m.full_name)
      .map((m) => ({
        id: m.id as string,
        name: m.full_name as string,
        accountId: (m.profile_id as string | null) ?? undefined,
        removable:
          m.role === "resident" &&
          !(m.capabilities ?? []).length &&
          !(m.views ?? []).length,
      }));

    // Who held the home before, newest first. A seat that closed the day
    // it opened is a correction, not a tenure.
    const previousOwners = everySeat
      .filter((m) => m.unit_id === unit.id && m.ends_on !== null && m.ends_on > m.starts_on && m.full_name)
      .map((m) => ({ name: m.full_name, from: m.starts_on, to: m.ends_on as string }))
      .sort((x, y) => y.to.localeCompare(x.to));

    // A home with nobody on it yet still needs a name on the roster. For a
    // builder that is a lot not yet sold; for everyone else it is a home
    // whose owner has not been entered. Neither should echo the unit label,
    // which the row already shows.
    const placeholder = a.origin === "builder" ? "Not yet sold" : "No owner yet";
    return {
      id: unit.id,
      displayName: holder?.full_name || placeholder,
      placeholder: !holder?.full_name,
      members: members.length ? members : [holder?.full_name || placeholder],
      seats,
      email: holder?.invited_email ?? "",
      phone: holder?.phone ?? "",
      mailingAddress: holder?.mailing_address || undefined,
      unit: unit.label,
      address: unit.address,
      homeType: unit.home_type ?? undefined,
      duesCents: unit.dues_cents ?? undefined,
      moveInDate: holder?.starts_on ?? unit.created_at.slice(0, 10),
      balanceCents,
      autopay: Boolean(holder?.autopay),
      autopayPlan: (holder?.autopay as Owner["autopayPlan"]) ?? undefined,
      standing: standingFor(daysPastDue, balanceCents),
      daysPastDue,
      boardRole:
        holder && holder.role !== "resident"
          ? holder.role
              .split("-")
              .map((p: string) => p[0].toUpperCase() + p.slice(1))
              .join(" ")
          : undefined,
      previousOwners: previousOwners.length ? previousOwners : undefined,
    };
  });

  const accounts: Account[] = memberRows
    .filter((m) => m.profile_id)
    .map((m) => ({
      id: m.profile_id as string,
      ownerId: m.unit_id,
      name: m.full_name,
      email: m.invited_email ?? "",
      unit: unitRows.find((u) => u.id === m.unit_id)?.label ?? "",
      role: m.role,
      capabilities: caps(
        (m.capabilities ?? []) as Capability[],
        (m.capabilities ?? []).includes("permissions"),
      ),
      views: caps((m.views ?? []) as Capability[]),
    }));

  // The first day of this fiscal year. A budget's actuals are this year's
  // alone; summing every year on the books read five years of landscaping
  // against one year's budget line.
  const thisYearStart = `${today.slice(0, 4)}-${a.fiscal_year_start ?? "01-01"}`;
  const fiscalYearFrom =
    thisYearStart <= today ? thisYearStart : `${Number(today.slice(0, 4)) - 1}-${a.fiscal_year_start}`;

  // Statements keyed by home, each line carrying the balance after it. The
  // running figure starts from the balance the server carried into the
  // window and walks the same rows the balance view sums, so the statement
  // and the balance cannot disagree.
  const ownerCharges: Record<string, ChargeLine[]> = {};
  const rowsByUnit = new Map<string, ChargeRow[]>();
  for (const c of chargeRows) {
    const list = rowsByUnit.get(c.unit_id);
    if (list) list.push(c);
    else rowsByUnit.set(c.unit_id, [c]);
  }
  for (const unit of unitRows) {
    ownerCharges[unit.id] = statementLines(
      rowsByUnit.get(unit.id) ?? [],
      Number(unitSummary.get(unit.id)?.carried_cents ?? 0),
    );
  }

  const history: CommunityHistory = {
    from: windowFrom,
    ledgerCount: Number(overview.ledger.count),
    ledgerFrom: overview.ledger.first_on ?? undefined,
    ledgerMonths: overview.ledger.months.map((m) => ({
      month: m.month,
      category: m.category as LedgerEntry["category"],
      inCents: Number(m.in_cents),
      outCents: Number(m.out_cents),
      count: m.count,
    })),
    statementMonths: overview.statements.months.map((m) => ({
      month: m.month,
      kind: m.kind as ChargeLine["kind"],
      cents: Number(m.cents),
      count: m.count,
    })),
    statementCounts: Object.fromEntries(overview.units.map((u) => [u.unit_id, u.line_count])),
    lateFeesOwedCents: overview.units.reduce((t, u) => t + Number(u.late_fees_owed_cents), 0),
    statementsLoaded: [],
    ledgerLoaded: false,
  };

  const boardTerms: BoardTerm[] = (termRows.data ?? []).map((t) => ({
    id: t.id,
    name: t.full_name,
    unit: t.unit_id ? unitRows.find((u) => u.id === t.unit_id)?.label : undefined,
    role: t.role,
    from: t.starts_on,
    to: t.ends_on ?? undefined,
  }));

  const activity: Activity[] = (activityRows.data ?? []).map((r) => ({
    id: r.id,
    at: r.at,
    actorId: r.actor_id ?? undefined,
    actorName: r.actor_name,
    subjectKind: r.subject_kind,
    subjectId: r.subject_id ?? undefined,
    summary: r.summary,
    details: (r.details ?? {}) as Record<string, unknown>,
  }));

  return {
    id: a.id,
    label: a.name,
    asOf: today,
    nextChargeDate: nextChargeDateFor(today, a),

    association: {
      id: a.id,
      name: a.name,
      shortName: a.name.split(/\s+/).slice(0, 2).join(" "),
      state: a.state,
      stateName: a.state,
      unitCount: unitRows.length,
      fiscalYearStart: a.fiscal_year_start,
      duesCents: a.dues_cents,
      duesByType: (a.dues_by_type ?? {}) as Community["association"]["duesByType"],
      duesCadence: a.dues_cadence,
      addressLine: `${a.city}, ${a.state}`,
      managedBy: "self",
      insuranceCarrier: a.insurance_carrier ?? undefined,
      insurancePolicyNo: a.insurance_policy_no ?? undefined,
      insuranceExpiresOn: a.insurance_expires_on ?? undefined,
      subscriptionStatus: (a.subscription_status ?? "trialing") as
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "ended",
      trialEndsOn: (a.trial_ends_at ?? "").slice(0, 10) || undefined,
      billing: a.billing_subscription_id
        ? {
            subscriptionId: a.billing_subscription_id,
            brand: a.billing_brand ?? undefined,
            last4: a.billing_last4 ?? undefined,
            email: a.billing_email ?? undefined,
          }
        : undefined,
      stripeAccountId: a.stripe_account_id ?? undefined,
      stripeChargesEnabled: a.stripe_charges_enabled ?? false,
      stripePayout:
        a.stripe_payout_bank && a.stripe_payout_last4
          ? { bank: a.stripe_payout_bank, last4: a.stripe_payout_last4 }
          : undefined,
      joinCode: a.join_code,
    },

    settings: {
      displayName: a.name,
      photoUrl: a.photo_url ?? "",
      photoCredit: a.photo_credit ?? undefined,
      homeLayout: stored.homeLayout ?? "calendar",
      banner: stored.banner ?? { enabled: false, title: "", detail: "", updatedDate: today },
      showFundsToResidents: stored.showFundsToResidents ?? true,
      showLiveVoteResults: stored.showLiveVoteResults ?? false,
      autopayLateAfterDay: a.late_after_day,
      paymentFeeCents: a.payment_fee_cents ?? 0,
      paymentFeePaidBy: (a.payment_fee_paid_by ?? "association") as "owner" | "association",
      paymentFeeWaivedOnAch: a.payment_fee_waived_on_ach ?? true,
      forumEnabled: stored.forumEnabled ?? true,
      collectionPolicy: stored.collectionPolicy ?? undefined,
      complianceDone: stored.complianceDone ?? undefined,
      reserveStudy: stored.reserveStudy ?? undefined,
    },

    owners,
    accounts,
    // Saved methods are kept by home, so two people on one title share them,
    // and row level security hands a member every row on their home. After a
    // sale that included the seller's: the buyer's pay screen showed the
    // seller's bank by name and last four. The same rule the server charges
    // by (src/lib/stripe/saved-method-owner.ts) decides what is shown: a
    // method whose saver still holds a seat on the home, which covers the
    // person signed in and a co-owner. One with no saver on record is shown
    // to nobody, as it is charged by nobody.
    instruments: (instruments.data ?? [])
      .filter((i) => savedByCurrentMember(i.profile_id, seatedByUnit.get(i.unit_id) ?? []))
      .map((i) => ({
        ...(i.detail ?? {}),
        id: i.id,
        ownerId: i.unit_id,
        kind: i.kind,
        label: i.label,
        mask: i.mask,
        isDefault: i.is_default,
        addedDate: i.added_on,
      })),

    pendingPayments: (paymentRows.data ?? []).map((p) => ({
      id: p.id,
      unitId: p.unit_id,
      amountCents: p.amount_cents,
      rail: p.rail,
      state: p.state as "pending" | "failed",
      createdAt: p.created_at,
    })),

    fundsUnavailable,
    bankAccounts: funds
      ? funds.accounts.map((b, i, all) => ({
          id: b.id,
          name: `${b.kind[0].toUpperCase()}${b.kind.slice(1)} account`,
          institution: b.institution,
          mask: "",
          kind: b.kind as Community["bankAccounts"][number]["kind"],
          balanceCents: Number(b.balance_cents),
          syncedMinutesAgo: 0,
          status: "live" as const,
          reconciledThroughDate: today,
          unreconciledCount: 0,
          apy: 0,
          // The owner's summary has interest by category, not by account, so
          // this year's total sits on the first reserve account.
          interestYtdCents:
            b.kind !== "operating" && all.findIndex((x) => x.kind !== "operating") === i
              ? fundsActual(funds, "Interest income", "income")
              : 0,
          insuredLimitCents: 250_000_00,
        }))
      : (banks.data ?? []).map((b) => ({
      id: b.id,
      name: `${b.kind[0].toUpperCase()}${b.kind.slice(1)} account`,
      institution: b.institution,
      // The column is char(4): an account with no number comes back as spaces.
      mask: (b.mask ?? "").trim(),
      kind: b.kind,
      // What the books say is in the account. There is no bank feed yet, so
      // the ledger is the only source; a fixed zero read as "broke" on the
      // dashboard of an association with a year of dues behind it.
      // Confirmed lines only, all time, summed by the server as
      // association_funds sums them for owners, so a line waiting on review
      // cannot make the two balances differ.
      balanceCents: Number(accountSummary.get(b.id)?.balance_cents ?? 0),
      syncedMinutesAgo: 0,
      status: "live" as const,
      reconciledThroughDate: today,
      unreconciledCount: 0,
      apy: 0,
      // From the books, this fiscal year. It was a fixed zero beside a
      // list of interest payments.
      interestYtdCents: Number(accountSummary.get(b.id)?.interest_ytd_cents ?? 0),
      insuredLimitCents: 250_000_00,
    })),

    ledger: funds
      ? funds.recent.map((e) => ({
          id: e.id,
          date: e.occurred_on,
          description: e.description,
          counterparty: e.counterparty,
          category: e.category as Community["ledger"][number]["category"],
          accountId: e.bank_account_id ?? "unassigned",
          amountCents: e.amount_cents,
          status: "cleared" as const,
        }))
      : (ledger.data ?? []).map(ledgerLine),

    budget: (budgetRows.data ?? []).length
      ? (budgetRows.data ?? []).map((line) => ({
          category: line.category as Community["budget"][number]["category"],
          annualCents: Number(line.annual_cents),
          // Actuals come from the books, never from a typed number, so the
          // budget screen and the ledger cannot disagree.
          ytdActualCents: funds
            ? fundsActual(funds, line.category, line.kind as "income" | "expense")
            : (ledger.data ?? [])
                // Confirmed lines only: one waiting on review is held out
                // of every report, and association_funds leaves it out too.
                .filter((e) => Boolean(e.confirmed_at))
                .filter((e) => e.category === line.category && e.occurred_on >= fiscalYearFrom)
                .filter((e) => (line.kind === "income" ? e.amount_cents > 0 : e.amount_cents < 0))
                .reduce((total, e) => total + Math.abs(e.amount_cents), 0),
          kind: line.kind as "income" | "expense",
        }))
      : [
          {
            category: "Assessments",
            // Every home at what issue_assessment bills it: its own amount,
            // else its kind's, else the association's.
            annualCents:
              unitRows.reduce(
                (sum, u) =>
                  sum +
                  duesFor(
                    {
                      duesCents: a.dues_cents,
                      duesByType: (a.dues_by_type ?? {}) as Record<string, number>,
                    },
                    u.home_type ?? undefined,
                    u.dues_cents ?? undefined,
                  ),
                0,
              ) * (a.dues_cadence === "monthly" ? 12 : a.dues_cadence === "quarterly" ? 4 : 1),
            ytdActualCents: funds
              ? fundsActual(funds, "Assessments", "income")
              : (ledger.data ?? [])
                  .filter(
                    (e) =>
                      Boolean(e.confirmed_at) &&
                      e.category === "Assessments" &&
                      e.amount_cents > 0 &&
                      e.occurred_on >= fiscalYearFrom,
                  )
                  .reduce((total, e) => total + e.amount_cents, 0),
            kind: "income",
          },
        ],
    // From the fiscal year's first month, like the actuals above. The
    // calendar month over twelve read "83% of the year gone" in October for
    // a year that began in July.
    yearElapsed: yearElapsedFrom(a.fiscal_year_start ?? "01-01", today),

    reserveComponents: (reserveRows.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      usefulLifeYears: c.useful_life_years,
      remainingLifeYears: c.remaining_life_years,
      replacementCostCents: Number(c.replacement_cost_cents),
      fundedCents: Number(c.funded_cents),
      lastInspection: c.last_inspection ?? undefined,
      note: c.note ?? undefined,
    })),
    savingsOffers: [],
    // Reservations are not stored server side yet, so the picker offers every
    // slot rather than pretending a free hour is taken.
    amenityBookings: [],
    joinRequests: (joinRows.data ?? []).map((j) => ({
      id: j.id,
      name: j.full_name,
      email: j.email,
      unit: j.unit_label,
      note: j.note,
      status: j.status as Community["joinRequests"][number]["status"],
      requestedOn: j.created_at.slice(0, 10),
      decidedOn: j.decided_on ?? undefined,
      decidedBy: j.decided_by ?? undefined,
    })),
    actionItems: (actionRows.data ?? []).map((i) => ({
      id: i.id,
      title: i.title,
      ownerName: i.owner_name,
      meetingId: i.meeting_id ?? undefined,
      dueOn: i.due_on ?? undefined,
      doneOn: i.done_on ?? undefined,
      createdOn: i.created_at.slice(0, 10),
    })),
    emailLog: (emailRows.data ?? []).map((e) => ({
      id: e.id,
      to: e.to_email,
      unit: e.unit_id ? unitRows.find((u) => u.id === e.unit_id)?.label : undefined,
      category: e.category,
      subject: e.subject,
      sentAt: e.sent_at,
      status: (e.status as Community["emailLog"][number]["status"]) ?? undefined,
      statusAt: e.status_at ?? undefined,
      error: e.error ?? undefined,
    })),
    profile: {
      propertyType: a.property_type ?? undefined,
      homeTypes: a.home_types?.length ? a.home_types : undefined,
      origin: a.origin ?? undefined,
      collects: a.collects ?? [],
      sharedSpaces: a.shared_spaces ?? [],
      previously: (a.previously ?? undefined) as PreviousSetup | undefined,
    },
    governingDocs: (articleRows.data ?? []).map((g) => ({
      id: g.id,
      document: g.document,
      number: g.number,
      title: g.title,
      topic: g.topic,
      text: (g.text ?? []) as string[],
      plain: g.plain ?? undefined,
      affects: g.affects,
      amendedOn: g.amended_on ?? undefined,
      amendmentBallotId: g.amendment_ballot_id ?? undefined,
      adoptedOn: g.adopted_on ?? undefined,
      disclosureTopics: g.disclosure_topics ?? undefined,
      extraction: g.extraction ?? undefined,
    })),
    governingAmendments: [],
    sharedCosts: (sharedCostRows.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      kind: (c.kind ?? "other") as Community["sharedCosts"][number]["kind"],
      provider: c.provider,
      accountRef: c.account_ref,
      allocation: c.allocation,
      markupPercent: Number(c.markup_percent),
      active: c.active,
      usageUnit: c.usage_unit ?? "",
    })),
    sharedCostBills: (sharedBillRows.data ?? []).map((b) => ({
      id: b.id,
      sharedCostId: b.shared_cost_id,
      periodStart: b.period_start,
      periodEnd: b.period_end,
      dueOn: b.due_on,
      totalCents: Number(b.total_cents),
      usageAmount: b.usage_amount === null ? undefined : Number(b.usage_amount),
      homes: unitRows.length,
      averageShareCents: unitRows.length ? Math.round(Number(b.total_cents) / unitRows.length) : 0,
    })),
    specialAssessments: [],
    payouts: (payoutRows.data ?? []).map((p) => ({
      id: p.id,
      vendorId: p.vendor_id ?? "",
      vendor: p.vendor_name,
      invoiceNumber: p.invoice_number,
      amountCents: p.amount_cents,
      method: p.method,
      status: payoutStatus(p.status, (p.approvals ?? []).length, p.approvals_required),
      issuedDate: p.issued_on,
      expectedDate: p.expected_on,
      approvals: (p.approvals ?? []) as { name: string; at: string }[],
      approvalsRequired: p.approvals_required,
    })),
    violations: (violationRows.data ?? []).map((v) => ({
      id: v.id,
      reference: v.reference,
      ownerId: v.unit_id ?? "",
      ownerName: v.owner_name,
      unit: v.unit_label,
      rule: v.rule,
      ruleCitation: v.rule_citation,
      stage: v.stage,
      openedDate: v.opened_on,
      nextActionDate: v.next_action_on ?? v.opened_on,
      photos: (v.photos ?? []) as Community["violations"][number]["photos"],
      fineCents: v.fine_cents,
      reportId: v.report_id ?? undefined,
      source: v.source as Community["violations"][number]["source"],
      agency: v.agency ?? undefined,
      caseNumber: v.case_number ?? undefined,
      resolvedDate: v.resolved_on ?? undefined,
      ownerFixedDate: v.owner_fixed_on ?? undefined,
      ownerFixedNote: v.owner_fixed_note ?? undefined,
    })),
    // No table yet. Real associations keep invoices in the browser for now and
    // the Vendors screen says so.
    invoices: [],
    violationReports: (reportRows.data ?? []).map((r) => ({
      id: r.id,
      reference: r.reference,
      reporterId: r.reporter_profile_id ?? "",
      reporterName: r.reporter_name,
      reporterUnit: r.reporter_unit,
      subjectUnit: r.subject_unit,
      subjectOwnerId: r.subject_unit_id ?? undefined,
      what: r.what,
      observedOn: r.observed_on,
      submittedOn: r.submitted_on,
      status: r.status,
      verification: r.verified_on
        ? { by: r.verified_by ?? "", on: r.verified_on, note: r.verification_note ?? "" }
        : undefined,
      dismissedReason: r.dismissed_reason ?? undefined,
      violationId: r.violation_id ?? undefined,
    })),
    threads: (threadRows.data ?? []).map((t) => ({
      id: t.id,
      subject: t.subject,
      participants: (t.participants ?? []) as string[],
      ownerId: t.unit_id ?? undefined,
      unit: t.unit_id ? unitRows.find((u) => u.id === t.unit_id)?.label : undefined,
      updatedDate: t.updated_on,
      unread: t.unread,
      tag: t.tag,
      messages: (t.messages ?? []) as Community["threads"][number]["messages"],
    })),
    announcements: (announcementRows.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      postedDate: a.posted_on,
      author: a.author_name,
      pinned: a.pinned || undefined,
      category: a.category as Community["announcements"][number]["category"],
    })),

    vendors: (vendors.data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      service: v.service,
      achEnabled: v.ach_enabled,
      w9OnFile: v.w9_on_file,
      coiExpires: v.coi_expires_on ?? undefined,
      // What actually went out to them this year, from the payments the board
      // recorded, so the $600 line for a W-9 is measured rather than guessed.
      ytdPaidCents: (payoutRows.data ?? [])
        .filter(
          (p) =>
            p.status === "paid" &&
            (p.vendor_id === v.id || p.vendor_name === v.name) &&
            p.issued_on.slice(0, 4) === today.slice(0, 4),
        )
        .reduce((sum, p) => sum + p.amount_cents, 0),
      defaultCategory: v.default_category as Community["vendors"][number]["defaultCategory"],
    })),

    requests: (requests.data ?? []).map((r) => ({
      id: r.id,
      reference: r.reference,
      ownerId: r.unit_id,
      ownerName: holderByUnit.get(r.unit_id)?.full_name ?? "",
      unit: unitRows.find((u) => u.id === r.unit_id)?.label ?? "",
      kind: r.kind,
      title: r.title,
      summary: r.body,
      status: r.status,
      submittedDate: r.submitted_on,
      dueDate: r.due_on ?? undefined,
      dueReason: r.due_reason ?? undefined,
      decisionDate: r.decided_on ?? undefined,
      decidedBy: r.decided_by ?? undefined,
      attachments: (r.attachments ?? []) as Community["requests"][number]["attachments"],
      thread: (r.thread ?? []) as Community["requests"][number]["thread"],
      submission: r.submission ?? undefined,
      certificateId: r.certificate_id ?? undefined,
      workOrder: (r.work_order as Community["requests"][number]["workOrder"]) ?? undefined,
    })),

    documents: (documents.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category as Community["documents"][number]["category"],
      visibility: fromDbVisibility(d.visibility),
      fileType: fileTypeOf(d.storage_path ?? d.name),
      size: d.size_label,
      updatedDate: d.updated_on,
      storagePath: d.storage_path ?? undefined,
      url: d.storage_path ? urlByPath.get(d.storage_path) : undefined,
    })),

    meetings: (meetings.data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      date: m.held_on,
      time: clockTime(m.held_at ?? ""),
      location: m.location,
      dialIn: m.dial_in ?? "",
      passcode: m.passcode ?? "",
      status: m.status as Community["meetings"][number]["status"],
      kind: (m.kind ?? "board") as Community["meetings"][number]["kind"],
      agenda: (m.agenda ?? []) as string[],
      ballotIds: (ballots.data ?? []).filter((b) => b.meeting_id === m.id).map((b) => b.id),
      attendees: [],
      noticeSentDate: m.notice_sent_on ?? undefined,
      rsvps: (m.rsvps ?? []) as Community["meetings"][number]["rsvps"],
    })),

    ballots: (ballots.data ?? []).map((b) => {
      // One row per candidate marked, so a two seat race has two.
      const marks = (myVotes.data ?? []).filter((v) => v.ballot_id === b.id);
      const mine = marks[0];
      return {
        id: b.id,
        reference: b.id.slice(0, 8).toUpperCase(),
        title: b.title,
        body: b.body,
        kind: b.kind as Community["ballots"][number]["kind"],
        audience: (b.audience ?? "owners") as Community["ballots"][number]["audience"],
        status: b.status,
        opensDate: b.opens_on,
        closesDate: b.closes_on,
        eligible: unitRows.length,
        seats: b.seats,
        quorumRequired: b.quorum_required,
        thresholdLabel: b.threshold_label,
        options: (ballotOptions.data ?? [])
          .filter((o) => o.ballot_id === b.id)
          .map((o) => ({
            id: o.id,
            label: o.label,
            detail: o.detail ?? undefined,
            // Counted by the database, so no two screens can disagree.
            votes:
              (tallies.data ?? []).find((t) => t.option_id === o.id)?.votes ?? 0,
          })),
        myVoteOptionId: mine?.option_id ?? undefined,
        myVoteOptionIds: marks.length ? marks.map((v) => v.option_id) : undefined,
        homesVoted: (turnout.data ?? []).find((t) => t.ballot_id === b.id)?.homes_voted ?? 0,
        myVoteReceipt: mine?.receipt ?? undefined,
        meetingId: b.meeting_id ?? undefined,
        certifiedBy: b.certified_by ?? undefined,
        certifiedDate: b.certified_on ?? undefined,
        liveResultsVisible: b.live_results_visible ?? false,
      };
    }),

    posts: (posts.data ?? []).map((p) => ({
      id: p.id,
      author: p.author_name,
      authorRole: p.author_role ?? undefined,
      unit: p.unit_label ?? "",
      category: p.category as Community["posts"][number]["category"],
      title: p.title,
      body: p.body,
      status: p.status,
      rejectionReason: p.rejection_reason ?? undefined,
      moderatedBy: p.moderated_by ?? undefined,
      moderatedAt: p.moderated_at?.slice(0, 10),
      at: p.created_at.slice(0, 10),
      postedDate: p.created_at.slice(0, 10),
      pinned: p.pinned,
      likes: p.likes,
      replies: (replyRows.data ?? [])
        .filter((r) => r.post_id === p.id)
        .map((r) => ({
          id: r.id,
          author: r.author_name,
          unit: r.unit_label,
          authorRole: r.author_role ?? undefined,
          at: r.created_at.slice(0, 10),
          body: r.body,
        })),
    })),

    amenities: (amenities.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      detail: a.detail,
      reservable: a.reservable,
      status: a.status as Community["amenities"][number]["status"],
      maxHours: a.max_hours ?? undefined,
      rules: a.rules ?? undefined,
    })),
    amenityStatus: (amenities.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status as Community["amenityStatus"][number]["status"],
      detail: a.detail,
    })),
    // The stock forms ship in code; what the board uploads is a row. The
    // fixture's own "uploaded" examples are the demo board's, not this one's.
    forms: [
      ...architecturalForms
        .filter((f) => f.source === "baseline")
        .map((f) => ({ ...f, updatedDate: today })),
      ...(formRows.data ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        description: f.description,
        fileName: f.file_name,
        size: f.size_label,
        source: "uploaded" as const,
        updatedDate: f.updated_on,
        fields: f.fields ?? undefined,
        governedBy: f.governed_by ?? undefined,
        decisionDays: f.decision_days ?? undefined,
      })),
    ],
    // A stock template edited by the board is a row that replaces it, keyed
    // by the stock id; a template the board wrote from scratch is a row alone.
    templates: (() => {
      const rows = templateRows.data ?? [];
      const toTemplate = (t: (typeof rows)[number], id: string) => ({
        id,
        name: t.name,
        description: t.description,
        subject: t.subject,
        body: t.body,
        trigger: t.trigger as Community["templates"][number]["trigger"],
        updatedDate: t.updated_on,
      });
      const overrides = new Map(rows.filter((t) => t.baseline_id).map((t) => [t.baseline_id, t]));
      return [
        ...messageTemplates.map((t) => {
          const own = overrides.get(t.id);
          return own ? toTemplate(own, t.id) : { ...t, updatedDate: today };
        }),
        ...rows.filter((t) => !t.baseline_id).map((t) => toTemplate(t, t.id)),
      ];
    })(),
    ownerCharges,
    history,
    boardTerms,
    activity,
  };
}
