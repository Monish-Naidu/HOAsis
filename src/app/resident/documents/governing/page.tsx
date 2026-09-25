"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, FileText, ShieldQuestion, Vote } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { GoverningReader } from "@/components/app/governing-reader";
import { AmendmentDiff } from "@/components/app/amendment-diff";
import { DocumentHierarchy } from "@/components/app/document-hierarchy";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";

export default function ResidentGoverningDocuments() {
  const { community } = useAppState();
  const articles = community.governingDocs;
  const open = community.governingAmendments.filter((a) => a.stage === "open");

  return (
    <div className="animate-rise space-y-5">
      <div>
        <Link
          href="/resident/documents"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          Documents
        </Link>
        <h1 className="mt-2 text-title2 font-semibold tracking-[-0.025em] text-fg">
          The rules you live under
        </h1>
        <p className="mt-1 text-body leading-relaxed text-fg-muted">
          Three documents, searchable together, in plain words, with the exact wording one
          tap away.
        </p>
      </div>

      {articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-6" />}
            title="The documents are here as files"
            description="The text has not been added yet. You can download the files from Documents."
          />
        </Card>
      ) : (
        <>
          <Link
            href="/resident/documents/what-you-agreed-to"
            className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
              <ShieldQuestion className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-fg">
                The eight things worth knowing
              </span>
              <span className="block text-footnote leading-snug text-fg-muted">
                Flags, solar, signs, parking, working from home, renting out, what needs
                approval, and what happens if you fall behind
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
          </Link>

          <DocumentHierarchy articles={articles} />

          {open.length > 0 ? (
            <div className="space-y-3">
              {open.map((amendment) => {
                const current = articles.find((a) => a.id === amendment.articleId);
                return (
                  <Card key={amendment.id} className="border-warn/30 bg-warn-soft/40 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warn">Open for your vote</Badge>
                      <span className="text-footnote text-fg-muted">
                        Needs {amendment.thresholdLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-headline font-semibold tracking-[-0.01em] text-fg">
                      {amendment.number}: {amendment.title}
                    </p>
                    <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
                      {amendment.plain}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-footnote font-medium text-brand">
                        See exactly what changes
                      </summary>
                      <div className="mt-3">
                        <AmendmentDiff amendment={amendment} current={current} />
                        <p className="mt-3 border-t border-border pt-3 text-footnote leading-relaxed text-fg-muted">
                          <span className="font-semibold text-fg">Why: </span>
                          {amendment.rationale}
                        </p>
                        <p className="mt-1 text-footnote text-fg-subtle">
                          Proposed by {amendment.proposedBy} on{" "}
                          {formatDate(amendment.proposedOn, "medium")}
                        </p>
                      </div>
                    </details>
                    {amendment.ballotId ? (
                      <Link
                        href="/resident/vote"
                        className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-body font-semibold text-brand-fg transition-opacity hover:opacity-90"
                      >
                        <Vote className="size-4" />
                        Cast your vote
                      </Link>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : null}

          <GoverningReader
            articles={articles}
            amendedIds={open.map((a) => a.articleId ?? "").filter(Boolean)}
          />
        </>
      )}
    </div>
  );
}
