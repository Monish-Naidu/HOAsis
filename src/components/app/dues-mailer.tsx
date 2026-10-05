"use client";

import { useState } from "react";
import { AlertTriangle, Mail, Send, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { EmailDelivery } from "@/components/app/email-delivery";
import { delinquency } from "@/lib/metrics";
import { cn, money, pluralize } from "@/lib/utils";
import { duesVary } from "@/lib/home-types";

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
  /**
   * Passed over because the same notice reached them in the last hour. Its
   * own count, apart from `skipped`. Absent from an older answer.
   */
  already?: number;
  errors: string[];
  dryRun: boolean;
}

/** "12 already sent in the last hour", or nothing when nobody was. */
function alreadyPhrase(already: number | undefined): string {
  return already && already > 0 ? `${already} already sent in the last hour` : "";
}

/**
 * The line under the buttons after a preview or a run.
 *
 * A preview inside an hour of a real run passes over everybody that run
 * reached, and it used to read "0 households would receive this" with no
 * reason given, as if the list were empty. The count of people who already
 * have the notice is said in words beside it.
 */
export function outcomeLine(outcome: Outcome): string {
  const head = outcome.dryRun
    ? `${pluralize(outcome.sent, "household")} would receive this`
    : `${pluralize(outcome.sent, "email")} sent`;
  return [
    head,
    alreadyPhrase(outcome.already),
    outcome.skipped > 0 ? `${outcome.skipped} skipped` : "",
    outcome.failed > 0 ? `${outcome.failed} failed` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * What the toast says after a real run. A run where every send failed is
 * not a success, one with nobody to write to is not a failure, and one that
 * found everybody already written to says so instead of "Nobody to send to".
 */
export function sendToast(body: {
  sent?: number;
  failed?: number;
  already?: number;
}): { message: string; tone: "ok" | "warn" | "info" } {
  const sent = Number(body.sent ?? 0);
  const failed = Number(body.failed ?? 0);
  const already = alreadyPhrase(Number(body.already ?? 0));
  const also = already ? `, ${already}` : "";
  if (sent > 0 && failed === 0) return { message: `${pluralize(sent, "email")} sent${also}`, tone: "ok" };
  if (sent > 0) {
    return { message: `${pluralize(sent, "email")} sent, ${failed} could not be sent${also}`, tone: "warn" };
  }
  if (failed > 0) {
    return { message: `No emails went out. ${pluralize(failed, "send")} failed.`, tone: "warn" };
  }
  if (already) return { message: `Nothing new to send. ${already}.`, tone: "info" };
  return { message: "Nobody to send to", tone: "info" };
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
        // Say what happened, in the words `sendToast` picks.
        const toast = sendToast(body);
        notify(toast.message, toast.tone);
      }
    } catch {
      notify("Could not reach the mail service", "warn");
    } finally {
      setBusy(null);
    }
  }

  // Sending is a server capability, and a demo association has no server.
  // One quiet line, not a card: a card that exists to say it does nothing
  // was the loudest thing on the page.
  if (!isRemote) {
    return (
      <p className="mt-4 flex items-center gap-2 text-footnote text-fg-subtle">
        <Mail className="size-3.5 shrink-0" />
        The dues email is off in the demo.
      </p>
    );
  }

  return (
    <>
    <Card className="mt-5">
      <CardHeader
        title="Dues email"
        subtitle="Sent to every owner. Required notices have no unsubscribe link."
        icon={<Mail className="size-4" />}
      />

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <Run
          title="Assessment coming due"
          detail={
            duesVary(community.association, community.owners)
              ? `Everyone, each at their own amount. Due ${community.nextChargeDate}.`
              : `Everyone. ${money(community.association.duesCents)} due ${community.nextChargeDate}.`
          }
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
        <p className="flex items-start gap-2 border-t border-border px-5 py-3 text-footnote leading-snug text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {pluralize(unreachable, "household")} without an email address will not receive
          anything. Add one on the Homeowners tab.
        </p>
      ) : null}

      {outcome ? (
        <div className="border-t border-border px-5 py-3">
          <p className="text-body font-medium text-fg">{outcomeLine(outcome)}</p>
          {outcome.errors.length ? (
            <ul className="mt-1.5 space-y-0.5">
              {outcome.errors.slice(0, 4).map((error) => (
                <li key={error} className="text-footnote text-danger">
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
        <p className="text-body font-semibold text-fg">{title}</p>
        <Badge tone={tone === "warn" ? "warn" : "neutral"}>
          <Users className="size-2.5" />
          {count} {countLabel}
        </Badge>
      </div>
      <p className="mt-1 text-footnote leading-relaxed text-fg-muted">{detail}</p>
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
        {/* Secondary: the page's one filled button is New announcement. */}
        <Button
          variant="secondary"
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
