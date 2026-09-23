import type { PreviousSetup } from "@/lib/data/new-community";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import type { Account, Capability, ChargeLine, CommunitySettings, Owner } from "@/lib/types";
import { caps } from "./accounts";
import { architecturalForms } from "./settings";
import { messageTemplates } from "./templates";
import { fileTypeOf, fromDbVisibility, SIGNED_URL_SECONDS } from "@/lib/documents";

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
  const [
    association, units, memberships, charges, banks, ledger, balances,
    requests, documents, meetings, ballots, ballotOptions, tallies, myVotes,
    posts, vendors, amenities, announcementRows,
    instruments, payoutRows, reportRows, violationRows, threadRows, articleRows,
    budgetRows, reserveRows, templateRows, formRows, sharedCostRows, sharedBillRows,
    paymentRows, replyRows, actionRows, joinRows, emailRows,
  ] = await Promise.all([
    supabase.from("associations").select("*").eq("id", associationId).single(),
    supabase.from("units").select("*").eq("association_id", associationId),
    supabase.from("memberships").select("*").eq("association_id", associationId).is("ends_on", null),
    supabase.from("charges").select("*").eq("association_id", associationId).order("due_on", { ascending: false }),
    supabase.from("bank_accounts").select("*").eq("association_id", associationId),
    supabase.from("ledger_entries").select("*").eq("association_id", associationId).order("occurred_on", { ascending: false }),
    supabase.from("unit_balances").select("*").eq("association_id", associationId),
    supabase.from("requests").select("*").eq("association_id", associationId).order("submitted_on", { ascending: false }),
    supabase.from("documents").select("*").eq("association_id", associationId).order("updated_on", { ascending: false }),
    supabase.from("meetings").select("*").eq("association_id", associationId).order("held_on"),
    supabase.from("ballots").select("*").eq("association_id", associationId).order("closes_on"),
    supabase.from("ballot_options").select("*").order("position"),
    supabase.from("ballot_tallies").select("*"),
    supabase.from("votes").select("*"),
    supabase.from("posts").select("*").eq("association_id", associationId).order("created_at", { ascending: false }),
    supabase.from("vendors").select("*").eq("association_id", associationId),
    supabase.from("amenities").select("*").eq("association_id", associationId),
    supabase.from("announcements").select("*").eq("association_id", associationId).order("posted_on", { ascending: false }),
    // Each of these is scoped by row level security as well as by the filter:
    // a resident's instruments are their own, a report is its reporter's, and
    // the board's tables come back empty for anyone else.
    supabase.from("payment_instruments").select("*").eq("association_id", associationId).order("added_on"),
    supabase.from("payouts").select("*").eq("association_id", associationId).order("issued_on", { ascending: false }),
    supabase.from("violation_reports").select("*").eq("association_id", associationId).order("submitted_on", { ascending: false }),
    supabase.from("violations").select("*").eq("association_id", associationId).order("opened_on", { ascending: false }),
    supabase.from("threads").select("*").eq("association_id", associationId).order("updated_on", { ascending: false }),
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
    supabase.from("post_replies").select("*").eq("association_id", associationId).order("created_at"),
    // Board-only rows. RLS hands a resident nothing here, and nothing is
    // what their screens show, so the same query serves both.
    supabase.from("action_items").select("*").eq("association_id", associationId).order("created_at"),
    supabase.from("join_requests").select("*").eq("association_id", associationId).order("created_at", { ascending: false }),
    supabase.from("email_log").select("*").eq("association_id", associationId).order("sent_at", { ascending: false }).limit(300),
  ]);

  // Files open through short lived signed links, made in one batch here so a
  // row is a plain link on every screen. Storage applies the same visibility
  // rule as the table, so a resident is only ever handed links to what they
  // may read.
  const filePaths = (documents.data ?? [])
    .map((d: { storage_path: string | null }) => d.storage_path)
    .filter((path: string | null): path is string => Boolean(path));
  const urlByPath = new Map<string, string>();
  if (filePaths.length) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrls(filePaths, SIGNED_URL_SECONDS);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl && !item.error) urlByPath.set(item.path, item.signedUrl);
    }
  }

  if (association.error || !association.data) {
    throw new Error(`Could not load that association: ${association.error?.message ?? "not found"}`);
  }

  const a = association.data;
  // Display preferences with no column of their own live in a jsonb patch.
  const stored = (a.settings ?? {}) as Partial<CommunitySettings>;
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
    // The oldest unpaid charge sets how far past due a household is. Money
    // is applied oldest first, so what is still owed is the newest charges
    // whose amounts add up to the balance; the oldest of those is the one
    // the clock runs from. Reading the oldest charge of all, which this once
    // did, said a home one month behind was a year late.
    let uncovered = balanceCents;
    let oldestOpen: (typeof chargeRows)[number] | undefined;
    for (const c of [...chargeRows]
      .filter((c) => c.unit_id === unit.id && c.kind === "charge" && c.due_on <= today)
      .sort((x, y) => (x.due_on > y.due_on ? -1 : 1))) {
      if (uncovered <= 0) break;
      oldestOpen = c;
      uncovered -= c.amount_cents;
    }
    const daysPastDue =
      balanceCents > 0 && oldestOpen ? Math.max(0, daysBetween(oldestOpen.due_on, today)) : 0;

    const members = memberRows
      .filter((m) => m.unit_id === unit.id)
      .map((m) => m.full_name)
      .filter(Boolean);

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
      email: holder?.invited_email ?? "",
      phone: holder?.phone ?? "",
      mailingAddress: holder?.mailing_address || undefined,
      unit: unit.label,
      address: unit.address,
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

  // Statements keyed by home, each line carrying the balance after it. The
  // running figure is derived here from the same rows the balance view sums,
  // oldest first, so the statement and the balance cannot disagree.
  const ownerCharges: Record<string, ChargeLine[]> = {};
  for (const unit of unitRows) ownerCharges[unit.id] = [];
  const running = new Map<string, number>();
  for (const c of [...chargeRows].sort((x, y) =>
    x.due_on === y.due_on ? x.created_at.localeCompare(y.created_at) : x.due_on.localeCompare(y.due_on),
  )) {
    const after = (running.get(c.unit_id) ?? 0) + c.amount_cents;
    running.set(c.unit_id, after);
    (ownerCharges[c.unit_id] ??= []).push({
      id: c.id,
      date: c.due_on,
      label: c.label,
      kind: c.kind,
      amountCents: c.amount_cents,
      balanceAfterCents: after,
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
    instruments: (instruments.data ?? []).map((i) => ({
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

    bankAccounts: (banks.data ?? []).map((b) => ({
      id: b.id,
      name: `${b.kind[0].toUpperCase()}${b.kind.slice(1)} account`,
      institution: b.institution,
      mask: b.mask,
      kind: b.kind,
      // What the books say is in the account. There is no bank feed yet, so
      // the ledger is the only source; a fixed zero read as "broke" on the
      // dashboard of an association with a year of dues behind it.
      balanceCents: (ledger.data ?? [])
        .filter((e) => e.bank_account_id === b.id)
        .reduce((total, e) => total + e.amount_cents, 0),
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

    budget: (budgetRows.data ?? []).length
      ? (budgetRows.data ?? []).map((line) => ({
          category: line.category as Community["budget"][number]["category"],
          annualCents: Number(line.annual_cents),
          // Actuals come from the books, never from a typed number, so the
          // budget screen and the ledger cannot disagree.
          ytdActualCents: (ledger.data ?? [])
            .filter((e) => e.category === line.category)
            .filter((e) => (line.kind === "income" ? e.amount_cents > 0 : e.amount_cents < 0))
            .reduce((total, e) => total + Math.abs(e.amount_cents), 0),
          kind: line.kind as "income" | "expense",
        }))
      : [
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
      status: p.status,
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
      time: m.held_at,
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
      const mine = (myVotes.data ?? []).find((v) => v.ballot_id === b.id);
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
  };
}
