"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Download,
  Mail,
  MessageSquare,
  Paperclip,
  Wrench,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { certificateMailto, certificateValidThrough } from "@/lib/request-certificate";
import { statusLabel, statusTone } from "@/lib/request-status";
import { formatDate, money, relativeDays } from "@/lib/utils";

export default function RequestDetail({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = use(params);
  const { requests } = useAppState();
  const request = requests.find((r) => r.reference === decodeURIComponent(reference));

  if (!request) {
    return (
      <EmptyState
        title="Request not found"
        description="It may have been submitted from a different account."
      />
    );
  }

  const approved = request.status === "approved";
  // From the decision on the record, not a date typed into the screen.
  const validThrough = certificateValidThrough(request);
  const openStates = ["draft", "submitted", "in-review", "info-needed"];
  const isOpen = openStates.includes(request.status);

  return (
    <div className="animate-rise space-y-5">
      <Link
        href="/resident/requests"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        All requests
      </Link>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={statusTone[request.status]}>{statusLabel[request.status]}</Badge>
          <span className="text-footnote text-fg-subtle">{request.reference}</span>
        </div>
        <h1 className="text-title3 font-semibold leading-snug tracking-[-0.02em] text-fg">
          {request.title}
        </h1>
        <p className="mt-2 text-body leading-relaxed text-fg-muted">{request.summary}</p>
      </div>

      {approved && request.certificateId ? (
        <Card className="overflow-hidden border-ok/30">
          <div className="bg-ok-soft px-4 py-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-4 shrink-0 text-ok" />
              <p className="text-body font-semibold text-ok">
                Approved {formatDate(request.decisionDate!, "long")}
              </p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-body leading-relaxed text-fg-muted">
              Send it to your contractor or the permit office.
            </p>
            <dl className="mt-3 space-y-1 rounded-lg bg-surface-2 p-3">
              <div className="flex justify-between text-footnote">
                <dt className="text-fg-muted">Certificate</dt>
                <dd className="font-mono font-medium text-fg">{request.certificateId}</dd>
              </div>
              <div className="flex justify-between text-footnote">
                <dt className="text-fg-muted">Decided by</dt>
                <dd className="font-medium text-fg">{request.decidedBy}</dd>
              </div>
              {validThrough ? (
                <div className="flex justify-between text-footnote">
                  <dt className="text-fg-muted">Valid through</dt>
                  <dd className="font-medium text-fg">{formatDate(validThrough, "long")}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3 flex gap-2">
              {/* Opens the owner's own mail with the certificate written
                  out, for them to address. */}
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  window.location.href = certificateMailto(request);
                }}
              >
                <Mail className="size-3.5" />
                Email certificate
              </Button>
              {/* The browser's print sheet, which is where "Save as PDF"
                  lives. There is no stored file to download. */}
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => window.print()}
              >
                <Download className="size-3.5" />
                Save as PDF
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {request.dueDate && isOpen ? (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <p className="text-body font-semibold text-fg">
                The board owes you an answer {relativeDays(request.dueDate)}
              </p>
              <p className="mt-0.5 text-footnote leading-snug text-fg-muted">
                {request.dueReason} · deadline {formatDate(request.dueDate, "long")}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {request.workOrder ? (
        <section>
          <SectionTitle>Work order</SectionTitle>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-fg">
                  {request.workOrder.completedOn
                    ? `Done ${formatDate(request.workOrder.completedOn, "long")}`
                    : request.workOrder.scheduledOn
                      ? `Scheduled ${formatDate(request.workOrder.scheduledOn, "long")}`
                      : `Opened ${formatDate(request.workOrder.openedOn, "long")}`}
                </p>
                <p className="mt-0.5 text-footnote leading-snug text-fg-muted">
                  {request.workOrder.vendorName || "No repair company chosen yet"}
                  {request.workOrder.scheduledOn && !request.workOrder.completedOn
                    ? ` · ${relativeDays(request.workOrder.scheduledOn)}`
                    : ""}
                </p>
              </div>
            </div>
            {request.workOrder.estimateCents || request.workOrder.costCents ? (
              <dl className="mt-3 space-y-1 rounded-lg bg-surface-2 p-3">
                {request.workOrder.estimateCents ? (
                  <div className="flex justify-between text-footnote">
                    <dt className="text-fg-muted">Estimate</dt>
                    <dd className="tnum font-medium text-fg">
                      {money(request.workOrder.estimateCents)}
                    </dd>
                  </div>
                ) : null}
                {request.workOrder.costCents ? (
                  <div className="flex justify-between text-footnote">
                    <dt className="text-fg-muted">Cost</dt>
                    <dd className="tnum font-medium text-fg">{money(request.workOrder.costCents)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {request.workOrder.notes ? (
              <p className="mt-3 text-footnote leading-relaxed text-fg-muted">
                {request.workOrder.notes}
              </p>
            ) : null}
          </Card>
        </section>
      ) : null}

      {/* The answers and the signature, as sent. The form promises a copy of
          what was signed; this is where it is. */}
      {request.submission ? (
        <section>
          <SectionTitle>What you sent</SectionTitle>
          <Card className="p-4">
            <dl className="space-y-2.5">
              {request.submission.answers
                .filter((a) => a.value)
                .map((a) => (
                  <div key={a.fieldId}>
                    <dt className="text-footnote font-semibold text-fg-muted">{a.label}</dt>
                    <dd className="mt-0.5 break-words text-body text-fg">{a.value}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-3 border-t border-border pt-3 text-footnote text-fg-muted">
              Signed by {request.submission.signature.typedName} on{" "}
              {formatDate(request.submission.signature.signedAt.slice(0, 10), "long")}
            </p>
          </Card>
        </section>
      ) : null}

      {request.attachments.length ? (
        <section>
          <SectionTitle>Attachments</SectionTitle>
          <Card>
            {request.attachments.map((a, i) => (
              <div
                key={a.name}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <Paperclip className="size-3.5 shrink-0 text-fg-subtle" />
                <span className="min-w-0 flex-1 truncate text-body text-fg">{a.name}</span>
                <span className="tnum shrink-0 text-footnote text-fg-muted">{a.size}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle>Activity</SectionTitle>
        <ol className="space-y-3">
          {request.thread.map((e) => (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    e.kind === "status"
                      ? "bg-navy-600 dark:bg-navy-300"
                      : e.actorRole === "resident"
                        ? "bg-accent"
                        : "bg-fg-subtle"
                  }`}
                />
                <span className="mt-1 w-px flex-1 bg-border" />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-footnote font-semibold text-fg">{e.actor}</span>
                  <span className="text-footnote text-fg-subtle">{formatDate(e.at)}</span>
                </div>
                <p className="mt-1 text-body leading-relaxed text-fg-muted">{e.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {isOpen ? (
        // A note box sat here with no handler behind it: Attach and Send did
        // nothing, on the one screen an owner opens while waiting. Until a
        // request carries an owner's reply, questions go to the board's inbox,
        // which does reach them.
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-footnote text-fg-muted">
            Have a question about this request, or something to add?
          </p>
          <Link
            href={`/resident/messages?subject=${encodeURIComponent(`${request.reference}: ${request.title}`)}`}
            className="inline-flex shrink-0 items-center gap-1.5 text-footnote font-medium text-primary hover:underline"
          >
            <MessageSquare className="size-3.5" />
            Message the board
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
