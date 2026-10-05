"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { Vote } from "lucide-react";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { ballotPhase } from "@/lib/phases";
import { BallotVote } from "./ballot-vote";

/**
 * One card per open question, one tap to answer it.
 *
 * The live meeting room, the RSVP list and the voting record used to share
 * this page. Meetings have their own tab now, and what is closed sits below
 * in one line each.
 */
export default function ResidentVote() {
  const { community } = useAppState();
  const mine = community.ballots.filter((b) => b.audience === "owners");
  // By phase: a ballot past its closing date sits under Closed, where its
  // card already says Closed, not in the list of things to vote on.
  const open = mine
    .filter((b) => ballotPhase(b) === "open")
    .sort((a, b) => a.closesDate.localeCompare(b.closesDate));
  const past = mine
    .filter((b) => ["closed", "certified"].includes(ballotPhase(b)))
    .sort((a, b) => b.closesDate.localeCompare(a.closesDate));

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Voting" subtitle="Open ballots and past results" />

      {open.length ? (
        <section className="space-y-3">
          {open.map((b) => (
            <div key={b.id} id={`ballot-${b.id}`} className="scroll-mt-24">
              <BallotVote ballot={b} />
            </div>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<Vote className="size-5" />}
          title="Nothing to vote on right now"
          description="When the board opens a ballot, it appears here."
        />
      )}

      {past.length ? (
        <section>
          <SectionTitle>Closed</SectionTitle>
          <div className="space-y-3">
            {past.map((b) => (
              <div key={b.id} id={`ballot-${b.id}`} className="scroll-mt-24">
                <BallotVote ballot={b} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
