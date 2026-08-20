import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Download,
  Mail,
  Paperclip,
} from "lucide-react";
import { Badge, Button, Card, SectionTitle } from "@/components/ui/primitives";
import { requestByReference, requests } from "@/lib/data";
import { formatDate, relativeDays } from "@/lib/utils";
import { statusTone } from "../page";

export function generateStaticParams() {
  return requests.map((r) => ({ reference: r.reference }));
}

export default async function RequestDetail({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const request = requestByReference(decodeURIComponent(reference));
  if (!request) notFound();

  const approved = request.status === "approved";

  return (
    <div className="animate-rise space-y-5">
      <Link
        href="/resident/requests"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        All requests
      </Link>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={statusTone[request.status]}>{request.status.replace("-", " ")}</Badge>
          <span className="text-[11px] text-fg-subtle">{request.reference}</span>
        </div>
        <h1 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-fg">
          {request.title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{request.summary}</p>
      </div>

      {/* The approval certificate: the thing you hand a contractor or the city. */}
      {approved && request.certificateId ? (
        <Card className="overflow-hidden border-ok/30">
          <div className="bg-ok-soft px-4 py-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-4 shrink-0 text-ok" />
              <p className="text-[13px] font-semibold text-ok">Approved {formatDate(request.decisionDate!, "long")}</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[13px] leading-relaxed text-fg-muted">
              Send it to your contractor or the permit office. They can verify it without an
              account.
            </p>
            <dl className="mt-3 space-y-1 rounded-lg bg-surface-2 p-3">
              <div className="flex justify-between text-[12px]">
                <dt className="text-fg-muted">Certificate</dt>
                <dd className="font-mono font-medium text-fg">{request.certificateId}</dd>
              </div>
              <div className="flex justify-between text-[12px]">
                <dt className="text-fg-muted">Decided by</dt>
                <dd className="font-medium text-fg">{request.decidedBy}</dd>
              </div>
              <div className="flex justify-between text-[12px]">
                <dt className="text-fg-muted">Valid through</dt>
                <dd className="font-medium text-fg">February 8, 2027</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" size="sm" className="flex-1">
                <Mail className="size-3.5" />
                Email certificate
              </Button>
              <Button variant="secondary" size="sm" className="flex-1">
                <Download className="size-3.5" />
                Download PDF
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Response clock */}
      {request.dueDate && !["approved", "denied", "closed"].includes(request.status) ? (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <p className="text-[13px] font-semibold text-fg">
                The board owes you an answer {relativeDays(request.dueDate)}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                {request.dueReason} · deadline {formatDate(request.dueDate, "long")}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Attachments */}
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
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{a.name}</span>
                <span className="tnum shrink-0 text-[11px] text-fg-muted">{a.size}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {/* Thread */}
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
                  <span className="text-[12px] font-semibold text-fg">{e.actor}</span>
                  <span className="text-[11px] text-fg-subtle">{formatDate(e.at)}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{e.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Reply */}
      {!["approved", "denied", "closed"].includes(request.status) ? (
        <Card className="p-3">
          <textarea
            rows={3}
            placeholder="Add a note or answer a question…"
            className="w-full resize-none bg-transparent px-1 py-1 text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-muted hover:text-fg"
            >
              <Paperclip className="size-3.5" />
              Attach
            </button>
            <Button variant="primary" size="sm">
              Send
            </Button>
          </div>
        </Card>
      ) : null}

      
    </div>
  );
}
