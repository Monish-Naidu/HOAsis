"use client";

import { useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Button, Card, CardHeader, Select, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { addDays, formatDate, todayIsoDate } from "@/lib/utils";
import { checkMeetingTime } from "@/lib/input-checks";
import type { Meeting } from "@/lib/types";

const KINDS: { value: Meeting["kind"]; label: string; hint: string }[] = [
  { value: "board", label: "Board meeting", hint: "The directors, open to owners to watch" },
  { value: "annual", label: "Annual meeting", hint: "Every owner, elections and the budget" },
  { value: "special", label: "Special meeting", hint: "Called for one question" },
  { value: "workshop", label: "Workshop", hint: "No decisions, just the work" },
];

/**
 * Putting a meeting on the calendar.
 *
 * The page listed meetings and could show one live, but a new association
 * had no way to create one, so the four counts at the top never moved and
 * the resident calendar stayed empty. The form asks for what a notice needs:
 * when, where, how to dial in, and what is on the agenda.
 */
export function ScheduleMeeting({ onClose }: { onClose: () => void }) {
  const { addMeeting } = useAppState();
  const { notify } = useToast();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Meeting["kind"]>("board");
  const [date, setDate] = useState(addDays(todayIsoDate(), 14));
  const [time, setTime] = useState("7:00 PM");
  const [location, setLocation] = useState("");
  const [dialIn, setDialIn] = useState("");
  const [passcode, setPasscode] = useState("");
  const [agenda, setAgenda] = useState("");
  // The time is checked once it has been left or the form has been tried, so
  // an untouched form does not open with a complaint.
  const [timeTouched, setTimeTouched] = useState(false);
  const checkedTime = checkMeetingTime(time);

  const field =
    fieldClass;
  const label = "mb-1 block text-footnote font-semibold text-fg-muted";

  const ready = title.trim().length > 0 && date >= todayIsoDate() && location.trim().length > 0;

  function schedule() {
    if (!ready) return;
    if (!checkedTime.ok) {
      setTimeTouched(true);
      return;
    }
    const items = agenda
      .split("\n")
      .map((line) => line.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
      .filter(Boolean);
    addMeeting({
      id: `mtg-${Date.now()}`,
      title: title.trim(),
      date,
      time: checkedTime.time,
      status: "scheduled",
      kind,
      location: location.trim(),
      dialIn: dialIn.trim(),
      passcode: passcode.trim(),
      attendees: [],
      agenda: items,
      ballotIds: [],
    });
    notify(`${title.trim()} is scheduled for ${formatDate(date, "long")}.`);
    onClose();
  }

  return (
    <Card
      as="form"
      className="mb-5"
      onSubmit={(e) => {
        e.preventDefault();
        schedule();
      }}
    >
      <CardHeader
        icon={<CalendarPlus className="size-4" />}
        title="Schedule a meeting"
        subtitle="Residents see it on their calendar as soon as you schedule it"
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-3.5" />
            Cancel
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <label className="block">
            <span className={label}>Meeting name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="October board meeting"
              className={field}
              autoFocus
            />
          </label>
          <label className="block">
            <span className={label}>Type of meeting</span>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as Meeting["kind"])}
              className="w-full [&>select]:h-10"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <span className="mt-1 block text-footnote text-fg-subtle">
              {KINDS.find((k) => k.value === kind)?.hint}
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={label}>Date</span>
            <input
              type="date"
              value={date}
              min={todayIsoDate()}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </label>
          <label className="block">
            <span className={label}>Time</span>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => setTimeTouched(true)}
              placeholder="7:00 PM"
              aria-invalid={timeTouched && !checkedTime.ok}
              className={field}
            />
            {timeTouched && !checkedTime.ok ? (
              <span role="alert" className="mt-1 block text-footnote text-danger">
                {checkedTime.message}
              </span>
            ) : null}
          </label>
          <label className="block">
            <span className={label}>Where</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Clubhouse, or video call"
              className={field}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Dial-in or video link (optional)</span>
            <input
              value={dialIn}
              onChange={(e) => setDialIn(e.target.value)}
              placeholder="(937) 555-0140"
              className={field}
            />
          </label>
          <label className="block">
            <span className={label}>Passcode (optional)</span>
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="481 220"
              className={field}
            />
          </label>
        </div>

        <label className="block">
          <span className={label}>Agenda, one item a line</span>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={4}
            placeholder={"Call to order\nTreasurer's report\nOpen forum"}
            className={textareaClass}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="md" disabled={!ready}>
            Schedule meeting
          </Button>
          <span className="text-footnote text-fg-subtle">
            Once it is scheduled, press Send notice on the meeting to tell every owner.
          </span>
        </div>
      </div>
    </Card>
  );
}
