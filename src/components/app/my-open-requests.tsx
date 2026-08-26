"use client";

import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { useMyRequests } from "@/lib/app-state";
import type { RequestStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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
          <Link href="/resident/requests" className="text-[13px] font-medium text-accent">
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
              <p className="truncate text-[15px] font-medium text-fg">{r.title}</p>
              <p className="mt-0.5 text-[13px] text-fg-muted">
                {r.reference} · submitted {formatDate(r.submittedDate)}
              </p>
            </div>
            <Badge tone={tone[r.status]}>{r.status.replace("-", " ")}</Badge>
          </Link>
        ))}
      </Card>
    </section>
  );
}
