"use client";

import { ArrowDownLeft, ArrowUpRight, Inbox, MailCheck, Send } from "lucide-react";
import { Avatar, Badge, Button, Callout, Card, CardHeader, EmptyState, PageHeader, textareaClass } from "@/components/ui/primitives";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppState, useUnreadThreadCount } from "@/lib/app-state";
import { DeliveryPanel } from "@/components/app/delivery-panel";
import { useToast } from "@/components/app/toast";
import { cn, formatDate, pluralize } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";
import { useHomeLabel } from "@/components/app/use-home-label";

/**
 * Messages, the inbox: what owners have written to the board, and the reply.
 *
 * Announcements used to share this page with the inbox, the dues email and
 * three stat tiles, which made the one thing a board member opens it for (an
 * owner is waiting) the fourth thing on the screen. They have their own tab
 * now, beside this one and the Community forum.
 */

/** How many conversations the inbox lists before it is asked for the rest. */
const RECENT_THREADS = 30;

export default function BoardCommunications() {
  // The screen reads `?thread=` from the URL, which is what the Suspense is
  // for: the rest of the page prerenders and the selection resolves on the client.
  return (
    <Suspense fallback={null}>
      <CommunicationsScreen />
    </Suspense>
  );
}

function CommunicationsScreen() {
  const placeLabel = useHomeLabel();
  const { community, threads, replyToThread } = useAppState();
  const unread = useUnreadThreadCount();
  const { notify } = useToast();
  const params = useSearchParams();
  const [activeId, setActiveId] = useState(params.get("thread") ?? threads[0]?.id);
  const [draft, setDraft] = useState("");
  // Ten years of collection letters is a hundred conversations. The list
  // opens on the newest and unfolds on request; the open one always shows.
  const [showAll, setShowAll] = useState(false);
  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  // Every board seat is copied on a reply, so the count is the roster's.
  const boardSeats = community.accounts.filter((a) => a.role !== "resident").length;

  function send() {
    if (!draft.trim() || !active) return;
    replyToThread(active.id, draft.trim());
    setDraft("");
    notify(`Reply sent to ${active.participants[0]}`);
  }

  return (
    <>
      <PageHeader
        title="Messages"
        description={
          unread
            ? `${pluralize(unread, "conversation")} waiting on a reply.`
            : "What owners have written to the board."
        }
      />

      {/* Which ways a notice may actually go. It governs everything sent from
          here: a household reachable by email is not reachable for a notice
          the statute says must go on paper. */}
      {moduleOn("delivery-panel") ? (
        <div className="mb-6">
          <DeliveryPanel />
        </div>
      ) : null}

      {!active ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="No owner messages yet"
            description="Messages from residents appear here."
          />
        </Card>
      ) : (
      // One column until lg, and each column may shrink: without both, the
      // longest subject set the grid's width and the page scrolled sideways
      // at 320 to 390.
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
        {/* Thread list */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Inbox" subtitle={pluralize(threads.length, "conversation")} />
          {(showAll
            ? threads
            : threads.filter((t, i) => i < RECENT_THREADS || t.id === active.id)
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-2",
                t.id === active.id && "bg-primary-soft/50",
              )}
            >
              <Avatar name={t.participants[0]} tone={t.unread ? "brand" : "neutral"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`min-w-0 flex-1 truncate text-body ${
                      t.unread ? "font-semibold text-fg" : "font-medium text-fg-muted"
                    }`}
                  >
                    {t.subject}
                  </p>
                  {t.unread ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                </div>
                <p className="mt-0.5 truncate text-footnote text-fg-muted">
                  {t.participants.join(", ")}
                  {t.unit ? ` · ${placeLabel(t.unit)}` : ""}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone="neutral">{t.tag}</Badge>
                  <span className="text-footnote text-fg-subtle">{formatDate(t.updatedDate)}</span>
                </div>
              </div>
            </button>
          ))}
          {!showAll && threads.length > RECENT_THREADS ? (
            <div className="border-t border-border px-5 py-3">
              <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
                Show all {threads.length} conversations
              </Button>
            </div>
          ) : null}
        </Card>

        {/* Reading pane, as tall as the inbox beside it */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <Card className="flex flex-1 flex-col">
            <CardHeader
              title={active.subject}
              subtitle={`${active.participants.join(", ")}${active.unit ? ` · ${placeLabel(active.unit)}` : ""}`}
              action={<Badge tone="neutral">{active.tag}</Badge>}
            />
            <div className="flex-1 space-y-4 px-5 py-4">
              {active.messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <span
                    className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full ${
                      m.direction === "inbound"
                        ? "bg-info-soft text-info"
                        : "bg-surface-3 text-fg-muted"
                    }`}
                  >
                    {m.direction === "inbound" ? (
                      <ArrowDownLeft className="size-3" />
                    ) : (
                      <ArrowUpRight className="size-3" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-body font-semibold text-fg">{m.from}</span>
                      <span className="text-footnote text-fg-subtle">
                        {formatDate(m.at, "long")} · {m.channel === "portal" ? "in the app" : m.channel}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-body leading-relaxed text-fg-muted">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-4">
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-footnote">
                <span className="text-fg-subtle">To</span>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-medium text-fg">
                  {active.participants[0]}
                </span>
                <span className="text-fg-subtle">Cc</span>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-medium text-fg">
                  Board ({boardSeats})
                </span>
              </div>
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a reply"
                aria-label="Reply"
                className={cn(textareaClass, "resize-none")}
              />
              <div className="mt-2 flex justify-end">
                <Button variant="primary" size="sm" disabled={!draft.trim()} onClick={send}>
                  <Send className="size-3.5" />
                  Send
                </Button>
              </div>
            </div>
          </Card>

          {moduleOn("delivery-panel") ? (
            <Callout tone="brand" icon={<MailCheck className="size-4" />} title="Delivery is evidence">
              Every send records who got it, who opened it, and what bounced. That log is your proof
              that owners were notified.
            </Callout>
          ) : null}
        </div>
      </div>
      )}
    </>
  );
}
