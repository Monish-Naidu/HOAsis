"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Send, ShieldCheck } from "lucide-react";
import { Button, Callout, Card, EmptyState, fieldClass, textareaClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";

const input =
  fieldClass;

/**
 * Telling the board about something you have seen.
 *
 * The hard part of this screen is what it promises, and the promises have to
 * be exactly true. Your name goes to the board and to nobody else. What you
 * write is not a notice and does not become one on its own: somebody from the
 * board has to go and look first, and what they see is what any notice rests
 * on. Both of those are enforced in `src/lib/violations.ts` rather than only
 * described here.
 *
 * It is deliberately not anonymous. No state researched bans an anonymous
 * complaint to an association, but a board that cannot tell one neighbour's
 * twelve reports from twelve neighbours' one is a board that cannot see the
 * pattern that matters. The honest trade is that we know who you are and the
 * household you are reporting never does.
 */
export function ReportForm() {
  const { community, addViolationReport } = useAppState();
  const owner = useCurrentOwner();
  const { notify } = useToast();

  const [unit, setUnit] = useState("");
  const [what, setWhat] = useState("");
  const [observedOn, setObservedOn] = useState(community.asOf);
  const [sent, setSent] = useState<string | null>(null);

  const mine = owner?.unit ?? "";
  const known = community.owners.some((o) => o.unit === unit.trim());
  const isMine = unit.trim() !== "" && unit.trim() === mine;
  const ready = unit.trim() && what.trim().length > 10 && !isMine;

  function submit() {
    if (!ready || !owner) return;
    const subject = community.owners.find((o) => o.unit === unit.trim());
    const report = addViolationReport({
      reporterId: owner.id,
      reporterName: owner.displayName,
      reporterUnit: owner.unit,
      subjectUnit: unit.trim(),
      subjectOwnerId: subject?.id,
      what,
      observedOn,
    });
    setSent(report.reference);
    notify("Sent to the board. Your name is not shared with the home you reported.");
  }

  if (!owner) {
    return (
      <Card>
        <EmptyState
          title="Sign in to report something"
          description="Sign in to send a report to the board."
        />
      </Card>
    );
  }

  if (sent) {
    return (
      <div className="animate-rise space-y-5">
        <Card className="px-5 py-8 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <Check className="size-6" strokeWidth={2.5} />
          </span>
          <p className="text-title3 font-semibold tracking-[-0.02em] text-fg">
            Sent to the board
          </p>
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
            Reference {sent}. Someone from the board will go and look before anything else
            happens.
          </p>
          <p className="mt-3 text-footnote leading-relaxed text-fg-subtle">
            The board will not share the outcome with you. That keeps things fair between
            neighbors.
          </p>
          <Link
            href="/resident"
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand px-5 text-body font-semibold text-brand-fg transition-opacity hover:opacity-90"
          >
            Done
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-5">
      <div>
        <Link
          href="/resident"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          Home
        </Link>
        <h1 className="mt-2 text-title2 font-semibold tracking-[-0.025em] text-fg">
          Tell the board about something
        </h1>
        <p className="mt-1 text-body leading-relaxed text-fg-muted">
          Something you have seen that the rules may cover. This goes to the board privately.
        </p>
      </div>

      {/* Said before they type, not after. Somebody deciding whether to report
          their neighbour is deciding on these two facts. */}
      <Callout tone="info" icon={<ShieldCheck className="size-4" />} title="What happens to this">
        Your name goes to the board and to nobody else. The household you name is never told
        who reported them. And this is not a notice: a board member has to go and see it for
        themselves before anything is sent to anyone.
      </Callout>

      <Card as="form" onSubmit={(e) => e.preventDefault()} className="space-y-4 px-4 py-4">
        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">Which home</span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit or lot number"
            aria-label="Which home"
            className={`${input} mt-1.5`}
          />
          {isMine ? (
            <span className="mt-1 block text-footnote text-warn">
              That is your own home. If something needs fixing there, open a request instead.
            </span>
          ) : unit.trim() && !known ? (
            <span className="mt-1 block text-footnote text-fg-subtle">
              No home with that number is on the board&apos;s list. The board will still see it.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">What you saw</span>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            rows={4}
            placeholder="What it was, and roughly when. Plain words are fine."
            aria-label="What you saw"
            className={cn(textareaClass, "mt-1.5")}
          />
          <span className="mt-1 block text-footnote leading-relaxed text-fg-subtle">
            Describe what you saw rather than who you think is at fault. The board decides
            whether a rule was broken, and it decides that by going and looking.
          </span>
        </label>

        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">When you saw it</span>
          <input
            type="date"
            value={observedOn}
            onChange={(e) => setObservedOn(e.target.value)}
            aria-label="When you saw it"
            className={`${input} mt-1.5 sm:w-52`}
          />
        </label>

        <Button type="submit" onClick={submit} disabled={!ready}>
          <Send className="size-4" />
          Send to the board
        </Button>
      </Card>

      <p className="text-footnote leading-relaxed text-fg-subtle">
        Reports are kept with your name against them so the board can see if the same two
        homes keep coming up. That pattern is worth a board knowing about, and it is the only
        reason your name is stored at all.
      </p>
    </div>
  );
}
