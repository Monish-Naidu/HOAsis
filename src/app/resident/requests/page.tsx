"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useMyRequests } from "@/lib/app-state";
import { kindLabel, statusTone } from "@/lib/request-status";
import { formatDate, relativeDays } from "@/lib/utils";



export default function ResidentRequests() {
  const mine = useMyRequests();
  const open = mine.filter((r) => !["approved", "denied", "closed"].includes(r.status));
  const closed = mine.filter((r) => ["approved", "denied", "closed"].includes(r.status));

  return (
    <div className="animate-rise space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">Requests</h1>
          
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

      {closed.length ? (
        <section>
          <SectionTitle>Decided</SectionTitle>
          <Card>
            {closed.map((r, i) => (
              <RequestRow key={r.id} request={r} divided={i > 0} />
            ))}
          </Card>
        </section>
      ) : null}

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
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-fg-subtle">
            {kindLabel[request.kind]}
          </span>
          {request.dueDate && !["approved", "denied", "closed"].includes(request.status) ? (
            <span className="text-[10px] font-medium text-warn">
              board must respond {relativeDays(request.dueDate)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] font-medium text-fg">{request.title}</p>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {request.reference} · {formatDate(request.submittedDate)}
        </p>
      </div>
      <Badge tone={statusTone[request.status]}>{request.status.replace("-", " ")}</Badge>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
