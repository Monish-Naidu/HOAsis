"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Select } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { ValidationError } from "@/lib/core/errors";
import { ROLE_LABEL, type Ballot, type Office } from "@/lib/types";
import { placeLabel } from "@/lib/wording";
import { formatDate } from "@/lib/utils";
import {
  SEATABLE_OFFICES,
  seatingBlocked,
  seatingChoiceProblem,
  seatingPlan,
  seatedWords,
} from "@/lib/voting";

/** The message of a refusal the action raised on purpose, or null for anything else. */
function refusal(e: unknown): string | null {
  return e instanceof ValidationError ? e.message : null;
}

/**
 * Seating a closed election's winners: the board picks an office for each
 * winner, the sitting holder steps back to being a resident, and the
 * presidency is left to its own handover in Settings. Whoever cannot be
 * seated from the result says why, in the words the database keeps.
 *
 * Once per ballot: after that, the panel is the record of what happened.
 * The same refusals the database makes before it looks at anybody (a tie,
 * a missed quorum) are said in place of the form.
 */
export function SeatingPanel({ ballot, onCancel }: { ballot: Ballot; onCancel: () => void }) {
  const { community, seatWinners } = useAppState();
  const { notify } = useToast();
  const [offices, setOffices] = useState<Record<string, Office | "">>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (ballot.winnersSeatedDate) {
    return (
      <p className="text-footnote text-fg-muted">
        Winners seated {formatDate(ballot.winnersSeatedDate)} by{" "}
        {ballot.winnersSeatedBy ?? "the board"}: {seatedWords(ballot.seated ?? [])}.
      </p>
    );
  }

  const blocked = seatingBlocked(ballot);
  if (blocked) return <p className="text-footnote text-fg-muted">{blocked}</p>;

  const plan = seatingPlan(ballot, community.homes, community.accounts);
  const problem = seatingChoiceProblem(plan, offices);

  async function seat(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const words = await seatWinners(ballot.id, offices);
      if (words) notify(`${words}.`);
    } catch (e) {
      const said = refusal(e);
      if (said === null) throw e;
      setError(said);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="max-w-xl space-y-2.5" onSubmit={seat}>
      {plan.map((row) => (
        <div key={row.optionId} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-body text-fg">
            {row.name}
            {row.unit ? (
              <span className="ml-1 text-footnote text-fg-subtle">{placeLabel(row.unit)}</span>
            ) : null}
          </span>
          {row.problem ? (
            <span className="text-footnote text-warn">{row.problem}</span>
          ) : (
            <Select
              size="sm"
              aria-label={`Office for ${row.name}`}
              className="w-44"
              value={offices[row.optionId] ?? ""}
              onChange={(e) => {
                setOffices({ ...offices, [row.optionId]: e.target.value as Office | "" });
                setError(null);
              }}
            >
              <option value="">Pick an office</option>
              {SEATABLE_OFFICES.map((office) => (
                <option key={office} value={office}>
                  {ROLE_LABEL[office]}
                </option>
              ))}
            </Select>
          )}
        </div>
      ))}
      {(problem ?? error) ? (
        <p role="alert" className="text-footnote font-medium text-danger">
          {problem ?? error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={Boolean(problem) || saving}>
          {saving ? "Seating them" : "Seat the winners"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
