"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { homeLabel, homeWording } from "@/lib/wording";
import type { JoinRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { homeTypesOf } from "@/lib/home-types";

/**
 * People at the door.
 *
 * Somebody typed the association's code and asked to be let in. The board
 * confirms the home they named and lets them in, which is the ordinary add
 * to the roster with the name and email already filled in; or declines.
 * A decline is a status, not a deletion, so a declined person keeps the
 * same Let them in on their row for the day the board learns it was wrong.
 * Letting somebody in is one way: taking a household off again is the
 * roster's job, with the roster's rules. Nothing here puts a person on the
 * register except the same call the Add household button makes.
 */
export function JoinRequests() {
  const { community, approveJoinRequest, declineJoinRequest } = useAppState();
  const { notify } = useToast();
  const pending = community.joinRequests.filter((j) => j.status === "pending");
  const decided = community.joinRequests.filter((j) => j.status !== "pending");
  if (pending.length === 0 && decided.length === 0) return null;

  const approve = async (request: JoinRequest, unit: string) => {
    try {
      const ok = await approveJoinRequest(request.id, unit);
      if (ok)
        notify(
          `${request.name} is on the roster at ${homeLabel(community, unit)}`,
          "ok",
        );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not add that household",
        "warn",
      );
    }
  };

  return (
    <Card className="mt-5">
      <CardHeader
        title="Asked to join"
        subtitle={
          pending.length
            ? `${pending.length === 1 ? "1 person" : `${pending.length} people`} waiting on the board`
            : "Nobody waiting"
        }
      />
      {pending.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          onApprove={(unit) => approve(request, unit)}
          onDecline={async () => {
            const ok = await declineJoinRequest(request.id);
            if (ok) notify(`Declined ${request.name}`, "info");
          }}
        />
      ))}
      {decided.length ? (
        <details className="group border-t border-border">
          <summary className="cursor-pointer list-none px-5 py-3 text-[13px] font-semibold text-fg-muted hover:text-fg">
            Decided ({decided.length})
          </summary>
          {decided.map((request) =>
            request.status === "declined" ? (
              <RequestRow
                key={request.id}
                request={request}
                onApprove={(unit) => approve(request, unit)}
              />
            ) : (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2.5 text-[13px]"
              >
                <span className="font-medium text-fg">{request.name}</span>
                <span className="text-fg-subtle">{request.email}</span>
                <span className="ml-auto flex items-center gap-2 text-fg-subtle">
                  {request.decidedOn
                    ? formatDate(request.decidedOn, "medium")
                    : null}
                  {request.decidedBy ? `by ${request.decidedBy}` : null}
                  <Badge tone="ok">Let in</Badge>
                </span>
              </div>
            ),
          )}
        </details>
      ) : null}
    </Card>
  );
}

/**
 * One person and the decision on them. With onDecline it is a pending row
 * with both answers; without it, a declined row that still takes Let them in.
 */
function RequestRow({
  request,
  onApprove,
  onDecline,
}: {
  request: JoinRequest;
  onApprove: (unit: string) => Promise<void>;
  onDecline?: () => Promise<void>;
}) {
  const { community } = useAppState();
  const [unit, setUnit] = useState(request.unit);
  const [busy, setBusy] = useState(false);
  const taken = community.owners.some((o) => o.unit === unit.trim());
  const noun = homeTypesOf(community.profile).length
    ? homeWording(community).numberExample
    : "Unit";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!unit.trim() || busy) return;
        setBusy(true);
        void onApprove(unit.trim()).finally(() => setBusy(false));
      }}
      className={
        onDecline
          ? "border-t border-border px-5 py-4 first:border-t-0"
          : "border-t border-border px-5 py-3"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-fg">{request.name}</p>
          <p className="text-[13px] text-fg-muted">
            {request.email} · asked {formatDate(request.requestedOn, "medium")}
            {request.unit
              ? ` · says ${homeLabel(community, request.unit)}`
              : ""}
          </p>
          {!onDecline ? (
            <p className="mt-1 flex items-center gap-2 text-[13px] text-fg-subtle">
              <Badge tone="neutral">Declined</Badge>
              {request.decidedOn
                ? formatDate(request.decidedOn, "medium")
                : null}
              {request.decidedBy ? `by ${request.decidedBy}` : null}
            </p>
          ) : null}
          {request.note ? (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-fg-muted">
              &ldquo;{request.note}&rdquo;
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-fg-muted">
            {noun}
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="12"
              aria-label="Unit or lot"
              className="h-9 w-24 min-w-0 rounded-lg border border-border bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-brand sm:w-48"
            />
          </label>
          {/* Secondary, always: a list of several requests was a column of
              filled buttons, and the page's own filled button is elsewhere. */}
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={!unit.trim() || taken || busy}
          >
            Let them in
          </Button>
          {onDecline ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void onDecline()}
            >
              Decline
            </Button>
          ) : null}
        </div>
      </div>
      {taken ? (
        <p className="mt-2 text-[13px] text-warn">
          {homeLabel(community, unit.trim())} is already on the roster. If they
          bought it, record a sale on that home instead.
        </p>
      ) : null}
    </form>
  );
}
