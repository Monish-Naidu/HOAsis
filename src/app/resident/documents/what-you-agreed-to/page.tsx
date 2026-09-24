"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Callout, Card, EmptyState } from "@/components/ui/primitives";
import { DisclosureSummary } from "@/components/app/disclosure-summary";
import { useAppState } from "@/lib/app-state";
import { disclosureCoverage } from "@/lib/governing";

export default function WhatYouAgreedTo() {
  const { community } = useAppState();
  const articles = community.governingDocs;
  const coverage = disclosureCoverage(articles);

  return (
    <div className="animate-rise space-y-5">
      <div>
        <Link
          href="/resident/documents/governing"
          className="-ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-1 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          The rules you live under
        </Link>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.025em] text-fg">
          What you agreed to when you bought here
        </h1>
        {/* 46% of owners in an association have been fined, warned or cited,
            and 6% name "everybody knows the rules" as a benefit of living in
            one. The gap between those two numbers is this screen. An owner who
            does not know a rule exists cannot ask for the approval that would
            have made their project legal. */}
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
          Eight questions that catch most people out. You agreed to these at closing.
        </p>
      </div>

      {articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
            title="The documents are here only as files"
            description="The text of your governing documents has not been imported yet."
          />
        </Card>
      ) : (
        <>
          <DisclosureSummary articles={articles} />

          {coverage.gaps.length > 0 ? (
            <Callout tone="info" title="Some of these have no answer on file">
              {coverage.answered} of {coverage.total} are settled by a provision somebody
              has confirmed. The rest are left blank rather than guessed at, because a
              summary of a covenant is an interpretation and this page does not make those.
              Ask the board.
            </Callout>
          ) : null}

          <p className="text-[13px] leading-relaxed text-fg-subtle">
            This is a reading aid, not legal advice, and it does not replace the documents
            themselves. Every answer here links to the provision it came from so you can
            read the words that actually bind.
          </p>
        </>
      )}
    </div>
  );
}
