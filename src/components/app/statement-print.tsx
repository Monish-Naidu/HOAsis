"use client";

import { useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button, Select } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Community } from "@/lib/data/community";
import { statementFor, statementPeriodLabel, statementYears } from "@/lib/statement";
import type { Home } from "@/lib/types";
import { homeLabel } from "@/lib/wording";
import { formatDate, money, todayIsoDate } from "@/lib/utils";

/**
 * Prints what is inside a `PrintRegion`. The page is not swapped for the
 * statement (it lives inside the app shell), so the body is marked and the
 * print block in globals.css hides everything that is not the region. The mark
 * comes off when the dialog closes, whether the owner printed or cancelled.
 */
export function printStatements(onDone?: () => void) {
  document.body.dataset.printing = "statement";
  const finish = () => {
    delete document.body.dataset.printing;
    window.removeEventListener("afterprint", finish);
    onDone?.();
  };
  window.addEventListener("afterprint", finish);
  window.print();
}

/** Hidden on screen, the only thing painted on paper while a statement prints. */
export function PrintRegion({ children }: { children: ReactNode }) {
  return <div className="print-statement">{children}</div>;
}

const num = "tabular-nums text-right whitespace-nowrap";

/** Signed, so a credit balance reads as one. */
function balance(cents: number) {
  return cents < 0 ? `${money(cents)} credit` : money(cents);
}

/**
 * One home's statement for one year, plain black on white so it reads on
 * screen and prints on one or two pages. Fixed colors on purpose: paper has no
 * theme.
 */
export function StatementPrint({ community, home, year }: { community: Community; home: Home; year: number }) {
  const association = community.association;
  const s = statementFor(community, home.id, year);
  const people = home.members.length > 0 ? home.members.join(" and ") : home.displayName;
  const prepared = formatDate(todayIsoDate(), "long");
  return (
    <section className="statement-sheet bg-white p-6 text-[13px] leading-snug text-black">
      <header className="border-b border-black pb-3">
        <h1 className="text-xl font-semibold">{association.name}</h1>
        {association.addressLine ? <p>{association.addressLine}</p> : null}
        <p className="mt-2 text-base font-semibold">Statement of account</p>
        <p>
          {s.periodLabel === String(year) ? `${formatDate(s.from, "long")} to ${formatDate(s.to, "long")}` : s.periodLabel}
        </p>
      </header>

      <div className="mt-3">
        <p className="font-semibold">{homeLabel(community, home.unit)}</p>
        <p>{home.address}</p>
        <p>{people}</p>
      </div>

      {s.linesBegin ? (
        <p className="mt-3 border border-black p-2">
          Lines before {formatDate(s.linesBegin, "long")} are not on this page, so the opening balance and
          totals are incomplete.
        </p>
      ) : null}

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2 font-semibold">Date</th>
            <th className="py-1 pr-2 font-semibold">Description</th>
            <th className={`py-1 pl-2 font-semibold ${num}`}>Charge</th>
            <th className={`py-1 pl-2 font-semibold ${num}`}>Payment</th>
            <th className={`py-1 pl-2 font-semibold ${num}`}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black/30">
            <td className="py-1 pr-2">{formatDate(s.from)}</td>
            <td className="py-1 pr-2">Balance brought forward</td>
            <td />
            <td />
            <td className={`py-1 pl-2 ${num}`}>{balance(s.openingCents)}</td>
          </tr>
          {s.rows.map((r) => (
            <tr key={r.id} className="break-inside-avoid border-b border-black/30">
              <td className="py-1 pr-2 whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="py-1 pr-2">
                {r.label}
                {r.method ? `, ${r.method}` : ""}
              </td>
              <td className={`py-1 pl-2 ${num}`}>{r.chargeCents ? money(r.chargeCents) : ""}</td>
              <td className={`py-1 pl-2 ${num}`}>{r.paymentCents ? money(r.paymentCents) : ""}</td>
              <td className={`py-1 pl-2 ${num}`}>{balance(r.balanceCents)}</td>
            </tr>
          ))}
          {s.rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-2">
                Nothing was billed or paid in this period.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto w-64 break-inside-avoid">
        {[
          [`Billed in ${s.periodLabel}`, money(s.billedCents)],
          [`Paid in ${s.periodLabel}`, money(s.paidCents)],
          ...(s.creditedCents ? [["Credits", money(s.creditedCents)]] : []),
          ["Balance brought forward", balance(s.openingCents)],
          ["Balance at end of period", balance(s.closingCents)],
        ].map(([label, value], i, all) => (
          <div key={label} className={`flex justify-between gap-4 py-0.5 ${i === all.length - 1 ? "border-t border-black font-semibold" : ""}`}>
            <dt>{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <footer className="mt-6 text-[11px]">Prepared {prepared}</footer>
    </section>
  );
}

/** The year choices for one home or, with no home, for the whole association. */
export function YearSelect({
  years,
  value,
  onChange,
  label = "Statement year",
}: {
  years: readonly number[];
  value: number;
  onChange: (year: number) => void;
  label?: string;
}) {
  const { community } = useAppState();
  const fy = community.association.fiscalYearStart;
  return (
    <Select size="sm" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {years.map((y) => (
        <option key={y} value={y}>
          {statementPeriodLabel(fy, y)}
        </option>
      ))}
    </Select>
  );
}

/**
 * A year to choose and a button that prints that year's statement for `home`.
 * The statement is only rendered while it prints, so a long list of homes
 * costs nothing until someone asks.
 */
export function PrintStatementControl({ home, className }: { home: Home; className?: string }) {
  const { community } = useAppState();
  const years = statementYears(community, todayIsoDate(), home.id);
  const [chosen, setChosen] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);
  const year = chosen !== null && years.includes(chosen) ? chosen : years[0];
  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      <YearSelect years={years} value={year} onChange={setChosen} />
      <Button
        variant="secondary"
        size="sm"
        disabled={printing}
        onClick={() => {
          setPrinting(true);
          // One frame for the statement to render before the dialog freezes the page.
          requestAnimationFrame(() => printStatements(() => setPrinting(false)));
        }}
      >
        <Printer className="size-3.5" />
        Print statement
      </Button>
      {printing ? (
        <PrintRegion>
          <StatementPrint community={community} home={home} year={year} />
        </PrintRegion>
      ) : null}
    </div>
  );
}
