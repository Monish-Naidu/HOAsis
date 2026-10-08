"use client";

import { useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import type { FiscalYear } from "@/lib/data/community";
import { formatDate, money } from "@/lib/utils";

/**
 * The fiscal years that have been closed (migration 0109).
 *
 * A closed year is read from its row, so a report run in March and again
 * in June agree about January. The daily job closes a year the morning
 * after it ends; a board that finds a receipt reopens it with a reason,
 * posts, and closes it again here (or the job does next morning). Only
 * real associations have rows: the demo shows nothing.
 */
export function ClosedYears() {
  const { community, reopenFiscalYear, closeFiscalYear } = useAppState();
  const years = community.fiscalYears ?? [];
  if (years.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader
        title="Closed years"
        subtitle="A closed year's figures do not move. Reopen one to post a correction, then close it again."
      />
      <ul className="divide-y divide-border">
        {years.map((year) => (
          <ClosedYearRow key={year.startsOn} year={year} onReopen={reopenFiscalYear} onClose={closeFiscalYear} />
        ))}
      </ul>
    </Card>
  );
}

function yearName(year: FiscalYear): string {
  const start = year.startsOn.slice(0, 4);
  const end = year.endsOn.slice(0, 4);
  return start === end ? start : `${start} to ${end}`;
}

function ClosedYearRow({
  year,
  onReopen,
  onClose,
}: {
  year: FiscalYear;
  onReopen: (startsOn: string, reason: string) => boolean | Promise<boolean>;
  onClose: (startsOn: string) => boolean | Promise<boolean>;
}) {
  const { notify } = useToast();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const open = Boolean(year.reopenedOn);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-body font-semibold text-fg">
            {yearName(year)}
            <span className="ml-2 text-footnote font-normal text-fg-muted">
              {formatDate(year.startsOn, "medium")} to {formatDate(year.endsOn, "medium")}
            </span>
          </p>
          <p className="tnum text-footnote text-fg-muted">
            {money(year.inCents, { cents: false })} in, {money(year.outCents, { cents: false })} out ·{" "}
            {money(year.billedCents, { cents: false })} billed, {money(year.collectedCents, { cents: false })} collected
          </p>
          <p className="text-caption text-fg-subtle">
            {open
              ? `Reopened ${formatDate(year.reopenedOn!, "medium")}: ${year.reopenReason ?? ""}`
              : `Closed ${formatDate(year.closedOn, "medium")}${year.closedBy ? "" : " by the daily job"}`}
          </p>
        </div>
        {open ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onClose(year.startsOn);
              setBusy(false);
              if (ok) notify(`${yearName(year)} is closed again with the corrected figures.`);
            }}
          >
            Close the year again
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAsking((v) => !v)}>
            Reopen
          </Button>
        )}
      </div>
      {asking && !open ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (reason.trim().length < 3) return;
            setBusy(true);
            const ok = await onReopen(year.startsOn, reason);
            setBusy(false);
            if (ok) {
              notify(`${yearName(year)} is open for corrections. Close it again when they are posted.`);
              setAsking(false);
              setReason("");
            }
          }}
        >
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-footnote font-semibold text-fg-muted">Why it is being reopened</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="A receipt dated in this year turned up"
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body text-fg"
            />
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={busy || reason.trim().length < 3}>
            Reopen the year
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
            Keep it closed
          </Button>
        </form>
      ) : null}
    </li>
  );
}
