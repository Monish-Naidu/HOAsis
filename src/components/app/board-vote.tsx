"use client";

import { Check } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import type { Ballot } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A director's own vote on a board resolution.
 *
 * Separate from the tally card because they answer different questions: the
 * card says where the room stands, this says what you personally did. Changing
 * your vote is allowed while the ballot is open, which is how a board actually
 * works when someone speaks up mid-discussion.
 */
export function BoardVote({
  ballot,
  onCast,
}: {
  ballot: Ballot;
  onCast: (optionId: string) => void;
}) {
  if (ballot.status !== "open") return null;

  return (
    <Card className="p-3">
      <p className="mb-2 text-[13px] font-semibold text-fg-muted">
        Your vote
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ballot.options.map((option) => {
          const mine = ballot.myVoteOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onCast(option.id)}
              aria-pressed={mine}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                mine
                  ? "border-navy-700 bg-navy-900 text-navy-50 dark:border-navy-300 dark:bg-navy-100 dark:text-navy-950"
                  : "border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {mine ? <Check className="size-3" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {ballot.myVoteOptionId ? (
        <p className="mt-2 text-[13px] text-fg-subtle">
          Recorded. You can change it until the ballot closes.
        </p>
      ) : null}
    </Card>
  );
}
