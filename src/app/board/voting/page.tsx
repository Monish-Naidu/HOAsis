"use client";

import Link from "next/link";
import { ChevronRight, Radio, Vote } from "lucide-react";
import { useState } from "react";
import { BallotCard } from "@/components/app/ballot-card";
import { NewBallot } from "@/components/app/new-ballot";
import { Button, PageHeader, Stat } from "@/components/ui/primitives";

import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { BoardVote } from "@/components/app/board-vote";

/**
 * Ballots only. Meetings moved to their own page in the 2026-09-01 design;
 * the live-meeting strip below is the one thing that still points across,
 * because a director opening Voting during a call is probably looking for it.
 */
export default function BoardVoting() {
  const [creating, setCreating] = useState(false);
  const { community, ballots, castVote } = useAppState();
  const live = community.meetings.find((m) => m.status === "live");
  const { notify } = useToast();
  const open = ballots.filter((b) => b.status === "open");
  const scheduled = ballots.filter((b) => b.status === "scheduled");
  const decided = ballots.filter((b) => b.status === "certified" || b.status === "closed");
  const totalCast = open.reduce(
    (total, ballot) => total + ballot.options.reduce((sum, o) => sum + o.votes, 0),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Voting"

        action={
          // The form carries its own Cancel, so offering a second one up here
          // just puts two of them on screen saying the same thing.
          creating ? undefined : (
            <Button variant="primary" size="md" onClick={() => setCreating(true)}>
              New ballot
            </Button>
          )
        }
      />

      {creating ? <NewBallot onClose={() => setCreating(false)} /> : null}

      {live ? (
        <Link
          href="/board/meetings"
          className="mb-5 flex items-center gap-3 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 transition-opacity hover:opacity-90"
        >
          <Radio className="size-4 shrink-0 text-ok" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ok">{live.title}</span>
            <span className="block text-[13px] text-ok opacity-90">
              Live now · {live.attendees.length} joined · open the meeting
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ok" />
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open ballots" value={String(open.length)} icon={<Vote className="size-4" />} />
        <Stat label="Votes cast" value={String(totalCast)} tone="ok" hint="Across open ballots" />
        <Stat label="Scheduled" value={String(scheduled.length)} />
        <Stat label="Decided" value={String(decided.length)} />
      </div>

      <section className="mt-5">
        <h2 className="mb-3 text-[13px] font-semibold text-fg-muted">
          Open ballots
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {open.map((b) => (
            <div key={b.id} className="space-y-2">
              <BallotCard ballot={b} />
              {b.audience === "board" ? (
                <BoardVote
                  ballot={b}
                  onCast={(optionId) => {
                    castVote(b.id, optionId);
                    const option = b.options.find((o) => o.id === optionId);
                    notify(`Your vote was recorded: ${option?.label}`);
                  }}
                />
              ) : null}
            </div>
          ))}
          {open.length === 0 ? (
            <p className="text-[15px] text-fg-muted">
              Nothing is open for a vote. {scheduled.length > 0 ? "The next ballot below opens on schedule." : ""}
            </p>
          ) : null}
        </div>
      </section>

      {scheduled.length > 0 || decided.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-3 text-[13px] font-semibold text-fg-muted">
            Scheduled and decided
          </h2>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {scheduled.map((b) => (
              <BallotCard key={b.id} ballot={b} />
            ))}
            {decided.map((b) => (
              <BallotCard key={b.id} ballot={b} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
