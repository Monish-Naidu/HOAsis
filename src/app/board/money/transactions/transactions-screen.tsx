"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Copy, Download, FileText, History, Paperclip, Search } from "lucide-react";
import { Badge, Button, ButtonLink, Callout, Card, EmptyState, PageHeader, Segmented, fieldClass } from "@/components/ui/primitives";
import { InlineBar, PeriodPicker, SelectField } from "@/components/app/finance-ui";
import { ReverseLedgerLine } from "@/components/app/reverse-ledger-line";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { loadEarlierLedger } from "@/lib/data/remote-store";
import { downloadCsv, toCsv } from "@/lib/core/export";
import {
  communitySlug,
  filterLedger,
  ledgerAttachment,
  ledgerCategories,
  ledgerFilterCounts,
  ledgerTotals,
  totalsByCategory,
  periodRange,
  PERIOD_LABEL,
  PERIOD_PHRASE,
  widerPeriod,
  type LedgerFilter,
  type PeriodPreset,
} from "@/lib/metrics";
import { useUrlClear, useUrlFilter, withFilter } from "@/lib/url-filter";
import { cn, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

type StatusFilter = "any" | "cleared" | "pending" | "needs-review";

const STATUSES: readonly StatusFilter[] = ["any", "cleared", "pending", "needs-review"];

// "To confirm" is what the dashboard and Finances call these lines, so it is
// what the filter is called too.
const STATUS_LABEL: Record<StatusFilter, string> = {
  any: "Any status",
  cleared: "Cleared",
  pending: "Pending",
  "needs-review": "To confirm",
};

/**
 * The periods on offer. The default is the last 30 days, not "This month":
 * on the first of the month that was an empty screen, and the lines a
 * treasurer is reconciling are usually the last few weeks' anyway.
 */
const PERIODS: readonly PeriodPreset[] = ["last-30-days", "this-month", "last-month", "this-year", "last-year", "last-12-months", "custom"];
const DEFAULT_PERIOD: PeriodPreset = "last-30-days";

/**
 * The ledger, as a table a treasurer can actually work in: a period, a few
 * filters, the totals of what is left, and the file behind any line that
 * paid a vendor. Confirming and reversing lines lives here too, because this
 * is where the line is.
 */
export function TransactionsScreen() {
  const { community, ledger, confirmLedgerEntry } = useAppState();
  const { notify } = useToast();
  const params = useSearchParams();
  const asOf = todayIsoDate();

  // Period, dates, status, category and the search text are in the URL, so a
  // view can be bookmarked or sent to another officer. Account and direction
  // are quick narrowing and stay on the page.
  const pathname = usePathname();
  const clearUrl = useUrlClear();
  const customDefault = periodRange("custom", asOf);
  const [urlPreset, setPreset] = useUrlFilter<PeriodPreset>("period", PERIODS, DEFAULT_PERIOD);
  const [from, setFrom] = useUrlFilter<string>("from", null, customDefault.from);
  const [to, setTo] = useUrlFilter<string>("to", null, customDefault.to);
  const [status, setStatus] = useUrlFilter<StatusFilter>("status", STATUSES, "any");
  const [categoryRaw, setCategory] = useUrlFilter<string>("category", null, "all");
  const [search, setSearch] = useUrlFilter<string>("q", null, "");
  // Older links (the top bar's search, a year on the trends page) name their
  // dates and no period; they open on those dates.
  const legacyDates = Boolean(params.get("from") && params.get("to") && params.get("period") === null);
  const [legacyHeld, setLegacyHeld] = useState(legacyDates);
  const preset: PeriodPreset = legacyHeld ? "custom" : urlPreset;
  const custom = { from, to };
  function choosePreset(next: PeriodPreset) {
    setLegacyHeld(false);
    setPreset(next);
  }
  function chooseRange(r: { from: string; to: string }) {
    setLegacyHeld(false);
    if (r.from !== from) setFrom(r.from);
    else if (r.to !== to) setTo(r.to);
  }
  const [accountId, setAccountId] = useState("all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const range = preset === "custom" ? custom : periodRange(preset, asOf);
  // A real association's lines come down for the last two years. A period
  // that reaches further back needs the rest fetched, and says so rather
  // than reading as an empty year.
  const history = community.history;
  const earlierExists = Boolean(
    history && !history.ledgerLoaded && history.ledgerFrom && history.ledgerFrom < history.from,
  );
  const needsEarlier = earlierExists && history !== undefined && range.from < history.from;

  async function showEarlier() {
    setLoadingEarlier(true);
    const loaded = await loadEarlierLedger();
    setLoadingEarlier(false);
    if (loaded) notify("Every transaction is on screen", "ok");
  }
  const earlierButton = (
    <Button variant="secondary" size="sm" onClick={showEarlier} disabled={loadingEarlier}>
      <History className="size-3.5" />
      {loadingEarlier ? "Loading" : "Load earlier transactions"}
    </Button>
  );
  const categories = ledgerCategories(ledger);
  const category = categories.includes(categoryRaw as (typeof categories)[number]) ? categoryRaw : "all";
  const baseFilter = useMemo<LedgerFilter>(
    () => ({
      from: range.from,
      to: range.to,
      accountId: accountId === "all" ? undefined : accountId,
      category: category === "all" ? undefined : category,
      status: status === "any" ? undefined : status,
      direction: direction === "all" ? undefined : direction,
      search,
    }),
    [range.from, range.to, accountId, category, status, direction, search],
  );
  const counts = useMemo(() => ledgerFilterCounts(ledger, baseFilter), [ledger, baseFilter]);
  const rows = useMemo(() => filterLedger(ledger, baseFilter), [ledger, baseFilter]);
  // Whether something besides the period is cutting the list down, which
  // decides if the empty state offers a wider period or clearing the filters.
  const narrowed = status !== "any" || category !== "all" || accountId !== "all" || direction !== "all" || search.trim() !== "";
  const wider = widerPeriod(preset);
  const widerHref = wider ? `${pathname}?${withFilter(params.toString(), "period", wider, DEFAULT_PERIOD)}` : pathname;
  const totals = ledgerTotals(rows);
  const byCategory = totalsByCategory(rows);
  const byCategoryMax = Math.max(1, ...byCategory.map((r) => Math.abs(r.inCents - r.outCents)));
  const accounts = community.bankAccounts;
  const accountName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.name} ••${a.mask}` : "Other";
  };

  function confirm(e: (typeof rows)[number]) {
    confirmLedgerEntry(e.id);
    notify(`Confirmed ${e.description}`, "ok");
  }

  function exportRows() {
    const csv = toCsv(rows, [
      { header: "Date", value: (e) => e.date },
      { header: "Description", value: (e) => e.description },
      { header: "Who", value: (e) => e.counterparty },
      { header: "Category", value: (e) => e.category },
      { header: "Account", value: (e) => accountName(e.accountId) },
      { header: "Amount", value: (e) => (e.amountCents / 100).toFixed(2) },
      { header: "Status", value: (e) => e.status },
    ]);
    downloadCsv(`${communitySlug(community)}-transactions-${range.from}-to-${range.to}.csv`, csv);
    notify(`Exported ${pluralize(rows.length, "transaction")}`);
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description="All transactions, with totals for the current filter."
        action={
          <Button variant="secondary" size="md" onClick={exportRows} disabled={rows.length === 0}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        }
      />

      <Card>
        {/* The toolbar: period first, then the narrowing, then search. */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3">
          <PeriodPicker preset={preset} onPreset={choosePreset} range={custom} onRange={chooseRange} presets={PERIODS} />
          <div className="flex flex-wrap items-center gap-2">
            {accounts.length > 1 ? (
              <SelectField
                label="Account"
                value={accountId}
                onChange={setAccountId}
                options={[
                  { value: "all", label: "All accounts" },
                  ...accounts.map((a) => ({ value: a.id, label: `${a.name} ••${a.mask}` })),
                ]}
              />
            ) : null}
            <SelectField
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: `All categories (${counts.categoryAll})` },
                ...categories.map((c) => ({ value: c, label: `${c} (${counts.category[c] ?? 0})` })),
              ]}
            />
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUSES.map((value) => ({ value, label: `${STATUS_LABEL[value]} (${counts.status[value]})` }))}
            />
            <Segmented
              label="Direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "all", label: "All" },
                { value: "in", label: "Money in" },
                { value: "out", label: "Money out" },
              ]}
            />
            <label className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description or payee"
                aria-label="Search transactions"
                className={cn(fieldClass, "pl-8 pr-2 text-footnote")}
              />
            </label>
          </div>
        </div>

        {/* What the filter adds up to. */}
        <dl className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
          {[
            { label: "Money in", value: money(totals.inCents, { cents: false }), tone: "text-ok" },
            { label: "Money out", value: money(totals.outCents, { cents: false }), tone: "text-fg" },
            {
              label: "Net",
              value: money(totals.netCents, { sign: totals.netCents > 0, cents: false }),
              tone: totals.netCents >= 0 ? "text-fg" : "text-danger",
            },
            { label: "Lines", value: String(totals.count), tone: "text-fg" },
          ].map((s) => (
            <div key={s.label} className="min-w-0 bg-surface px-5 py-3">
              <dt className="text-footnote font-medium text-fg-muted">{s.label}</dt>
              <dd className={cn("tnum mt-0.5 text-headline font-semibold tracking-[-0.02em]", s.tone)}>{s.value}</dd>
            </div>
          ))}
        </dl>

        {/* The same rows, added up by category, for "how much did we spend
            on landscaping last year" without a spreadsheet. Folded: most
            visits are about one line, not the shape of the period. */}
        {byCategory.length > 1 ? (
          <details className="group border-b border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-footnote font-medium text-fg-muted transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <span>By category · {byCategory.length} categories</span>
              <ChevronDown className="size-4 text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid gap-x-8 gap-y-3 px-5 pb-4 pt-1 sm:grid-cols-2">
              {byCategory.map((r) => {
                const net = r.inCents - r.outCents;
                return (
                  <li key={r.category}>
                    <div className="flex items-baseline justify-between gap-3 text-footnote">
                      <span className="min-w-0 truncate text-fg">
                        {r.category} <span className="tnum text-fg-subtle">· {r.count}</span>
                      </span>
                      <span className={cn("tnum shrink-0 font-semibold", net > 0 ? "text-ok" : "text-fg")}>
                        {money(net, { sign: net > 0, cents: false })}
                      </span>
                    </div>
                    <InlineBar
                      value={Math.abs(net)}
                      max={byCategoryMax}
                      colorClass={net > 0 ? "bg-ok" : "bg-chart-1"}
                      className="mt-1"
                    />
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}

        {/* One button, not two: with nothing on screen the empty state carries it. */}
        {needsEarlier && history && rows.length > 0 ? (
          <div className="border-b border-border px-5 py-3">
            <Callout
              tone="neutral"
              icon={<History className="size-4" />}
              title={`Transactions before ${formatDate(history.from, "long")} are not loaded yet`}
              action={earlierButton}
            >
              The books go back to {formatDate(history.ledgerFrom ?? history.from, "long")}. The totals
              above count what is on screen.
            </Callout>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title={needsEarlier ? "Not loaded yet" : "Nothing matches"}
            description={
              needsEarlier
                ? "Load the earlier transactions to see this period."
                : narrowed
                  ? `Nothing in ${PERIOD_PHRASE[preset]} with these filters.`
                  : `Nothing in ${PERIOD_PHRASE[preset]}.${wider ? ` Try ${PERIOD_LABEL[wider].toLowerCase()}.` : ""}`
            }
            action={
              needsEarlier ? (
                earlierButton
              ) : narrowed ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    clearUrl(["status", "category", "q"]);
                    setAccountId("all");
                    setDirection("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : wider ? (
                <ButtonLink href={widerHref} variant="secondary" size="sm">
                  Show {PERIOD_LABEL[wider].toLowerCase()}
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* On a phone, a list: what and how much on one line, when and
                where under it. The table's amount column sat past the edge at
                375 with nothing to say it was there. */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((e) => {
                const attachment = ledgerAttachment(community, e);
                const expanded = open === e.id;
                return (
                  <li key={e.id} className={cn(e.status === "needs-review" && "bg-warn-soft/40")}>
                    <div className="px-4 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-callout font-medium text-fg">{e.description}</p>
                        <p
                          className={cn(
                            "tnum shrink-0 text-callout font-semibold",
                            e.amountCents >= 0 ? "text-ok" : "text-fg",
                          )}
                        >
                          {money(e.amountCents, { sign: e.amountCents > 0 })}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-caption text-fg-muted">
                        <span className="tnum">{formatDate(e.date)}</span> · {e.counterparty} ·{" "}
                        {e.status === "needs-review" && e.suggestedCategory
                          ? `${e.suggestedCategory}?`
                          : e.category}
                      </p>
                      {e.status !== "cleared" || e.duplicateOfId || e.reversedById || e.reversedEntryId || attachment ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusCell entry={e} onConfirm={() => confirm(e)} />
                          {attachment ? (
                            <AttachmentToggle expanded={expanded} onToggle={() => setOpen(expanded ? null : e.id)} />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {expanded && attachment ? (
                      <div className="px-4 pb-3">
                        <AttachmentPanel attachment={attachment} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border text-caption font-semibold text-fg-muted">
                    <th className="px-5 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">Category</th>
                    {accounts.length > 1 ? <th className="px-3 py-2 font-semibold">Account</th> : null}
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-5 py-2 font-semibold">
                      <span className="sr-only">Status</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const attachment = ledgerAttachment(community, e);
                    const expanded = open === e.id;
                    return (
                      <RowGroup key={e.id}>
                        <tr
                          className={cn(
                            "border-b border-border text-callout transition-colors hover:bg-surface-2",
                            e.status === "needs-review" && "bg-warn-soft/40",
                            expanded && "border-b-0 bg-surface-2",
                          )}
                        >
                          <td className="tnum whitespace-nowrap px-5 py-2.5 text-footnote text-fg-muted">
                            {formatDate(e.date)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-fg">{e.description}</span>
                              {attachment ? (
                                <AttachmentToggle
                                  expanded={expanded}
                                  onToggle={() => setOpen(expanded ? null : e.id)}
                                />
                              ) : null}
                            </div>
                            <span className="block text-caption text-fg-subtle">{e.counterparty}</span>
                          </td>
                          <td className="px-3 py-2.5 text-caption text-fg-muted">
                            {e.status === "needs-review" && e.suggestedCategory ? (
                              <span className="italic">{e.suggestedCategory}?</span>
                            ) : (
                              e.category
                            )}
                          </td>
                          {accounts.length > 1 ? (
                            <td className="px-3 py-2.5 text-caption text-fg-muted">{accountName(e.accountId)}</td>
                          ) : null}
                          <td
                            className={cn(
                              "tnum whitespace-nowrap px-3 py-2.5 text-right font-semibold",
                              e.amountCents >= 0 ? "text-ok" : "text-fg",
                            )}
                          >
                            {money(e.amountCents, { sign: e.amountCents > 0 })}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            {/* One line: wrapped, Confirm sat under the badge and
                                Reverse under that, three rows for one decision. */}
                            <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <StatusCell entry={e} onConfirm={() => confirm(e)} />
                            </span>
                          </td>
                        </tr>
                        {expanded && attachment ? (
                          <tr className="border-b border-border bg-surface-2">
                            <td colSpan={accounts.length > 1 ? 6 : 5} className="px-5 pb-4 pt-0">
                              <div className="ml-14">
                                <AttachmentPanel attachment={attachment} />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </RowGroup>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-footnote text-fg-muted">
          <span>
            {formatDate(range.from, "long")} to {formatDate(range.to, "long")}
          </span>
          {totals.needsReview ? (
            <span className="font-medium text-warn">
              {pluralize(totals.needsReview, "line")} {totals.needsReview === 1 ? "needs" : "need"} review,
              held out of the totals
            </span>
          ) : (
            <span>Everything here is confirmed</span>
          )}
        </div>
      </Card>
    </>
  );
}

type Entry = ReturnType<typeof useAppState>["ledger"][number];

/**
 * The status column shows exceptions only. "Cleared" beside four hundred
 * lines was the column's whole content and told nobody anything; a pending
 * line, a duplicate, or a line waiting on a decision is what it is for.
 */
function StatusCell({ entry: e, onConfirm }: { entry: Entry; onConfirm: () => void }) {
  return (
    <>
      {e.reversedById ? <Badge tone="neutral">Reversed</Badge> : null}
      {e.reversedEntryId ? <Badge tone="neutral">Reversal</Badge> : null}
      {e.duplicateOfId ? (
        <Badge tone="danger" dot={false}>
          <Copy className="size-2.5" />
          Duplicate?
        </Badge>
      ) : null}
      {e.status === "needs-review" ? (
        <>
          <Button variant="secondary" size="sm" onClick={onConfirm}>
            Confirm
          </Button>
          <ReverseLedgerLine entry={e} />
        </>
      ) : e.status === "pending" ? (
        <Badge tone="warn">Pending</Badge>
      ) : null}
    </>
  );
}

/** The paperclip. A 36px target, since it is the only way to the file. */
function AttachmentToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? "Hide the payment" : "Show the payment and invoice"}
      onClick={onToggle}
      className={cn(
        "-my-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg",
        expanded && "bg-surface-3 text-fg",
      )}
    >
      <Paperclip className="size-3.5" />
    </button>
  );
}

const PAYOUT_STATUS: Record<string, string> = {
  paid: "Paid",
  "in-transit": "In transit",
  scheduled: "Scheduled",
  "needs-approval": "Needs approval",
};

function AttachmentPanel({
  attachment,
}: {
  attachment: NonNullable<ReturnType<typeof ledgerAttachment>>;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 text-footnote sm:grid-cols-[1fr_auto]">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-fg-muted">Paid to</dt>
          <dd className="font-medium text-fg">{attachment.payout.vendor}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Invoice</dt>
          <dd className="tnum font-medium text-fg">{attachment.payout.invoiceNumber}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Sent</dt>
          <dd className="font-medium text-fg">
            {attachment.payout.method.toUpperCase()} · {formatDate(attachment.payout.issuedDate)} ·{" "}
            {PAYOUT_STATUS[attachment.payout.status] ?? attachment.payout.status}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">Approved by</dt>
          <dd className="font-medium text-fg">
            {attachment.payout.approvals.map((a) => a.name).join(", ") || "Nobody yet"}
          </dd>
        </div>
        {attachment.payout.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-fg-muted">Note</dt>
            <dd className="text-fg">{attachment.payout.notes}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        {attachment.invoice?.file ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-fg">
            <FileText className="size-4 text-fg-subtle" />
            <span className="font-medium">{attachment.invoice.file.name}</span>
            <span className="text-fg-subtle">{attachment.invoice.file.size}</span>
          </span>
        ) : (
          <span className="text-fg-muted">No invoice on file</span>
        )}
        <Link href="/board/vendors" className="font-semibold text-accent hover:underline">
          Open in Vendors
        </Link>
      </div>
    </div>
  );
}

/** Two `<tr>` under one key. A fragment with a key, named so the table reads. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
