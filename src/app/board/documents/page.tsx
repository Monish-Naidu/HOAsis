import {
  Building2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Lock,
  Search,
  Upload,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { documents, publicDocuments } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import type { DocumentRecord } from "@/lib/types";

export const metadata = { title: "Documents" };

const visibilityMeta: Record<
  DocumentRecord["visibility"],
  { tone: "ok" | "neutral" | "warn"; label: string; icon: typeof Globe }
> = {
  public: { tone: "ok", label: "Public", icon: Globe },
  members: { tone: "neutral", label: "Owners", icon: Users },
  board: { tone: "warn", label: "Board only", icon: Lock },
};

const order: DocumentRecord["category"][] = [
  "Governing",
  "Financial",
  "Meetings",
  "Notices",
  "Insurance",
  "Forms",
];

export default function BoardDocuments() {
  const publicDocs = publicDocuments();
  const statutory = documents.filter((d) => d.requiredBy);
  const grouped = order
    .map((category) => ({ category, docs: documents.filter((d) => d.category === category) }))
    .filter((g) => g.docs.length);

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Documents"
        
        action={
          <Button variant="primary" size="md">
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
          <Button variant="secondary" size="sm">
            <ExternalLink className="size-3.5" />
            Open
          </Button>
        }
      >
        cedarhollow.hoasis.app/records · {publicDocs.length} documents, no account needed.
      </Callout>

      <Card className="mt-5">
        <CardHeader
          title="All documents"
          action={
            <div className="hidden h-8 items-center gap-2 rounded-lg border border-border px-2.5 sm:flex">
              <Search className="size-3.5 text-fg-subtle" />
              <input
                placeholder="Search documents"
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
              const meta = visibilityMeta[d.visibility];
              const Icon = meta.icon;
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
                  <Badge tone={meta.tone}>
                    <Icon className="size-2.5" />
                    {meta.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </>
  );
}
