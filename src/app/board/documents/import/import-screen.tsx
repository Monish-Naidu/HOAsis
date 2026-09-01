"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileSearch,
  ScanLine,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { GOVERNING_DOCS, DOC_ORDER, DISCLOSURE_TOPICS } from "@/lib/governing";
import { extractArticles, toArticle } from "@/lib/governing-extract";
import type { Extraction, ExtractedArticle } from "@/lib/governing-extract";
import type { DisclosureTopic, GoverningDoc, GoverningTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOPIC_LABEL: Record<GoverningTopic, string> = {
  governance: "How it runs",
  money: "Money",
  meetings: "Meetings and votes",
  property: "Your home",
  enforcement: "Rules and fines",
  records: "Records",
};

const DISCLOSURE_LABEL: Record<DisclosureTopic, string> = {
  flags: "Flags",
  solar: "Solar",
  signs: "Signs",
  parking: "Parking",
  "home-business": "Working from home",
  rentals: "Renting out",
  architectural: "Needs approval",
  lien: "Falling behind",
};

/** What a board confirms about one extracted article before it is kept. */
interface Choice {
  keep: boolean;
  topic: GoverningTopic;
  affects: "owners" | "board" | "both";
  disclosure: DisclosureTopic[];
}

function initialChoices(extraction: Extraction): Record<string, Choice> {
  return Object.fromEntries(
    extraction.articles.map((article) => [
      article.key,
      {
        // An article the extractor is unsure about starts unticked. The
        // default has to be the safe one, because a board clicking Keep all
        // is the likely path and it should not be the path that imports a
        // section number nobody read.
        keep: article.confidence === "clear" && article.text.length > 0,
        topic: article.suggestedTopic,
        affects: "owners" as const,
        // Disclosure tags always start off. A word match is a place to look,
        // not a statement about somebody's home.
        disclosure: [] as DisclosureTopic[],
      },
    ]),
  );
}

/**
 * Reading an uploaded governing document into text a person can search.
 *
 * The decision this screen implements is in
 * `docs/decisions/parsing-governing-documents.md`: we index governing
 * documents, we never judge them. Nothing here summarises a provision, decides
 * what one means, or concludes that anybody is in violation of one. It finds
 * where the articles start and hands the result to a board member to confirm.
 *
 * The extraction is presented as a draft throughout. Every article the parser
 * was unsure about starts unticked, every gap it left is listed rather than
 * papered over, and no plain reading is written by the machine, because a
 * summary of a covenant is an interpretation and this product does not put its
 * interpretation into somebody's legal record.
 */
export function ImportScreen() {
  const { community, addGoverningArticles } = useAppState();
  const { notify } = useToast();

  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<GoverningDoc>("declaration");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [imported, setImported] = useState(false);

  const extraction = useMemo(
    () => (source.trim() ? extractArticles(source) : null),
    [source],
  );

  function loadSource(text: string, name: string | null) {
    const parsed = extractArticles(text);
    setSource(text);
    setFileName(name);
    setDoc(parsed.suggestedDocument);
    setChoices(initialChoices(parsed));
    setImported(false);
  }

  async function pickFile(file: File) {
    setReadError(null);
    // A PDF read as text gives back its object stream, not its words. Saying
    // so beats extracting nonsense and asking a board to confirm it.
    if (/\.(pdf|docx?|xlsx?)$/i.test(file.name)) {
      setReadError(
        `${file.name} is a ${file.name.split(".").pop()?.toUpperCase()} file. Pulling text out of one happens on the server in a real deployment; here, open it, copy the text, and paste it below.`,
      );
      return;
    }
    loadSource(await file.text(), file.name);
  }

  /**
   * Numbers this document already has.
   *
   * Importing the same file twice is the likeliest mistake here, and the
   * second most likely is importing an amended copy where one article was
   * restated. Both are refused rather than merged, because two Article VIIs is
   * the exact ambiguity a board ends up citing into. Saying so before the
   * click beats a button that appears to work and adds nothing.
   */
  const onFile = useMemo(
    () =>
      new Set(
        community.governingDocs.filter((a) => a.document === doc).map((a) => a.number),
      ),
    [community.governingDocs, doc],
  );

  const kept = extraction
    ? extraction.articles.filter(
        // An article with no text under it would land in the reader as a title
        // with nothing beneath it, which reads as a bug rather than as the gap
        // in the source file that it is. The gap list already reports it.
        (a) => choices[a.key]?.keep && !onFile.has(a.number) && a.text.length > 0,
      )
    : [];
  const collisions = extraction
    ? extraction.articles.filter((a) => onFile.has(a.number))
    : [];

  function confirmImport() {
    if (!extraction || kept.length === 0) return;
    addGoverningArticles(
      kept.map((article) =>
        toArticle(article, {
          document: doc,
          topic: choices[article.key].topic,
          affects: choices[article.key].affects,
          disclosureTopics: choices[article.key].disclosure,
          confirmedBy: "Arya Mehr, President",
          confirmedOn: community.asOf,
        }),
      ),
    );
    setImported(true);
    notify(
      `${kept.length} article${kept.length === 1 ? "" : "s"} added to ${GOVERNING_DOCS[doc].short}. Owners can search them now.`,
    );
  }

  function update(key: string, patch: Partial<Choice>) {
    setChoices((all) => ({ ...all, [key]: { ...all[key], ...patch } }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Import the text of a document"
        description="Turns an uploaded declaration, bylaws or rule set into text an owner can search. Everything it reads is a draft until you confirm it."
      />

      <Callout tone="info" icon={<ScanLine className="size-4" />} title="What this does and does not do">
        It finds where your articles start and keeps the wording exactly as written. It does
        not summarise a provision, decide what one means, or work out who is in violation of
        one. Those are readings of your documents, and they belong to your board rather than
        to us.
      </Callout>

      <Card className="mt-5">
        <CardHeader
          icon={<Upload className="size-4" />}
          title="The document"
          subtitle={fileName ? `Read from ${fileName}` : "Upload a text file, or paste the text"}
          action={
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border-2 bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2">
              <Upload className="size-3.5" />
              Choose a file
              <input
                type="file"
                accept=".txt,.md,.text,.pdf,.doc,.docx"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void pickFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          }
        />
        <div className="px-5 py-4">
          {readError ? (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-fg">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
              {readError}
            </p>
          ) : null}
          <textarea
            value={source}
            onChange={(e) => loadSource(e.target.value, null)}
            rows={source ? 6 : 10}
            placeholder={"ARTICLE I\nName and purpose\n\nSection 1. The Association is..."}
            aria-label="The text of the document"
            className="w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 font-mono text-[13px] leading-relaxed text-fg outline-none focus:border-brand"
          />
        </div>
      </Card>

      {extraction ? (
        <>
          <Card className="mt-5">
            <CardHeader
              icon={<FileSearch className="size-4" />}
              title={
                extraction.articles.length === 0
                  ? "Nothing could be split into articles"
                  : `${extraction.articles.length} articles found, ${kept.length} to keep`
              }
              subtitle={
                extraction.linesWithText > 0
                  ? `${Math.round((extraction.linesPlaced / extraction.linesWithText) * 100)}% of the lines with text landed inside an article`
                  : undefined
              }
            />

            <div className="border-b border-border px-5 py-4">
              <span className="text-[13px] font-semibold text-fg-muted">
                Which document is this?
              </span>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-subtle">
                {GOVERNING_DOCS[doc].plain}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {DOC_ORDER.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDoc(kind)}
                    aria-pressed={doc === kind}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                      doc === kind
                        ? "border-brand bg-brand-soft text-brand-soft-fg"
                        : "border-border-2 bg-surface text-fg-muted hover:text-fg",
                    )}
                  >
                    {GOVERNING_DOCS[kind].label}
                    {extraction.suggestedDocument === kind ? " · looks like this" : ""}
                  </button>
                ))}
              </div>
            </div>

            {collisions.length > 0 ? (
              <div className="border-b border-border bg-warn-soft/30 px-5 py-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <AlertTriangle className="size-3.5 text-warn" />
                  {collisions.map((a) => a.number).join(", ")} already{" "}
                  {collisions.length === 1 ? "exists" : "exist"} in {GOVERNING_DOCS[doc].short}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                  These will not be imported and the text on file will not be replaced. If
                  this file is an amended copy, edit the article in the reader so the change
                  is recorded as an amendment rather than as a second Article of the same
                  number. If you meant a different document, pick it above.
                </p>
              </div>
            ) : null}

            {extraction.gaps.length > 0 ? (
              <div className="border-b border-border bg-warn-soft/30 px-5 py-4">
                {/* A gap shown is a gap a board can go and check. A gap
                    quietly filled in is a section number they will cite. */}
                <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <AlertTriangle className="size-3.5 text-warn" />
                  {extraction.gaps.length} part
                  {extraction.gaps.length === 1 ? "" : "s"} of the file could not be read as
                  an article
                </p>
                <div className="mt-2 space-y-2">
                  {extraction.gaps.map((gap, index) => (
                    <div key={index} className="text-[13px] leading-relaxed">
                      <span className="font-semibold text-fg-muted">{gap.where}: </span>
                      <span className="text-fg-muted">{gap.reason}</span>
                      {gap.preview ? (
                        <p className="mt-0.5 truncate font-mono text-[13px] text-fg-subtle">
                          {gap.preview}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {extraction.articles.length === 0 ? (
              <EmptyState
                icon={<FileSearch className="size-6" />}
                title="No headings were found"
                description="The text needs ARTICLE or Section headings on their own lines for the split to work. A scanned document usually needs its text layer restored first."
              />
            ) : (
              <div className="divide-y divide-border">
                {extraction.articles.map((article) => (
                  <ArticleRow
                    key={article.key}
                    article={article}
                    choice={choices[article.key]}
                    alreadyOnFile={onFile.has(article.number)}
                    onChange={(patch) => update(article.key, patch)}
                  />
                ))}
              </div>
            )}
          </Card>

          {extraction.articles.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={confirmImport} disabled={kept.length === 0 || imported}>
                <Check className="size-4" />
                {imported
                  ? "Added"
                  : `Add ${kept.length} article${kept.length === 1 ? "" : "s"} to ${GOVERNING_DOCS[doc].short}`}
              </Button>
              {imported ? (
                <Link
                  href="/board/documents/governing"
                  className="text-[13px] font-medium text-brand hover:underline"
                >
                  See them in the reader
                </Link>
              ) : kept.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-fg-muted">
                  Nothing is ticked. Anything marked{" "}
                  <span className="font-semibold">Needs a look</span> starts off, on purpose:
                  open it, check it against your own file, and tick the ones that came
                  through right.
                </p>
              ) : (
                <p className="text-[13px] text-fg-subtle">
                  No plain summary is written for you. Each article lands showing its exact
                  wording, and a board member writes the plain reading.
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <p className="mt-8 text-[13px] text-fg-subtle">
        <Link href="/board/documents" className="text-brand hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to documents
        </Link>
      </p>
    </>
  );
}

function ArticleRow({
  article,
  choice,
  alreadyOnFile,
  onChange,
}: {
  article: ExtractedArticle;
  choice: Choice | undefined;
  /** This number is already in the chosen document, so it cannot be imported. */
  alreadyOnFile: boolean;
  onChange: (patch: Partial<Choice>) => void;
}) {
  if (!choice) return null;
  const empty = article.text.length === 0;
  const keeping = choice.keep && !alreadyOnFile && !empty;

  return (
    <div className={cn("px-5 py-4", !keeping && "opacity-60")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={keeping}
          disabled={alreadyOnFile || empty}
          onChange={(e) => onChange({ keep: e.target.checked })}
          aria-label={`Keep ${article.number}`}
          className="mt-1 size-4 shrink-0 accent-[var(--brand)] disabled:opacity-50"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-fg-muted">{article.number}</span>
            {alreadyOnFile ? (
              <Badge tone="warn">Already on file</Badge>
            ) : empty ? (
              <Badge tone="warn">Nothing to import</Badge>
            ) : article.confidence === "clear" ? (
              <Badge tone="ok">Read cleanly</Badge>
            ) : (
              <Badge tone="warn">Needs a look</Badge>
            )}
            <span className="text-[13px] text-fg-subtle">line {article.startLine}</span>
          </div>
          <p className="mt-0.5 text-[15px] font-semibold text-fg">{article.title}</p>

          {article.concerns.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {article.concerns.map((concern, index) => (
                <li key={index} className="text-[13px] leading-relaxed text-warn">
                  {concern}
                </li>
              ))}
            </ul>
          ) : null}

          <details className="mt-2">
            <summary className="cursor-pointer text-[13px] font-medium text-brand">
              {article.text.length} paragraph{article.text.length === 1 ? "" : "s"}, as read
            </summary>
            <div className="mt-2 space-y-2">
              {article.text.map((paragraph, index) => (
                <p key={index} className="text-[13px] leading-relaxed text-fg-muted">
                  {paragraph}
                </p>
              ))}
            </div>
          </details>

          {keeping ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-fg-muted">Filed under</span>
                <select
                  value={choice.topic}
                  onChange={(e) => onChange({ topic: e.target.value as GoverningTopic })}
                  aria-label={`Topic for ${article.number}`}
                  className="h-7 rounded-md border border-border bg-surface px-2 text-[13px] font-medium text-fg outline-none"
                >
                  {(Object.keys(TOPIC_LABEL) as GoverningTopic[]).map((topic) => (
                    <option key={topic} value={topic}>
                      {TOPIC_LABEL[topic]}
                    </option>
                  ))}
                </select>
                <span className="text-[13px] font-semibold text-fg-muted">Applies to</span>
                <select
                  value={choice.affects}
                  onChange={(e) =>
                    onChange({ affects: e.target.value as Choice["affects"] })
                  }
                  aria-label={`Who ${article.number} applies to`}
                  className="h-7 rounded-md border border-border bg-surface px-2 text-[13px] font-medium text-fg outline-none"
                >
                  <option value="owners">Owners</option>
                  <option value="board">The board</option>
                  <option value="both">Everyone</option>
                </select>
              </div>

              <div>
                <p className="text-[13px] font-semibold text-fg-muted">
                  Does this settle one of the eight a buyer must be told?
                </p>
                {/* Suggested by a word match, ticked by a person. The gap
                    between those two is the whole of this screen. */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DISCLOSURE_TOPICS.map((meta) => {
                    const on = choice.disclosure.includes(meta.topic);
                    const suggested = article.suggestedDisclosure.includes(meta.topic);
                    return (
                      <button
                        key={meta.topic}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          onChange({
                            disclosure: on
                              ? choice.disclosure.filter((t) => t !== meta.topic)
                              : [...choice.disclosure, meta.topic],
                          })
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors",
                          on
                            ? "border-brand bg-brand text-brand-fg"
                            : suggested
                              ? "border-warn/40 bg-warn-soft text-fg-muted hover:text-fg"
                              : "border-border-2 bg-surface text-fg-subtle hover:text-fg",
                        )}
                      >
                        {DISCLOSURE_LABEL[meta.topic]}
                        {suggested && !on ? " ?" : ""}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-subtle">
                  The highlighted ones are where the words appear. That is a place to look,
                  not an answer, so nothing is ticked for you.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
