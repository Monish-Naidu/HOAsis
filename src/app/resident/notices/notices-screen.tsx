"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Gavel, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, textareaClass } from "@/components/ui/primitives";
import { EvidenceViewer } from "@/components/app/evidence-viewer";
import { fineLine } from "@/components/app/notice-forms";
import { useToast } from "@/components/app/toast";
import { useAppState, useCurrentHome } from "@/lib/app-state";
import { resolveCitation } from "@/lib/governing";
import type { Violation } from "@/lib/types";
import { cn, formatDate, relativeDays } from "@/lib/utils";

const STAGE: Record<
  Violation["stage"],
  { label: string; tone: "neutral" | "warn" | "danger" | "ok"; what: string }
> = {
  courtesy: {
    label: "Courtesy notice",
    tone: "neutral",
    what: "A heads up, with no fine attached. Sorting it out by the date below ends it here.",
  },
  "first-notice": {
    label: "Formal notice",
    tone: "warn",
    what: "The formal step. Fix it by the date below and there is no fine.",
  },
  hearing: {
    label: "Hearing scheduled",
    tone: "danger",
    what: "You can attend, bring someone with you, and see all the board's evidence. It is all below.",
  },
  fined: {
    label: "Fined",
    tone: "danger",
    what: "You have been fined. You can appeal. The appeal goes to the board, not to whoever raised it.",
  },
  cured: {
    label: "Closed",
    tone: "ok",
    what: "Resolved. Kept here so there is a record of what happened and when.",
  },
};

/**
 * What the association says about your home, and what it is relying on.
 *
 * There was no such screen. A notice existed on the board's side and the owner
 * got a letter, which meant the evidence was something described to them
 * rather than something they could look at. That is backwards: the whole
 * content of due process here is the accused household seeing the case before
 * they have to answer it, and every state's notice requirement says as much in
 * one form or another.
 *
 * So this is the board's own evidence, unedited, with the date and the vantage
 * on each photograph. What it never contains is who reported it. That is held
 * by the board and shown to nobody, because a rule enforced fairly stops being
 * a rule the moment it becomes a matter between two neighbours.
 */
export function NoticesScreen() {
  const { community } = useAppState();
  const home = useCurrentHome();
  const mine = home
    ? community.violations.filter((v) => v.homeId === home.id || v.unit === home.unit)
    : [];

  return (
    <div className="animate-rise space-y-6">
      <div>
        <Link
          href="/resident/requests"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          Requests
        </Link>
        <h1 className="mt-2 text-title2 font-semibold tracking-[-0.025em] text-fg">
          Notices about your home
        </h1>
        <p className="mt-1 text-body leading-relaxed text-fg-muted">
          Anything the association has raised about your home, with its evidence.
        </p>
      </div>

      {mine.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title="No notices"
            description="Notices about your home appear here, with any photos attached."
          />
        </Card>
      ) : (
        <>
          {mine.map((violation) => {
            const stage = STAGE[violation.stage];
            const cited = resolveCitation(violation.ruleCitation, community.governingDocs);
            return (
              <Card key={violation.id} className="overflow-hidden">
                <div className="border-b border-border px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={stage.tone}>{stage.label}</Badge>
                    <span className="text-footnote text-fg-subtle">
                      {violation.reference} · opened{" "}
                      {formatDate(violation.openedDate, "medium")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-headline font-semibold tracking-[-0.01em] text-fg">
                    {violation.rule}
                  </p>
                  {/* What the board asked for, in its own words, above what
                      the stage means in general. */}
                  {violation.fix ? (
                    <p className="mt-1 text-body leading-relaxed text-fg">{violation.fix}</p>
                  ) : null}
                  <p className="mt-1 text-body leading-relaxed text-fg-muted">{stage.what}</p>

                  {/* The provision, resolved so it can be read rather than
                      taken on trust. A notice that names a section nobody can
                      produce is one worth questioning. */}
                  <p className="mt-2 text-footnote text-fg-muted">
                    {cited.article ? (
                      <>
                        Rule:{" "}
                        <Link
                          href="/resident/documents/governing"
                          className="font-medium text-brand hover:underline"
                        >
                          {violation.ruleCitation}
                        </Link>
                        , {cited.article.title}
                      </>
                    ) : (
                      <>Rule: {violation.ruleCitation}</>
                    )}
                  </p>

                  {violation.stage !== "cured" ? (
                    <p className="mt-1 text-footnote font-medium text-fg">
                      {violation.stage === "fined"
                        ? fineLine(violation)
                        : `Next step ${relativeDays(violation.nextActionDate)}`}
                    </p>
                  ) : null}
                </div>

                <div className="px-4 py-4">
                  <p className="mb-2.5 text-footnote font-semibold text-fg-muted">
                    The board&apos;s evidence
                  </p>
                  <EvidenceViewer
                    photos={violation.photos}
                    emptyNote="No photos are attached to this notice. You can ask the board what it is based on."
                  />
                </div>

                {violation.stage !== "cured" ? <OpenFooter violation={violation} /> : null}
              </Card>
            );
          })}

        </>
      )}
    </div>
  );
}

/**
 * The two answers an owner has to an open notice: it is fixed, or I disagree.
 *
 * Saying it is fixed is not the end of it; the board still closes the notice.
 * But it puts the owner's word and date on the record and moves the notice to
 * the top of the board's list, which is what the owner needed from it.
 */
function OpenFooter({ violation }: { violation: Violation }) {
  const { markViolationFixed } = useAppState();
  const { notify } = useToast();
  const [saying, setSaying] = useState(false);
  const [note, setNote] = useState("");

  function send() {
    void markViolationFixed(violation.id, note).then((ok) => {
      if (!ok) return;
      setSaying(false);
      notify("Sent to the board. They close the notice once they have checked.");
    });
  }

  return (
    <div className="border-t border-border bg-surface-2 px-4 py-3.5">
      {violation.ownerFixedDate ? (
        <p className="flex items-start gap-1.5 text-footnote leading-relaxed text-fg-muted">
          <Check className="mt-0.5 size-3.5 shrink-0 text-ok" />
          <span>
            You told the board this was fixed on {formatDate(violation.ownerFixedDate, "long")}
            {violation.ownerFixedNote ? ` · ${violation.ownerFixedNote}` : ""}. They close it
            once they have checked.
          </span>
        </p>
      ) : saying ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="block">
            <span className="text-footnote font-semibold text-fg-muted">
              Anything the board should know (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Replaced the fence boards on Saturday."
              className={cn(textareaClass, "mt-1.5")}
            />
          </label>
          <div className="mt-2 flex gap-2">
            <Button type="submit" variant="primary" size="sm">
              Send
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSaying(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-footnote leading-relaxed text-fg-muted">
            Fixed it? Tell the board and they will close this. Disagree? Ask the board. They
            reply in writing.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSaying(true)}>
              <Check className="size-3.5" />I have fixed this
            </Button>
            <Link
              href="/resident/requests/new"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-2 bg-surface px-3 text-footnote font-medium text-fg transition-colors hover:bg-surface-3"
            >
              <Gavel className="size-3.5" />
              Ask the board
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
