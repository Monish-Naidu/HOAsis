"use client";

import { useState, useSyncExternalStore } from "react";
import { Badge, Button, SettingRow } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { homeCount } from "@/lib/metrics";
import { useToast } from "@/components/app/toast";
import { monthlyFor } from "@/lib/pricing";
import { formatDate, money } from "@/lib/utils";
import { usePhase } from "./trial-banner";

/**
 * The subscription, on Settings.
 *
 * One row: what it costs, where the trial stands, and the one button that
 * matters right now (add a card, or manage the one on file). Stripe hosts
 * both pages; nothing about a card is typed into ours.
 */
export function BillingRow() {
  const { community } = useAppState();
  const { notify } = useToast();
  const phase = usePhase();
  const [busy, setBusy] = useState(false);

  const a = community.association;
  const homes = homeCount(community);
  const price = `${money(monthlyFor(homes), { cents: false })} a month for ${homes} ${homes === 1 ? "home" : "homes"}`;
  // Read after hydration only: the page prerenders with no query string.
  const justAdded = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("billing") === "added",
    () => false,
  );

  async function open(path: "checkout" | "portal") {
    setBusy(true);
    try {
      const response = await fetch(`/api/billing/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId: community.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Stripe did not open. Try again in a moment.");
      }
      window.location.assign(data.url);
    } catch (error) {
      setBusy(false);
      notify(error instanceof Error ? error.message : "Stripe did not open. Try again in a moment.", "warn");
    }
  }

  let description = price;
  let status: React.ReactNode = null;
  let button: React.ReactNode = null;

  if (!phase) {
    description = `${price}. The clock starts when the association is founded.`;
  } else if (phase.phase === "trialing") {
    description = `Free until ${formatDate(phase.endsOn, "long")}, ${phase.daysLeft} ${
      phase.daysLeft === 1 ? "day" : "days"
    } left. Then ${price}. A card added now is first charged the day after.`;
    status = <Badge tone={phase.closing ? "warn" : "brand"}>{phase.daysLeft} days free</Badge>;
    button = (
      <Button variant="primary" size="sm" onClick={() => open("checkout")} disabled={busy}>
        {busy ? "Opening…" : "Add a card"}
      </Button>
    );
  } else if (phase.phase === "ended") {
    description = `The free 90 days ended ${formatDate(phase.endsOn, "long")}. ${price} from the day a card is added.`;
    status = <Badge tone="danger">Free period ended</Badge>;
    button = (
      <Button variant="primary" size="sm" onClick={() => open("checkout")} disabled={busy}>
        {busy ? "Opening…" : "Add a card"}
      </Button>
    );
  } else if (phase.phase === "past_due") {
    description = `${price}. The last payment did not go through; Stripe will retry.`;
    status = <Badge tone="danger">Payment failed</Badge>;
    button = (
      <Button variant="primary" size="sm" onClick={() => open("portal")} disabled={busy}>
        {busy ? "Opening…" : "Update the card"}
      </Button>
    );
  } else if (phase.phase === "canceled") {
    // The phase's own word is "ended". Owners can still pay while it is, so
    // the card says what stopped (the board's access) and not a bare "Cancelled".
    description = `The subscription ended. Owners can still pay; the board is read-only. Nothing is billed and nothing is deleted. Start again at ${price} on Stripe's billing page.`;
    status = <Badge tone="neutral">Subscription ended</Badge>;
    button = (
      <Button variant="secondary" size="sm" onClick={() => open("portal")} disabled={busy}>
        {busy ? "Opening…" : "Manage billing"}
      </Button>
    );
  } else {
    const card = a.billing?.last4
      ? `${a.billing.brand ? a.billing.brand[0].toUpperCase() + a.billing.brand.slice(1) : "Card"} ending ${a.billing.last4}`
      : "Card on file";
    description = `${price}, billed to ${card}. Invoices and the card live on Stripe's page.`;
    status = <Badge tone="ok">{justAdded ? "Card added" : "Active"}</Badge>;
    button = (
      <Button variant="secondary" size="sm" onClick={() => open("portal")} disabled={busy}>
        {busy ? "Opening…" : "Manage billing"}
      </Button>
    );
  }

  return (
    <div id="billing">
      <SettingRow title="Your subscription" description={description}>
        <div className="flex items-center gap-2">
          {status}
          {button}
        </div>
      </SettingRow>
    </div>
  );
}
