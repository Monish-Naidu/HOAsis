"use client";

import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Search,
  ShieldQuestion,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge, Card, CardHeader, IconTile, PageHeader, Select } from "@/components/ui/primitives";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { recordsGaps } from "@/lib/metrics";
import { disclosureCoverage, documentsPresent } from "@/lib/governing";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { formatDate } from "@/lib/utils";
import { DOCUMENT_ACCEPT } from "@/lib/documents";
import type { DocumentRecord } from "@/lib/types";
import { moduleOn } from "@/lib/modules";


const VISIBILITY_WORD: Record<DocumentRecord["visibility"], string> = {
  public: "public",
  members: "visible to owners",
  board: "board only",
};

const order: DocumentRecord["category"][] = [
  "Governing",
  "Financial",
  "Meetings",
  "Notices",
  "Insurance",
  "Forms",
];

export default function BoardDocuments() {
  // `?q=` from the top bar's search, resolved on the client under Suspense.
  return (
    <Suspense fallback={null}>
      <DocumentsScreen />
    </Suspense>
  );
}

function DocumentsScreen() {
  const { community, documents, uploadDocuments, setDocumentVisibility, removeDocument } =
    useAppState();
  const { notify } = useToast();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [uploading, setUploading] = useState(false);
  const gaps = recordsGaps({ ...community, documents });
  const governing = community.governingDocs;
  const docsInWords = documentsPresent(governing);
  const coverage = disclosureCoverage(governing);
  const openAmendments = community.governingAmendments.filter((a) => a.stage === "open").length;
  const grouped = order
    .map((category) => ({
      category,
      docs: documents.filter(
        (d) =>
          d.category === category &&
          d.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((g) => g.docs.length);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Files for the association, and who can see each one."
        action={
          // A label, so the whole button opens the file picker; dressed as the
          // primary button, which a <label> cannot borrow from the primitive.
          <label
            aria-busy={uploading}
            className="press inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-brand-gradient px-3.5 text-callout font-medium text-primary-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.18),var(--shadow-sm)] hover:brightness-[1.06] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)] aria-busy:cursor-progress aria-busy:opacity-70"
          >
            <Upload className="size-3.5" />
            {uploading ? "Uploading" : "Upload"}
            <input
              type="file"
              multiple
              accept={DOCUMENT_ACCEPT}
              aria-label="Upload documents"
              disabled={uploading}
              className="sr-only"
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                // Allows re-selecting the same file, which otherwise fires nothing.
                event.target.value = "";
                if (files.length === 0) return;
                setUploading(true);
                try {
                  const outcome = await uploadDocuments(files);
                  if (outcome.uploaded.length) {
                    notify(
                      outcome.uploaded.length === 1
                        ? `Uploaded ${outcome.uploaded[0]}. Choose who can see it.`
                        : `Uploaded ${outcome.uploaded.length} files. Choose who can see them.`,
                    );
                  }
                  for (const refused of outcome.rejected) {
                    notify(`${refused.name}: ${refused.reason}`, "warn");
                  }
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Could not upload. Try again.", "warn");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        }
      />

      {/* Four counts used to sit here. "Documents 17" is a row count, and a
          board cannot do anything with a row count. What they can act on is
          the gap between what they hold and what they are expected to hold,
          so that is what the top of the page is now. */}
      <Card className="mb-6">
        <CardHeader
          title={
            gaps.complete
              ? "All expected records are on file"
              : `${gaps.missing.length} of ${gaps.total} expected records are not on file`
          }
          subtitle={
            gaps.complete
              ? "Nothing missing."
              : "Records owners can inspect and lenders ask for."
          }
          action={
            <span className="tnum text-body font-semibold text-fg">
              {gaps.onFileCount} / {gaps.total}
            </span>
          }
        />
        {gaps.missing.length > 0 ? (
          <div className="divide-y divide-border">
            {gaps.missing.map((record) => (
              <div key={record.key} className="flex items-start gap-3 px-5 py-3">
                <IconTile icon={AlertTriangle} tint="amber" size="xs" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-fg">{record.label}</p>
                  <p className="mt-0.5 text-footnote leading-relaxed text-fg-muted">
                    {record.why}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="mb-5 space-y-3">
        <Link
          href="/board/documents/governing"
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2"
        >
          <IconTile icon={BookOpen} tint="violet" size="md" className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-fg">
              {docsInWords.length > 0
                ? "Your governing documents"
                : "Your documents are files, not text"}
            </span>
            <span className="block text-footnote leading-snug text-fg-muted">
              {governing.length > 0
                ? `${governing.length} articles owners can search in plain words.`
                : "Owners can download them but cannot search them."}
              {openAmendments > 0
                ? ` ${openAmendments} change${openAmendments === 1 ? "" : "s"} on the ballot.`
                : ""}
            </span>
          </span>
          {openAmendments > 0 ? <Badge tone="warn">On the ballot</Badge> : null}
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>

        {/* The disclosure list is the one measure of these documents that a
            board can act on. A count of articles says nothing; "three of the
            eight things a buyer must be told have no answer on file" is a
            morning's work with a clear finish. Resale season, so it waits. */}
        {moduleOn("documents-disclosure") ? (
        <Link
          href="/board/documents/new-owner"
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2"
        >
          <IconTile icon={ShieldQuestion} tint="blue" size="md" className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-fg">
              What a new owner is told
            </span>
            <span className="block text-footnote leading-snug text-fg-muted">
              {coverage.answered === coverage.total
                ? "All eight of the things a buyer must be warned about are answered by a provision."
                : `${coverage.total - coverage.answered} of the ${coverage.total} things a buyer must be warned about have no confirmed answer.`}
            </span>
          </span>
          <span className="tnum shrink-0 text-body font-semibold text-fg">
            {coverage.answered} / {coverage.total}
          </span>
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>
        ) : null}

      </div>


      <Card className="mt-6">
        <CardHeader
          title="All documents"
          action={
            <div className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border-2 px-2.5 focus-within:border-primary">
              <Search className="size-3.5 shrink-0 text-fg-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
                className="w-40 min-w-0 bg-transparent text-footnote text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
          }
        />
        {grouped.map(({ category, docs }) => (
          <div key={category}>
            <div className="border-b border-border bg-surface-2 px-5 py-1.5">
              <p className="text-footnote font-semibold text-fg-muted">
                {category}
              </p>
            </div>
            {docs.map((d) => {
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                    {d.fileType === "xlsx" ? (
                      <FileSpreadsheet className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-body font-medium text-fg hover:underline"
                      >
                        {d.name}
                      </a>
                    ) : (
                      <p className="truncate text-body font-medium text-fg">{d.name}</p>
                    )}
                    <p className="truncate text-footnote text-fg-muted">
                      Updated {formatDate(d.updatedDate, "long")} · {d.size}
                      {d.requiredBy ? ` · required by ${d.requiredBy}` : ""}
                    </p>
                  </div>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${d.name}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                  <Select
                    size="sm"
                    className="shrink-0"
                    value={d.visibility === "public" ? "members" : d.visibility}
                    onChange={async (e) => {
                      const next = e.target.value as DocumentRecord["visibility"];
                      try {
                        await setDocumentVisibility(d.id, next);
                        notify(`${d.name} is now ${VISIBILITY_WORD[next]}`);
                      } catch (error) {
                        notify(
                          error instanceof Error ? error.message : "Could not change who can see it. Try again.",
                          "warn",
                        );
                      }
                    }}
                    aria-label={`Who can see ${d.name}`}
                  >
                    {/* No page shows a document to the public, so the choice
                        is not offered. A file saved as public reads as
                        Owners, which is who can see it. */}
                    <option value="members">Owners</option>
                    <option value="board">Board only</option>
                  </Select>
                  <button
                    type="button"
                    aria-label={`Remove ${d.name}`}
                    onClick={async () => {
                      try {
                        const undo = await removeDocument(d.id);
                        notify(
                          `Removed ${d.name}`,
                          "warn",
                          undo ? { label: "Undo", onClick: undo } : undefined,
                        );
                      } catch (error) {
                        notify(error instanceof Error ? error.message : "Could not remove it. Try again.", "warn");
                      }
                    }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </>
  );
}
