"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Download } from "lucide-react";
import { Button, Callout, Card, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { completeRecordsRows } from "@/lib/data/remote-store";
import { downloadZip } from "@/lib/core/export";
import { completeRecordsFiles } from "@/lib/records/complete";
import { recordsReadme, recordsZip, recordsZipName } from "@/lib/records/pack";
import { completeRecordsFromCommunity } from "@/lib/records/rows";
import { todayIsoDate } from "@/lib/utils";

/**
 * The complete records export: one zip holding every area of the association.
 *
 * A board is asked for the whole association at unpredictable moments, and
 * always by somebody who is not sitting in front of the product: an owner
 * exercising a right to inspect the records, a buyer's lender, an accountant
 * in April, the manager taking over. Doing that screen by screen is how a
 * board ends up emailing screenshots, so this is one button.
 *
 * A seat that cannot read an area is told so here rather than being handed a
 * file row level security would fill with nothing, and the README in the zip
 * says the same thing to whoever opens it next.
 */
export function RecordsExportCard() {
  const { community, account, isRemote, sees } = useAppState();
  const { notify } = useToast();
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  // The export is every area at once, so it takes both: the books and the
  // board's own record. A seat with one of the two has its own screen.
  if (!sees("finances") || !sees("settings")) return null;

  async function download() {
    setWorking(true);
    setFailed(false);
    const generatedOn = todayIsoDate();
    try {
      // Signed in, the rows the screens only hold a window of are read for
      // the whole history, under this person's own session.
      const read = isRemote ? await completeRecordsRows() : null;
      if (isRemote && !read) {
        setFailed(true);
        return;
      }
      const rows = read ?? completeRecordsFromCommunity(community);
      const files = completeRecordsFiles(community, rows);
      const unreadable = files
        .filter((file) => file.capabilities && !file.capabilities.some((c) => sees(c)))
        .map((file) => file.title);
      const readme = recordsReadme(community, files, {
        generatedOn,
        unreadable,
        ...(account?.name ? { by: account.name } : {}),
      });
      downloadZip(recordsZipName(community, generatedOn), recordsZip(files, readme, generatedOn));
      notify(`Downloaded ${files.length} files`);
    } catch (error) {
      setFailed(true);
      notify(error instanceof Error ? error.message : "Could not build the export", "warn");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card data-testid="records-export">
      <CardHeader
        title="Complete records"
        subtitle="Everything the association holds, as one zip of CSV files"
        icon={<Archive className="size-4" />}
      />
      <div className="space-y-3 px-5 py-4">
        <p className="text-body text-fg-muted">
          The register, the books, the statements, the votes, the minutes, the requests and the list
          of files, one CSV per area, with a README that explains the columns. Amounts are plain
          decimal dollars, so a spreadsheet can add them.
        </p>
        <p className="text-body text-fg-muted">
          The files themselves are not in the zip: the list names them and where they live. A
          person&apos;s own vote stays theirs; a ballot&apos;s tally is included.
        </p>
        {failed ? (
          <Callout tone="warn" title="The export could not be built">
            Nothing was downloaded, so nothing here is half a record. Try again, and if it keeps
            failing tell us what the toast said.
          </Callout>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm" onClick={download} disabled={working}>
            <Download className="size-3.5" />
            {working ? "Building the zip" : "Download everything"}
          </Button>
          <Link
            href="/board/money/annual-records"
            className="text-footnote font-medium text-brand underline"
          >
            Or one year at a time
          </Link>
        </div>
      </div>
    </Card>
  );
}
