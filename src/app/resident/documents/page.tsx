"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  PenLine,
  Search,
} from "lucide-react";
import { Card, EmptyState, IconTile, SectionTitle, fieldClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { cn, formatDate } from "@/lib/utils";
import type { DocumentRecord, GoverningDoc } from "@/lib/types";

/** Short enough to sit in front of an article number in a search result. */
const DOC_SHORT: Record<GoverningDoc, string> = {
  declaration: "CC&Rs",
  bylaws: "Bylaws",
  rules: "Rules",
};

const order: DocumentRecord["category"][] = [
  "Governing",
  "Financial",
  "Meetings",
  "Notices",
  "Insurance",
  "Forms",
];

export default function ResidentDocuments() {
  // `?q=` from the top bar's search, resolved on the client under Suspense.
  return (
    <Suspense fallback={null}>
      <DocumentsScreen />
    </Suspense>
  );
}

function DocumentsScreen() {
  const { community, documents, isRemote } = useAppState();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const visible = documents.filter((d) => d.visibility !== "board");
  const q = query.trim().toLowerCase();

  /**
   * Searching the words, not the file names.
   *
   * Somebody types "fence" because they got a letter about a fence. Matching
   * only on document titles returns nothing, which is how an owner concludes
   * the documents are useless and asks a board member instead.
   */
  const articleHits = useMemo(() => {
    if (!q) return [];
    return community.governingDocs.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.plain ?? "").toLowerCase().includes(q) ||
        a.text.some((p) => p.toLowerCase().includes(q)),
    );
  }, [community.governingDocs, q]);

  const grouped = order
    .map((category) => ({
      category,
      docs: visible.filter(
        (d) => d.category === category && (!q || d.name.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.docs.length);

  const fillable = community.forms.filter((f) => (f.fields ?? []).length > 0);
  const nothing = q && grouped.length === 0 && articleHits.length === 0;

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Documents" subtitle="Rules, financial records, and forms." />

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, for example fence, late fee, or minutes"
          aria-label="Search documents and governing documents"
          className={cn(fieldClass, "pl-9 pr-3")}
        />
      </label>

      {articleHits.length > 0 ? (
        <section>
          <SectionTitle>In your governing documents</SectionTitle>
          <Card className="divide-y divide-border">
            {articleHits.slice(0, 4).map((article) => (
              <Link
                key={article.id}
                href="/resident/documents/governing"
                className="block px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <p className="text-footnote font-semibold text-fg-muted">
                  {DOC_SHORT[article.document]} {article.number}
                </p>
                <p className="mt-0.5 text-body font-semibold text-fg">{article.title}</p>
                {article.plain ? (
                  <p className="mt-1 text-footnote leading-relaxed text-fg-muted">
                    {article.plain}
                  </p>
                ) : null}
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {!q && community.governingDocs.length > 0 ? (
        <Link
          href="/resident/documents/governing"
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2"
        >
          <IconTile icon={BookOpen} tint="violet" size="md" className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-fg">
              Read the rules you live under
            </span>
            <span className="block text-footnote leading-snug text-fg-muted">
              The CC&amp;Rs, the bylaws and the rules, in plain words, searchable, with the
              exact wording one tap away
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>
      ) : null}

      {!q && fillable.length > 0 ? (
        <section>
          <SectionTitle>Fill in and sign here</SectionTitle>
          <Card className="divide-y divide-border">
            {fillable.map((form) => (
              <Link
                key={form.id}
                href={`/resident/documents/forms/${form.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <IconTile icon={PenLine} tint="teal" size="sm" className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-fg">
                    {form.label}
                  </span>
                  <span className="block truncate text-footnote text-fg-muted">
                    {form.decisionDays
                      ? `The board answers within ${form.decisionDays} days`
                      : form.description}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      {!q && grouped.length === 0 ? (
        <section>
          <SectionTitle>From the board</SectionTitle>
          <Card>
            <EmptyState
              icon={<FileText className="size-5" />}
              title="Your board has not posted any documents yet"
              description="The CC&Rs, bylaws, budget and minutes will appear here once the board adds them."
            />
          </Card>
        </section>
      ) : null}

      {nothing ? (
        <Card>
          <EmptyState
            icon={<Search className="size-6" />}
            title="Nothing matches"
            description="Try a different word. Search covers document names and the text of the rules."
          />
        </Card>
      ) : null}

      {grouped.map(({ category, docs }) => (
        <section key={category}>
          <SectionTitle>{category}</SectionTitle>
          <Card>
            {docs.map((d, i) => {
              const rowClass = `flex items-center gap-3 px-4 py-3 transition-colors ${
                i > 0 ? "border-t border-border" : ""
              } ${d.url ? "hover:bg-surface-2" : ""}`;
              const row = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                    {d.fileType === "xlsx" ? (
                      <FileSpreadsheet className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-fg">{d.name}</span>
                    <span className="block truncate text-footnote text-fg-muted">
                      {formatDate(d.updatedDate, "medium")} · {d.size}
                    </span>
                  </span>
                  {/* A sample document has no file behind it, so the row
                      does not open. Say so, in the signed-out demo only. */}
                  {!d.url && !isRemote ? (
                    <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-footnote font-medium text-fg-muted">
                      Sample
                    </span>
                  ) : null}
                </>
              );
              // A row opens the file when there is one. The demo's documents
              // have none, and a link to nowhere is worse than no link.
              return d.url ? (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className={rowClass}>
                  {row}
                </a>
              ) : (
                <div key={d.id} className={rowClass}>
                  {row}
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
