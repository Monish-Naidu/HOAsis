"use client";

import { Card, CardHeader, Meter, PageHeader } from "@/components/ui/primitives";
import { CollectionsLadder } from "@/components/app/collections-ladder";
import { CollectionPolicyCard } from "@/components/app/collection-policy";
import { AgingBar } from "@/components/app/board-charts";
import { StatTile } from "@/components/app/finance-ui";
import { AutopayFailuresCard, useAutopayFailures } from "./autopay-failures-card";
import { failedThisMonth } from "@/lib/payments/autopay-failures";
import { useAppState } from "@/lib/app-state";
import { agingBuckets, delinquency, duesCollection, lateFeesOwed, pastDueHint } from "@/lib/metrics";
import { formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

/**
 * Who is behind, by how much, for how long, and what the policy says to do
 * about it today. The ladder does the doing; this page is the picture.
 */
export function CollectionsScreen() {
  const { community } = useAppState();
  const thisYear = Number(todayIsoDate().slice(0, 4));
  const delinq = delinquency(community);
  const aging = agingBuckets(community);
  const dues = duesCollection(community, thisYear);
  // Signed in only; the demo has no autopay_runs and gets an empty list.
  const failures = useAutopayFailures();

  return (
    <>
      <PageHeader
        title="Past due"
        description="Past due balances and the next notice for each."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Households current"
          value={`${Math.round(delinq.collectionRate * 100)}%`}
          tone={delinq.collectionRate >= 0.95 ? "ok" : undefined}
          hint={`${delinq.current} of ${pluralize(delinq.households, "household")}`}
        />
        <StatTile
          label="Past due"
          value={money(aging.pastDueCents, { cents: false })}
          tone={aging.pastDueCount ? "warn" : undefined}
          hint={pastDueHint(aging.pastDueCount, lateFeesOwed(community))}
        />
        <StatTile
          label="On autopay"
          value={`${Math.round(delinq.autopayRate * 100)}%`}
          hint="Households paying automatically"
        />
        <StatTile
          label={`Dues collected, ${thisYear}`}
          value={dues.measurable ? `${Math.round(dues.rate * 100)}%` : "None billed"}
          hint={
            dues.measurable
              ? `${money(dues.collectedYtd, { cents: false })} of ${money(dues.expectedYtd, { cents: false })} billed`
              : community.association.duesCents > 0
                ? `First bill ${formatDate(community.nextChargeDate, "long")}`
                : "Set dues in Settings to measure this"
          }
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Past due by age" subtitle="Bar width is dollars owed. Households are counted under each age." />
        <AgingBar buckets={aging.buckets} />
      </Card>

      <AutopayFailuresCard failures={failures} />

      <CollectionsLadder autopayFailedUnits={failedThisMonth(failures, todayIsoDate())} />

      {/* The ladder is the list of who is behind and what is owed them; the
          table of past-due households that sat here said it again. */}
      <Card className="mt-6">
        <CardHeader title={community.association.duesCadence === "monthly" ? "Dues by month" : "Dues by bill"} subtitle={dues.measurable ? `${thisYear}, collected against billed` : "Nothing billed yet"} />
        {dues.measurable ? (
          <ul className="divide-y divide-border">
            {[...dues.months].reverse().map((m) => (
              <li key={m.label} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3 text-footnote">
                  <span className="font-medium text-fg">{m.label}</span>
                  <span className="tnum text-fg-muted">
                    <span className="font-semibold text-fg">{money(m.collectedCents, { cents: false })}</span> of{" "}
                    {money(m.expectedCents, { cents: false })} · {Math.round(m.rate * 100)}%
                  </span>
                </div>
                <Meter
                  value={m.rate}
                  tone={m.rate >= 0.95 ? "ok" : "warn"}
                  className="mt-1.5"
                  aria-label={`${m.label}, ${Math.round(m.rate * 100)}% collected`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-body text-fg-muted">Dues appear here once the first month is billed.</p>
        )}
      </Card>

      <CollectionPolicyCard />
    </>
  );
}
