"use client";

import { useState } from "react";
import { Plus, Vote, X } from "lucide-react";
import { Button, Card, CardHeader, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { closingDateProblem } from "@/lib/input-checks";
import { cn, addDays, formatDate, todayIsoDate } from "@/lib/utils";

/**
 * Asking the homes a question.
 *
 * Three things: what is being decided, the choices, and the day voting ends.
 * Notice periods, quorum, thresholds, the kind of vote and the meeting it
 * belongs to all used to be on this form, and a volunteer who only wanted to
 * ask about the pool fence gave up at "quorum". Those live in git history
 * behind the launch scope until a board with bylaws that demand them arrives.
 */
export function NewBallot({ onClose }: { onClose: () => void }) {
  const { community, addBallot, ballots } = useAppState();
  const { notify } = useToast();

  const homes = community.owners.length || community.association.unitCount;
  const today = todayIsoDate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState(["Yes", "No"]);
  const [closesOn, setClosesOn] = useState(addDays(today, 14));

  const field =
    fieldClass;
  const ready =
    title.trim().length > 2 &&
    choices.filter((c) => c.trim()).length >= 2 &&
    !closingDateProblem(closesOn, today);
  const dateProblem = closingDateProblem(closesOn, today);

  function open() {
    const seq = ballots.length + 1;
    addBallot({
      id: `bal-${today}-${seq}`,
      reference: `BAL-${today.slice(0, 4)}-${String(seq).padStart(3, "0")}`,
      title: title.trim(),
      body: body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      kind: "poll",
      audience: "owners",
      status: "open",
      opensDate: today,
      closesDate: closesOn,
      eligible: homes,
      quorumRequired: 0,
      thresholdLabel: "Most votes wins",
      liveResultsVisible: community.settings.showLiveVoteResults,
      options: choices
        .filter((c) => c.trim())
        .map((label, index) => ({
          id: `opt-${today}-${seq}-${index}`,
          label: label.trim(),
          votes: 0,
        })),
    });
    notify(`Ballot is open. Homes can vote until ${formatDate(closesOn, "long")}.`);
    onClose();
  }

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-5">
      <CardHeader
        icon={<Vote className="size-4" />}
        title="New ballot"
        subtitle="One vote per home"
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
            Cancel
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">The question</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Replace the pool fence this fall?"
            aria-label="Ballot title"
            autoFocus
            className={`mt-1.5 ${field}`}
          />
          {dateProblem ? (
            <span role="alert" className="mt-1 block text-footnote text-danger">
              {dateProblem}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">
            Anything homes should know first
            <span className="font-normal text-fg-subtle"> (optional)</span>
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="What it costs, why now, and what happens if it does not pass."
            aria-label="Ballot detail"
            className={cn(textareaClass, "mt-1.5")}
          />
        </label>

        <div>
          <span className="text-footnote font-semibold text-fg-muted">Choices</span>
          <div className="mt-1.5 space-y-2">
            {choices.map((choice, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={choice}
                  onChange={(e) =>
                    setChoices(choices.map((c, i) => (i === index ? e.target.value : c)))
                  }
                  aria-label={`Choice ${index + 1}`}
                  className={field}
                />
                {choices.length > 2 ? (
                  <button
                    type="button"
                    aria-label={`Remove choice ${index + 1}`}
                    onClick={() => setChoices(choices.filter((_, i) => i !== index))}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setChoices([...choices, ""])}
          >
            <Plus className="size-4" />
            Add a choice
          </Button>
        </div>

        <label className="block sm:max-w-xs">
          <span className="text-footnote font-semibold text-fg-muted">Voting ends</span>
          <input
            type="date"
            value={closesOn}
            min={addDays(today, 1)}
            onChange={(e) => setClosesOn(e.target.value)}
            aria-label="Voting ends"
            className={`mt-1.5 ${field}`}
          />
          {dateProblem ? (
            <span role="alert" className="mt-1 block text-footnote text-danger">
              {dateProblem}
            </span>
          ) : null}
        </label>

        <Button type="submit" size="lg" disabled={!ready} onClick={open}>
          Open the ballot
        </Button>
      </div>
    </Card>
  );
}
