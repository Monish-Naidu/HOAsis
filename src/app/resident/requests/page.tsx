"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import Link from "next/link";
import { ChevronDown, ChevronRight, Gavel, Plus } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { bucketRequests, useAppState, useCurrentHome, useMyRequests } from "@/lib/app-state";
import { kindLabel, requestStatusLabel, requestStatusTone } from "@/lib/request-status";
import { formatDate, pluralize, relativeDays } from "@/lib/utils";
import { openNoticesForHome } from "@/lib/resident-wording";



export default function ResidentRequests() {
  const mine = useMyRequests();
  const { open, decided, history } = bucketRequests(mine);
  const { community } = useAppState();
  const home = useCurrentHome();
  // A notice against your own home used to exist only on the board's side,
  // which meant the evidence was something described to you rather than
  // something you could look at.
  const notices = home
    ? community.violations.filter((v) => v.homeId === home.id || v.unit === home.unit)
    : [];
  const openNotices = openNoticesForHome(community.violations, home);

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle
        title="Requests"
        action={
          <ButtonLink href="/resident/requests/new" variant="primary" size="md">
            <Plus className="size-3.5" />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New request</span>
          </ButtonLink>
        }
      />

      {notices.length > 0 ? (
        <Link
          href="/resident/notices"
          className={`flex items-center gap-3 rounded-card border p-4 shadow-card transition-colors ${
            openNotices.length > 0
              ? "border-warn/30 bg-warn-soft hover:bg-warn-soft/70"
              : "border-border bg-surface hover:bg-surface-2"
          }`}
        >
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
              openNotices.length > 0 ? "bg-warn/15 text-warn" : "bg-surface-3 text-fg-muted"
            }`}
          >
            <Gavel className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-fg">
              {openNotices.length > 0
                ? `${pluralize(openNotices.length, "open notice")} about your home`
                : "Notices about your home"}
            </span>
            <span className="block text-footnote leading-snug text-fg-muted">
              {openNotices.length > 0
                ? "See what the board raised, with every photo"
                : "No notices. Past ones are kept here."}
            </span>
          </span>
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
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 text-footnote font-semibold text-fg-muted [&::-webkit-details-marker]:hidden">
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
        <EmptyState
          title="No requests yet"
          description="Repairs, approvals, and other requests. Tap the + button to start one."
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
          <span className="text-footnote font-medium text-fg-subtle">
            {kindLabel[request.kind]}
          </span>
          {request.dueDate && !["approved", "denied", "closed"].includes(request.status) ? (
            <span className="text-footnote font-medium text-warn">
              board reply due {relativeDays(request.dueDate)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-body font-medium text-fg">{request.title}</p>
        <p className="mt-0.5 text-footnote text-fg-muted">
          {request.reference} · {formatDate(request.submittedDate)}
        </p>
      </div>
      <Badge tone={requestStatusTone(request)}>{requestStatusLabel(request)}</Badge>
      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
