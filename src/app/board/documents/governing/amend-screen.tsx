"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FilePlus2, FileText, Send, Trash2, Vote } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Segmented,
  Select,
} from "@/components/ui/primitives";
import { GoverningReader } from "@/components/app/governing-reader";
import { AmendmentDiff } from "@/components/app/amendment-diff";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { AmendmentKind, GoverningAmendment, GoverningDoc } from "@/lib/types";
import {
  GOVERNING_DOCS,
  amendmentThreshold,
  articlesIn,
  documentsPresent,
} from "@/lib/governing";
import { policyTemplates } from "@/lib/data/policy-templates";
import type { PolicyTemplate } from "@/lib/data/policy-templates";
import { formatDate } from "@/lib/utils";

const STAGE_TONE = {
  draft: "neutral",
  open: "warn",
  passed: "ok",
  failed: "danger",
  withdrawn: "neutral",
} as const;

const STAGE_LABEL = {
  draft: "Draft, not yet sent",
  open: "Open for voting",
  passed: "Passed",
  failed: "Did not pass",
  withdrawn: "Withdrawn",
} as const;

export function AmendScreen() {
  const { community } = useAppState();
  const { notify } = useToast();
  const all = community.governingDocs;
  const present = documentsPresent(all);

  /**
   * One document at a time.
   *
   * Amending is scoped to a document because the answer to "what does this
   * take" is different for each of them, and a screen that lets a board pick
   * Article VII without saying which Article VII is how the wrong instrument
   * gets amended.
   */
  const [doc, setDoc] = useState<GoverningDoc>(present[0] ?? "bylaws");
  const articles = articlesIn(all, doc);
  const meta = GOVERNING_DOCS[doc];
  const threshold = amendmentThreshold(all, doc);
  const boardAdopted = doc === "rules";

  const [amendments, setAmendments] = useState<GoverningAmendment[]>(community.governingAmendments);
  const [drafting, setDrafting] = useState<AmendmentKind | null>(null);
  const [targetId, setTargetId] = useState(articles[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [plain, setPlain] = useState("");
  const [rationale, setRationale] = useState("");

  const target = articles.find((a) => a.id === targetId);

  function reset() {
    setDrafting(null);
    setNumber("");
    setTitle("");
    setBody("");
    setPlain("");
    setRationale("");
  }

  function startDraft(kind: AmendmentKind) {
    setDrafting(kind);
    const first = articles[0];
    if (kind === "add") {
      setNumber("");
      setTitle("");
      setBody("");
    } else if (first) {
      setTargetId(first.id);
      setNumber(first.number);
      setTitle(first.title);
      // Amending starts from the current wording, because nobody retypes an
      // article from scratch and a blank box is how a paragraph gets dropped.
      setBody(kind === "remove" ? "" : first.text.join("\n\n"));
    }
  }

  /**
   * Loads a starter policy into the drafting form.
   *
   * A starter, not an adoption. The words land in the same boxes a board would
   * have typed them into, and the recorded vote at the end is what gives them
   * force. The reasoning for shipping these for rules and not for the
   * declaration is in `docs/decisions/shipping-document-templates.md`.
   */
  function startFromTemplate(template: PolicyTemplate) {
    setDrafting("add");
    setNumber(template.suggestedNumber);
    setTitle(template.title);
    setBody(template.text.join("\n\n"));
    setPlain(template.plain);
    setRationale(template.why);
  }

  function pickTarget(id: string) {
    setTargetId(id);
    const article = articles.find((a) => a.id === id);
    if (!article) return;
    setNumber(article.number);
    setTitle(article.title);
    if (drafting !== "remove") setBody(article.text.join("\n\n"));
  }

  function save(stage: "draft" | "open") {
    if (!drafting) return;
    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    const amendment: GoverningAmendment = {
      id: `amd-${Date.now()}`,
      kind: drafting,
      document: doc,
      articleId: drafting === "add" ? undefined : targetId,
      number: number.trim() || "New article",
      title: title.trim() || "Untitled",
      text: drafting === "remove" ? [] : paragraphs,
      plain: plain.trim(),
      topic: target?.topic ?? "governance",
      affects: target?.affects ?? "both",
      rationale: rationale.trim(),
      proposedBy: "Board of Directors",
      proposedOn: community.asOf,
      stage,
      thresholdLabel: threshold,
    };
    setAmendments((list) => [amendment, ...list]);
    reset();
    notify(
      stage !== "open"
        ? "Saved as a draft. Nobody has been notified."
        : boardAdopted
          ? "On the agenda. The board adopts this at a meeting, with no owner vote."
          : "Sent to owners. Voting opens once the notice period passes.",
    );
  }

  if (all.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Documents"
          title="Governing documents"
          description="Import the text of your governing documents so owners can search them and vote on changes."
        />
        <Card>
          <EmptyState
            icon={<FileText className="size-6" />}
            title="Only the files are here"
            description="These are files, so owners can download them but not search them."
            action={
              <ButtonLink href="/board/documents/import" variant="primary" size="md">
                Import the text
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Governing documents"
        description="What owners see, and how to propose a change."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => startDraft("amend")}>
              <FileText className="size-4" />
              Amend
            </Button>
            <Button variant="secondary" size="sm" onClick={() => startDraft("add")}>
              <FilePlus2 className="size-4" />
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => startDraft("remove")}>
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
        }
      />

      {/* Which document, before anything else. The three are not the same
          instrument and they are not changed the same way, and a board that
          picks the wrong one has amended nothing. */}
      <Segmented
        label="Which document"
        value={doc}
        onChange={(kind) => {
          setDoc(kind);
          reset();
          const first = articlesIn(all, kind)[0];
          if (first) setTargetId(first.id);
        }}
        options={present.map((kind) => ({ value: kind, label: GOVERNING_DOCS[kind].label }))}
        className="mb-4 pointer-coarse:[&>button]:h-9"
      />

      <Callout
        tone={boardAdopted ? "warn" : "info"}
        title={
          boardAdopted
            ? "The board adopts a rule on its own, which is why this layer is the risky one"
            : `Changing this takes ${threshold}`
        }
        icon={<Vote className="size-4" />}
      >
        {boardAdopted
          ? "No owner vote is needed, so nothing here stops a rule that goes further than the declaration allows. A rule that contradicts the document above it is void, and the time to catch that is now rather than at a hearing."
          : `${meta.plain} Owners must receive the marked up wording before voting opens. Drafting it here is what produces that notice, so the vote is on the words rather than on a description of them.`}
      </Callout>

      {/* Offered for the rules layer and nowhere else. A board already holds
          the authority to adopt a rule; it does not hold the authority to be
          handed a covenant we wrote and record it against everybody's land. */}
      {boardAdopted && !drafting ? (
        <Card className="mt-5">
          <CardHeader
            icon={<FilePlus2 className="size-4" />}
            title="Policies most associations are expected to have"
            subtitle="Templates to edit and adopt. Nothing changes until the board votes."
          />
          <div className="divide-y divide-border">
            {policyTemplates.map((template) => {
              const already = articles.some(
                (a) => a.title.toLowerCase() === template.title.toLowerCase(),
              );
              return (
                <div key={template.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-fg">{template.title}</p>
                      {already ? <Badge tone="ok">Already adopted</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                      {template.why}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-subtle">
                      {template.basis}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startFromTemplate(template)}
                  >
                    Start from this
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-fg-subtle">
            These are starting points, not legal advice, and they are offered for rules
            only. Check each one against your declaration before adopting it: a rule that
            goes further than the document above it is void. We do not supply covenant or
            bylaw text, because those bind a home and the words should be your attorney&rsquo;s.
          </p>
        </Card>
      ) : null}

      {drafting ? (
        <Card className="mt-5">
          <CardHeader
            icon={<FileText className="size-4" />}
            title={
              drafting === "add"
                ? "New article"
                : drafting === "remove"
                  ? "Remove an article"
                  : "Amend an article"
            }
            subtitle="Owners see this side by side with the current wording"
            action={
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
            }
          />
          <div className="space-y-4 px-5 py-4">
            {drafting !== "add" ? (
              <label className="block">
                <span className="text-[13px] font-semibold text-fg-muted">Which article</span>
                <Select
                  value={targetId}
                  onChange={(e) => pickTarget(e.target.value)}
                  className="mt-1.5 w-full [&>select]:h-10"
                >
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number}: {a.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-semibold text-fg-muted">Number</span>
                  <input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Article XIV"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold text-fg-muted">Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Leasing"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
                  />
                </label>
              </div>
            )}

            {drafting !== "remove" ? (
              <label className="block">
                <span className="text-[13px] font-semibold text-fg-muted">
                  The wording, one paragraph per block
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">
                What this means, in plain words
              </span>
              <textarea
                value={plain}
                onChange={(e) => setPlain(e.target.value)}
                rows={2}
                placeholder="A neighbor should understand this without a lawyer."
                className="mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Why</span>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={2}
                placeholder="What happened that makes this worth changing."
                className="mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
              />
            </label>

            {/* The board sees the same diff owners will, before sending it. */}
            <div className="rounded-card border border-border bg-surface-2 p-4">
              <p className="text-[13px] font-semibold text-fg-muted">
                What owners will see
              </p>
              <div className="mt-3">
                <AmendmentDiff
                  amendment={{
                    id: "preview",
                    kind: drafting,
                    articleId: drafting === "add" ? undefined : targetId,
                    number,
                    title,
                    text: body
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean),
                    plain,
                    topic: target?.topic ?? "governance",
                    affects: target?.affects ?? "both",
                    rationale,
                    proposedBy: "Board of Directors",
                    proposedOn: community.asOf,
                    stage: "draft",
                    document: doc,
                    thresholdLabel: threshold,
                  }}
                  current={drafting === "add" ? undefined : target}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save("open")}>
                <Send className="size-4" />
                {boardAdopted
                  ? "Put on the board agenda"
                  : "Send to owners and open voting"}
              </Button>
              <Button variant="secondary" onClick={() => save("draft")}>
                Save as a draft
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {amendments.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">
            Proposed changes
          </h2>
          {amendments.map((amendment) => (
            <Card key={amendment.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STAGE_TONE[amendment.stage]}>{STAGE_LABEL[amendment.stage]}</Badge>
                <span className="text-[13px] text-fg-muted">
                  {amendment.kind === "add"
                    ? "Adds an article"
                    : amendment.kind === "remove"
                      ? "Removes an article"
                      : "Changes the wording"}
                </span>
                <span className="text-[13px] text-fg-subtle">
                  {amendment.proposedBy}, {formatDate(amendment.proposedOn, "medium")}
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
                  <AmendmentDiff
                    amendment={amendment}
                    current={articles.find((a) => a.id === amendment.articleId)}
                  />
                </div>
              </details>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em] text-fg">
          {meta.label} as it stands
        </h2>
        <GoverningReader
          articles={articles}
          amendedIds={amendments
            .filter((a) => a.stage === "open")
            .map((a) => a.articleId ?? "")
            .filter(Boolean)}
        />
      </div>

      {/* Importing lives here, with the text it produces, rather than as a
          card on Documents beside the files. */}
      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fg-subtle">
        <Link href="/board/documents" className="text-accent hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to documents
        </Link>
        <Link href="/board/documents/import" className="text-accent hover:underline">
          Import the text of another document
        </Link>
      </p>
    </>
  );
}

