"use client";

import { useState } from "react";
import { Button, Card, CardHeader, fieldClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { cn, money, todayIsoDate } from "@/lib/utils";

/**
 * Money moved from operating into reserves.
 *
 * The budget sends a share of dues to reserves every month, and until this
 * form the books had no way to say it happened: the operating account looked
 * short and the reserve account never grew. One entry, two lines.
 */
export function ReserveTransferForm({ onClose }: { onClose: () => void }) {
  const { recordReserveTransfer } = useAppState();
  const { notify } = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const cents = Math.round((Number(amount) || 0) * 100);

  const field =
    cn(fieldClass, "w-auto");

  return (
    <Card className="mb-6">
      <CardHeader
        title="Move money to reserves"
        subtitle="Records it in the operating and reserve accounts"
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        }
      />
      <form
        className="flex flex-wrap items-end gap-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (cents <= 0) return;
          try {
            recordReserveTransfer(cents, date);
            notify(`${money(cents)} moved to reserves`);
            onClose();
          } catch (error) {
            notify(error instanceof Error ? error.message : "The transfer was not recorded. Check the amount and try again.");
          }
        }}
      >
        <label className="block">
          <span className="text-footnote font-medium text-fg">Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="3000"
            aria-label="Amount moved"
            className={`mt-1.5 w-36 ${field}`}
          />
        </label>
        <label className="block">
          <span className="text-footnote font-medium text-fg">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date of the transfer"
            className={`mt-1.5 w-44 ${field}`}
          />
        </label>
        <Button type="submit" disabled={cents <= 0}>
          Record transfer
        </Button>
      </form>
    </Card>
  );
}
