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
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Meter, PageHeader, Stat } from "@/components/ui/primitives";
import { interestSummary } from "@/lib/metrics";
import { complianceRegister } from "@/lib/compliance";
import type { ObligationCadence } from "@/lib/data/obligations";
import { percentFunded } from "@/lib/reserves";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { formatDate, relativeDays, shortMoney, todayIsoDate } from "@/lib/utils";
import type { ComplianceStatus } from "@/lib/types";

/** How often, in words rather than in a slug. */
const CADENCE_LABEL: Record<ObligationCadence, string> = {
  annual: "Every year",
  triennial: "Every three years",
  "each-budget": "Every budget",
  "on-request": "Whenever somebody asks",
  ongoing: "Continuing",
};

/** Worst first, then soonest. */
const STATUS_RANK: Record<ComplianceStatus, number> = {
  overdue: 0,
  "due-soon": 1,
  "in-progress": 2,
  compliant: 3,
};

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
  const { community, updateSettings } = useAppState();
  const { notify } = useToast();

  // The board's word that a duty was met. We hold the date and nothing else.
  function markDone(key: string, label: string) {
    const done = { ...(community.settings.complianceDone ?? {}), [key]: todayIsoDate() };
    updateSettings({ complianceDone: done });
    notify(`${label} marked done ${formatDate(todayIsoDate(), "long")}.`);
  }
  function unmark(key: string) {
    const done = { ...(community.settings.complianceDone ?? {}) };
    delete done[key];
    updateSettings({ complianceDone: done });
  }

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
  /**
   * Derived from the library's own research rather than hand written.
   *
   * The register used to be a fixture with a note in it saying not to trust
   * the deadline maths. Every cited row here traces to a state article that
   * carries its own sources, and the dates are arithmetic on this
   * association's fiscal year. What is still not derived is whether they
   * actually did it, because we cannot see the filed report.
   */
  const register = complianceRegister(community);
  const ordered = [...register.items].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    }
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <>
      <PageHeader
        eyebrow={
          register.cited
            ? `${association.stateName} · deadlines from the ${association.stateName} guide`
            : `${association.stateName} · general obligations`
        }
        title="Deadlines"
        description="Filings and deadlines for the association. Mark each one done when it is."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Tracked"
          value={String(register.items.length)}
          hint={
            register.cited
              ? `Written from the ${association.stateName} guide, with sections`
              : "General obligations. Your state's sections are not written yet"
          }
          icon={<Scale className="size-4" />}
        />
        <Stat
          label="Past due"
          value={String(register.overdue.length)}
          tone={register.overdue.length ? "danger" : "ok"}
          hint="The date has passed"
          icon={<AlertTriangle className="size-4" />}
        />
        <Stat
          label="Inside 45 days"
          value={String(register.dueSoon.length)}
          tone={register.dueSoon.length ? "warn" : "ok"}
          hint="Close enough to start on"
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="Next one due"
          value={register.next?.dueDate ? formatDate(register.next.dueDate) : "None dated"}
          hint={register.next?.label}
          icon={<CheckCircle2 className="size-4" />}
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
                <details key={item.key} className="group border-b border-border last:border-b-0">
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
                        <p className="text-body font-semibold leading-snug tracking-[-0.01em] text-fg">
                          {item.label}
                        </p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {item.fromDayOne ? <Badge tone="neutral">From day one</Badge> : null}
                      </div>
                      <p className="mt-1 text-footnote text-fg-muted">
                        {/* A cited row names its section. An uncited one says
                            so rather than borrowing the confidence of the
                            rows around it. */}
                        {item.citation ?? "General duty, section not written for your state yet"}
                        {" · "}
                        {CADENCE_LABEL[item.cadence]}
                        {item.dueDate ? ` · due ${formatDate(item.dueDate, "long")}` : ""}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      {item.dueDate && item.status !== "compliant" ? (
                        <p
                          className={`text-footnote font-semibold ${
                            item.status === "overdue" ? "text-danger" : "text-warn"
                          }`}
                        >
                          {relativeDays(item.dueDate)}
                        </p>
                      ) : item.clockDays ? (
                        <p className="text-footnote text-fg-subtle">
                          {item.clockDays} day clock
                        </p>
                      ) : null}
                    </div>
                    <ChevronDown className="mt-1 size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border bg-surface-2 px-5 py-4">
                    <p className="text-footnote font-semibold text-fg-muted">
                      What you have to be able to show
                    </p>
                    <p className="mt-1.5 max-w-2xl text-body leading-relaxed text-fg-muted">
                      {item.evidence}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.href ? (
                        <ButtonLink
                          href={item.href}
                          variant="primary"
                          size="sm"
                        >
                          Open the screen that holds it
                          <ArrowRight className="size-3.5" />
                        </ButtonLink>
                      ) : null}
                      {item.article ? (
                        <Link
                          href={`/library/${item.article}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-2 bg-surface px-3 text-footnote font-medium text-fg"
                        >
                          Read where this comes from
                        </Link>
                      ) : null}
                      {item.cadence === "on-request" || item.cadence === "ongoing" ? null : item.doneOn ? (
                        <span className="inline-flex h-8 items-center gap-2 text-footnote text-fg-muted">
                          Done {formatDate(item.doneOn, "long")}
                          <button
                            type="button"
                            onClick={() => unmark(item.key)}
                            className="font-semibold text-fg underline underline-offset-2"
                          >
                            Undo
                          </button>
                        </span>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => markDone(item.key, item.label)}>
                          <CheckCircle2 className="size-3.5" />
                          Mark done
                        </Button>
                      )}
                    </div>
                  </div>
                </details>
              );
            })}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Was a hardcoded schedule naming Willow Creek Estates' reserve consultant
              and its 41 percent funding, which every association saw as its
              own. An association with no study should be told that plainly,
              because it is the finding rather than an empty panel. */}
          <Card>
            <CardHeader
              title="Reserve study"
              icon={<GraduationCap className="size-4" />}
            />
            {funding.measurable ? (
              <>
                <div className="space-y-3 px-5 py-4">
                  {reserveDates.map((r) => (
                    <div key={r.label} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body font-medium text-fg">{r.label}</p>
                        <p className="text-footnote text-fg-muted">{r.note}</p>
                      </div>
                      <p className="tnum shrink-0 text-footnote font-medium text-fg">{r.value}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-5 py-4">
                  <Meter
                    value={funding.percent}
                    tone={funding.percent >= 0.7 ? "ok" : funding.percent >= 0.3 ? "warn" : "danger"}
                    aria-label={`Reserves ${Math.round(funding.percent * 100)} percent funded`}
                  />
                  <p className="mt-2 text-footnote text-fg-muted">
                    {Math.round(funding.percent * 100)} percent funded against the study.
                  </p>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<GraduationCap className="size-6" />}
                title="No reserve study on file"
                description="Percent funded compares savings to the reserve study target. Upload a reserve study in Documents to see it."
              />
            )}
          </Card>

          {/* Coverage is stated rather than implied. A board in a state we
              have not written yet should know that is what it is looking at,
              not assume the general rows carry the same weight as a cited
              one. */}
          <Card>
            <CardHeader
              title="Where these come from"
              icon={<Info className="size-4" />}
            />
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-body text-fg">With a section, from your state guide</span>
                <span className="tnum shrink-0 text-footnote font-medium text-fg-muted">
                  {register.items.filter((i) => i.cited).length}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-body text-fg">General duty, section not written yet</span>
                <span className="tnum shrink-0 text-footnote font-medium text-fg-muted">
                  {register.items.filter((i) => !i.cited).length}
                </span>
              </div>
            </div>
            <p className="border-t border-border px-5 py-3 text-footnote leading-relaxed text-fg-subtle">
              {register.cited
                ? `Each deadline with a section comes from the ${association.stateName} guide in the library, which lists its sources. Dates are worked out from your fiscal year. You mark when a deadline is done. None of this is legal advice.`
                : `${association.stateName} sections are not written into the register yet, so these are the duties almost every association has, with no law cited. The library has the ${association.stateName} guide, and the sections will follow.`}
            </p>
          </Card>

          {register.dayOne.length > 0 ? (
            <Card>
              <CardHeader
                title="Owed from day one"
                subtitle="Ongoing obligations for every community"
              />
              <div className="divide-y divide-border">
                {register.dayOne.map((item) => (
                  <p key={item.key} className="px-5 py-2.5 text-body text-fg">
                    {item.label}
                  </p>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
