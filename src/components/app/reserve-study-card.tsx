"use client";

import { useState } from "react";
import { CalendarClock, FileText, Upload } from "lucide-react";
import { Button, Card, CardHeader, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { DOCUMENT_ACCEPT } from "@/lib/documents";
import { cn, addYears, formatDate, todayIsoDate } from "@/lib/utils";

/** Most states and every lender expect a fresh study on this cadence. */
const STUDY_YEARS = 3;

/**
 * The reserve study, as a file.
 *
 * Monish asked on 2026-09-19 whether the study could be read and its parts
 * added automatically. The honest answer is that a reviewed extraction is a
 * day's work behind an API key, and that half the value is simpler: the
 * board can find the study, it says when it was done, and the page says
 * when the next one is due. That is this card. The file goes on the
 * Documents tab under Financial like anything else, and the components are
 * still typed in from it by hand.
 */
export function ReserveStudyCard() {
  const { community, uploadDocuments, updateSettings } = useAppState();
  const { notify } = useToast();
  const study = community.settings.reserveStudy;
  const document = study ? community.documents.find((d) => d.id === study.documentId) : undefined;
  const [busy, setBusy] = useState(false);
  // Empty until somebody types the date printed on the study. Defaulting to
  // today filed a 2019 study as this year's and put the next one ten years out.
  const [studyDate, setStudyDate] = useState(study?.studyDate ?? "");

  async function upload(file: File) {
    setBusy(true);
    try {
      const outcome = await uploadDocuments([file], { category: "Financial" });
      const filed = outcome.filed[0];
      if (!filed) {
        notify(outcome.rejected[0]?.reason ?? "The file was not uploaded. Check it and try again.", "warn");
        return;
      }
      // Said only once the link is saved. A refusal has been said by the
      // write itself; the file is under Documents either way.
      const ok = await updateSettings({
        reserveStudy: { documentId: filed.id, name: filed.name, studyDate },
      });
      if (ok) notify(`${filed.name} is on file. It is under Documents too.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "The file was not uploaded. Try again.", "warn");
    } finally {
      setBusy(false);
    }
  }

  const input = (label: string, needsDate = false) => (
    <label
      aria-busy={busy}
      aria-disabled={needsDate && !studyDate}
      title={needsDate && !studyDate ? "Enter the date on the study first" : undefined}
      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-2 px-3.5 text-body font-medium text-fg transition-colors hover:bg-surface-2 aria-busy:cursor-progress aria-busy:opacity-70 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <Upload className="size-3.5" />
      {busy ? "Uploading" : label}
      <input
        type="file"
        accept={DOCUMENT_ACCEPT}
        aria-label={label}
        disabled={busy || (needsDate && !studyDate)}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
    </label>
  );

  if (!study) {
    return (
      <Card className="mt-6">
        <CardHeader
          title="The study itself"
          subtitle="Keep the file here and see when the next study is due"
        />
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-footnote font-medium text-fg">Date on the study</span>
            <input
              type="date"
              value={studyDate}
              max={todayIsoDate()}
              onChange={(e) => setStudyDate(e.target.value)}
              aria-label="Date on the study"
              className={cn(fieldClass, "w-auto")}
            />
          </label>
          {input("Upload the study", true)}
        </div>
      </Card>
    );
  }

  const due = addYears(study.studyDate, STUDY_YEARS);
  const overdue = due < todayIsoDate();

  return (
    <Card className="mt-6">
      <CardHeader
        icon={<FileText className="size-4" />}
        title="The study on file"
        subtitle={`Dated ${formatDate(study.studyDate, "long")}`}
        action={input("Replace")}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          {document?.url ? (
            <a
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="text-body font-medium text-brand hover:underline"
            >
              {study.name}
            </a>
          ) : (
            <p className="text-body font-medium text-fg">{study.name}</p>
          )}
          <p className="text-footnote text-fg-muted">
            {document ? `Under Documents, ${document.visibility === "board" ? "board only" : "shared with owners"}.` : "Filed under Documents."}
          </p>
        </div>
        <p
          className={`flex items-center gap-1.5 text-footnote font-medium ${overdue ? "text-warn" : "text-fg-muted"}`}
        >
          <CalendarClock className="size-3.5" />
          {overdue
            ? `A new study was due ${formatDate(due, "long")}`
            : `Next study due ${formatDate(due, "long")}`}
        </p>
      </div>
      <div className="border-t border-border px-5 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            // Not said until the write is back, and not at all if it was refused.
            const ok = await updateSettings({ reserveStudy: undefined });
            if (ok) notify("Unlinked. The file is still under Documents.", "info");
          }}
        >
          Unlink this study
        </Button>
      </div>
    </Card>
  );
}
