import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  FileText,
  Landmark,
  Megaphone,
  MessageSquarePlus,
  Radio,
  Sparkles,
  Vote,
  Waves,
} from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import {
  amenities,
  announcements,
  ballotsAwaitingMyVote,
  events,
  liveMeeting,
  ownerBalanceDue,
  requestsForOwner,
  CURRENT_OWNER_ID,
} from "@/lib/data";
import { formatDate, money, relativeDays } from "@/lib/utils";

const statusTone = {
  approved: "ok",
  denied: "danger",
  "in-review": "info",
  "info-needed": "warn",
  submitted: "neutral",
  closed: "neutral",
  draft: "neutral",
} as const;

export default function ResidentHome() {
  const due = ownerBalanceDue();
  const myRequests = requestsForOwner(CURRENT_OWNER_ID);
  const open = myRequests.filter((r) => !["approved", "denied", "closed"].includes(r.status));
  const pinned = announcements.find((a) => a.pinned);
  const rest = announcements.filter((a) => !a.pinned).slice(0, 2);
  const nextEvents = events.slice(0, 3);
  const live = liveMeeting();
  const toVote = ballotsAwaitingMyVote();

  return (
    <div className="animate-rise space-y-6">
      {/* Balance: the reason residents open the app. */}
      <Card className="overflow-hidden border-navy-800 bg-navy-900 text-navy-50 shadow-raised dark:border-navy-700">
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-navy-300">
            Balance due
          </p>
          <p className="tnum mt-1.5 text-[40px] font-semibold leading-none tracking-[-0.035em]">
            {money(due.balanceCents)}
          </p>
          <p className="mt-2 text-[13px] text-navy-200">
            {due.nextChargeDate
              ? `September assessment, due ${formatDate(due.nextChargeDate, "long")} · ${relativeDays(
                  due.nextChargeDate,
                )}`
              : "Nothing outstanding"}
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/resident/pay"
              className="flex h-10 flex-1 items-center justify-center rounded-lg bg-navy-50 text-[14px] font-semibold text-navy-950 transition-opacity hover:opacity-90"
            >
              Pay {money(due.balanceCents, { cents: false })}
            </Link>
            <Link
              href="/resident/account"
              className="flex h-10 items-center justify-center rounded-lg border border-navy-600 px-4 text-[13px] font-medium text-navy-100 transition-colors hover:bg-navy-800"
            >
              History
            </Link>
          </div>
        </div>
        {!due.autopay ? (
          <Link
            href="/resident/pay#autopay"
            className="flex items-center gap-2 border-t border-navy-700 bg-navy-800/60 px-5 py-3 transition-colors hover:bg-navy-800"
          >
            <Sparkles className="size-4 shrink-0 text-navy-300" />
            <span className="flex-1 text-[12px] leading-snug text-navy-100">
              Turn on autopay and skip the late fees.
            </span>
            <ChevronRight className="size-4 shrink-0 text-navy-400" />
          </Link>
        ) : null}
      </Card>

      {/* Live meeting and open ballots */}
      {live ? (
        <Link
          href="/resident/vote"
          className="flex items-center gap-3 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 transition-opacity hover:opacity-90"
        >
          <Radio className="size-4 shrink-0 text-ok" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ok">{live.title}</span>
            <span className="block text-[11px] text-ok opacity-90">
              Live now · {live.attendees.length} joined · tap to join
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ok" />
        </Link>
      ) : null}

      {toVote.length ? (
        <Link
          href="/resident/vote"
          className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
            <Vote className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-fg">
              {toVote.length === 1 ? "A ballot needs your vote" : `${toVote.length} ballots need your vote`}
            </span>
            <span className="block truncate text-[11px] text-fg-muted">
              {toVote[0].title} · closes {relativeDays(toVote[0].closesDate)}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>
      ) : null}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          href="/resident/requests/new"
          icon={<MessageSquarePlus className="size-[18px]" />}
          label="New request"
          hint="Repairs, approvals, records"
        />
        <QuickAction
          href="/resident/documents"
          icon={<FileText className="size-[18px]" />}
          label="Documents"
          hint="CC&Rs, budget, minutes"
        />
        <QuickAction
          href="/resident/finances"
          icon={<Landmark className="size-[18px]" />}
          label="Association funds"
          hint="Balances, interest, transactions"
        />
      </div>

      {/* Open requests */}
      {open.length > 0 ? (
        <section>
          <SectionTitle
            action={
              <Link href="/resident/requests" className="text-[12px] font-medium text-accent">
                All {myRequests.length}
              </Link>
            }
          >
            Your open requests
          </SectionTitle>
          <Card>
            {open.map((r, i) => (
              <Link
                key={r.id}
                href={`/resident/requests/${r.reference}`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{r.title}</p>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    {r.reference} · submitted {formatDate(r.submittedDate)}
                  </p>
                </div>
                <Badge tone={statusTone[r.status]}>{r.status.replace("-", " ")}</Badge>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {/* Announcements */}
      <section>
        <SectionTitle>From the board</SectionTitle>
        <div className="space-y-3">
          {pinned ? (
            <Card className="border-l-2 border-l-navy-700 dark:border-l-navy-300">
              <div className="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Megaphone className="size-3.5 text-fg-subtle" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                    Pinned · {pinned.category}
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                  {pinned.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{pinned.body}</p>
                <p className="mt-2.5 text-[11px] text-fg-subtle">
                  {pinned.author} · {formatDate(pinned.postedDate)}
                </p>
              </div>
            </Card>
          ) : null}
          {rest.map((a) => (
            <Card key={a.id}>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                  {a.category}
                </span>
                <h3 className="mt-1 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                  {a.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                  {a.body}
                </p>
                <p className="mt-2.5 text-[11px] text-fg-subtle">
                  {a.author} · {formatDate(a.postedDate)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Calendar */}
      <section>
        <SectionTitle>Coming up</SectionTitle>
        <Card>
          {nextEvents.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-3">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-subtle">
                  {formatDate(e.date).split(" ")[0]}
                </span>
                <span className="tnum text-[14px] font-semibold leading-none text-fg">
                  {formatDate(e.date).split(" ")[1]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{e.title}</p>
                <p className="text-[11px] text-fg-muted">
                  {e.time} · {e.location}
                </p>
              </div>
              {e.agendaUrl ? (
                <ArrowUpRight className="size-3.5 shrink-0 text-fg-subtle" />
              ) : null}
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
            <CalendarDays className="size-3.5 text-fg-subtle" />
            <span className="text-[11px] text-fg-muted">Add to your phone calendar</span>
          </div>
        </Card>
      </section>

      {/* Amenities */}
      <section>
        <SectionTitle>Amenities right now</SectionTitle>
        <Card>
          {amenities.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <Waves className="size-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-fg">{a.name}</p>
                <p className="truncate text-[11px] text-fg-muted">{a.detail}</p>
              </div>
              <Badge tone={a.status === "open" ? "ok" : a.status === "reserved" ? "warn" : "danger"}>
                {a.status}
              </Badge>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-border bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-2"
    >
      <span className="mb-2 inline-flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
        {icon}
      </span>
      <p className="text-[13px] font-semibold text-fg">{label}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{hint}</p>
    </Link>
  );
}
