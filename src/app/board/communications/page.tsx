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
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { threads, unreadThreadCount } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Communications" };

export default function BoardCommunications() {
  const active = threads[0];
  const unread = unreadThreadCount();

  return (
    <>
      <PageHeader
        eyebrow="Owner communications"
        title="Communications"
        
        action={
          <Button variant="primary" size="md">
            <Send className="size-3.5" />
            New message
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Unread" value={String(unread)} tone="warn" icon={<Inbox className="size-4" />} />
        <Stat
          label="Delivered this month"
          value="88"
          tone="ok"
          hint="71 opened · 3 bounced"
          icon={<MailCheck className="size-4" />}
        />
        <Stat label="Open threads" value={String(threads.length)} icon={<Users className="size-4" />} />
        <Stat label="Avg. board reply" value="1.4 days" tone="ok" hint="Across the last 30 days" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        {/* Thread list */}
        <Card className="lg:col-span-2">
          <CardHeader title="Inbox" />
          {threads.map((t) => (
            <button
              key={t.id}
              className={`flex w-full items-start gap-3 border-b border-border px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-2 ${
                t.id === active.id ? "bg-brand-soft/50" : ""
              }`}
            >
              <Avatar name={t.participants[0]} tone={t.unread ? "brand" : "neutral"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      t.unread ? "font-semibold text-fg" : "font-medium text-fg-muted"
                    }`}
                  >
                    {t.subject}
                  </p>
                  {t.unread ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-fg-muted">
                  {t.participants.join(", ")}
                  {t.unit ? ` · Unit ${t.unit}` : ""}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone="neutral">{t.tag}</Badge>
                  <span className="text-[11px] text-fg-subtle">{formatDate(t.updatedDate)}</span>
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
                      <span className="text-[13px] font-semibold text-fg">{m.from}</span>
                      <span className="text-[11px] text-fg-subtle">
                        {formatDate(m.at, "long")} · {m.channel}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-4">
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-fg-subtle">To</span>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-medium text-fg">
                  {active.participants[0]}
                </span>
                <span className="text-fg-subtle">Cc</span>
                <span className="rounded-md bg-surface-3 px-2 py-0.5 font-medium text-fg">
                  Board (4)
                </span>
                <button className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                  <AtSign className="size-3" />
                  Add
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="Write a reply…"
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg outline-none placeholder:text-fg-subtle"
              />
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-muted hover:text-fg">
                    <Paperclip className="size-3.5" />
                    Attach
                  </button>
                  <span className="text-[11px] text-fg-subtle">Draft saved 12s ago</span>
                </div>
                <Button variant="primary" size="sm">
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
    </>
  );
}
