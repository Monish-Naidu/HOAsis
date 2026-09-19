"use client";

import Link from "next/link";
import { Eye, Inbox } from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { bucketRequests, useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { WorkOrderPanel } from "@/components/app/work-order";
import { daysFromToday, formatDate, pluralize } from "@/lib/utils";
import type { RequestStatus } from "@/lib/types";

const statusTone: Record<RequestStatus, "ok" | "danger" | "info" | "warn" | "neutral"> = {
  approved: "ok",
  denied: "danger",
  "in-review": "info",
  "info-needed": "warn",
  submitted: "neutral",
  closed: "neutral",
  draft: "neutral",
};

export default function BoardRequests() {
  const { requests, updateRequestStatus } = useAppState();
  const { notify } = useToast();
  const { open, decided, history } = bucketRequests(requests);
  // Work the board has taken on and not finished. Each one's panel sits in
  // its own row below; this is only the count under the stat.
  const inProgress = requests.filter((r) => r.workOrder && !r.workOrder.completedOn);

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          label="Open requests"
          value={String(open.length)}
          hint={inProgress.length ? `${inProgress.length} with work in progress` : undefined}
          icon={<Inbox className="size-4" />}
        />
        <Stat
          label="Decided"
          value={String(decided.length)}
          tone="ok"
          hint={history.length ? `${history.length} in history` : undefined}
        />
      </div>

      <div className="mt-5">
        {/* Queue */}
        <Card>
          <CardHeader title="Open queue" subtitle={`${open.length} awaiting a decision`} />
          {open.map((r) => {
            // A request the board owes an answer on wears the days it has
            // left where the avatar would be. One list, one place to look.
            const daysLeft = r.dueDate ? daysFromToday(r.dueDate) : null;
            return (
            <div
              key={r.id}
              className="flex items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
            >
              {daysLeft === null ? (
                <Avatar name={r.ownerName} tone="neutral" />
              ) : (
                <div
                  className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-lg ${
                    daysLeft <= 5 ? "bg-warn-soft text-warn" : "bg-surface-3 text-fg-muted"
                  }`}
                  aria-label={`${pluralize(Math.max(0, daysLeft), "day")} to answer`}
                >
                  <span className="tnum text-[17px] font-bold leading-none">{Math.max(0, daysLeft)}</span>
                  <span className="text-[12px] font-semibold uppercase">days</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-fg">{r.title}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">
                  {r.ownerName} · Unit {r.unit} · {formatDate(r.submittedDate)}
                  {r.dueDate ? ` · Answer by ${formatDate(r.dueDate)}` : ""}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-fg-muted">
                  {r.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[r.status]}>{r.status.replace("-", " ")}</Badge>
                  <span className="text-[13px] text-fg-subtle">
                    {pluralize(r.thread.length, "update")}
                    {r.attachments.length ? ` · ${pluralize(r.attachments.length, "file")}` : ""}
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
                <WorkOrderPanel request={r} />
              </div>
            </div>
            );
          })}
        </Card>

      </div>
    </>
  );
}
