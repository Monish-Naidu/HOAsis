"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Select } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { homeLabel } from "@/lib/wording";
import type { JoinRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { bestMatch, homeOption, seatPlan } from "./join-match";

/**
 * People at the door.
 *
 * Somebody typed the association's code and asked to be let in. The board
 * reads what they typed, picks their home from the register (the picker
 * starts on the best match), and lets them in on it. Nothing is created from
 * what they typed: a home is added only through the picker's last choice,
 * which names the label it will make. A home that already has another owner
 * offers a second owner or a sale.
 *
 * A decline is a status, not a deletion, so a declined person keeps the same
 * Let them in on their row for the day the board learns it was wrong.
 */

/** The picker's value for "add what they typed as a new home". */
const NEW_HOME = "__new__";

export function AskedToJoin({
  onRecordSale,
}: {
  /** Opens the sale form on a home, with the buyer filled in. Absent when this seat may not record sales. */
  onRecordSale?: (ownerId: string, buyer: { name: string; email: string }) => void;
}) {
  const { community, approveJoinRequest, seatJoinRequest, declineJoinRequest } = useAppState();
  const { notify } = useToast();
  const pending = community.joinRequests.filter((j) => j.status === "pending");
  const decided = community.joinRequests.filter((j) => j.status !== "pending");
  // Nobody waiting is not news. The card shows up when somebody asks, and
  // what was decided is in each household's history.
  if (pending.length === 0) return null;

  const letIn = async (request: JoinRequest, choice: string, mode: "seat" | "second" | "new") => {
    try {
      if (mode === "new") {
        const ok = await approveJoinRequest(request.id, request.unit.trim());
        if (ok) notify(`${request.name} is on the roster at ${homeLabel(community, request.unit.trim())}`, "ok");
        return;
      }
      const home = community.owners.find((o) => o.id === choice);
      const ok = await seatJoinRequest(request.id, choice, mode === "second");
      if (ok && home) {
        notify(
          mode === "second"
            ? `${request.name} is now a second owner of ${homeLabel(community, home.unit)}`
            : `${request.name} is on the roster at ${homeLabel(community, home.unit)}`,
          "ok",
        );
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not let them in", "warn");
    }
  };

  return (
    <Card className="mt-5">
      <CardHeader
        title="Asked to join"
        subtitle={`${pending.length === 1 ? "1 person" : `${pending.length} people`} waiting on the board`}
      />
      {pending.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          onLetIn={(choice, mode) => letIn(request, choice, mode)}
          onRecordSale={onRecordSale}
          onDecline={async () => {
            const ok = await declineJoinRequest(request.id);
            if (ok) notify(`Declined ${request.name}`, "info");
          }}
        />
      ))}
      {decided.length ? (
        <details className="group border-t border-border">
          <summary className="cursor-pointer list-none px-5 py-3 text-footnote font-semibold text-fg-muted hover:text-fg">
            Decided ({decided.length})
          </summary>
          {decided.map((request) =>
            request.status === "declined" ? (
              <RequestRow
                key={request.id}
                request={request}
                onLetIn={(choice, mode) => letIn(request, choice, mode)}
                onRecordSale={onRecordSale}
              />
            ) : (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2.5 text-footnote"
              >
                <span className="font-medium text-fg">{request.name}</span>
                <span className="text-fg-subtle">{request.email}</span>
                <span className="ml-auto flex items-center gap-2 text-fg-subtle">
                  {request.decidedOn ? formatDate(request.decidedOn, "medium") : null}
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
  onLetIn,
  onRecordSale,
  onDecline,
}: {
  request: JoinRequest;
  onLetIn: (choice: string, mode: "seat" | "second" | "new") => Promise<void>;
  onRecordSale?: (ownerId: string, buyer: { name: string; email: string }) => void;
  onDecline?: () => Promise<void>;
}) {
  const { community, accounts } = useAppState();
  const typed = request.unit.trim();
  const homes = [...community.owners].sort((a, b) =>
    a.unit.localeCompare(b.unit, undefined, { numeric: true }),
  );
  // Starts on the best match and on nothing otherwise. The board can always
  // change it, and nothing happens until they press a button.
  const [choice, setChoice] = useState(() => bestMatch(community, community.owners, typed)?.id ?? "");
  const [busy, setBusy] = useState(false);

  const home = homes.find((o) => o.id === choice) ?? null;
  const taken = Boolean(typed) && community.owners.some((o) => o.unit === typed);
  const plan = home
    ? seatPlan(home, request, accounts.some((a) => a.ownerId === home.id))
    : null;
  const first = request.name.split(/\s+/)[0] || request.name;

  const run = (mode: "seat" | "second" | "new") => {
    if (busy || !choice) return;
    setBusy(true);
    void onLetIn(choice, mode).finally(() => setBusy(false));
  };

  return (
    <div
      className={
        onDecline
          ? "border-t border-border px-5 py-4 first:border-t-0"
          : "border-t border-border px-5 py-3"
      }
    >
      <div className="min-w-0">
        <p className="text-body font-semibold text-fg">{request.name}</p>
        <p className="text-footnote text-fg-muted">
          {request.email} · asked {formatDate(request.requestedOn, "medium")}
          {typed ? ` · says ${homeLabel(community, typed)}` : ""}
        </p>
        {!onDecline ? (
          <p className="mt-1 flex items-center gap-2 text-footnote text-fg-subtle">
            <Badge tone="neutral">Declined</Badge>
            {request.decidedOn ? formatDate(request.decidedOn, "medium") : null}
            {request.decidedBy ? `by ${request.decidedBy}` : null}
          </p>
        ) : null}
        {request.note ? (
          <p className="mt-1.5 max-w-xl text-footnote leading-relaxed text-fg-muted">
            &ldquo;{request.note}&rdquo;
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-label={`Home for ${request.name}`}
          className="w-full min-w-0 sm:w-80"
        >
          <option value="">Choose their home</option>
          {homes.map((o) => (
            <option key={o.id} value={o.id}>
              {homeOption(community, o)}
            </option>
          ))}
          <option value={NEW_HOME} disabled={!typed || taken}>
            {typed
              ? `Add as a new home: ${homeLabel(community, typed)}`
              : "Add as a new home (they typed no home)"}
          </option>
        </Select>

        {/* Secondary, always: a list of several requests was a column of
            filled buttons, and the page's own filled button is elsewhere. */}
        {choice === NEW_HOME ? (
          <Button variant="secondary" size="sm" disabled={busy || !typed || taken} onClick={() => run("new")}>
            Let them in
          </Button>
        ) : plan === "different" ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => run("second")}>
            Add as a second owner
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={busy || !choice} onClick={() => run("seat")}>
            Let them in
          </Button>
        )}
        {onDecline ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void onDecline()}>
            Decline
          </Button>
        ) : null}
      </div>

      {choice === NEW_HOME && typed ? (
        <p className="mt-2 text-footnote text-fg-muted">
          Adds {homeLabel(community, typed)} to the register with {first} as its owner.
        </p>
      ) : null}
      {plan === "different" && home ? (
        <p className="mt-2 text-footnote text-fg-muted">
          {homeLabel(community, home.unit)} already has an owner, {home.displayName}. {first} can share it, or
          if {first} bought it,{" "}
          {onRecordSale ? (
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={() => onRecordSale(home.id, { name: request.name, email: request.email })}
            >
              record a sale for {homeLabel(community, home.unit)}
            </button>
          ) : (
            "record a sale for that home"
          )}
          .
        </p>
      ) : null}
    </div>
  );
}
