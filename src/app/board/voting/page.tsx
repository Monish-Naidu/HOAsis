"use client";

import { Vote } from "lucide-react";
import { useState } from "react";
import { BallotCard, resultLine } from "@/components/app/ballot-card";
import { NewBallot } from "@/components/app/new-ballot";
import { useToast } from "@/components/app/toast";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";

/**
 * Ask, count, close.
 *
 * Open ballots with their votes in, closed ballots with their result, and one
 * button. The four stat tiles, the live-meeting strip, board-only resolutions,
 * scheduled ballots and certification were all here and all went in the
 * 2026-09-19 launch scope; a board that has never run a vote online needs to
 * see a question and a number, not a governance console.
 */
export default function BoardVoting() {
  const [creating, setCreating] = useState(false);
  const { ballots, closeBallot } = useAppState();
  const { notify } = useToast();
  // Scheduled ballots from older fixtures count as open here: they are
  // questions the board asked and nothing on this page schedules one.
  const open = ballots
    .filter((b) => b.status === "open" || b.status === "scheduled")
    .sort((a, b) => a.closesDate.localeCompare(b.closesDate));
  const closed = ballots
    .filter((b) => b.status === "closed" || b.status === "certified")
    .sort((a, b) => b.closesDate.localeCompare(a.closesDate));

  return (
    <>
      <PageHeader
        title="Voting"
        description="Ask the homes a question. One vote per home, and the result is there when it ends."
        action={
          creating ? undefined : (
            <Button variant="primary" size="md" onClick={() => setCreating(true)}>
              New ballot
            </Button>
          )
        }
      />

      {creating ? <NewBallot onClose={() => setCreating(false)} /> : null}

      <section>
        <h2 className="mb-3 text-[13px] font-semibold text-fg-muted">Open</h2>
        {open.length === 0 ? (
          <EmptyState
            icon={<Vote className="size-5" />}
            title="Nothing is open for a vote"
            description="A new ballot is a question, the choices, and the day voting ends."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {open.map((b) => (
              <BallotCard
                key={b.id}
                ballot={b}
                onClose={(ballot) => {
                  closeBallot(ballot.id);
                  notify(`Closed. ${resultLine(ballot)}.`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-[13px] font-semibold text-fg-muted">Closed</h2>
          <Card>
            <div className="divide-y divide-border">
              {closed.map((b) => (
                <div key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-fg">{b.title}</p>
                    <p className="text-[13px] text-fg-muted">{resultLine(b)}</p>
                  </div>
                  <span className="tnum text-[13px] text-fg-subtle">
                    Ended {formatDate(b.closesDate)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </>
  );
}
