"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  GraduationCap,
  Info,
  Scale,
} from "lucide-react";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Meter,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { complianceSummary, interestSummary } from "@/lib/metrics";
import { percentFunded } from "@/lib/reserves";
import { useAppState } from "@/lib/app-state";
import { formatDate, relativeDays, shortMoney } from "@/lib/utils";
import type { ComplianceStatus } from "@/lib/types";

const statusMeta: Record<
  ComplianceStatus,
  { tone: "ok" | "warn" | "danger" | "info"; label: string; icon: typeof CheckCircle2 }
> = {
  compliant: { tone: "ok", label: "Compliant", icon: CheckCircle2 },
  "due-soon": { tone: "warn", label: "Due soon", icon: Clock },
  overdue: { tone: "danger", label: "Action needed", icon: AlertTriangle },
  "in-progress": { tone: "info", label: "In progress", icon: CircleDot },
};


export default function BoardCompliance() {
  const { community } = useAppState();

  /**
   * The reserve schedule, read from this association's own documents.
   *
   * Dates come from the reserve study document the board actually uploaded,
   * so an association that has never commissioned one shows nothing rather
   * than inheriting somebody else's consultant and funding level.
   */
  const funding = percentFunded(community.reserveComponents, interestSummary(community).balance);
  const study = community.documents.find((d) => /reserve stud/i.test(d.name));
  const reserveDates = [
    {
      label: "Last full study",
      value: study ? formatDate(study.updatedDate, "medium") : "Not on file",
      note: study ? study.name.replace(/^Reserve Study,?\s*/i, "") || "On file" : "Nothing uploaded",
    },
    {
      label: "Components tracked",
      value: String(community.reserveComponents.length),
      note: "Roofs, paving, pumps and the rest",
    },
    {
      label: "Reserve cash",
      value: shortMoney(interestSummary(community).balance),
      note: "Across every reserve account",
    },
  ];
  const association = community.association;
  const complianceItems = community.complianceItems;
  const comp = complianceSummary(community);
  const ordered = [
    ...comp.overdue,
    ...comp.dueSoon,
    ...comp.inProgress,
    ...comp.compliant,
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${association.stateName} · RCW 64.38 association`}
        title="Compliance register"
        
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Clear"
          value={`${comp.compliant.length}/${complianceItems.length}`}
          tone="ok"
          hint="Obligations with evidence on file"
          icon={<CheckCircle2 className="size-4" />}
        />
        <Stat
          label="Action needed"
          value={String(comp.overdue.length)}
          tone={comp.overdue.length ? "danger" : "ok"}
          hint="Past due or missing a prerequisite"
          icon={<AlertTriangle className="size-4" />}
        />
        <Stat
          label="Due soon"
          value={String(comp.dueSoon.length + comp.inProgress.length)}
          tone="warn"
          hint="Within the next 90 days"
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="Next deadline"
          value={comp.nextDeadline?.dueDate ? formatDate(comp.nextDeadline.dueDate) : "None"}
          hint={comp.nextDeadline?.title}
          icon={<Scale className="size-4" />}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Obligations"
              
              icon={<Scale className="size-4" />}
            />
            {ordered.map((item) => {
              const meta = statusMeta[item.status];
              const Icon = meta.icon;
              return (
                <details key={item.id} className="group border-b border-border last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                    <span
                      className={`mt-0.5 shrink-0 ${
                        meta.tone === "ok"
                          ? "text-ok"
                          : meta.tone === "danger"
                            ? "text-danger"
                            : meta.tone === "warn"
                              ? "text-warn"
                              : "text-info"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                          {item.title}
                        </p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-fg-muted">
                        {item.citation} · {item.cadence}
                        {item.dueDate ? ` · due ${formatDate(item.dueDate, "long")}` : ""}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      {item.dueDate && item.status !== "compliant" ? (
                        <p
                          className={`text-[13px] font-semibold ${
                            item.status === "overdue" ? "text-danger" : "text-warn"
                          }`}
                        >
                          {relativeDays(item.dueDate)}
                        </p>
                      ) : item.completedDate ? (
                        <p className="text-[13px] text-fg-subtle">
                          done {formatDate(item.completedDate)}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[13px] text-fg-subtle">{item.owner.split(",")[0]}</p>
                    </div>
                    <ChevronDown className="mt-1 size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border bg-surface-2 px-5 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[13px] font-semibold text-fg-muted">
                          What the law requires
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
                          {item.summary}
                        </p>
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-fg-muted">
                          Evidence on file
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
                          {item.evidence}
                        </p>
                        <p className="mt-2 text-[13px] text-fg-subtle">
                          Responsible: {item.owner}
                        </p>
                      </div>
                    </div>
                    {item.actionHref ? (
                      <Link
                        href={item.actionHref}
                        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-brand-fg"
                      >
                        {item.actionLabel}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Was a hardcoded schedule naming Mehr Meadows' reserve consultant
              and its 41 percent funding, which every association saw as its
              own. An association with no study should be told that plainly,
              because it is the finding rather than an empty panel. */}
          <Card>
            <CardHeader
              title="How often a reserve study is due"
              icon={<GraduationCap className="size-4" />}
            />
            {funding.measurable ? (
              <>
                <div className="space-y-3 px-5 py-4">
                  {reserveDates.map((r) => (
                    <div key={r.label} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-fg">{r.label}</p>
                        <p className="text-[13px] text-fg-muted">{r.note}</p>
                      </div>
                      <p className="tnum shrink-0 text-[13px] font-medium text-fg">{r.value}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-5 py-4">
                  <Meter
                    value={funding.percent}
                    tone={funding.percent >= 0.7 ? "ok" : funding.percent >= 0.3 ? "warn" : "danger"}
                    aria-label={`Reserves ${Math.round(funding.percent * 100)} percent funded`}
                  />
                  <p className="mt-2 text-[13px] text-fg-muted">
                    {Math.round(funding.percent * 100)} percent funded against the study.
                  </p>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<GraduationCap className="size-6" />}
                title="No reserve study on file"
                description="Percent funded compares what you have saved against what you should have saved by now. Without a study there is no second number, so nobody knows."
              />
            )}
          </Card>

          <Callout
            tone="info"
            icon={<Info className="size-4" />}
            title="Placeholder, not legal advice"
          >
            These Washington entries are placeholders. The chapter is right, the deadline math is not
            verified. Nothing here should be relied on until counsel reviews it.
          </Callout>

          <Card>
            <CardHeader title="Coverage" />
            <div className="space-y-2.5 px-5 py-4">
              {[
                { name: "Washington, RCW 64.38 (HOA Act)", count: 5 },
                { name: "Washington, RCW 24.03A (nonprofit)", count: 1 },
                { name: "Federal, IRS reporting", count: 1 },
              ].map((j) => (
                <div key={j.name} className="flex items-center justify-between gap-3">
                  <span className="text-[15px] text-fg">{j.name}</span>
                  <span className="tnum text-[13px] text-fg-muted">{j.count}</span>
                </div>
              ))}
            </div>
            <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-fg-subtle">
              Recorded 2015, so RCW 64.38 governs rather than WUCIOA.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
