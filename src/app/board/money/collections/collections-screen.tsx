"use client";

import { Badge, Card, CardHeader, Meter, PageHeader } from "@/components/ui/primitives";
import { MoneyTabs } from "@/components/app/money-tabs";
import { CollectionsLadder } from "@/components/app/collections-ladder";
import { CollectionPolicyCard } from "@/components/app/collection-policy";
import { AgingBar } from "@/components/app/board-charts";
import { SectionLink, StatTile } from "@/components/app/finance-ui";
import { useAppState } from "@/lib/app-state";
import { agingBuckets, delinquency, duesCollection } from "@/lib/metrics";
import { money, pluralize, todayIsoDate } from "@/lib/utils";

const STANDING_TONE = {
  current: "ok",
  grace: "neutral",
  late: "warn",
  collections: "danger",
} as const;

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
  const pastDue = [...delinq.past].sort((x, y) => y.daysPastDue - x.daysPastDue);

  return (
    <>
      <MoneyTabs />
      <PageHeader
        title="Collections"
        description="Who is behind, by how much, and the next step the policy owes each of them."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Households current"
          value={`${Math.round(delinq.collectionRate * 100)}%`}
          tone={delinq.collectionRate >= 0.95 ? "ok" : undefined}
          hint={`${community.owners.length - delinq.past.length} of ${pluralize(community.owners.length, "household")}`}
        />
        <StatTile
          label="Past due"
          value={money(aging.pastDueCents, { cents: false })}
          tone={aging.pastDueCount ? "warn" : undefined}
          hint={pluralize(aging.pastDueCount, "household")}
        />
        <StatTile
          label="On autopay"
          value={`${Math.round(delinq.autopayRate * 100)}%`}
          hint="Autopay is the collection policy that never needs enforcing"
        />
        <StatTile
          label={`Dues collected, ${thisYear}`}
          value={dues.measurable ? `${Math.round(dues.rate * 100)}%` : "None billed"}
          hint={
            dues.measurable
              ? `${money(dues.collectedYtd, { cents: false })} of ${money(dues.expectedYtd, { cents: false })} billed`
              : "Set dues in Settings to measure this"
          }
        />
      </div>

      <Card className="mt-5">
        <CardHeader
          title="How old it is"
          subtitle="Every balance on the roster, by days past due. Current includes what is not due yet."
        />
        <AgingBar buckets={aging.buckets} />
      </Card>

      <CollectionsLadder />

      <CollectionPolicyCard />

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Past-due households"
            subtitle={pastDue.length ? `${pastDue.length} behind, longest first` : "Nobody is behind"}
            action={<SectionLink href="/board/homeowners">All homeowners</SectionLink>}
          />
          {pastDue.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                    <th className="px-5 py-2.5 font-semibold">Household</th>
                    <th className="px-3 py-2.5 font-semibold">Standing</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Days</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {pastDue.map((o) => (
                    <tr key={o.id} className="border-b border-border text-[15px] last:border-b-0 hover:bg-surface-2">
                      <td className="px-5 py-2.5">
                        <span className="block font-medium text-fg">{o.displayName}</span>
                        <span className="text-[13px] text-fg-subtle">
                          Unit {o.unit}
                          {o.autopay ? " · autopay" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={STANDING_TONE[o.standing]}>{o.standing}</Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-right text-fg-muted">{o.daysPastDue}</td>
                      <td className="tnum px-5 py-2.5 text-right font-semibold text-fg">{money(o.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-6 text-[15px] text-fg-muted">Every household is current.</p>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Dues by month" subtitle={dues.measurable ? `${thisYear}, collected against billed` : "Nothing billed yet"} />
          {dues.measurable ? (
            <ul className="divide-y divide-border">
              {[...dues.months].reverse().map((m) => (
                <li key={m.month} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
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
            <p className="px-5 py-6 text-[15px] text-fg-muted">Dues appear here once the first month is billed.</p>
          )}
        </Card>
      </div>
    </>
  );
}
