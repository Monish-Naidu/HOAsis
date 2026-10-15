"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Checkbox, Field, Select, Segmented, fieldClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { ValidationError } from "@/lib/core/errors";
import type { Ballot } from "@/lib/types";
import { placeLabel } from "@/lib/wording";
import { MAX_PROXY_HOLDER_LENGTH, paperVoteProblem, proxyHolderProblem } from "@/lib/voting";

/** The message of a refusal the action raised on purpose, or null for anything else. */
function refusal(e: unknown): string | null {
  return e instanceof ValidationError ? e.message : null;
}

/**
 * A paper ballot or a proxy, typed in for one home while the vote runs.
 *
 * One vote per home either way: once a home is picked, the form says why it
 * is out (it voted online, the board entered its vote, or the dues rule), in
 * the same words the database refuses with. The choice stays a checkbox the
 * board copies off the paper; the tally counts it the same as an online
 * vote, and no screen says which home picked what.
 */
export function PaperVoteForm({ ballot }: { ballot: Ballot }) {
  const { community, enterPaperVote } = useAppState();
  const { notify } = useToast();
  const [homeId, setHomeId] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [method, setMethod] = useState<"paper" | "proxy">("paper");
  const [holder, setHolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const homes = community.homes;
  const home = homes.find((h) => h.id === homeId);
  const seats = Math.max(1, ballot.seats ?? 1);
  const why = home ? paperVoteProblem(ballot, home) : null;
  const holderProblem = proxyHolderProblem(method, holder);
  const problem = why ?? holderProblem;
  const ready = home && !problem && picks.length > 0;

  function toggle(optionId: string) {
    setPicks((current) => {
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      return seats > 1 ? [...current.slice(-(seats - 1)), optionId] : [optionId];
    });
  }

  async function enter(event: FormEvent) {
    event.preventDefault();
    if (saving || !ready) return;
    setError(null);
    setSaving(true);
    const where = home ? placeLabel(home.unit) : "";
    try {
      const ok = await enterPaperVote({
        ballotId: ballot.id,
        homeId,
        optionIds: picks,
        method,
        proxyHolder: holder,
      });
      if (ok) {
        notify(`Vote entered for ${where}.`);
        setHomeId("");
        setPicks([]);
        setHolder("");
      }
    } catch (e) {
      const said = refusal(e);
      if (said === null) throw e;
      setError(said);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details>
      <summary className="cursor-pointer text-footnote font-medium text-fg-muted">
        Enter a paper or proxy vote
      </summary>
      <form className="mt-3 space-y-3" onSubmit={enter}>
        <Field label="The home the vote is for">
          <Select
            value={homeId}
            onChange={(e) => {
              setHomeId(e.target.value);
              setError(null);
            }}
          >
            <option value="">Pick a home</option>
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {placeLabel(h.unit)} · {h.displayName}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-1 text-footnote font-semibold text-fg-muted">
            The choice on the paper
            {seats > 1 ? (
              <span className="font-normal text-fg-subtle"> (up to {seats})</span>
            ) : null}
          </p>
          <div className="space-y-1.5">
            {ballot.options.map((o) => (
              <label
                key={o.id}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-body text-fg"
              >
                <Checkbox checked={picks.includes(o.id)} onChange={() => toggle(o.id)} />
                <span className="min-w-0 break-words">{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Segmented
          label="How it arrived"
          value={method}
          onChange={(next) => {
            setMethod(next);
            setError(null);
          }}
          options={[
            { value: "paper", label: "Paper ballot" },
            { value: "proxy", label: "Proxy" },
          ]}
        />

        {method === "proxy" ? (
          <Field label="Who held the proxy">
            <input
              value={holder}
              onChange={(e) => {
                setHolder(e.target.value);
                setError(null);
              }}
              placeholder="Their name"
              maxLength={MAX_PROXY_HOLDER_LENGTH}
              className={fieldClass}
            />
          </Field>
        ) : null}

        {(problem ?? error) ? (
          <p role="alert" className="text-footnote font-medium text-danger">
            {problem ?? error}
          </p>
        ) : null}

        <Button type="submit" size="sm" disabled={!ready || saving}>
          {saving ? "Entering it" : "Enter the vote"}
        </Button>
      </form>
    </details>
  );
}
