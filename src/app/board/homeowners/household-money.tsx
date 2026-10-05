"use client";

import { useState } from "react";
import { Badge, Button, Field, Select, fieldClass } from "@/components/ui/primitives";
import { chargeCents, chargeProblem, MAX_CHARGE_LABEL } from "@/lib/payments/charges";
import { MANUAL_METHOD_LABEL, type ManualMethod } from "@/lib/payments/instruments";
import {
  duplicatePaymentWarning,
  findDuplicatePayment,
  MAX_REVERSAL_REASON,
  reversalReasonProblem,
  type ManualPaymentRow,
} from "@/lib/payments/manual-payments";
import { formatDate, money, todayIsoDate } from "@/lib/utils";

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
  homeName,
  existing,
  onSave,
  onCancel,
}: {
  unit: string;
  /** How the board names this home, for the repeat warning. Falls back to the unit. */
  homeName?: string;
  /** This home's checks and cash already entered, once they have loaded. */
  existing?: readonly ManualPaymentRow[];
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
  // Said before saving, and saving is still allowed: two checks of the same
  // amount on one day happen, but a double entry is the likelier cause.
  const repeat = existing ? findDuplicatePayment(existing, { amountCents: cents, receivedOn }) : null;
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
      {repeat ? (
        <p role="alert" className="rounded-md bg-warn-soft px-3 py-2 text-footnote font-medium text-warn">
          {duplicatePaymentWarning(homeName ?? unit, repeat)}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !ready}>
          {repeat ? "Record it again" : "Save payment"}
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

/**
 * A one-off charge: a repair, a key fob, a special assessment. It raises what
 * the home owes and shows on its statement under the words typed here. It is
 * not dues, so it draws no late fee. The same form bills every home when a
 * heading and a summary line are passed in.
 */
export function AddChargeForm({
  heading,
  summary,
  submitLabel = "Add charge",
  onSave,
  onCancel,
}: {
  heading: string;
  /** A line worked out from the records, given the amount typed so far. */
  summary?: (amountCents: number) => string;
  submitLabel?: string;
  onSave: (input: { amountCents: number; label: string; dueOn: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const today = todayIsoDate();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [dueOn, setDueOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const cents = chargeCents(amount);
  const input = { amountCents: cents, label: label.trim(), dueOn };
  const problem = chargeProblem(input, today);
  return (
    <form
      className="mt-4 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (problem || busy) return;
        setBusy(true);
        void onSave(input)
          .then((ok) => ok && onCancel())
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-footnote font-semibold text-fg-muted">{heading}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="85.00"
            aria-label="Charge amount"
            className={fieldClass}
            autoFocus
          />
        </Field>
        <Field label="Due">
          <input
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            aria-label="Charge due date"
            className={fieldClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="What is it for?">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={MAX_CHARGE_LABEL}
              placeholder="Gate remote replacement"
              aria-label="What the charge is for"
              className={fieldClass}
              required
            />
          </Field>
        </div>
      </div>
      {summary && cents > 0 ? <p className="tnum text-footnote text-fg-muted">{summary(cents)}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || Boolean(problem)}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * What one home pays, changed. Shows the amount it pays now and where that
 * comes from, takes a new amount, and offers the standard rate back. Applies
 * from the next bill; bills already sent keep their amount. The button waits
 * for the write, and the form closes only when it went through.
 */
export function ChangeDuesForm({
  unit,
  period,
  nowCents,
  sourceLabel,
  hasOwn,
  standardCents,
  onSave,
  onCancel,
}: {
  unit: string;
  /** "month", "quarter" or "year". */
  period: string;
  nowCents: number;
  /** "its own amount", "townhome rate" or "the association's rate". */
  sourceLabel: string;
  hasOwn: boolean;
  /** What the home would pay with no amount of its own. */
  standardCents: number;
  /** A null amount clears the home's own. */
  onSave: (cents: number | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(hasOwn ? String(nowCents / 100) : "");
  const [busy, setBusy] = useState(false);
  const cents = toCents(amount);
  const ready = cents > 0 && cents !== nowCents;
  function save(next: number | null) {
    if (busy) return;
    setBusy(true);
    void onSave(next)
      .then((ok) => ok && onCancel())
      .finally(() => setBusy(false));
  }
  return (
    <form
      className="mt-4 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) save(cents);
      }}
    >
      <p className="text-footnote font-semibold text-fg-muted">Dues for home {unit}</p>
      <p className="text-footnote text-fg-muted">
        Pays {money(nowCents)} a {period} now, from {sourceLabel}. A change applies from the next
        bill; bills already sent keep their amount.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={`Dues, per ${period}`}>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(standardCents / 100)}
            aria-label="Dues for this home"
            className={fieldClass}
            autoFocus
          />
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {hasOwn ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => save(null)}>
            Use the standard rate
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !ready}>
          Save dues
        </Button>
      </div>
    </form>
  );
}

/** What the list of hand-recorded payments is showing: reading, read, or failed. */
export type HandPaymentsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: ManualPaymentRow[] };

/**
 * A home's checks and cash entered by hand, newest first. A live row can be
 * reversed, which is how a payment entered twice or against the wrong home
 * comes back off the books.
 */
export function HandPaymentsPanel({
  homeName,
  state,
  onReverse,
  onClose,
}: {
  homeName: string;
  state: HandPaymentsState;
  onReverse: (paymentId: string, reason: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [reversing, setReversing] = useState<string | null>(null);
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-footnote font-semibold text-fg-muted">Payments recorded by hand for {homeName}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {state.status === "loading" ? <p className="text-footnote text-fg-muted">Loading.</p> : null}
      {state.status === "error" ? (
        <p role="alert" className="text-footnote font-medium text-danger">
          Could not load these payments. Close this and try again.
        </p>
      ) : null}
      {state.status === "ready" && state.rows.length === 0 ? (
        <p className="text-footnote text-fg-muted">No checks or cash recorded for this home.</p>
      ) : null}
      {state.status === "ready" && state.rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {state.rows.map((p) => (
            <li key={p.id} className="py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote">
                <span className="text-fg-muted">{formatDate(p.receivedOn)}</span>
                <span className="font-semibold tabular-nums text-fg">{money(p.amountCents)}</span>
                <span className="text-fg-muted">
                  {MANUAL_METHOD_LABEL[p.method]}
                  {p.reference ? ` #${p.reference}` : ""}
                </span>
                {p.reversed ? (
                  <Badge tone="neutral">Reversed</Badge>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setReversing(reversing === p.id ? null : p.id)}
                    aria-label={`Reverse the ${money(p.amountCents)} ${MANUAL_METHOD_LABEL[p.method].toLowerCase()} payment from ${formatDate(p.receivedOn)}`}
                  >
                    Reverse
                  </Button>
                )}
              </div>
              {reversing === p.id ? (
                <ReversePaymentForm
                  onSave={(reason) => onReverse(p.id, reason)}
                  onCancel={() => setReversing(null)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One field: why. The reason is kept on the statement and in the activity record. */
export function ReversePaymentForm({
  onSave,
  onCancel,
}: {
  onSave: (reason: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = reversalReasonProblem(reason) === null;
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        void onSave(reason.trim())
          .then((ok) => ok && onCancel())
          .finally(() => setBusy(false));
      }}
    >
      <Field label="Why?" className="min-w-[12rem] flex-1">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Entered twice"
          maxLength={MAX_REVERSAL_REASON}
          aria-label="Why reverse this payment"
          className={fieldClass}
          autoFocus
        />
      </Field>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="primary" size="sm" disabled={busy || !ready}>
        Reverse payment
      </Button>
    </form>
  );
}
