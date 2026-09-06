"use client";

import {
  ArrowRightLeft,
  Building2,
  ChevronDown,
  Download,
  Link2 as LinkIcon,
  Lock,
  Mail,
  Plus,
  Scale,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  KeyValue,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { TemplateComposer } from "@/components/app/template-composer";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { inviteUrl } from "@/lib/invitations";
import { communitySlug, delinquency } from "@/lib/metrics";
import type { MessageTemplate } from "@/lib/data/templates";
import type { MessageThread, Owner } from "@/lib/types";
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
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-brand";

export default function BoardHomeowners() {
  const { community, threads, addOwner, removeOwner, transferHome, replyToThread, can } =
    useAppState();
  const { notify } = useToast();

  const association = community.association;
  const owners = community.owners;
  const delinq = delinquency(community);
  const paidUp = owners.length - delinq.past.length;
  // Opening balances are for an association that switched here mid-life. A
  // new build starts every home at zero, so for it the screen is noise.
  const showOpeningBalances =
    community.profile?.origin !== "builder" && community.profile?.origin !== "handover";

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusComposer, setFocusComposer] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState({ name: "", email: "", unit: "" });
  const [sale, setSale] = useState<{
    open: boolean;
    ownerId: string | null;
    name: string;
    email: string;
    closingDate: string;
    settle: boolean;
  }>({ open: false, ownerId: null, name: "", email: "", closingDate: todayIsoDate(), settle: true });
  // One template composer at a time. `ownerId` set means it opened from that
  // household's panel and renders there; unset means the header opened it.
  const [composer, setComposer] = useState<{
    recipients: Owner[];
    trigger: MessageTemplate["trigger"];
    ownerId?: string;
  } | null>(null);

  const maySeeRoster = can("finances") || can("communications");

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
      if (filter === "paid" && o.daysPastDue > 0) return false;
      if (filter === "behind" && o.daysPastDue === 0) return false;
      if (!needle) return true;
      return (
        o.displayName.toLowerCase().includes(needle) ||
        o.members.some((m) => m.toLowerCase().includes(needle)) ||
        o.unit === needle ||
        o.address.toLowerCase().includes(needle) ||
        o.email.toLowerCase().includes(needle)
      );
    });
  }, [sorted, filter, query]);
  const visible = matching.slice(0, shown);

  const segments: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: owners.length },
    { key: "paid", label: "Paid up", count: paidUp },
    { key: "behind", label: "Behind", count: delinq.past.length },
  ];

  function toggle(owner: Owner, withComposer = false) {
    const opening = openId !== owner.id || withComposer;
    setOpenId(opening ? owner.id : null);
    setFocusComposer(withComposer);
    if (composer?.ownerId && composer.ownerId !== owner.id) setComposer(null);
  }

  function saveOwner() {
    try {
      const owner = addOwner(entry);
      setEntry({ name: "", email: "", unit: "" });
      setAdding(false);
      notify(`Added ${owner.displayName}, unit ${owner.unit}`, "ok", {
        label: "Undo",
        onClick: () => removeOwner(owner.id)(),
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add that household", "warn");
    }
  }

  function startSale(owner: Owner | null) {
    setSale({
      open: true,
      ownerId: owner?.id ?? null,
      name: "",
      email: "",
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

  function copyInvite(owner: Owner) {
    const url = inviteUrl(community.id, owner.id, window.location.origin);
    navigator.clipboard
      .writeText(url)
      .then(() => notify(`Invitation link for ${owner.displayName} copied`, "ok"))
      .catch(() => notify("Could not copy. Select the link and copy it manually.", "warn"));
  }

  function send(owner: Owner, body: string) {
    const thread = threadFor(threads, owner);
    if (thread) replyToThread(thread.id, body);
    notify(`Sent to ${owner.displayName}`, "ok");
  }

  function exportRoster() {
    const csv = toCsv(matching, [
      { header: "Unit", value: (o) => o.unit },
      { header: "Household", value: (o) => o.displayName },
      { header: "Address", value: (o) => o.address },
      { header: "Email", value: (o) => o.email },
      { header: "Phone", value: (o) => o.phone },
      { header: "Balance", value: (o) => (o.balanceCents / 100).toFixed(2) },
      { header: "Days past due", value: (o) => o.daysPastDue },
      { header: "Autopay", value: (o) => (o.autopay ? "yes" : "no") },
    ]);
    downloadCsv(`${communitySlug(community)}-roster.csv`, csv);
    notify(`Exported ${pluralize(matching.length, "household")}`);
  }

  if (!maySeeRoster) {
    return (
      <Callout tone="warn" icon={<Lock className="size-4" />} title="You cannot see the homeowner register">
        It carries every household&apos;s balance and contact details, so it needs the money or
        communications capability. The President grants those.
      </Callout>
    );
  }

  const seller = owners.find((o) => o.id === sale.ownerId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow={`${pluralize(association.unitCount, "unit")} · ${pluralize(owners.length, "household")}`}
        title="Homeowners"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setAdding((v) => !v);
                setSale((s) => ({ ...s, open: false }));
              }}
            >
              <Plus className="size-3.5" />
              Add household
            </Button>
            {delinq.past.length > 0 ? (
              <Button
                variant="primary"
                size="md"
                onClick={() =>
                  setComposer(
                    composer && !composer.ownerId
                      ? null
                      : { recipients: delinq.past, trigger: "late-notice" },
                  )
                }
              >
                <Mail className="size-3.5" />
                Message everyone behind
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Households"
          value={String(owners.length)}
          hint={`${owners.filter((o) => o.boardRole).length} on the board · ${owners.filter((o) => o.autopay).length} on autopay`}
        />
        <Stat
          label="Paid up"
          value={String(paidUp)}
          tone="ok"
          hint={`${Math.round(delinq.collectionRate * 100)}% of households`}
        />
        <Stat
          label="Behind"
          value={String(delinq.past.length)}
          tone={delinq.past.length ? "warn" : "ok"}
          hint={delinq.past.length ? `${money(delinq.totalCents)} owed` : "Nobody is behind"}
        />
      </div>

      {composer && !composer.ownerId ? (
        <TemplateComposer
          recipients={composer.recipients}
          defaultTrigger={composer.trigger}
          onClose={() => setComposer(null)}
        />
      ) : null}

      <Card className="mt-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div
            role="group"
            aria-label="Show households"
            className="inline-flex rounded-lg bg-surface-3 p-0.5"
          >
            {segments.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={filter === s.key}
                onClick={() => {
                  setFilter(s.key);
                  setShown(PAGE);
                }}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
                  filter === s.key
                    ? "bg-surface text-fg shadow-card"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                {s.label}
                <span className="tnum text-fg-subtle">{s.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <div className="mr-1 flex h-8 items-center gap-2 rounded-lg border border-border px-2.5">
              <Search className="size-3.5 text-fg-subtle" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="Search owners"
                aria-label="Search owners"
                className="w-40 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => startSale(null)}>
              <ArrowRightLeft className="size-3.5" />
              Record a sale
            </Button>
            {showOpeningBalances ? (
              <ButtonLink variant="ghost" size="sm" href="/board/homeowners/opening-balances">
                <Scale className="size-3.5" />
                Opening balances
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
            <p className="text-[15px] font-semibold text-fg">New household</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto_auto]">
              <input
                value={entry.name}
                onChange={(e) => setEntry({ ...entry, name: e.target.value })}
                placeholder="Household name"
                aria-label="Household name"
                onKeyDown={(e) => e.key === "Enter" && saveOwner()}
                className={input}
              />
              <input
                type="email"
                value={entry.email}
                onChange={(e) => setEntry({ ...entry, email: e.target.value })}
                placeholder="Email"
                aria-label="Household email"
                onKeyDown={(e) => e.key === "Enter" && saveOwner()}
                className={input}
              />
              <input
                value={entry.unit}
                onChange={(e) => setEntry({ ...entry, unit: e.target.value })}
                placeholder="Unit"
                aria-label="Unit"
                onKeyDown={(e) => e.key === "Enter" && saveOwner()}
                className={input}
              />
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
                <p className="text-[15px] font-semibold text-fg">
                  {seller ? `Record the sale of unit ${seller.unit}` : "Record a sale"}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                  {seller
                    ? `${seller.displayName} moves out on the closing date. The home keeps its history and the buyer starts with a clean statement.`
                    : "Pick the home. The seller moves out on the closing date and the buyer starts with a clean statement."}
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
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_10rem_auto]">
              <select
                value={sale.ownerId ?? ""}
                onChange={(e) => setSale({ ...sale, ownerId: e.target.value || null })}
                aria-label="Home being sold"
                className={input}
              >
                <option value="">Which home?</option>
                {[...owners]
                  .sort((a, b) => Number(a.unit) - Number(b.unit))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {homeLabel(community, o.unit)} · {o.displayName}
                    </option>
                  ))}
              </select>
              <input
                value={sale.name}
                onChange={(e) => setSale({ ...sale, name: e.target.value })}
                placeholder="Buyer name"
                aria-label="Buyer name"
                className={input}
              />
              <input
                type="email"
                value={sale.email}
                onChange={(e) => setSale({ ...sale, email: e.target.value })}
                placeholder="Buyer email"
                aria-label="Buyer email"
                className={input}
              />
              <input
                type="date"
                value={sale.closingDate}
                onChange={(e) => setSale({ ...sale, closingDate: e.target.value })}
                aria-label="Closing date"
                className={input}
              />
              <Button
                variant="primary"
                size="md"
                disabled={!seller || !sale.name.trim() || !sale.closingDate}
                onClick={recordSale}
              >
                Record the sale
              </Button>
            </div>
            {seller && seller.balanceCents > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
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
          </div>
        ) : null}

        {/* Roster */}
        {visible.length === 0 ? (
          <EmptyState
            title={query.trim() ? "Nobody matches" : filter === "behind" ? "Nobody is behind" : "No households yet"}
            description={query.trim() ? "Try a name, unit, address or email." : undefined}
          />
        ) : (
          <ul>
            {visible.map((o) => {
              const open = openId === o.id;
              return (
                <li key={o.id} className="border-b border-border last:border-b-0">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 transition-colors",
                      open ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(o)}
                      aria-expanded={open}
                      aria-label={`${o.displayName}, unit ${o.unit}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
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
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-medium text-fg">
                            {o.displayName}
                          </span>
                          {o.boardRole ? <Badge tone="brand">{o.boardRole}</Badge> : null}
                        </span>
                        <span className="block truncate text-[13px] text-fg-muted">
                          {homeLabel(community, o.unit)}
                          {o.address ? ` · ${o.address}` : ""}
                        </span>
                      </span>
                      <span className="hidden w-60 shrink-0 md:block">
                        <span className="block truncate text-[13px] text-fg-muted">{o.email}</span>
                        <span className="tnum block text-[13px] text-fg-subtle">{o.phone}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "hidden size-4 shrink-0 text-fg-subtle transition-transform sm:block",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <span className="flex shrink-0 items-center justify-end gap-3">
                      {o.balanceCents > 0 ? (
                        <span className="tnum hidden text-[15px] font-semibold text-fg sm:block">
                          {money(o.balanceCents)}
                        </span>
                      ) : null}
                      <DuesBadge owner={o} />
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Message ${o.displayName}`}
                        onClick={() => toggle(o, true)}
                      >
                        Message
                      </Button>
                    </span>
                  </div>
                  {open ? (
                    <HouseholdDetail
                      key={o.id}
                      owner={o}
                      thread={threadFor(threads, o)}
                      focusComposer={focusComposer}
                      composer={composer?.ownerId === o.id ? composer : null}
                      onTemplate={(trigger) =>
                        setComposer({ recipients: [o], trigger, ownerId: o.id })
                      }
                      onCloseTemplate={() => setComposer(null)}
                      onSend={(body) => send(o, body)}
                      onSale={() => startSale(o)}
                      onInvite={() => copyInvite(o)}
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
            <p className="tnum text-[13px] text-fg-muted">
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

function DuesBadge({ owner }: { owner: Owner }) {
  if (owner.standing === "collections") {
    return (
      <Badge tone="danger" dot>
        In collections
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
  composer,
  onTemplate,
  onCloseTemplate,
  onSend,
  onSale,
  onInvite,
  onRemove,
}: {
  owner: Owner;
  thread?: MessageThread;
  focusComposer: boolean;
  composer: { recipients: Owner[]; trigger: MessageTemplate["trigger"] } | null;
  onTemplate: (trigger: MessageTemplate["trigger"]) => void;
  onCloseTemplate: () => void;
  onSend: (body: string) => void;
  onSale: () => void;
  onInvite: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");
  const behind = owner.daysPastDue > 0;
  const trigger: MessageTemplate["trigger"] =
    owner.standing === "collections"
      ? "collections"
      : owner.standing === "late"
        ? "late-notice"
        : "past-due";

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
          {owner.mailingAddress ? (
            <KeyValue label="Mail goes to">{owner.mailingAddress}</KeyValue>
          ) : null}
          {owner.members.length > 1 ? (
            <KeyValue label="On title">{owner.members.join(", ")}</KeyValue>
          ) : null}
          <KeyValue label="Moved in">{formatDate(owner.moveInDate, "long")}</KeyValue>
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

        <div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg-muted">
              Message {owner.members[0]?.split(" ")[0] ?? owner.displayName}
            </span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus={focusComposer}
              aria-label={`Message to ${owner.displayName}`}
              placeholder="Write a short note. They can reply by email."
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-[15px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle focus:border-brand"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-[13px] text-fg-muted">
              {thread ? (
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
            <span className="ml-auto flex items-center gap-1">
              {behind ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (composer ? onCloseTemplate() : onTemplate(trigger))}
                >
                  {composer ? "Hide template" : "Use a dues template"}
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                disabled={!draft.trim()}
                onClick={() => {
                  onSend(draft.trim());
                  setDraft("");
                }}
              >
                <Send className="size-3.5" />
                Send
              </Button>
            </span>
          </div>
          {composer ? (
            <TemplateComposer
              recipients={composer.recipients}
              defaultTrigger={composer.trigger}
              onClose={onCloseTemplate}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSale}
          aria-label={`Record the sale of ${owner.displayName}'s home`}
        >
          <ArrowRightLeft className="size-3.5" />
          Record a sale
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onInvite}
          aria-label={`Copy the invitation link for ${owner.displayName}`}
        >
          <LinkIcon className="size-3.5" />
          Copy invite link
        </Button>
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
