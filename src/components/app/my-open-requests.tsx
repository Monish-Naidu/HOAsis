"use client";

import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { useMyRequests } from "@/lib/app-state";
import type { RequestStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { statusLabel } from "@/lib/request-status";

const tone: Record<RequestStatus, "ok" | "danger" | "info" | "warn" | "neutral"> = {
  approved: "ok",
  denied: "danger",
  "in-review": "info",
  "info-needed": "warn",
  submitted: "neutral",
  closed: "neutral",
  draft: "neutral",
};

export function MyOpenRequests() {
  const mine = useMyRequests();
  const open = mine.filter((r) => !["approved", "denied", "closed"].includes(r.status));
  if (!open.length) return null;

  return (
    <section>
      <SectionTitle
        action={
          <Link href="/resident/requests" className="text-footnote font-medium text-accent">
            All {mine.length}
          </Link>
        }
      >
        Your open requests
      </SectionTitle>
      <Card>
        {open.map((r, i) => (
          <Link
            key={r.id}
            href={`/resident/requests/${r.reference}`}
            className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-fg">{r.title}</p>
              <p className="mt-0.5 text-footnote text-fg-muted">
                {r.reference} · submitted {formatDate(r.submittedDate)}
              </p>
            </div>
            <Badge tone={tone[r.status]}>{statusLabel[r.status]}</Badge>
          </Link>
        ))}
      </Card>
    </section>
  );
}
