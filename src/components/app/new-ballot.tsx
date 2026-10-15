"use client";

import { useState } from "react";
import { Plus, Vote, X } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Select,
  Segmented,
  Toggle,
  fieldClass,
  textareaClass,
} from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { closingDateProblem } from "@/lib/input-checks";
import { cn, addDays, formatDate, todayIsoDate } from "@/lib/utils";
import { quorumFromInput, type QuorumUnit } from "@/lib/voting";

/**
 * Asking the homes a question.
 *
 * The question, the choices, and the day voting ends. Three more things a
 * real bylaw brings: whether this is an election, in which case each
 * candidate is linked to their home so a winner can be seated from the
 * result; a quorum, typed as homes or as a percent and stored as homes;
 * and a rule that dues must be current to vote. All three are optional,
 * because a poll of the neighbourhood needs none of them.
 */
export function NewBallot({ onClose }: { onClose: () => void }) {
  const { community, addBallot, ballots } = useAppState();
  const { notify } = useToast();

  const register = community.homes;
  const homes = register.length || community.association.unitCount;
  const today = todayIsoDate();
  const [kind, setKind] = useState<"question" | "election">("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState(["Yes", "No"]);
  const [candidateHomes, setCandidateHomes] = useState<string[]>(["", ""]);
  const [seats, setSeats] = useState("2");
  const [closesOn, setClosesOn] = useState(addDays(today, 14));
  const [quorumText, setQuorumText] = useState("");
  const [quorumUnit, setQuorumUnit] = useState<QuorumUnit>("homes");
  const [duesCurrent, setDuesCurrent] = useState(false);

  const field = fieldClass;
  const election = kind === "election";
  const word = election ? "candidate" : "choice";
  const dateProblem = closingDateProblem(closesOn, today);
  const quorum = quorumFromInput(quorumText, quorumUnit, homes);
  const seatCount = election ? Number.parseInt(seats, 10) : 1;
  const seatProblem =
    election && (!/^\d+$/.test(seats) || seatCount < 1)
      ? "Seats to fill is a whole number, at least 1."
      : null;
  const filled = choices.filter((c) => c.trim()).length;
  const ready =
    title.trim().length > 2 && filled >= 2 && !dateProblem && !quorum.problem && !seatProblem;
  // The first thing still missing, said beside the button that waits on it.
  // The closing date has its own message under the field.
  const missing =
    title.trim().length <= 2
      ? "Give the ballot a title."
      : filled < 2
        ? `Add at least two ${word}s.`
        : null;

  function open() {
    const seq = ballots.length + 1;
    addBallot({
      id: `bal-${today}-${seq}`,
      reference: `BAL-${today.slice(0, 4)}-${String(seq).padStart(3, "0")}`,
      title: title.trim(),
      body: body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
      kind: election ? "election" : "poll",
      audience: "owners",
      status: "open",
      opensDate: today,
      closesDate: closesOn,
      eligible: homes,
      seats: election ? seatCount : undefined,
      quorumRequired: quorum.count ?? 0,
      thresholdLabel: election ? "The highest vote counts fill the seats" : "Most votes wins",
      duesCurrentRequired: duesCurrent,
      liveResultsVisible: community.settings.showLiveVoteResults,
      options: choices
        .filter((c) => c.trim())
        .map((label, index) => ({
          id: `opt-${today}-${seq}-${index}`,
          label: label.trim(),
          votes: 0,
          // A candidate's own home, so seating the winner is one press
          // rather than a hunt through the register.
          homeId: election && candidateHomes[index] ? candidateHomes[index] : undefined,
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
        <div>
          <span className="text-footnote font-semibold text-fg-muted">What is this</span>
          <Segmented
            className="mt-1.5"
            label="What is this"
            value={kind}
            fill
            onChange={setKind}
            options={[
              { value: "question", label: "A question" },
              { value: "election", label: "An election" },
            ]}
          />
        </div>

        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">The question</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              election ? "Election of two directors" : "Replace the pool fence this fall?"
            }
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

        {election ? (
          <Field label="Seats to fill" className="max-w-32">
            <input
              type="number"
              min={1}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className={field}
            />
          </Field>
        ) : null}

        <div>
          <span className="text-footnote font-semibold text-fg-muted">
            {election ? "Candidates" : "Choices"}
          </span>
          <div className="mt-1.5 space-y-2">
            {choices.map((choice, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={choice}
                  onChange={(e) =>
                    setChoices(choices.map((c, i) => (i === index ? e.target.value : c)))
                  }
                  aria-label={`Choice ${index + 1}`}
                  placeholder={election ? "Their name" : "Yes"}
                  className={field}
                />
                {election ? (
                  <Select
                    size="md"
                    aria-label={`Candidate ${index + 1} home`}
                    className="w-40"
                    value={candidateHomes[index] ?? ""}
                    onChange={(e) =>
                      setCandidateHomes(
                        candidateHomes.map((h, i) => (i === index ? e.target.value : h)),
                      )
                    }
                  >
                    <option value="">Their home</option>
                    {register.map((home) => (
                      <option key={home.id} value={home.id}>
                        {home.unit} · {home.displayName}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {choices.length > 2 ? (
                  <button
                    type="button"
                    aria-label={`Remove ${word} ${index + 1}`}
                    onClick={() => {
                      setChoices(choices.filter((_, i) => i !== index));
                      setCandidateHomes(candidateHomes.filter((_, i) => i !== index));
                    }}
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
            onClick={() => {
              setChoices([...choices, ""]);
              setCandidateHomes([...candidateHomes, ""]);
            }}
          >
            <Plus className="size-4" />
            Add {election ? "a candidate" : "a choice"}
          </Button>
        </div>

        {/* Folded away, because a volunteer asking about the pool fence
            should not meet the word quorum before the ballot opens. */}
        <details className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-footnote font-semibold text-fg-muted">
            Rules from your bylaws
            <span className="font-normal text-fg-subtle"> (optional)</span>
          </summary>
          <div className="mt-3 space-y-4">
            <div className="sm:max-w-xs">
              <span className="text-footnote font-semibold text-fg-muted">
                Quorum
                <span className="font-normal text-fg-subtle"> (optional)</span>
              </span>
              <div className="mt-1.5 flex gap-2">
                <Segmented
                  label="Quorum counted in"
                  value={quorumUnit}
                  onChange={setQuorumUnit}
                  options={[
                    { value: "homes", label: "Homes" },
                    { value: "percent", label: "Percent" },
                  ]}
                />
                <input
                  inputMode={quorumUnit === "percent" ? "decimal" : "numeric"}
                  value={quorumText}
                  onChange={(e) => setQuorumText(e.target.value)}
                  aria-label="Quorum"
                  placeholder={quorumUnit === "percent" ? "20" : "27"}
                  aria-describedby={quorum.problem ? "quorum-problem" : undefined}
                  aria-invalid={quorum.problem ? true : undefined}
                  className={cn(field, "w-24 shrink-0")}
                />
              </div>
              {quorum.problem ? (
                <p id="quorum-problem" role="alert" className="mt-1 text-footnote text-danger">
                  {quorum.problem}
                </p>
              ) : (
                <p className="mt-1 text-footnote text-fg-muted">
                  {quorumUnit === "percent"
                    ? `Of the ${homes} homes on the register, rounded up.`
                    : "Homes that must vote for the result to count."}
                </p>
              )}
            </div>

            <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
              <div>
                <p className="text-body font-medium text-fg">Dues must be current</p>
                <p className="text-footnote text-fg-muted">
                  Homes behind on their dues cannot vote, online or on paper.
                </p>
              </div>
              <Toggle
                checked={duesCurrent}
                onChange={setDuesCurrent}
                label="Dues must be current"
              />
            </div>
          </div>
        </details>

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

        {seatProblem ? (
          <p role="alert" className="text-footnote text-danger">
            {seatProblem}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={!ready} onClick={open}>
            Open the ballot
          </Button>
          {missing ? <span className="text-footnote text-fg-muted">{missing}</span> : null}
        </div>
      </div>
    </Card>
  );
}
