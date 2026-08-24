"use client";

import { CheckCircle2, Clock, Lock, Users } from "lucide-react";
import { Badge, Card, Meter } from "@/components/ui/primitives";

import { useAppState } from "@/lib/app-state";
import type { Ballot } from "@/lib/types";
import { daysFromToday, formatDate, relativeDays } from "@/lib/utils";

/**
 * Turnout and standing for one ballot, derived from the ballot itself rather
 * than looked up in a frozen fixture, so a vote cast on this page is reflected
 * immediately.
 */
function tally(ballot: Ballot) {
  const votes = ballot.options.reduce((total, option) => total + option.votes, 0);
  // Quorum is a count of households that voted, not of marks they made, so a
  // multi seat election has to be divided back down before it is compared.
  const cast = Math.round(votes / Math.max(1, ballot.seats ?? 1));
  const leading = [...ballot.options].sort((a, b) => b.votes - a.votes)[0];
  return {
    votes,
    cast,
    leading,
    quorumMet: cast >= ballot.quorumRequired,
    quorumProgress: ballot.quorumRequired ? Math.min(1, cast / ballot.quorumRequired) : 1,
    share: (optionVotes: number) => (votes ? optionVotes / votes : 0),
    shareOfEligible: (optionVotes: number) => (ballot.eligible ? optionVotes / ballot.eligible : 0),
    daysLeft: daysFromToday(ballot.closesDate),
  };
}

const statusTone = {
  open: "ok",
  scheduled: "neutral",
  closed: "warn",
  certified: "brand",
} as const;

const kindLabel = {
  election: "Election",
  budget: "Budget",
  amendment: "Amendment",
  "special-assessment": "Resolution",
  poll: "Poll",
} as const;

/**
 * Results at a glance. The tally, quorum, and threshold all read from one
 * place, so nobody has to open each ballot to find out where a vote stands.
 */
export function BallotCard({ ballot }: { ballot: Ballot }) {
  const { settings } = useAppState();
  const t = tally(ballot);
  // Sealed until close, unless the board turned live results on.
  const showResults =
    ballot.status === "certified" ||
    ballot.status === "closed" ||
    settings.showLiveVoteResults ||
    t.daysLeft < 0;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[ballot.status]}>{ballot.status}</Badge>
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-fg-subtle">
            {kindLabel[ballot.kind]} · {ballot.audience === "board" ? "Board vote" : "Owner vote"}
          </span>
          <span className="text-[11px] text-fg-subtle">{ballot.reference}</span>
        </div>
        <h3 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-fg">
          {ballot.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
          {ballot.body[0]}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {ballot.status === "scheduled"
              ? `Opens ${formatDate(ballot.opensDate, "long")}`
              : ballot.status === "open"
                ? `Closes ${relativeDays(ballot.closesDate)}`
                : `Closed ${formatDate(ballot.closesDate, "long")}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {t.cast} of {ballot.eligible} cast
            {ballot.proxiesHeld ? ` · ${ballot.proxiesHeld} by proxy` : ""}
          </span>
          <span>{ballot.thresholdLabel}</span>
        </div>
      </div>

      {!showResults && ballot.status === "open" ? (
        <div className="flex items-start gap-2 border-t border-border px-5 py-3">
          <Lock className="mt-px size-3.5 shrink-0 text-fg-subtle" />
          <p className="text-[12px] leading-snug text-fg-muted">
            Results are sealed until this closes on {formatDate(ballot.closesDate, "long")}.
            Turnout and quorum stay visible.
          </p>
        </div>
      ) : null}

      {showResults && t.cast > 0 ? (
        <div className="space-y-2.5 border-t border-border px-5 py-4">
          {ballot.options.map((o) => {
            const share = t.share(o.votes);
            const winning = o.id === t.leading.id && ballot.status !== "scheduled";
            return (
              <div key={o.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-fg">
                    <span className="truncate">{o.label}</span>
                    {o.detail ? (
                      <span className="shrink-0 text-[11px] text-fg-subtle">{o.detail}</span>
                    ) : null}
                    {winning && ballot.status === "certified" ? (
                      <CheckCircle2 className="size-3 shrink-0 text-ok" />
                    ) : null}
                  </span>
                  <span className="tnum shrink-0 text-[12px] font-medium text-fg-muted">
                    {o.votes} · {Math.round(share * 100)}%
                  </span>
                </div>
                <Meter
                  value={share}
                  tone={winning ? "ok" : "neutral"}
                  aria-label={`${o.label}: ${o.votes} votes`}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {ballot.quorumRequired > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Quorum
            </span>
            <span className="tnum text-[12px] font-medium text-fg-muted">
              {t.cast} of {ballot.quorumRequired} needed
            </span>
          </div>
          <Meter
            value={t.quorumProgress}
            tone={t.quorumMet ? "ok" : "warn"}
            aria-label={`Quorum ${Math.round(t.quorumProgress * 100)} percent`}
          />
          {ballot.kind === "amendment" ? (
            <p className="mt-2 text-[11px] leading-snug text-fg-muted">
              {Math.round(t.shareOfEligible(ballot.options[0].votes) * 100)}% of all{" "}
              {ballot.eligible} interests. A unit that does not vote counts against it.
            </p>
          ) : null}
        </div>
      ) : null}

      {ballot.certifiedDate ? (
        <div className="border-t border-border bg-surface-2 px-5 py-2.5 text-[11px] text-fg-muted">
          Certified {formatDate(ballot.certifiedDate, "long")} by {ballot.certifiedBy}
        </div>
      ) : null}
    </Card>
  );
}
