"use client";

import { useState } from "react";
import { Button, Field, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { useHomeLabel } from "@/components/app/use-home-label";
import { ValidationError } from "@/lib/core/errors";
import { checkMeetingTime } from "@/lib/input-checks";
import { attendedLine } from "@/lib/meeting-notices";
import { ROLE_LABEL, type Meeting, type MeetingAttendee } from "@/lib/types";
import { formatDate, todayIsoDate } from "@/lib/utils";

/** The message of a refusal the action raised on purpose, or null for anything else. */
function refusal(e: unknown): string | null {
  return e instanceof ValidationError ? e.message : null;
}

/**
 * Change the date and Cancel the meeting, on a meeting still to come. The
 * form opens under the buttons and one is open at a time.
 */
export function MeetingChanges({ meeting }: { meeting: Meeting }) {
  const [mode, setMode] = useState<"move" | "cancel" | null>(null);
  return (
    <div className="mt-2">
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("move")}>
            Change the date
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("cancel")}>
            Cancel the meeting
          </Button>
        </div>
      ) : mode === "move" ? (
        <ChangeDateForm meeting={meeting} onClose={() => setMode(null)} />
      ) : (
        <CancelForm meeting={meeting} onClose={() => setMode(null)} />
      )}
    </div>
  );
}

function ChangeDateForm({ meeting: m, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { rescheduleMeeting } = useAppState();
  const { notify } = useToast();
  const [date, setDate] = useState(m.date);
  const [time, setTime] = useState(m.time);
  const [location, setLocation] = useState(m.location);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!date || date < todayIsoDate()) {
      setError("Pick a date that has not passed.");
      return;
    }
    const checked = checkMeetingTime(time);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    if (!location.trim()) {
      setError("Say where it will be held.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const ok = await rescheduleMeeting(m.id, { date, time: checked.time, location });
      if (ok) {
        notify(`${m.title} moved to ${formatDate(date, "long")}.`);
        onClose();
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
    <form
      className="rounded-lg border border-border bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="New date">
          <input type="date" value={date} min={todayIsoDate()} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Time">
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="7:00 PM" className={fieldClass} />
        </Field>
        <Field label="Where">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={fieldClass} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-footnote font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Keep the date
        </Button>
      </div>
    </form>
  );
}

function CancelForm({ meeting: m, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { cancelMeeting } = useAppState();
  const { notify } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function cancel() {
    if (saving) return;
    if (reason.trim().length < 3) {
      setError("Say why the meeting is cancelled.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const ok = await cancelMeeting(m.id, reason);
      if (ok) {
        notify(`${m.title} is cancelled.`);
        onClose();
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
    <form
      className="rounded-lg border border-border bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void cancel();
      }}
    >
      <Field label="Why is it cancelled?" hint="Residents see this on their calendar." error={error}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No quorum, storm warning" className={fieldClass} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={saving}>
          Cancel the meeting
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Keep the meeting
        </Button>
      </div>
    </form>
  );
}

/** Who is marked as having come, by name and home or office. */
function attendeeKey(a: Pick<MeetingAttendee, "name" | "unit">): string {
  return `${a.name.trim().toLowerCase()}|${(a.unit ?? "").trim().toLowerCase()}`;
}

/**
 * The minutes of a meeting that was held, and who came. Written once; "Edit
 * minutes" opens the same form with what was saved.
 */
export function MinutesPanel({ meeting: m }: { meeting: Meeting }) {
  const [editing, setEditing] = useState(false);
  const saved = m.minutes?.trim() ? m.minutes : null;
  if (saved && !editing) {
    return <SavedMinutes meeting={m} text={saved} onEdit={() => setEditing(true)} />;
  }
  return <MinutesForm meeting={m} onClose={() => setEditing(false)} />;
}

/** Longer than this folds into a `<details>`; the board has the whole text one press away. */
const FOLD_AFTER = 600;

function SavedMinutes({ meeting: m, text, onEdit }: { meeting: Meeting; text: string; onEdit: () => void }) {
  const placeLabel = useHomeLabel();
  const body = <p className="whitespace-pre-line text-body text-fg-muted">{text}</p>;
  const came = m.attended ?? [];
  return (
    <div>
      {text.length > FOLD_AFTER ? (
        <details>
          <summary className="cursor-pointer select-none text-footnote font-semibold text-fg-muted">
            Minutes{m.minutesDate ? `, recorded ${formatDate(m.minutesDate)}` : ""}
          </summary>
          <div className="mt-1.5">{body}</div>
        </details>
      ) : (
        <>
          <p className="mb-1 text-footnote font-semibold text-fg-muted">
            Minutes{m.minutesDate ? `, recorded ${formatDate(m.minutesDate)}` : ""}
          </p>
          {body}
        </>
      )}
      {came.length ? (
        <details className="mt-2 text-footnote">
          <summary className="cursor-pointer select-none font-medium text-fg-muted">{attendedLine(m)}</summary>
          <ul className="mt-1.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {came.map((a) => (
              <li key={attendeeKey(a)} className="flex items-center gap-2 text-fg-muted">
                <span className="truncate">{a.name}</span>
                <span className="ml-auto shrink-0 text-fg-subtle">{a.role ?? (a.unit ? placeLabel(a.unit) : "")}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Button variant="secondary" size="sm" className="mt-3" onClick={onEdit}>
        Edit minutes
      </Button>
    </div>
  );
}

function MinutesForm({ meeting: m, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { community, recordMinutes } = useAppState();
  const { notify } = useToast();
  const placeLabel = useHomeLabel();

  // Everyone the board might tick: owners who said yes, the board, and
  // anyone already saved or added by hand. Ticked to start are those who
  // said yes, or those the saved minutes name.
  const yes: MeetingAttendee[] = (m.rsvps ?? [])
    .filter((r) => r.response === "yes")
    .map((r) => ({ name: r.name, unit: r.unit, channel: "in-person" as const }));
  const board: MeetingAttendee[] = community.accounts
    .filter((a) => a.role !== "resident")
    .map((a) => ({ name: a.name, unit: a.unit, role: ROLE_LABEL[a.role], channel: "in-person" as const }));
  const savedList = m.attended ?? [];
  const [added, setAdded] = useState<MeetingAttendee[]>([]);
  const everyone = new Map<string, MeetingAttendee>();
  for (const a of [...yes, ...board, ...savedList, ...added]) {
    const key = attendeeKey(a);
    if (!everyone.has(key)) everyone.set(key, a);
  }
  const [minutes, setMinutes] = useState(m.minutes ?? "");
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set((savedList.length ? savedList : yes).map(attendeeKey)),
  );
  const [name, setName] = useState("");
  const [home, setHome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addSomeone() {
    const who = name.trim();
    if (!who) return;
    const person: MeetingAttendee = { name: who, unit: home.trim() || undefined, channel: "in-person" };
    setAdded((all) => [...all, person]);
    setTicked((all) => new Set(all).add(attendeeKey(person)));
    setName("");
    setHome("");
  }

  async function save() {
    if (saving) return;
    if (minutes.trim().length < 10) {
      setError("Write the minutes first.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const attended = [...everyone.entries()].filter(([key]) => ticked.has(key)).map(([, a]) => a);
      const ok = await recordMinutes(m.id, minutes, attended);
      if (ok) {
        notify("Minutes saved.");
        onClose();
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Minutes" hint="What was decided and who moved it. Residents can read them." error={error}>
        <textarea value={minutes} onChange={(e) => setMinutes(e.target.value)} rows={8} className={textareaClass} />
      </Field>
      <fieldset className="mt-4">
        <legend className="mb-1 text-footnote font-semibold text-fg-muted">Who came</legend>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {[...everyone.entries()].map(([key, a]) => (
            <li key={key}>
              <label className="flex min-h-9 items-center gap-2 text-body text-fg-muted pointer-coarse:min-h-11">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={ticked.has(key)}
                  onChange={(e) =>
                    setTicked((all) => {
                      const next = new Set(all);
                      if (e.target.checked) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                />
                <span className="truncate">{a.name}</span>
                <span className="ml-auto shrink-0 text-footnote text-fg-subtle">
                  {a.role ?? (a.unit ? placeLabel(a.unit) : "")}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Field label="Add someone" className="min-w-40 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // Enter here adds the person; it must not save the minutes.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSomeone();
                }
              }}
              placeholder="Name"
              className={fieldClass}
            />
          </Field>
          <Field label="Home" className="w-28">
            <input value={home} onChange={(e) => setHome(e.target.value)} placeholder="12" className={fieldClass} />
          </Field>
          <Button variant="secondary" size="md" disabled={!name.trim()} onClick={addSomeone}>
            Add
          </Button>
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="md" disabled={saving}>
          Save minutes
        </Button>
        {m.minutes ? (
          <Button variant="ghost" size="md" onClick={onClose}>
            Keep what is saved
          </Button>
        ) : null}
      </div>
    </form>
  );
}
