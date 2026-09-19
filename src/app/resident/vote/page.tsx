"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { Vote } from "lucide-react";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
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
  const open = mine
    .filter((b) => b.status === "open")
    .sort((a, b) => a.closesDate.localeCompare(b.closesDate));
  const past = mine
    .filter((b) => b.status === "certified" || b.status === "closed")
    .sort((a, b) => b.closesDate.localeCompare(a.closesDate));

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Vote" />

      {open.length ? (
        <section className="space-y-3">
          {open.map((b) => (
            <BallotVote key={b.id} ballot={b} />
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<Vote className="size-5" />}
          title="Nothing to vote on right now"
          description="Open ballots appear here."
        />
      )}

      {past.length ? (
        <section>
          <SectionTitle>Closed</SectionTitle>
          <div className="space-y-3">
            {past.map((b) => (
              <BallotVote key={b.id} ballot={b} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
