"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Copy, Download, FileText, Paperclip, Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { PeriodPicker, SelectField } from "@/components/app/finance-ui";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { downloadCsv, toCsv } from "@/lib/core/export";
import {
  communitySlug,
  filterLedger,
  ledgerAttachment,
  ledgerCategories,
  ledgerTotals,
  periodRange,
  type LedgerFilter,
  type PeriodPreset,
} from "@/lib/metrics";
import { cn, formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

type StatusFilter = "any" | "cleared" | "pending" | "needs-review";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "any", label: "Any status" },
  { value: "cleared", label: "Cleared" },
  { value: "pending", label: "Pending" },
  { value: "needs-review", label: "Needs review" },
];

/**
 * The ledger, as a table a treasurer can actually work in: a period, a few
 * filters, the totals of what is left, and the file behind any line that
 * paid a vendor. Confirming and removing lines lives here too, because this
 * is where the line is.
 */
export function TransactionsScreen() {
  const { community, ledger, confirmLedgerEntry, dismissLedgerEntry } = useAppState();
  const { notify } = useToast();
  const params = useSearchParams();
  const asOf = todayIsoDate();

  // A link that asks for the review queue opens on the whole year, since the
  // oldest unreviewed line is rarely this month's.
  const fromLink = params.get("status") === "needs-review";
  // Search from the top bar lands on one line: its words in the box and its
  // year as the period, so a 2024 entry is not hidden behind "this month".
  const fromSearch = params.get("q");
  const [preset, setPreset] = useState<PeriodPreset>(
    fromSearch ? "custom" : fromLink ? "this-year" : "this-month",
  );
  const [custom, setCustom] = useState(() => {
    const from = params.get("from");
    const to = params.get("to");
    return from && to ? { from, to } : periodRange("custom", asOf);
  });
  const [accountId, setAccountId] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>(fromLink ? "needs-review" : "any");
  const [search, setSearch] = useState(fromSearch ?? "");
  const [open, setOpen] = useState<string | null>(null);

  const range = preset === "custom" ? custom : periodRange(preset, asOf);
  const rows = useMemo(() => {
    const filter: LedgerFilter = {
      from: range.from,
      to: range.to,
      accountId: accountId === "all" ? undefined : accountId,
      category: category === "all" ? undefined : category,
      status: status === "any" ? undefined : status,
      search,
    };
    return filterLedger(ledger, filter);
  }, [ledger, range.from, range.to, accountId, category, status, search]);
  const totals = ledgerTotals(rows);
  const categories = ledgerCategories(ledger);
  const accounts = community.bankAccounts;
  const accountName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.name} ••${a.mask}` : "Other";
  };

  function confirm(e: (typeof rows)[number]) {
    const undo = confirmLedgerEntry(e.id);
    notify(`Confirmed ${e.description}`, "ok", { label: "Undo", onClick: undo });
  }

  function remove(e: (typeof rows)[number]) {
    const undo = dismissLedgerEntry(e.id);
    notify("Removed from the ledger", "warn", { label: "Undo", onClick: undo });
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
          <PeriodPicker preset={preset} onPreset={setPreset} range={custom} onRange={setCustom} />
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
              options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
            <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <label className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description or payee"
                aria-label="Search transactions"
                className="h-9 w-full rounded-lg border border-border-2 bg-surface pl-8 pr-2 text-[13px] text-fg outline-none placeholder:text-fg-subtle focus:border-brand"
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
              <dt className="text-[13px] font-medium text-fg-muted">{s.label}</dt>
              <dd className={cn("tnum mt-0.5 text-[17px] font-semibold tracking-[-0.02em]", s.tone)}>{s.value}</dd>
            </div>
          ))}
        </dl>

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            description="No transactions in this period with these filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPreset("this-year");
                  setStatus("any");
                  setCategory("all");
                  setAccountId("all");
                  setSearch("");
                }}
              >
                Show this year
              </Button>
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
                        <p className="min-w-0 truncate text-[14px] font-medium text-fg">{e.description}</p>
                        <p
                          className={cn(
                            "tnum shrink-0 text-[14px] font-semibold",
                            e.amountCents >= 0 ? "text-ok" : "text-fg",
                          )}
                        >
                          {money(e.amountCents, { sign: e.amountCents > 0 })}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-fg-muted">
                        <span className="tnum">{formatDate(e.date)}</span> · {e.counterparty} ·{" "}
                        {e.status === "needs-review" && e.suggestedCategory
                          ? `${e.suggestedCategory}?`
                          : e.category}
                      </p>
                      {e.status !== "cleared" || e.duplicateOfId || attachment ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusCell
                            entry={e}
                            onConfirm={() => confirm(e)}
                            onRemove={() => remove(e)}
                          />
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
                  <tr className="border-b border-border text-[12px] font-semibold text-fg-muted">
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
                            "border-b border-border text-[14px] transition-colors hover:bg-surface-2",
                            e.status === "needs-review" && "bg-warn-soft/40",
                            expanded && "border-b-0 bg-surface-2",
                          )}
                        >
                          <td className="tnum whitespace-nowrap px-5 py-2.5 text-[13px] text-fg-muted">
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
                            <span className="block text-[12px] text-fg-subtle">{e.counterparty}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-fg-muted">
                            {e.status === "needs-review" && e.suggestedCategory ? (
                              <span className="italic">{e.suggestedCategory}?</span>
                            ) : (
                              e.category
                            )}
                          </td>
                          {accounts.length > 1 ? (
                            <td className="px-3 py-2.5 text-[12px] text-fg-muted">{accountName(e.accountId)}</td>
                          ) : null}
                          <td
                            className={cn(
                              "tnum whitespace-nowrap px-3 py-2.5 text-right font-semibold",
                              e.amountCents >= 0 ? "text-ok" : "text-fg",
                            )}
                          >
                            {money(e.amountCents, { sign: e.amountCents > 0 })}
                          </td>
                          <td className="px-5 py-2.5">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <StatusCell entry={e} onConfirm={() => confirm(e)} onRemove={() => remove(e)} />
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px] text-fg-muted">
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
function StatusCell({
  entry: e,
  onConfirm,
  onRemove,
}: {
  entry: Entry;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      {e.duplicateOfId ? (
        <Badge tone="danger">
          <Copy className="size-2.5" />
          Duplicate?
        </Badge>
      ) : null}
      {e.status === "needs-review" ? (
        <>
          <Button variant="secondary" size="sm" onClick={onConfirm}>
            Confirm
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger-soft hover:text-danger"
            onClick={onRemove}
          >
            Remove
          </Button>
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
    <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 text-[13px] sm:grid-cols-[1fr_auto]">
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
