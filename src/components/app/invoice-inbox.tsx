"use client";

import { useState } from "react";
import { Check, Copy, Inbox, Paperclip, Plus, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Segmented, Select, type Tone, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { communitySlug, vendorDecisions } from "@/lib/metrics";
import type { InvoiceStatus, Payout, VendorInvoice } from "@/lib/types";
import { addDays, cn, daysFromToday, formatDate, money, relativeDays, todayIsoDate } from "@/lib/utils";

/**
 * Bills vendors have sent the association.
 *
 * The normal path is email: a vendor sends the invoice to the association's
 * forwarding address and it lands here with the file attached. Attaching one
 * by hand is the fallback. Either way the board approves it, pays it by ACH
 * from the operating account, and the file stays on the payment it settled.
 *
 * Email-in is not wired yet. The address is real in shape and shown so a board
 * can start giving it out, and the seeded rows show what arrives.
 *
 * Since 2026-09-24 this is the one approval queue on Vendors. Payments short
 * of a second signature used to wait in a separate Payments card with their
 * own filled Approve button, so the page had two queues and four filled
 * buttons. Now every vendor decision is a row here, counted by
 * `vendorDecisions` like the rail badge and the dashboard, and only the first
 * row's action is filled.
 */

type Filter = "waiting" | "paid" | "all";
type Panel = { id: string; mode: "reject" | "pay" } | null;

const STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "info" },
  approved: { label: "Approved", tone: "brand" },
  paid: { label: "Paid", tone: "ok" },
  rejected: { label: "Rejected", tone: "neutral" },
};

const field =
  fieldClass;
const label = "mb-1 block text-footnote font-semibold text-fg-muted";

function fileSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isWaiting(i: VendorInvoice) {
  return i.status === "new" || i.status === "approved";
}

export function InvoiceInbox() {
  const {
    community,
    invoices,
    vendors,
    payouts,
    isRemote,
    addInvoice,
    approveInvoice,
    rejectInvoice,
    payInvoice,
    approvePayout,
  } = useAppState();
  const { notify } = useToast();

  const [filter, setFilter] = useState<Filter>("waiting");
  const [panel, setPanel] = useState<Panel>(null);
  const [attaching, setAttaching] = useState(false);

  const address = `invoices@${communitySlug(community)}.yourhoasis.com`;
  const decisions = vendorDecisions(community);
  const waiting = invoices.filter(isWaiting);
  const paid = invoices.filter((i) => i.status === "paid");
  // Payments settling an invoice already in this list are that invoice's
  // row, not a second one.
  const toSign = decisions.toSign.filter(
    (p) => !waiting.some((i) => i.id === p.invoiceId || i.payoutId === p.id),
  );

  // Waiting is a to-do list, so soonest due comes first. The other views are
  // a record, so newest received comes first.
  const visible =
    filter === "waiting"
      ? [...waiting].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      : filter === "paid"
        ? paid
        : invoices;

  /** Runs a mutation and turns a refusal into a toast instead of a crash. */
  function run(action: () => void, done: string) {
    try {
      action();
      notify(done);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "That did not save", "warn");
      return false;
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      notify(`Copied ${address}`);
    } catch {
      notify("Could not copy. Select the address and copy it by hand.", "warn");
    }
  }

  return (
    <Card>
      <CardHeader
        title="To approve"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Vendors email bills to</span>
            <code className="rounded-md bg-surface-2 px-1.5 py-0.5 text-footnote text-fg">
              {address}
            </code>
            <button
              type="button"
              onClick={copyAddress}
              aria-label="Copy the invoice address"
              className="-my-1 inline-flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Copy className="size-3.5" />
            </button>
          </span>
        }
        action={
          isRemote || attaching ? undefined : (
            <Button variant="ghost" size="sm" onClick={() => setAttaching(true)}>
              <Plus className="size-3.5" />
              Attach an invoice
            </Button>
          )
        }
      />

      {isRemote ? (
        <p className="border-b border-border bg-surface-2 px-5 py-2.5 text-footnote text-fg-muted">
          Email-in and invoice storage are coming. Nothing sent to this address is kept yet.
        </p>
      ) : null}

      {attaching ? (
        <AttachForm
          vendors={vendors}
          onCancel={() => setAttaching(false)}
          onSave={(input) => {
            if (run(() => addInvoice(input), `Attached ${input.number} from ${input.vendor}`)) {
              setAttaching(false);
              setFilter("waiting");
            }
          }}
        />
      ) : null}

      <div className="border-b border-border px-5 py-2.5">
        <Segmented
          label="Which bills"
          value={filter}
          onChange={setFilter}
          className="pointer-coarse:[&>button]:h-9"
          options={[
            { value: "waiting", label: "To approve", count: decisions.count },
            { value: "paid", label: "Paid", count: paid.length },
            { value: "all", label: "All", count: invoices.length },
          ]}
        />
      </div>

      {visible.length === 0 && (filter !== "waiting" || toSign.length === 0) ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title={
            filter === "waiting"
              ? "Nothing to approve"
              : filter === "paid"
                ? "Nothing paid yet"
                : "No invoices yet"
          }
          description={
            filter === "waiting"
              ? `Bills vendors send to ${address} land here for approval.`
              : undefined
          }
        />
      ) : (
        <ul>
          {visible.map((invoice, index) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              primary={filter === "waiting" && index === 0}
              payout={payouts.find((p) => p.id === invoice.payoutId)}
              readOnly={isRemote}
              panel={panel?.id === invoice.id ? panel.mode : null}
              onPanel={(mode) => setPanel(mode ? { id: invoice.id, mode } : null)}
              onApprove={() =>
                run(() => approveInvoice(invoice.id), `Approved ${invoice.number}`)
              }
              onReject={(reason) => {
                if (run(() => rejectInvoice(invoice.id, reason), `Rejected ${invoice.number}`)) {
                  setPanel(null);
                }
              }}
              onPay={(notes) => {
                if (
                  run(
                    () => payInvoice(invoice.id, notes),
                    `Paying ${invoice.vendor} ${money(invoice.amountCents)} by ACH`,
                  )
                ) {
                  setPanel(null);
                }
              }}
            />
          ))}
          {filter === "waiting"
            ? toSign.map((payout, index) => (
                <SignRow
                  key={payout.id}
                  payout={payout}
                  primary={visible.length === 0 && index === 0}
                  readOnly={isRemote}
                  onApprove={() =>
                    run(() => approvePayout(payout.id), `Approved ${payout.vendor}`)
                  }
                />
              ))
            : null}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* One invoice                                                                 */
/* -------------------------------------------------------------------------- */

function InvoiceRow({
  invoice,
  primary,
  payout,
  readOnly,
  panel,
  onPanel,
  onApprove,
  onReject,
  onPay,
}: {
  invoice: VendorInvoice;
  /** The first row of the queue carries the page's one filled button. */
  primary: boolean;
  payout?: { id: string; expectedDate: string; status: string; notes?: string };
  readOnly: boolean;
  panel: "reject" | "pay" | null;
  onPanel: (mode: "reject" | "pay" | null) => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onPay: (notes: string) => void;
}) {
  const status = STATUS[invoice.status];
  const dueIn = daysFromToday(invoice.dueDate);
  const dueSoon = isWaiting(invoice) && dueIn <= 7;

  return (
    <li className="border-b border-border px-5 py-3.5 last:border-b-0">
      {/* The text keeps 12rem, so on a phone the amount and the buttons drop
          under it rather than squeezing it to a word per line. */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-medium text-fg">{invoice.vendor}</p>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-0.5 text-footnote text-fg-muted">
            {invoice.number}, {invoice.description}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-fg-subtle">
            <span>Received {formatDate(invoice.receivedDate)}</span>
            <span className={cn(dueSoon && "font-medium text-warn")}>
              Due {formatDate(invoice.dueDate)}
              {isWaiting(invoice) ? `, ${relativeDays(invoice.dueDate)}` : ""}
            </span>
            {invoice.file ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="size-3" />
                {invoice.file.name}
                <span className="opacity-70">{invoice.file.size}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="ml-auto shrink-0 text-right">
          <p className="tnum text-body font-semibold text-fg">{money(invoice.amountCents)}</p>
          {readOnly || panel ? null : invoice.status === "new" ? (
            <div className="mt-1.5 flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => onPanel("reject")}>
                Reject
              </Button>
              <Button variant={primary ? "primary" : "secondary"} size="sm" onClick={onApprove}>
                <Check className="size-3.5" />
                Approve
              </Button>
            </div>
          ) : invoice.status === "approved" ? (
            <div className="mt-1.5 flex justify-end">
              <Button variant={primary ? "primary" : "secondary"} size="sm" onClick={() => onPanel("pay")}>
                Pay by ACH
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {invoice.status === "paid" && payout ? (
        <p className="mt-2 text-footnote text-fg-muted">
          Paid by ACH, {payout.status === "paid" ? "landed" : "lands"}{" "}
          {daysFromToday(payout.expectedDate) >= -60
            ? relativeDays(payout.expectedDate)
            : formatDate(payout.expectedDate)}
          .{" "}
          <a href={`#payout-${payout.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
            See the payment
          </a>
          {payout.notes ? <span className="block mt-1 text-fg">&ldquo;{payout.notes}&rdquo;</span> : null}
        </p>
      ) : null}

      {invoice.status === "rejected" && invoice.rejectedReason ? (
        <p className="mt-2 text-footnote text-fg-muted">Rejected: {invoice.rejectedReason}</p>
      ) : null}

      {invoice.status === "approved" && invoice.notes && panel !== "pay" ? (
        <p className="mt-2 text-footnote text-fg-muted">{invoice.notes}</p>
      ) : null}

      {panel === "reject" ? <RejectPanel onCancel={() => onPanel(null)} onReject={onReject} /> : null}
      {panel === "pay" ? (
        <PayPanel invoice={invoice} onCancel={() => onPanel(null)} onPay={onPay} />
      ) : null}
    </li>
  );
}

/** A payment already sent for approval that is still a signature short. */
function SignRow({
  payout,
  primary,
  readOnly,
  onApprove,
}: {
  payout: Payout;
  primary: boolean;
  readOnly: boolean;
  onApprove: () => void;
}) {
  const signed = payout.approvals.map((a) => a.name.split(" ")[0]).join(" and ");
  return (
    <li
      id={`sign-${payout.id}`}
      className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-5 py-3.5 last:border-b-0"
    >
      <div className="min-w-[12rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body font-medium text-fg">{payout.vendor}</p>
          <Badge tone="warn">Needs a signature</Badge>
        </div>
        <p className="mt-0.5 text-footnote text-fg-muted">
          {payout.invoiceNumber}, {payout.method === "ach" ? "bank transfer" : "check"}
        </p>
        <p className="mt-1.5 text-footnote text-fg-subtle">
          {payout.approvals.length} of {payout.approvalsRequired} approvals
          {signed ? `, ${signed} signed` : ""}
        </p>
      </div>
      <div className="ml-auto shrink-0 text-right">
        <p className="tnum text-body font-semibold text-fg">{money(payout.amountCents)}</p>
        {readOnly ? null : (
          <div className="mt-1.5 flex justify-end">
            <Button variant={primary ? "primary" : "secondary"} size="sm" onClick={onApprove}>
              <Check className="size-3.5" />
              Approve
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function RejectPanel({
  onCancel,
  onReject,
}: {
  onCancel: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onReject(reason);
      }}
    >
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why, in one line. The vendor sees this."
        aria-label="Reason for rejecting"
        className={cn(field, "min-w-0 flex-1")}
      />
      <Button type="submit" variant="danger" size="sm" disabled={!reason.trim()}>
        Reject
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

function PayPanel({
  invoice,
  onCancel,
  onPay,
}: {
  invoice: VendorInvoice;
  onCancel: () => void;
  onPay: (notes: string) => void;
}) {
  const { community } = useAppState();
  const [notes, setNotes] = useState("");
  const from =
    community.bankAccounts.find((a) => a.kind === "operating") ?? community.bankAccounts[0];

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2 p-4">
      <dl className="grid gap-x-6 gap-y-2 text-body sm:grid-cols-3">
        <div>
          <dt className="text-footnote font-semibold text-fg-muted">Amount</dt>
          <dd className="tnum font-semibold text-fg">{money(invoice.amountCents)}</dd>
        </div>
        <div>
          <dt className="text-footnote font-semibold text-fg-muted">From</dt>
          <dd className="text-fg">
            {from ? (
              <>
                {from.name} <span className="tnum text-fg-muted">{from.mask}</span>
              </>
            ) : (
              <span className="text-warn">No bank account connected</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-footnote font-semibold text-fg-muted">Lands</dt>
          <dd className="text-fg">2 business days</dd>
        </div>
      </dl>
      <label className="mt-3 block">
        <span className={label}>Note on this payment (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything the next treasurer should know"
          className={cn(textareaClass, "resize-none")}
        />
      </label>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={!from} onClick={() => onPay(notes)}>
          Pay {money(invoice.amountCents)}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Attach by hand                                                              */
/* -------------------------------------------------------------------------- */

function AttachForm({
  vendors,
  onCancel,
  onSave,
}: {
  vendors: { id: string; name: string }[];
  onCancel: () => void;
  onSave: (input: Omit<VendorInvoice, "id" | "status" | "via">) => void;
}) {
  const today = todayIsoDate();
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(addDays(today, 30));
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<{ name: string; size: string } | undefined>();

  const vendor = vendors.find((v) => v.id === vendorId);
  const cents = Math.round((Number(amount) || 0) * 100);
  const ready = Boolean(vendor) && number.trim() !== "" && cents > 0 && Boolean(dueDate);

  return (
    <form
      className="border-b border-border bg-surface-2 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!vendor || !ready) return;
        onSave({
          vendorId: vendor.id,
          vendor: vendor.name,
          number: number.trim(),
          amountCents: cents,
          receivedDate: today,
          dueDate,
          description: description.trim() || "Invoice",
          file,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={label}>Vendor</span>
          <Select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            aria-label="Vendor"
            className="w-full"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className={label}>Invoice number</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="INV-2026-114"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1380.00"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={field}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>What it is for</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="September grounds contract"
            className={field}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>File</span>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              // Name and size only. The bytes stay on their machine until
              // there is somewhere to keep them.
              setFile(picked ? { name: picked.name, size: fileSize(picked.size) } : undefined);
            }}
            className="block w-full text-footnote text-fg-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-border-2 file:bg-surface file:px-3 file:text-footnote file:font-medium file:text-fg"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!ready}>
          Add to inbox
        </Button>
      </div>
    </form>
  );
}
