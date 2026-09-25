"use client";

import { Term } from "@/components/app/term";
import { ResidentTitle } from "@/components/app/resident-title";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Apple,
  Check,
  CreditCard,
  Info,
  Landmark,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import { Badge, Button, Callout, Card, IconTile, SectionTitle, SuccessMark, Toggle, fieldClass } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/count-up";
import { useAppState, useCurrentOwner, useMyInstruments } from "@/lib/app-state";
import {
  FEE_SCHEDULE,
  cheapestRail,
  computePaymentCost,
  describeInstrument,
  isExpired,
  type InstrumentKind,
  type PaymentInstrument,
  type PlatformFeePolicy,
} from "@/lib/payments/instruments";
import { cn, formatDate, money, ordinal, pluralize, relativeDays, today } from "@/lib/utils";
import { AddMethod } from "./add-method";
import { InstrumentMenu } from "./instrument-menu";
import { StripePayPanel } from "./stripe-pay-panel";
import { isChargeable } from "@/lib/payments/autopay";
import { useToast } from "@/components/app/toast";
import { TestModeGuide } from "@/components/app/test-mode-guide";
import { policyFor } from "@/lib/collections";
import { moduleOn } from "@/lib/modules";
import { ownerDues } from "@/lib/home-types";

const REFERENCE = { year: today().getUTCFullYear(), month: today().getUTCMonth() + 1 };

const RAIL_ICON: Record<InstrumentKind, typeof Landmark> = {
  ach: Landmark,
  card: CreditCard,
  "apple-pay": Apple,
};

export function PayFlow() {
  const owner = useCurrentOwner();
  const instruments = useMyInstruments();
  const {
    settings,
    community,
    isRemote,
    can,
    removeInstrument,
    setDefaultInstrument,
    recordPayment,
    setAutopay,
  } = useAppState();
  const collections = policyFor(settings);
  // This home's own amount: in a mixed community a condo and a townhome
  // can pay different dues.
  const duesCents = ownerDues(community.association, owner ?? undefined);
  const nextCharge = community.nextChargeDate;
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The Stripe panel's choice: a saved instrument's id, or "new-ach" /
  // "new-card". Held here so autopay can read which saved method it is.
  const [stripeSelection, setStripeSelection] = useState<string>(
    () => instruments.find((i) => i.isDefault)?.id ?? instruments[0]?.id ?? "new-ach",
  );
  const [amountMode, setAmountMode] = useState<"balance" | "custom">("balance");
  const [custom, setCustom] = useState("");
  // Autopay is the owner's standing instruction, so it starts from what they
  // last saved rather than from a default that quietly forgets the cap.
  const plan = owner?.autopayPlan;
  const [autopay, setAutopayOn] = useState(owner?.autopay ?? false);
  const [autopayDay, setAutopayDay] = useState(plan?.day ?? 1);
  const [capCents, setCapCents] = useState<number | null>(plan?.capCents ?? null);
  const [capText, setCapText] = useState(plan?.capCents ? String(plan.capCents / 100) : "");
  const [skipMonth, setSkipMonth] = useState<string | null>(plan?.skipMonth ?? null);
  const [adding, setAdding] = useState(false);
  // Which row has its small actions menu open. One at a time, and closing is
  // the same press that opened it.
  const [menuFor, setMenuFor] = useState<string | null>(null);
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

  // What autopay would draw from. For a real association that has to be a
  // method Stripe can charge with nobody present: the one chosen in the
  // panel if it is saved and verified, else the household's default.
  const autopayInstrument = isRemote
    ? (instruments.find((i) => i.id === stripeSelection && isChargeable(i)) ??
      instruments.find((i) => i.isDefault && isChargeable(i)) ??
      instruments.find((i) => isChargeable(i)))
    : selected;

  const amountCents = useMemo(() => {
    if (amountMode === "balance") return balanceCents > 0 ? balanceCents : duesCents;
    const parsed = Math.round(Number(custom.replace(/[^0-9.]/g, "")) * 100);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amountMode, custom, balanceCents, duesCents]);

  // Months are arithmetic on the association's own next charge date, so the
  // screen never drifts from the demo clock or a real one.
  const chargeMonth = nextCharge.slice(0, 7);
  const monthAfter = (ym: string, steps = 1) => {
    const year = Number(ym.slice(0, 4));
    const month = Number(ym.slice(5, 7)) - 1 + steps;
    return `${year + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}`;
  };
  const upcomingMonth = monthAfter(chargeMonth, 0);
  const skipsUpcoming = skipMonth === upcomingMonth;
  const autopayMonth = skipsUpcoming ? monthAfter(upcomingMonth) : upcomingMonth;
  const autopayDate = `${autopayMonth}-${String(autopayDay).padStart(2, "0")}`;
  const monthLabel = (ym: string) => formatDate(`${ym}-01`, "long").replace(/ 1,/, "");

  function persistAutopay(next: {
    on: boolean;
    day?: number;
    capCents?: number | null;
    skipMonth?: string | null;
  }) {
    const day = next.day ?? autopayDay;
    const cap = next.capCents === undefined ? capCents : next.capCents;
    const skip = next.skipMonth === undefined ? skipMonth : next.skipMonth;
    void setAutopay(
      next.on
        ? {
            day,
            capCents: cap ?? undefined,
            skipMonth: skip ?? undefined,
            instrumentId: autopayInstrument?.id,
            // Kept from the first save, so changing the day later does not
            // move the start; set now, so the promise on screen ("Next
            // autopay: October 1") is the month the cron waits for.
            startMonth: plan?.startMonth ?? upcomingMonth,
          }
        : null,
    ).then((ok) => {
      if (!ok) return;
      if (!next.on) notify("Autopay is off. Nothing will be taken.", "info");
      else if (next.skipMonth) notify(`${monthLabel(next.skipMonth)} will be skipped.`);
      else if (next.skipMonth === null) notify("Nothing is skipped now.");
      else notify(`Autopay ${money(duesCents)} on the ${ordinal(day)}.`);
    });
  }

  const policy: PlatformFeePolicy = {
    flatCents: settings.paymentFeeCents,
    paidBy: settings.paymentFeePaidBy,
    waiveOnAch: settings.paymentFeeWaivedOnAch,
  };
  const cheapest = cheapestRail(instruments, amountCents, policy);
  const cost = selected
    ? computePaymentCost(selected.kind, amountCents, policy)
    : null;

  if (!owner) return null;

  /* ------------------------------------------------------------- receipt */
  if (paid) {
    return (
      <div className="animate-rise space-y-5">
        <Card className="relative overflow-hidden p-6 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-aurora opacity-80" aria-hidden />
          <div className="relative mx-auto mb-4 flex justify-center">
            <SuccessMark size={64} />
          </div>
          <h1 className="relative text-title2 font-semibold tracking-[-0.02em] text-fg">Payment sent</h1>
          <p className="tnum relative mt-1 text-title2 font-semibold tracking-[-0.02em] text-fg">
            <CountUp cents={paid.amountCents} showCents />
          </p>
          <p className="mt-2 text-body leading-relaxed text-fg-muted">
            {describeInstrument(paid.instrument)} ·{" "}
            {FEE_SCHEDULE[paid.instrument.kind].settlement === "Same day"
              ? "Paid today"
              : `Takes ${FEE_SCHEDULE[paid.instrument.kind].settlement.toLowerCase()}`}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setPaid(null)}>
              Back
            </Button>
            <Link
              href="/resident/account"
              className="press shimmer flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-gradient text-body font-medium text-primary-fg shadow-raised hover:shadow-glow"
            >
              View account
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  /* ---------------------------------------------------------------- form */
  const heading = (
    <ResidentTitle
      title="Payments"
      subtitle={
        // What is owed now, before when the next bill lands. "Dues due
        // October 1" above a past-due September balance read as all clear.
        owner.daysPastDue > 0 && balanceCents > 0
          ? `${money(balanceCents)} past due, ${pluralize(owner.daysPastDue, "day")}`
          : `Next dues ${formatDate(nextCharge, "long")}`
      }
    />
  );

  // Shared between the demo and Stripe branches, as a JSX value rather than a
  // nested component so the custom-amount input does not remount per keystroke.
  const amountSection = (
    <section>
      <SectionTitle>Amount</SectionTitle>
      <Card className="p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAmountMode("balance")}
            aria-pressed={amountMode === "balance"}
            className={cn(
              "press flex-1 rounded-lg border px-3 py-3 text-left",
              amountMode === "balance"
                ? "border-primary bg-primary-soft shadow-[0_0_0_3px_var(--primary-soft)]"
                : "border-border hover:bg-surface-2",
            )}
          >
            <span className="block text-footnote font-medium text-fg-muted">
              {balanceCents > 0 ? "Full balance" : "Next dues"}
            </span>
            <span className="tnum mt-0.5 block text-headline font-semibold text-fg">
              {money(balanceCents > 0 ? balanceCents : duesCents)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAmountMode("custom")}
            aria-pressed={amountMode === "custom"}
            className={cn(
              "press flex-1 rounded-lg border px-3 py-3 text-left",
              amountMode === "custom"
                ? "border-primary bg-primary-soft shadow-[0_0_0_3px_var(--primary-soft)]"
                : "border-border hover:bg-surface-2",
            )}
          >
            <span className="block text-footnote font-medium text-fg-muted">Other amount</span>
            {amountMode === "custom" && amountCents ? (
              <span className="tnum mt-0.5 block text-headline font-semibold text-fg">{money(amountCents)}</span>
            ) : (
              <span className="mt-0.5 block text-headline font-medium text-fg-subtle">Choose</span>
            )}
          </button>
        </div>
        {amountMode === "custom" ? (
          <label className="mt-3 block">
            <span className="sr-only">Payment amount</span>
            <div className="flex h-11 items-center gap-1 rounded-lg border border-border-2 bg-surface-2 px-3">
              <span className="text-headline text-fg-muted">$</span>
              <input
                autoFocus
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="0.00"
                className="tnum w-full bg-transparent text-headline font-medium text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
          </label>
        ) : null}
      </Card>
    </section>
  );

  // Autopay, shared by the demo and Stripe branches as a JSX value.
  const autopaySection = (
        <section id="autopay" className="scroll-mt-20">
          <SectionTitle>
            <Term k="autopay">Autopay</Term>
          </SectionTitle>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <IconTile icon={Repeat} tint="violet" size="md" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-fg">
                  Autopay {money(duesCents)} on the {ordinal(autopayDay)}
                </p>
                <p className="mt-0.5 text-footnote leading-snug text-fg-muted">
                  {selected
                    ? `From ${describeInstrument(selected)}. Cancel any time.`
                    : "Add a payment method to turn this on."}
                </p>
              </div>
              <Toggle
                checked={autopay}
                onChange={(on) => {
                  setAutopayOn(on);
                  persistAutopay({ on });
                }}
                disabled={!selected}
                label="Enable autopay"
              />
            </div>

            {autopay ? (
              <>
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-footnote font-semibold text-fg-muted">
                    Day of the month
                  </p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {Array.from({ length: settings.autopayLateAfterDay }, (_, i) => i + 1).map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setAutopayDay(day);
                          persistAutopay({ on: true, day });
                        }}
                        aria-pressed={autopayDay === day}
                        className={cn(
                          "tnum flex h-8 items-center justify-center rounded-md text-footnote font-medium transition-colors",
                          autopayDay === day
                            ? "bg-brand-gradient text-primary-fg shadow-raised"
                            : day === settings.autopayLateAfterDay
                              ? "border border-warn/40 bg-warn-soft text-warn"
                              : "border border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-footnote leading-snug text-fg-subtle">
                    The board set the {ordinal(settings.autopayLateAfterDay)} as the last day before
                    dues are late.
                    {collections.lateFeeCents > 0
                      ? ` A ${money(collections.lateFeeCents)} late fee applies from ${collections.lateNoticeDay} days past due.`
                      : ""}
                  </p>
                </div>

                {moduleOn("autopay-extras") ? (
                  <>
                {/* The cap. The one fear that keeps people off autopay is a
                    special assessment or a fine draining the account on the
                    first. Above the cap, the balance waits for them. */}
                <div className="mt-3 border-t border-border pt-3">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={capCents !== null}
                      onChange={(e) => {
                        const next = e.target.checked ? (capCents ?? duesCents) : null;
                        setCapCents(next);
                        setCapText(next ? String(next / 100) : "");
                        persistAutopay({ on: true, capCents: next });
                      }}
                      className="mt-0.5 size-4 rounded border-border-2"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-fg">
                        Set a limit for automatic payments
                      </span>
                      <span className="block text-footnote leading-snug text-fg-muted">
                        If you owe more than this, from a special assessment or a fine, you pay the
                        extra yourself. Regular dues still go out on the {ordinal(autopayDay)}.
                      </span>
                    </span>
                  </label>
                  {capCents !== null ? (
                    <div className="mt-2 flex items-center gap-2 pl-6">
                      <span className="text-body text-fg-muted">$</span>
                      <input
                        inputMode="decimal"
                        aria-label="Autopay cap in dollars"
                        value={capText}
                        onChange={(e) => setCapText(e.target.value)}
                        onBlur={() => {
                          const parsed = Math.round(
                            Number(capText.replace(/[^0-9.]/g, "")) * 100,
                          );
                          const next = Number.isFinite(parsed) && parsed > 0 ? parsed : duesCents;
                          setCapCents(next);
                          setCapText(String(next / 100));
                          if (next !== capCents) persistAutopay({ on: true, capCents: next });
                        }}
                        className={cn(fieldClass, "tnum w-28")}
                      />
                      <span className="text-footnote text-fg-subtle">
                        Dues are {money(duesCents)}.
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* A tight month, answered without turning the whole thing off
                    and forgetting to turn it back on. */}
                <div className="mt-3 border-t border-border pt-3">
                  {skipsUpcoming ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-body font-medium text-fg">
                        Skipping {monthLabel(upcomingMonth)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSkipMonth(null);
                          persistAutopay({ on: true, skipMonth: null });
                        }}
                      >
                        Undo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-body font-medium text-fg">Skip next month</p>
                        <p className="text-footnote leading-snug text-fg-muted">
                          No automatic payment in {monthLabel(upcomingMonth)}. It starts again the
                          month after. You can still pay here yourself.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSkipMonth(upcomingMonth);
                          persistAutopay({ on: true, skipMonth: upcomingMonth });
                        }}
                      >
                        Skip {monthLabel(upcomingMonth).split(" ")[0]}
                      </Button>
                    </div>
                  )}
                </div>

                  </>
                ) : null}

                <div className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-footnote font-medium text-ok">
                  Next autopay: {formatDate(autopayDate, "long")} · {relativeDays(autopayDate)}
                  {skipsUpcoming ? ` · ${monthLabel(upcomingMonth)} skipped` : ""}
                </div>
              </>
            ) : null}
          </Card>
        </section>
  );

  // A real association pays through Stripe or not at all. The demo path below
  // must never run here: it writes a settled payment with no money moving.
  if (isRemote) {
    const stripeAccountId = community.association.stripeAccountId;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    const inFlight = (community.pendingPayments ?? []).filter(
      (p) => p.unitId === owner.id && p.state === "pending",
    );
    return (
      <div className="animate-rise space-y-6">
        {heading}
        {inFlight.map((p) => (
          <Callout
            key={p.id}
            tone="info"
            icon={<Repeat className="size-4" />}
            title={`${money(p.amountCents)} is processing`}
          >
            {p.rail === "ach" ? (
              <>
                Bank payments take about 4 <Term k="business-days">business days</Term> to clear.
              </>
            ) : (
              "This payment is being confirmed."
            )}
          </Callout>
        ))}
        {amountSection}
        {stripeAccountId && publishableKey ? (
          <>
            <TestModeGuide audience="resident" />
            <StripePayPanel
              associationId={community.association.id}
              unitId={owner.id}
              amountCents={amountCents}
              publishableKey={publishableKey}
              instruments={instruments}
              selection={stripeSelection}
              onSelect={setStripeSelection}
            />
            {adding ? (
              <div className="space-y-2">
                <AddMethod onDone={() => setAdding(false)} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setAdding(false)}
                >
                  <X className="size-3.5" />
                  Cancel
                </Button>
              </div>
            ) : (
              // Paying with a new bank or card is the choice above. This is
              // the other thing: keeping a method on file for autopay without
              // paying today. Two identical-looking ways to add one was one
              // too many.
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-3.5" />
                Save a card or bank account
              </Button>
            )}
            {autopaySection}
          </>
        ) : (
          <Callout
            tone="info"
            icon={<Info className="size-4" />}
            title={
              stripeAccountId
                ? "Online payments aren't working right now"
                : "Your board hasn't set up online payments yet"
            }
          >
            {stripeAccountId ? (
              "Please tell your board. You can still pay the way you used to."
            ) : can("finances") ? (
              <>
                You can do it:{" "}
                <Link href="/board/settings" className="font-medium underline">
                  Set up payments in Settings
                </Link>
                . It takes a few minutes and owners can pay here once it is done.
              </>
            ) : (
              "Ask a board member to finish payment setup in Settings. Until then, dues are collected the way your board announced."
            )}
          </Callout>
        )}
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-6">
      {heading}

      {amountSection}

      {/* Instruments */}
      <section>
        {/* A "Manage" toggle used to swap this whole list into an edit mode
            and back with a "Done" link, which is a mode nobody asked to enter.
            Each row now carries its own small menu instead. */}
        <SectionTitle>Pay from</SectionTitle>

        {instruments.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="text-body font-medium text-fg">No payment method yet</p>
            <p className="mt-1 text-footnote text-fg-muted">
              A bank transfer costs less than a card.
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
                    "flex min-h-14 w-full items-center gap-3 px-4 py-3",
                    index > 0 && "border-t border-border",
                    active && "bg-brand-soft/60",
                  )}
                >
                  <button
                    type="button"
                    disabled={expired}
                    onClick={() => setSelectedId(instrument.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
                  >
                    <IconTile
                      icon={Icon}
                      tint="blue"
                      variant={active ? "solid" : "soft"}
                      size="md"
                      className={cn("transition-transform duration-200", active && "scale-105")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {/* The last four stay whole: they are how a person tells two cards apart. */}
                        <span className="flex min-w-0 text-body font-medium text-fg">
                          <span className="truncate">{instrument.label}</span>
                          <span className="tnum shrink-0">&nbsp;••{instrument.mask}</span>
                        </span>
                        {instrument.isDefault ? <Badge tone="neutral">Default</Badge> : null}
                        {/* Only when this one costs the owner strictly less. A tie
                            on the owner's side is not "cheapest", whatever it
                            saves the association. */}
                        {cheapest?.instrument.id === instrument.id &&
                        cheapest.saves === "owner" &&
                        !expired ? (
                          <Badge tone="ok">Cheapest</Badge>
                        ) : null}
                        {expired ? <Badge tone="danger">Expired</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-footnote text-fg-muted">
                        {policy.paidBy === "owner"
                          ? instrumentCost.platformCents === 0
                            ? "No fee to you"
                            : `${money(instrumentCost.platformCents)} fee · ${money(instrumentCost.residentPaysCents)} total`
                          : "No fee to you"}
                      </span>
                    </span>
                    {active ? (
                      <span className="pop-in flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-primary-fg">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>

                  <InstrumentMenu
                    label={instrument.label}
                    isDefault={instrument.isDefault}
                    open={menuFor === instrument.id}
                    onToggle={() => setMenuFor(menuFor === instrument.id ? null : instrument.id)}
                    onMakeDefault={() => {
                      setDefaultInstrument(instrument.id);
                      setMenuFor(null);
                      notify(`${instrument.label} is now the default`);
                    }}
                    onRemove={() => {
                      const undo = removeInstrument(instrument.id);
                      setMenuFor(null);
                      notify(
                        `Removed ${instrument.label} ••${instrument.mask}`,
                        "warn",
                        undo ? { label: "Undo", onClick: undo } : undefined,
                      );
                    }}
                  />
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
            <div className="flex justify-between text-body">
              <dt className="text-fg-muted">Dues</dt>
              <dd className="tnum font-medium text-fg">{money(cost.amountCents)}</dd>
            </div>
            {policy.paidBy === "owner" && cost.platformCents > 0 ? (
              <div className="flex justify-between text-body">
                <dt className="text-fg-muted">Payment fee</dt>
                <dd className="tnum font-medium text-fg">{money(cost.platformCents)}</dd>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-headline">
              <dt className="font-semibold text-fg">You pay</dt>
              <dd className="tnum font-semibold text-fg">{money(cost.residentPaysCents)}</dd>
            </div>
          </dl>
          <Button
            variant="primary"
            size="lg"
            className="mt-4 w-full"
            disabled={amountCents <= 0 || isExpired(selected, REFERENCE)}
            onClick={() => {
              // The receipt and the books are written from the same click, so
              // a resident can never be shown a payment the association has no
              // record of.
              recordPayment({
                ownerId: owner.id,
                amountCents,
                processorCents: cost.processorCents,
                platformCents: cost.platformCents,
                platformPaidBy: policy.paidBy,
                method: `${selected.label} ••${selected.mask}`,
                kind: selected.kind,
              });
              setPaid({ amountCents: cost.residentPaysCents, instrument: selected });
            }}
          >
            Pay {money(cost.residentPaysCents)}
          </Button>
        </Card>
      ) : null}

      {autopaySection}
    </div>
  );
}
