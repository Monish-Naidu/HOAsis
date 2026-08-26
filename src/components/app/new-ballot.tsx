"use client";

import { useState } from "react";
import { Plus, Vote, X } from "lucide-react";
import { Button, Callout, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { addDays, todayIsoDate } from "@/lib/utils";

/**
 * Opening a ballot.
 *
 * The button here used to raise a toast saying the builder "opens with the
 * notice requirements", and no builder existed. So a new association had no
 * way to run a vote, and the four counts at the top of this page could never
 * move off zero.
 *
 * The form is short on purpose. What actually decides whether a vote survives
 * a challenge is the notice period, the quorum and the threshold, so those are
 * the fields, and each says what it is for rather than assuming the reader has
 * run an election before.
 */
export function NewBallot({ onClose }: { onClose: () => void }) {
  const { community, addBallot, ballots } = useAppState();
  const { notify } = useToast();

  const homes = community.owners.length || community.association.unitCount;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState(["For", "Against"]);
  const [noticeDays, setNoticeDays] = useState(14);
  const [openDays, setOpenDays] = useState(21);
  const [quorumPercent, setQuorumPercent] = useState(20);
  const [threshold, setThreshold] = useState("A majority of votes cast");

  const field =
    "h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand";

  const opensOn = addDays(todayIsoDate(), noticeDays);
  const closesOn = addDays(opensOn, openDays);
  const quorum = Math.max(1, Math.ceil((homes * quorumPercent) / 100));
  const ready = title.trim().length > 2 && choices.filter((c) => c.trim()).length >= 2;

  function open() {
    const seq = ballots.length + 1;
    addBallot({
      id: `bal-${Date.now()}`,
      reference: `BAL-${todayIsoDate().slice(0, 4)}-${String(seq).padStart(3, "0")}`,
      title: title.trim(),
      body: body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      kind: "poll",
      audience: "owners",
      status: "open",
      opensDate: opensOn,
      closesDate: closesOn,
      eligible: homes,
      quorumRequired: quorum,
      thresholdLabel: threshold,
      // Running totals stay hidden while voting is open, which is the
      // association's own setting and the default everywhere for a reason:
      // a visible tally changes how the undecided vote.
      liveResultsVisible: community.settings.showLiveVoteResults,
      options: choices
        .filter((c) => c.trim())
        .map((label, index) => ({
          id: `opt-${Date.now()}-${index}`,
          label: label.trim(),
          votes: 0,
        })),
    });
    notify(`${title.trim()} opens ${opensOn}. Owners get notice today.`);
    onClose();
  }

  return (
    <Card className="mb-5">
      <CardHeader
        icon={<Vote className="size-4" />}
        title="New ballot"
        subtitle="Owners vote one per home"
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
            Cancel
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">What are they voting on</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Replace the pool fence"
            aria-label="Ballot title"
            className={`mt-1.5 ${field}`}
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">
            What owners should know before they vote
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="What it costs, why now, and what happens if it does not pass."
            aria-label="Ballot detail"
            className="mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
          />
        </label>

        <div>
          <span className="text-[13px] font-semibold text-fg-muted">Choices</span>
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
            Another choice
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">Notice period</span>
            <select
              value={noticeDays}
              onChange={(e) => setNoticeDays(Number(e.target.value))}
              aria-label="Notice period"
              className={`mt-1.5 ${field}`}
            >
              {[10, 14, 21, 30].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">Open for</span>
            <select
              value={openDays}
              onChange={(e) => setOpenDays(Number(e.target.value))}
              aria-label="Voting window"
              className={`mt-1.5 ${field}`}
            >
              {[7, 14, 21, 30].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">Quorum</span>
            <select
              value={quorumPercent}
              onChange={(e) => setQuorumPercent(Number(e.target.value))}
              aria-label="Quorum percentage"
              className={`mt-1.5 ${field}`}
            >
              {[10, 20, 25, 33, 50].map((p) => (
                <option key={p} value={p}>
                  {p}% of homes
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">What it takes to pass</span>
          <select
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            aria-label="Passing threshold"
            className={`mt-1.5 ${field}`}
          >
            <option>A majority of votes cast</option>
            <option>Two thirds of votes cast</option>
            <option>A majority of all homes</option>
            <option>Two thirds of all homes</option>
          </select>
        </label>

        {/* The three things that decide whether a result survives a challenge,
            stated back before anybody presses the button. */}
        <Callout tone="info" title="What owners will be told">
          Notice goes out today. Voting opens {opensOn} and closes {closesOn}. At least{" "}
          {quorum} of {homes} homes must vote for the result to count, and it passes on{" "}
          {threshold.toLowerCase()}.
        </Callout>

        <Button size="lg" disabled={!ready} onClick={open}>
          Open the ballot
        </Button>
      </div>
    </Card>
  );
}
