"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Clock, Lock, ShieldCheck, Users } from "lucide-react";
import { Badge, Button, Card, Meter } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Ballot } from "@/lib/types";
import { cn, daysFromToday, formatDate, relativeDays } from "@/lib/utils";

const kindLabel = {
  election: "Election",
  budget: "Budget",
  amendment: "Amendment",
  "special-assessment": "Resolution",
  poll: "Poll",
} as const;

export function BallotVote({ ballot }: { ballot: Ballot }) {
  const { settings, castVote } = useAppState();
  // The stored ballot is the source of truth. Local state holds only the
  // selection before it is cast, so a vote survives a reload and reaches the
  // secretary's tally rather than living in this component.
  const submitted = Boolean(ballot.myVoteOptionId);
  const [pick, setPick] = useState<string | null>(null);
  const choice = ballot.myVoteOptionId ?? pick;
  const [expanded, setExpanded] = useState(false);

  const votes = ballot.options.reduce((t, o) => t + o.votes, 0);
  // Households that voted, not marks made. See the note in ballot-card.
  const cast = Math.round(votes / Math.max(1, ballot.seats ?? 1));
  const closed = ballot.status !== "open";
  // Tallies stay sealed until the ballot closes, unless the board opts in.
  const resultsUnlocked = closed || daysFromToday(ballot.closesDate) < 0 || settings.showLiveVoteResults;
  const showResults = resultsUnlocked && (submitted || closed);
  const receipt = ballot.myVoteReceipt;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-fg-subtle">
            {kindLabel[ballot.kind]}
          </span>
          {submitted ? (
            <Badge tone="ok">
              <CheckCircle2 className="size-2.5" />
              Voted
            </Badge>
          ) : (
            <Badge tone="warn">Needs your vote</Badge>
          )}
        </div>
        <h3 className="mt-1.5 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-fg">
          {ballot.title}
        </h3>

        {/* The description is paragraphs, not one unbroken block. */}
        <div className="mt-2 space-y-2">
          {(expanded ? ballot.body : ballot.body.slice(0, 1)).map((p) => (
            <p key={p} className="text-[13px] leading-relaxed text-fg-muted">
              {p}
            </p>
          ))}
        </div>
        {ballot.body.length > 1 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-accent"
          >
            {expanded ? "Show less" : "Read the full text"}
            <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
          </button>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {closed
              ? `Closed ${formatDate(ballot.closesDate, "long")}`
              : `Closes ${relativeDays(ballot.closesDate)}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {cast} of {ballot.eligible} cast
          </span>
        </div>
      </div>

      {/* Ballot */}
      {!closed ? (
        <div className="border-t border-border px-4 py-3">
          <div className="space-y-2">
            {ballot.options.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={submitted}
                onClick={() => setPick(o.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  choice === o.id
                    ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                    : "border-border hover:bg-surface-2",
                  submitted && "cursor-default opacity-90",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    choice === o.id ? "border-navy-700 dark:border-navy-200" : "border-border-2",
                  )}
                >
                  {choice === o.id ? (
                    <span className="size-1.5 rounded-full bg-navy-700 dark:bg-navy-200" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">{o.label}</span>
                  {o.detail ? (
                    <span className="block text-[11px] text-fg-muted">{o.detail}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>

          {submitted ? (
            <>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-ok-soft px-3 py-2">
                <ShieldCheck className="mt-px size-3.5 shrink-0 text-ok" />
                <p className="text-[11px] leading-snug text-ok">
                  Vote recorded. Receipt <span className="font-mono font-semibold">{receipt}</span>.
                  You can change it until the ballot closes.
                </p>
              </div>
              {!resultsUnlocked ? (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2">
                  <Lock className="mt-px size-3.5 shrink-0 text-fg-subtle" />
                  <p className="text-[11px] leading-snug text-fg-muted">
                    Results are sealed until the ballot closes on{" "}
                    {formatDate(ballot.closesDate, "long")}.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              className="mt-3 w-full"
              disabled={!choice}
              onClick={() => choice && castVote(ballot.id, choice)}
            >
              Cast my vote
            </Button>
          )}
        </div>
      ) : null}

      {/* Results */}
      {showResults && cast > 0 ? (
        <div className="space-y-2.5 border-t border-border bg-surface-2 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            {closed ? "Final result" : "Where it stands"}
          </p>
          {ballot.options.map((o) => {
            const votes = o.votes;
            const share = cast ? votes / cast : 0;
            const mine = o.id === choice;
            return (
              <div key={o.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[12px] text-fg">
                    {o.label}
                    {mine ? " · your vote" : ""}
                  </span>
                  <span className="tnum shrink-0 text-[11px] text-fg-muted">
                    {votes} · {Math.round(share * 100)}%
                  </span>
                </div>
                <Meter value={share} tone={mine ? "ok" : "neutral"} aria-label={o.label} />
              </div>
            );
          })}
        </div>
      ) : null}

      {ballot.certifiedDate ? (
        <p className="border-t border-border px-4 py-2.5 text-[11px] text-fg-muted">
          Certified {formatDate(ballot.certifiedDate, "long")} by {ballot.certifiedBy}
        </p>
      ) : null}
    </Card>
  );
}
