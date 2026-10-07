"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Field, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import type { Community } from "@/lib/data/community";
import type { BankAccount } from "@/lib/types";
import { formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

/** The accounts that still have no opening balance line. Derived from the books. */
export function accountsWithoutOpening(community: Community): BankAccount[] {
  return community.bankAccounts.filter(
    (a) => !community.ledger.some((e) => e.accountId === a.id && e.category === "Opening balance"),
  );
}

/**
 * Day one in the bank. A board that switches in has money already, and the
 * Operating tile reads $0 until the books are told. One row per account:
 * a form for those with no opening line yet, the saved figure for the rest.
 *
 * It sits at the bottom of Finances, folded. Open only while nothing has been
 * saved, because that is when the Operating tile is wrong; once set, it is a
 * line the board reads once and never needs in the way of the real content.
 */
export function OpeningBalances() {
  const { community, can } = useAppState();
  if (!can("finances")) return null;
  const missing = accountsWithoutOpening(community);
  const opening = (id: string) =>
    community.ledger.find((e) => e.accountId === id && e.category === "Opening balance");
  const saved = community.bankAccounts.filter((a) => opening(a.id));
  if (missing.length === 0 && saved.length === 0) return null;

  const operating = saved.filter((a) => a.kind === "operating");
  const shown = operating.length ? operating : saved;
  const total = shown.reduce((t, a) => t + (opening(a.id)?.amountCents ?? 0), 0);
  const asOf = opening(shown[0]?.id ?? "")?.date;
  const summary =
    saved.length === 0
      ? "Starting balances: not set yet"
      : `Starting balances: ${money(total, { cents: false })} ${operating.length ? "operating" : "in the bank"} as of ${formatDate(asOf ?? "")}${
          missing.length ? `, ${pluralize(missing.length, "account")} still to set` : ""
        }`;

  return (
    <details open={saved.length === 0} className="group mt-6 rounded-card border border-border bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-callout font-medium text-fg transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
      </summary>
      <p className="border-t border-border px-5 pt-3 text-footnote text-fg-muted">
        What the bank held when you started here. It is not counted as income.
      </p>
      <ul className="divide-y divide-border">
        {community.bankAccounts.map((account) => {
          const line = opening(account.id);
          return line ? (
            <li key={account.id} className="flex items-baseline justify-between gap-3 px-5 py-3 text-footnote">
              <span className="font-medium text-fg">
                {account.name}
                {account.mask ? ` ••${account.mask}` : ""}
              </span>
              <span className="tnum text-fg-muted">
                <span className="font-semibold text-fg">{money(line.amountCents)}</span> as of {formatDate(line.date)}
              </span>
            </li>
          ) : (
            <OpeningRow key={account.id} account={account} />
          );
        })}
      </ul>
    </details>
  );
}

function OpeningRow({ account }: { account: BankAccount }) {
  const { setOpeningBankBalance } = useAppState();
  const { notify } = useToast();
  const today = todayIsoDate();
  const [amount, setAmount] = useState("");
  const [asOf, setAsOf] = useState(today);
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const cents = amount.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  const ready = cents !== null && Boolean(asOf) && asOf <= today;
  const name = `${account.name}${account.mask ? ` ••${account.mask}` : ""}`;
  return (
    <li className="px-5 py-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || busy || cents === null) return;
          setBusy(true);
          void Promise.resolve(setOpeningBankBalance(account.id, { amountCents: cents, asOf }))
            .then((ok) => {
              if (ok) notify(`${account.name} started at ${money(cents)}`, "ok");
            })
            .finally(() => setBusy(false));
        }}
      >
        <p className="text-body font-medium text-fg">{name}</p>
        <p className="text-footnote text-fg-muted">What was in this account when you started here?</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Amount">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label={`Starting balance for ${name}`}
              className={fieldClass}
            />
          </Field>
          <Field label="As of">
            <input
              type="date"
              max={today}
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              aria-label={`Starting balance date for ${name}`}
              className={fieldClass}
            />
          </Field>
          <Button type="submit" variant="secondary" size="md" disabled={busy || !ready}>
            Save
          </Button>
        </div>
      </form>
    </li>
  );
}
