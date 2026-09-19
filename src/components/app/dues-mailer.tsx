"use client";

import { useState } from "react";
import { AlertTriangle, Mail, Send, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { EmailDelivery } from "@/components/app/email-delivery";
import { delinquency } from "@/lib/metrics";
import { cn, money, pluralize } from "@/lib/utils";

/**
 * Sending a dues run.
 *
 * Two buttons rather than a composer, because a board does not want to write
 * a dues notice, they want it to have gone out. The message is fixed, the
 * amounts are filled in per household, and the only decision is who it goes
 * to and whether to look at it first.
 *
 * Preview is a real pass over the real recipient list that sends nothing, so
 * "who would get this" is answered by the same code that will do the sending
 * rather than by a count computed a second way on this screen.
 */

type Category = "assessment" | "delinquency";

interface Outcome {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
  dryRun: boolean;
}

export function DuesMailer() {
  const { community, isRemote } = useAppState();
  const { notify } = useToast();
  // Which run is in flight, and whether it is the dry pass. A preview used
  // to light the Send button up as "Sending", which read as an email going.
  const [busy, setBusy] = useState<{ category: Category; dryRun: boolean } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const delinq = delinquency(community);
  const withEmail = community.owners.filter((o) => o.email.trim().length > 0).length;
  const unreachable = community.owners.length - withEmail;

  async function run(category: Category, dryRun: boolean) {
    setBusy({ category, dryRun });
    setOutcome(null);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          associationId: community.id,
          category,
          dueDate: community.nextChargeDate,
          dryRun,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        notify(body.error ?? "Could not send", "warn");
        return;
      }
      setOutcome({ ...body, dryRun });
      if (!dryRun) {
        notify(`${pluralize(body.sent, "email")} sent`, "ok");
      }
    } catch {
      notify("Could not reach the mail service", "warn");
    } finally {
      setBusy(null);
    }
  }

  // Sending is a server capability, and a demo association has no server.
  if (!isRemote) {
    return (
      <Card className="mt-5">
        <p className="flex items-center gap-2 px-5 py-3 text-[13px] text-fg-muted">
          <Mail className="size-3.5 shrink-0 text-fg-subtle" />
          Dues email sends from a real association. The demo has nothing to send from.
        </p>
      </Card>
    );
  }

  return (
    <>
    <Card className="mt-5">
      <CardHeader
        title="Dues email"
        subtitle="Notices about money reach every owner. They carry no unsubscribe link, because a board is required to send them."
        icon={<Mail className="size-4" />}
      />

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <Run
          title="Assessment coming due"
          detail={`Everyone. ${money(community.association.duesCents)} due ${community.nextChargeDate}.`}
          count={withEmail}
          countLabel="households"
          busy={busy?.category === "assessment" ? (busy.dryRun ? "preview" : "send") : null}
          disabled={Boolean(busy) || withEmail === 0}
          onPreview={() => run("assessment", true)}
          onSend={() => run("assessment", false)}
        />
        <Run
          title="Past due reminder"
          detail={
            delinq.past.length
              ? `Only homes that owe. ${money(delinq.totalCents)} outstanding.`
              : "Nobody owes anything, so this would reach no one."
          }
          count={delinq.past.length}
          countLabel="behind"
          tone="warn"
          busy={busy?.category === "delinquency" ? (busy.dryRun ? "preview" : "send") : null}
          disabled={Boolean(busy) || delinq.past.length === 0}
          onPreview={() => run("delinquency", true)}
          onSend={() => run("delinquency", false)}
        />
      </div>

      {unreachable > 0 ? (
        <p className="flex items-start gap-2 border-t border-border px-5 py-3 text-[13px] leading-snug text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {pluralize(unreachable, "household")} without an email address will not receive
          anything. Add one on the Homeowners tab.
        </p>
      ) : null}

      {outcome ? (
        <div className="border-t border-border px-5 py-3">
          <p className="text-[15px] font-medium text-fg">
            {outcome.dryRun
              ? `${pluralize(outcome.sent, "household")} would receive this`
              : `${pluralize(outcome.sent, "email")} sent`}
            {outcome.skipped > 0 ? `, ${outcome.skipped} skipped` : ""}
            {outcome.failed > 0 ? `, ${outcome.failed} failed` : ""}
          </p>
          {outcome.errors.length ? (
            <ul className="mt-1.5 space-y-0.5">
              {outcome.errors.slice(0, 4).map((error) => (
                <li key={error} className="text-[13px] text-danger">
                  {error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
      <EmailDelivery />
    </>
  );
}

function Run({
  title,
  detail,
  count,
  countLabel,
  tone = "neutral",
  busy,
  disabled,
  onPreview,
  onSend,
}: {
  title: string;
  detail: string;
  count: number;
  countLabel: string;
  tone?: "neutral" | "warn";
  busy: "preview" | "send" | null;
  disabled: boolean;
  onPreview: () => void;
  onSend: () => void;
}) {
  return (
    <div className="rounded-card border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold text-fg">{title}</p>
        <Badge tone={tone === "warn" ? "warn" : "neutral"}>
          <Users className="size-2.5" />
          {count} {countLabel}
        </Badge>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{detail}</p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPreview}
          disabled={disabled}
          className={cn(busy === "preview" && "opacity-70")}
        >
          {busy === "preview" ? "Checking" : "Preview"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSend}
          disabled={disabled}
          className={cn(busy === "send" && "opacity-70")}
        >
          <Send className="size-3.5" />
          {busy === "send" ? "Sending" : "Send"}
        </Button>
      </div>
    </div>
  );
}
