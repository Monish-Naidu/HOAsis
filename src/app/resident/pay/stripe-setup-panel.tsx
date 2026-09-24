"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button, ButtonLink, Card } from "@/components/ui/primitives";
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
  const [verifying, setVerifying] = useState<{ url: string | null } | null>(null);
  // Stripe's form loads in its own frame; until it says so, saving is a no-op
  // and a failure to load would otherwise be silent.
  const [ready, setReady] = useState(false);

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
    const microdeposits =
      intent?.status === "requires_action" &&
      intent.next_action?.type === "verify_with_microdeposits";
    if (!intent || (intent.status !== "succeeded" && !microdeposits)) {
      setBusy(false);
      setProblem("The method could not be saved. Nothing was charged.");
      return;
    }
    // Saved either way. A bank on micro-deposits is a row marked verifying,
    // with Stripe's page for confirming the amounts, so it is still here
    // when the owner comes back in two days.
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
    if (microdeposits) {
      const action = intent.next_action as {
        verify_with_microdeposits?: { hosted_verification_url?: string };
      } | null;
      setVerifying({ url: action?.verify_with_microdeposits?.hosted_verification_url ?? null });
      return;
    }
    onDone();
  }

  if (verifying) {
    return (
      <Card className="p-4">
        <p className="text-[15px] font-medium text-fg">Verification started</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          Two small deposits will land in that account in a day or two. Confirm the amounts and
          the account is ready; until then it shows here as verifying.
        </p>
        <div className="mt-3 flex gap-2">
          {verifying.url ? (
            <ButtonLink
              href={verifying.url}
              target="_blank"
              rel="noreferrer"
              variant="primary"
              size="md"
              className="flex-1"
            >
              Confirm deposits
              <ExternalLink className="size-3.5" />
            </ButtonLink>
          ) : null}
          <Button variant="secondary" size="md" className="flex-1" onClick={onDone}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={(event) =>
          setProblem(event.error?.message ?? "Stripe could not open the form. Try again.")
        }
      />
      {problem ? <p className="mt-3 text-[13px] font-medium text-danger">{problem}</p> : null}
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        onClick={save}
        disabled={busy || !stripe || !ready}
      >
        {busy ? "Saving…" : "Save payment method"}
      </Button>
      <p className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-snug text-fg-subtle">
        <ShieldCheck className="mt-px size-3 shrink-0" />
        Handled by Stripe. Your card number or bank login never reaches Your HOAsis.
      </p>
    </Card>
  );
}
