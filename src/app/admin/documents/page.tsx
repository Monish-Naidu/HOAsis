"use client";

import {
  Building2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Search,
  Upload,
} from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { useState } from "react";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
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

export default function BoardDocuments() {
  const { documents, addDocument, setDocumentVisibility } = useAppState();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const publicDocs = documents.filter((d) => d.visibility === "public");
  const statutory = documents.filter((d) => d.requiredBy);
  const grouped = order
    .map((category) => ({
      category,
      docs: documents.filter(
        (d) =>
          d.category === category &&
          d.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((g) => g.docs.length);

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Documents"
        
        action={
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              const index = documents.length + 1;
              addDocument({
                id: `doc-${index}`,
                name: `Board upload ${index}`,
                category: "Notices",
                updatedDate: "2026-08-21",
                size: "0 KB",
                visibility: "members",
                fileType: "pdf",
              });
              notify("Uploaded. Set who can see it below.");
            }}
          >
            <Upload className="size-3.5" />
            Upload
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Documents" value={String(documents.length)} icon={<FileText className="size-4" />} />
        <Stat
          label="Published publicly"
          value={String(publicDocs.length)}
          tone="ok"
          hint="No login required"
          icon={<Globe className="size-4" />}
        />
        <Stat
          label="Statutorily required"
          value={String(statutory.length)}
          hint="Tied to a citation in the register"
          icon={<Building2 className="size-4" />}
        />
        <Stat label="Board only" value={String(documents.filter((d) => d.visibility === "board").length)} hint="Contracts, collections work product" />
      </div>

      <Callout
        tone="ok"
        className="mt-5"
        icon={<Globe className="size-4" />}
        title="Public records page is live"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => notify("Public records page opens in a new tab", "info")}
          >
            <ExternalLink className="size-3.5" />
            Open
          </Button>
        }
      >
        mehrgardens.hoasis.app/records · {publicDocs.length} documents, no account needed.
      </Callout>

      <Card className="mt-5">
        <CardHeader
          title="All documents"
          action={
            <div className="hidden h-8 items-center gap-2 rounded-lg border border-border px-2.5 sm:flex">
              <Search className="size-3.5 text-fg-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
                className="w-40 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-subtle"
              />
            </div>
          }
        />
        {grouped.map(({ category, docs }) => (
          <div key={category}>
            <div className="border-b border-border bg-surface-2 px-5 py-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                {category}
              </p>
            </div>
            {docs.map((d) => {
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                    {d.fileType === "xlsx" ? (
                      <FileSpreadsheet className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{d.name}</p>
                    <p className="truncate text-[11px] text-fg-muted">
                      Updated {formatDate(d.updatedDate, "long")} · {d.size}
                      {d.requiredBy ? ` · required by ${d.requiredBy}` : ""}
                    </p>
                  </div>
                  <select
                    value={d.visibility}
                    onChange={(e) => {
                      setDocumentVisibility(
                        d.id,
                        e.target.value as "public" | "members" | "board",
                      );
                      notify(`${d.name} is now ${e.target.value}`);
                    }}
                    aria-label={`Who can see ${d.name}`}
                    className="h-7 rounded-md border border-border bg-surface-2 px-2 text-[11px] font-medium text-fg outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="members">Owners</option>
                    <option value="board">Board only</option>
                  </select>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </>
  );
}
