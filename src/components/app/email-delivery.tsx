"use client";

import { Inbox } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { EmailDeliveryStatus, EmailLogEntry } from "@/lib/types";
import { formatDate, pluralize } from "@/lib/utils";

/**
 * What was sent, and what became of it.
 *
 * The send button used to be the end of the story, and a board that asked
 * "did unit 14 get the notice" had nothing to point at. This is the record:
 * every message, the address it went to, and the provider's word on whether
 * it arrived. The three counts at the top are the ones a board actually asks
 * about; the table is for the one name they are looking for.
 */

type Bucket = "opened" | "delivered" | "waiting" | "missed";

function bucketOf(status: EmailDeliveryStatus | undefined, error: string | undefined): Bucket {
  if (error) return "missed";
  switch (status) {
    case "opened":
    case "clicked":
      return "opened";
    case "delivered":
      return "delivered";
    case "bounced":
    case "failed":
    case "complained":
      return "missed";
    default:
      return "waiting";
  }
}

const TONE: Record<Bucket, "ok" | "warn" | "danger" | "neutral"> = {
  opened: "ok",
  delivered: "ok",
  waiting: "neutral",
  missed: "danger",
};

function statusLabel(entry: EmailLogEntry): string {
  if (entry.error) return "Did not send";
  switch (entry.status) {
    case "opened":
      return "Opened";
    case "clicked":
      return "Opened";
    case "delivered":
      return "Delivered";
    case "delayed":
      return "Delayed";
    case "bounced":
      return "Bounced";
    case "failed":
      return "Failed";
    case "complained":
      return "Marked as spam";
    case "sent":
      return "Sent";
    default:
      return "On its way";
  }
}

/** "Sep 5, 2026 · 14:32" from an ISO timestamp, in the reader's own clock. */
function when(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso.slice(0, 10), "medium")} · ${hh}:${mm}`;
}

export function EmailDelivery() {
  const { community } = useAppState();
  const log = community.emailLog;
  if (log.length === 0) return null;

  const counts: Record<Bucket, number> = { opened: 0, delivered: 0, waiting: 0, missed: 0 };
  for (const entry of log) counts[bucketOf(entry.status, entry.error)]++;
  const arrived = counts.opened + counts.delivered;

  return (
    <Card className="mt-5">
      <CardHeader
        title="What was sent"
        subtitle={`${pluralize(log.length, "email")} on record`}
        icon={<Inbox className="size-4" />}
      />

      <div className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-3">
        <Figure label="Arrived" value={arrived} hint={counts.opened ? `${counts.opened} opened` : undefined} tone="ok" />
        <Figure label="On its way" value={counts.waiting} tone="neutral" />
        <Figure label="Did not arrive" value={counts.missed} tone={counts.missed ? "danger" : "neutral"} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-fg-subtle">
              <th className="px-5 py-2 font-semibold">When</th>
              <th className="px-3 py-2 font-semibold">To</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-5 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {log.slice(0, 25).map((entry) => {
              const bucket = bucketOf(entry.status, entry.error);
              const tone = entry.status === "delayed" && !entry.error ? "warn" : TONE[bucket];
              return (
                <tr key={entry.id} className="border-b border-border last:border-b-0">
                  <td className="tnum whitespace-nowrap px-5 py-2.5 text-fg-muted">
                    {when(entry.sentAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="max-w-[16rem] truncate text-fg">{entry.to}</p>
                    {entry.unit ? (
                      <p className="text-fg-subtle">Unit {entry.unit}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="max-w-[20rem] truncate text-fg-muted">{entry.subject}</p>
                    {entry.error ? (
                      <p className="max-w-[20rem] truncate text-danger" title={entry.error}>
                        {entry.error}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right">
                    <Badge tone={tone}>{statusLabel(entry)}</Badge>
                    {entry.statusAt ? (
                      <p className="tnum mt-0.5 text-fg-subtle">{when(entry.statusAt)}</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-5 py-3 text-[13px] leading-snug text-fg-subtle">
        Delivery status comes from the mail provider&apos;s webhook. Set RESEND_WEBHOOK_SECRET and
        point Resend at /api/email/webhook.
      </p>
    </Card>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: "ok" | "neutral" | "danger";
}) {
  const color =
    tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-lg bg-surface-2 px-3.5 py-3">
      <p className="text-[13px] font-semibold text-fg-muted">{label}</p>
      <p className={`tnum mt-0.5 text-[22px] font-semibold tracking-[-0.02em] ${color}`}>
        {value}
      </p>
      {hint ? <p className="text-[13px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
