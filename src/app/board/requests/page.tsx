"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Eye, Gavel, Inbox, Wrench } from "lucide-react";
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
import { WorkOrderPanel } from "@/components/app/work-order";
import { daysFromToday, money } from "@/lib/utils";
import { formatDate, relativeDays } from "@/lib/utils";
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
  const { community, requests, updateRequestStatus } = useAppState();
  const { notify } = useToast();
  const { open, decided, history } = bucketRequests(requests);
  const clocks = requests
    .filter((r) => r.dueDate && !["approved", "denied", "closed"].includes(r.status))
    .map((r) => ({ ...r, daysLeft: daysFromToday(r.dueDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  // Violations moved to their own page in the 2026-09-01 design; the stat
  // below keeps the pointer so a board working the queue still sees them.
  const openViolations = community.violations.filter((v) => v.stage !== "cured");
  // Work the board has taken on and not finished, in scheduled order.
  const inProgress = requests
    .filter((r) => r.workOrder && !r.workOrder.completedOn)
    .sort((a, b) =>
      (a.workOrder?.scheduledOn ?? "9999").localeCompare(b.workOrder?.scheduledOn ?? "9999"),
    );

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
        <Stat
          label="Open requests"
          value={String(open.length)}
          hint={inProgress.length ? `${inProgress.length} with work in progress` : undefined}
          icon={<Inbox className="size-4" />}
        />
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
          href="/board/violations"
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

      <div className="mt-5">
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
                <WorkOrderPanel request={r} />
              </div>
            </div>
          ))}
        </Card>

        {inProgress.length ? (
          <Card className="mt-5">
            <CardHeader
              title="Work orders"
              subtitle={`${inProgress.length} in progress`}
              icon={<Wrench className="size-4" />}
            />
            {inProgress.map((r) => {
              const w = r.workOrder!;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-fg">{r.title}</p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {r.reference} · Unit {r.unit} · {w.vendorName || "No vendor chosen yet"}
                    </p>
                  </div>
                  <div className="text-right text-[13px]">
                    <p className={w.scheduledOn ? "font-medium text-fg" : "text-fg-subtle"}>
                      {w.scheduledOn
                        ? `${formatDate(w.scheduledOn, "medium")} · ${relativeDays(w.scheduledOn)}`
                        : "Not scheduled"}
                    </p>
                    <p className="tnum text-fg-muted">
                      {w.estimateCents ? `Estimate ${money(w.estimateCents)}` : "No estimate"}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : null}
      </div>
    </>
  );
}
