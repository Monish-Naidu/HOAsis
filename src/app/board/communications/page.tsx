"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  MailCheck,
  Megaphone,
  Pin,
  Send,
  Users,
} from "lucide-react";
import type { Announcement } from "@/lib/types";
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

const CATEGORIES: Announcement["category"][] = ["Notice", "Maintenance", "Event", "Governance"];

/**
 * What every resident's home screen carries under "From the board".
 *
 * Announcements used to exist only as demo fixtures. Now the board writes
 * them here, they persist, and removing one takes it off every resident's
 * screen the same moment.
 */
function AnnouncementsManager({
  composing,
  setComposing,
}: {
  composing: boolean;
  setComposing: (open: boolean) => void;
}) {
  const { community, addAnnouncement, removeAnnouncement } = useAppState();
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Announcement["category"]>("Notice");
  const [pinned, setPinned] = useState(false);

  const announcements = [...community.announcements].sort((a, b) =>
    a.postedDate < b.postedDate ? 1 : -1,
  );

  function post() {
    if (!title.trim() || !body.trim()) {
      notify("An announcement needs a title and a body", "warn");
      return;
    }
    addAnnouncement({ title: title.trim(), body: body.trim(), category, pinned });
    setTitle("");
    setBody("");
    setPinned(false);
    setCategory("Notice");
    setComposing(false);
    notify("Posted. Every resident's home screen carries it now.");
  }

  return (
    <Card id="announcements" className="mt-5 scroll-mt-24">
      <CardHeader
        title="Announcements"
        subtitle={'What residents see under "From the board" on their home screen.'}
        icon={<Megaphone className="size-4" />}
        action={
          composing ? undefined : (
            <Button variant="primary" size="sm" onClick={() => setComposing(true)}>
              New announcement
            </Button>
          )
        }
      />

      {composing ? (
        <form
          className="space-y-3 border-b border-border bg-surface-2 px-5 py-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-wrap gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              aria-label="Announcement title"
              className="h-9 min-w-52 flex-1 rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg placeholder:text-fg-subtle"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Announcement["category"])}
              aria-label="Category"
              className="h-9 rounded-lg border border-border-2 bg-surface px-2 text-[15px] text-fg"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should every household know?"
            aria-label="Announcement body"
            rows={3}
            className="w-full rounded-lg border border-border-2 bg-surface px-3 py-2 text-[15px] leading-relaxed text-fg placeholder:text-fg-subtle"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[13px] font-medium text-fg-muted">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="size-4 accent-current"
              />
              Pin to the top of the home screen
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" onClick={post}>
                Post announcement
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {announcements.length === 0 && !composing ? (
        <p className="px-5 py-6 text-center text-[15px] text-fg-muted">
          Nothing posted yet. The first announcement most boards write is how dues are billed.
        </p>
      ) : null}
      {announcements.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-medium text-fg">{a.title}</p>
              {a.pinned ? (
                <Badge tone="brand">
                  <Pin className="size-2.5" />
                  Pinned
                </Badge>
              ) : null}
              <Badge tone="neutral">{a.category}</Badge>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-muted">{a.body}</p>
            <p className="mt-1 text-[13px] text-fg-subtle">
              {a.author} · {formatDate(a.postedDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              removeAnnouncement(a.id);
              notify("Announcement removed", "warn");
            }}
            className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-fg-muted hover:bg-surface-2 hover:text-danger"
          >
            Remove
          </button>
        </div>
      ))}
    </Card>
  );
}

export default function BoardCommunications() {
  const { community, threads, replyToThread } = useAppState();
  const unread = useUnreadThreadCount();
  const stats = communicationsSummary(community);
  const { notify } = useToast();
  const [activeId, setActiveId] = useState(threads[0]?.id);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  // Every board seat is copied on a reply, so the count is the roster's.
  const boardSeats = community.accounts.filter((a) => a.role !== "resident").length;

  // The page's one primary action writes to every resident's home screen.
  // It used to show a toast about a composer that did not exist.
  function startMessage() {
    setComposing(true);
    document.getElementById("announcements")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
          <Button variant="primary" size="md" onClick={startMessage}>
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

      <AnnouncementsManager composing={composing} setComposing={setComposing} />

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
                  Board ({boardSeats})
                </span>
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
