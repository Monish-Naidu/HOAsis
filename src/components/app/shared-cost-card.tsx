"use client";

import { Term } from "@/components/app/term";
import { Droplets, Flame, HandCoins, Plug, Trash2, Waves, Wifi } from "lucide-react";
import { Card, Meter, SectionTitle } from "@/components/ui/primitives";
import { assessmentProgress, sharedCostSummary } from "@/lib/metrics";
import type { Community } from "@/lib/data/community";
import type { SharedCostKind } from "@/lib/types";
import { money, shortMoney } from "@/lib/utils";

const ICON: Record<SharedCostKind, typeof Droplets> = {
  water: Droplets,
  sewer: Waves,
  trash: Trash2,
  gas: Flame,
  electric: Plug,
  internet: Wifi,
  other: HandCoins,
};

/**
 * What the association pays on an owner's behalf.
 *
 * The association is the customer of record for the shared water meter and the
 * waste contract, so an owner has no bill to look at and no account to log in
 * to. They pay for it inside their dues and have no way to check the figure.
 * This is that figure, next to the provider's name, which is the part that
 * turns "dues went up again" into a question somebody can answer.
 *
 * Renders nothing when there is nothing shared, which is most associations.
 */
export function SharedCostCard({ community }: { community: Community }) {
  const shared = sharedCostSummary(community);
  const assessments = assessmentProgress(community);
  if (!shared.enabled && !assessments.enabled) return null;

  return (
    <div className="space-y-4">
      {shared.enabled ? (
        <div>
          <SectionTitle>Paid on your behalf</SectionTitle>
          <Card className="mt-3 divide-y divide-border">
            {shared.rows.map((row) => {
              const Icon = ICON[row.cost.kind];
              return (
                <div key={row.cost.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-fg">{row.cost.name}</p>
                    <p className="truncate text-footnote text-fg-muted">{row.cost.provider}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-body font-semibold text-fg">
                      {money(row.latest?.averageShareCents ?? 0)}
                    </p>
                    <p className="text-footnote text-fg-muted">your share</p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-body text-fg-muted">
                The community pays {money(shared.monthlyCents)} a month
              </p>
              <p className="tnum text-body font-semibold text-fg">
                {money(shared.perHomeMonthlyCents)}
              </p>
            </div>
          </Card>
        </div>
      ) : null}

      {assessments.active.length > 0 ? (
        <div>
          <SectionTitle>
            <Term k="special-assessment">Special assessment</Term>
          </SectionTitle>
          {assessments.active.map((row) => (
            <Card key={row.assessment.id} className="mt-3 p-4">
              <p className="text-body font-semibold text-fg">{row.assessment.title}</p>
              <p className="mt-1 text-footnote leading-relaxed text-fg-muted">
                {row.assessment.reason}
              </p>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <p className="tnum text-body font-semibold text-fg">
                  {shortMoney(row.collectedCents)}
                  <span className="font-normal text-fg-muted">
                    {" "}
                    of {shortMoney(row.assessment.totalCents)} collected
                  </span>
                </p>
                <p className="tnum text-footnote text-fg-muted">
                  {row.installmentsLeft} payments left
                </p>
              </div>
              <Meter
                value={row.percent}
                className="mt-2"
                aria-label={`${Math.round(row.percent * 100)}% collected`}
              />
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
