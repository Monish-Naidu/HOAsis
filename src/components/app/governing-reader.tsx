"use client";

import { useMemo, useState } from "react";
import { BookOpen, Filter, Landmark, Search, Sparkles } from "lucide-react";
import { Badge, Card, EmptyState, Segmented } from "@/components/ui/primitives";
import type { GoverningArticle, GoverningDoc, GoverningTopic } from "@/lib/types";
import { GOVERNING_DOCS, documentsPresent } from "@/lib/governing";
import { formatDate, cn } from "@/lib/utils";

const TOPIC_LABEL: Record<GoverningTopic, string> = {
  governance: "How it runs",
  money: "Money",
  meetings: "Meetings and votes",
  property: "Your home",
  enforcement: "Rules and fines",
  records: "Records",
};

/** Short enough to sit in front of an article number without crowding it. */
const DOC_SHORT: Record<GoverningDoc, string> = {
  declaration: "CC&Rs",
  bylaws: "Bylaws",
  rules: "Rules",
};

const AFFECTS_LABEL = {
  owners: "Applies to you",
  board: "Applies to the board",
  both: "Applies to everyone",
} as const;

/**
 * The governing documents, readable.
 *
 * Three decisions carry this screen. The plain reading comes first and the
 * governing text is one click away, because the plain reading is what makes
 * anybody look and the governing text is what actually binds. Every article is
 * tagged with who it constrains, because roughly half a bylaw set is about how
 * the board operates and an owner reading it cover to cover gives up somewhere
 * in Article V. And search runs across all three documents at once, because an
 * owner with a question about a fence does not know which instrument the fence
 * rule lives in, and should not have to.
 */
export function GoverningReader({
  articles,
  amendedIds = [],
}: {
  articles: GoverningArticle[];
  /** Articles with a change currently on the table. */
  amendedIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<GoverningTopic | "all">("all");
  const [doc, setDoc] = useState<GoverningDoc | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const topics = useMemo(
    () => [...new Set(articles.map((a) => a.topic))] as GoverningTopic[],
    [articles],
  );
  const docs = useMemo(() => documentsPresent(articles), [articles]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (doc !== "all" && a.document !== doc) return false;
      if (topic !== "all" && a.topic !== topic) return false;
      if (mineOnly && a.affects === "board") return false;
      if (!q) return true;
      // Searches the real text too, not just the summary. Somebody looking for
      // "fence" needs to find it wherever the word actually appears.
      return (
        a.title.toLowerCase().includes(q) ||
        a.number.toLowerCase().includes(q) ||
        (a.plain ?? "").toLowerCase().includes(q) ||
        a.text.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [articles, query, topic, doc, mineOnly]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, like fence or late fee"
            aria-label="Search the governing documents"
            className="h-10 w-full rounded-lg border border-border-2 bg-surface pl-9 pr-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle hover:border-fg-subtle focus:border-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          aria-pressed={mineOnly}
          className={cn(
            "press inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[14px] font-medium transition-colors",
            mineOnly
              ? "border-primary bg-primary-soft text-primary"
              : "border-border-2 bg-surface text-fg-muted hover:border-fg-subtle hover:text-fg",
          )}
        >
          <Filter className="size-4" />
          Just what applies to me
        </button>
      </div>

      {docs.length > 1 ? (
        <Segmented
          label="Document"
          className="mt-3"
          value={doc}
          onChange={setDoc}
          options={(["all", ...docs] as const).map((d) => ({
            value: d,
            label: d === "all" ? "All" : DOC_SHORT[d],
          }))}
        />
      ) : null}

      {/* Which document wins, said once, where somebody comparing two
          provisions will actually be standing. */}
      {doc !== "all" ? (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-fg-muted">
          <Landmark className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {GOVERNING_DOCS[doc].plain} Changed by {GOVERNING_DOCS[doc].changedBy.toLowerCase()}.
          </span>
        </p>
      ) : null}

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", ...topics] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            aria-pressed={topic === t}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition-colors",
              topic === t
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-fg-muted hover:border-border-2 hover:text-fg",
            )}
          >
            {t === "all" ? "Everything" : TOPIC_LABEL[t]}
          </button>
        ))}
      </div>

      {matches.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title="Nothing matches"
            description="Try a different word. Search covers the full text of all three documents."
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {matches.map((article) => {
            const expanded = open === article.id;
            const proposed = amendedIds.includes(article.id);
            return (
              <Card key={article.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : article.id)}
                  aria-expanded={expanded}
                  className="w-full px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-fg-muted">
                      {DOC_SHORT[article.document]} {article.number}
                    </span>
                    <Badge tone={article.affects === "owners" ? "brand" : "neutral"}>
                      {AFFECTS_LABEL[article.affects]}
                    </Badge>
                    {proposed ? <Badge tone="warn">Change on the ballot</Badge> : null}
                    {article.amendedOn ? (
                      <span className="text-[13px] text-fg-subtle">
                        Amended {formatDate(article.amendedOn, "medium")}
                      </span>
                    ) : null}
                    {/* A rule adopted after somebody bought still binds them,
                        and they are entitled to know it was not there when
                        they moved in. */}
                    {article.adoptedOn ? (
                      <span className="text-[13px] text-fg-subtle">
                        Adopted by the board {formatDate(article.adoptedOn, "medium")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-fg">
                    {article.title}
                  </p>
                  {/* The plain reading is the headline. The legal text is the
                      footnote, which is the opposite of how a PDF presents it.
                      Where no plain reading has been written, the gap is shown
                      as a gap: nothing here invents one, because a summary of a
                      covenant is an interpretation and this screen does not
                      make those. */}
                  {article.plain ? (
                    <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
                      {article.plain}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[15px] leading-relaxed text-fg-subtle">
                      No plain reading has been written for this article yet. The exact
                      wording is below.
                    </p>
                  )}
                  <p className="mt-2 text-[13px] font-medium text-accent">
                    {expanded ? "Hide the exact wording" : "Read the exact wording"}
                  </p>
                </button>

                {expanded ? (
                  <div className="border-t border-border bg-surface-2 px-4 py-4">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted">
                      <Sparkles className="size-3.5" />
                      {article.document === "declaration"
                        ? "As written in the recorded declaration"
                        : `As written in the ${GOVERNING_DOCS[article.document].label.toLowerCase()}`}
                    </p>
                    <div className="mt-2 space-y-2.5">
                      {article.text.map((paragraph, index) => (
                        <p
                          key={index}
                          className="text-[15px] leading-relaxed text-fg"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    {/* Where the words came from. Text a board typed and text
                        pulled out of an upload are not the same kind of claim,
                        and a reader is entitled to tell them apart. */}
                    {article.extraction?.confirmedBy ? (
                      <p className="mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-fg-subtle">
                        Taken from the uploaded document and checked against it by{" "}
                        {article.extraction.confirmedBy}
                        {article.extraction.confirmedOn
                          ? ` on ${formatDate(article.extraction.confirmedOn, "medium")}`
                          : ""}
                        .
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
