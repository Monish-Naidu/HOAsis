"use client";

import { VENDOR_NAME_MAX, vendorNameProblem, vendorService } from "@/lib/vendor-name";
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
import { Badge, Button, Callout, Card, CardHeader, Checkbox, EmptyState, PageHeader, Select, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppState, useVendorGaps } from "@/lib/app-state";
import { InvoiceInbox } from "@/components/app/invoice-inbox";
import { RecordPayment, VENDOR_PAYMENT_CATEGORIES } from "@/components/app/record-payment";
import { useToast } from "@/components/app/toast";
import type { LedgerCategory, Payout } from "@/lib/types";
import { cn, daysFromToday, formatDate, money, relativeDays } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";
import { vendorDecisions, vendorPaidThisYear } from "@/lib/metrics";

const PAYOUT_STATUS = {
  paid: { label: "Paid", tone: "ok" },
  "in-transit": { label: "In transit", tone: "warn" },
  scheduled: { label: "Scheduled", tone: "info" },
  "needs-approval": { label: "Needs approval", tone: "warn" },
} as const;

const field =
  fieldClass;

/** How many payments the record shows before it is asked for the rest. */
const RECENT_PAYMENTS = 25;

export function VendorsScreen() {
  const gaps = useVendorGaps();
  const { community, vendors, payouts, markW9Requested, addVendor, removeVendor } = useAppState();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);
  // Ten years of vendor payments is several hundred rows. The record opens on
  // the newest and unfolds on request, rather than being the longest page in
  // the product.
  const [allPayments, setAllPayments] = useState(false);
  const params = useSearchParams();
  // Search's "Record a payment" shortcut lands here with the form open and
  // the amount typed carried across.
  const [recording, setRecording] = useState(params.get("record") === "1");
  const [draft, setDraft] = useState({
    name: "",
    service: "",
    // Chosen, not assumed: the payment form starts from it, so a guess here
    // files a stranger's bill under repairs.
    category: "" as LedgerCategory | "",
    achEnabled: true,
    w9OnFile: false,
  });

  // With bills waiting, the first one's action is the page's filled button,
  // so Add vendor steps down to secondary.
  const decisions = vendorDecisions(community).count;

  // Live, so the board sees the refusal before pressing Save.
  const nameProblem = vendorNameProblem(draft.name, vendors);

  function saveVendor() {
    if (!draft.name.trim() || !draft.category || nameProblem) return;
    addVendor({
      id: `v-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: draft.name.trim().replace(/\s+/g, " "),
      service: draft.service.trim() || draft.category,
      achEnabled: draft.achEnabled,
      w9OnFile: draft.w9OnFile,
      ytdPaidCents: 0,
      defaultCategory: draft.category,
    });
    notify(
      draft.w9OnFile ? `Added ${draft.name}` : `Added ${draft.name}. No W-9 on file yet.`,
    );
    setDraft({ name: "", service: "", category: "", achEnabled: true, w9OnFile: false });
    setAdding(false);
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description="The people you pay, and what you paid them."
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

      {recording ? (
        <RecordPayment onClose={() => setRecording(false)} initialAmount={params.get("amount") ?? ""} />
      ) : null}

      {adding ? (
        <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-6">
          <CardHeader
            title="New vendor"
            subtitle={
              moduleOn("vendor-tax-forms")
                ? "Over $600 a year, you need their W-9 to file a 1099 in January"
                : "Who they are and what they do for you"
            }
          />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-footnote font-medium text-fg">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Company or person you pay"
                maxLength={VENDOR_NAME_MAX}
                aria-invalid={nameProblem ? true : undefined}
                className={field}
              />
              {nameProblem ? (
                <span role="alert" className="mt-1 block text-footnote text-danger">
                  {nameProblem}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-footnote font-medium text-fg">Service</span>
              <input
                value={draft.service}
                onChange={(e) => setDraft({ ...draft, service: e.target.value })}
                placeholder="Grounds and irrigation"
                className={field}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-footnote font-medium text-fg">What they do for you</span>
              <Select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as LedgerCategory })}
                aria-label="What they do for you"
                className="w-full [&>select]:h-10"
              >
                {draft.category === "" ? <option value="">Choose one</option> : null}
                {VENDOR_PAYMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3">
            {moduleOn("vendor-tax-forms") ? (
              <>
                <label className="flex items-center gap-2 text-body text-fg">
                  <Checkbox
                    checked={draft.achEnabled}
                    onChange={(e) => setDraft({ ...draft, achEnabled: e.target.checked })}
                  />
                  Paid by bank transfer (ACH)
                </label>
                <label className="flex items-center gap-2 text-body text-fg">
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
              <Button type="submit" variant="primary" size="sm" disabled={!draft.name.trim() || !draft.category || Boolean(nameProblem)} onClick={saveVendor}>
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
                // Nothing is emailed: this only records that the board asked.
                notify(`Saved that you asked ${gaps.missingW9[0].name} for a W-9. Nothing was emailed, so ask them yourself.`);
              }}
            >
              Mark as asked
            </Button>
          }
        >
          {(() => {
            const paid = vendorPaidThisYear(community, gaps.missingW9[0]);
            return paid >= 60_000
              ? `Paid ${money(paid)} this year, past the $600 line for a 1099-NEC. Without the W-9 you cannot file it correctly.`
              : `Paid ${money(paid)} this year. At $600 it needs a 1099-NEC, and you cannot file it correctly without the W-9.`;
          })()}
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
            ? "Ask for the renewed certificate before the next visit. An uninsured vendor is a risk to the association."
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
                        <p className="min-w-0 truncate text-body font-medium text-fg">{v.name}</p>
                        <p className="tnum shrink-0 text-body font-semibold text-fg">
                          {money(vendorPaidThisYear(community, v))}
                        </p>
                      </div>
                      <p className="truncate text-footnote text-fg-muted">{vendorService(v)}</p>
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
                    <tr className="border-b border-border text-footnote font-semibold text-fg-muted">
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
                        className="scroll-mt-32 border-b border-border text-body transition-colors last:border-b-0 hover:bg-surface-2 lg:scroll-mt-24"
                      >
                        <td className="px-5 py-3">
                          <p className="whitespace-nowrap font-medium text-fg">{v.name}</p>
                          <p className="text-footnote text-fg-muted">{vendorService(v)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <VendorBadges vendor={v} />
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center justify-end gap-2">
                            <span className="tnum font-semibold text-fg">
                              {money(vendorPaidThisYear(community, v))}
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
            <p className="px-5 py-6 text-body text-fg-muted">
              No payments yet. Record one and it shows here.
            </p>
          ) : (
            <>
              {(allPayments ? payouts : payouts.slice(0, RECENT_PAYMENTS)).map((p) => (
                <PayoutRow key={p.id} payout={p} />
              ))}
              {!allPayments && payouts.length > RECENT_PAYMENTS ? (
                <div className="border-t border-border px-5 py-3">
                  <Button variant="secondary" size="sm" onClick={() => setAllPayments(true)}>
                    Show all {payouts.length} payments
                  </Button>
                </div>
              ) : null}
            </>
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
      className="tap flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* One payment, with its note and the invoice it settled                       */
/* -------------------------------------------------------------------------- */

function PayoutRow({ payout: p }: { payout: Payout }) {
  const { invoices, isRemote, setPayoutNotes, markPayoutPaid, can } = useAppState();
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
          <p className="truncate text-body font-medium text-fg">{p.vendor}</p>
          <p className="text-footnote text-fg-muted">{p.invoiceNumber}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum text-body font-semibold text-fg">
            {money(p.amountCents)}
          </p>
          <Badge tone={PAYOUT_STATUS[p.status].tone} className="mt-0.5">
            {PAYOUT_STATUS[p.status].label}
          </Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-fg-subtle">
        <span className="font-medium uppercase">{p.method}</span>
        <span>
          {p.status === "paid"
            ? // Booked paid: the date it went out, as the ledger line says.
              `Paid ${formatDate(p.expectedDate)}`
            : daysFromToday(p.expectedDate) < 0
              ? // Past its date and nobody has said it left: not "landed".
                `Expected ${formatDate(p.expectedDate)}, not yet confirmed paid`
              : `Expected ${formatDate(p.expectedDate)}`}
        </span>
        <span className="inline-flex items-center gap-1">
          {approved ? (
            <CheckCircle2 className="size-3 text-ok" />
          ) : (
            <AlertTriangle className="size-3 text-warn" />
          )}
          {approved ? (
            // Money the board paid from its own bank was never ours to approve.
            p.approvals.length === 0 ? (
              "No approval needed"
            ) : (
              `Approved by ${p.approvals.map((a) => a.name.split(" ")[0]).join(" and ")}`
            )
          ) : (
            <a href={`#sign-${p.id}`} className="font-medium text-accent hover:underline">
              Waiting for approval, above
            </a>
          )}
        </span>
      </div>

      {/* Cash moves when the payment goes out, not when the last signature
          lands, so a scheduled payment has somewhere to say it did. */}
      {(p.status === "scheduled" || p.status === "in-transit") && can("finances") ? (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void Promise.resolve(markPayoutPaid(p.id)).then((ok) => {
                if (ok) notify(`Marked paid: ${money(p.amountCents)} to ${p.vendor}`, "ok");
              })
            }
          >
            Mark paid
          </Button>
        </div>
      ) : null}

      {p.method === "check" ? (
        <p className="mt-2 rounded-md bg-warn-soft px-2 py-1 text-footnote leading-snug text-warn">
          Check, {daysFromToday(p.expectedDate) - daysFromToday(p.issuedDate)} days in transit.
        </p>
      ) : null}

      {invoice?.file ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-footnote text-fg-muted">
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
            className={cn(textareaClass, "resize-none")}
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
              Save note
            </Button>
          </div>
        </div>
      ) : isRemote ? (
        p.notes ? (
          <p className="mt-2 text-footnote text-fg">{p.notes}</p>
        ) : null
      ) : p.notes ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 flex w-full items-start gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-left text-footnote text-fg transition-colors hover:bg-surface-3"
        >
          <StickyNote className="mt-0.5 size-3 shrink-0 text-fg-subtle" />
          <span className="min-w-0 flex-1 leading-snug">{p.notes}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-footnote font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <StickyNote className="size-3" />
          Add a note
        </button>
      )}
    </div>
  );
}
