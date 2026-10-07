"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Inbox } from "lucide-react";
import { RequestDetail } from "./request-detail";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Segmented,
  fieldClass,
} from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { replyToast } from "@/lib/email/plain-error";
import { useToast } from "@/components/app/toast";
import { WorkOrderPanel } from "@/components/app/work-order";
import { cn, daysFromToday, formatDate, pluralize, todayIsoDate } from "@/lib/utils";
import {
  groupRequests,
  isMaintenanceRequest,
  repliedOn,
  requestStatusLabel,
  requestStatusTone,
  type RequestGroup,
} from "@/lib/request-status";
import { homeLabel } from "@/lib/wording";
import { useUrlFilter } from "@/lib/url-filter";
import {
  applyRequestFilters,
  requestFilterCounts,
  REQUEST_STEPS,
  REQUEST_STEP_LABEL,
  REQUEST_TYPES,
  REQUEST_TYPE_LABEL,
  type RequestStep,
  type RequestType,
} from "@/lib/request-filters";
import type { HomeRequest } from "@/lib/types";

const GROUPS: { key: RequestGroup; title: string; empty: string }[] = [
  { key: "decision", title: "Needs a decision", empty: "" },
  { key: "scheduling", title: "Needs scheduling", empty: "" },
  { key: "progress", title: "In progress", empty: "" },
];

export default function BoardRequests() {
  return (
    <Suspense fallback={null}>
      <RequestsScreen />
    </Suspense>
  );
}

function RequestsScreen() {
  const { community, requests, updateRequestStatus, replyToRequest, can } = useAppState();
  // A seat that may only look reads the request and the conversation and sees
  // no button that changes either.
  const canChange = can("requests");
  const { notify } = useToast();
  const showClosed = useSearchParams().get("status") === "closed";
  const allGrouped = groupRequests(requests);
  // The chips narrow what is listed and nothing else; the state model above
  // decides where a request sits. Both are in the URL.
  const [step, setStep] = useUrlFilter<RequestStep>("show", REQUEST_STEPS, "all");
  const [type, setType] = useUrlFilter<RequestType>("type", REQUEST_TYPES, "all");
  const chipCounts = requestFilterCounts(allGrouped, step, type);
  const grouped = applyRequestFilters(allGrouped, step, type);
  const openCount = grouped.decision.length + grouped.scheduling.length + grouped.progress.length;
  const anyOpen = allGrouped.decision.length + allGrouped.scheduling.length + allGrouped.progress.length > 0;
  // Denying is the one answer an owner cannot undo, so it asks once.
  const [denying, setDenying] = useState<string | null>(null);
  // Why, in the board's words. The owner is told this, so it is required.
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  // The request whose decision is being saved, so a second press waits.
  const [saving, setSaving] = useState<string | null>(null);
  // Which maintenance request has its work order form open.
  const [ordering, setOrdering] = useState<string | null>(null);
  // The one-line forms on a maintenance request: fixing it, or scheduling it.
  const [acting, setActing] = useState<{ id: string; what: "fix" | "schedule" } | null>(null);
  const [fixNote, setFixNote] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

  function stopDenying() {
    setDenying(null);
    setReason("");
    setReasonError(false);
  }

  // Said only once the decision is saved: a refused write must not read as done.
  async function decide(r: HomeRequest, status: HomeRequest["status"], note: string, said: string, tone?: "warn") {
    if (saving) return false;
    setSaving(r.id);
    const ok = await updateRequestStatus(r.id, status, note);
    setSaving(null);
    if (ok) notify(said, tone);
    return ok;
  }

  async function deny(r: HomeRequest) {
    const why = reason.trim();
    if (!why) {
      setReasonError(true);
      return;
    }
    const ok = await decide(r, "denied", `Denied. ${why}`, `Denied: ${r.title}`, "warn");
    if (ok) stopDenying();
  }

  function stopActing() {
    setActing(null);
    setFixNote("");
    setScheduleDate("");
  }

  async function markFixed(r: HomeRequest) {
    const note = fixNote.trim();
    const body = `Fixed on ${formatDate(todayIsoDate(), "long")}.${note ? ` ${note}` : ""}`;
    const ok = await decide(r, "closed", body, `${r.reference} marked fixed. The owner is told.`);
    if (ok) stopActing();
  }

  async function schedule(r: HomeRequest) {
    const body = scheduleDate ? `Scheduled for ${formatDate(scheduleDate, "long")}.` : "Scheduled.";
    const ok = await decide(r, "in-review", body, `${r.reference} scheduled. The owner is told.`);
    if (ok) stopActing();
  }

  async function reply(requestId: string, body: string) {
    const email = await replyToRequest(requestId, body);
    if (email) notify(replyToast(email), email === "failed" ? "warn" : "ok");
    return email !== false;
  }

  function actions(r: HomeRequest) {
    if (!canChange) return null;
    const only = openCount === 1;
    if (isMaintenanceRequest(r)) {
      // A streetlight is not approved or denied. It is scheduled, then fixed.
      return (
        <>
          {r.status !== "in-review" && !(r.workOrder && !r.workOrder.completedOn) ? (
            <Button variant="ghost" size="sm" onClick={() => { stopActing(); setActing({ id: r.id, what: "schedule" }); }}>
              Schedule it
            </Button>
          ) : null}
          <Button
            variant={only ? "primary" : "secondary"}
            size="sm"
            disabled={saving === r.id}
            onClick={() => { stopActing(); setActing({ id: r.id, what: "fix" }); }}
          >
            Mark fixed
          </Button>
        </>
      );
    }
    if (denying === r.id) {
      return (
        <>
          <Button variant="ghost" size="sm" onClick={stopDenying}>
            Keep open
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-danger"
            disabled={saving === r.id}
            onClick={() => void deny(r)}
          >
            Deny it
          </Button>
        </>
      );
    }
    return (
      <>
        {r.status === "submitted" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving === r.id}
            onClick={() => void decide(r, "in-review", "The board is reviewing this request.", `${r.reference} is under review`)}
          >
            Start review
          </Button>
        ) : null}
        {/* Filled only when it is the one decision on the page.
            Five filled Approve buttons in a column is five primaries, which is none. */}
        <Button
          variant={only ? "primary" : "secondary"}
          size="sm"
          disabled={saving === r.id}
          onClick={() => void decide(r, "approved", "Approved by the board.", `Approved: ${r.title}`)}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setReason("");
            setReasonError(false);
            setDenying(r.id);
          }}
        >
          Deny
        </Button>
      </>
    );
  }

  function openRow(r: HomeRequest) {
    // The deadline is a badge beside the status, not a tile where the avatar
    // goes: a row with a face and a row with a number side by side read as
    // two different kinds of thing.
    const daysLeft = r.dueDate ? Math.max(0, daysFromToday(r.dueDate)) : null;
    const replied = repliedOn(r);
    return (
      <div
        key={r.id}
        id={`req-${r.id}`}
        className="flex scroll-mt-32 items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0 lg:scroll-mt-24"
      >
        <Avatar name={r.ownerName} tone="neutral" />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium leading-snug text-fg">{r.title}</p>
          <p className="mt-0.5 text-footnote text-fg-muted">
            {r.ownerName} · {homeLabel(community, r.unit)} · {formatDate(r.submittedDate)}
          </p>
          <p className="mt-1 line-clamp-2 text-footnote leading-relaxed text-fg-muted">{r.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={requestStatusTone(r)}>{requestStatusLabel(r)}</Badge>
            {replied ? <span className="text-footnote text-fg-muted">Replied {formatDate(replied)}</span> : null}
            {daysLeft !== null && !isMaintenanceRequest(r) ? (
              <Badge tone={daysLeft <= 5 ? "warn" : "neutral"}>
                {daysLeft === 0 ? "Answer today" : `${pluralize(daysLeft, "day")} to answer`}
              </Badge>
            ) : null}
            <span className="text-footnote text-fg-subtle">
              {pluralize(r.thread.length, "update")}
              {r.attachments.length ? ` · ${pluralize(r.attachments.length, "file")}` : ""}
            </span>
            <span className="ml-auto flex gap-1.5">{actions(r)}</span>
          </div>
          {denying === r.id && canChange ? (
            <div className="mt-3">
              <label htmlFor={`deny-${r.id}`} className="text-footnote font-semibold text-fg-muted">
                Why is it denied? The owner is told.
              </label>
              <input
                id={`deny-${r.id}`}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void deny(r);
                }}
                aria-invalid={reasonError || undefined}
                aria-describedby={reasonError ? `deny-${r.id}-error` : undefined}
                placeholder="For example: the fence is taller than the rules allow"
                className={cn(fieldClass, "mt-1.5", reasonError && "border-danger")}
              />
              {reasonError ? (
                <p id={`deny-${r.id}-error`} role="alert" className="mt-1 text-footnote text-danger">
                  Give the owner a reason before you deny it.
                </p>
              ) : null}
            </div>
          ) : null}
          {acting?.id === r.id && canChange && acting.what === "fix" ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void markFixed(r);
              }}
            >
              <label htmlFor={`fix-${r.id}`} className="text-footnote font-semibold text-fg-muted">
                Fixed on {formatDate(todayIsoDate(), "long")}. Note to the owner (optional)
              </label>
              <input
                id={`fix-${r.id}`}
                value={fixNote}
                onChange={(e) => setFixNote(e.target.value)}
                placeholder="For example: the new bulb is in and the pole is checked"
                className={cn(fieldClass, "mt-1.5")}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={saving === r.id}>
                  Mark fixed and tell the owner
                </Button>
                <Button variant="ghost" size="sm" onClick={stopActing}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          {acting?.id === r.id && canChange && acting.what === "schedule" ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void schedule(r);
              }}
            >
              <label htmlFor={`schedule-${r.id}`} className="text-footnote font-semibold text-fg-muted">
                Date of the work (optional). The owner is told.
              </label>
              <input
                id={`schedule-${r.id}`}
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className={cn(fieldClass, "mt-1.5 sm:max-w-56")}
              />
              <div className="mt-2 flex gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={saving === r.id}>
                  Schedule it
                </Button>
                <Button variant="ghost" size="sm" onClick={stopActing}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          <RequestDetail request={r} canChange={canChange} onReply={reply} />
          <WorkOrderPanel
            request={r}
            editing={canChange && ordering === r.id}
            onEditingChange={(v) => setOrdering(v ? r.id : null)}
          />
        </div>
      </div>
    );
  }

  function doneRow(r: HomeRequest) {
    return (
      <div
        key={r.id}
        id={`req-${r.id}`}
        className="flex scroll-mt-32 lg:scroll-mt-24 items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
      >
        <Avatar name={r.ownerName} tone="neutral" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-fg">{r.title}</p>
          <p className="text-footnote text-fg-muted">
            {r.ownerName} · {homeLabel(community, r.unit)} · {formatDate(r.submittedDate)}
          </p>
          <RequestDetail request={r} canChange={canChange} onReply={reply} />
        </div>
        <Badge tone={requestStatusTone(r)}>{requestStatusLabel(r)}</Badge>
      </div>
    );
  }

  if (showClosed) {
    return (
      <>
        <PageHeader
          title="Requests"
          description="Every request that has been closed."
        />
        <Link href="/board/requests" className="mb-4 inline-flex text-footnote font-medium text-primary hover:underline">
          Back to open requests
        </Link>
        <Card>
          <CardHeader title="Closed" subtitle={pluralize(grouped.allClosed.length, "request")} />
          {grouped.allClosed.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="Nothing closed yet"
              description="A request closes when the board marks it fixed."
            />
          ) : null}
          {grouped.allClosed.map(doneRow)}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Requests"
        description="Requests from owners and what the board has to do next. Open one to read it all and reply."
      />

      {requests.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          <Segmented
            label="Show requests that are"
            value={step}
            onChange={setStep}
            options={REQUEST_STEPS.map((k) => ({ value: k, label: REQUEST_STEP_LABEL[k], count: chipCounts.steps[k] }))}
          />
          <Segmented
            label="Kind of request"
            value={type}
            onChange={setType}
            options={REQUEST_TYPES.filter((k) => k === "all" || k === type || chipCounts.types[k] > 0).map((k) => ({
              value: k,
              label: REQUEST_TYPE_LABEL[k],
              count: chipCounts.types[k],
            }))}
          />
        </div>
      ) : null}

      {requests.length > 0 && anyOpen && openCount + grouped.done.length + grouped.older.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Nothing matches"
            description="Choose All to see every request."
          />
        </Card>
      ) : null}

      {openCount === 0 && !anyOpen ? (
        <Card>
          <CardHeader title="Open" subtitle="Nothing waiting on the board" />
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Nothing open"
            description="New requests from owners appear here."
          />
        </Card>
      ) : (
        GROUPS.map(({ key, title }, i) =>
          grouped[key].length === 0 ? null : (
            <Card key={key} className={i > 0 ? "mt-6" : undefined}>
              <CardHeader title={title} subtitle={pluralize(grouped[key].length, "request")} />
              {grouped[key].map(openRow)}
            </Card>
          ),
        )
      )}

      {grouped.done.length > 0 || grouped.older.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="Done"
            subtitle={
              <>
                {pluralize(grouped.done.length, "request")} answered
                {grouped.older.length ? (
                  <>
                    {", "}
                    <Link href="/board/requests?status=closed" className="text-primary hover:underline">
                      {grouped.older.length} older in history
                    </Link>
                  </>
                ) : null}
              </>
            }
          />
          {grouped.done.map(doneRow)}
        </Card>
      ) : null}
    </>
  );
}
