"use client";

import { Inbox } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { bucketRequests, useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { WorkOrderPanel } from "@/components/app/work-order";
import { daysFromToday, formatDate, pluralize } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/request-status";
import { homeLabel } from "@/lib/wording";

export default function BoardRequests() {
  const { community, requests, updateRequestStatus } = useAppState();
  const { notify } = useToast();
  const { open, decided, history } = bucketRequests(requests);
  // Work the board has taken on and not finished. Each one's panel sits in
  // its own row below; this is only the count under the stat.
  const inProgress = requests.filter((r) => r.workOrder && !r.workOrder.completedOn);

  return (
    <>
      <PageHeader
        title="Requests"
        description="Requests from owners and where each one stands."
      />

      {/* Two lists, not tiles and a list. The count sits in each header where
          it belongs, and a decided request is still findable rather than gone. */}
      <Card>
        <CardHeader
          title="Open"
          subtitle={
            open.length === 0
              ? "Nothing waiting on the board"
              : `${pluralize(open.length, "request")} awaiting a decision${
                  inProgress.length ? `, ${inProgress.length} with work in progress` : ""
                }`
          }
        />
        {open.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Nothing open"
            description="New requests from owners appear here."
          />
        ) : null}
        {open.map((r, index) => {
            // The deadline is a badge beside the status, not a tile where the
            // avatar goes: a row with a face and a row with a number side by
            // side read as two different kinds of thing.
            const daysLeft = r.dueDate ? Math.max(0, daysFromToday(r.dueDate)) : null;
            return (
            <div
              key={r.id}
              id={`req-${r.id}`}
              className="flex scroll-mt-32 items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0 lg:scroll-mt-24"
            >
              <Avatar name={r.ownerName} tone="neutral" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-fg">{r.title}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">
                  {r.ownerName} · {homeLabel(community, r.unit)} · {formatDate(r.submittedDate)}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                  {r.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                  {daysLeft !== null ? (
                    <Badge tone={daysLeft <= 5 ? "warn" : "neutral"}>
                      {daysLeft === 0 ? "Answer today" : `${pluralize(daysLeft, "day")} to answer`}
                    </Badge>
                  ) : null}
                  <span className="text-[13px] text-fg-subtle">
                    {pluralize(r.thread.length, "update")}
                    {r.attachments.length ? ` · ${pluralize(r.attachments.length, "file")}` : ""}
                  </span>
                  <span className="ml-auto flex gap-1.5">
                    {/* Filled only when it is the one decision on the page.
                        Five filled Approve buttons in a column is five
                        primaries, which is none. */}
                    <Button
                      variant={open.length === 1 && index === 0 ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => {
                        updateRequestStatus(r.id, "approved", "Approved by the board.");
                        notify(`${r.reference} approved`);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => {
                        updateRequestStatus(r.id, "denied", "Denied by the board.");
                        notify(`${r.reference} denied`, "warn");
                      }}
                    >
                      Deny
                    </Button>
                  </span>
                </div>
                <WorkOrderPanel request={r} />
              </div>
            </div>
            );
          })}
      </Card>

      {decided.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="Decided"
            subtitle={`${pluralize(decided.length, "request")} answered${
              history.length ? `, ${history.length} older in history` : ""
            }`}
          />
          {decided.map((r) => (
            <div
              key={r.id}
              id={`req-${r.id}`}
              className="flex scroll-mt-32 lg:scroll-mt-24 items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
            >
              <Avatar name={r.ownerName} tone="neutral" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-fg">{r.title}</p>
                <p className="text-[13px] text-fg-muted">
                  {r.ownerName} · {homeLabel(community, r.unit)} · {formatDate(r.submittedDate)}
                </p>
              </div>
              <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
