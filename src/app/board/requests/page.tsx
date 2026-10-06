"use client";

import { useState } from "react";

import { Inbox, Wrench } from "lucide-react";
import { RequestDetail } from "./request-detail";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  fieldClass,
} from "@/components/ui/primitives";
import { bucketRequests, useAppState } from "@/lib/app-state";
import { replyToast } from "@/lib/email/plain-error";
import { useToast } from "@/components/app/toast";
import { WorkOrderPanel } from "@/components/app/work-order";
import { cn, daysFromToday, formatDate, pluralize } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/request-status";
import { homeLabel } from "@/lib/wording";
import type { HomeRequest } from "@/lib/types";

export default function BoardRequests() {
  const { community, requests, updateRequestStatus, replyToRequest, can } = useAppState();
  // A seat that may only look reads the request and the conversation and sees
  // no button that changes either.
  const canChange = can("requests");
  const { notify } = useToast();
  const { open, decided, history } = bucketRequests(requests);
  // Work the board has taken on and not finished. Each one's panel sits in
  // its own row below; this is only the count under the stat.
  const inProgress = requests.filter((r) => r.workOrder && !r.workOrder.completedOn);
  // Denying is the one answer an owner cannot undo, so it asks once.
  const [denying, setDenying] = useState<string | null>(null);
  // Why, in the board's words. The owner is told this, so it is required.
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  // The request whose decision is being saved, so a second press waits.
  const [saving, setSaving] = useState<string | null>(null);
  // Which maintenance request has its work order form open.
  const [ordering, setOrdering] = useState<string | null>(null);

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

  async function reply(requestId: string, body: string) {
    const email = await replyToRequest(requestId, body);
    if (email) notify(replyToast(email), email === "failed" ? "warn" : "ok");
    return email !== false;
  }

  return (
    <>
      <PageHeader
        title="Requests"
        description="Requests from owners and where each one stands. Open one to read it all and reply."
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
                <p className="text-body font-medium leading-snug text-fg">{r.title}</p>
                <p className="mt-0.5 text-footnote text-fg-muted">
                  {r.ownerName} · {homeLabel(community, r.unit)} · {formatDate(r.submittedDate)}
                </p>
                <p className="mt-1 line-clamp-2 text-footnote leading-relaxed text-fg-muted">
                  {r.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                  {daysLeft !== null ? (
                    <Badge tone={daysLeft <= 5 ? "warn" : "neutral"}>
                      {daysLeft === 0 ? "Answer today" : `${pluralize(daysLeft, "day")} to answer`}
                    </Badge>
                  ) : null}
                  <span className="text-footnote text-fg-subtle">
                    {pluralize(r.thread.length, "update")}
                    {r.attachments.length ? ` · ${pluralize(r.attachments.length, "file")}` : ""}
                  </span>
                  <span className="ml-auto flex gap-1.5">
                    {!canChange ? null : r.kind === "maintenance" ? (
                      // A streetlight is not approved or denied. It is fixed,
                      // usually through the work order below.
                      <>
                      {!r.workOrder && ordering !== r.id ? (
                        <Button variant="ghost" size="sm" onClick={() => setOrdering(r.id)}>
                          <Wrench className="size-3.5" />
                          Open a work order
                        </Button>
                      ) : null}
                      <Button
                        variant={open.length === 1 && index === 0 ? "primary" : "secondary"}
                        size="sm"
                        disabled={saving === r.id}
                        onClick={() =>
                          void decide(r, "closed", "Fixed. Closed by the board.", `${r.reference} marked fixed`)
                        }
                      >
                        Mark fixed
                      </Button>
                      </>
                    ) : denying === r.id ? (
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
                    ) : (
                      <>
                        {/* Filled only when it is the one decision on the page.
                            Five filled Approve buttons in a column is five
                            primaries, which is none. */}
                        <Button
                          variant={open.length === 1 && index === 0 ? "primary" : "secondary"}
                          size="sm"
                          disabled={saving === r.id}
                          onClick={() =>
                            void decide(r, "approved", "Approved by the board.", `Approved: ${r.title}`)
                          }
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
                    )}
                  </span>
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
                <RequestDetail request={r} canChange={canChange} onReply={reply} />
                <WorkOrderPanel
                  request={r}
                  editing={canChange && ordering === r.id}
                  onEditingChange={(v) => setOrdering(v ? r.id : null)}
                />
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
              <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
