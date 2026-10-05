"use client";

import { Check } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { vendorDecisions } from "@/lib/metrics";
import type { Payout } from "@/lib/types";
import { money } from "@/lib/utils";

/**
 * Vendor payments waiting on a second signature.
 *
 * This card used to be a bill inbox: an address vendors emailed invoices to,
 * Attach an invoice, Approve and Pay by ACH on each bill. None of it was
 * real. Nothing receives mail at the address, nothing files an invoice for a
 * real association, and no code sends a vendor money by ACH, so a board that
 * tried the demo was sold a page it would not get. Hidden for everyone on
 * 2026-10-05 until it is real (docs/work-tracker.md, section 4). The vendor
 * list, Record a payment and the payments made are the page.
 *
 * What stays is a payment that already needs a signature, which a real
 * association can have from before and which approvePayout does carry out.
 * With none waiting the card is not drawn.
 */
export function InvoiceInbox() {
  const { community, approvePayout } = useAppState();
  const { notify } = useToast();
  const toSign = vendorDecisions(community).toSign;

  if (toSign.length === 0) return null;

  /** Runs a mutation and turns a refusal into a toast instead of a crash. */
  function approve(payout: Payout) {
    try {
      approvePayout(payout.id);
      notify(`Approved ${payout.vendor}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "That did not save", "warn");
    }
  }

  return (
    <Card>
      <CardHeader title="Waiting on a signature" subtitle="Payments that need a second approval" />
      <ul>
        {toSign.map((payout, index) => (
          <SignRow key={payout.id} payout={payout} primary={index === 0} onApprove={() => approve(payout)} />
        ))}
      </ul>
    </Card>
  );
}

/** A payment already sent for approval that is still a signature short. */
function SignRow({
  payout,
  primary,
  onApprove,
}: {
  payout: Payout;
  primary: boolean;
  onApprove: () => void;
}) {
  const signed = payout.approvals.map((a) => a.name.split(" ")[0]).join(" and ");
  return (
    <li
      id={`sign-${payout.id}`}
      className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-5 py-3.5 last:border-b-0"
    >
      <div className="min-w-[12rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body font-medium text-fg">{payout.vendor}</p>
          <Badge tone="warn">Needs a signature</Badge>
        </div>
        <p className="mt-0.5 text-footnote text-fg-muted">
          {payout.invoiceNumber}, {payout.method === "ach" ? "bank transfer" : "check"}
        </p>
        <p className="mt-1.5 text-footnote text-fg-subtle">
          {payout.approvals.length} of {payout.approvalsRequired} approvals
          {signed ? `, ${signed} signed` : ""}
        </p>
      </div>
      <div className="ml-auto shrink-0 text-right">
        <p className="tnum text-body font-semibold text-fg">{money(payout.amountCents)}</p>
        <div className="mt-1.5 flex justify-end">
          <Button variant={primary ? "primary" : "secondary"} size="sm" onClick={onApprove}>
            <Check className="size-3.5" />
            Approve
          </Button>
        </div>
      </div>
    </li>
  );
}
