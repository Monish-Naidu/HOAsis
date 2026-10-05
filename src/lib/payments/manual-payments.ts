import type { Cents } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

/**
 * Checks and cash a board entered by hand, as the board reads them back to
 * take one off the books or to be warned before entering one twice. The
 * database rules these mirror are reverse_manual_payment (0088) and
 * record_manual_payment (0083).
 */
export const MIN_REVERSAL_REASON = 3;
export const MAX_REVERSAL_REASON = 120;

export type HandMethod = "check" | "cash";

export interface ManualPaymentRow {
  id: string;
  amountCents: Cents;
  method: HandMethod;
  /** The date the money was received, YYYY-MM-DD. */
  receivedOn: string;
  reference: string;
  reversed: boolean;
}

/** What is wrong with a reason for a reversal, or null when it can be sent. */
export function reversalReasonProblem(reason: string): string | null {
  const length = reason.trim().length;
  if (length < MIN_REVERSAL_REASON) return "Say why, in a few words.";
  if (length > MAX_REVERSAL_REASON) return `Keep it to ${MAX_REVERSAL_REASON} characters.`;
  return null;
}

/**
 * The live payment a new one would repeat: same amount, same received date,
 * and not already reversed. Method and reference are not compared. A check
 * entered twice is usually entered with the same words, but a typo in the
 * check number must not hide the repeat.
 */
export function findDuplicatePayment(
  existing: readonly ManualPaymentRow[],
  next: { amountCents: Cents; receivedOn: string },
): ManualPaymentRow | null {
  if (next.amountCents <= 0 || !next.receivedOn) return null;
  return (
    existing.find(
      (p) => !p.reversed && p.amountCents === next.amountCents && p.receivedOn === next.receivedOn,
    ) ?? null
  );
}

/** "Unit 4 already has a $285.00 check recorded for Aug 20, 2026." */
export function duplicatePaymentWarning(homeLabel: string, row: ManualPaymentRow): string {
  const what = row.method === "check" ? "check" : "cash payment";
  return `${homeLabel} already has a ${money(row.amountCents)} ${what} recorded for ${formatDate(row.receivedOn)}.`;
}

/** Newest received first, then newest recorded first, ten at most. */
export function recentManualPayments(rows: readonly ManualPaymentRow[], limit = 10): ManualPaymentRow[] {
  return [...rows].sort((a, b) => b.receivedOn.localeCompare(a.receivedOn)).slice(0, limit);
}

const LABEL = /^(Check|Cash) payment(?: #(.*))?$/;

/** The method and reference a statement line written by hand carries, or null for any other line. */
export function parseManualLabel(label: string): { method: HandMethod; reference: string } | null {
  const m = LABEL.exec(label);
  if (!m) return null;
  return { method: m[1] === "Check" ? "check" : "cash", reference: (m[2] ?? "").trim() };
}

/**
 * A payments row carries no date or reference; they live on the statement
 * line record_manual_payment wrote beside it (label "Check payment #1042",
 * dated the day received). The two are not linked by id, so they are paired
 * by method and amount in the order they were written, newest first. Only
 * the newest payments are read, so pairing from the newest end keeps an older
 * line that was not read from being handed to a newer payment.
 *
 * `payments` and `lines` are each oldest first. A payment with no statement
 * line is dated the day it was recorded.
 */
export function pairManualPayments(
  payments: readonly {
    id: string;
    amountCents: Cents;
    method: HandMethod;
    reversed: boolean;
    createdOn: string;
  }[],
  lines: readonly { label: string; amountCents: Cents; date: string }[],
): ManualPaymentRow[] {
  const queues = new Map<string, { reference: string; date: string }[]>();
  for (const line of lines) {
    const parsed = parseManualLabel(line.label);
    if (!parsed) continue;
    const key = `${parsed.method}:${line.amountCents}`;
    const queue = queues.get(key) ?? [];
    queue.push({ reference: parsed.reference, date: line.date });
    queues.set(key, queue);
  }
  const rows: ManualPaymentRow[] = [];
  for (const p of [...payments].reverse()) {
    const found = queues.get(`${p.method}:${p.amountCents}`)?.pop();
    rows.push({
      id: p.id,
      amountCents: p.amountCents,
      method: p.method,
      receivedOn: found?.date ?? p.createdOn,
      reference: found?.reference ?? "",
      reversed: p.reversed,
    });
  }
  return rows.reverse();
}
