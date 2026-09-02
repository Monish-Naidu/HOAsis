"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { refreshRemote } from "@/lib/data/remote-store";

/**
 * Saving a payment method for a real association: a SetupIntent collected by
 * the Payment Element, so a card number or bank login never touches our code
 * at all. This is the production half of the swap add-method's demo tokenizer
 * always promised.
 *
 * A bank added through Financial Connections verifies instantly. The
 * micro-deposit fallback does not, and the panel says so instead of showing a
 * method that cannot be charged yet.
 */
export function StripeSetupPanel({
  associationId,
  unitId,
  publishableKey,
  onDone,
}: {
  associationId: string;
  unitId: string;
  publishableKey: string;
  onDone: () => void;
}) {
  const [setup, setSetup] = useState<{ clientSecret: string; account: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/stripe/setup-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ associationId, unitId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not start");
        if (!cancelled) setSetup({ clientSecret: data.clientSecret, account: data.stripeAccountId });
      } catch (error) {
        if (!cancelled) {
          setProblem(error instanceof Error ? error.message : "Could not start");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [associationId, unitId]);

  if (problem) {
    return (
      <Card className="p-4">
        <p className="text-[13px] font-medium text-danger">{problem}</p>
      </Card>
    );
  }
  if (!setup) {
    return (
      <Card className="p-4">
        <p className="text-[13px] text-fg-muted">Opening a secure form…</p>
      </Card>
    );
  }
  return (
    <SetupElements
      setup={setup}
      publishableKey={publishableKey}
      associationId={associationId}
      unitId={unitId}
      onDone={onDone}
    />
  );
}

function SetupElements({
  setup,
  publishableKey,
  associationId,
  unitId,
  onDone,
}: {
  setup: { clientSecret: string; account: string };
  publishableKey: string;
  associationId: string;
  unitId: string;
  onDone: () => void;
}) {
  const stripePromise = useMemo<Promise<StripeJs | null>>(
    () => loadStripe(publishableKey, { stripeAccount: setup.account }),
    [publishableKey, setup.account],
  );
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: setup.clientSecret }}>
      <SetupForm associationId={associationId} unitId={unitId} onDone={onDone} />
    </Elements>
  );
}

function SetupForm({
  associationId,
  unitId,
  onDone,
}: {
  associationId: string;
  unitId: string;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function save() {
    if (!stripe || !elements) return;
    setBusy(true);
    setProblem(null);
    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/resident/pay` },
    });
    if (result.error) {
      setBusy(false);
      setProblem(result.error.message ?? "The method could not be saved.");
      return;
    }
    const intent = result.setupIntent;
    if (intent?.status === "succeeded") {
      const response = await fetch("/api/stripe/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId, unitId, setupIntentId: intent.id }),
      });
      setBusy(false);
      if (!response.ok) {
        const data = await response.json();
        setProblem(data.error ?? "The method could not be saved.");
        return;
      }
      await refreshRemote();
      onDone();
      return;
    }
    setBusy(false);
    // Micro-deposits: the bank is real, verification takes a day or two.
    setVerifying(true);
  }

  if (verifying) {
    return (
      <Card className="p-4">
        <p className="text-[15px] font-medium text-fg">Verification started</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          Your bank will receive a small deposit in the next day or two. Come back and confirm the
          amount to finish adding this account.
        </p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={onDone}>
          Done
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <PaymentElement />
      {problem ? <p className="mt-3 text-[13px] font-medium text-danger">{problem}</p> : null}
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        onClick={save}
        disabled={busy || !stripe}
      >
        {busy ? "Saving…" : "Save payment method"}
      </Button>
      <p className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-snug text-fg-subtle">
        <ShieldCheck className="mt-px size-3 shrink-0" />
        Handled by Stripe. Your card number or bank login never reaches ExpressHOA.
      </p>
    </Card>
  );
}
