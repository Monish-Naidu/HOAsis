"use client";

import { Check, ShieldCheck } from "lucide-react";
import { Badge, Button, Callout, Card } from "@/components/ui/primitives";
import { BankConnect } from "@/components/app/bank-connect";
import type { BankAccount } from "@/lib/types";
import { Section } from "./setup-wizard";

/**
 * Connecting the account dues land in.
 *
 * The one thing an association genuinely cannot operate without, which is why
 * it is the last thing setup asks and the first thing the dashboard asks again
 * if it was skipped.
 */
export function BankStep({
  associationName,
  account,
  onConnect,
  onClear,
}: {
  associationName: string;
  account?: BankAccount;
  onConnect: (account: BankAccount) => void;
  onClear: () => void;
}) {
  if (account) {
    return (
      <Section title="Where dues land" detail="Connected. You can change this any time in Money.">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
              <Check className="size-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-fg">{account.institution}</p>
                <Badge tone="ok">Operating</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-fg-muted">Account ending {account.mask}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-fg-subtle">
                Assessments paid through HOAsis are deposited here and appear in your ledger
                already categorized.
              </p>
            </div>
          </div>
        </Card>
        <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
          Use a different account
        </Button>
      </Section>
    );
  }

  return (
    <Section
      title="Where should dues land?"
      detail="An account in the association's name. Not a board member's personal account, which most states prohibit."
    >
      <BankConnect kind="operating" onConnect={onConnect} />

      <Callout
        tone="brand"
        icon={<ShieldCheck className="size-4" />}
        title="Operating first, reserves later"
      >
        {associationName || "Your association"} needs one account to start collecting. Most states
        require reserves to sit in a second account, which you can add from Money once the first
        assessment has landed.
      </Callout>
    </Section>
  );
}
