"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Callout, Card, SectionTitle } from "@/components/ui/primitives";
import type { PaymentMethod } from "@/lib/types";
import { cn, formatDate, money } from "@/lib/utils";

const methodIcon = {
  ach: Landmark,
  card: CreditCard,
  "apple-pay": Building2,
} as const;

export function PayFlow({
  balanceCents,
  nextChargeDate,
  methods,
  autopayOn,
  duesCents,
}: {
  balanceCents: number;
  nextChargeDate?: string;
  methods: PaymentMethod[];
  autopayOn: boolean;
  duesCents: number;
}) {
  const [selectedId, setSelectedId] = useState(methods.find((m) => m.isDefault)?.id ?? methods[0].id);
  const [amountMode, setAmountMode] = useState<"balance" | "custom">("balance");
  const [custom, setCustom] = useState("");
  const [autopay, setAutopay] = useState(autopayOn);
  const [submitted, setSubmitted] = useState(false);

  const selected = methods.find((m) => m.id === selectedId)!;
  const amountCents = useMemo(() => {
    if (amountMode === "balance") return balanceCents;
    const parsed = Math.round(Number(custom.replace(/[^0-9.]/g, "")) * 100);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amountMode, custom, balanceCents]);

  const feeCents = Math.round(amountCents * (selected.feePercent / 100)) + selected.feeCents;

  if (submitted) {
    return (
      <div className="animate-rise space-y-5">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">Payment scheduled</h1>
          <p className="tnum mt-1 text-[15px] font-semibold text-fg">{money(amountCents)}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            {selected.label} ••{selected.mask} · clears in 1–2 business days
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setSubmitted(false)}>
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

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">Pay dues</h1>
        {nextChargeDate ? (
          <p className="mt-1 text-[13px] text-fg-muted">
            September assessment · due {formatDate(nextChargeDate, "long")}
          </p>
        ) : null}
      </div>

      {/* Amount */}
      <section>
        <SectionTitle>Amount</SectionTitle>
        <Card className="p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmountMode("balance")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-3 text-left transition-colors",
                amountMode === "balance"
                  ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                  : "border-border hover:bg-surface-2",
              )}
            >
              <span className="block text-[11px] font-medium text-fg-muted">Full balance</span>
              <span className="tnum mt-0.5 block text-[17px] font-semibold text-fg">
                {money(balanceCents)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAmountMode("custom")}
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

      {/* Method. Every option shows what it actually costs. */}
      <section>
        <SectionTitle>Pay from</SectionTitle>
        <Card>
          {methods.map((m, i) => {
            const Icon = methodIcon[m.kind];
            const thisFee = Math.round(amountCents * (m.feePercent / 100)) + m.feeCents;
            const active = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  i > 0 && "border-t border-border",
                  active ? "bg-brand-soft/60" : "hover:bg-surface-2",
                )}
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
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-fg">
                      {m.label} ••{m.mask}
                    </span>
                    {m.feePercent === 0 ? <Badge tone="ok">Cheapest</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-fg-muted">
                    {m.feePercent === 0
                      ? `Free to you · costs the association ${money(m.feeCents)}`
                      : `${m.feePercent}% + ${money(m.feeCents)} · ${money(thisFee)} on this payment`}
                  </span>
                </span>
                {active ? <Check className="size-4 shrink-0 text-fg" /> : null}
              </button>
            );
          })}
        </Card>
      </section>

      {/* Total */}
      <Card className="p-4">
        <dl className="space-y-1">
          <div className="flex justify-between text-[13px]">
            <dt className="text-fg-muted">Assessment</dt>
            <dd className="tnum font-medium text-fg">{money(amountCents)}</dd>
          </div>
          <div className="flex justify-between text-[13px]">
            <dt className="text-fg-muted">
              Processing {selected.feePercent === 0 ? "(paid by the association)" : ""}
            </dt>
            <dd className="tnum font-medium text-fg">
              {selected.feePercent === 0 ? money(0) : money(feeCents)}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-[15px]">
            <dt className="font-semibold text-fg">You pay</dt>
            <dd className="tnum font-semibold text-fg">
              {money(selected.feePercent === 0 ? amountCents : amountCents + feeCents)}
            </dd>
          </div>
        </dl>
        <Button
          variant="primary"
          size="lg"
          className="mt-4 w-full"
          disabled={amountCents <= 0}
          onClick={() => setSubmitted(true)}
        >
          Pay {money(selected.feePercent === 0 ? amountCents : amountCents + feeCents)}
        </Button>
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
          <Info className="mt-px size-3 shrink-0" />
          Processing costs pass through at cost. No markup.
        </p>
      </Card>

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
                Autopay {money(duesCents)} on the 1st
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                From {selected.label} ••{selected.mask}. Cancel any time.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autopay}
              aria-label="Enable autopay"
              onClick={() => setAutopay((v) => !v)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                autopay ? "bg-ok" : "bg-surface-3",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                  autopay ? "translate-x-[22px]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          {autopay ? (
            <div className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-[12px] font-medium text-ok">
              Next autopay: September 1, 2026
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
