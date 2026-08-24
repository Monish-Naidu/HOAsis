"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";

import { formatDate, money, relativeDays } from "@/lib/utils";

/** Reads the signed in account's own balance, whoever that is. */
export function BalanceCard() {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  if (!owner) return null;
  const association = community.association;
  const nextCharge = community.nextChargeDate;

  const past = owner.daysPastDue > 0;
  const amount = owner.balanceCents > 0 ? owner.balanceCents : association.duesCents;

  return (
    <Card className="overflow-hidden border-navy-800 bg-navy-900 text-navy-50 shadow-raised dark:border-navy-700">
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-navy-300">
          {past ? "Past due" : "Balance due"}
        </p>
        <p className="tnum mt-1.5 text-[40px] font-semibold leading-none tracking-[-0.035em]">
          {money(owner.balanceCents)}
        </p>
        <p className="mt-2 text-[13px] text-navy-200">
          {past
            ? `${owner.daysPastDue} days past due`
            : owner.balanceCents === 0
              ? `Nothing outstanding. Next assessment ${formatDate(nextCharge, "long")}.`
              : `Next assessment, due ${formatDate(nextCharge, "long")} · ${relativeDays(
                  nextCharge,
                )}`}
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/resident/pay"
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-navy-50 text-[14px] font-semibold text-navy-950 transition-opacity hover:opacity-90"
          >
            Pay {money(amount, { cents: false })}
          </Link>
          <Link
            href="/resident/account"
            className="flex h-10 items-center justify-center rounded-lg border border-navy-600 px-4 text-[13px] font-medium text-navy-100 transition-colors hover:bg-navy-800"
          >
            History
          </Link>
        </div>
      </div>
      {!owner.autopay ? (
        <Link
          href="/resident/pay#autopay"
          className="flex items-center gap-2 border-t border-navy-700 bg-navy-800/60 px-5 py-3 transition-colors hover:bg-navy-800"
        >
          <Sparkles className="size-4 shrink-0 text-navy-300" />
          <span className="flex-1 text-[12px] leading-snug text-navy-100">
            Turn on autopay and skip the late fees.
          </span>
          <ChevronRight className="size-4 shrink-0 text-navy-400" />
        </Link>
      ) : null}
    </Card>
  );
}
