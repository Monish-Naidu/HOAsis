"use client";

import { Lock, Vote } from "lucide-react";
import { useState } from "react";
import { BallotCard, resultLine } from "@/components/app/ballot-card";
import { NewBallot } from "@/components/app/new-ballot";
import { useToast } from "@/components/app/toast";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { ballotNeedsSealing, ballotPhase } from "@/lib/phases";
import { formatDate } from "@/lib/utils";

/**
 * Ask, count, close.
 *
 * Open ballots with their votes in, closed ballots with their result, and one
 * button. The four stat tiles, the live-meeting strip, board-only resolutions
 * and certification were all here and all went in the 2026-09-19 launch
 * scope; a board that has never run a vote online needs to see a question and
 * a number, not a governance console.
 *
 * A ballot that opens later is its own group, Scheduled. It sat under Open
 * wearing "Opens soon", which is the one place "open" was not true.
 */
export default function BoardVoting() {
  const [creating, setCreating] = useState(false);
  const { ballots, closeBallot, settings } = useAppState();
  const { notify } = useToast();
  // By phase, not stored status: a ballot past its closing date is closed
  // here the same day the resident's card says so, whether or not anybody
  // pressed Close now.
  const open = ballots
    .filter((b) => ballotPhase(b) === "open")
    .sort((a, b) => a.closesDate.localeCompare(b.closesDate));
  const scheduled = ballots
    .filter((b) => ballotPhase(b) === "scheduled")
    .sort((a, b) => a.opensDate.localeCompare(b.opensDate));
  const closed = ballots
    .filter((b) => ["closed", "certified"].includes(ballotPhase(b)))
    .sort((a, b) => b.closesDate.localeCompare(a.closesDate));

  return (
    <>
      <PageHeader
        title="Voting"
        description="Ballots for the community. One vote per home."
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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-footnote font-semibold text-fg-muted">Open</h2>
          {/* Said once for the group rather than on every card. */}
          {open.length > 0 && !settings.showLiveVoteResults ? (
            <p className="inline-flex items-center gap-1.5 text-footnote text-fg-subtle">
              <Lock className="size-3" />
              Results show when voting ends. To see them sooner, turn on live results in Settings.
            </p>
          ) : null}
        </div>
        {open.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Vote className="size-5" />}
              title="Nothing is open for a vote"
              description="Press New ballot to ask a question. It will show here while owners vote."
            />
          </Card>
        ) : (
          <div className="grid gap-4">
            {open.map((b) => (
              <div key={b.id} id={`ballot-${b.id}`} className="scroll-mt-32 lg:scroll-mt-24">
                <BallotCard
                  ballot={b}
                  sealedNote={false}
                  onClose={(ballot) => {
                    closeBallot(ballot.id);
                    notify(`Closed. ${resultLine(ballot)}.`);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {scheduled.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-footnote font-semibold text-fg-muted">Scheduled</h2>
          <div className="grid gap-4">
            {scheduled.map((b) => (
              <div key={b.id} id={`ballot-${b.id}`} className="scroll-mt-32 lg:scroll-mt-24">
                <BallotCard ballot={b} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {closed.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-footnote font-semibold text-fg-muted">Closed</h2>
          <Card>
            <div className="divide-y divide-border">
              {closed.map((b) => (
                <div
                  key={b.id}
                  id={`ballot-${b.id}`}
                  className="flex scroll-mt-32 lg:scroll-mt-24 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-body font-medium text-fg">{b.title}</p>
                    <p className="text-footnote text-fg-muted">{resultLine(b)}</p>
                  </div>
                  {ballotNeedsSealing(b) ? (
                    // Over by its date, with nobody having pressed Close now,
                    // so the record still says open. One press writes the
                    // close, the same as Close now would have.
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="tnum text-footnote text-fg-subtle">
                        Ended {formatDate(b.closesDate)}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          closeBallot(b.id);
                          notify(`Recorded. ${resultLine(b)}.`);
                        }}
                      >
                        Record the result
                      </Button>
                    </span>
                  ) : (
                    <span className="tnum text-footnote text-fg-subtle">
                      Ended {formatDate(b.closesDate)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </>
  );
}
