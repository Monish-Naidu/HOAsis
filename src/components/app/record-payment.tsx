"use client";

import { useState } from "react";
import { Receipt, X } from "lucide-react";
import { Button, Card, CardHeader, Select, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { LedgerCategory, Vendor } from "@/lib/types";
import { cn, money, todayIsoDate } from "@/lib/utils";

/**
 * What a vendor payment can have been for: the spending categories the books
 * already use, the ones Transactions and "Where it went" group by.
 */
export const VENDOR_PAYMENT_CATEGORIES: LedgerCategory[] = [
  "Landscaping",
  "Utilities",
  "Insurance",
  "Repairs & maintenance",
  "Management",
  "Legal & professional",
];

/** The vendor's usual category when it is one of those, else nothing chosen yet. */
function usualCategory(vendor: Vendor | undefined): LedgerCategory | "" {
  return vendor && VENDOR_PAYMENT_CATEGORIES.includes(vendor.defaultCategory)
    ? vendor.defaultCategory
    : "";
}

/**
 * A payment that already happened, entered after the fact.
 *
 * A board that has been paying its landscaper from its own bank for years is
 * not going to stop on day one, and a product that only knows about payments
 * it made itself shows that board books that are wrong. So the date is theirs
 * to set, back-dated if that is the truth, and the record says plainly whether
 * the money moved through us or through their bank.
 */
export function RecordPayment({
  onClose,
  initialAmount = "",
}: {
  onClose: () => void;
  /** Dollars as typed, from the search shortcut. */
  initialAmount?: string;
}) {
  const { vendors, addPayout, isRemote } = useAppState();
  const { notify } = useToast();

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [amount, setAmount] = useState(initialAmount);
  const [paidOn, setPaidOn] = useState(todayIsoDate());
  const [method, setMethod] = useState<"ach" | "check" | "card">("ach");
  const [reference, setReference] = useState("");
  const [category, setCategory] = useState<LedgerCategory | "">(usualCategory(vendors[0]));
  const [note, setNote] = useState("");

  const field =
    fieldClass;
  const cents = Math.round((Number(amount) || 0) * 100);
  const vendor = vendors.find((v) => v.id === vendorId);
  const ready = Boolean(vendor) && cents > 0 && Boolean(paidOn) && category !== "";

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-5">
      <CardHeader
        icon={<Receipt className="size-4" />}
        title="Record a payment"
        subtitle="One you already made from your own bank"
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
            <span className="text-footnote font-semibold text-fg-muted">Who you paid</span>
            <Select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                // Each vendor has its own usual category; start from that.
                setCategory(usualCategory(vendors.find((v) => v.id === e.target.value)));
              }}
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
            <span className="text-footnote font-semibold text-fg-muted">How much</span>
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

        <label className="block">
          <span className="text-footnote font-semibold text-fg-muted">What it was for</span>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as LedgerCategory)}
            aria-label="Category"
            className="mt-1.5 w-full [&>select]:h-10"
          >
            {category === "" ? <option value="">Choose one</option> : null}
            {VENDOR_PAYMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            {/* Their date, not today's. A payment entered in April for a
                February invoice belongs in February or the books are wrong. */}
            <span className="text-footnote font-semibold text-fg-muted">Date it left</span>
            <input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              aria-label="Date paid"
              className={`mt-1.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-footnote font-semibold text-fg-muted">How</span>
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
            <span className="text-footnote font-semibold text-fg-muted">
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

        {/* A payment has nowhere to keep a note for a real association, so
            one typed there would be gone on the next load. The demo keeps it
            in the browser. */}
        {isRemote ? null : (
          <label className="block">
            <span className="text-footnote font-semibold text-fg-muted">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything the next treasurer should know"
              aria-label="Note on this payment"
              className={cn(textareaClass, "mt-1.5 resize-none")}
            />
          </label>
        )}

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
              // Nothing here sends a vendor money, so every payment is one the
              // board already made.
              status: "paid",
              issuedDate: paidOn,
              expectedDate: paidOn,
              approvals: [],
              approvalsRequired: 0,
              notes: note.trim() || undefined,
              category: category || undefined,
            });
            notify(`Recorded ${money(cents)} to ${vendor.name} on ${paidOn}.`);
            onClose();
          }}
        >
          Record it
        </Button>
      </div>
    </Card>
  );
}
