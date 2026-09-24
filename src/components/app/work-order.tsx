"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, Wrench } from "lucide-react";
import { Badge, Button, Card, Select } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { HomeRequest, WorkOrder } from "@/lib/types";
import { formatDate, money, relativeDays, todayIsoDate } from "@/lib/utils";

/**
 * A work order on a maintenance request.
 *
 * The request is the owner's; the order is the board's answer to it. Who is
 * coming, when, and roughly for how much. Every product in the comparison
 * has this, and every board without it has the same facts spread across a
 * text thread with the plumber. The owner sees the order on their request,
 * so "when is somebody coming" stops being a phone call.
 */

const FIELD =
  "h-9 w-full rounded-lg border border-border-2 bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-brand";
const LABEL = "mb-1 block text-[13px] font-semibold text-fg-muted";

function dollarsToCents(value: string): number | undefined {
  const parsed = Math.round(Number(value.replace(/[^0-9.]/g, "")) * 100);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function centsToDollars(cents?: number): string {
  return cents ? (cents / 100).toFixed(2) : "";
}

export function WorkOrderPanel({ request }: { request: HomeRequest }) {
  const { community, setWorkOrder } = useAppState();
  const { notify } = useToast();
  const order = request.workOrder;
  const [editing, setEditing] = useState(false);
  const [finishing, setFinishing] = useState(false);

  if (request.kind !== "maintenance") return null;

  if (!order && !editing) {
    return (
      <div className="mt-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Wrench className="size-3.5" />
          Open a work order
        </Button>
      </div>
    );
  }

  if (editing || !order) {
    return (
      <WorkOrderForm
        request={request}
        initial={order}
        vendors={community.vendors}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          setWorkOrder(request.id, next);
          setEditing(false);
          notify(
            order
              ? `Work order on ${request.reference} updated.`
              : `Work order opened on ${request.reference}. The owner sees it on their request.`,
          );
        }}
      />
    );
  }

  const done = Boolean(order.completedOn);

  return (
    <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Wrench className="size-3.5 text-fg-muted" />
        <span className="text-[13px] font-semibold text-fg">Work order</span>
        <Badge tone={done ? "ok" : order.scheduledOn ? "info" : "neutral"}>
          {done ? "Done" : order.scheduledOn ? "Scheduled" : "Open"}
        </Badge>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
        {order.vendorName || "No vendor chosen yet"}
        {order.scheduledOn
          ? ` · ${formatDate(order.scheduledOn, "medium")}${done ? "" : ` (${relativeDays(order.scheduledOn)})`}`
          : ""}
        {order.costCents
          ? ` · cost ${money(order.costCents)}`
          : order.estimateCents
            ? ` · estimate ${money(order.estimateCents)}`
            : ""}
        {done ? ` · finished ${formatDate(order.completedOn!, "medium")}` : ""}
      </p>
      {order.notes ? (
        <p className="mt-1 text-[13px] leading-relaxed text-fg-subtle">{order.notes}</p>
      ) : null}

      {finishing ? (
        <FinishForm
          order={order}
          onCancel={() => setFinishing(false)}
          onSave={(costCents) => {
            setWorkOrder(request.id, { ...order, completedOn: todayIsoDate(), costCents });
            setFinishing(false);
            notify(`${request.reference} marked done.`);
          }}
        />
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!done ? (
            <Button variant="secondary" size="sm" onClick={() => setFinishing(true)}>
              <Check className="size-3.5" />
              Mark done
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWorkOrder(request.id, null);
              notify(`Work order taken off ${request.reference}.`, "info");
            }}
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

function WorkOrderForm({
  request,
  initial,
  vendors,
  onCancel,
  onSave,
}: {
  request: HomeRequest;
  initial: WorkOrder | undefined;
  vendors: { id: string; name: string; service: string }[];
  onCancel: () => void;
  onSave: (order: WorkOrder) => void;
}) {
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [vendorName, setVendorName] = useState(initial?.vendorId ? "" : (initial?.vendorName ?? ""));
  const [scheduledOn, setScheduledOn] = useState(initial?.scheduledOn ?? "");
  const [estimate, setEstimate] = useState(centsToDollars(initial?.estimateCents));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const chosen = vendors.find((v) => v.id === vendorId);

  return (
    <Card
      as="form"
      className="mt-2 bg-surface-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          openedOn: initial?.openedOn ?? todayIsoDate(),
          vendorId: chosen?.id,
          vendorName: chosen?.name ?? vendorName.trim(),
          scheduledOn: scheduledOn || undefined,
          estimateCents: dollarsToCents(estimate),
          costCents: initial?.costCents,
          completedOn: initial?.completedOn,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="space-y-3 px-4 py-3.5">
        <p className="text-[13px] font-semibold text-fg">
          {initial ? "Edit the work order" : `Work order for ${request.reference}`}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>Who is doing it</span>
            <Select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full [&>select]:h-10"
            >
              <option value="">Not chosen yet</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.service}
                </option>
              ))}
            </Select>
            {!vendorId ? (
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Or a name not on the vendor list"
                className={`mt-1.5 ${FIELD}`}
              />
            ) : null}
          </label>
          <label className="block">
            <span className={LABEL}>Scheduled for</span>
            <input
              type="date"
              value={scheduledOn}
              onChange={(e) => setScheduledOn(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Estimate</span>
            <input
              inputMode="decimal"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="0.00"
              className={`tnum ${FIELD}`}
            />
          </label>
        </div>
        <label className="block">
          <span className={LABEL}>Notes for the owner and the vendor</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Access through the side gate. Owner will be home after 4."
            className="w-full rounded-lg border border-border-2 bg-surface px-2.5 py-2 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm">
            {initial ? "Save" : "Open the work order"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FinishForm({
  order,
  onCancel,
  onSave,
}: {
  order: WorkOrder;
  onCancel: () => void;
  onSave: (costCents: number | undefined) => void;
}) {
  const [cost, setCost] = useState(centsToDollars(order.costCents ?? order.estimateCents));
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(dollarsToCents(cost));
      }}
    >
      <label className="block">
        <span className={LABEL}>What it cost</span>
        <input
          inputMode="decimal"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0.00"
          className={`tnum w-32 ${FIELD}`}
          autoFocus
        />
      </label>
      <Button type="submit" variant="primary" size="sm">
        <Check className="size-3.5" />
        Done
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
