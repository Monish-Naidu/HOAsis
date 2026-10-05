"use client";

import {
  ArrowRightLeft,
  Banknote,
  Building2,
  ChevronDown,
  Download,
  Link2 as LinkIcon,
  Lock,
  Mail,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, ButtonLink, Callout, Card, EmptyState, KeyValue, PageHeader, Segmented, Select, Field, fieldClass, textareaClass } from "@/components/ui/primitives";
import { RemindersComposer } from "@/components/app/reminders-composer";
import { AskedToJoin } from "./asked-to-join";
import { JoinCodeRow } from "./join-code-row";
import { ChangeEmailForm, SecondOwnerForm } from "./owner-forms";
import {
  AddChargeForm,
  AddCreditForm,
  ChangeDuesForm,
  HandPaymentsPanel,
  RecordPaymentForm,
  type HandPaymentsState,
} from "./household-money";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { inviteUrl, remoteInviteUrl } from "@/lib/invitations";
import { communitySlug, delinquency } from "@/lib/metrics";
import { policyFor } from "@/lib/collections";
import { dueLetter, renderLetter } from "@/lib/letters";
import type { HomeType, MessageThread, Owner } from "@/lib/types";
import type { ManualMethod } from "@/lib/payments/instruments";
import type { ManualPaymentRow } from "@/lib/payments/manual-payments";
import {
  HOME_TYPE_LABEL,
  HOME_TYPES,
  countByType,
  duesSource,
  duesSourceLabel,
  duesVary,
  ownerDues,
} from "@/lib/home-types";
import { cn, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

/**
 * Who lives here, how to reach them, and whether they are paying.
 *
 * Everything about how far behind somebody is and what to do about it lives
 * under Finances. This screen answers the three questions a board member has
 * when a name comes up, and lets them write to that person from the same row.
 */

type Filter = "all" | "paid" | "behind";

const PAGE = 50;

const input =
  fieldClass;

/** The invitation route looks up at most this many homes in one call. */
const INVITE_BATCH = 200;
/**
 * How many times one batch is asked for. The route stops before its time
 * limit and answers with who is left, and two hundred addresses are three
 * calls or so. The rest is room, not an invitation to ask for ever.
 */
const INVITE_CALLS = 8;

/** What an invitation run came to, across every call it took. */
export interface InviteOutcome {
  sent: number;
  /** Invited in the last hour, before this press, and passed over. */
  already: number;
  /** Not sent: a bad address, or a home the run never got to. */
  failed: number;
  /** Why some were not sent, in the route's own words. */
  reason?: string;
  /** The route refused, or could not be reached, before the run was through. */
  refused?: boolean;
}

/** A count out of the route's answer, or zero. */
const counted = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);

/**
 * Sends the invitations, two hundred homes at a time.
 *
 * Every waiting home used to go in one call. The route reads the first two
 * hundred and no more, so in a larger association the homes past that were
 * never invited, never counted, and pressing again sent the same first two
 * hundred ids. Each batch is asked again while the route says homes remain
 * and the number is going down; the route passes over whoever it reached.
 */
export async function sendInvitations(
  associationId: string,
  unitIds: string[],
): Promise<InviteOutcome> {
  const batches: string[][] = [];
  for (let at = 0; at < unitIds.length; at += INVITE_BATCH) {
    batches.push(unitIds.slice(at, at + INVITE_BATCH));
  }
  // The route reads a call for one home as a press for that household and
  // always sends it, so a last batch of one would be invited again on every
  // press. It borrows a home from the batch before.
  const last = batches[batches.length - 1];
  if (batches.length > 1 && last.length === 1) last.unshift(batches[batches.length - 2].pop()!);

  const outcome: InviteOutcome = { sent: 0, already: 0, failed: 0 };
  for (let index = 0; index < batches.length; index++) {
    let sent = 0;
    let already = 0;
    let failed = 0;
    let remaining = batches[index].length;
    let left = Infinity;
    let line: string | undefined;
    let refusal: string | null = null;
    for (let call = 0; call < INVITE_CALLS; call++) {
      let ok = false;
      let answer: {
        sent?: unknown;
        failed?: unknown;
        already?: unknown;
        remaining?: unknown;
        errors?: unknown;
        error?: unknown;
      } = {};
      try {
        const response = await fetch("/api/email/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ associationId, unitIds: batches[index], kind: "invite" }),
        });
        answer = ((await response.json().catch(() => null)) ?? {}) as typeof answer;
        ok = response.ok;
      } catch {
        refusal = "The mail service could not be reached. Try again in a few minutes.";
        break;
      }
      if (!ok) {
        refusal =
          typeof answer.error === "string" && answer.error ? answer.error : "Could not send the invitations. Try again in a few minutes.";
        break;
      }
      remaining = counted(answer.remaining);
      // A later call passes over the homes an earlier call of this run
      // reached and counts them as already invited. Taken off, what is left
      // is who had the invitation before the button was pressed.
      already = Math.max(already, counted(answer.already) - sent);
      sent += counted(answer.sent);
      // The route counts the homes it did not reach among the failed, and a
      // bad address is tried again on the next call, so the worst single
      // call is the count.
      failed = Math.max(failed, counted(answer.failed) - remaining);
      line = Array.isArray(answer.errors) && typeof answer.errors[0] === "string" ? answer.errors[0] : undefined;
      if (remaining === 0 || remaining >= left) break;
      left = remaining;
    }
    outcome.sent += sent;
    outcome.already += already;
    outcome.failed += failed + remaining;
    if (refusal !== null) {
      // Nothing after this would be let through either. Every home not
      // reached is counted, this batch's and the ones never started.
      for (const later of batches.slice(index + 1)) outcome.failed += later.length;
      outcome.reason = refusal;
      outcome.refused = true;
      return outcome;
    }
    if (failed + remaining > 0 && line && !outcome.reason) outcome.reason = line;
  }
  return outcome;
}

/** What the board is told when the run is over. `only` names a single household. */
export function inviteToast(
  outcome: InviteOutcome,
  only?: string,
): { message: string; tone: "ok" | "warn" } {
  if (outcome.refused && outcome.sent + outcome.already === 0) {
    return { message: outcome.reason ?? "Could not send the invitations. Try again in a few minutes.", tone: "warn" };
  }
  if (only && outcome.sent === 1 && outcome.failed === 0) {
    return { message: `Invitation sent to ${only}`, tone: "ok" };
  }
  const parts = [`${pluralize(outcome.sent, "invitation")} sent`];
  if (outcome.already) parts.push(`${outcome.already} already invited in the last hour`);
  if (outcome.failed) parts.push(`${outcome.failed} not sent`);
  const why = outcome.failed && outcome.reason ? `. ${outcome.reason}` : "";
  return { message: `${parts.join(", ")}${why}`, tone: outcome.failed ? "warn" : "ok" };
}

export function HomeownersScreen() {
  const {
    community,
    threads,
    templates,
    accounts,
    addOwner,
    removeOwner,
    transferHome,
    replyToThread,
    messageOwner,
    setHouseholdOwner,
    addSecondOwner,
    changeOwnerEmail,
    setHomeType,
    setHomeDues,
    recordManualPayment,
    reverseManualPayment,
    manualPaymentsFor,
    addCredit,
    addCharge,
    can,
    sees,
    isRemote,
  } = useAppState();
  const params = useSearchParams();
  const { notify } = useToast();

  const owners = community.owners;
  const delinq = delinquency(community);
  // Homes with nobody on record are neither paid up nor behind.
  const paidUp = delinq.current;
  // Opening balances are for an association that switched here mid-life. A
  // new build starts every home at zero, so for it the screen is noise.
  const showOpeningBalances =
    community.profile?.origin !== "builder" && community.profile?.origin !== "handover";

  const [filter, setFilter] = useState<Filter>("all");
  // A mixed community can narrow the roster to one kind of home.
  const kinds = countByType(owners);
  const mixed = kinds.length > 1;
  const [kind, setKind] = useState<HomeType | "all">("all");
  // Search from the top bar lands here with the household's name filled in.
  const [query, setQuery] = useState(params.get("q") ?? "");
  // Search's "Open home" shortcut lands with one household expanded.
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [focusComposer, setFocusComposer] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState<{
    name: string;
    email: string;
    unit: string;
    homeType?: HomeType;
  }>({ name: "", email: "", unit: "" });
  const [sale, setSale] = useState<{
    open: boolean;
    ownerId: string | null;
    name: string;
    email: string;
    closingDate: string;
    settle: boolean;
  }>({ open: false, ownerId: null, name: "", email: "", closingDate: todayIsoDate(), settle: true });
  // The Collections ladder on Finances links here with the composer open.
  const [reminding, setReminding] = useState(params.get("remind") === "1");
  const policy = policyFor(community.settings);

  const maySeeRoster = sees("finances") || sees("communications");
  // Balances, standing and sales are the books. Without the finances
  // capability the balances come back empty, and a roster of "Paid up" for
  // every home is a false statement, so the money columns are not drawn.
  const seesMoney = sees("finances");
  // Seeing the books is not changing them. A look-only seat was offered the
  // sale and the opening balances, pressed them, and the database refused.
  const changesMoney = can("finances");
  // The invitation route takes either capability, so the button asks the same.
  const mayInvite = can("settings") || can("communications");
  // Changing who is on the register is the settings capability, the same one
  // Add household and the decision on a join request ask.
  const mayChangeRoster = can("settings");
  const [inviting, setInviting] = useState(false);

  // Behind first, furthest behind at the top, then by unit.
  const sorted = useMemo(
    () =>
      [...owners].sort((a, b) => {
        if (a.daysPastDue !== b.daysPastDue) return b.daysPastDue - a.daysPastDue;
        return Number(a.unit) - Number(b.unit);
      }),
    [owners],
  );

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sorted.filter((o) => {
      if (filter === "paid" && (o.daysPastDue > 0 || o.placeholder)) return false;
      if (filter === "behind" && o.daysPastDue === 0) return false;
      if (kind !== "all" && o.homeType !== kind) return false;
      if (!needle) return true;
      return (
        o.displayName.toLowerCase().includes(needle) ||
        o.members.some((m) => m.toLowerCase().includes(needle)) ||
        o.unit === needle ||
        o.address.toLowerCase().includes(needle) ||
        o.email.toLowerCase().includes(needle)
      );
    });
  }, [sorted, filter, query, kind]);
  const visible = matching.slice(0, shown);

  const segments: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: owners.length },
    { key: "paid", label: "Paid up", count: paidUp },
    { key: "behind", label: "Past due", count: delinq.past.length },
  ];

  function toggle(owner: Owner, withComposer = false) {
    const opening = openId !== owner.id || withComposer;
    setOpenId(opening ? owner.id : null);
    setFocusComposer(withComposer);
  }

  function saveOwner() {
    try {
      const owner = addOwner({ ...entry, homeType: mixed ? (entry.homeType ?? kinds[0].type) : undefined });
      setEntry({ name: "", email: "", unit: "" });
      setAdding(false);
      notify(`Added ${owner.displayName}, ${homeLabel(community, owner.unit)}`, "ok", {
        label: "Undo",
        onClick: () => removeOwner(owner.id)(),
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add that household", "warn");
    }
  }

  function startSale(owner: Owner | null, buyer?: { name: string; email: string }) {
    setSale({
      open: true,
      ownerId: owner?.id ?? null,
      name: buyer?.name ?? "",
      email: buyer?.email ?? "",
      closingDate: todayIsoDate(),
      settle: true,
    });
    setAdding(false);
  }

  function recordSale() {
    const seller = owners.find((o) => o.id === sale.ownerId);
    if (!seller) return;
    const buyer = sale.name.trim();
    void Promise.resolve(
      transferHome(seller.id, {
        name: sale.name,
        email: sale.email,
        closingDate: sale.closingDate,
        settleBalance: sale.settle,
      }),
    ).then((ok) => {
      // The database can refuse a closing date, and it says so itself. A
      // success toast on top of that refusal would be two answers at once.
      if (ok) notify(`${homeLabel(community, seller.unit)} is now ${buyer}'s`);
    });
    setSale((s) => ({ ...s, open: false }));
    if (openId === seller.id) setOpenId(null);
  }

  function remove(owner: Owner) {
    const undo = removeOwner(owner.id);
    if (openId === owner.id) setOpenId(null);
    notify(`Removed ${owner.displayName}`, "warn", { label: "Undo", onClick: undo });
  }

  /**
   * Who has not signed up yet.
   *
   * A real association knows: an account exists once the seat is claimed. A
   * demo has an account for everybody, so nobody there is waiting.
   */
  const notSignedUp = isRemote
    ? owners.filter((o) => o.email && !accounts.some((a) => a.ownerId === o.id))
    : [];

  function inviteLinkFor(owner: Owner): string {
    return isRemote && community.association.joinCode
      ? remoteInviteUrl(community.association.joinCode, owner.email, window.location.origin)
      : inviteUrl(community.id, owner.id, window.location.origin);
  }

  function copyInvite(owner: Owner) {
    const url = inviteLinkFor(owner);
    navigator.clipboard
      .writeText(url)
      .then(() => notify(`Invitation link for ${owner.displayName} copied`, "ok"))
      .catch(() => notify("Could not copy. Select the link and copy it manually.", "warn"));
  }

  /** Emails the invitation, to one household or to everyone still waiting. */
  async function emailInvites(recipients: Owner[]) {
    const withEmail = recipients.filter((o) => o.email.trim());
    if (!withEmail.length) {
      notify("Nobody here has an email address yet", "warn");
      return;
    }
    // One send at a time: a second press while the first was still going
    // out mailed every household twice.
    if (inviting) return;
    setInviting(true);
    try {
      const outcome = await sendInvitations(
        community.id,
        withEmail.map((o) => o.id),
      );
      const { message, tone } = inviteToast(
        outcome,
        withEmail.length === 1 ? withEmail[0].displayName : undefined,
      );
      notify(message, tone);
    } catch {
      notify("Could not send the invitations. Try again in a few minutes.", "warn");
    } finally {
      setInviting(false);
    }
  }

  /**
   * A note continues the household's latest thread. A letter starts its own,
   * under its own subject, because a dues reminder is not a reply to a
   * question about the pool.
   */
  function send(owner: Owner, body: string, subject?: string) {
    const thread = threadFor(threads, owner);
    if (subject) messageOwner(owner.id, subject, body, "Billing");
    else if (thread) replyToThread(thread.id, body);
    else messageOwner(owner.id, `A note from the ${community.settings.displayName} board`, body);
    notify(`Sent to ${owner.displayName}`, "ok");
  }

  function exportRoster() {
    const csv = toCsv(matching, [
      { header: "Unit", value: (o) => o.unit },
      { header: "Household", value: (o) => o.displayName },
      { header: "Address", value: (o) => o.address },
      ...(mixed
        ? [{ header: "Kind", value: (o: Owner) => (o.homeType ? HOME_TYPE_LABEL[o.homeType].one : "") }]
        : []),
      { header: "Email", value: (o) => o.email },
      { header: "Phone", value: (o) => o.phone },
      // What each home pays per period, by the one rule: its own amount,
      // else its kind's, else the association's.
      { header: "Dues", value: (o) => (ownerDues(community.association, o) / 100).toFixed(2) },
      ...(seesMoney
        ? [
            { header: "Balance", value: (o: Owner) => (o.balanceCents / 100).toFixed(2) },
            { header: "Days past due", value: (o: Owner) => o.daysPastDue },
            { header: "Autopay", value: (o: Owner) => (o.autopay ? "yes" : "no") },
          ]
        : []),
    ]);
    downloadCsv(`${communitySlug(community)}-roster.csv`, csv);
    notify(`Exported ${pluralize(matching.length, "household")}`);
  }

  if (!maySeeRoster) {
    return (
      <Callout tone="warn" icon={<Lock className="size-4" />} title="You cannot see the homeowner register">
        It shows every household&apos;s balance and contact details, so it needs access to Finances
        or Messages. The President can give you that access.
      </Callout>
    );
  }

  const seller = owners.find((o) => o.id === sale.ownerId) ?? null;

  return (
    <>
      <PageHeader
        title="Homeowners"
        description={seesMoney ? "Every home, its owner, contact details, and balance." : "Every home, its owner, and how to reach them."}
        action={
          <div className="flex gap-2">
            <Button
              variant={notSignedUp.length > 0 ? "secondary" : "primary"}
              size="md"
              onClick={() => {
                setAdding((v) => !v);
                setSale((s) => ({ ...s, open: false }));
              }}
            >
              <Plus className="size-3.5" />
              Add household
            </Button>
            {notSignedUp.length > 0 && mayInvite ? (
              <Button
                variant="primary"
                size="md"
                disabled={inviting}
                onClick={() => void emailInvites(notSignedUp)}
                aria-label={`Email invitations to the ${notSignedUp.length} households not signed up`}
              >
                <Send className="size-3.5" />
                {inviting ? "Sending" : `Invite ${notSignedUp.length} not signed up`}
              </Button>
            ) : null}
            {/* Reminders are sent from Finances > Past due, which opens
                the composer here with ?remind=1. One place to send them. */}
          </div>
        }
      />

      {reminding && seesMoney ? <RemindersComposer onClose={() => setReminding(false)} /> : null}

      {mayInvite && community.association.joinCode ? (
        <JoinCodeRow code={community.association.joinCode} />
      ) : null}

      {maySeeRoster ? (
        <AskedToJoin
          onRecordSale={
            changesMoney
              ? (ownerId, buyer) => {
                  const home = owners.find((o) => o.id === ownerId);
                  if (home) startSale(home, buyer);
                }
              : undefined
          }
        />
      ) : null}

      <Card className="mt-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          {seesMoney ? (
            <Segmented
              label="Show households"
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setShown(PAGE);
              }}
              options={segments.map((seg) => ({ value: seg.key, label: seg.label, count: seg.count }))}
              className="pointer-coarse:[&>button]:h-9"
            />
          ) : (
            <p className="tnum text-footnote font-medium text-fg-muted">{pluralize(owners.length, "home")}</p>
          )}
          <div className="flex flex-wrap items-center gap-1">
            {mixed ? (
              <Select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as HomeType | "all");
                  setShown(PAGE);
                }}
                aria-label="Kind of home"
                className="mr-1"
              >
                <option value="all">All kinds</option>
                {kinds.map(({ type, count }) => (
                  <option key={type} value={type}>
                    {HOME_TYPE_LABEL[type].many} ({count})
                  </option>
                ))}
              </Select>
            ) : null}
            <div className="mr-1 flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border-2 px-2.5 focus-within:border-primary">
              <Search className="size-3.5 text-fg-subtle" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="Search owners"
                aria-label="Search owners"
                className="w-40 min-w-0 bg-transparent text-footnote text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
            {changesMoney ? (
              <Button variant="ghost" size="sm" onClick={() => startSale(null)}>
                <ArrowRightLeft className="size-3.5" />
                Record a sale
              </Button>
            ) : null}
            {can("settings") ? (
              <ButtonLink href="/board/homeowners/import" variant="ghost" size="sm">
                <Upload className="size-3.5" />
                Import roster
              </ButtonLink>
            ) : null}
            <Button variant="ghost" size="sm" onClick={exportRoster}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Add a household */}
        {adding ? (
          <div className="border-b border-border px-5 py-4">
            <p className="text-body font-semibold text-fg">New household</p>
            <div
              className={cn(
                "mt-3 grid items-end gap-3",
                mixed
                  ? "sm:grid-cols-[1fr_1fr_6rem_9rem_auto_auto]"
                  : "sm:grid-cols-[1fr_1fr_6rem_auto_auto]",
              )}
            >
              <Field label="Household name">
                <input
                  value={entry.name}
                  onChange={(e) => setEntry({ ...entry, name: e.target.value })}
                  placeholder="Household name"
                  aria-label="Household name"
                  onKeyDown={(e) => e.key === "Enter" && saveOwner()}
                  className={input}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={entry.email}
                  onChange={(e) => setEntry({ ...entry, email: e.target.value })}
                  placeholder="Email"
                  aria-label="Household email"
                  onKeyDown={(e) => e.key === "Enter" && saveOwner()}
                  className={input}
                />
              </Field>
              <Field label="Unit">
                <input
                  value={entry.unit}
                  onChange={(e) => setEntry({ ...entry, unit: e.target.value })}
                  placeholder="Unit"
                  aria-label="Unit"
                  onKeyDown={(e) => e.key === "Enter" && saveOwner()}
                  className={input}
                />
              </Field>
              {mixed ? (
                <Field label="Kind of home">
                  <Select
                    value={entry.homeType ?? kinds[0].type}
                    onChange={(e) => setEntry({ ...entry, homeType: e.target.value as HomeType })}
                    aria-label="Kind of home"
                    className="w-full [&>select]:min-h-11"
                  >
                    {HOME_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {HOME_TYPE_LABEL[t].one}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Button
                variant="primary"
                size="md"
                onClick={saveOwner}
                disabled={!entry.name.trim() || !entry.unit.trim()}
              >
                Save
              </Button>
              <Button variant="ghost" size="md" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {/* Record a sale */}
        {sale.open ? (
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body font-semibold text-fg">
                  {seller ? `Record the sale of ${homeLabel(community, seller.unit)}` : "Record a sale"}
                </p>
                <p className="mt-0.5 text-footnote leading-relaxed text-fg-muted">
                  {seller
                    ? `${seller.displayName} loses access as soon as you record this, so record it on or after closing. The home keeps its statement. The buyer does not see the seller's requests, messages or votes.`
                    : "Pick the home. The seller loses access as soon as you record the sale, so record it on or after closing."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSale((s) => ({ ...s, open: false }))}
              >
                Cancel
              </Button>
            </div>
            <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_10rem_auto]">
              <Field label="Home being sold">
                <Select
                  value={sale.ownerId ?? ""}
                  onChange={(e) => setSale({ ...sale, ownerId: e.target.value || null })}
                  aria-label="Home being sold"
                  className="w-full [&>select]:min-h-11"
                >
                  <option value="">Which home?</option>
                  {[...owners]
                    .sort((a, b) => Number(a.unit) - Number(b.unit))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {homeLabel(community, o.unit)} · {o.displayName}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Buyer name">
                <input
                  value={sale.name}
                  onChange={(e) => setSale({ ...sale, name: e.target.value })}
                  placeholder="Buyer name"
                  aria-label="Buyer name"
                  className={input}
                />
              </Field>
              <Field label="Buyer email">
                <input
                  type="email"
                  value={sale.email}
                  onChange={(e) => setSale({ ...sale, email: e.target.value })}
                  placeholder="Buyer email"
                  aria-label="Buyer email"
                  className={input}
                />
              </Field>
              <Field label="Closing date">
                <input
                  type="date"
                  value={sale.closingDate}
                  // A sale takes effect when it is recorded, whatever its
                  // date: the seller's seat ends there and then. A date
                  // still to come would lock them out before they had sold.
                  max={todayIsoDate()}
                  onChange={(e) => setSale({ ...sale, closingDate: e.target.value })}
                  aria-label="Closing date"
                  className={input}
                />
              </Field>
              <Button
                variant="primary"
                size="md"
                // The picker's max stops a click; this stops a typed date.
                disabled={
                  !seller || !sale.name.trim() || !sale.closingDate || sale.closingDate > todayIsoDate()
                }
                onClick={recordSale}
              >
                Record the sale
              </Button>
            </div>
            {seller && seller.balanceCents > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-footnote">
                <span className="font-medium text-fg">
                  {money(seller.balanceCents)} is owed on this home.
                </span>
                <label className="inline-flex items-center gap-1.5 text-fg-muted">
                  <input
                    type="radio"
                    name="settle"
                    checked={sale.settle}
                    onChange={() => setSale({ ...sale, settle: true })}
                  />
                  Settled at closing
                </label>
                <label className="inline-flex items-center gap-1.5 text-fg-muted">
                  <input
                    type="radio"
                    name="settle"
                    checked={!sale.settle}
                    onChange={() => setSale({ ...sale, settle: false })}
                  />
                  Carries to the buyer
                </label>
              </div>
            ) : null}
            {/* Credit goes with the home. Nothing here moves it, so the
                board hears about it before the buyer inherits it. */}
            {seller && seller.balanceCents < 0 ? (
              <p className="mt-3 text-footnote text-fg-muted">
                <span className="font-medium text-fg">
                  This home has {money(-seller.balanceCents)} in credit.
                </span>{" "}
                It stays with the home, so the buyer gets it unless you settle it with the seller
                first.
              </p>
            ) : null}
            {sale.closingDate > todayIsoDate() ? (
              <p className="mt-3 text-footnote font-medium text-warn">
                Closing has not happened yet. Come back and record the sale on that day.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Roster */}
        {visible.length === 0 ? (
          <EmptyState
            title={query.trim() ? "Nobody matches" : filter === "behind" ? "Nobody is past due" : "No households yet"}
            description={query.trim() ? "Try a name, unit, address or email." : undefined}
          />
        ) : (
          <ul>
            {visible.map((o) => {
              const open = openId === o.id;
              return (
                <li key={o.id} className="border-b border-border last:border-b-0">
                  {/* A fixed grid, so the contact column and the chevron line
                      up down the list instead of drifting with the length of
                      each name. Under md the contact folds under the name. */}
                  <div
                    className={cn(
                      "group/row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_1.25rem_15rem]",
                      open ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(o)}
                      aria-expanded={open}
                      aria-label={`${o.displayName}, ${homeLabel(community, o.unit)}`}
                      className="col-span-1 grid min-w-0 grid-cols-subgrid items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand md:col-span-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                      {o.isCorporateOwner ? (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg-muted">
                          <Building2 className="size-4" />
                        </span>
                      ) : (
                        // An unsold lot has no named resident. The display name
                        // is the builder, who holds it and owes the assessment.
                        <Avatar name={o.members[0] ?? o.displayName} className="size-9" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="min-w-0 truncate text-body font-medium text-fg">
                            {o.displayName}
                          </span>
                          {o.boardRole ? <Badge tone="brand">{o.boardRole}</Badge> : null}
                          {isRemote && o.email && !o.placeholder && !accounts.some((a) => a.ownerId === o.id) ? (
                            <Badge tone="neutral">Not signed up</Badge>
                          ) : null}
                        </span>
                        <span className="block truncate text-footnote text-fg-muted">
                          {homeLabel(community, o.unit)}
                          {mixed && o.homeType ? ` · ${HOME_TYPE_LABEL[o.homeType].short}` : ""}
                          {o.address && o.address !== o.unit && o.address !== homeLabel(community, o.unit)
                            ? ` · ${o.address}`
                            : ""}
                        </span>
                        <span className="block truncate text-footnote text-fg-subtle md:hidden">
                          {o.email}
                        </span>
                      </span>
                      </span>
                      <span className="hidden min-w-0 md:block">
                        <span className="block truncate text-footnote text-fg-muted">{o.email}</span>
                        <span className="tnum block text-footnote text-fg-subtle">{o.phone}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "hidden size-4 shrink-0 text-fg-subtle transition-transform md:block",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {/* Fixed width, so the trailing column never pushes the
                        contact column around from row to row. */}
                    <span className="flex shrink-0 items-center justify-end gap-2 md:grid md:grid-cols-[5rem_minmax(0,1fr)_2rem] md:gap-3">
                      <span className="tnum hidden text-right text-body font-semibold text-fg md:block">
                        {seesMoney && o.balanceCents > 0 ? money(o.balanceCents) : ""}
                      </span>
                      <span className="flex justify-end whitespace-nowrap md:justify-start">
                        {seesMoney || o.placeholder ? (
                          <DuesBadge owner={o} unsold={community.profile?.origin === "builder"} />
                        ) : null}
                      </span>
                      {/* A glyph, not 88 bordered buttons down the page. On a
                          desktop it shows on the row under the pointer or
                          keyboard; under lg there is no hover, so it stays. */}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={o.placeholder ? `Add the owner of ${o.unit}` : `Message ${o.displayName}`}
                        title={o.placeholder ? "Add owner" : "Message"}
                        onClick={() => toggle(o, true)}
                        className={cn(
                          "size-8 px-0",
                          !open &&
                            "lg:opacity-0 lg:group-hover/row:opacity-100 lg:group-focus-within/row:opacity-100",
                        )}
                      >
                        {o.placeholder ? <Plus className="size-4" /> : <Mail className="size-4" />}
                      </Button>
                    </span>
                  </div>
                  {open ? (
                    <HouseholdDetail
                      key={o.id}
                      owner={o}
                      thread={threadFor(threads, o)}
                      focusComposer={focusComposer}
                      letter={(() => {
                        const template = dueLetter(o, policy, templates);
                        return template
                          ? { name: template.name, ...renderLetter(template, o, community) }
                          : null;
                      })()}
                      onSend={(body, subject) => send(o, body, subject)}
                      onSetOwner={(name, email) =>
                        void setHouseholdOwner(o.id, { name, email }).then((ok) => {
                          if (ok) notify(`${name} is on ${o.unit}`);
                        })
                      }
                      onSale={changesMoney ? () => startSale(o) : undefined}
                      onRecordPayment={
                        changesMoney && !o.placeholder
                          ? (input) =>
                              Promise.resolve(recordManualPayment({ ownerId: o.id, ...input })).then((ok) => {
                                if (ok) notify(`Recorded ${money(input.amountCents)} from ${o.displayName}`, "ok");
                                return ok;
                              })
                          : undefined
                      }
                      homeName={homeLabel(community, o.unit)}
                      onLoadHandPayments={changesMoney && !o.placeholder ? () => manualPaymentsFor(o.id) : undefined}
                      onReverseHandPayment={
                        changesMoney && !o.placeholder
                          ? (paymentId, reason) =>
                              Promise.resolve(reverseManualPayment(paymentId, reason)).then((ok) => {
                                if (ok) notify(`Payment reversed for ${homeLabel(community, o.unit)}.`, "ok");
                                return ok;
                              })
                          : undefined
                      }
                      onAddCredit={
                        changesMoney && !o.placeholder
                          ? (input) =>
                              Promise.resolve(addCredit({ ownerId: o.id, ...input })).then((ok) => {
                                if (ok) notify(`Added a ${money(input.amountCents)} credit to ${o.displayName}`, "ok");
                                return ok;
                              })
                          : undefined
                      }
                      onAddCharge={
                        changesMoney && !o.placeholder
                          ? (input) =>
                              Promise.resolve(addCharge({ ownerId: o.id, ...input })).then((ok) => {
                                if (ok) notify(`Charge added to ${homeLabel(community, o.unit)}.`, "ok");
                                return ok;
                              })
                          : undefined
                      }
                      onChangeDues={
                        changesMoney
                          ? (cents) =>
                              // Said once the write is back. A refusal has
                              // already been said by the write itself.
                              Promise.resolve(setHomeDues([{ ownerId: o.id, cents }])).then((ok) => {
                                if (ok) {
                                  const pays = ownerDues(community.association, {
                                    homeType: o.homeType,
                                    duesCents: cents ?? undefined,
                                  });
                                  notify(`${homeLabel(community, o.unit)} pays ${money(pays)} from the next bill.`, "ok");
                                }
                                return ok;
                              })
                          : undefined
                      }
                      duesNow={{
                        cents: ownerDues(community.association, o),
                        sourceLabel: duesSourceLabel(community.association, o),
                        hasOwn: duesSource(community.association, o) === "own",
                        standardCents: ownerDues(community.association, { homeType: o.homeType }),
                        period:
                          community.association.duesCadence === "monthly"
                            ? "month"
                            : community.association.duesCadence === "quarterly"
                              ? "quarter"
                              : "year",
                      }}
                      duesLine={
                        duesVary(community.association, community.owners)
                          ? `${money(ownerDues(community.association, o))} ${community.association.duesCadence}`
                          : undefined
                      }
                      onSetKind={
                        mixed || o.homeType
                          ? (next) =>
                              // Said once the write is back. A refusal has
                              // already been said by the write itself.
                              void Promise.resolve(setHomeType([o.id], next)).then((ok) => {
                                if (!ok) return;
                                notify(
                                  `${homeLabel(community, o.unit)} is a ${HOME_TYPE_LABEL[next].one.toLowerCase()}. It is billed that way from the next bill.`,
                                );
                              })
                          : undefined
                      }
                      onChangeEmail={
                        mayChangeRoster && !o.placeholder && (!isRemote || !accounts.some((a) => a.ownerId === o.id))
                          ? (email) =>
                              Promise.resolve(changeOwnerEmail(o.id, email)).then((ok) => {
                                if (ok) notify(`${o.displayName}'s email is now ${email}`, "ok");
                                return ok;
                              })
                          : undefined
                      }
                      onAddSecondOwner={
                        mayChangeRoster && !o.placeholder
                          ? (name, email) =>
                              Promise.resolve(addSecondOwner(o.id, { name, email })).then((ok) => {
                                if (!ok) return false;
                                // The usual invitation is the link with the
                                // address on it. Emailing it would also reach
                                // the first owner, because the route writes to
                                // every address on a home.
                                if (isRemote && community.association.joinCode) {
                                  const link = remoteInviteUrl(community.association.joinCode, email, window.location.origin);
                                  void navigator.clipboard?.writeText(link).catch(() => undefined);
                                  notify(`${name} added to ${homeLabel(community, o.unit)}. Their invitation link is copied`, "ok");
                                } else {
                                  notify(`${name} added to ${homeLabel(community, o.unit)}`, "ok");
                                }
                                return true;
                              })
                          : undefined
                      }
                      onInvite={() => copyInvite(o)}
                      onEmailInvite={isRemote && o.email && mayInvite ? () => void emailInvites([o]) : undefined}
                      signedUp={!isRemote || accounts.some((a) => a.ownerId === o.id)}
                      onRemove={() => remove(o)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {matching.length > PAGE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="tnum text-footnote text-fg-muted">
              Showing {visible.length} of {matching.length}
            </p>
            {visible.length < matching.length ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, matching.length - visible.length)} more
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShown(matching.length)}>
                  Show all
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShown(PAGE)}>
                Show fewer
              </Button>
            )}
          </div>
        ) : null}
        {showOpeningBalances && changesMoney ? (
          <p className="border-t border-border px-5 py-3 text-footnote text-fg-muted">
            Switched from another system?{" "}
            <Link href="/board/homeowners/opening-balances" className="font-medium text-accent hover:underline">
              Enter what each home owed on day one
            </Link>
            .
          </p>
        ) : null}
      </Card>
    </>
  );
}

/** The most recent thread with this household, if the board has one. */
function threadFor(threads: MessageThread[], owner: Owner) {
  return threads
    .filter((t) => t.ownerId === owner.id)
    .sort((a, b) => b.updatedDate.localeCompare(a.updatedDate))[0];
}

function DuesBadge({ owner, unsold }: { owner: Owner; unsold: boolean }) {
  // Nobody on record: not paid up, not behind, nobody to message. It read
  // "Paid up" beside a Message button that could reach nobody.
  if (owner.placeholder) return <Badge tone="neutral">{unsold ? "Unsold" : "No owner"}</Badge>;
  // Days late, the same fact Collections leads with. "In collections" here
  // and "Attorney next" there read as two different states for one home.
  if (owner.standing === "collections") {
    return (
      <Badge tone="danger" dot>
        {pluralize(owner.daysPastDue, "day")} late
      </Badge>
    );
  }
  if (owner.daysPastDue > 0) {
    return (
      <Badge tone="warn" dot>
        {pluralize(owner.daysPastDue, "day")} late
      </Badge>
    );
  }
  if (owner.balanceCents > 0) return <Badge tone="neutral">Balance due</Badge>;
  return (
    <Badge tone="ok" dot>
      Paid up
    </Badge>
  );
}

function HouseholdDetail({
  owner,
  thread,
  focusComposer,
  letter,
  onSend,
  onSetOwner,
  onSale,
  onRecordPayment,
  homeName,
  onLoadHandPayments,
  onReverseHandPayment,
  onAddCredit,
  onAddCharge,
  onInvite,
  onEmailInvite,
  onChangeEmail,
  onAddSecondOwner,
  signedUp,
  onRemove,
  duesLine,
  onSetKind,
  onChangeDues,
  duesNow,
}: {
  owner: Owner;
  thread?: MessageThread;
  focusComposer: boolean;
  /** The dues letter this household is due today, already filled in. Null when none is. */
  letter: { name: string; subject: string; body: string } | null;
  onSend: (body: string, subject?: string) => void;
  /** For a home with no owner on record: name them. */
  onSetOwner: (name: string, email: string) => void;
  onSale?: () => void;
  /** A check or cash received. Absent when this seat may not change finances. */
  onRecordPayment?: (input: {
    amountCents: number;
    method: ManualMethod;
    reference: string;
    receivedOn: string;
  }) => Promise<boolean>;
  /** How the board names this home, as "Unit 4". */
  homeName: string;
  /** This home's checks and cash entered by hand. Absent when this seat may not change finances. */
  onLoadHandPayments?: () => Promise<ManualPaymentRow[]>;
  /** Takes one of them back off the books, with the reason. */
  onReverseHandPayment?: (paymentId: string, reason: string) => Promise<boolean>;
  /** A credit, such as a waived fee. Absent when this seat may not change finances. */
  onAddCredit?: (input: { amountCents: number; reason: string }) => Promise<boolean>;
  /** A one-off charge. Absent when this seat may not change finances. */
  onAddCharge?: (input: { amountCents: number; label: string; dueOn: string }) => Promise<boolean>;
  onInvite: () => void;
  onEmailInvite?: () => void;
  /** Correct the address the listed owner claims their seat with. Absent when this seat may not, or they have signed in. */
  onChangeEmail?: (email: string) => Promise<boolean>;
  /** Add another person to this home. Absent when this seat may not change the roster. */
  onAddSecondOwner?: (name: string, email: string) => Promise<boolean>;
  signedUp: boolean;
  onRemove: () => void;
  /** What this home is billed, shown when homes pay different amounts. */
  duesLine?: string;
  /** Present when the community tracks kinds of home. */
  onSetKind?: (next: HomeType) => void;
  /** Change what this home pays. Absent when this seat may not change finances. */
  onChangeDues?: (cents: number | null) => Promise<boolean>;
  /** What the home pays now and where that comes from, for the Change dues form. */
  duesNow: {
    cents: number;
    sourceLabel: string;
    hasOwn: boolean;
    standardCents: number;
    period: string;
  };
}) {
  const [draft, setDraft] = useState("");
  // Set once the draft started from the letter: the send then opens its own
  // thread under this subject rather than replying to whatever came last.
  const [subject, setSubject] = useState<string | null>(null);
  const [editing, setEditing] = useState<"email" | "second" | "payment" | "hand" | "credit" | "charge" | "dues" | null>(null);
  const [hand, setHand] = useState<HandPaymentsState>({ status: "loading" });

  // Read in the click that opens the form or the list, not in an effect, and
  // again after a reversal so the row reads Reversed.
  function loadHandPayments() {
    if (!onLoadHandPayments) return Promise.resolve();
    return onLoadHandPayments().then(
      (rows) => setHand({ status: "ready", rows }),
      () => setHand({ status: "error" }),
    );
  }
  function openHandPayments(next: "payment" | "hand") {
    if (editing === next) {
      setEditing(null);
      return;
    }
    setEditing(next);
    setHand({ status: "loading" });
    void loadHandPayments();
  }

  function startFromLetter() {
    if (!letter) return;
    setDraft(letter.body);
    setSubject(letter.subject);
  }

  return (
    <div className="border-t border-border bg-surface-2 px-5 py-4">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <dl className="divide-y divide-border">
          <KeyValue label="Email">
            <a href={`mailto:${owner.email}`} className="text-accent hover:underline">
              {owner.email}
            </a>
          </KeyValue>
          <KeyValue label="Phone">
            <a href={`tel:${owner.phone.replace(/[^\d+]/g, "")}`} className="text-accent hover:underline">
              {owner.phone}
            </a>
          </KeyValue>
          <KeyValue label="Address">{owner.address}</KeyValue>
          {onSetKind ? (
            <KeyValue label="Kind of home">
              <Select
                size="sm"
                value={owner.homeType ?? ""}
                onChange={(e) => onSetKind(e.target.value as HomeType)}
                aria-label={`Kind of home for ${owner.unit}`}
              >
                {owner.homeType ? null : <option value="">Not set</option>}
                {HOME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {HOME_TYPE_LABEL[t].one}
                  </option>
                ))}
              </Select>
            </KeyValue>
          ) : null}
          {duesLine ? <KeyValue label="Dues">{duesLine}</KeyValue> : null}
          {owner.mailingAddress ? (
            <KeyValue label="Mail goes to">{owner.mailingAddress}</KeyValue>
          ) : null}
          {owner.members.length > 1 ? (
            <KeyValue label="On title">{owner.members.join(", ")}</KeyValue>
          ) : null}
          <KeyValue label="Moved in">{formatDate(owner.moveInDate, "long")}</KeyValue>
          {owner.previousOwners?.length ? (
            <div className="py-1.5">
              <dt className="text-body text-fg-muted">
                {owner.previousOwners.length === 1 ? "Previous owner" : "Previous owners"}
              </dt>
              <dd className="mt-1 space-y-1">
                {owner.previousOwners.map((t) => (
                  <p key={`${t.name}-${t.to}`} className="flex items-baseline justify-between gap-4 text-body">
                    <span className="min-w-0 truncate font-medium text-fg">{t.name}</span>
                    <span className="tnum shrink-0 text-footnote text-fg-muted">
                      {formatDate(t.from, "long")} to {formatDate(t.to, "long")}
                    </span>
                  </p>
                ))}
              </dd>
            </div>
          ) : null}
          <KeyValue label="Balance">
            <span className={owner.balanceCents > 0 ? "text-fg" : "text-fg-muted"}>
              {money(owner.balanceCents)}
            </span>
          </KeyValue>
          <KeyValue label="Autopay">
            {owner.autopay ? `On${owner.autopayMethod ? `, ${owner.autopayMethod}` : ""}` : "Off"}
          </KeyValue>
          {owner.boardRole ? <KeyValue label="Board">{owner.boardRole}</KeyValue> : null}
        </dl>

        {owner.placeholder ? (
          <AddOwnerForm unit={owner.unit} onSave={onSetOwner} />
        ) : (
        <div>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between gap-3 text-footnote font-semibold text-fg-muted">
              <span>Message {owner.members[0]?.split(" ")[0] ?? owner.displayName}</span>
              {letter && !subject ? (
                <button
                  type="button"
                  onClick={startFromLetter}
                  className="font-medium text-accent hover:underline"
                >
                  Start from the {letter.name.toLowerCase()}
                </button>
              ) : null}
            </span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={subject ? 10 : 4}
              autoFocus={focusComposer}
              aria-label={`Message to ${owner.displayName}`}
              placeholder="Write a short note. They can reply by email."
              className={cn(textareaClass, "resize-none")}
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-footnote text-fg-muted">
              {subject ? (
                <>Subject: {subject}</>
              ) : thread ? (
                <>
                  Continues &ldquo;{thread.subject}&rdquo;.{" "}
                  <a href="/board/communications" className="text-accent hover:underline">
                    Open thread
                  </a>
                </>
              ) : (
                `Sent by email to ${owner.email}`
              )}
            </p>
            <Button
              variant="primary"
              size="sm"
              disabled={!draft.trim()}
              onClick={() => {
                onSend(draft.trim(), subject ?? undefined);
                setDraft("");
                setSubject(null);
              }}
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
        )}
      </div>

      {editing === "email" && onChangeEmail ? (
        <ChangeEmailForm current={owner.email} onSave={onChangeEmail} onCancel={() => setEditing(null)} />
      ) : null}
      {editing === "second" && onAddSecondOwner ? (
        <SecondOwnerForm unit={owner.unit} onSave={onAddSecondOwner} onCancel={() => setEditing(null)} />
      ) : null}

      {editing === "payment" && onRecordPayment ? (
        <RecordPaymentForm
          unit={owner.unit}
          homeName={homeName}
          existing={hand.status === "ready" ? hand.rows : undefined}
          onSave={(input) => onRecordPayment(input).then((ok) => ok && loadHandPayments().then(() => ok))}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      {editing === "hand" && onReverseHandPayment ? (
        <HandPaymentsPanel
          homeName={homeName}
          state={hand}
          onReverse={(paymentId, reason) =>
            onReverseHandPayment(paymentId, reason).then((ok) => ok && loadHandPayments().then(() => ok))
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === "credit" && onAddCredit ? (
        <AddCreditForm unit={owner.unit} onSave={onAddCredit} onCancel={() => setEditing(null)} />
      ) : null}
      {editing === "charge" && onAddCharge ? (
        <AddChargeForm
          heading={`A charge for home ${owner.unit}`}
          onSave={onAddCharge}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      {editing === "dues" && onChangeDues ? (
        <ChangeDuesForm
          unit={owner.unit}
          period={duesNow.period}
          nowCents={duesNow.cents}
          sourceLabel={duesNow.sourceLabel}
          hasOwn={duesNow.hasOwn}
          standardCents={duesNow.standardCents}
          onSave={onChangeDues}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        {onRecordPayment ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openHandPayments("payment")}
            aria-label={`Record a payment from ${owner.displayName}`}
          >
            <Banknote className="size-3.5" />
            Record a payment
          </Button>
        ) : null}
        {onRecordPayment && onLoadHandPayments && onReverseHandPayment ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-fg-muted"
            onClick={() => openHandPayments("hand")}
            aria-label={`Payments recorded by hand for ${owner.displayName}`}
          >
            Payments recorded by hand
          </Button>
        ) : null}
        {onAddCredit ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(editing === "credit" ? null : "credit")}
            aria-label={`Add a credit to ${owner.displayName}`}
          >
            <Plus className="size-3.5" />
            Add a credit
          </Button>
        ) : null}
        {onAddCharge ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(editing === "charge" ? null : "charge")}
            aria-label={`Add a charge to ${owner.displayName}`}
          >
            <Plus className="size-3.5" />
            Add a charge
          </Button>
        ) : null}
        {onChangeDues ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(editing === "dues" ? null : "dues")}
            aria-label={`Change the dues for ${owner.displayName}`}
          >
            <Banknote className="size-3.5" />
            Change dues
          </Button>
        ) : null}
        {onSale ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSale}
            aria-label={`Record the sale of ${owner.displayName}'s home`}
          >
            <ArrowRightLeft className="size-3.5" />
            Record a sale
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={onInvite}
          aria-label={`Copy the invitation link for ${owner.displayName}`}
        >
          <LinkIcon className="size-3.5" />
          Copy invite link
        </Button>
        {onEmailInvite ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEmailInvite}
            aria-label={`Email an invitation to ${owner.displayName}`}
          >
            <Send className="size-3.5" />
            {signedUp ? "Email sign-in link" : "Email invite"}
          </Button>
        ) : null}
        {onChangeEmail ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(editing === "email" ? null : "email")}
            aria-label={`Change the email for ${owner.displayName}`}
          >
            <Mail className="size-3.5" />
            Change email
          </Button>
        ) : null}
        {onAddSecondOwner ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(editing === "second" ? null : "second")}
            aria-label={`Add a second owner to ${owner.unit}`}
          >
            <Plus className="size-3.5" />
            Add a second owner
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto hover:text-danger"
          onClick={onRemove}
          aria-label={`Remove ${owner.displayName} from the roster`}
        >
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      </div>
    </div>
  );
}

/**
 * A home the wizard added with nobody on it. Naming the owner here writes
 * onto the empty membership, so the roster gains a person rather than a
 * second household on the same lot.
 */
function AddOwnerForm({
  unit,
  onSave,
}: {
  unit: string;
  onSave: (name: string, email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(name.trim(), email.trim());
      }}
    >
      <p className="text-footnote font-semibold text-fg-muted">Who owns {unit}?</p>
      <Field label="Owner name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Owner name"
          aria-label="Owner name"
          className={fieldClass}
        />
      </Field>
      <Field label="Email">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email, so they can sign in and pay"
          aria-label="Owner email"
          className={fieldClass}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={!name.trim()}>
          Save owner
        </Button>
      </div>
    </form>
  );
}
