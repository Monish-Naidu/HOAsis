"use client";

import { FileSpreadsheet, FileText, Globe, Lock } from "lucide-react";
import { Badge, Card, Callout, SectionTitle } from "@/components/ui/primitives";
import { publicRecordsUrl } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { formatDate } from "@/lib/utils";
import type { DocumentRecord } from "@/lib/types";

const order: DocumentRecord["category"][] = [
  "Governing",
  "Financial",
  "Meetings",
  "Notices",
  "Insurance",
  "Forms",
];

export default function ResidentDocuments() {
  const { community, documents } = useAppState();
  const visible = documents.filter((d) => d.visibility !== "board");
  const grouped = order
    .map((category) => ({ category, docs: visible.filter((d) => d.category === category) }))
    .filter((g) => g.docs.length);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">Documents</h1>
        <p className="mt-1 text-[15px] text-fg-muted">{visible.length} documents</p>
      </div>

      <Callout tone="brand" icon={<Globe className="size-4" />} title={publicRecordsUrl(community)} >
        Public, no account needed.
      </Callout>

      {grouped.map(({ category, docs }) => (
        <section key={category}>
          <SectionTitle>{category}</SectionTitle>
          <Card>
            {docs.map((d, i) => (
              <a
                key={d.id}
                href="#"
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                  {d.fileType === "xlsx" ? (
                    <FileSpreadsheet className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-fg">{d.name}</p>
                  <p className="mt-0.5 truncate text-[13px] text-fg-muted">
                    {formatDate(d.updatedDate)} · {d.size}
                    {d.requiredBy ? ` · ${d.requiredBy}` : ""}
                  </p>
                </div>
                {d.visibility === "public" ? (
                  <Badge tone="ok">
                    <Globe className="size-2.5" />
                    Public
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    <Lock className="size-2.5" />
                    Owners
                  </Badge>
                )}
              </a>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
