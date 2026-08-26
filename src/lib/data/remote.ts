import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import type { Account, Capability, ChargeLine, Owner } from "@/lib/types";
import { caps } from "./accounts";
import { architecturalForms } from "./settings";
import { messageTemplates } from "./templates";

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
}

/** The associations this person currently belongs to. */
export async function loadMyAssociations(
  supabase: SupabaseClient,
): Promise<RemoteCommunitySummary[]> {
  const { data, error } = await supabase.rpc("my_associations");
  if (error) throw new Error(`Could not load your associations: ${error.message}`);
  return (data ?? []).map(
    (row: { association_id: string; name: string; role: string; capabilities: Capability[] }) => ({
      id: row.association_id,
      name: row.name,
      role: row.role,
      capabilities: row.capabilities ?? [],
    }),
  );
}

/** The next occurrence of a billing day, on or after a date. */
function nextDueDate(from: string, day: number): string {
  const [year, month, today] = from.split("-").map(Number);
  const safe = Math.min(Math.max(1, day), 28);
  if (today < safe) {
    return `${year}-${String(month).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
  }
  const zero = year * 12 + month;
  return `${Math.floor(zero / 12)}-${String((zero % 12) + 1).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
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

export async function loadCommunity(
  supabase: SupabaseClient,
  associationId: string,
): Promise<Community> {
  const today = new Date().toISOString().slice(0, 10);

  // One round trip per table rather than a nested select, because the shapes
  // are flat and a failure is easier to attribute when it is not buried in a
  // join. Fired together, so the latency is one trip's worth.
  const [association, units, memberships, charges, banks, ledger, balances] = await Promise.all([
    supabase.from("associations").select("*").eq("id", associationId).single(),
    supabase.from("units").select("*").eq("association_id", associationId),
    supabase.from("memberships").select("*").eq("association_id", associationId).is("ends_on", null),
    supabase.from("charges").select("*").eq("association_id", associationId).order("due_on", { ascending: false }),
    supabase.from("bank_accounts").select("*").eq("association_id", associationId),
    supabase.from("ledger_entries").select("*").eq("association_id", associationId).order("occurred_on", { ascending: false }),
    supabase.from("unit_balances").select("*").eq("association_id", associationId),
  ]);

  if (association.error || !association.data) {
    throw new Error(`Could not load that association: ${association.error?.message ?? "not found"}`);
  }

  const a = association.data;
  const unitRows = units.data ?? [];
  const memberRows = memberships.data ?? [];
  const chargeRows = charges.data ?? [];
  const balanceByUnit = new Map(
    (balances.data ?? []).map((b) => [b.unit_id as string, b.balance_cents as number]),
  );

  // One membership per home for display purposes. A home with two names on
  // title is one bill, so the first current holder names the household.
  const holderByUnit = new Map<string, (typeof memberRows)[number]>();
  for (const m of memberRows) {
    if (!holderByUnit.has(m.unit_id)) holderByUnit.set(m.unit_id, m);
  }

  const owners: Owner[] = unitRows.map((unit) => {
    const holder = holderByUnit.get(unit.id);
    const balanceCents = balanceByUnit.get(unit.id) ?? 0;
    // Oldest unpaid charge sets how far past due a household is.
    const oldestOpen = [...chargeRows]
      .filter((c) => c.unit_id === unit.id && c.kind === "charge" && c.due_on <= today)
      .sort((x, y) => (x.due_on < y.due_on ? -1 : 1))[0];
    const daysPastDue =
      balanceCents > 0 && oldestOpen ? Math.max(0, daysBetween(oldestOpen.due_on, today)) : 0;

    const members = memberRows
      .filter((m) => m.unit_id === unit.id)
      .map((m) => m.full_name)
      .filter(Boolean);

    return {
      id: unit.id,
      displayName: holder?.full_name || `Unit ${unit.label}`,
      members: members.length ? members : [holder?.full_name || `Unit ${unit.label}`],
      email: holder?.invited_email ?? "",
      phone: "",
      unit: unit.label,
      address: unit.address || `Unit ${unit.label}`,
      moveInDate: holder?.starts_on ?? unit.created_at.slice(0, 10),
      balanceCents,
      autopay: false,
      standing: standingFor(daysPastDue, balanceCents),
      daysPastDue,
      boardRole:
        holder && holder.role !== "resident"
          ? holder.role
              .split("-")
              .map((p: string) => p[0].toUpperCase() + p.slice(1))
              .join(" ")
          : undefined,
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
    }));

  // Statements, newest first, keyed by home.
  const ownerCharges: Record<string, ChargeLine[]> = {};
  for (const unit of unitRows) ownerCharges[unit.id] = [];
  for (const c of chargeRows) {
    (ownerCharges[c.unit_id] ??= []).push({
      id: c.id,
      date: c.due_on,
      label: c.label,
      kind: c.kind,
      amountCents: c.amount_cents,
      // Running balances are computed by the screens from the ledger they are
      // given, so storing one here would be a second number that can disagree.
      balanceAfterCents: 0,
    });
  }

  return {
    id: a.id,
    label: a.name,
    asOf: today,
    nextChargeDate: nextDueDate(today, a.due_day),

    association: {
      id: a.id,
      name: a.name,
      shortName: a.name.split(/\s+/).slice(0, 2).join(" "),
      state: a.state,
      stateName: a.state,
      unitCount: unitRows.length,
      fiscalYearStart: a.fiscal_year_start,
      duesCents: a.dues_cents,
      duesCadence: a.dues_cadence,
      addressLine: `${a.city}, ${a.state}`,
      managedBy: "self",
    },

    settings: {
      displayName: a.name,
      photoUrl: "",
      homeLayout: "calendar",
      banner: { enabled: false, title: "", detail: "", updatedDate: today },
      showFundsToResidents: true,
      showLiveVoteResults: false,
      autopayLateAfterDay: a.late_after_day,
      paymentFeeCents: 0,
      paymentFeePaidBy: "association",
      paymentFeeWaivedOnAch: true,
      forumEnabled: true,
    },

    owners,
    accounts,
    instruments: [],

    bankAccounts: (banks.data ?? []).map((b) => ({
      id: b.id,
      name: `${b.kind[0].toUpperCase()}${b.kind.slice(1)} account`,
      institution: b.institution,
      mask: b.mask,
      kind: b.kind,
      balanceCents: 0,
      syncedMinutesAgo: 0,
      status: "live" as const,
      reconciledThroughDate: today,
      unreconciledCount: 0,
      apy: 0,
      interestYtdCents: 0,
      insuredLimitCents: 250_000_00,
    })),

    ledger: (ledger.data ?? []).map((e) => ({
      id: e.id,
      date: e.occurred_on,
      description: e.description,
      counterparty: e.counterparty,
      category: e.category as Community["ledger"][number]["category"],
      accountId: e.bank_account_id ?? "unassigned",
      amountCents: e.amount_cents,
      status: e.confirmed_at ? ("cleared" as const) : ("needs-review" as const),
    })),

    budget: [
      {
        category: "Assessments",
        annualCents:
          a.dues_cents *
          (a.dues_cadence === "monthly" ? 12 : a.dues_cadence === "quarterly" ? 4 : 1) *
          unitRows.length,
        ytdActualCents: (ledger.data ?? [])
          .filter((e) => e.category === "Assessments" && e.amount_cents > 0)
          .reduce((total, e) => total + e.amount_cents, 0),
        kind: "income",
      },
    ],
    yearElapsed: Number(today.slice(5, 7)) / 12,

    // Nothing below has a table yet. Empty is the truth for a new association
    // and stays the truth until the schema grows to cover it.
    reserveComponents: [],
    savingsOffers: [],
    vendors: [],
    payouts: [],
    requests: [],
    violations: [],
    documents: [],
    complianceItems: [],
    meetings: [],
    ballots: [],
    threads: [],
    announcements: [],
    posts: [],
    amenities: [],
    amenityStatus: [],
    forms: architecturalForms.map((f) => ({ ...f, updatedDate: today })),
    templates: messageTemplates.map((t) => ({ ...t, updatedDate: today })),
    ownerCharges,
  };
}
