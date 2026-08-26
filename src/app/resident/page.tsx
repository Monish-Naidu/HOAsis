"use client";

import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Landmark,
  Megaphone,
  MessageSquarePlus,
  Radio,
  Vote,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { calendarEntries } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { HomeSchedule } from "@/components/app/home-schedule";
import { BalanceCard } from "@/components/app/balance-card";
import { MyOpenRequests } from "@/components/app/my-open-requests";
import { formatDate, relativeDays } from "@/lib/utils";


export default function ResidentHome() {
  const { community, settings } = useAppState();
  const announcements = community.announcements;
  const live = community.meetings.find((m) => m.status === "live");
  const toVote = community.ballots.filter(
    (b) => b.audience === "owners" && b.status === "open" && !b.myVoteOptionId,
  );
  const pinned = announcements.find((a) => a.pinned);
  const rest = announcements.filter((a) => !a.pinned).slice(0, 2);

  return (
    <div className="animate-rise space-y-6">
      <BalanceCard />

      {/* Live meeting and open ballots */}
      {live ? (
        <Link
          href="/resident/vote"
          className="flex items-center gap-3 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 transition-opacity hover:opacity-90"
        >
          <Radio className="size-4 shrink-0 text-ok" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ok">{live.title}</span>
            <span className="block text-[13px] text-ok opacity-90">
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
            <span className="block text-[15px] font-semibold text-fg">
              {toVote.length === 1 ? "A ballot needs your vote" : `${toVote.length} ballots need your vote`}
            </span>
            <span className="block truncate text-[13px] text-fg-muted">
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
        {/* Hidden with the section itself, so the shortcut is never a dead end. */}
        {settings.showFundsToResidents ? (
          <QuickAction
            href="/resident/finances"
            icon={<Landmark className="size-[18px]" />}
            label="Association funds"
            hint="Balances, interest, transactions"
          />
        ) : null}
      </div>

      <MyOpenRequests />

      {/* Announcements */}
      <section>
        <SectionTitle>From the board</SectionTitle>
        <div className="space-y-3">
          {pinned ? (
            <Card className="border-l-2 border-l-navy-700 dark:border-l-navy-300">
              <div className="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Megaphone className="size-3.5 text-fg-subtle" />
                  <span className="text-[13px] font-semibold text-fg-muted">
                    Pinned · {pinned.category}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                  {pinned.title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{pinned.body}</p>
                <p className="mt-2.5 text-[13px] text-fg-subtle">
                  {pinned.author} · {formatDate(pinned.postedDate)}
                </p>
              </div>
            </Card>
          ) : null}
          {rest.map((a) => (
            <Card key={a.id}>
              <div className="p-4">
                <span className="text-[13px] font-semibold text-fg-muted">
                  {a.category}
                </span>
                <h3 className="mt-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                  {a.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-fg-muted">
                  {a.body}
                </p>
                <p className="mt-2.5 text-[13px] text-fg-subtle">
                  {a.author} · {formatDate(a.postedDate)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <HomeSchedule entries={calendarEntries(community)} />
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
      <p className="text-[15px] font-semibold text-fg">{label}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{hint}</p>
    </Link>
  );
}
