"use client";

import { useMemo, useState } from "react";
import { BookOpen, Filter, Search, Sparkles } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import type { BylawArticle, BylawTopic } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

const TOPIC_LABEL: Record<BylawTopic, string> = {
  governance: "How it runs",
  money: "Money",
  meetings: "Meetings and votes",
  property: "Your home",
  enforcement: "Rules and fines",
  records: "Records",
};

const AFFECTS_LABEL = {
  owners: "Applies to you",
  board: "Applies to the board",
  both: "Applies to everyone",
} as const;

/**
 * The bylaws, readable.
 *
 * Two decisions carry this screen. The plain reading comes first and the
 * governing text is one click away, because the plain reading is what makes
 * anybody look and the governing text is what actually binds. And every
 * article is tagged with who it constrains, because roughly half a bylaw set
 * is about how the board operates and an owner reading it cover to cover
 * gives up somewhere in Article V.
 */
export function BylawReader({
  articles,
  amendedIds = [],
}: {
  articles: BylawArticle[];
  /** Articles with a change currently on the table. */
  amendedIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<BylawTopic | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const topics = useMemo(
    () => [...new Set(articles.map((a) => a.topic))] as BylawTopic[],
    [articles],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (topic !== "all" && a.topic !== topic) return false;
      if (mineOnly && a.affects === "board") return false;
      if (!q) return true;
      // Searches the real text too, not just the summary. Somebody looking for
      // "fence" needs to find it wherever the word actually appears.
      return (
        a.title.toLowerCase().includes(q) ||
        a.number.toLowerCase().includes(q) ||
        a.plain.toLowerCase().includes(q) ||
        a.text.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [articles, query, topic, mineOnly]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the bylaws, for example fence or late fee"
            aria-label="Search the bylaws"
            className="h-10 w-full rounded-lg border border-border-2 bg-surface pl-9 pr-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
          />
        </label>
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          aria-pressed={mineOnly}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[15px] font-medium transition-colors",
            mineOnly
              ? "border-brand bg-brand-soft text-brand-soft-fg"
              : "border-border-2 bg-surface text-fg-muted hover:text-fg",
          )}
        >
          <Filter className="size-4" />
          Just what applies to me
        </button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", ...topics] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            aria-pressed={topic === t}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
              topic === t
                ? "bg-brand text-brand-fg"
                : "bg-surface-2 text-fg-muted hover:text-fg",
            )}
          >
            {t === "all" ? "Everything" : TOPIC_LABEL[t]}
          </button>
        ))}
      </div>

      {matches.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="Nothing matches"
            description="Try a plainer word. The search reads the full legal text, so a term from a letter you were sent should find it."
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
                      {article.number}
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
                  </div>
                  <p className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-fg">
                    {article.title}
                  </p>
                  {/* The plain reading is the headline. The legal text is the
                      footnote, which is the opposite of how a PDF presents it. */}
                  <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
                    {article.plain}
                  </p>
                  <p className="mt-2 text-[13px] font-medium text-brand">
                    {expanded ? "Hide the exact wording" : "Read the exact wording"}
                  </p>
                </button>

                {expanded ? (
                  <div className="border-t border-border bg-surface-2 px-4 py-4">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted">
                      <Sparkles className="size-3.5" />
                      As written in the recorded document
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
