"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Paperclip, Send } from "lucide-react";
import { Button, textareaClass } from "@/components/ui/primitives";
import type { HomeRequest } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * One request, opened in place: everything the owner sent, the conversation so
 * far, and a box to answer. The row above it keeps two lines of the text so a
 * list of ten is still a list; this is the rest.
 *
 * Reading is for every seat that can open the page. Replying is only offered to
 * a seat that may change requests, so a look-only seat sees the same words and
 * no box.
 */
export function RequestDetail({
  request,
  canChange,
  onReply,
}: {
  request: HomeRequest;
  canChange: boolean;
  /** Resolves true once the reply is saved. The box clears only then. */
  onReply: (requestId: string, body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const files = request.attachments;
  const sent = request.submission;

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onReply(request.id, body);
    setSending(false);
    // A failed save has been said by the write itself; the words stay put.
    if (ok) setDraft("");
  }

  return (
    <details className="group mt-2 text-footnote" data-testid={`request-detail-${request.id}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        Read it all{canChange ? " and reply" : ""}
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 space-y-4 rounded-lg border border-border bg-surface-2 p-4">
        <div>
          <p className="font-semibold text-fg-muted">What they wrote</p>
          <p className="mt-1 whitespace-pre-wrap text-body leading-relaxed text-fg">{request.summary}</p>
          <p className="mt-2 text-fg-subtle">
            Sent {formatDate(request.submittedDate, "long")}
            {request.dueDate
              ? ` · answer by ${formatDate(request.dueDate, "long")}${request.dueReason ? ` (${request.dueReason})` : ""}`
              : ""}
            {request.decisionDate
              ? ` · answered ${formatDate(request.decisionDate, "long")}${request.decidedBy ? ` by ${request.decidedBy}` : ""}`
              : ""}
          </p>
        </div>

        {sent ? (
          <div>
            <p className="font-semibold text-fg-muted">What they sent{sent.formLabel ? `, on ${sent.formLabel}` : ""}</p>
            <dl className="mt-1.5 space-y-2">
              {sent.answers
                .filter((a) => a.value)
                .map((a) => (
                  <div key={a.fieldId}>
                    <dt className="text-fg-muted">{a.label}</dt>
                    <dd className="mt-0.5 break-words text-body text-fg">{a.value}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-2 text-fg-subtle">
              Signed by {sent.signature.typedName} on{" "}
              {formatDate(sent.signature.signedAt.slice(0, 10), "long")}
            </p>
          </div>
        ) : null}

        {files.length ? (
          <div>
            <p className="font-semibold text-fg-muted">Files</p>
            <ul className="mt-1.5 space-y-1">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-body text-fg">
                  <Paperclip className="size-3.5 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="tnum shrink-0 text-fg-muted">{f.size}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="font-semibold text-fg-muted">Conversation</p>
          {request.thread.length === 0 ? (
            <p className="mt-1.5 text-body text-fg-muted">Nothing has been said on this request yet.</p>
          ) : (
            <div className="mt-2 space-y-4">
              {/* The thread is kept oldest first; this is the layout the
                  Messages screen uses for a thread. */}
              {request.thread.map((e) => {
                const fromOwner = e.actorRole === "resident";
                return (
                  <div key={e.id} className="flex gap-3">
                    <span
                      className={cn(
                        "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full",
                        fromOwner ? "bg-info-soft text-info" : "bg-surface-3 text-fg-muted",
                      )}
                    >
                      {fromOwner ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-body font-semibold text-fg">{e.actor}</span>
                        <span className="text-fg-subtle">{formatDate(e.at, "long")}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body leading-relaxed text-fg-muted">{e.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canChange ? (
          <div className="border-t border-border pt-4">
            <label htmlFor={`reply-${request.id}`} className="font-semibold text-fg-muted">
              Reply to the owner
            </label>
            <textarea
              id={`reply-${request.id}`}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a question or say what happens next"
              className={cn(textareaClass, "mt-1.5 resize-none")}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-fg-subtle">{request.ownerName} sees this on their request page.</span>
              <Button variant="primary" size="sm" disabled={!draft.trim() || sending} onClick={() => void send()}>
                <Send className="size-3.5" />
                {sending ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
