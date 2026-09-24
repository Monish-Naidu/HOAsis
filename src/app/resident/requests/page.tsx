"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { ChevronDown, ChevronRight, ClipboardList, Gavel, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, IconTile, SectionTitle } from "@/components/ui/primitives";
import { bucketRequests, useAppState, useCurrentOwner, useMyRequests } from "@/lib/app-state";
import { kindLabel, statusLabel, statusTone } from "@/lib/request-status";
import { formatDate, pluralize, relativeDays } from "@/lib/utils";

export default function ResidentRequests() {
  const mine = useMyRequests();
  const { open, decided, history } = bucketRequests(mine);
  const { community } = useAppState();
  const owner = useCurrentOwner();
  // A notice against your own home used to exist only on the board's side,
  // which meant the evidence was something described to you rather than
  // something you could look at.
  const notices = owner
    ? community.violations.filter((v) => v.ownerId === owner.id || v.unit === owner.unit)
    : [];
  const openNotices = notices.filter((v) => v.stage !== "cured");

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle
        title="Requests"
        action={
          <ButtonLink href="/resident/requests/new" variant="primary" size="lg" className="shrink-0">
            <Plus className="size-4" />
            New request
          </ButtonLink>
        }
      />

      {notices.length > 0 ? (
        <Link
          href="/resident/notices"
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2"
        >
          <IconTile icon={Gavel} tint={openNotices.length > 0 ? "coral" : "neutral"} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-fg">
              {openNotices.length > 0
                ? `${pluralize(openNotices.length, "open notice")} about your home`
                : "Notices about your home"}
            </span>
            <span className="block text-[13px] leading-snug text-fg-muted">
              {openNotices.length > 0
                ? "What the board is relying on, photos included"
                : "Nothing outstanding. The record is kept here."}
            </span>
          </span>
          {openNotices.length > 0 ? <Badge tone="warn">Open</Badge> : null}
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>
      ) : null}

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

      {!mine.length ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            tint="blue"
            title="No requests yet"
            description="Repairs, approvals, and anything else you need from the board."
          />
        </Card>
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
        {/* The status rides on the top line with the kind, so the title
            below gets the whole width instead of a third of it. */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-fg-subtle">
            {kindLabel[request.kind]}
            {request.dueDate && !["approved", "denied", "closed"].includes(request.status) ? (
              <span className="text-warn"> · Answer due {relativeDays(request.dueDate)}</span>
            ) : null}
          </span>
          <Badge tone={statusTone[request.status]}>{statusLabel[request.status]}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug text-fg">{request.title}</p>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          {request.reference} · {formatDate(request.submittedDate)}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
