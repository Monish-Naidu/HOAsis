"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/primitives";
import { useHomeLabel } from "@/components/app/use-home-label";
import { useAppState } from "@/lib/app-state";
import {
  failureMonths,
  failuresToShow,
  triedLine,
  type AutopayFailure,
} from "@/lib/payments/autopay-failures";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDate, money, todayIsoDate } from "@/lib/utils";

/**
 * The association's failed autopay runs for this month and last, signed in
 * only. Read once when the screen mounts, straight from `autopay_runs`: row
 * level security already lets finance holders see the table, and the board
 * never loads it anywhere else. The state is keyed by association, so a
 * stale answer for another association is never shown, and nothing is set
 * synchronously inside the effect.
 */
export function useAutopayFailures(): AutopayFailure[] {
  const { community, isRemote } = useAppState();
  const associationId = isRemote ? community.association.id : null;
  const [loaded, setLoaded] = useState<{ associationId: string; rows: AutopayFailure[] } | null>(null);

  useEffect(() => {
    if (!associationId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseBrowser()
        .from("autopay_runs")
        .select("unit_id, month, amount_cents, reason, attempts, last_attempt_on")
        .eq("association_id", associationId)
        .eq("state", "failed")
        .in("month", failureMonths(todayIsoDate()))
        .order("month", { ascending: false })
        .order("last_attempt_on", { ascending: false });
      // A failed read leaves the card out. It is a hint, not a ledger.
      if (cancelled || error || !data) return;
      setLoaded({
        associationId,
        rows: data.map((r) => ({
          unitId: r.unit_id,
          month: r.month,
          amountCents: r.amount_cents,
          reason: r.reason,
          attempts: r.attempts,
          lastAttemptOn: r.last_attempt_on,
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [associationId]);

  return loaded && loaded.associationId === associationId ? loaded.rows : EMPTY;
}

const EMPTY: AutopayFailure[] = [];

/** One card above the past-due list, only when autopay has failed for someone. */
export function AutopayFailuresCard({ failures }: { failures: AutopayFailure[] }) {
  const { community } = useAppState();
  const placeLabel = useHomeLabel();
  const shown = failuresToShow(failures, todayIsoDate());
  if (shown.length === 0) return null;
  const homes = new Map(community.homes.map((o) => [o.id, o]));

  return (
    <Card className="mt-6">
      <CardHeader
        title="Autopay did not go through"
        subtitle="The owner was emailed each time. Autopay tries again once they add a new card or bank account."
      />
      <ul className="divide-y divide-border">
        {shown.map((f) => {
          const home = homes.get(f.unitId);
          return (
            <li key={`${f.unitId}-${f.month}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="truncate text-body font-medium text-fg">
                  {home ? placeLabel(home.unit) : "A home"}
                  {home ? (
                    <Link
                      href={`/board/homeowners?open=${home.id}`}
                      className="ml-2 text-footnote font-normal text-brand hover:underline"
                    >
                      {home.displayName}
                    </Link>
                  ) : null}
                </p>
                <p className="mt-0.5 text-footnote leading-snug text-warn">
                  {f.reason ?? "The payment did not go through"}
                </p>
                <p className="text-footnote leading-snug text-fg-muted">
                  {triedLine(f, (d) => formatDate(d))}
                </p>
              </div>
              <span className="tnum ml-auto shrink-0 text-body font-semibold text-fg">
                {money(f.amountCents)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
