"use client";

import { useState } from "react";
import { Receipt, X } from "lucide-react";
import { Button, Card, CardHeader, Select } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { money, todayIsoDate } from "@/lib/utils";

/**
 * A payment that already happened, entered after the fact.
 *
 * A board that has been paying its landscaper from its own bank for years is
 * not going to stop on day one, and a product that only knows about payments
 * it made itself shows that board books that are wrong. So the date is theirs
 * to set, back-dated if that is the truth, and the record says plainly whether
 * the money moved through us or through their bank.
 */
export function RecordPayment({ onClose }: { onClose: () => void }) {
  const { vendors, addPayout } = useAppState();
  const { notify } = useToast();

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayIsoDate());
  const [method, setMethod] = useState<"ach" | "check" | "card">("ach");
  const [reference, setReference] = useState("");
  const [throughUs, setThroughUs] = useState(false);
  const [note, setNote] = useState("");

  const field =
    "h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand";
  const cents = Math.round((Number(amount) || 0) * 100);
  const vendor = vendors.find((v) => v.id === vendorId);
  const ready = Boolean(vendor) && cents > 0 && Boolean(paidOn);

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-5">
      <CardHeader
        icon={<Receipt className="size-4" />}
        title="Record a payment"
        subtitle="Including one you already made from your own bank"
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
            Cancel
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">Who you paid</span>
            <Select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              aria-label="Vendor"
              className="mt-1.5 w-full [&>select]:h-10"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">How much</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1380.00"
              aria-label="Amount paid"
              className={`mt-1.5 ${field}`}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            {/* Their date, not today's. A payment entered in April for a
                February invoice belongs in February or the books are wrong. */}
            <span className="text-[13px] font-semibold text-fg-muted">Date it left</span>
            <input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              aria-label="Date paid"
              className={`mt-1.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">How</span>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              aria-label="Payment method"
              className="mt-1.5 w-full [&>select]:h-10"
            >
              <option value="ach">Bank transfer</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
            </Select>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">
              {method === "check" ? "Check number" : "Invoice or reference"}
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === "check" ? "1042" : "INV-2026-114"}
              aria-label="Reference"
              className={`mt-1.5 ${field}`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything the next treasurer should know"
            aria-label="Note on this payment"
            className="mt-1.5 w-full resize-none rounded-lg border border-border-2 bg-surface px-3 py-2 text-[15px] text-fg outline-none focus:border-brand"
          />
        </label>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={throughUs}
            onChange={(e) => setThroughUs(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border-2"
          />
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-fg">
              Send this payment through Your HOAsis
            </span>
            <span className="block text-[13px] leading-snug text-fg-muted">
              Leave it off to record a payment you already made yourself. The books are the
              same either way, which is the point.
            </span>
          </span>
        </label>

        <Button
          type="submit"
          size="lg"
          disabled={!ready}
          onClick={() => {
            if (!vendor) return;
            addPayout({
              id: `po-${Date.now()}`,
              vendorId: vendor.id,
              vendor: vendor.name,
              invoiceNumber: reference.trim() || "Not recorded",
              amountCents: cents,
              method,
              // A payment already made needs no approval, and pretending it
              // does would put a decision on the board for money that is gone.
              status: throughUs ? "needs-approval" : "paid",
              issuedDate: paidOn,
              expectedDate: paidOn,
              approvals: [],
              approvalsRequired: throughUs ? 2 : 0,
              notes: note.trim() || undefined,
            });
            notify(
              throughUs
                ? `${vendor.name} queued for ${money(cents)}. It needs approvals before it goes.`
                : `Recorded ${money(cents)} to ${vendor.name} on ${paidOn}.`,
            );
            onClose();
          }}
        >
          {throughUs ? "Queue the payment" : "Record it"}
        </Button>
      </div>
    </Card>
  );
}
