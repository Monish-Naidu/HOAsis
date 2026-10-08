"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Select } from "@/components/ui/primitives";
import {
  PrintRegion,
  printStatements,
  StatementPrint,
  YearSelect,
} from "@/components/app/statement-print";
import { useAppState } from "@/lib/app-state";
import { statementFor, statementYears } from "@/lib/statement";
import { homeLabel } from "@/lib/wording";
import { formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

type Show = "all" | "balance";

/**
 * Every home's statement for a year, to print one at a time or all at once.
 * Asked for at tax time and at every sale. Everything is read from the
 * register and the statement lines, so the demo and a real association agree.
 */
export function StatementsScreen() {
  const { community } = useAppState();
  const years = statementYears(community, todayIsoDate());
  const [chosen, setChosen] = useState<number | null>(null);
  const [show, setShow] = useState<Show>("all");
  // The homes being printed, set just before the dialog opens.
  const [printing, setPrinting] = useState<string[] | null>(null);
  const year = chosen !== null && years.includes(chosen) ? chosen : years[0];

  const all = useMemo(
    () => community.homes.map((home) => ({ home, statement: statementFor(community, home.id, year) })),
    [community, year],
  );
  const shown = show === "balance" ? all.filter((r) => r.statement.closingCents !== 0) : all;
  const periodLabel = all[0]?.statement.periodLabel ?? String(year);
  // A real association loads two years of lines; the rest is summed.
  const linesBegin = all.map((r) => r.statement.linesBegin).filter((d): d is string => d !== null).sort()[0];

  useEffect(() => {
    if (!printing) return;
    // One frame for the statements to render before the dialog freezes the page.
    const frame = requestAnimationFrame(() => printStatements(() => setPrinting(null)));
    return () => cancelAnimationFrame(frame);
  }, [printing]);

  const printed = printing ? all.filter((r) => printing.includes(r.home.id)) : [];

  return (
    <>
      <PageHeader title="Statements" description="A statement for each home for a year. Print one, or all of them." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <YearSelect years={years} value={year} onChange={setChosen} />
        <Select
          size="sm"
          value={show}
          onChange={(e) => setShow(e.target.value as Show)}
          aria-label="Which homes"
        >
          <option value="all">All homes</option>
          <option value="balance">Homes with a balance</option>
        </Select>
        <p className="text-footnote text-fg-muted" aria-live="polite">
          {pluralize(shown.length, "statement")} for {periodLabel}
        </p>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          disabled={shown.length === 0 || printing !== null}
          onClick={() => setPrinting(shown.map((r) => r.home.id))}
        >
          <Printer className="size-3.5" />
          Print all
        </Button>
      </div>

      {linesBegin ? (
        <p className="mb-4 rounded-md bg-warn-soft px-3 py-2 text-footnote font-medium text-warn">
          Lines before {formatDate(linesBegin, "long")} are summed; load earlier on{" "}
          <Link href="/board/money/transactions" className="underline">
            Transactions
          </Link>
          . Until then some opening balances and totals here are incomplete.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState title="No statements to show" description="No home has a balance for this period." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-footnote">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Home</th>
                <th className="px-4 py-2.5 text-right font-semibold">Brought forward</th>
                <th className="px-4 py-2.5 text-right font-semibold">Billed</th>
                <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Print</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map(({ home, statement: s }) => (
                <tr key={home.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-fg">{homeLabel(community, home.unit)}</p>
                    <p className="text-fg-muted">{home.displayName}</p>
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-fg-muted">{money(s.openingCents)}</td>
                  <td className="tnum px-4 py-2.5 text-right">{money(s.billedCents)}</td>
                  <td className="tnum px-4 py-2.5 text-right">{money(s.paidCents)}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-fg">{money(s.closingCents)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={printing !== null}
                      onClick={() => setPrinting([home.id])}
                      aria-label={`Print the statement for ${homeLabel(community, home.unit)}`}
                    >
                      Print
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {printing ? (
        <PrintRegion>
          {printed.map(({ home }) => (
            <StatementPrint key={home.id} community={community} home={home} year={year} />
          ))}
        </PrintRegion>
      ) : null}
    </>
  );
}
