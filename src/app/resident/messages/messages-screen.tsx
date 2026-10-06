"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, MessagesSquare, Plus, Send } from "lucide-react";
import { addressLabel, boardOffices, boardSignature, officeChoiceLabel, OFFICES, toLabel } from "@/lib/board-offices";
import { ResidentTitle } from "@/components/app/resident-title";
import { useToast } from "@/components/app/toast";
import { Badge, Button, Card, EmptyState, SectionTitle, Select, fieldClass } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import type { MessageEvent, MessageThread, ThreadAddress } from "@/lib/types";
import { cn, formatDate, relativeDays } from "@/lib/utils";

const TOPICS: { value: MessageThread["tag"]; label: string }[] = [
  { value: "General", label: "Something else" },
  { value: "Billing", label: "My account or dues" },
  { value: "Maintenance", label: "Something broken" },
  { value: "Architectural", label: "A change to my home" },
  { value: "Governance", label: "Rules or meetings" },
];

const field =
  fieldClass;

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
  // A request page sends its owner here with the subject filled in, so a
  // question about a request opens ready to type.
  const params = useSearchParams();
  const asked = params.get("subject") ?? "";
  // A link can open the form already addressed, as the Write buttons do.
  const askedOffice = params.get("to");
  const [composing, setComposing] = useState(Boolean(asked || askedOffice));
  const [to, setTo] = useState<ThreadAddress>(
    OFFICES.some((o) => o === askedOffice) ? (askedOffice as ThreadAddress) : "board",
  );
  const [subject, setSubject] = useState(asked);
  const [topic, setTopic] = useState<MessageThread["tag"]>("General");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  if (!owner) return null;
  const offices = boardOffices(community.accounts);
  const threads = community.threads
    .filter((t) => t.ownerId === owner.id)
    .sort((a, b) => (a.updatedDate < b.updatedDate ? 1 : -1));

  async function send() {
    if (!owner) return;
    setSending(true);
    try {
      const ok = await messageBoard(owner.id, subject, body, topic, to);
      if (ok) {
        notify(to === "board" ? "Sent to the board" : `Sent to the ${addressLabel(to)}`);
        setSubject("");
        setBody("");
        setTopic("General");
        setTo("board");
        setComposing(false);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Your message did not send. Check your connection and try again.", "warn");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle
        title="Messages"
        subtitle="Questions for the board."
        action={
          composing ? undefined : (
            <Button variant="primary" size="md" onClick={() => setComposing(true)}>
              <Plus className="size-3.5" />
              {/* One word on a phone, where the title shares the row. */}
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New message</span>
            </Button>
          )
        }
      />

      {composing ? null : (
        <section id="your-board" aria-label="Your board">
          <SectionTitle>Your board</SectionTitle>
          <Card className="divide-y divide-border">
            {offices.map((o) => (
              <div key={o.office} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-fg">{o.label}</span>
                  <span className="block text-footnote text-fg">{o.holder ?? "Nobody holds this office yet"}</span>
                  <span className="block text-footnote text-fg-muted">{o.handles}</span>
                </span>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!o.holder}
                  aria-label={`Write to the ${o.label}`}
                  onClick={() => {
                    setTo(o.office);
                    setComposing(true);
                  }}
                >
                  Write
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {composing ? (
        <Card className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-footnote font-semibold text-fg-muted">To</span>
            <Select
              value={to}
              onChange={(e) => setTo(e.target.value as ThreadAddress)}
              aria-label="Who it is for"
              className="w-full [&>select]:h-11 [&>select]:w-full"
            >
              <option value="board">The board</option>
              {offices.map((o) => (
                <option key={o.office} value={o.office} disabled={!o.holder}>
                  {officeChoiceLabel(o)}
                </option>
              ))}
            </Select>
            <span className="mt-1.5 block text-footnote text-fg-muted">
              The whole board can read it. An office is told by email.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-footnote font-semibold text-fg-muted">About</span>
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
            <span className="mb-1.5 block text-footnote font-semibold text-fg-muted">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Question about the pool closure"
              className={cn(field, "h-11")}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-footnote font-semibold text-fg-muted">Message</span>
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

/** A reply from an officer reads "Dana Whitcomb, Treasurer, for the board". */
function senderName(m: MessageEvent): string {
  return m.fromOffice ? boardSignature(m.from, m.fromOffice) : m.from;
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
            <span className="truncate text-body font-medium text-fg">{thread.subject}</span>
            {thread.toRole !== "board" ? <Badge tone="neutral">{toLabel(thread.toRole)}</Badge> : null}
            {waitingOnBoard ? (
              <Badge tone="neutral">Waiting on the board</Badge>
            ) : (
              <Badge tone="info">Board replied</Badge>
            )}
          </span>
          <span className="mt-0.5 line-clamp-1 block text-footnote text-fg-muted">
            {last ? `${last.fromRole === "resident" ? "You" : senderName(last)}: ${last.body}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-footnote text-fg-subtle">
          {relativeDays(thread.updatedDate)}
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t border-border bg-surface-2 px-4 py-3">
        {thread.messages.map((m) => (
          <div key={m.id}>
            <p className="text-footnote">
              <span className="font-semibold text-fg">{m.fromRole === "resident" ? "You" : senderName(m)}</span>{" "}
              <span className="text-fg-subtle">{formatDate(m.at, "medium")}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-line text-body leading-relaxed text-fg">{m.body}</p>
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
