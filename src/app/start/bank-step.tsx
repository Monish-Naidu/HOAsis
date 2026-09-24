"use client";

import { Check, ShieldCheck } from "lucide-react";
import { Badge, Button, Callout, Card } from "@/components/ui/primitives";
import { BankConnect } from "@/components/app/bank-connect";
import type { BankAccount } from "@/lib/types";

/**
 * Connecting the account dues land in.
 *
 * The one thing an association genuinely cannot operate without, which is why
 * it is the last thing setup asks and the first thing the plan asks again if
 * it was skipped. The question's title lives with the other questions; this
 * is only the answer.
 */
export function BankStep({
  associationName,
  account,
  onConnect,
  onClear,
  linked,
}: {
  associationName: string;
  account?: BankAccount;
  onConnect: (account: BankAccount) => void;
  onClear: () => void;
  /** The mocked "find your bank" list, for a browser-only copy. */
  linked?: boolean;
}) {
  if (account) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
              <Check className="size-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[17px] font-semibold text-fg">{account.institution}</p>
                <Badge tone="ok">Operating</Badge>
              </div>
              <p className="mt-0.5 text-[15px] text-fg-muted">Account ending {account.mask}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-subtle">
                Assessments paid through Your HOAsis are deposited here and appear in your ledger
                already categorized.
              </p>
            </div>
          </div>
        </Card>
        <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
          Use a different account
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BankConnect kind="operating" onConnect={onConnect} linked={linked} />

      <Callout
        tone="info"
        icon={<ShieldCheck className="size-4" />}
        title="Operating first, reserves later"
      >
        {associationName || "Your association"} needs one account to start collecting. Most states
        require reserves to sit in a second account, which you can add from Money once the first
        assessment has landed.
      </Callout>
    </div>
  );
}
