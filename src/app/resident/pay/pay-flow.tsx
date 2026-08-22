"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Apple,
  Check,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Plus,
  Repeat,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Callout, Card, SectionTitle, Toggle } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner, useMyInstruments } from "@/lib/app-state";
import {
  FEE_SCHEDULE,
  cheapestInstrument,
  computePaymentCost,
  describeInstrument,
  isExpired,
  type InstrumentKind,
  type PaymentInstrument,
  type PlatformFeePolicy,
} from "@/lib/payments/instruments";
import { cn, formatDate, money, ordinal, relativeDays, TODAY } from "@/lib/utils";
import { AddMethod } from "./add-method";
import { useToast } from "@/components/app/toast";

const NEXT_CHARGE_DATE = "2026-09-01";
const REFERENCE = { year: TODAY.getUTCFullYear(), month: TODAY.getUTCMonth() + 1 };

const RAIL_ICON: Record<InstrumentKind, typeof Landmark> = {
  ach: Landmark,
  card: CreditCard,
  "apple-pay": Apple,
};

export function PayFlow({ duesCents }: { duesCents: number }) {
  const owner = useCurrentOwner();
  const instruments = useMyInstruments();
  const { settings, removeInstrument, setDefaultInstrument } = useAppState();
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountMode, setAmountMode] = useState<"balance" | "custom">("balance");
  const [custom, setCustom] = useState("");
  const [autopay, setAutopay] = useState(owner?.autopay ?? false);
  const [autopayDay, setAutopayDay] = useState(1);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [paid, setPaid] = useState<{ amountCents: number; instrument: PaymentInstrument } | null>(
    null,
  );

  const balanceCents = owner?.balanceCents ?? 0;

  // Falls back to the household default, then to whatever exists, so the
  // screen is never in a state where nothing is selected.
  const selected =
    instruments.find((i) => i.id === selectedId) ??
    instruments.find((i) => i.isDefault) ??
    instruments[0];

  const amountCents = useMemo(() => {
    if (amountMode === "balance") return balanceCents > 0 ? balanceCents : duesCents;
    const parsed = Math.round(Number(custom.replace(/[^0-9.]/g, "")) * 100);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amountMode, custom, balanceCents, duesCents]);

  const policy: PlatformFeePolicy = {
    flatCents: settings.paymentFeeCents,
    paidBy: settings.paymentFeePaidBy,
    waiveOnAch: settings.paymentFeeWaivedOnAch,
  };
  const cheapest = cheapestInstrument(instruments, amountCents, policy);
  const cost = selected
    ? computePaymentCost(selected.kind, amountCents, policy)
    : null;

  if (!owner) return null;

  /* ------------------------------------------------------------- receipt */
  if (paid) {
    return (
      <div className="animate-rise space-y-5">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">Payment scheduled</h1>
          <p className="tnum mt-1 text-[15px] font-semibold text-fg">{money(paid.amountCents)}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            {describeInstrument(paid.instrument)} · clears in{" "}
            {FEE_SCHEDULE[paid.instrument.kind].settlement.toLowerCase()}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPaid(null)}>
              Back
            </Button>
            <Link
              href="/resident/account"
              className="flex h-9 flex-1 items-center justify-center rounded-lg bg-brand text-[13px] font-medium text-brand-fg"
            >
              View account
            </Link>
          </div>
        </Card>
        <Callout
          tone="ok"
          icon={<ShieldCheck className="size-4" />}
          title="Applied to your oldest charge first"
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- form */
  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">Pay dues</h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          September assessment · due {formatDate(NEXT_CHARGE_DATE, "long")}
        </p>
      </div>

      {/* Amount */}
      <section>
        <SectionTitle>Amount</SectionTitle>
        <Card className="p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmountMode("balance")}
              aria-pressed={amountMode === "balance"}
              className={cn(
                "flex-1 rounded-lg border px-3 py-3 text-left transition-colors",
                amountMode === "balance"
                  ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                  : "border-border hover:bg-surface-2",
              )}
            >
              <span className="block text-[11px] font-medium text-fg-muted">
                {balanceCents > 0 ? "Full balance" : "Next assessment"}
              </span>
              <span className="tnum mt-0.5 block text-[17px] font-semibold text-fg">
                {money(balanceCents > 0 ? balanceCents : duesCents)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAmountMode("custom")}
              aria-pressed={amountMode === "custom"}
              className={cn(
                "flex-1 rounded-lg border px-3 py-3 text-left transition-colors",
                amountMode === "custom"
                  ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                  : "border-border hover:bg-surface-2",
              )}
            >
              <span className="block text-[11px] font-medium text-fg-muted">Other amount</span>
              <span className="tnum mt-0.5 block text-[17px] font-semibold text-fg">
                {amountMode === "custom" && amountCents ? money(amountCents) : "$0.00"}
              </span>
            </button>
          </div>
          {amountMode === "custom" ? (
            <label className="mt-3 block">
              <span className="sr-only">Payment amount</span>
              <div className="flex h-11 items-center gap-1 rounded-lg border border-border-2 bg-surface-2 px-3">
                <span className="text-[15px] text-fg-muted">$</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="0.00"
                  className="tnum w-full bg-transparent text-[15px] font-medium text-fg outline-none placeholder:text-fg-subtle"
                />
              </div>
            </label>
          ) : null}
        </Card>
      </section>

      {/* Instruments */}
      <section>
        <SectionTitle
          action={
            instruments.length > 0 ? (
              <button
                type="button"
                onClick={() => setManaging((v) => !v)}
                className="text-[12px] font-medium text-accent"
              >
                {managing ? "Done" : "Manage"}
              </button>
            ) : null
          }
        >
          Pay from
        </SectionTitle>

        {instruments.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="text-[13px] font-medium text-fg">No payment method yet</p>
            <p className="mt-1 text-[12px] text-fg-muted">
              Connect a bank for the cheapest option, or add a card.
            </p>
          </Card>
        ) : (
          <Card>
            {instruments.map((instrument, index) => {
              const Icon = RAIL_ICON[instrument.kind];
              const active = selected?.id === instrument.id;
              const expired = isExpired(instrument, REFERENCE);
              const instrumentCost = computePaymentCost(instrument.kind, amountCents, policy);
              return (
                <div
                  key={instrument.id}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3",
                    index > 0 && "border-t border-border",
                    active && !managing && "bg-brand-soft/60",
                  )}
                >
                  <button
                    type="button"
                    disabled={expired}
                    onClick={() => setSelectedId(instrument.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-brand text-brand-fg" : "bg-surface-3 text-fg-muted",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-fg">
                          {instrument.label} ••{instrument.mask}
                        </span>
                        {instrument.isDefault ? <Badge tone="neutral">Default</Badge> : null}
                        {cheapest?.id === instrument.id && !expired ? (
                          <Badge tone="ok">Cheapest</Badge>
                        ) : null}
                        {expired ? <Badge tone="danger">Expired</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-fg-muted">
                        {policy.paidBy === "owner"
                          ? instrumentCost.platformCents === 0
                            ? "No fee to you"
                            : `${money(instrumentCost.platformCents)} fee · ${money(instrumentCost.residentPaysCents)} total`
                          : `Free to you · costs the association ${money(
                              instrumentCost.processorCents + instrumentCost.platformCents,
                            )}`}
                      </span>
                    </span>
                    {active && !managing ? <Check className="size-4 shrink-0 text-fg" /> : null}
                  </button>

                  {managing ? (
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label={`Make ${instrument.label} the default`}
                        disabled={instrument.isDefault}
                        onClick={() => setDefaultInstrument(instrument.id)}
                        className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                      >
                        <Star className={cn("size-3.5", instrument.isDefault && "fill-current")} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${instrument.label}`}
                        onClick={() => {
                          const undo = removeInstrument(instrument.id);
                          notify(`Removed ${instrument.label} ••${instrument.mask}`, "warn", {
                            label: "Undo",
                            onClick: undo,
                          });
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </Card>
        )}

        {adding ? (
          <div className="mt-3 space-y-2">
            <AddMethod onDone={() => setAdding(false)} />
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setAdding(false)}>
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="md" className="mt-3 w-full" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Add a payment method
          </Button>
        )}
      </section>

      {/* Total */}
      {selected && cost ? (
        <Card className="p-4">
          <dl className="space-y-1">
            <div className="flex justify-between text-[13px]">
              <dt className="text-fg-muted">Assessment</dt>
              <dd className="tnum font-medium text-fg">{money(cost.amountCents)}</dd>
            </div>
            {policy.paidBy === "owner" ? (
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">
                  {cost.platformCents === 0 ? "Payment fee (waived)" : "Payment fee"}
                </dt>
                <dd className="tnum font-medium text-fg">{money(cost.platformCents)}</dd>
              </div>
            ) : (
              <div className="flex justify-between text-[13px]">
                <dt className="text-fg-muted">Processing (paid by the association)</dt>
                <dd className="tnum font-medium text-fg">{money(0)}</dd>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-[15px]">
              <dt className="font-semibold text-fg">You pay</dt>
              <dd className="tnum font-semibold text-fg">{money(cost.residentPaysCents)}</dd>
            </div>
          </dl>
          <Button
            variant="primary"
            size="lg"
            className="mt-4 w-full"
            disabled={amountCents <= 0 || isExpired(selected, REFERENCE)}
            onClick={() => setPaid({ amountCents: cost.residentPaysCents, instrument: selected })}
          >
            Pay {money(cost.residentPaysCents)}
          </Button>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
            <Info className="mt-px size-3 shrink-0" />
            {policy.paidBy === "owner"
              ? `The card network takes ${money(cost.processorCents)} of this from the association. The ${money(
                  policy.flatCents,
                )} fee is ours, and it is the same on every rail.`
              : `The association absorbs ${money(cost.processorCents + cost.platformCents)} on this payment.`}
          </p>
        </Card>
      ) : null}

      {/* Autopay */}
      <section id="autopay" className="scroll-mt-20">
        <SectionTitle>Autopay</SectionTitle>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
              <Repeat className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-fg">
                Autopay {money(duesCents)} on the {ordinal(autopayDay)}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                {selected
                  ? `From ${describeInstrument(selected)}. Cancel any time.`
                  : "Add a payment method to turn this on."}
              </p>
            </div>
            <Toggle
              checked={autopay}
              onChange={setAutopay}
              disabled={!selected}
              label="Enable autopay"
            />
          </div>

          {autopay ? (
            <>
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                  Day of the month
                </p>
                <div className="grid grid-cols-8 gap-1.5">
                  {Array.from({ length: settings.autopayLateAfterDay }, (_, i) => i + 1).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setAutopayDay(day)}
                      aria-pressed={autopayDay === day}
                      className={cn(
                        "tnum flex h-8 items-center justify-center rounded-md text-[12px] font-medium transition-colors",
                        autopayDay === day
                          ? "bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950"
                          : day === settings.autopayLateAfterDay
                            ? "border border-warn/40 bg-warn-soft text-warn"
                            : "border border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-fg-subtle">
                  The board set the {ordinal(settings.autopayLateAfterDay)} as the last day before
                  an assessment is late.
                </p>
              </div>
              <div className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-[12px] font-medium text-ok">
                Next autopay: September {autopayDay}, 2026 · {relativeDays(`2026-09-${String(autopayDay).padStart(2, "0")}`)}
              </div>
            </>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
