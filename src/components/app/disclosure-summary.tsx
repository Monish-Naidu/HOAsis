"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, HelpCircle } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { DISCLOSURE_TOPICS, disclosureFindings } from "@/lib/governing";
import type { DisclosureTopic, GoverningArticle } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOC_SHORT = {
  declaration: "CC&Rs",
  bylaws: "Bylaws",
  rules: "Rules",
} as const;

/**
 * What you are buying into, in eight questions.
 *
 * The eight are not ours. Virginia, Colorado and Washington wrote disclosure
 * requirements separately and converged on the same short list, which is what
 * makes it a defensible schema: it is what statute says a buyer must be told,
 * rather than what we found interesting. Florida goes further and puts the
 * duty on the association rather than the seller, which is the only version of
 * this that ever works, because the seller has the least incentive and the
 * worst records.
 *
 * The rule this screen lives under is that an answer comes from a provision
 * somebody confirmed, or it does not come at all. A topic nothing addresses
 * says so. A topic where only a word match was found says that too, in
 * different words, and never resolves it into an answer. "Your documents ban
 * flags" is a statement about somebody's home, and a keyword hit is not
 * standing enough to make it.
 */
export function DisclosureSummary({
  articles,
  /** Board side shows what is unconfirmed and needs a person. Owners do not. */
  showUnconfirmed = false,
}: {
  articles: GoverningArticle[];
  showUnconfirmed?: boolean;
}) {
  const findings = disclosureFindings(articles);
  const [open, setOpen] = useState<DisclosureTopic | null>(null);

  return (
    <div className="space-y-3">
      {findings.map((finding) => {
        const expanded = open === finding.meta.topic;
        const answered = finding.status === "answered";
        return (
          <Card key={finding.meta.topic} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : finding.meta.topic)}
              aria-expanded={expanded}
              className="w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    answered
                      ? "bg-ok-soft text-ok"
                      : finding.status === "unconfirmed"
                        ? "bg-warn-soft text-warn"
                        : "bg-surface-3 text-fg-subtle",
                  )}
                >
                  {answered ? (
                    <Check className="size-3.5" strokeWidth={2.6} />
                  ) : finding.status === "unconfirmed" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : (
                    <HelpCircle className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold tracking-[-0.01em] text-fg">
                    {finding.meta.question}
                  </p>
                  {answered ? (
                    <p className="mt-1 text-[13px] text-fg-muted">
                      Answered by{" "}
                      {finding.confirmed
                        .map((a) => `${DOC_SHORT[a.document]} ${a.number}`)
                        .join(", ")}
                    </p>
                  ) : finding.status === "unconfirmed" ? (
                    <p className="mt-1 text-[13px] text-warn">
                      Nothing confirmed. {finding.candidates.length} article
                      {finding.candidates.length === 1 ? "" : "s"} mention this and nobody
                      has checked them.
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] text-fg-muted">
                      Your documents do not address this.
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "mt-1 size-4 shrink-0 text-fg-subtle transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </div>
            </button>

            {expanded ? (
              <div className="border-t border-border bg-surface-2 px-4 py-4">
                {answered ? (
                  <div className="space-y-4">
                    {finding.confirmed.map((article) => (
                      <div key={article.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">
                            {DOC_SHORT[article.document]} {article.number}
                          </Badge>
                          <span className="text-[13px] font-semibold text-fg-muted">
                            {article.title}
                          </span>
                        </div>
                        {article.plain ? (
                          <p className="mt-1.5 text-[15px] leading-relaxed text-fg">
                            {article.plain}
                          </p>
                        ) : null}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[13px] font-medium text-brand">
                            The exact wording
                          </summary>
                          <div className="mt-2 space-y-2">
                            {article.text.map((paragraph, index) => (
                              <p
                                key={index}
                                className="text-[15px] leading-relaxed text-fg-muted"
                              >
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : finding.status === "unconfirmed" ? (
                  <div>
                    <p className="text-[15px] leading-relaxed text-fg">
                      {showUnconfirmed
                        ? "These articles use words that suggest they settle this. Nobody has confirmed that they do, so nothing here is presented as an answer. Open each one and tag it, or leave it, but do not treat this list as a finding."
                        : "Some articles mention this, but nobody on the board has confirmed which one settles it. Ask the board rather than reading a guess here."}
                    </p>
                    {showUnconfirmed ? (
                      <ul className="mt-3 space-y-1.5">
                        {finding.candidates.map((article) => (
                          <li key={article.id} className="text-[13px] text-fg-muted">
                            <span className="font-semibold text-fg-muted">
                              {DOC_SHORT[article.document]} {article.number}
                            </span>{" "}
                            {article.title}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[15px] leading-relaxed text-fg">
                    Nothing in the documents on file addresses this. That usually means it
                    is not restricted here, but it can also mean the provision is in a
                    document that has not been put into words yet. State law may still
                    apply either way.
                  </p>
                )}

                <p className="mt-4 border-t border-border pt-3 text-[13px] leading-relaxed text-fg-subtle">
                  <span className="font-semibold text-fg-muted">Why this is on the list: </span>
                  {finding.meta.why}
                </p>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/** How many of the eight this association can actually answer. */
export function DisclosureCoverageLine({ articles }: { articles: GoverningArticle[] }) {
  const findings = disclosureFindings(articles);
  const answered = findings.filter((f) => f.status === "answered").length;
  return (
    <p className="tnum text-[15px] font-semibold text-fg">
      {answered} / {DISCLOSURE_TOPICS.length}
    </p>
  );
}
