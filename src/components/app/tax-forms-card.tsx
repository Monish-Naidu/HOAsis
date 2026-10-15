"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { downloadCsv } from "@/lib/core/export";
import { recordsCsv } from "@/lib/records/pack";
import {
  TAX_FORM_THRESHOLD_CENTS,
  taxYearSummedFrom,
  taxYears,
  vendorTaxFile,
  vendorTaxRows,
} from "@/lib/records/vendor-tax";
import { formatDate, money, pluralize } from "@/lib/utils";

/**
 * The 1099-NEC list: who the association paid $600 or more in a calendar year.
 *
 * The $600 line is the IRS's and it is a calendar year, so this card never
 * mentions the fiscal year. What it does is name the vendors and say whether
 * each one's W-9 is on file, which is the whole of what a treasurer needs in
 * January. It does not file anything and does not claim to: a product that
 * promises a filing it does not make is worse than a list.
 *
 * The payment totals come from the ledger, by the same selector the vendor
 * rows above use, so the two cannot disagree.
 */
export function TaxFormsCard({ className }: { className?: string }) {
  const { community } = useAppState();
  const { notify } = useToast();
  const years = taxYears(community);
  const [chosen, setChosen] = useState<number | null>(null);
  // No year at all is an association that has paid nobody: there is nothing to
  // pick and nothing to name, and "0 vendors on the undefined list" is worse
  // than saying so plainly.
  const year: number | undefined = chosen !== null && years.includes(chosen) ? chosen : years[0];
  const rows = year === undefined ? [] : vendorTaxRows(community, year);
  const missing = rows.filter((row) => !row.w9OnFile);
  const paid = rows.reduce((total, row) => total + row.paidCents, 0);
  // The months the server summed, when this year reaches back further than the
  // lines the app holds. Nothing can be named out of a summed month.
  const summedFrom = year === undefined ? null : taxYearSummedFrom(community, year);

  function download() {
    if (year === undefined) return;
    const file = vendorTaxFile(community, year);
    downloadCsv(file.name, recordsCsv(file));
    notify(`Downloaded ${file.name}`);
  }

  if (year === undefined) {
    return (
      <Card data-testid="tax-forms" className={className}>
        <CardHeader
          title="Tax forms"
          subtitle={`Vendors paid ${money(TAX_FORM_THRESHOLD_CENTS)} or more in a calendar year`}
        />
        <EmptyState
          title="Nothing has been paid from the books yet"
          description={`A vendor appears here once a year's payments to them reach ${money(TAX_FORM_THRESHOLD_CENTS)}.`}
        />
        <p className="border-t border-border px-5 py-3 text-footnote text-fg-muted">
          Your HOAsis lists who to file for and whether their W-9 is on file. It does not file
          anything, so send the forms yourself.
        </p>
      </Card>
    );
  }

  return (
    <Card data-testid="tax-forms" className={className}>
      <CardHeader
        title="Tax forms"
        subtitle={`Vendors paid ${money(TAX_FORM_THRESHOLD_CENTS)} or more in a calendar year`}
        action={
          rows.length ? (
            <Button variant="secondary" size="sm" onClick={download}>
              <Download className="size-3.5" />
              CSV
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        {years.length > 1 ? (
          <Select
            size="sm"
            value={year}
            onChange={(e) => setChosen(Number(e.target.value))}
            aria-label="Tax year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        ) : null}
        <p className="text-footnote text-fg-muted" aria-live="polite">
          {pluralize(rows.length, "vendor")} on the {year} list, {money(paid)} paid
          {missing.length ? `, ${missing.length} with no W-9` : ""}
        </p>
      </div>

      {/* The W-9 warning for the year is on the screen above, so this says only
          what the list itself cannot: a year whose early months are summed has
          no counterparties to name, and saying nothing would read as a year in
          which nobody was paid. */}
      {summedFrom ? (
        <p className="border-b border-border px-5 py-3 text-footnote text-fg-muted">
          The books before {formatDate(summedFrom, "long")} are kept as monthly totals, so a vendor
          paid only before then is not on this list.
        </p>
      ) : null}

      {rows.length === 0 && !summedFrom ? (
        <EmptyState
          title={`Nobody was paid ${money(TAX_FORM_THRESHOLD_CENTS)} or more in ${year}`}
          description="A vendor appears here once the year's payments to them reach $600."
        />
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.vendorId} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-fg">{row.name}</p>
                <p className="truncate text-footnote text-fg-muted">{row.service}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.w9OnFile ? (
                  <Badge tone="neutral">W-9</Badge>
                ) : (
                  <Badge tone="danger" dot={false}>
                    No W-9
                  </Badge>
                )}
                <span className="tnum text-body font-semibold text-fg">{money(row.paidCents)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="border-t border-border px-5 py-3 text-footnote text-fg-muted">
        Your HOAsis lists who to file for and whether their W-9 is on file. It does not file
        anything, so send the forms yourself.
      </p>
    </Card>
  );
}
