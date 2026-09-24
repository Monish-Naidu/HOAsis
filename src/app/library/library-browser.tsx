"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { LIBRARY_TOPICS, STATES } from "@/lib/data";
import type { LibraryArticle, LibraryTopic, StateCode } from "@/lib/data/library";
import { cn, formatDate } from "@/lib/utils";

/**
 * Browsing the library.
 *
 * The state filter defaults to every state rather than asking first. A library
 * that opens empty until you identify yourself is a worse library, and most of
 * this content is general anyway. Choosing a state adds the specific pieces
 * and marks them; it never hides the general ones.
 */
export function LibraryBrowser({ articles }: { articles: LibraryArticle[] }) {
  const [state, setState] = useState<StateCode | "all">("all");
  const [topic, setTopic] = useState<LibraryTopic | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles
      .filter((article) => (state === "all" ? true : !article.states || article.states.includes(state)))
      .filter((article) => (topic === "all" ? true : article.topic === topic))
      .filter(
        (article) =>
          !needle ||
          article.title.toLowerCase().includes(needle) ||
          article.summary.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        // State specific pieces first when a state is chosen; they are the
        // reason someone picked one.
        const aSpecific = Boolean(a.states) ? 0 : 1;
        const bSpecific = Boolean(b.states) ? 0 : 1;
        if (state !== "all" && aSpecific !== bSpecific) return aSpecific - bSpecific;
        return a.publishedDate < b.publishedDate ? 1 : -1;
      });
  }, [articles, state, topic, query]);

  const stateName = STATES.find((s) => s.code === state)?.name;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="sr-only">Filter by state</span>
          <span className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3">
            <MapPin className="size-4 shrink-0 text-fg-subtle" />
            <select
              value={state}
              onChange={(e) => setState(e.target.value as StateCode | "all")}
              aria-label="Filter by state"
              className="bg-transparent text-[15px] font-medium text-fg outline-none"
            >
              <option value="all">All states</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <span className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the library"
            aria-label="Search the library"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </span>
      </div>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", ...LIBRARY_TOPICS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            aria-pressed={topic === t}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              topic === t
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {t === "all" ? "Everything" : t}
          </button>
        ))}
      </div>

      {state !== "all" ? (
        <p className="mt-4 text-[15px] text-fg-muted">
          Showing general guidance plus what applies in {stateName}.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="Try a different topic, or clear the search."
        />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((article) => (
            <Link key={article.slug} href={`/library/${article.slug}`} className="group block">
              <Card className="flex h-full flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-raised">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{article.topic}</Badge>
                  {article.states?.map((code) => (
                    <Badge key={code} tone="brand">
                      {code}
                    </Badge>
                  ))}
                </div>
                <h2 className="mt-2.5 text-[17px] font-semibold leading-snug tracking-[-0.015em] text-fg">
                  {article.title}
                </h2>
                <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-fg-muted">
                  {article.summary}
                </p>
                <p className="mt-3 text-[13px] text-fg-subtle">
                  {formatDate(article.publishedDate, "long")} · {article.readMinutes} minute read
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
