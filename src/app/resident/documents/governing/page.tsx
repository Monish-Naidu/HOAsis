"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, FileText, ShieldQuestion, Vote } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, IconTile } from "@/components/ui/primitives";
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
          className="-ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-1 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          Documents
        </Link>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-fg">
          The rules you live under
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
          Three documents, searchable together, in plain words.
        </p>
      </div>

      {articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
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
            <IconTile icon={ShieldQuestion} tint="violet" size="md" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-fg">
                The eight things worth knowing
              </span>
              <span className="block text-[13px] leading-snug text-fg-muted">
                Flags, solar, parking, renting out, approvals, and falling behind
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
                  <Card key={amendment.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warn">Open for your vote</Badge>
                      <span className="text-[13px] text-fg-muted">
                        Needs {amendment.thresholdLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-fg">
                      {amendment.number}: {amendment.title}
                    </p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
                      {amendment.plain}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[13px] font-medium text-accent hover:underline">
                        See exactly what changes
                      </summary>
                      <div className="mt-3">
                        <AmendmentDiff amendment={amendment} current={current} />
                        <p className="mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-fg-muted">
                          <span className="font-semibold text-fg">Why: </span>
                          {amendment.rationale}
                        </p>
                        <p className="mt-1 text-[13px] text-fg-subtle">
                          Proposed by {amendment.proposedBy} on{" "}
                          {formatDate(amendment.proposedOn, "medium")}
                        </p>
                      </div>
                    </details>
                    {amendment.ballotId ? (
                      <ButtonLink href="/resident/vote" variant="primary" size="md" className="mt-3">
                        <Vote className="size-4" />
                        Cast your vote
                      </ButtonLink>
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
