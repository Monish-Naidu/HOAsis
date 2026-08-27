"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Globe,
  PenLine,
  Search,
} from "lucide-react";
import { Badge, Card, Callout, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { publicRecordsUrl } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";
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
  const { community, documents } = useAppState();
  const [query, setQuery] = useState("");
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
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">Documents</h1>
        <p className="mt-1 text-[15px] text-fg-muted">
          The rules, the money, and the forms you can fill in here.
        </p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, for example fence, late fee, or minutes"
          aria-label="Search documents and governing documents"
          className="h-11 w-full rounded-lg border border-border-2 bg-surface pl-9 pr-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
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
                <p className="text-[13px] font-semibold text-fg-muted">
                  {DOC_SHORT[article.document]} {article.number}
                </p>
                <p className="mt-0.5 text-[15px] font-semibold text-fg">{article.title}</p>
                {article.plain ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
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
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-fg">
              Read the rules you live under
            </span>
            <span className="block text-[13px] leading-snug text-fg-muted">
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
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ok-soft text-ok">
                  <PenLine className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-fg">
                    {form.label}
                  </span>
                  <span className="block truncate text-[13px] text-fg-muted">
                    {form.decisionDays
                      ? `They have ${form.decisionDays} days to answer`
                      : form.description}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            ))}
          </Card>
          <p className="mt-2 text-[13px] text-fg-subtle">
            No printing, no scanning. You get a reference number and a copy of what you signed.
          </p>
        </section>
      ) : null}

      {nothing ? (
        <Card>
          <EmptyState
            icon={<Search className="size-6" />}
            title="Nothing matches"
            description="The search covers the full text of all three governing documents as well as document names, so try a plainer word."
          />
        </Card>
      ) : null}

      {grouped.map(({ category, docs }) => (
        <section key={category}>
          <SectionTitle>{category}</SectionTitle>
          <Card>
            {docs.map((d, i) => (
              <a
                key={d.id}
                href="#"
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                  {d.fileType === "xlsx" ? (
                    <FileSpreadsheet className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-fg">{d.name}</span>
                  <span className="block truncate text-[13px] text-fg-muted">
                    {formatDate(d.updatedDate, "medium")} · {d.size}
                  </span>
                </span>
                {d.visibility === "public" ? (
                  <Badge tone="neutral">Public</Badge>
                ) : null}
              </a>
            ))}
          </Card>
        </section>
      ))}

      <Callout tone="brand" icon={<Globe className="size-4" />} title={publicRecordsUrl(community)}>
        Anyone can read the public documents there, no account needed. Useful when you are
        selling.
      </Callout>
    </div>
  );
}
