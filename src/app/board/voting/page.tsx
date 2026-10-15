"use client";

import { Lock, Vote } from "lucide-react";
import { useState } from "react";
import { BallotCard, resultLine } from "@/components/app/ballot-card";
import { NewBallot } from "@/components/app/new-ballot";
import { PaperVoteForm } from "@/components/app/paper-vote";
import { SeatingPanel } from "@/components/app/seating-panel";
import { useToast } from "@/components/app/toast";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { ValidationError } from "@/lib/core/errors";
import { ballotNeedsSealing, ballotPhase } from "@/lib/phases";
import type { Ballot } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { quorumLine } from "@/lib/voting";

/**
 * Ask, count, close.
 *
 * Open ballots with their votes in, closed ballots with their result, and
 * one button. While a vote runs, the board also enters what arrived on
 * paper, one home at a time. After an election closes, the winners are
 * seated from the result; after any owner vote closes, the result is
 * emailed to every home once.
 *
 * The four stat tiles, the live-meeting strip, board-only resolutions
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
                >
                  {b.audience === "owners" ? <PaperVoteForm ballot={b} /> : null}
                </BallotCard>
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
                <ClosedBallot key={b.id} ballot={b} />
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </>
  );
}

/**
 * One closed ballot: its result and quorum, and what is left to do with it.
 * Seating opens below the row, at the row's full width, because it lists
 * every winner with an office to pick.
 */
function ClosedBallot({ ballot: b }: { ballot: Ballot }) {
  const { closeBallot, can } = useAppState();
  const { notify } = useToast();
  const [seating, setSeating] = useState(false);
  const sealing = ballotNeedsSealing(b);
  const seats = b.kind === "election" && can("permissions");
  const quorum = quorumLine(b);

  return (
    <div id={`ballot-${b.id}`} className="scroll-mt-32 px-5 py-3.5 lg:scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-body font-medium text-fg">{b.title}</p>
          <p className="text-footnote text-fg-muted">{resultLine(b)}</p>
          {quorum ? <p className="text-footnote text-fg-subtle">{quorum}</p> : null}
        </div>
        <span className="flex flex-wrap items-center gap-3">
          <span className="tnum text-footnote text-fg-subtle">
            Ended {formatDate(b.closesDate)}
          </span>
          {sealing ? (
            // Over by its date, with nobody having pressed Close now, so the
            // record still says open. One press writes the close, the same as
            // Close now would have.
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
          ) : (
            <>
              {seats && !b.winnersSeatedDate && !seating ? (
                <Button variant="secondary" size="sm" onClick={() => setSeating(true)}>
                  Seat the winners
                </Button>
              ) : null}
              {b.audience === "owners" ? <EmailResults ballot={b} /> : null}
            </>
          )}
        </span>
      </div>
      {!sealing && (b.winnersSeatedDate || (seats && seating)) ? (
        <div className="mt-3 border-t border-border pt-3">
          <SeatingPanel ballot={b} onCancel={() => setSeating(false)} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The result of a closed owner vote, emailed to every home once. A second
 * press is told it already went; the date it went is the record of it.
 */
function EmailResults({ ballot }: { ballot: Ballot }) {
  const { emailResults } = useAppState();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ballot.resultsEmailedDate) {
    return (
      <span className="text-footnote text-fg-subtle">
        Results emailed {formatDate(ballot.resultsEmailedDate)}
      </span>
    );
  }

  async function send() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const words = await emailResults(ballot.id);
      if (words) notify(words);
    } catch (e) {
      const said = e instanceof ValidationError ? e.message : null;
      if (said === null) throw e;
      setError(said);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={send} disabled={saving}>
        {saving ? "Emailing the results" : "Email the results"}
      </Button>
      {error ? (
        <span role="alert" className="text-footnote text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
