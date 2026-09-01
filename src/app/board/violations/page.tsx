"use client";

import Link from "next/link";
import { AlertTriangle, Camera, Gavel } from "lucide-react";
import { useState } from "react";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { daysFromToday, formatDate, pluralize, relativeDays } from "@/lib/utils";
import { resolveCitation } from "@/lib/governing";
import { photoConcerns } from "@/lib/violations";
import { EvidenceViewer } from "@/components/app/evidence-viewer";
import { ReportQueue } from "@/components/app/report-queue";
import type { CitationMatch } from "@/lib/governing";
import type { Violation } from "@/lib/types";

/**
 * Enforcement, on its own page since the 2026-09-01 design. It lived inside
 * Requests, which buried the one queue that can end in a hearing under the
 * one that ends in a yes or no.
 */

/**
 * Why a citation did not land, said so a board can fix it.
 *
 * An unresolved citation is not a display problem. It means the notice names a
 * provision nobody can produce, and "which provision are you relying on" is
 * the first question at a hearing.
 */
const CITATION_PROBLEM: Record<NonNullable<CitationMatch["problem"]>, string> = {
  "no-document": "does not name which document",
  "not-in-this-document": "names no article that exists",
  "document-not-loaded": "that document is not on file as text",
};

const stageMeta: Record<Violation["stage"], { tone: "ok" | "warn" | "danger" | "neutral"; label: string }> =
  {
    courtesy: { tone: "neutral", label: "Courtesy notice" },
    "first-notice": { tone: "warn", label: "First notice" },
    hearing: { tone: "danger", label: "Hearing set" },
    fined: { tone: "danger", label: "Fined" },
    cured: { tone: "ok", label: "Cured" },
  };

export default function BoardViolations() {
  const { community } = useAppState();
  const violations = community.violations;
  const open = violations.filter((v) => v.stage !== "cured");
  const cured = violations.filter((v) => v.stage === "cured");
  const nextAction = open
    .filter((v) => v.nextActionDate)
    .sort((a, b) => (a.nextActionDate < b.nextActionDate ? -1 : 1))[0];
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);

  return (
    <>
      <PageHeader eyebrow="Enforcement" title="Violations" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open violations" value={String(open.length)} icon={<Gavel className="size-4" />} />
        <Stat
          label="Next action"
          value={nextAction ? relativeDays(nextAction.nextActionDate) : "None"}
          tone={
            nextAction && daysFromToday(nextAction.nextActionDate) <= 5 ? "warn" : "neutral"
          }
          hint={nextAction ? `${nextAction.reference} · Unit ${nextAction.unit}` : undefined}
        />
        <Stat label="Cured" value={String(cured.length)} tone="ok" />
        <Stat
          label="Fines outstanding"
          value={String(open.filter((v) => v.fineCents).length)}
          hint="Open notices that carry a fine"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open notices" icon={<Gavel className="size-4" />} />
          {violations.map((v) => {
            const meta = stageMeta[v.stage];
            // A citation that resolves is a link into the words the notice
            // rests on. One that does not is a finding: either it was
            // mistyped, or the document it names has never been put into
            // words here. Both are worth knowing before the hearing.
            const cited = resolveCitation(v.ruleCitation, community.governingDocs);
            const concerns = photoConcerns(v.photos);
            return (
              <div
                key={v.id}
                className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-fg">{v.rule}</p>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-muted">
                    {v.reference} · Unit {v.unit} · {v.ownerName}
                  </p>
                  <p className="mt-0.5 text-[13px] text-fg-subtle">
                    {cited.article ? (
                      <Link
                        href="/board/documents/governing"
                        className="font-medium text-brand hover:underline"
                        title={cited.article.title}
                      >
                        {v.ruleCitation}
                      </Link>
                    ) : (
                      <span className="font-medium text-warn">
                        {v.ruleCitation} · {CITATION_PROBLEM[cited.problem ?? "no-document"]}
                      </span>
                    )}{" "}
                    · opened {formatDate(v.openedDate)}
                    {v.stage !== "cured" ? ` · next action ${relativeDays(v.nextActionDate)}` : ""}
                  </p>
                  {cited.article ? (
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {cited.article.title}
                      {cited.parsed.section
                        ? `, at section ${cited.parsed.section}`
                        : ""}
                    </p>
                  ) : null}
                  {/* Where a notice sits on contestable evidence, the board is
                      told here rather than at the hearing. */}
                  {concerns.length > 0 ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-warn">
                      <AlertTriangle className="size-3" />
                      {pluralize(concerns.length, "photograph")} worth checking before this
                      goes further
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  {v.fineCents ? (
                    <p className="tnum text-[15px] font-semibold text-danger">
                      ${(v.fineCents / 100).toFixed(0)}
                    </p>
                  ) : null}
                  {/* A count told the board how many photographs existed and
                      told the accused household nothing. The evidence is now
                      something both sides can open. */}
                  <button
                    type="button"
                    onClick={() => setOpenEvidence(openEvidence === v.id ? null : v.id)}
                    aria-expanded={openEvidence === v.id}
                    className="mt-0.5 flex items-center justify-end gap-1 text-[13px] font-medium text-brand hover:underline"
                  >
                    <Camera className="size-3" />
                    {v.photos.length === 0
                      ? "No evidence"
                      : `${v.photos.length} photo${v.photos.length === 1 ? "" : "s"}`}
                  </button>
                </div>
                {openEvidence === v.id ? (
                  <div className="mt-3 w-full">
                    <EvidenceViewer photos={v.photos} showConcerns />
                    <p className="mt-2 text-[13px] leading-relaxed text-fg-subtle">
                      Unit {v.unit} sees exactly these photographs, with the same dates and
                      the same note of where each was taken from.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </Card>

        <ReportQueue />
      </div>
    </>
  );
}
