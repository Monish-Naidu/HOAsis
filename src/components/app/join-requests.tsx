"use client";

import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { homeLabel, homeWording } from "@/lib/wording";
import type { JoinRequest } from "@/lib/types";
import { formatDate, pluralize } from "@/lib/utils";

/**
 * People at the door.
 *
 * Somebody typed the association's code and asked to be let in. The board
 * confirms the home they named and lets them in, which is the ordinary add
 * to the roster with the name and email already filled in; or declines,
 * which is the end of it. Nothing here puts a person on the register except
 * the same call the Add household button makes.
 */
export function JoinRequests() {
  const { community, approveJoinRequest, declineJoinRequest } = useAppState();
  const { notify } = useToast();
  const pending = community.joinRequests.filter((j) => j.status === "pending");
  const decided = community.joinRequests.filter((j) => j.status !== "pending");
  if (pending.length === 0 && decided.length === 0) return null;

  return (
    <Card className="mt-5">
      <CardHeader
        title="Asked to join"
        subtitle={
          pending.length
            ? `${pluralize(pending.length, "person")} waiting on the board`
            : "Nobody waiting"
        }
        icon={<DoorOpen className="size-4" />}
      />
      {pending.map((request) => (
        <PendingRow
          key={request.id}
          request={request}
          onApprove={async (unit) => {
            try {
              const ok = await approveJoinRequest(request.id, unit);
              if (ok) notify(`${request.name} is on the roster at ${homeLabel(community, unit)}`, "ok");
            } catch (error) {
              notify(error instanceof Error ? error.message : "Could not add that household", "warn");
            }
          }}
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
          {decided.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2.5 text-[13px]"
            >
              <span className="font-medium text-fg">{request.name}</span>
              <span className="text-fg-subtle">{request.email}</span>
              <span className="ml-auto flex items-center gap-2 text-fg-subtle">
                {request.decidedOn ? formatDate(request.decidedOn, "medium") : null}
                {request.decidedBy ? `by ${request.decidedBy}` : null}
                <Badge tone={request.status === "approved" ? "ok" : "neutral"}>
                  {request.status === "approved" ? "Let in" : "Declined"}
                </Badge>
              </span>
            </div>
          ))}
        </details>
      ) : null}
    </Card>
  );
}

function PendingRow({
  request,
  onApprove,
  onDecline,
}: {
  request: JoinRequest;
  onApprove: (unit: string) => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const { community } = useAppState();
  const [unit, setUnit] = useState(request.unit);
  const [busy, setBusy] = useState(false);
  const taken = community.owners.some((o) => o.unit === unit.trim());
  const noun = community.profile?.propertyType ? homeWording(community).numberExample : "Unit";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!unit.trim() || busy) return;
        setBusy(true);
        void onApprove(unit.trim()).finally(() => setBusy(false));
      }}
      className="border-t border-border px-5 py-4 first:border-t-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-fg">{request.name}</p>
          <p className="text-[13px] text-fg-muted">
            {request.email} · asked {formatDate(request.requestedOn, "medium")}
            {request.unit ? ` · says ${homeLabel(community, request.unit).toLowerCase()}` : ""}
          </p>
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
              className="h-9 w-20 rounded-lg border border-border bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-brand"
            />
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={!unit.trim() || taken || busy}>
            Let them in
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void onDecline()}>
            Decline
          </Button>
        </div>
      </div>
      {taken ? (
        <p className="mt-2 text-[13px] text-warn">
          {homeLabel(community, unit.trim())} is already on the roster. If they bought it, record a
          sale on that home instead.
        </p>
      ) : null}
    </form>
  );
}
