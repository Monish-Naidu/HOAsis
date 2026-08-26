"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Vote } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { BylawReader } from "@/components/app/bylaw-reader";
import { AmendmentDiff } from "@/components/app/amendment-diff";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";

export default function ResidentBylaws() {
  const { community } = useAppState();
  const articles = community.bylaws;
  const open = community.bylawAmendments.filter((a) => a.stage === "open");

  return (
    <div className="animate-rise space-y-5">
      <div>
        <Link
          href="/resident/documents"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          Documents
        </Link>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-fg">
          Bylaws
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
          What each article means, in plain words, with the exact wording one tap away.
        </p>
      </div>

      {articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-6" />}
            title="The bylaws are here as a file"
            description="Your board has uploaded the document but has not added the text yet, so it cannot be searched. You can still download it from Documents."
          />
        </Card>
      ) : (
        <>
          {open.length > 0 ? (
            <div className="space-y-3">
              {open.map((amendment) => {
                const current = articles.find((a) => a.id === amendment.articleId);
                return (
                  <Card key={amendment.id} className="border-warn/30 bg-warn-soft/40 p-4">
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
                      <summary className="cursor-pointer text-[13px] font-medium text-brand">
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
                      <Link
                        href="/resident/vote"
                        className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
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

          <BylawReader
            articles={articles}
            amendedIds={open.map((a) => a.articleId ?? "").filter(Boolean)}
          />
        </>
      )}
    </div>
  );
}
