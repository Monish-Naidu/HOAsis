"use client";

import { useState } from "react";
import { Button, Field, Select, fieldClass } from "@/components/ui/primitives";
import { MANUAL_METHOD_LABEL, type ManualMethod } from "@/lib/payments/instruments";
import { todayIsoDate } from "@/lib/utils";

/** Dollars as typed to whole cents, or 0 when it is not a positive amount. */
function toCents(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/**
 * A check or cash the treasurer received. The statement gets a payment line,
 * the balance drops, and the deposit goes on the operating account, exactly
 * as an online payment does, minus the processor fee there is not.
 */
export function RecordPaymentForm({
  unit,
  onSave,
  onCancel,
}: {
  unit: string;
  onSave: (input: {
    amountCents: number;
    method: ManualMethod;
    reference: string;
    receivedOn: string;
  }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const today = todayIsoDate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualMethod>("check");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const cents = toCents(amount);
  // The date input's max stops the picker; this stops a typed date.
  const ready = cents > 0 && Boolean(receivedOn) && receivedOn <= today;
  return (
    <form
      className="mt-4 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        void onSave({ amountCents: cents, method, reference: reference.trim(), receivedOn })
          .then((ok) => ok && onCancel())
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-footnote font-semibold text-fg-muted">A payment received for home {unit}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="285.00"
            aria-label="Payment amount"
            className={fieldClass}
            autoFocus
          />
        </Field>
        <Field label="How it was paid">
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as ManualMethod)}
            aria-label="How it was paid"
            className="w-full"
          >
            {(Object.keys(MANUAL_METHOD_LABEL) as ManualMethod[]).map((m) => (
              <option key={m} value={m}>
                {MANUAL_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={method === "check" ? "Check number (optional)" : "Reference (optional)"}>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={method === "check" ? "1042" : ""}
            aria-label="Payment reference"
            className={fieldClass}
          />
        </Field>
        <Field label="Date received">
          <input
            type="date"
            max={today}
            value={receivedOn}
            onChange={(e) => setReceivedOn(e.target.value)}
            aria-label="Date received"
            className={fieldClass}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !ready}>
          Save payment
        </Button>
      </div>
    </form>
  );
}

/**
 * A credit on the statement, such as a late fee waived. It lowers what the
 * home owes and puts nothing in the bank.
 */
export function AddCreditForm({
  unit,
  onSave,
  onCancel,
}: {
  unit: string;
  onSave: (input: { amountCents: number; reason: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const cents = toCents(amount);
  const ready = cents > 0 && reason.trim().length > 0;
  return (
    <form
      className="mt-4 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        void onSave({ amountCents: cents, reason: reason.trim() })
          .then((ok) => ok && onCancel())
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-footnote font-semibold text-fg-muted">A credit for home {unit}</p>
      <p className="text-footnote text-fg-muted">
        It lowers what they owe. It is not money received, so the books do not change.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25.00"
            aria-label="Credit amount"
            className={fieldClass}
            autoFocus
          />
        </Field>
        <Field label="Reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Late fee waived"
            aria-label="Credit reason"
            className={fieldClass}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !ready}>
          Save credit
        </Button>
      </div>
    </form>
  );
}
