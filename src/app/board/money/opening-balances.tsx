"use client";

import { useState } from "react";
import { Button, Card, CardHeader, Field, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import type { Community } from "@/lib/data/community";
import type { BankAccount } from "@/lib/types";
import { money, todayIsoDate } from "@/lib/utils";

/** The accounts that still have no opening balance line. Derived from the books. */
export function accountsWithoutOpening(community: Community): BankAccount[] {
  return community.bankAccounts.filter(
    (a) => !community.ledger.some((e) => e.accountId === a.id && e.category === "Opening balance"),
  );
}

/**
 * Day one in the bank. A board that switches in has money already, and the
 * Operating tile reads $0 until the books are told. One row per account that
 * has no opening line yet; saving writes it and the row goes away, because
 * the list is what the ledger lacks, not a flag.
 */
export function OpeningBalances() {
  const { community, can } = useAppState();
  if (!can("finances")) return null;
  const missing = accountsWithoutOpening(community);
  if (missing.length === 0) return null;
  return (
    <Card className="mt-6">
      <CardHeader
        title="Starting balances"
        subtitle="Tell the books what the bank held when you started here. It is not counted as income."
      />
      <ul className="divide-y divide-border">
        {missing.map((account) => (
          <OpeningRow key={account.id} account={account} />
        ))}
      </ul>
    </Card>
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
              placeholder="86000.00"
              aria-label={`Opening balance for ${name}`}
              className={fieldClass}
            />
          </Field>
          <Field label="As of">
            <input
              type="date"
              max={today}
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              aria-label={`Opening balance date for ${name}`}
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
