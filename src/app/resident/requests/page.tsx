"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { bucketRequests, useMyRequests } from "@/lib/app-state";
import { kindLabel, statusTone } from "@/lib/request-status";
import { formatDate, relativeDays } from "@/lib/utils";



export default function ResidentRequests() {
  const mine = useMyRequests();
  const { open, decided, history } = bucketRequests(mine);

  return (
    <div className="animate-rise space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">Requests</h1>
          
        </div>
        <Link
          href="/resident/requests/new"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg"
          aria-label="New request"
        >
          <Plus className="size-4" />
        </Link>
      </div>

      {open.length ? (
        <section>
          <SectionTitle>Open</SectionTitle>
          <Card>
            {open.map((r, i) => (
              <RequestRow key={r.id} request={r} divided={i > 0} />
            ))}
          </Card>
        </section>
      ) : null}

      {decided.length ? (
        <section>
          <SectionTitle>Decided</SectionTitle>
          <Card>
            {decided.map((r, i) => (
              <RequestRow key={r.id} request={r} divided={i > 0} />
            ))}
          </Card>
        </section>
      ) : null}

      {history.length ? (
        <details className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-fg-muted [&::-webkit-details-marker]:hidden">
            History ({history.length})
            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
          </summary>
          <Card>
            {history.map((r, i) => (
              <RequestRow key={r.id} request={r} divided={i > 0} />
            ))}
          </Card>
        </details>
      ) : null}

      <p className="text-[13px] leading-relaxed text-fg-subtle">
        Requests are association records. They leave the queue when they are decided, but they
        stay here and on your unit record.
      </p>

      {!mine.length ? (
        <EmptyState
          title="No requests yet"
          description="Repairs, approvals, records."
        />
      ) : null}
    </div>
  );
}

function RequestRow({
  request,
  divided,
}: {
  request: ReturnType<typeof useMyRequests>[number];
  divided: boolean;
}) {
  return (
    <Link
      href={`/resident/requests/${request.reference}`}
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 ${
        divided ? "border-t border-border" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-fg-subtle">
            {kindLabel[request.kind]}
          </span>
          {request.dueDate && !["approved", "denied", "closed"].includes(request.status) ? (
            <span className="text-[12px] font-medium text-warn">
              board must respond {relativeDays(request.dueDate)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[15px] font-medium text-fg">{request.title}</p>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {request.reference} · {formatDate(request.submittedDate)}
        </p>
      </div>
      <Badge tone={statusTone[request.status]}>{request.status.replace("-", " ")}</Badge>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
