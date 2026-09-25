"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle2, Clock3, CreditCard, ExternalLink, Info, Landmark } from "lucide-react";
import { Badge, Button, Callout, Card } from "@/components/ui/primitives";
import type { PaymentCost, PaymentInstrument } from "@/lib/payments/instruments";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { refreshRemote } from "@/lib/data/remote-store";
import { cn, money } from "@/lib/utils";
import { InstrumentMenu } from "./instrument-menu";

/**
 * The real-money pay panel, rendered only for a remote association with a
 * Stripe connected account.
 *
 * The client never prices anything: it names an amount and a rail, and the
 * payment-intent route answers with the authoritative cost, which is what the
 * pay button shows and what the intent will charge. Saved instruments arrive
 * with the setup-intent stage; today the Payment Element collects the method.
 *
 * A card settles while the resident watches (we poll for the webhook's row).
 * An ACH payment does not, and the panel says so instead of pretending: the
 * pending receipt is the honest state of a rail that takes about four days.
 */

type Phase =
  | { name: "rail" }
  | { name: "element"; clientSecret: string; account: string; cost: PaymentCost; rail: Rail }
  | { name: "confirm-saved"; clientSecret: string; account: string; cost: PaymentCost; label: string }
  | { name: "finish-setup"; setupIntentId: string }
  | { name: "waiting"; intentId: string }
  | { name: "settled"; amountCents: number }
  | { name: "received" }
  | { name: "pending" }
  /** A bank typed in by hand: Stripe sends two small deposits first. */
  | { name: "verify"; url: string | null };

type Rail = "ach" | "card";

const POLL_MS = 2_000;
const POLL_LIMIT = 10;

/**
 * The hosted page for confirming micro-deposits, when a bank was typed in
 * rather than signed in to. Stripe only charges once the amounts match, so
 * this is the resident's next step, not an error.
 */
function microdepositUrl(intent: {
  next_action?: {
    type?: string;
    verify_with_microdeposits?: { hosted_verification_url?: string } | null;
  } | null;
}): string | null {
  const action = intent.next_action;
  if (action?.type !== "verify_with_microdeposits") return null;
  return action.verify_with_microdeposits?.hosted_verification_url ?? null;
}

async function waitForSettlement(intentId: string): Promise<boolean> {
  const supabase = supabaseBrowser();
  for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
    const { data } = await supabase
      .from("payments")
      .select("state")
      .eq("stripe_payment_intent_id", intentId)
      .maybeSingle();
    if (data?.state === "settled") return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

export function StripePayPanel({
  associationId,
  unitId,
  amountCents,
  publishableKey,
  instruments,
  selection,
  onSelect,
}: {
  associationId: string;
  unitId: string;
  amountCents: number;
  publishableKey: string;
  instruments: PaymentInstrument[];
  /** A saved instrument's id, or "new-ach" / "new-card". Owned by the pay flow. */
  selection: string;
  onSelect: (selection: string) => void;
}) {
  const { removeInstrument, setDefaultInstrument } = useAppState();
  const { notify } = useToast();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // Coming back from a 3DS or bank redirect, the URL carries the intent and
  // the books are whatever the webhook has written by now. This panel never
  // server-renders (remote mode exists only after hydration), so the URL can
  // seed the initial phase directly.
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window === "undefined") return { name: "rail" };
    const params = new URLSearchParams(window.location.search);
    const status = params.get("redirect_status");
    const intentId = params.get("payment_intent");
    const setupIntentId = params.get("setup_intent");
    if (intentId && status === "succeeded") return { name: "waiting", intentId };
    if (intentId && status === "processing") return { name: "pending" };
    if (intentId && status === "requires_action") return { name: "verify", url: null };
    if (setupIntentId && status === "succeeded") return { name: "finish-setup", setupIntentId };
    return { name: "rail" };
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_intent") || params.get("setup_intent")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Back from a bank redirect while saving a method: record what was saved.
  useEffect(() => {
    if (phase.name !== "finish-setup") return;
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/stripe/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId, unitId, setupIntentId: phase.setupIntentId }),
      });
      await refreshRemote();
      if (cancelled) return;
      setSavedNote(response.ok ? "Payment method saved." : null);
      setPhase({ name: "rail" });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name]);

  useEffect(() => {
    if (phase.name !== "waiting") return;
    let cancelled = false;
    (async () => {
      const settled = await waitForSettlement(phase.intentId);
      await refreshRemote();
      if (cancelled) return;
      setPhase(settled ? { name: "settled", amountCents } : { name: "received" });
    })();
    return () => {
      cancelled = true;
    };
    // amountCents is display-only here; the books came from the webhook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name]);

  const saved = instruments.find((i) => i.id === selection);
  const newRail: Rail = selection === "new-card" ? "card" : "ach";
  const savedUsable = !saved || (saved.token.startsWith("pm_") && saved.status !== "verifying");

  async function begin() {
    setBusy(true);
    setProblem(null);
    setSavedNote(null);
    try {
      const response = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          saved
            ? { associationId, unitId, amountCents, instrumentId: saved.id }
            : { associationId, unitId, amountCents, rail: newRail },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start the payment");
      setPhase(
        saved
          ? {
              name: "confirm-saved",
              clientSecret: data.clientSecret,
              account: data.stripeAccountId,
              cost: data.cost,
              label: `${saved.label} ••${saved.mask}`,
            }
          : {
              name: "element",
              clientSecret: data.clientSecret,
              account: data.stripeAccountId,
              cost: data.cost,
              rail: newRail,
            },
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not start the payment");
    } finally {
      setBusy(false);
    }
  }

  if (phase.name === "settled") {
    return (
      <Receipt
        icon={<CheckCircle2 className="size-6" />}
        tone="ok"
        title="Payment received"
        detail={`${money(phase.amountCents)} has been applied to your oldest charge first.`}
      />
    );
  }
  if (phase.name === "received") {
    return (
      <Receipt
        icon={<CheckCircle2 className="size-6" />}
        tone="ok"
        title="Payment received"
        detail="It will show on your account shortly."
      />
    );
  }
  if (phase.name === "pending") {
    return (
      <Receipt
        icon={<Clock3 className="size-6" />}
        tone="pending"
        title="Payment started"
        detail="Bank payments take about 4 business days to clear. It will appear on your account as soon as it does."
      />
    );
  }
  if (phase.name === "verify") {
    return (
      <Receipt
        icon={<Landmark className="size-6" />}
        tone="pending"
        title="One more step: confirm your bank"
        detail="We will send two small deposits to that account in a day or two. Enter the amounts and the payment goes through. Nothing is taken until then."
        link={phase.url ? { label: "Confirm the deposits", url: phase.url } : undefined}
      />
    );
  }
  if (phase.name === "waiting") {
    return (
      <Card className="p-6 text-center">
        <p className="text-body font-medium text-fg">Finishing up…</p>
        <p className="mt-1 text-footnote text-fg-muted">Confirming your payment with the bank.</p>
      </Card>
    );
  }
  if (phase.name === "finish-setup") {
    return (
      <Card className="p-6 text-center">
        <p className="text-body font-medium text-fg">Saving your payment method…</p>
      </Card>
    );
  }

  if (phase.name === "element") {
    return (
      <ElementStep
        publishableKey={publishableKey}
        phase={phase}
        onDone={(next) => setPhase(next)}
        onBack={() => setPhase({ name: "rail" })}
      />
    );
  }
  if (phase.name === "confirm-saved") {
    return (
      <ConfirmSaved
        publishableKey={publishableKey}
        phase={phase}
        onDone={(next) => setPhase(next)}
        onBack={() => setPhase({ name: "rail" })}
      />
    );
  }

  /* Method choice. The exact fee lands when the server prices the intent. */
  const fresh = [
    { value: "new-ach", label: "New bank account", hint: "Lowest fee", icon: Landmark },
    { value: "new-card", label: "New card", hint: "Paid today", icon: CreditCard },
  ];
  const rowClass = (active: boolean, disabled = false) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
      active ? "border-navy-700 bg-brand-soft dark:border-navy-300" : "border-border",
      disabled ? "opacity-60" : !active && "hover:bg-surface-2",
    );
  return (
    <Card className="p-4">
      {savedNote ? <p className="mb-3 text-footnote font-medium text-ok">{savedNote}</p> : null}
      <div className="space-y-1.5">
        {instruments.map((instrument) => {
          const Icon = instrument.kind === "ach" ? Landmark : CreditCard;
          const verifying = instrument.status === "verifying";
          // A row from before Stripe carries a demo token and cannot be charged.
          const stale = !instrument.token.startsWith("pm_");
          const active = selection === instrument.id;
          return (
            <div key={instrument.id} className={rowClass(active, verifying || stale)}>
              <button
                type="button"
                disabled={verifying || stale}
                onClick={() => onSelect(instrument.id)}
                aria-pressed={active}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Icon className="size-4 shrink-0 text-fg-muted" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {/* The last four stay whole: they are how a person tells two cards apart. */}
                    <span className="flex min-w-0 text-body font-medium text-fg">
                      <span className="truncate">{instrument.label}</span>
                      <span className="tnum shrink-0">&nbsp;••{instrument.mask}</span>
                    </span>
                    {instrument.isDefault ? <Badge tone="neutral">Default</Badge> : null}
                    {verifying ? <Badge tone="warn">Verifying</Badge> : null}
                    {stale ? <Badge tone="danger">Needs updating</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-footnote text-fg-muted">
                    {verifying
                      ? "Confirm the two small deposits to use it"
                      : stale
                        ? "Please add this card or account again"
                        : instrument.kind === "ach"
                          ? "Bank transfer"
                          : "Card"}
                  </span>
                </span>
              </button>
              {verifying && instrument.verifyUrl ? (
                <a
                  href={instrument.verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-footnote font-medium text-brand hover:bg-surface-2"
                >
                  Confirm deposits
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
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
                  removeInstrument(instrument.id);
                  setMenuFor(null);
                  if (active) onSelect("new-ach");
                  notify(`Removed ${instrument.label} ••${instrument.mask}`, "warn");
                }}
              />
            </div>
          );
        })}
        {fresh.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={selection === option.value}
            className={rowClass(selection === option.value)}
          >
            <option.icon className="size-4 shrink-0 text-fg-muted" />
            <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">
              {option.label}
            </span>
            <span className="shrink-0 text-footnote text-fg-muted">{option.hint}</span>
          </button>
        ))}
      </div>
      {problem ? (
        <p className="mt-3 text-footnote font-medium text-danger">{problem}</p>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        disabled={busy || amountCents <= 0 || !savedUsable}
        onClick={begin}
      >
        {busy ? "One moment…" : `Continue to pay ${money(amountCents)}`}
      </Button>
      <p className="mt-2.5 flex items-start gap-1.5 text-footnote leading-snug text-fg-subtle">
        <Info className="mt-px size-3 shrink-0" />
        You will see the fee on the next screen, before you pay.
      </p>
    </Card>
  );
}

function ElementStep({
  publishableKey,
  phase,
  onDone,
  onBack,
}: {
  publishableKey: string;
  phase: Extract<Phase, { name: "element" }>;
  onDone: (next: Phase) => void;
  onBack: () => void;
}) {
  // One Stripe.js instance per connected account, or Elements re-mounts.
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(publishableKey, { stripeAccount: phase.account }),
    [publishableKey, phase.account],
  );
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: phase.clientSecret }}>
      <ConfirmForm phase={phase} onDone={onDone} onBack={onBack} />
    </Elements>
  );
}

/**
 * Paying with a saved method needs no Payment Element: the intent already
 * carries the payment method, so this is one confirm call, with 3DS or a bank
 * redirect handled by Stripe.js when a bank demands it.
 */
function ConfirmSaved({
  publishableKey,
  phase,
  onDone,
  onBack,
}: {
  publishableKey: string;
  phase: Extract<Phase, { name: "confirm-saved" }>;
  onDone: (next: Phase) => void;
  onBack: () => void;
}) {
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(publishableKey, { stripeAccount: phase.account }),
    [publishableKey, phase.account],
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { cost } = phase;

  async function confirm() {
    const stripe = await stripePromise;
    if (!stripe) return;
    setBusy(true);
    setProblem(null);
    const result = await stripe.confirmPayment({
      clientSecret: phase.clientSecret,
      confirmParams: { return_url: `${window.location.origin}/resident/pay` },
      redirect: "if_required",
    });
    setBusy(false);
    if (result.error) {
      setProblem(result.error.message ?? "The payment could not be completed.");
      return;
    }
    const intent = result.paymentIntent;
    if (intent?.status === "succeeded") onDone({ name: "waiting", intentId: intent.id });
    else if (intent?.status === "processing") onDone({ name: "pending" });
    else if (intent?.status === "requires_action" && microdepositUrl(intent)) {
      onDone({ name: "verify", url: microdepositUrl(intent) });
    } else setProblem("The payment did not finish. Nothing has been charged.");
  }

  return (
    <Card className="p-4">
      <dl className="mb-4 space-y-1">
        <div className="flex justify-between text-body">
          <dt className="text-fg-muted">Dues</dt>
          <dd className="tnum font-medium text-fg">{money(cost.amountCents)}</dd>
        </div>
        <div className="flex justify-between text-body">
          <dt className="text-fg-muted">
            {cost.platformCents === 0 ? "Payment fee (waived)" : "Payment fee"}
          </dt>
          <dd className="tnum font-medium text-fg">
            {money(cost.residentPaysCents - cost.amountCents)}
          </dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-headline">
          <dt className="font-semibold text-fg">You pay</dt>
          <dd className="tnum font-semibold text-fg">{money(cost.residentPaysCents)}</dd>
        </div>
      </dl>
      <p className="text-footnote text-fg-muted">Paying with {phase.label}.</p>
      {problem ? <p className="mt-3 text-footnote font-medium text-danger">{problem}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button variant="primary" className="flex-1" onClick={confirm} disabled={busy}>
          {busy ? "Paying…" : `Pay ${money(cost.residentPaysCents)}`}
        </Button>
      </div>
    </Card>
  );
}

function ConfirmForm({
  phase,
  onDone,
  onBack,
}: {
  phase: Extract<Phase, { name: "element" }>;
  onDone: (next: Phase) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { cost } = phase;

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true);
    setProblem(null);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/resident/pay` },
    });
    setBusy(false);
    if (result.error) {
      setProblem(result.error.message ?? "The payment could not be completed.");
      return;
    }
    const intent = result.paymentIntent;
    if (intent?.status === "succeeded") onDone({ name: "waiting", intentId: intent.id });
    else if (intent?.status === "processing") onDone({ name: "pending" });
    else if (intent?.status === "requires_action" && microdepositUrl(intent)) {
      onDone({ name: "verify", url: microdepositUrl(intent) });
    } else setProblem("The payment did not finish. Nothing has been charged.");
  }

  return (
    <Card className="p-4">
      <dl className="mb-4 space-y-1">
        <div className="flex justify-between text-body">
          <dt className="text-fg-muted">Dues</dt>
          <dd className="tnum font-medium text-fg">{money(cost.amountCents)}</dd>
        </div>
        <div className="flex justify-between text-body">
          <dt className="text-fg-muted">
            {cost.platformCents === 0 ? "Payment fee (waived)" : "Payment fee"}
          </dt>
          <dd className="tnum font-medium text-fg">{money(cost.residentPaysCents - cost.amountCents)}</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-headline">
          <dt className="font-semibold text-fg">You pay</dt>
          <dd className="tnum font-semibold text-fg">{money(cost.residentPaysCents)}</dd>
        </div>
      </dl>
      <PaymentElement
        onLoadError={(event) =>
          setProblem(event.error?.message ?? "Stripe could not open the form. Try again.")
        }
      />
      {problem ? <p className="mt-3 text-footnote font-medium text-danger">{problem}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button variant="primary" className="flex-1" onClick={confirm} disabled={busy || !stripe}>
          {busy ? "Paying…" : `Pay ${money(cost.residentPaysCents)}`}
        </Button>
      </div>
    </Card>
  );
}

function Receipt({
  icon,
  tone,
  title,
  detail,
  link,
}: {
  icon: React.ReactNode;
  tone: "ok" | "pending";
  title: string;
  detail: string;
  /** An outside step the resident still has to take, opened in a new tab. */
  link?: { label: string; url: string };
}) {
  return (
    <div className="animate-rise space-y-5">
      <Card className="p-6 text-center">
        <span
          className={cn(
            "mx-auto mb-3 flex size-12 items-center justify-center rounded-full",
            tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
          )}
        >
          {icon}
        </span>
        <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">{title}</h1>
        <p className="mt-2 text-body leading-relaxed text-fg-muted">{detail}</p>
        <div className="mt-5 flex flex-col gap-2">
          {link ? (
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center justify-center rounded-lg bg-brand text-body font-medium text-brand-fg"
            >
              {link.label}
            </a>
          ) : null}
          <Link
            href="/resident/account"
            className={cn(
              "flex h-9 items-center justify-center rounded-lg text-body font-medium",
              link ? "border border-border text-fg" : "bg-brand text-brand-fg",
            )}
          >
            View account
          </Link>
        </div>
      </Card>
      {tone === "ok" ? (
        <Callout tone="ok" icon={<CheckCircle2 className="size-4" />} title="Applied to your oldest charge first" />
      ) : null}
    </div>
  );
}
