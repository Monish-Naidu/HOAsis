"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Mail } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import {
  policyFor,
  collectionsLadder,
  type CollectionStage,
} from "@/lib/collections";
import { money, pluralize } from "@/lib/utils";
import { placeLabel } from "@/lib/wording";

/** The steps in the board's own words. The policy keeps its legal names. */
const STEP: Record<CollectionStage, string> = {
  current: "Current",
  reminder: "Reminder due",
  "late-notice": "Notice due",
  demand: "Final notice due",
  counsel: "Attorney next",
};

const ACTION: Record<CollectionStage, string> = {
  current: "Nothing",
  reminder: "Send a reminder with the amount and how to pay",
  "late-notice": "Send the notice, with the late fee",
  demand: "Send the final notice and offer a payment plan",
  counsel: "Hand the file to the attorney, with every notice attached",
};

const TONE: Record<CollectionStage, "neutral" | "warn" | "danger"> = {
  current: "neutral",
  reminder: "neutral",
  "late-notice": "warn",
  demand: "warn",
  counsel: "danger",
};

/**
 * Who is behind, and what the policy says to do about each of them today.
 *
 * "Total past due, $5,458" is a fact nobody can act on. The actionable version
 * is the list of households with a step owed now, and the step named, because
 * the legal defence for any of this is that the same ladder was run for
 * everybody and every rung was dated.
 */
export function CollectionsLadder() {
  const { community } = useAppState();
  const policy = policyFor(community.settings);
  const ladder = collectionsLadder(community, policy);

  if (ladder.rows.length === 0) {
    return (
      <Card className="mt-6 p-5">
        <p className="text-[15px] font-semibold text-fg">Everybody is current</p>
        <p className="mt-1 text-[15px] text-fg-muted">
          Nothing to chase. The ladder starts at {policy.reminderDay} days past due.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title={
          ladder.dueNow.length
            ? `${pluralize(ladder.dueNow.length, "household")} need a notice today`
            : "Nothing owed today"
        }
        subtitle={`${money(ladder.totalCents)} outstanding. Every household runs the same steps.`}
        action={
          ladder.dueNow.length ? (
            <Link
              href="/board/homeowners?remind=1"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
            >
              <Mail className="size-4" />
              Send reminders
            </Link>
          ) : undefined
        }
      />

      <div className="divide-y divide-border">
        {ladder.rows.map((row) => (
          <div key={row.owner.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-fg">
                {row.owner.displayName}
                <span className="ml-2 text-[13px] font-normal text-fg-muted">
                  {placeLabel(row.owner.unit)}
                </span>
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">
                {row.actionDue
                  ? ACTION[row.stage]
                  : row.daysToNext !== undefined
                    ? `${STEP[row.nextStage!]} in ${pluralize(row.daysToNext, "day")}`
                    : "Nothing due"}
              </p>
            </div>
            <p className="tnum shrink-0 text-[15px] font-semibold text-fg">
              {money(row.owner.balanceCents)}
            </p>
            <span className="shrink-0 text-[13px] text-fg-subtle">
              {pluralize(row.owner.daysPastDue, "day")} late
            </span>
            <Badge tone={TONE[row.stage]}>{STEP[row.stage]}</Badge>
          </div>
        ))}
      </div>

      {ladder.skipped.length ? (
        <div className="flex items-start gap-3 border-t border-border bg-warn-soft px-5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="text-[13px] leading-relaxed text-fg">
            {pluralize(ladder.skipped.length, "account")} passed the final notice step with no
            notice on record. Send what is missing before going further.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <p className="text-[13px] text-fg-muted">
          Reminder at {policy.reminderDay} days, notice at {policy.lateNoticeDay}, final notice
          at {policy.demandDay}, attorney at {policy.counselDay}. A payment plan of at least{" "}
          {policy.minimumPlanMonths} months is offered first.
        </p>
        <Link
          href="#collections-policy"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand hover:underline"
        >
          Change
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </Card>
  );
}
