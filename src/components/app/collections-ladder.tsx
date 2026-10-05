"use client";

import { AlertTriangle, Mail } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import {
  policyFor,
  collectionsLadder,
  type CollectionStage,
} from "@/lib/collections";
import { formatDate, money, pluralize } from "@/lib/utils";
import { useHomeLabel } from "@/components/app/use-home-label";

/** The steps in the board's own words. The policy keeps its legal names. */
const STEP: Record<CollectionStage, string> = {
  // Behind, but not yet at the reminder day. It said "Current" beside
  // "9 days late", and the table under it said "In grace" for the same home.
  current: "In grace",
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
  const placeLabel = useHomeLabel();
  const { community } = useAppState();
  const policy = policyFor(community.settings);
  const ladder = collectionsLadder(community, policy);

  if (ladder.rows.length === 0) {
    return (
      <Card className="mt-6 p-5">
        <p className="text-body font-semibold text-fg">Everybody is current</p>
        <p className="mt-1 text-body text-fg-muted">
          Nothing to chase. The ladder starts at {policy.reminderDay} days past due.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      {/* The title counts the list under it. The count that needs a notice
          today is a subset, so it is the subtitle, not the headline. */}
      <CardHeader
        title={`${pluralize(ladder.rows.length, "household")} behind`}
        subtitle={`${
          ladder.dueNow.length
            ? `${ladder.dueNow.length} ${ladder.dueNow.length === 1 ? "needs" : "need"} a notice today`
            : "No notice owed today"
        }. ${money(ladder.totalCents)} outstanding.`}
        action={
          ladder.dueNow.length ? (
            <ButtonLink href="/board/homeowners?remind=1" variant="primary" size="md">
              <Mail className="size-3.5" />
              Send reminders
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="divide-y divide-border">
        {ladder.rows.map((row) => (
          <div key={row.owner.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
            {/* At least 12rem for the name and the step, so on a phone the
                amount and the badge wrap under them rather than squeezing
                the text to a word per line. */}
            <div className="min-w-[12rem] flex-1">
              <p className="truncate text-body font-medium text-fg">
                {row.owner.displayName}
                <span className="ml-2 text-footnote font-normal text-fg-muted">
                  {placeLabel(row.owner.unit)}
                </span>
              </p>
              <p className="mt-0.5 text-footnote leading-snug text-fg-muted">
                {pluralize(row.owner.daysPastDue, "day")} late ·{" "}
                {/* The day this step's letter went, so "nothing owed today"
                    can be seen to be because it was sent. */}
                {row.sentOn ? `Sent ${formatDate(row.sentOn)} · ` : ""}
                {row.actionDue
                  ? row.stage === "late-notice" && policy.lateFeeCents <= 0
                    ? "Send the notice"
                    : ACTION[row.stage]
                  : row.daysToNext !== undefined
                    ? `${STEP[row.nextStage!]} in ${pluralize(row.daysToNext, "day")}`
                    : "Nothing due"}
              </p>
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-3">
              <span className="tnum text-body font-semibold text-fg">
                {money(row.owner.balanceCents)}
              </span>
              <Badge tone={TONE[row.stage]}>{STEP[row.stage]}</Badge>
            </span>
          </div>
        ))}
      </div>

      {ladder.skipped.length ? (
        <div className="flex items-start gap-3 border-t border-border bg-warn-soft px-5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="text-footnote leading-relaxed text-fg">
            {pluralize(ladder.skipped.length, "account")} passed the final notice step with no
            notice on record. Send what is missing before going further.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
