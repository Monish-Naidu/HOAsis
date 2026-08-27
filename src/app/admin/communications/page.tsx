"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Inbox,
  MailCheck,
  Paperclip,
  Send,
  Users,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { useState } from "react";
import { useAppState, useUnreadThreadCount } from "@/lib/app-state";
import { DeliveryPanel } from "@/components/app/delivery-panel";
import { useToast } from "@/components/app/toast";
import { formatDate, pluralize } from "@/lib/utils";
import { communicationsSummary } from "@/lib/metrics";
import { DuesMailer } from "@/components/app/dues-mailer";

export default function BoardCommunications() {
  const { community, threads, replyToThread } = useAppState();
  const unread = useUnreadThreadCount();
  const stats = communicationsSummary(community);
  const { notify } = useToast();
  const [activeId, setActiveId] = useState(threads[0]?.id);
  const [draft, setDraft] = useState("");
  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  function send() {
    if (!draft.trim() || !active) return;
    replyToThread(active.id, draft.trim());
    setDraft("");
    notify(`Reply sent to ${active.participants[0]}`);
  }

  return (
    <>
      <PageHeader
        title="Communications"
        action={
          <Button
            variant="primary"
            size="md"
            onClick={() => notify("Composer opens with the full owner list", "info")}
          >
            <Send className="size-3.5" />
            New message
          </Button>
        }
      />

      {/* Which ways a notice may actually go. It sits above the numbers
          because it governs them: a household counted as reachable by email is
          not reachable for a notice the statute says must go on paper. */}
      <div className="mb-5">
        <DeliveryPanel />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Unread" value={String(unread)} tone="warn" icon={<Inbox className="size-4" />} />
        <Stat
          label="Reachable households"
          value={String(stats.reachable)}
          tone={stats.reachable === stats.households ? "ok" : "warn"}
          hint={
            stats.reachable === stats.households
              ? "Every household has an email on file"
              : `${stats.households - stats.reachable} with no email on file`
          }
          icon={<MailCheck className="size-4" />}
        />
        <Stat label="Open threads" value={String(threads.length)} icon={<Users className="size-4" />} />
        <Stat
          label="Average reply time"
          value={stats.avgReplyDays === undefined ? "No replies yet" : `${stats.avgReplyDays} days`}
          tone={stats.avgReplyDays !== undefined && stats.avgReplyDays <= 2 ? "ok" : "neutral"}
          hint={stats.sent ? `${pluralize(stats.sent, "reply", "replies")} sent` : undefined}
        />
      </div>

      <DuesMailer />

      {!active ? (
        <Card className="mt-5">
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="No owner messages yet"
            description="Anything a resident sends the board arrives here."
          />
        </Card>
      ) : (
      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        {/* Thread list */}
        <Card className="lg:col-span-2">
          <CardHeader title="Inbox" />
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`flex w-full items-start gap-3 border-b border-border px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-2 ${
                t.id === active.id ? "bg-brand-soft/50" : ""
              }`}
            >
              <Avatar name={t.participants[0]} tone={t.unread ? "brand" : "neutral"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`min-w-0 flex-1 truncate text-[15px] ${
                      t.unread ? "font-semibold text-fg" : "font-medium text-fg-muted"
                    }`}
                  >
                    {t.subject}
                  </p>
                  {t.unread ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-fg-muted">
                  {t.participants.join(", ")}
                  {t.unit ? ` · Unit ${t.unit}` : ""}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone="neutral">{t.tag}</Badge>
                  <span className="text-[13px] text-fg-subtle">{formatDate(t.updatedDate)}</span>
                </div>
              </div>
            </button>
          ))}
        </Card>

        {/* Reading pane */}
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader
              title={active.subject}
              subtitle={`${active.participants.join(", ")}${active.unit ? ` · Unit ${active.unit}` : ""}`}
              action={<Badge tone="neutral">{active.tag}</Badge>}
            />
            <div className="space-y-4 px-5 py-4">
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
                      <span className="text-[15px] font-semibold text-fg">{m.from}</span>
                      <span className="text-[13px] text-fg-subtle">
                        {formatDate(m.at, "long")} · {m.channel}
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-4">
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-fg-subtle">To</span>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-medium text-fg">
                  {active.participants[0]}
                </span>
                <span className="text-fg-subtle">Cc</span>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-medium text-fg">
                  Board (4)
                </span>
                <button
                  type="button"
                  onClick={() => notify("Recipient picker opens here", "info")}
                  className="inline-flex items-center gap-1 text-fg-muted hover:text-fg"
                >
                  <AtSign className="size-3" />
                  Add
                </button>
              </div>
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a reply…"
                aria-label="Reply"
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[15px] text-fg outline-none placeholder:text-fg-subtle"
              />
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => notify("Attachment picker opens here", "info")}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"
                  >
                    <Paperclip className="size-3.5" />
                    Attach
                  </button>
                  <span className="text-[13px] text-fg-subtle">
                    {draft ? "Draft saved" : "No draft"}
                  </span>
                </div>
                <Button variant="primary" size="sm" disabled={!draft.trim()} onClick={send}>
                  <Send className="size-3.5" />
                  Send
                </Button>
              </div>
            </div>
          </Card>

          <Callout tone="brand" icon={<MailCheck className="size-4" />} title="Delivery is evidence">
            Every send records who got it, who opened it, and what bounced. That log is what proves
            you noticed the membership.
          </Callout>
        </div>
      </div>
      )}
    </>
  );
}
