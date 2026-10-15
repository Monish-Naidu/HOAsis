"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, Download, FileArchive, Lock } from "lucide-react";
import { Badge, Button, Callout, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { YearSelect } from "@/components/app/statement-print";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { annualRecordsRows } from "@/lib/data/remote-store";
import { downloadCsv, downloadZip } from "@/lib/core/export";
import { annualRecordsFiles, annualYears } from "@/lib/records/annual";
import { recordsCsv, recordsReadme, recordsZip, recordsZipName } from "@/lib/records/pack";
import { yearRecordsFromCommunity, type YearRecords } from "@/lib/records/rows";
import { statementPeriod, statementPeriodLabel } from "@/lib/statement";
import { money, pluralize, todayIsoDate } from "@/lib/utils";

/**
 * One fiscal year of the association's records, one file per area.
 *
 * This is the request a board actually gets: an owner asking to inspect last
 * year, an accountant wanting one year's books, a buyer's lender wanting the
 * year the sale falls in. Each file's totals are read by the same selectors
 * the matching screen reads, so a figure here and the figure on Statements or
 * Transactions are the same number, and the integration test pins it.
 *
 * A year of a real association is more lines than any screen loads, so the
 * rows are read for the chosen year, under this person's own session: what
 * row level security will not give them, they are told about rather than
 * handed an empty file.
 */
export function AnnualRecordsScreen() {
  const { community, account, isRemote, sees } = useAppState();
  const { notify } = useToast();
  const years = annualYears(community);
  const [chosen, setChosen] = useState<number | null>(null);
  const year = chosen !== null && years.includes(chosen) ? chosen : years[0];
  const period = statementPeriod(community.association.fiscalYearStart, year);

  // The demo holds every line, so a year is a filter and there is nothing to
  // wait for. Signed in, the year is read once and kept, and the read lands
  // after a paint, which is why it lives in a store rather than in state.
  const demoRows = useMemo(
    () => (isRemote ? null : yearRecordsFromCommunity(community, period)),
    [community, period, isRemote],
  );
  const read = useSyncExternalStore(subscribeYear, yearSnapshot, () => NO_READ);
  useEffect(() => {
    if (isRemote) void readYear(community.id, year);
  }, [isRemote, community.id, year]);
  const rows: YearRecords | null =
    demoRows ?? (read.associationId === community.id && read.year === year ? read.rows : null);

  if (rows === null) {
    return (
      <>
        <PageHeader title="Annual records" description="One year of records, one file per area." />
        <Card className="px-5 py-8">
          <p className="flex items-center gap-2 text-body text-fg-muted" aria-live="polite">
            {read.failed ? (
              <>
                <AlertTriangle className="size-4 shrink-0 text-warn" />
                Could not read {statementPeriodLabel(community.association.fiscalYearStart, year)}.
                Nothing was downloaded.
              </>
            ) : (
              `Reading ${statementPeriodLabel(community.association.fiscalYearStart, year)}...`
            )}
          </p>
          {read.failed ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void readYear(community.id, year, true)}
            >
              Try again
            </Button>
          ) : null}
        </Card>
      </>
    );
  }

  const files = annualRecordsFiles(community, year, rows);
  const withheld = files.filter(
    (file) => file.capabilities && !file.capabilities.some((c) => sees(c)),
  );
  const periodLabel = statementPeriodLabel(community.association.fiscalYearStart, year);
  const generatedOn = todayIsoDate();

  function readme() {
    return recordsReadme(community, files, {
      generatedOn,
      period: periodLabel,
      unreadable: withheld.map((file) => file.title),
      ...(account?.name ? { by: account.name } : {}),
    });
  }

  function downloadOne(id: string) {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    downloadCsv(file.name, recordsCsv(file));
    notify(`Downloaded ${file.name}`);
  }

  function downloadYear() {
    downloadZip(
      recordsZipName(community, generatedOn, year),
      recordsZip(files, readme(), generatedOn),
    );
    notify(`Downloaded ${files.length} files for ${year}`);
  }

  return (
    <>
      <PageHeader
        title="Annual records"
        description="A year of the association's records, one file per area. The totals are the ones the screens show."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <YearSelect years={years} value={year} onChange={setChosen} label="Records year" />
        <p className="text-footnote text-fg-muted" aria-live="polite">
          {pluralize(files.length, "file")} for {periodLabel},{" "}
          {pluralize(
            files.reduce((t, f) => t + f.rows.length, 0),
            "row",
          )}
        </p>
        <Button variant="primary" size="sm" className="ml-auto" onClick={downloadYear}>
          <FileArchive className="size-3.5" />
          Download the year
        </Button>
      </div>

      {withheld.length ? (
        <Callout
          tone="info"
          icon={<Lock className="size-4" />}
          title="Some areas are not yours to read"
          className="mb-4"
        >
          {withheld.map((file) => file.title).join(", ")} stay out of this export, because your seat
          cannot open them. The President can give you access.
        </Callout>
      ) : null}

      {/* Every area is listed whatever the year holds, so a year with nothing
          in it reads as nine empty files rather than as a screen with no
          answer. There is no empty state here on purpose. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {files.map((file) => {
          const allowed = !file.capabilities || file.capabilities.some((c) => sees(c));
          return (
            <Card key={file.id} data-testid={`records-${file.id}`}>
              <CardHeader
                title={file.title}
                subtitle={file.blurb}
                action={
                  allowed ? (
                    <Button variant="secondary" size="sm" onClick={() => downloadOne(file.id)}>
                      <Download className="size-3.5" />
                      CSV
                    </Button>
                  ) : (
                    <Badge tone="neutral">Not yours to read</Badge>
                  )
                }
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-footnote text-fg-muted">
                <span>
                  {pluralize(file.rows.length, "row")} in {file.name}
                </span>
                {file.totals.map((total) => (
                  <span key={total.label} className="tnum">
                    {total.label}{" "}
                    <span className="font-semibold text-fg">
                      {total.moneyCents !== undefined
                        ? money(total.moneyCents)
                        : total.text !== undefined
                          ? total.text
                          : total.count}
                    </span>
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-footnote text-fg-muted">
        The whole history, every area at once, is on{" "}
        <Link href="/board/settings#board" className="underline">
          Settings
        </Link>
        . Amounts download as plain decimal dollars, so a spreadsheet adds them.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The year's rows, read once and kept                                         */
/* -------------------------------------------------------------------------- */

/**
 * The rows for a year, held outside React.
 *
 * The read is asynchronous and lands after a paint, and mirroring it into
 * `useState` from an effect is both a lint error here and a guaranteed frame
 * of wrong content. Only the signed-in path uses it: the demo holds every
 * line already.
 */
interface YearRead {
  /** The association the rows belong to, so switching one does not reuse them. */
  associationId: string | null;
  year: number | null;
  rows: YearRecords | null;
  reading: boolean;
  failed: boolean;
}

const NO_READ: YearRead = {
  associationId: null,
  year: null,
  rows: null,
  reading: false,
  failed: false,
};
let current: YearRead = NO_READ;
const listeners = new Set<() => void>();

function subscribeYear(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function yearSnapshot(): YearRead {
  return current;
}

async function readYear(associationId: string, year: number, force = false): Promise<void> {
  if (
    !force &&
    current.associationId === associationId &&
    current.year === year &&
    (current.rows || current.reading)
  ) {
    return;
  }
  current = { associationId, year, rows: null, reading: true, failed: false };
  for (const listener of listeners) listener();
  const rows = await annualRecordsRows(year);
  // A year chosen and left before the answer came back is not this read's
  // business any more: the store keeps what is on screen.
  current = rows
    ? { associationId, year, rows, reading: false, failed: false }
    : { associationId, year, rows: null, reading: false, failed: true };
  for (const listener of listeners) listener();
}
