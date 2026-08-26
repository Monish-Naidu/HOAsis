"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookmarkPlus,
  Plus,
  Copy,
  Download,
  Filter,
  Landmark,
  ShieldAlert,
  Star,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { MoneyTabs } from "@/components/app/money-tabs";
import { useMemo, useState } from "react";
import {
  budgetSummary,
  cashPosition,
  insuranceExposure,
  communitySlug,
} from "@/lib/metrics";
import { BankConnect } from "@/components/app/bank-connect";
import { useAppState, useReconciliation } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { formatDate, money, pluralize  } from "@/lib/utils";

const savedViews = [
  { name: "Everything, this month", starred: true },
  { name: "Needs review", starred: false },
  { name: "Reserve activity only", starred: false },
  { name: "Vendor payments > $1k", starred: false },
];

export default function BoardMoney() {
  const { community, ledger, confirmLedgerEntry, dismissLedgerEntry, addBankAccount } =
    useAppState();
  const [connecting, setConnecting] = useState(false);
  // The association's own present, not a month baked into the markup.
  const monthLabel = new Date(`${community.asOf}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const bankAccounts = community.bankAccounts;
  const cash = cashPosition(community);
  const recon = useReconciliation();
  const { notify } = useToast();
  const [view, setView] = useState("Everything, this month");

  /** Saved views are just named filters over the same ledger. */
  const rows = useMemo(() => {
    switch (view) {
      case "Needs review":
        return ledger.filter((e) => e.status === "needs-review");
      case "Reserve activity only":
        return ledger.filter((e) => e.accountId !== "acct-operating");
      case "Vendor payments > $1k":
        return ledger.filter((e) => e.amountCents <= -100_000);
      default:
        return ledger;
    }
  }, [ledger, view]);

  function exportLedger() {
    const csv = toCsv(rows, [
      { header: "Date", value: (e) => e.date },
      { header: "Description", value: (e) => e.description },
      { header: "Counterparty", value: (e) => e.counterparty },
      { header: "Category", value: (e) => e.category },
      { header: "Account", value: (e) => bankAccounts.find((a) => a.id === e.accountId)?.name },
      { header: "Amount", value: (e) => (e.amountCents / 100).toFixed(2) },
      { header: "Status", value: (e) => e.status },
    ]);
    downloadCsv(
      `${communitySlug(community)}-ledger-${view.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
      csv,
    );
    notify(`Exported ${pluralize(rows.length, "transaction")}`);
  }
  const bud = budgetSummary(community);
  const exposure = insuranceExposure(community);

  return (
    <>
      <MoneyTabs />
      <PageHeader
        title="Money"
        description="What came in, what went out, and anything still waiting on a decision."
        
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={exportLedger}>
              <Download className="size-3.5" />
              Export
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                const open = recon.needsReview.length;
                if (open === 0) {
                  notify("Already reconciled. Every report agrees.");
                  return;
                }
                setView("Needs review");
                notify(`${pluralize(open, "transaction")} still ${open === 1 ? "needs" : "need"} a decision`, "warn");
              }}
            >
              Reconcile
            </Button>
          </div>
        }
      />

      {exposure.totalUninsured > 0 ? (
        <Callout
          tone="warn"
          className="mb-5"
          icon={<ShieldAlert className="size-4" />}
          title={`${money(exposure.totalUninsured, { cents: false })} sits above deposit insurance`}
        >
          {exposure.rows
            .filter((row) => row.uninsured > 0)
            .map((row) => (
              <span key={row.institution} className="block">
                {row.institution} holds {money(row.balance, { cents: false })} against a{" "}
                {money(row.limit, { cents: false })} limit. The limit is per bank, not per
                account, so a second account there does not extend it.
              </span>
            ))}
        </Callout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total cash"
          value={money(cash.total, { cents: false })}
          hint={
            bankAccounts.length
              ? `Across ${pluralize(bankAccounts.length, "account")}`
              : "No bank account connected yet"
          }
          icon={<Landmark className="size-4" />}
        />
        <Stat
          label="Money in this year"
          value={money(bud.incomeYtd, { cents: false })}
          tone="ok"
          hint={
            bud.incomePace === undefined
              ? `${Math.round(bud.yearElapsed * 100)}% of the year elapsed`
              : `${Math.round(bud.incomePace * 100)}% of budget · ${Math.round(bud.yearElapsed * 100)}% of year`
          }
          icon={<ArrowUpRight className="size-4" />}
        />
        <Stat
          label="Money out this year"
          value={money(bud.expenseYtd, { cents: false })}
          hint={
            bud.expensePace === undefined
              ? "No expense budget set"
              : `${Math.round(bud.expensePace * 100)}% of budget`
          }
          icon={<ArrowDownRight className="size-4" />}
        />
        <Stat
          label="Waiting on you"
          value={String(recon.needsReview.length)}
          tone={recon.needsReview.length ? "warn" : "ok"}
          hint="Held out of reports until confirmed"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {/* Connecting an account is the one thing that blocks collecting, so it
          sits above the accounts rather than behind a menu. */}
      {connecting || !bankAccounts.length ? (
        <Card className="mt-5 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                {bankAccounts.length ? "Connect another account" : "Connect your operating account"}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                {bankAccounts.length
                  ? "Reserves belong in their own account, separate from operating."
                  : "Dues have nowhere to land until an account in the association's name is connected."}
              </p>
            </div>
            {bankAccounts.length ? (
              <Button variant="ghost" size="sm" onClick={() => setConnecting(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
          <BankConnect
            kind={bankAccounts.some((a) => a.kind === "operating") ? "reserve" : "operating"}
            onConnect={(account) => {
              addBankAccount(account);
              setConnecting(false);
              notify(`${account.institution} ••${account.mask} connected`, "ok");
            }}
          />
        </Card>
      ) : null}

      {/* Accounts */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {bankAccounts.length && !connecting ? (
          <button
            type="button"
            onClick={() => setConnecting(true)}
            className="flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border-2 p-4 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Plus className="size-4" />
            <span className="text-[13px] font-medium">Connect an account</span>
          </button>
        ) : null}
        {bankAccounts.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-fg">{a.name}</p>
                <p className="truncate text-[13px] text-fg-muted">
                  {a.institution} ••{a.mask}
                </p>
              </div>
              <Badge tone={a.status === "live" ? "ok" : "warn"} dot>
                {a.status}
              </Badge>
            </div>
            <p className="tnum mt-3 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {money(a.balanceCents)}
            </p>
            <dl className="mt-3 space-y-1 border-t border-border pt-2.5">
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">Reconciled through</dt>
                <dd className="tnum font-medium text-fg">
                  {formatDate(a.reconciledThroughDate, "long")}
                </dd>
              </div>
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">Unreconciled</dt>
                <dd
                  className={`tnum font-medium ${a.unreconciledCount ? "text-warn" : "text-ok"}`}
                >
                  {a.unreconciledCount}
                </dd>
              </div>
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">Yield</dt>
                <dd className="tnum font-medium text-fg">
                  {a.apy.toFixed(2)}% APY
                  {a.maturityDate ? `, matures ${formatDate(a.maturityDate)}` : ""}
                </dd>
              </div>
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">Interest YTD</dt>
                <dd className="tnum font-medium text-ok">{money(a.interestYtdCents)}</dd>
              </div>
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">Feed</dt>
                <dd className="font-medium text-fg">
                  {a.status === "live"
                    ? `${a.syncedMinutesAgo} min ago`
                    : `${Math.round(a.syncedMinutesAgo / 60)}h ago`}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      {/* Ledger */}
      <Card className="mt-5">
        <CardHeader
          title="Every transaction"
          subtitle={`${rows.length} of ${pluralize(ledger.length, "transaction")} · ${monthLabel}`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("Needs review")}
              >
                <Filter className="size-3.5" />
                Filters
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => notify(`Saved "${view}" to your views`)}
              >
                <BookmarkPlus className="size-3.5" />
                Save view
              </Button>
            </div>
          }
        />

        {/* Saved views. Filters survive a reload. */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border px-5 py-2.5">
          {savedViews.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => setView(v.name)}
              aria-pressed={view === v.name}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                view === v.name
                  ? "border-navy-700 bg-brand-soft text-brand-soft-fg dark:border-navy-300"
                  : "border-border text-fg-muted hover:bg-surface-2"
              }`}
            >
              {v.starred ? <Star className="size-3 fill-current" /> : null}
              {v.name}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Account</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const account = bankAccounts.find((a) => a.id === e.accountId);
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border text-[15px] transition-colors last:border-b-0 hover:bg-surface-2 ${
                      e.status === "needs-review" ? "bg-warn-soft/40" : ""
                    }`}
                  >
                    <td className="tnum whitespace-nowrap px-5 py-2.5 text-fg-muted">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg">{e.description}</span>
                        {e.duplicateOfId ? (
                          <Badge tone="danger">
                            <Copy className="size-2.5" />
                            Duplicate?
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[13px] text-fg-subtle">{e.counterparty}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {e.status === "needs-review" && e.suggestedCategory ? (
                        <span className="text-[13px] italic text-fg-muted">
                          {e.suggestedCategory}?
                        </span>
                      ) : (
                        <span className="text-[13px] text-fg-muted">{e.category}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-fg-muted">
                      {account?.name} ••{account?.mask}
                    </td>
                    <td
                      className={`tnum whitespace-nowrap px-3 py-2.5 text-right font-semibold ${
                        e.amountCents >= 0 ? "text-ok" : "text-fg"
                      }`}
                    >
                      {money(e.amountCents, { sign: e.amountCents > 0 })}
                    </td>
                    <td className="px-5 py-2.5">
                      {e.status === "needs-review" ? (
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const undo = confirmLedgerEntry(e.id);
                              notify(`Confirmed ${e.description}`, "ok", {
                                label: "Undo",
                                onClick: undo,
                              });
                            }}
                            className="h-7 rounded-md border border-border-2 px-2 text-[13px] font-medium text-fg hover:bg-surface"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const undo = dismissLedgerEntry(e.id);
                              notify("Removed from the ledger", "warn", {
                                label: "Undo",
                                onClick: undo,
                              });
                            }}
                            className="h-7 rounded-md px-2 text-[13px] font-medium text-danger hover:bg-danger-soft"
                          >
                            Remove
                          </button>
                        </span>
                      ) : (
                        <Badge tone={e.status === "cleared" ? "ok" : "neutral"}>{e.status}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px] text-fg-muted">
          <span>
            {recon.cleared.length} cleared · {recon.pending.length} pending ·{" "}
            <span className="font-medium text-warn">{recon.needsReview.length} need review</span>
          </span>
          
        </div>
      </Card>


      {/* Two reserve sections used to sit here, duplicating the whole of the
          Reserves tab. Both are one click away under Next 30 years now, and
          this page keeps only the balance, which belongs in "what do we have"
          the same way the operating balance does. */}
    </>
  );
}
