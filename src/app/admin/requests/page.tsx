"use client";

import Link from "next/link";
import { AlertTriangle, Camera, Clock, Eye, Gavel, Inbox } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { bucketRequests, useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { daysFromToday } from "@/lib/utils";
import { formatDate, relativeDays } from "@/lib/utils";
import { resolveCitation } from "@/lib/governing";
import type { CitationMatch } from "@/lib/governing";
import type { RequestStatus, Violation } from "@/lib/types";

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

const statusTone: Record<RequestStatus, "ok" | "danger" | "info" | "warn" | "neutral"> = {
  approved: "ok",
  denied: "danger",
  "in-review": "info",
  "info-needed": "warn",
  submitted: "neutral",
  closed: "neutral",
  draft: "neutral",
};

const stageMeta: Record<Violation["stage"], { tone: "ok" | "warn" | "danger" | "neutral"; label: string }> =
  {
    courtesy: { tone: "neutral", label: "Courtesy notice" },
    "first-notice": { tone: "warn", label: "First notice" },
    hearing: { tone: "danger", label: "Hearing set" },
    fined: { tone: "danger", label: "Fined" },
    cured: { tone: "ok", label: "Cured" },
  };

export default function BoardRequests() {
  const { community, requests, updateRequestStatus } = useAppState();
  const { notify } = useToast();
  const { open, decided, history } = bucketRequests(requests);
  const clocks = requests
    .filter((r) => r.dueDate && !["approved", "denied", "closed"].includes(r.status))
    .map((r) => ({ ...r, daysLeft: daysFromToday(r.dueDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  // Was the Mehr Meadows fixture, imported directly, so a brand new
  // association saw four violations against households it has never had.
  const violations = community.violations;
  const openViolations = violations.filter((v) => v.stage !== "cured");

  return (
    <>
      <PageHeader
        eyebrow="Owner requests"
        title="Requests"
        
        action={
          <Link
            href="/resident/requests"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-2 px-4 text-[15px] font-medium text-fg hover:bg-surface-2"
          >
            <Eye className="size-3.5" />
            See the resident&apos;s view
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open requests" value={String(open.length)} icon={<Inbox className="size-4" />} />
        <Stat
          label="Has a deadline"
          value={String(clocks.length)}
          tone="warn"
          hint={clocks[0] ? `Soonest: ${relativeDays(clocks[0].dueDate!)}` : undefined}
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="Open violations"
          value={String(openViolations.length)}
          icon={<Gavel className="size-4" />}
        />
        <Stat
          label="Decided"
          value={String(decided.length)}
          tone="ok"
          hint={history.length ? `${history.length} in history` : undefined}
        />
      </div>

      {/* Clock queue */}
      <Card className="mt-5">
        <CardHeader
          title="On the clock"
          
          icon={<AlertTriangle className="size-4" />}
        />
        {clocks.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
          >
            <div
              className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-lg ${
                r.daysLeft <= 5 ? "bg-warn-soft text-warn" : "bg-surface-3 text-fg-muted"
              }`}
            >
              <span className="tnum text-[17px] font-bold leading-none">{r.daysLeft}</span>
              <span className="text-[12px] font-semibold uppercase">days</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-fg">{r.title}</p>
                <Badge tone={statusTone[r.status]}>{r.status.replace("-", " ")}</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-fg-muted">
                {r.reference} · Unit {r.unit} · {r.ownerName}
              </p>
              <p className="mt-0.5 text-[13px] text-fg-subtle">{r.dueReason}</p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  updateRequestStatus(r.id, "in-review", "Board picked this up for review.");
                  notify(`${r.reference} moved to in review`);
                }}
              >
                Respond
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateRequestStatus(r.id, "info-needed", "Board asked the owner for more detail.");
                  notify(`Asked unit ${r.unit} for more detail`, "info");
                }}
              >
                Ask for detail
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Queue */}
        <Card>
          <CardHeader title="Open queue" subtitle={`${open.length} awaiting a decision`} />
          {open.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
            >
              <Avatar name={r.ownerName} tone="neutral" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-fg">{r.title}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">
                  {r.ownerName} · Unit {r.unit} · {formatDate(r.submittedDate)}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                  {r.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[r.status]}>{r.status.replace("-", " ")}</Badge>
                  <span className="text-[13px] text-fg-subtle">
                    {r.thread.length} updates
                    {r.attachments.length ? ` · ${r.attachments.length} files` : ""}
                  </span>
                  <span className="ml-auto flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        updateRequestStatus(r.id, "approved", "Approved by the board.");
                        notify(`${r.reference} approved`);
                      }}
                      className="h-7 rounded-md bg-brand px-2.5 text-[13px] font-medium text-brand-fg"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateRequestStatus(r.id, "denied", "Denied by the board.");
                        notify(`${r.reference} denied`, "warn");
                      }}
                      className="h-7 rounded-md px-2.5 text-[13px] font-medium text-danger hover:bg-danger-soft"
                    >
                      Deny
                    </button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* Violations */}
        <Card>
          <CardHeader
            title="Violations"
            
            icon={<Gavel className="size-4" />}
          />
          {violations.map((v) => {
            const meta = stageMeta[v.stage];
            // A citation that resolves is a link into the words the notice
            // rests on. One that does not is a finding: either it was
            // mistyped, or the document it names has never been put into
            // words here. Both are worth knowing before the hearing.
            const cited = resolveCitation(v.ruleCitation, community.governingDocs);
            return (
              <div
                key={v.id}
                className="flex items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
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
                        href="/admin/documents/governing"
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
                </div>
                <div className="shrink-0 text-right">
                  {v.fineCents ? (
                    <p className="tnum text-[15px] font-semibold text-danger">
                      ${(v.fineCents / 100).toFixed(0)}
                    </p>
                  ) : null}
                  {v.photoCount ? (
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[13px] text-fg-subtle">
                      <Camera className="size-3" />
                      {v.photoCount}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}
