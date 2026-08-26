"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FilePlus2, FileText, Send, Trash2, Vote } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { BylawReader } from "@/components/app/bylaw-reader";
import { AmendmentDiff } from "@/components/app/amendment-diff";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { AmendmentKind, BylawAmendment } from "@/lib/types";
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
  const articles = community.bylaws;

  const [amendments, setAmendments] = useState<BylawAmendment[]>(community.bylawAmendments);
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

    const amendment: BylawAmendment = {
      id: `amd-${Date.now()}`,
      kind: drafting,
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
      thresholdLabel: amendmentThreshold(articles),
    };
    setAmendments((list) => [amendment, ...list]);
    reset();
    notify(
      stage === "open"
        ? "Sent to owners. Voting opens once the notice period passes."
        : "Saved as a draft. Nobody has been notified.",
    );
  }

  if (articles.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Documents"
          title="Bylaws"
          description="Add the text of your bylaws and owners can search them, read a plain summary of each article, and vote on changes with the exact wording in front of them."
        />
        <Card>
          <EmptyState
            icon={<FileText className="size-6" />}
            title="Only the file is here"
            description="The bylaws are uploaded as a document, so owners can download them but cannot search them or see what an amendment would change."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Bylaws"
        description="What owners see, and where a change starts."
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

      <Callout
        tone="info"
        title={`Changing these bylaws takes ${amendmentThreshold(articles)}`}
        icon={<Vote className="size-4" />}
      >
        Owners must receive the marked up wording before voting opens. Drafting it here is
        what produces that notice, so the vote is on the words rather than on a description
        of them.
      </Callout>

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
                <select
                  value={targetId}
                  onChange={(e) => pickTarget(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
                >
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number}: {a.title}
                    </option>
                  ))}
                </select>
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
                    thresholdLabel: amendmentThreshold(articles),
                  }}
                  current={drafting === "add" ? undefined : target}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save("open")}>
                <Send className="size-4" />
                Send to owners and open voting
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
          The bylaws as they stand
        </h2>
        <BylawReader
          articles={articles}
          amendedIds={amendments
            .filter((a) => a.stage === "open")
            .map((a) => a.articleId ?? "")
            .filter(Boolean)}
        />
      </div>

      <p className="mt-6 text-[13px] text-fg-subtle">
        <Link href="/admin/documents" className="text-brand hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to documents
        </Link>
      </p>
    </>
  );
}

/**
 * The threshold, read out of the association's own amendment article rather
 * than assumed.
 *
 * Every set of bylaws states its own bar, and it is usually a share of all
 * homes rather than of votes cast, which is a much higher hurdle than boards
 * expect. Hardcoding a majority here would quietly certify failed amendments.
 */
function amendmentThreshold(articles: { text: string[]; title: string }[]): string {
  const article = articles.find((a) => a.title.toLowerCase().includes("amendment"));
  const match = article?.text
    .join(" ")
    .match(/([a-z-]+(?:\s+[a-z-]+)?)\s+percent of the total voting interests/i);
  return match ? `${match[1]} percent of all homes` : "the share stated in your bylaws";
}
