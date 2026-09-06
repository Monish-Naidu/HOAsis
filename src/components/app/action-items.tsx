"use client";

import { useState } from "react";
import { ListChecks, Plus, X } from "lucide-react";
import { Button, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { ActionItem } from "@/lib/types";
import { cn, daysFromToday, formatDate, relativeDays, todayIsoDate } from "@/lib/utils";

/**
 * What the board agreed to do.
 *
 * Minutes record what was decided. Nobody records the "I'll call the roofer"
 * that follows a decision, which is why the roofer is called in October. One
 * line each: what, who, by when, and a box to tick. Overdue turns amber, done
 * goes below the line and stays there, so the list is the last meeting's
 * homework and the next meeting's first agenda item.
 */

const FIELD =
  "h-9 w-full rounded-lg border border-border-2 bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-brand";
const LABEL = "mb-1 block text-[13px] font-semibold text-fg-muted";

export function ActionItems({
  meetingId,
  compact,
  className,
}: {
  /** Only the items from one meeting. */
  meetingId?: string;
  compact?: boolean;
  className?: string;
}) {
  const { community, addActionItem, setActionItemDone, removeActionItem } = useAppState();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);

  const all = meetingId
    ? community.actionItems.filter((i) => i.meetingId === meetingId)
    : community.actionItems;
  const open = all
    .filter((i) => !i.doneOn)
    .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
  const done = all
    .filter((i) => i.doneOn)
    .sort((a, b) => (a.doneOn! < b.doneOn! ? 1 : -1))
    .slice(0, 5);
  const overdue = open.filter((i) => i.dueOn && daysFromToday(i.dueOn) < 0).length;

  return (
    <Card className={className}>
      <CardHeader
        title="Action items"
        subtitle={
          compact
            ? undefined
            : open.length
              ? `${open.length} open${overdue ? `, ${overdue} overdue` : ""}`
              : "What the board agreed to do, and who took it"
        }
        icon={<ListChecks className="size-4" />}
        action={
          adding ? null : (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              Add
            </Button>
          )
        }
      />

      {adding ? (
        <AddForm
          onCancel={() => setAdding(false)}
          onSave={(input) => {
            try {
              addActionItem({ ...input, meetingId });
              setAdding(false);
              notify(`${input.ownerName || "Somebody"} owes: ${input.title}`);
            } catch (error) {
              notify(error instanceof Error ? error.message : "Could not add that", "warn");
            }
          }}
        />
      ) : null}

      {open.length === 0 && done.length === 0 && !adding ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="Nothing owed"
          description="When a meeting ends with somebody saying they will do something, write it here so it is still true next month."
        />
      ) : null}

      {open.map((item) => (
        <Row
          key={item.id}
          item={item}
          onToggle={() => setActionItemDone(item.id, true)}
          onRemove={() => {
            removeActionItem(item.id);
            notify("Removed.", "info");
          }}
        />
      ))}

      {done.length ? (
        <>
          <p className="border-t border-border bg-surface-2 px-5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
            Done
          </p>
          {done.map((item) => (
            <Row
              key={item.id}
              item={item}
              done
              onToggle={() => setActionItemDone(item.id, false)}
              onRemove={() => {
                removeActionItem(item.id);
                notify("Removed.", "info");
              }}
            />
          ))}
        </>
      ) : null}
    </Card>
  );
}

function Row({
  item,
  done,
  onToggle,
  onRemove,
}: {
  item: ActionItem;
  done?: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const late = !done && item.dueOn ? daysFromToday(item.dueOn) < 0 : false;
  return (
    <div className="group flex items-start gap-3 border-t border-border px-5 py-3 first:border-t-0">
      <input
        type="checkbox"
        checked={Boolean(done)}
        onChange={onToggle}
        aria-label={done ? `Reopen: ${item.title}` : `Done: ${item.title}`}
        className="mt-1 size-4 shrink-0 rounded border-border-2 accent-[var(--color-brand)]"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[15px] leading-snug text-fg",
            done && "text-fg-muted line-through",
          )}
        >
          {item.title}
        </p>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {item.ownerName || "Unassigned"}
          {done && item.doneOn
            ? ` · done ${formatDate(item.doneOn, "medium")}`
            : item.dueOn
              ? ` · due ${formatDate(item.dueOn, "medium")}`
              : ""}
          {late ? (
            <span className="font-medium text-warn"> · {relativeDays(item.dueOn!)}</span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove: ${item.title}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg focus:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function AddForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: { title: string; ownerName: string; dueOn?: string }) => void;
}) {
  const { community } = useAppState();
  const board = community.accounts.filter((a) => a.role !== "resident");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(board[0]?.name ?? "");
  const [custom, setCustom] = useState("");
  const [dueOn, setDueOn] = useState("");
  const ownerName = owner === "__other" ? custom.trim() : owner;

  return (
    <form
      className="space-y-3 border-b border-border bg-surface-2 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), ownerName, dueOn: dueOn || undefined });
      }}
    >
      <label className="block">
        <span className={LABEL}>What</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Get two quotes for the clubhouse roof"
          className={FIELD}
          autoFocus
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Who</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={FIELD}>
            {board.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
            <option value="__other">Somebody else</option>
          </select>
          {owner === "__other" ? (
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Their name"
              className={`mt-1.5 ${FIELD}`}
            />
          ) : null}
        </label>
        <label className="block">
          <span className={LABEL}>By when</span>
          <input
            type="date"
            value={dueOn}
            min={todayIsoDate()}
            onChange={(e) => setDueOn(e.target.value)}
            className={FIELD}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
          Add it
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
