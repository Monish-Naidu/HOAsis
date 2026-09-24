"use client";

import { useState } from "react";
import { ChevronDown, MessagesSquare, Plus, Send } from "lucide-react";
import { ResidentTitle } from "@/components/app/resident-title";
import { useToast } from "@/components/app/toast";
import { Badge, Button, Card, EmptyState, SectionTitle, Select } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import type { MessageThread } from "@/lib/types";
import { cn, formatDate, relativeDays } from "@/lib/utils";

const TOPICS: { value: MessageThread["tag"]; label: string }[] = [
  { value: "General", label: "Something else" },
  { value: "Billing", label: "My account or dues" },
  { value: "Maintenance", label: "Something broken" },
  { value: "Architectural", label: "A change to my home" },
  { value: "Governance", label: "Rules or meetings" },
];

const field =
  "w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-primary";

/**
 * An owner's conversations with the board.
 *
 * The board has always had an inbox of these, and an owner could only read
 * them by email. Now they start one here and answer here. A question is not
 * a request: a request has a clock and a decision, a message is a question.
 */
export function MessagesScreen() {
  const { community, messageBoard, replyAsOwner } = useAppState();
  const owner = useCurrentOwner();
  const { notify } = useToast();
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<MessageThread["tag"]>("General");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  if (!owner) return null;
  const threads = community.threads
    .filter((t) => t.ownerId === owner.id)
    .sort((a, b) => (a.updatedDate < b.updatedDate ? 1 : -1));

  async function send() {
    if (!owner) return;
    setSending(true);
    try {
      const ok = await messageBoard(owner.id, subject, body, topic);
      if (ok) {
        notify("Sent to the board");
        setSubject("");
        setBody("");
        setTopic("General");
        setComposing(false);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not send it", "warn");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle
        title="Messages"
        subtitle="Questions for the board, and their answers."
        action={
          composing ? undefined : (
            <Button variant="primary" size="md" onClick={() => setComposing(true)}>
              <Plus className="size-3.5" />
              New message
            </Button>
          )
        }
      />

      {composing ? (
        <Card className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg-muted">About</span>
            <Select
              value={topic}
              onChange={(e) => setTopic(e.target.value as MessageThread["tag"])}
              aria-label="What it is about"
              className="w-full [&>select]:h-11 [&>select]:w-full"
            >
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg-muted">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Question about the pool closure"
              className={cn(field, "h-11")}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg-muted">Message</span>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What would you like to ask?"
              className={cn(field, "resize-none py-2.5 leading-relaxed")}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!subject.trim() || !body.trim() || sending}
              onClick={() => void send()}
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </Card>
      ) : null}

      {threads.length === 0 && !composing ? (
        <EmptyState
          icon={<MessagesSquare className="size-5" />}
          title="No messages yet"
          description="Ask the board anything. Something broken or a change to your home? Send a request instead, so it gets a decision."
        />
      ) : null}

      {threads.length ? (
        <section>
          <SectionTitle>Conversations</SectionTitle>
          <Card className="divide-y divide-border">
            {threads.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                onReply={(text) => replyAsOwner(t.id, owner.id, text)}
              />
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function ThreadRow({
  thread,
  onReply,
}: {
  thread: MessageThread;
  onReply: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const last = thread.messages[thread.messages.length - 1];
  const waitingOnBoard = last?.fromRole === "resident";

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-medium text-fg">{thread.subject}</span>
            {waitingOnBoard ? <Badge tone="neutral">Sent</Badge> : <Badge tone="info">Board replied</Badge>}
          </span>
          <span className="mt-0.5 line-clamp-1 block text-[13px] text-fg-muted">
            {last ? `${last.fromRole === "resident" ? "You" : last.from}: ${last.body}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[13px] text-fg-subtle">
          {relativeDays(thread.updatedDate)}
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t border-border bg-surface-2 px-4 py-3">
        {thread.messages.map((m) => (
          <div key={m.id}>
            <p className="text-[13px]">
              <span className="font-semibold text-fg">{m.fromRole === "resident" ? "You" : m.from}</span>{" "}
              <span className="text-fg-subtle">{formatDate(m.at, "medium")}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed text-fg">{m.body}</p>
          </div>
        ))}
        <form
          className="flex items-end gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft;
            void onReply(text).then((ok) => {
              if (ok) setDraft("");
            });
          }}
        >
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply"
            aria-label={`Reply to ${thread.subject}`}
            className={cn(field, "resize-none py-2 leading-relaxed")}
          />
          <Button type="submit" variant="secondary" size="md" disabled={!draft.trim()}>
            Send
          </Button>
        </form>
      </div>
    </details>
  );
}
