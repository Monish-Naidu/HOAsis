"use client";

import { useMemo, useState } from "react";
import { Send, Wand2 } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, fieldClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { TEMPLATE_TOKENS } from "@/lib/data";
import type { MessageTemplate } from "@/lib/data/templates";
import { collectionsLadder, policyFor, type CollectionStage } from "@/lib/collections";
import { dueLetter, renderLetter } from "@/lib/letters";
import { homeLabel } from "@/lib/wording";
import { cn, formatDate, pluralize, money, todayIsoDate } from "@/lib/utils";
import type { Owner } from "@/lib/types";

/**
 * One send for everyone behind, each getting the letter their account is due.
 *
 * The old composer asked the board to pick one template for the whole group
 * and previewed it with the first household's name, which read as "this will
 * go to Gwen" while the button said "Send to 5". The policy already knows the
 * rung every household stands on, so the board does not choose a letter. It
 * reads the list, opens any household to see exactly what that person will
 * receive, fixes the wording if it wants, and sends.
 *
 * A rung's letter goes once. The ladder knows which homes have already been
 * sent theirs (`actionDue`), and those are listed with the day it went and
 * left out of the send. Built from the rung alone, the list put every home
 * back on it the moment one more fell due, and the next press wrote to all
 * of them again.
 */

const LETTER_TONE: Record<CollectionStage, "neutral" | "warn" | "danger"> = {
  current: "neutral",
  reminder: "neutral",
  "late-notice": "warn",
  demand: "danger",
  counsel: "danger",
};

export function RemindersComposer({ onClose }: { onClose: () => void }) {
  const { community, templates, saveTemplate, messageOwner } = useAppState();
  const { notify } = useToast();

  const policy = policyFor(community.settings);
  const ladder = useMemo(() => collectionsLadder(community, policy), [community, policy]);

  // Every past due household, with its letter or the day its first one is due.
  const rows = useMemo(
    () =>
      ladder.rows.map((row) => ({
        owner: row.owner,
        stage: row.stage,
        letter: dueLetter(row.owner, policy, templates),
        // False once this rung's letter has gone out, and the day it did.
        actionDue: row.actionDue,
        sentOn: row.sentOn,
        daysToFirst: row.stage === "current" ? row.daysToNext : undefined,
      })),
    [ladder, policy, templates],
  );
  const due = rows.filter((r) => r.letter && r.actionDue);
  // Listed under them, not sent to: already written to on this rung, or not
  // yet at the reminder day.
  const waiting = rows.filter((r) => !(r.letter && r.actionDue));
  const notYet = waiting.filter((r) => !r.sentOn);
  const [sending, setSending] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(due[0]?.owner.id ?? null);
  const selected = due.find((r) => r.owner.id === selectedId) ?? due[0];
  const [edit, setEdit] = useState<{ id: string; subject: string; body: string } | null>(null);

  function startEditing(template: MessageTemplate) {
    setEdit({ id: template.id, subject: template.subject, body: template.body });
  }

  function saveEdit() {
    if (!edit) return;
    const template = templates.find((t) => t.id === edit.id);
    if (!template) return;
    saveTemplate({ ...template, subject: edit.subject, body: edit.body, updatedDate: todayIsoDate() });
    setEdit(null);
    notify(`Saved "${template.name}"`);
  }

  async function sendAll() {
    if (sending) return;
    const going = due.filter((row) => row.letter);
    if (!going.length) return;
    // Every letter is asked for now, so each is filled in from the record as
    // it stands at the press, and then waited for. For a real association
    // they are written one after another, a second or so each, and saying
    // "sent" and closing at once invited the board to leave the page with
    // most of them still to go.
    setSending(true);
    const landed = await Promise.all(
      going.map((row) => {
        const letter = renderLetter(row.letter!, row.owner, community);
        return messageOwner(row.owner.id, letter.subject, letter.body, "Billing");
      }),
    );
    setSending(false);
    const sent = landed.filter(Boolean).length;
    if (sent === going.length) {
      notify(`Sent ${pluralize(sent, "letter")}, each filled in from its own record`, "ok");
      onClose();
      return;
    }
    // Each one that failed has said why. The composer stays open with the
    // homes still owed a letter, which by now are only the ones that failed.
    if (sent > 0) notify(`Sent ${sent} of ${pluralize(going.length, "letter")}`, "ok");
  }

  const editingSelected = edit && selected?.letter && edit.id === selected.letter.id;
  const preview =
    selected?.letter && !editingSelected
      ? renderLetter(selected.letter, selected.owner, community)
      : null;

  return (
    <Card className="mt-5">
      <CardHeader
        accent="coral"
        title="Reminders"
        subtitle={
          due.length
            ? "Each household gets the letter its account is due under the collection policy, filled in from its own record."
            : waiting.some((r) => r.sentOn)
              ? "Every household that is due a letter has been sent it."
              : "Nobody has reached the reminder day yet."
        }
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      />

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* Who, and which letter. */}
        <ul className="divide-y divide-border border-b border-border md:border-b-0 md:border-r">
          {due.map((row) => {
            const on = selected?.owner.id === row.owner.id;
            return (
              <li key={row.owner.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.owner.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
                    on ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <Avatar name={row.owner.members[0] ?? row.owner.displayName} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-fg">
                      {row.owner.displayName}
                    </span>
                    <span className="tnum block truncate text-footnote text-fg-muted">
                      {homeLabel(community, row.owner.unit)} · {money(row.owner.balanceCents)} ·{" "}
                      {pluralize(row.owner.daysPastDue, "day")} late
                    </span>
                  </span>
                  <Badge tone={LETTER_TONE[row.stage]}>{row.letter?.name}</Badge>
                </button>
              </li>
            );
          })}
          {waiting.map((row) => (
            <li key={row.owner.id} className="flex items-center gap-3 px-5 py-3 opacity-70">
              <Avatar name={row.owner.members[0] ?? row.owner.displayName} className="size-8" tone="neutral" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-fg">
                  {row.owner.displayName}
                </span>
                <span className="tnum block truncate text-footnote text-fg-muted">
                  {homeLabel(community, row.owner.unit)} · {money(row.owner.balanceCents)} ·{" "}
                  {pluralize(row.owner.daysPastDue, "day")} late
                </span>
              </span>
              <span className="shrink-0 text-footnote text-fg-subtle">
                {row.sentOn
                  ? `Sent ${formatDate(row.sentOn)}`
                  : row.daysToFirst !== undefined
                    ? `Reminder in ${pluralize(row.daysToFirst, "day")}`
                    : "Not due yet"}
              </span>
            </li>
          ))}
        </ul>

        {/* What that person will read. */}
        <div className="px-5 py-4">
          {selected?.letter ? (
            editingSelected && edit ? (
              <LetterEditor
                template={selected.letter}
                subject={edit.subject}
                body={edit.body}
                onChange={(next) => setEdit({ ...edit, ...next })}
                onSave={saveEdit}
                onCancel={() => setEdit(null)}
              />
            ) : preview ? (
              <LetterPreview owner={selected.owner} letter={preview}>
                <button
                  type="button"
                  onClick={() => startEditing(selected.letter!)}
                  className="text-footnote font-medium text-accent hover:underline"
                >
                  Edit the &ldquo;{selected.letter.name}&rdquo; letter
                </button>
              </LetterPreview>
            ) : null
          ) : (
            <p className="text-body leading-relaxed text-fg-muted">
              The ladder starts at {policy.reminderDay} days past due. Nothing goes out before
              that, and every household gets the same steps on the same days.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">
        <p className="text-footnote text-fg-muted">
          {sending
            ? "Sending. Keep this page open until it finishes."
            : due.length
              ? `Lands on each household's thread under Messages.`
              : ""}
          {!sending && notYet.length
            ? ` ${pluralize(notYet.length, "household")} behind but not yet at the reminder day.`
            : ""}
        </p>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          disabled={due.length === 0 || Boolean(edit) || sending}
          onClick={() => void sendAll()}
        >
          <Send className="size-3.5" />
          {sending ? "Sending" : `Send ${pluralize(due.length, "letter")}`}
        </Button>
      </div>
    </Card>
  );
}

/** The letter as one household will read it. */
function LetterPreview({
  owner,
  letter,
  children,
}: {
  owner: Owner;
  letter: { subject: string; body: string };
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="truncate text-footnote text-fg-muted">
        To {owner.displayName}
        {owner.email ? ` · ${owner.email}` : ""}
      </p>
      <p className="mt-2 text-body font-semibold text-fg">{letter.subject}</p>
      <div className="mt-3 whitespace-pre-wrap text-body leading-relaxed text-fg">{letter.body}</div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** The template behind a letter, with its tokens, for every household that gets it. */
function LetterEditor({
  template,
  subject,
  body,
  onChange,
  onSave,
  onCancel,
}: {
  template: MessageTemplate;
  subject: string;
  body: string;
  onChange: (next: { subject?: string; body?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const field =
    fieldClass;
  return (
    <div>
      <p className="text-footnote text-fg-muted">
        Editing &ldquo;{template.name}&rdquo;. The change applies to every household getting this
        letter, now and next month.
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-footnote font-semibold text-fg-muted">Subject</span>
        <input
          value={subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          aria-label="Subject"
          className={cn(field, "h-9")}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-footnote font-semibold text-fg-muted">Letter</span>
        <textarea
          value={body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={11}
          aria-label="Template body"
          className={cn(field, "resize-none py-2 leading-relaxed")}
        />
      </label>
      <p className="mt-3 mb-1.5 flex items-center gap-1.5 text-footnote font-semibold text-fg-muted">
        <Wand2 className="size-3" />
        Filled in per household
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_TOKENS.map((t) => (
          <button
            key={t.token}
            type="button"
            title={t.meaning}
            onClick={() => onChange({ body: `${body}${t.token}` })}
            className="rounded-md border border-border px-2 py-0.5 font-mono text-footnote text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            {t.token}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={onSave}>
          Save letter
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
