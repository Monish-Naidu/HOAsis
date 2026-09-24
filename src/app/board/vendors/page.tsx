"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Landmark,
  Paperclip,
  Plus,
  Receipt,
  ShieldAlert,
  StickyNote,
  Trash2,
  Truck,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { useState } from "react";
import { useAppState, useVendorGaps } from "@/lib/app-state";
import { InvoiceInbox } from "@/components/app/invoice-inbox";
import { RecordPayment } from "@/components/app/record-payment";
import { useToast } from "@/components/app/toast";
import type { Payout } from "@/lib/types";
import { daysFromToday, formatDate, money, relativeDays } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";
import { vendorDecisions } from "@/lib/metrics";

const PAYOUT_STATUS = {
  paid: { label: "Paid", tone: "ok" },
  "in-transit": { label: "In transit", tone: "warn" },
  scheduled: { label: "Scheduled", tone: "info" },
  "needs-approval": { label: "Needs approval", tone: "warn" },
} as const;

const field =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand";

export default function BoardVendors() {
  const gaps = useVendorGaps();
  const { community, vendors, payouts, markW9Requested, addVendor, removeVendor } = useAppState();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    service: "",
    achEnabled: true,
    w9OnFile: false,
  });

  // With bills waiting, the first one's action is the page's filled button,
  // so Add vendor steps down to secondary.
  const decisions = vendorDecisions(community).count;

  function saveVendor() {
    if (!draft.name.trim()) return;
    addVendor({
      id: `v-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: draft.name.trim(),
      service: draft.service.trim() || "Services",
      achEnabled: draft.achEnabled,
      w9OnFile: draft.w9OnFile,
      ytdPaidCents: 0,
      defaultCategory: "Repairs & maintenance",
    });
    notify(
      draft.w9OnFile ? `Added ${draft.name}` : `Added ${draft.name}. W-9 requested by email.`,
    );
    setDraft({ name: "", service: "", achEnabled: true, w9OnFile: false });
    setAdding(false);
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Vendors, their invoices, and payments."
        action={
          // Each form carries its own Cancel, so the header offers the two
          // ways in and gets out of the way once one is open.
          recording || adding ? undefined : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="md"
                disabled={vendors.length === 0}
                onClick={() => setRecording(true)}
              >
                <Receipt className="size-3.5" />
                Record a payment
              </Button>
              <Button
                variant={decisions > 0 ? "secondary" : "primary"}
                size="md"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-3.5" />
                Add vendor
              </Button>
            </div>
          )
        }
      />

      {recording ? <RecordPayment onClose={() => setRecording(false)} /> : null}

      {adding ? (
        <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-6">
          <CardHeader
            title="New vendor"
            subtitle={
              moduleOn("vendor-tax-forms")
                ? "Over $600 a year, the IRS needs a W-9 from them in January"
                : "Who they are and what they do for you"
            }
          />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Cascade Grounds Co."
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">Service</span>
              <input
                value={draft.service}
                onChange={(e) => setDraft({ ...draft, service: e.target.value })}
                placeholder="Grounds and irrigation"
                className={field}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3">
            {moduleOn("vendor-tax-forms") ? (
              <>
                <label className="flex items-center gap-2 text-[15px] text-fg">
                  <Checkbox
                    checked={draft.achEnabled}
                    onChange={(e) => setDraft({ ...draft, achEnabled: e.target.checked })}
                  />
                  Pays by ACH
                </label>
                <label className="flex items-center gap-2 text-[15px] text-fg">
                  <Checkbox
                    checked={draft.w9OnFile}
                    onChange={(e) => setDraft({ ...draft, w9OnFile: e.target.checked })}
                  />
                  W-9 already on file
                </label>
              </>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={!draft.name.trim()} onClick={saveVendor}>
                Save vendor
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* The inbox comes first because it is the work. Vendor records and the
          payment trail are what the work leaves behind. */}
      <InvoiceInbox />

      {/* Two callouts, only when there is something to do. The count tiles
          that used to sit here restated these and added averages nobody could
          act on. */}
      {moduleOn("vendor-tax-forms") && gaps.missingW9.length ? (
        <Callout
          tone="danger"
          className="mt-6"
          icon={<ShieldAlert className="size-4" />}
          title={`${gaps.missingW9[0].name} has no W-9 on file`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                markW9Requested(gaps.missingW9[0].id);
                notify(`W-9 requested from ${gaps.missingW9[0].name}`);
              }}
            >
              Request W-9
            </Button>
          }
        >
          Paid {money(gaps.missingW9[0].ytdPaidCents)} this year, past the $600 line for a
          1099-NEC. Without the W-9 the January filing will be wrong.
        </Callout>
      ) : null}

      {gaps.expiringCoi.length ? (
        <Callout
          tone="warn"
          className="mt-6"
          icon={<Landmark className="size-4" />}
          title={
            gaps.expiringCoi.length === 1
              ? `${gaps.expiringCoi[0].name}'s insurance certificate expires ${relativeDays(gaps.expiringCoi[0].coiExpires ?? "")}`
              : `${gaps.expiringCoi.length} insurance certificates expire within 60 days`
          }
        >
          {gaps.expiringCoi.length === 1
            ? "Ask for the renewed certificate before the next visit. An uninsured vendor on your property is your problem."
            : gaps.expiringCoi.map((v) => v.name).join(", ")}
        </Callout>
      ) : null}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Vendor list" subtitle="Everyone the association pays" />
          {vendors.length === 0 ? (
            <EmptyState
              icon={<Truck className="size-5" />}
              tint="amber"
              title="No vendors yet"
              // The header's Add vendor is the way in; a second one here put
              // the same action on the screen twice.
              description="Add the people the association pays: landscaping, the pool, insurance."
            />
          ) : (
            <>
              {/* On a phone, a list: name and what was paid on one line,
                  the service and the paperwork under it. */}
              <ul className="divide-y divide-border sm:hidden">
                {vendors.map((v) => (
                  <li
                    key={v.id}
                    id={`vendor-${v.id}`}
                    className="flex scroll-mt-32 items-start gap-2 px-5 py-3 lg:scroll-mt-24"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[15px] font-medium text-fg">{v.name}</p>
                        <p className="tnum shrink-0 text-[15px] font-semibold text-fg">
                          {money(v.ytdPaidCents, { cents: false })}
                        </p>
                      </div>
                      <p className="truncate text-[13px] text-fg-muted">{v.service}</p>
                      <VendorBadges vendor={v} className="mt-1.5" />
                    </div>
                    <RemoveVendor
                      name={v.name}
                      onRemove={() => {
                        const undo = removeVendor(v.id);
                        notify(`Removed ${v.name}`, "warn", { label: "Undo", onClick: undo });
                      }}
                    />
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                      <th className="px-5 py-2.5 font-semibold">Vendor</th>
                      <th className="px-3 py-2.5 font-semibold">On file</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Paid this year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr
                        key={v.id}
                        id={`vendor-${v.id}`}
                        className="scroll-mt-32 border-b border-border text-[15px] transition-colors last:border-b-0 hover:bg-surface-2 lg:scroll-mt-24"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-fg">{v.name}</p>
                          <p className="text-[13px] text-fg-muted">{v.service}</p>
                        </td>
                        <td className="px-3 py-3">
                          <VendorBadges vendor={v} />
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center justify-end gap-2">
                            <span className="tnum font-semibold text-fg">
                              {money(v.ytdPaidCents, { cents: false })}
                            </span>
                            <RemoveVendor
                              name={v.name}
                              onRemove={() => {
                                const undo = removeVendor(v.id);
                                notify(`Removed ${v.name}`, "warn", { label: "Undo", onClick: undo });
                              }}
                            />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* A record, not a queue. A payment still short of a signature is a
            row in To approve above; here it only wears its status. */}
        <Card className="lg:col-span-2">
          <CardHeader title="Payments" subtitle="Every payment the association has made" />
          {payouts.length === 0 ? (
            <p className="px-5 py-6 text-[15px] text-fg-muted">
              No payments yet. Paying an approved bill puts it here.
            </p>
          ) : (
            payouts.map((p) => <PayoutRow key={p.id} payout={p} />)
          )}
        </Card>
      </div>
    </>
  );
}

/** How a vendor is paid and what paperwork is on file, as badges. */
function VendorBadges({
  vendor: v,
  className,
}: {
  vendor: ReturnType<typeof useAppState>["vendors"][number];
  className?: string;
}) {
  const coiDays = v.coiExpires ? daysFromToday(v.coiExpires) : null;
  const coiSoon = coiDays !== null && coiDays < 60;
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {/* By exception: ACH is the normal case and said so on every row. */}
      {v.achEnabled ? null : <Badge tone="warn">Pays by check</Badge>}
      {moduleOn("vendor-tax-forms") ? (
        v.w9OnFile ? (
          <Badge tone="neutral">W-9</Badge>
        ) : (
          <Badge tone="danger" dot={false}>
            <AlertTriangle className="size-2.5" />
            No W-9
          </Badge>
        )
      ) : null}
      {v.coiExpires ? (
        <Badge tone={coiSoon ? "warn" : "neutral"}>
          Insurance {coiSoon ? relativeDays(v.coiExpires) : formatDate(v.coiExpires)}
        </Badge>
      ) : null}
    </div>
  );
}

function RemoveVendor({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* One payment, with its note and the invoice it settled                       */
/* -------------------------------------------------------------------------- */

function PayoutRow({ payout: p }: { payout: Payout }) {
  const { invoices, isRemote, setPayoutNotes } = useAppState();
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.notes ?? "");
  const invoice = p.invoiceId ? invoices.find((i) => i.id === p.invoiceId) : undefined;
  const approved = p.approvals.length >= p.approvalsRequired;

  function save() {
    setPayoutNotes(p.id, draft);
    notify(draft.trim() ? "Note saved" : "Note removed");
    setEditing(false);
  }

  return (
    <div
      id={`payout-${p.id}`}
      className="scroll-mt-32 lg:scroll-mt-24 border-b border-border px-5 py-3.5 target:bg-brand-soft/40 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-fg">{p.vendor}</p>
          <p className="text-[13px] text-fg-muted">{p.invoiceNumber}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum text-[15px] font-semibold text-fg">
            {money(p.amountCents, { cents: false })}
          </p>
          <Badge tone={PAYOUT_STATUS[p.status].tone} className="mt-0.5">
            {PAYOUT_STATUS[p.status].label}
          </Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-subtle">
        <span className="font-medium uppercase">{p.method}</span>
        <span>
          {p.status === "paid" ? "landed" : "lands"}{" "}
          {daysFromToday(p.expectedDate) >= -60
            ? relativeDays(p.expectedDate)
            : formatDate(p.expectedDate)}
        </span>
        <span className="inline-flex items-center gap-1">
          {approved ? (
            <CheckCircle2 className="size-3 text-ok" />
          ) : (
            <AlertTriangle className="size-3 text-warn" />
          )}
          {approved ? (
            `Approved by ${p.approvals.map((a) => a.name.split(" ")[0]).join(" and ")}`
          ) : (
            <a href={`#sign-${p.id}`} className="font-medium text-accent hover:underline">
              Waiting for approval, above
            </a>
          )}
        </span>
      </div>

      {p.method === "check" ? (
        <p className="mt-2 rounded-md bg-warn-soft px-2 py-1 text-[13px] leading-snug text-warn">
          Check, {daysFromToday(p.expectedDate) - daysFromToday(p.issuedDate)} days in transit.
        </p>
      ) : null}

      {invoice?.file ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
          <Paperclip className="size-3" />
          {invoice.file.name}
          <span className="text-fg-subtle">{invoice.file.size}</span>
        </p>
      ) : null}

      {editing ? (
        <div className="mt-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Anything the next treasurer should know"
            aria-label="Note on this payment"
            className="w-full resize-none rounded-lg border border-border-2 bg-surface px-2.5 py-2 text-[15px] text-fg outline-none focus:border-brand"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(p.notes ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : isRemote ? (
        p.notes ? (
          <p className="mt-2 text-[13px] text-fg">{p.notes}</p>
        ) : null
      ) : p.notes ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 flex w-full items-start gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-surface-3"
        >
          <StickyNote className="mt-0.5 size-3 shrink-0 text-fg-subtle" />
          <span className="min-w-0 flex-1 leading-snug">{p.notes}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <StickyNote className="size-3" />
          Add a note
        </button>
      )}
    </div>
  );
}
