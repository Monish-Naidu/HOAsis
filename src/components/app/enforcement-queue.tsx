"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Landmark,
  Printer,
  Send,
  ShieldQuestion,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import type { Tone } from "@/components/ui/primitives";
import { EvidenceViewer } from "@/components/app/evidence-viewer";
import { NoticeLetter } from "@/components/app/notice-letter";
import { TabPill } from "@/components/app/tab-pill";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { resolveCitation } from "@/lib/governing";
import type { CitationMatch } from "@/lib/governing";
import {
  canRaiseNotice,
  isCityNotice,
  photoConcerns,
  queueBuckets,
  reportingPatterns,
  resolvedInYear,
} from "@/lib/violations";
import type { QueueItem, ViolationSource } from "@/lib/violations";
import type { Owner, Violation, ViolationReport } from "@/lib/types";
import {
  cn,
  daysFromToday,
  formatDate,
  money,
  pluralize,
  relativeDays,
  todayIsoDate,
} from "@/lib/utils";

/**
 * Enforcement as one queue.
 *
 * It was two columns: notices on the left, what neighbours reported on the
 * right, and a board president had to read both to know what was waiting on
 * them. Now it is one list with three tabs, and the first tab is the answer to
 * the only question they arrive with.
 *
 * The refusal the old screens encoded survives. A report is an input to an
 * investigation and never the basis for a notice. Nothing here promotes a
 * complaint: the only way from a report to a notice runs through a board
 * member writing down what they personally saw, and `raiseNoticeFromReport`
 * refuses without that. The reporter's name appears here and on nothing the
 * accused household can reach.
 *
 * City and county notices sit in the same queue because they are board work
 * with a deadline. They look different because they are different: not
 * hearsay, nobody needs to go and look, and the citation is a case number
 * rather than a section of the declaration.
 */

/**
 * Why a citation did not land, said so a board can fix it.
 *
 * An unresolved citation is not a display problem. It means the notice names a
 * provision nobody can produce, and "which provision are you relying on" is
 * the first question at a hearing.
 */
const CITATION_PROBLEM: Record<NonNullable<CitationMatch["problem"]>, string> = {
  "no-document": "does not name which document",
  "not-in-this-document": "names no article that exists",
  "document-not-loaded": "that document is not on file as text",
};

const STAGE: Record<Violation["stage"], { tone: Tone; label: string }> = {
  courtesy: { tone: "neutral", label: "Courtesy notice" },
  "first-notice": { tone: "warn", label: "First notice" },
  hearing: { tone: "danger", label: "Hearing set" },
  fined: { tone: "danger", label: "Fined" },
  cured: { tone: "ok", label: "Resolved" },
};

/** The step after this one. Fines are a hearing outcome, never a click. */
const NEXT_STAGE: Partial<Record<Violation["stage"], Violation["stage"]>> = {
  courtesy: "first-notice",
  "first-notice": "hearing",
};

const REPORT_STATUS: Record<ViolationReport["status"], { tone: Tone; label: string }> = {
  new: { tone: "warn", label: "Nobody has looked yet" },
  verifying: { tone: "warn", label: "Being looked at" },
  verified: { tone: "ok", label: "Confirmed by the board" },
  dismissed: { tone: "neutral", label: "Nothing in it" },
};

const SOURCE: Record<ViolationSource, { label: string; icon: LucideIcon; tone: Tone }> = {
  neighbor: { label: "Neighbor", icon: Users, tone: "neutral" },
  board: { label: "Board", icon: ClipboardCheck, tone: "neutral" },
  city: { label: "City", icon: Landmark, tone: "info" },
};

type TabKey = "needsYou" | "open" | "resolved";
const TABS: { key: TabKey; label: string }[] = [
  { key: "needsYou", label: "Needs you" },
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
];

type SourceFilter = "all" | ViolationSource;
const SOURCES: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "neighbor", label: "Neighbors" },
  { key: "board", label: "Board" },
  { key: "city", label: "City" },
];

const INPUT =
  "mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand";
const LABEL = "text-[13px] font-semibold text-fg-muted";

/** "Unit 63" for a home, the words as given for anything else. */
function placeLabel(unit: string): string {
  return /^\d+[a-z]?$/i.test(unit) ? `Unit ${unit}` : unit;
}

type Editor =
  | { id: string; mode: "verify" | "dismiss" }
  | { id: string; mode: "notice" }
  | null;

export function EnforcementQueue() {
  const {
    community,
    account,
    verifyReport,
    dismissReport,
    raiseNoticeFromReport,
    setViolationStage,
    addCityNotice,
  } = useAppState();
  const { notify } = useToast();

  const buckets = queueBuckets(community);
  const year = todayIsoDate().slice(0, 4);
  const resolvedThisYear = resolvedInYear(buckets.resolved, year);
  const patterns = reportingPatterns(community.violationReports);

  const [tab, setTab] = useState<TabKey>("needsYou");
  const [source, setSource] = useState<SourceFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [note, setNote] = useState("");
  const [noticeRule, setNoticeRule] = useState("");
  const [noticeCitation, setNoticeCitation] = useState("");
  const [logging, setLogging] = useState(false);
  const [printing, setPrinting] = useState<Violation | null>(null);

  // An owner's word that it is fixed is the board's next job: go and look,
  // then close it. So it lands under Needs you and at the top of any list.
  const ownerSaysFixed = (item: QueueItem) =>
    item.kind === "violation" &&
    item.violation.stage !== "cured" &&
    Boolean(item.violation.ownerFixedDate);
  const rows = [
    ...(tab === "needsYou"
      ? buckets.open.filter((item) => ownerSaysFixed(item) && !buckets.needsYou.includes(item))
      : []),
    ...buckets[tab],
  ]
    .filter((item) => source === "all" || item.source === source)
    .sort((a, b) => Number(ownerSaysFixed(b)) - Number(ownerSaysFixed(a)));

  function switchTab(next: TabKey) {
    setTab(next);
    setOpenId(null);
    setEditor(null);
  }

  function toggleRow(id: string) {
    setOpenId(openId === id ? null : id);
    setEditor(null);
  }

  function startEditor(next: NonNullable<Editor>) {
    setEditor(editor?.id === next.id && editor.mode === next.mode ? null : next);
    setNote("");
    setNoticeRule("");
    setNoticeCitation("");
  }

  function ownerFor(report: ViolationReport): Owner | undefined {
    return (
      community.owners.find((o) => o.id === report.subjectOwnerId) ??
      community.owners.find((o) => o.unit === report.subjectUnit)
    );
  }

  function saveNote(report: ViolationReport, mode: "verify" | "dismiss") {
    const who = account?.name ?? "The board";
    try {
      if (mode === "verify") {
        verifyReport(report.id, who, note);
        notify(`${report.reference} confirmed. A notice can now rest on what you saw.`);
      } else {
        dismissReport(report.id, note);
        notify(`${report.reference} closed. The reporter is not told who looked.`);
      }
      setEditor(null);
      setNote("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save that", "warn");
    }
  }

  function sendNotice(report: ViolationReport) {
    const owner = ownerFor(report);
    if (!owner) return;
    try {
      const raised = raiseNoticeFromReport(report.id, {
        rule: noticeRule,
        ruleCitation: noticeCitation,
        ownerId: owner.id,
        ownerName: owner.displayName,
      });
      notify(`${raised.reference} opened against unit ${report.subjectUnit}. It is under Open.`);
      setEditor(null);
      setOpenId(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not open that notice", "warn");
    }
  }

  function advance(violation: Violation) {
    const next = NEXT_STAGE[violation.stage];
    if (!next) return;
    setViolationStage(violation.id, next);
    notify(`${violation.reference} moved to ${STAGE[next].label.toLowerCase()}.`);
  }

  function resolve(violation: Violation) {
    setViolationStage(violation.id, "cured");
    notify(`${violation.reference} resolved.`);
    setOpenId(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Enforcement"
        title="Violations"
        description="What neighbours reported, what the board has opened, and what the city has sent. A report is somewhere to start looking. It is never the basis for a notice."
        action={
          <Button
            variant="secondary"
            onClick={() => setLogging(!logging)}
            aria-expanded={logging}
          >
            <Landmark className="size-4" />
            Log a city notice
          </Button>
        }
      />

      {logging ? (
        <CityNoticeForm
          owners={community.owners}
          onCancel={() => setLogging(false)}
          onSave={(input) => {
            try {
              const raised = addCityNotice(input);
              notify(`${raised.reference} logged. Deadline ${formatDate(input.deadline)}.`);
              setLogging(false);
              switchTab(daysFromToday(input.deadline) <= 14 ? "needsYou" : "open");
              setSource("all");
            } catch (error) {
              notify(error instanceof Error ? error.message : "Could not log that", "warn");
            }
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Needs you"
          value={String(buckets.needsYou.length)}
          tone={buckets.needsYou.length > 0 ? "warn" : "neutral"}
          hint="Reports to look at and notices due this week"
        />
        <Stat label="Open" value={String(buckets.open.length)} hint="Everything not yet closed" />
        <Stat
          label="Resolved this year"
          value={String(resolvedThisYear.length)}
          tone="ok"
          hint="Cured notices and reports closed after a look"
        />
      </div>

      {patterns.length > 0 ? (
        <Callout
          tone="warn"
          icon={<AlertTriangle className="size-4" />}
          title={`${pluralize(patterns.length, "reporting pattern")} worth a look`}
          className="mt-5"
        >
          {/* The ratio is the tell. Reports that all check out is a diligent
              neighbour; reports that never do is a dispute the association is
              being used as an instrument in. Board only. */}
          {patterns.map((pattern) => (
            <p key={`${pattern.reporterId}-${pattern.subjectUnit}`} className="text-[13px]">
              {pattern.reporterName} has reported unit {pattern.subjectUnit} {pattern.count}{" "}
              times.{" "}
              {pattern.verified === 0
                ? "None confirmed. Ask whether this is a dispute between two households before treating the next one as enforcement."
                : `${pattern.verified} of ${pattern.count} checked out. Enforce those on their own facts and keep the pattern in mind.`}
            </p>
          ))}
        </Callout>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <TabPill
          activeKey={tab}
          className="inline-flex gap-1 rounded-xl bg-surface-2 p-1"
          pillClassName="bg-surface shadow-card rounded-lg"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              data-tab-key={t.key}
              aria-selected={tab === t.key}
              onClick={() => switchTab(t.key)}
              className={cn(
                "relative z-10 flex items-center gap-1.5 rounded-lg px-4 py-2 text-[15px] font-medium transition-colors duration-200",
                tab === t.key ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {t.label}
              <span className="tnum text-[13px] text-fg-subtle">{buckets[t.key].length}</span>
            </button>
          ))}
        </TabPill>

        <div className="flex flex-wrap gap-1.5" aria-label="Filter by source">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={source === s.key}
              onClick={() => setSource(s.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                source === s.key
                  ? "border-transparent bg-brand-soft text-brand-soft-fg"
                  : "border-border text-fg-muted hover:text-fg",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-3">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ShieldQuestion className="size-6" />}
            title={
              source !== "all"
                ? `Nothing from ${SOURCES.find((s) => s.key === source)?.label.toLowerCase()} here`
                : tab === "needsYou"
                  ? "Nothing needs you"
                  : tab === "open"
                    ? "Nothing open"
                    : "Nothing resolved yet"
            }
            description={
              tab === "needsYou"
                ? "Every report has been looked at and no notice is due this week."
                : tab === "open"
                  ? "Residents can tell the board about something they have seen. It comes here privately, and the person who reported it is never named to the household it concerns."
                  : "Resolved notices and closed reports will be listed here with their dates."
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                open={openId === item.id}
                editor={editor?.id === item.id ? editor : null}
                onToggle={() => toggleRow(item.id)}
                onStart={startEditor}
                onCancel={() => setEditor(null)}
                note={note}
                onNote={setNote}
                noticeRule={noticeRule}
                onNoticeRule={setNoticeRule}
                noticeCitation={noticeCitation}
                onNoticeCitation={setNoticeCitation}
                onSaveNote={saveNote}
                onSendNotice={sendNotice}
                onAdvance={advance}
                onResolve={resolve}
                onPrint={setPrinting}
                ownerFor={ownerFor}
                reportFor={(id) => community.violationReports.find((r) => r.id === id)}
                citationFor={(citation) => resolveCitation(citation, community.governingDocs)}
              />
            ))}
          </div>
        )}
      </Card>

      {printing ? <NoticeLetter violation={printing} onClose={() => setPrinting(null)} /> : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* One row                                                                     */
/* -------------------------------------------------------------------------- */

function QueueRow({
  item,
  open,
  editor,
  onToggle,
  onStart,
  onCancel,
  note,
  onNote,
  noticeRule,
  onNoticeRule,
  noticeCitation,
  onNoticeCitation,
  onSaveNote,
  onSendNotice,
  onAdvance,
  onResolve,
  onPrint,
  ownerFor,
  reportFor,
  citationFor,
}: {
  item: QueueItem;
  open: boolean;
  editor: Editor;
  onToggle: () => void;
  onStart: (editor: NonNullable<Editor>) => void;
  onCancel: () => void;
  note: string;
  onNote: (value: string) => void;
  noticeRule: string;
  onNoticeRule: (value: string) => void;
  noticeCitation: string;
  onNoticeCitation: (value: string) => void;
  onSaveNote: (report: ViolationReport, mode: "verify" | "dismiss") => void;
  onSendNotice: (report: ViolationReport) => void;
  onAdvance: (violation: Violation) => void;
  onResolve: (violation: Violation) => void;
  onPrint: (violation: Violation) => void;
  ownerFor: (report: ViolationReport) => Owner | undefined;
  reportFor: (id: string) => ViolationReport | undefined;
  citationFor: (citation: string) => CitationMatch;
}) {
  const src = SOURCE[item.source];
  const saysFixed =
    item.kind === "violation" &&
    item.violation.stage !== "cured" &&
    Boolean(item.violation.ownerFixedDate);
  const SourceIcon = src.icon;
  const city = item.kind === "violation" && isCityNotice(item.violation);

  // The collapsed line: what, where, when, and how far along it is.
  let title: string;
  let where: string;
  let when: string;
  let whenTone: "muted" | "warn" | "danger" = "muted";
  let status: { tone: Tone; label: string };
  let concerns = 0;

  if (item.kind === "report") {
    const { report } = item;
    const owner = ownerFor(report);
    title = report.what;
    where = `${placeLabel(report.subjectUnit)}${owner ? ` · ${owner.displayName}` : ""}`;
    when = `Reported ${formatDate(report.submittedOn)}`;
    status = REPORT_STATUS[report.status];
    if (report.status === "verified" && !report.violationId) {
      status = { tone: "ok", label: "Confirmed, no notice yet" };
    }
  } else {
    const { violation } = item;
    title = violation.rule;
    where = `${placeLabel(violation.unit)} · ${violation.ownerName}`;
    status = STAGE[violation.stage];
    concerns = violation.stage === "cured" ? 0 : photoConcerns(violation.photos).length;
    if (violation.stage === "cured") {
      when = `Resolved ${formatDate(violation.resolvedDate ?? violation.nextActionDate)}`;
    } else if (city) {
      const days = daysFromToday(violation.nextActionDate);
      when = `Deadline ${formatDate(violation.nextActionDate)}`;
      whenTone = days < 0 ? "danger" : days <= 14 ? "warn" : "muted";
      status = { tone: "info", label: "Awaiting fix" };
    } else {
      const days = daysFromToday(violation.nextActionDate);
      when = `Next step ${relativeDays(violation.nextActionDate)}`;
      whenTone = days < 0 ? "danger" : days <= 5 ? "warn" : "muted";
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-2"
      >
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
            city ? "bg-info-soft text-info" : "bg-surface-2 text-fg-muted",
          )}
          aria-hidden
        >
          <SourceIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px] font-medium text-fg", !open && "truncate")}>
            {title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
            <Badge tone={src.tone} className="px-1.5 py-0 text-[12px]">
              {city && item.kind === "violation"
                ? (item.violation.agency ?? "City")
                : src.label}
            </Badge>
            <span>{where}</span>
            <span className="text-fg-subtle">
              {item.kind === "report" ? item.report.reference : item.violation.reference}
              {city && item.kind === "violation" && item.violation.caseNumber
                ? ` · case ${item.violation.caseNumber}`
                : ""}
            </span>
            {saysFixed ? (
              <Badge tone="ok" className="px-1.5 py-0 text-[12px]">
                <Check className="size-3" />
                Owner says fixed
              </Badge>
            ) : null}
          </span>
          {/* Where a notice sits on contestable evidence, the board is told
              here rather than at the hearing. */}
          {concerns > 0 ? (
            <span className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-warn">
              <AlertTriangle className="size-3" />
              {pluralize(concerns, "photograph")} worth checking before this goes further
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <ChevronDown
              className={cn(
                "size-4 text-fg-subtle transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </span>
          <span
            className={cn(
              "tnum text-[13px]",
              whenTone === "danger"
                ? "font-medium text-danger"
                : whenTone === "warn"
                  ? "font-medium text-warn"
                  : "text-fg-muted",
            )}
          >
            {when}
          </span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-border/60 px-5 py-4 sm:pl-16">
          {item.kind === "report" ? (
            <ReportDetail
              report={item.report}
              owner={ownerFor(item.report)}
              editor={editor}
              note={note}
              onNote={onNote}
              noticeRule={noticeRule}
              onNoticeRule={onNoticeRule}
              noticeCitation={noticeCitation}
              onNoticeCitation={onNoticeCitation}
              onStart={onStart}
              onCancel={onCancel}
              onSaveNote={onSaveNote}
              onSendNotice={onSendNotice}
            />
          ) : (
            <ViolationDetail
              violation={item.violation}
              report={item.violation.reportId ? reportFor(item.violation.reportId) : undefined}
              cited={city ? null : citationFor(item.violation.ruleCitation)}
              onAdvance={onAdvance}
              onResolve={onResolve}
              onPrint={onPrint}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A report, opened                                                            */
/* -------------------------------------------------------------------------- */

function ReporterLine({ report }: { report: ViolationReport }) {
  // Board only. There is no screen in this product that shows an accused
  // household who reported them.
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
      <Eye className="size-3" />
      Reported by {report.reporterName}, unit {report.reporterUnit}. Not shown to unit{" "}
      {report.subjectUnit}.
    </p>
  );
}

function VerificationNote({ report }: { report: ViolationReport }) {
  if (!report.verification) return null;
  return (
    <div className="rounded-lg border border-ok/25 bg-ok-soft px-3 py-2.5">
      <p className="text-[13px] font-semibold text-fg">
        {report.verification.by} looked on {formatDate(report.verification.on)}
      </p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
        {report.verification.note}
      </p>
    </div>
  );
}

function ReportDetail({
  report,
  owner,
  editor,
  note,
  onNote,
  noticeRule,
  onNoticeRule,
  noticeCitation,
  onNoticeCitation,
  onStart,
  onCancel,
  onSaveNote,
  onSendNotice,
}: {
  report: ViolationReport;
  owner: Owner | undefined;
  editor: Editor;
  note: string;
  onNote: (value: string) => void;
  noticeRule: string;
  onNoticeRule: (value: string) => void;
  noticeCitation: string;
  onNoticeCitation: (value: string) => void;
  onStart: (editor: NonNullable<Editor>) => void;
  onCancel: () => void;
  onSaveNote: (report: ViolationReport, mode: "verify" | "dismiss") => void;
  onSendNotice: (report: ViolationReport) => void;
}) {
  const waiting = report.status === "new" || report.status === "verifying";
  const raisable = canRaiseNotice(report) && !report.violationId;
  const noteMode = editor?.mode === "verify" || editor?.mode === "dismiss" ? editor.mode : null;

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-fg">{report.what}</p>
      <p className="text-[13px] text-fg-muted">
        Seen {formatDate(report.observedOn)}, reported {formatDate(report.submittedOn)}.
      </p>
      <ReporterLine report={report} />
      <VerificationNote report={report} />

      {report.dismissedReason ? (
        <p className="border-l-2 border-border-2 pl-3 text-[13px] leading-relaxed text-fg-muted">
          {report.dismissedReason}
        </p>
      ) : null}

      {waiting ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onStart({ id: report.id, mode: "verify" })}
          >
            <Check className="size-3.5" />I went and looked
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStart({ id: report.id, mode: "dismiss" })}
          >
            <X className="size-3.5" />
            Nothing in it
          </Button>
        </div>
      ) : null}

      {noteMode ? (
        <div className="rounded-card border border-border bg-surface-2 p-3.5">
          <label className="block">
            <span className={LABEL}>
              {noteMode === "verify" ? "What you saw, in your own words" : "Why this is being closed"}
            </span>
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              rows={3}
              autoFocus
              aria-label={
                noteMode === "verify"
                  ? `What you saw at unit ${report.subjectUnit}`
                  : `Why ${report.reference} is being closed`
              }
              placeholder={
                noteMode === "verify"
                  ? "Walked past on the 5th at 6:40am. Truck present, commercial lettering visible from the sidewalk."
                  : "Looked on the 5th. Under the size the Committee reviews, no approval needed."
              }
              className={INPUT}
            />
          </label>
          {noteMode === "verify" ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-subtle">
              This is what a notice would rest on, not what the neighbour told you. Write what
              you personally observed and when.
            </p>
          ) : null}
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" onClick={() => onSaveNote(report, noteMode)} disabled={!note.trim()}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {raisable ? (
        <div className="space-y-2.5">
          <p className="text-[13px] leading-relaxed text-fg-muted">
            Confirmed, so a notice can be opened against unit {report.subjectUnit} on what you
            saw. It will carry your observation and your citation, and none of the reporter&apos;s
            words.
          </p>
          {editor?.mode !== "notice" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onStart({ id: report.id, mode: "notice" })}
              disabled={!owner}
            >
              <Send className="size-3.5" />
              Send notice
            </Button>
          ) : null}
          {!owner ? (
            <p className="text-[13px] text-warn">
              No owner on file for unit {report.subjectUnit}. Add the household first.
            </p>
          ) : null}
          {editor?.mode === "notice" && owner ? (
            <div className="rounded-card border border-border bg-surface-2 p-3.5">
              <p className="text-[13px] text-fg-muted">
                To {owner.displayName}, unit {owner.unit}. Starts as a courtesy notice.
              </p>
              <label className="mt-3 block">
                <span className={LABEL}>What the notice says</span>
                <input
                  value={noticeRule}
                  onChange={(e) => onNoticeRule(e.target.value)}
                  autoFocus
                  aria-label="What the notice says"
                  placeholder="Commercial vehicle parked overnight in driveway"
                  className={INPUT}
                />
              </label>
              <label className="mt-3 block">
                <span className={LABEL}>Which provision</span>
                <input
                  value={noticeCitation}
                  onChange={(e) => onNoticeCitation(e.target.value)}
                  aria-label="Which provision the notice rests on"
                  placeholder="CC&Rs Art. IX §2(b)"
                  className={INPUT}
                />
              </label>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onSendNotice(report)}
                  disabled={!noticeRule.trim() || !noticeCitation.trim()}
                >
                  <Send className="size-3.5" />
                  Send notice
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A violation, opened                                                         */
/* -------------------------------------------------------------------------- */

function ViolationDetail({
  violation,
  report,
  cited,
  onAdvance,
  onResolve,
  onPrint,
}: {
  violation: Violation;
  /** The report it started from, when it started from one. Board only. */
  report: ViolationReport | undefined;
  /** Null for a city notice, whose citation is a case rather than an article. */
  cited: CitationMatch | null;
  onAdvance: (violation: Violation) => void;
  onResolve: (violation: Violation) => void;
  onPrint: (violation: Violation) => void;
}) {
  const city = isCityNotice(violation);
  const openMatter = violation.stage !== "cured";
  const next = NEXT_STAGE[violation.stage];
  const concerns = photoConcerns(violation.photos);
  const homeUnit = /^\d+[a-z]?$/i.test(violation.unit);

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-fg">{violation.rule}</p>

      {/* The owner's word comes first, because it is what changed and what
          the board does next: somebody goes to look, then closes it. */}
      {openMatter && violation.ownerFixedDate ? (
        <div className="rounded-lg border border-ok/25 bg-ok-soft px-3 py-2.5 text-[13px] leading-relaxed">
          <p className="flex items-center gap-1.5 font-semibold text-ok">
            <Check className="size-3.5" />
            Owner says fixed {formatDate(violation.ownerFixedDate, "medium")}
          </p>
          <p className="mt-0.5 text-fg-muted">
            {violation.ownerFixedNote
              ? `"${violation.ownerFixedNote}"`
              : "No note was left."}{" "}
            Have somebody look, then mark it resolved if it is.
          </p>
        </div>
      ) : null}

      {city ? (
        <div className="rounded-lg border border-info/25 bg-info-soft px-3 py-2.5 text-[13px] leading-relaxed">
          <p className="font-semibold text-info">
            {violation.agency ?? "City notice"}
            {violation.caseNumber ? ` · case ${violation.caseNumber}` : ""}
          </p>
          <p className="mt-0.5 text-fg-muted">
            Received {formatDate(violation.openedDate)}. Deadline{" "}
            <span className="font-medium text-fg">{formatDate(violation.nextActionDate)}</span>
            {openMatter ? ` (${relativeDays(violation.nextActionDate)})` : ""}. An agency notice
            is not hearsay: nobody needs to go and look, it needs fixing by the date.
          </p>
        </div>
      ) : cited ? (
        <p className="text-[13px] text-fg-subtle">
          {cited.article ? (
            <>
              <Link
                href="/board/documents/governing"
                className="font-medium text-brand hover:underline"
                title={cited.article.title}
              >
                {violation.ruleCitation}
              </Link>
              <span className="text-fg-muted">
                {" "}
                · {cited.article.title}
                {cited.parsed.section ? `, at section ${cited.parsed.section}` : ""}
              </span>
            </>
          ) : (
            <span className="font-medium text-warn">
              {violation.ruleCitation} · {CITATION_PROBLEM[cited.problem ?? "no-document"]}
            </span>
          )}{" "}
          · opened {formatDate(violation.openedDate)}
          {violation.fineCents ? ` · fine ${money(violation.fineCents)}` : ""}
        </p>
      ) : null}

      <EvidenceViewer
        photos={violation.photos}
        showConcerns
        emptyNote={
          city
            ? "No photographs yet. Add the board's own before the deadline so the fix is on record."
            : undefined
        }
      />
      {concerns.length > 0 ? (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-warn">
          <AlertTriangle className="size-3" />
          {pluralize(concerns.length, "photograph")} worth checking before this goes further
        </p>
      ) : null}
      {homeUnit && violation.photos.length > 0 ? (
        <p className="text-[13px] leading-relaxed text-fg-subtle">
          Unit {violation.unit} sees exactly these photographs, with the same dates and the same
          note of where each was taken from.
        </p>
      ) : null}

      {report ? (
        <div className="space-y-2 rounded-card border border-border bg-surface-2 p-3.5">
          <p className="text-[13px] font-semibold text-fg-muted">Started from {report.reference}</p>
          <p className="text-[13px] leading-relaxed text-fg-muted">{report.what}</p>
          <ReporterLine report={report} />
          <VerificationNote report={report} />
        </div>
      ) : null}

      {openMatter ? (
        <div className="flex flex-wrap items-center gap-2">
          {!city && next ? (
            <Button variant="secondary" size="sm" onClick={() => onAdvance(violation)}>
              <Send className="size-3.5" />
              Send next notice
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => onResolve(violation)}>
            <Check className="size-3.5" />
            Mark resolved
          </Button>
          {!city ? (
            <Button variant="ghost" size="sm" onClick={() => onPrint(violation)}>
              <Printer className="size-3.5" />
              Print letter
            </Button>
          ) : null}
          <span className="text-[13px] text-fg-subtle">
            {city
              ? "Resolve once the agency has closed the case."
              : next
                ? `Next is ${STAGE[next].label.toLowerCase()}. Fines are set at the hearing, never here.`
                : violation.stage === "hearing"
                  ? "The hearing decides what happens next."
                  : "Resolve once the fine is settled and the matter cured."}
          </span>
        </div>
      ) : (
        <p className="text-[13px] text-fg-muted">
          Resolved {formatDate(violation.resolvedDate ?? violation.nextActionDate)}.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Logging a city notice                                                       */
/* -------------------------------------------------------------------------- */

function CityNoticeForm({
  owners,
  onCancel,
  onSave,
}: {
  owners: Owner[];
  onCancel: () => void;
  onSave: (input: {
    agency: string;
    caseNumber: string;
    deadline: string;
    rule: string;
    ownerId?: string;
    ownerName?: string;
    unit?: string;
  }) => void;
}) {
  const [agency, setAgency] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [deadline, setDeadline] = useState("");
  const [what, setWhat] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const owner = owners.find((o) => o.id === ownerId);
  const ready = agency.trim() && what.trim() && deadline;
  const sorted = [...owners].sort((a, b) =>
    a.unit.localeCompare(b.unit, undefined, { numeric: true }),
  );

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
          <Landmark className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg">Log a city notice</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
            A notice from a city or county agency. It goes in the queue with its deadline and
            nobody has to go and look.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Agency</span>
          <input
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            autoFocus
            aria-label="Agency"
            placeholder="Snohomish County Code Enforcement"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Case number</span>
          <input
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            aria-label="Case number"
            placeholder="CE-26-01187"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Deadline</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            aria-label="Deadline"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>About</span>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            aria-label="Which home the notice is about"
            className={INPUT}
          >
            <option value="">The association (common area)</option>
            {sorted.map((o) => (
              <option key={o.id} value={o.id}>
                Unit {o.unit} · {o.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={LABEL}>What it says</span>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            rows={3}
            aria-label="What the notice says"
            placeholder="Retention pond fence has two leaning panels and one missing. Repair to code before the compliance date."
            className={INPUT}
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!ready}
          onClick={() =>
            onSave({
              agency,
              caseNumber,
              deadline,
              rule: what,
              ownerId: owner?.id,
              ownerName: owner?.displayName,
              unit: owner?.unit,
            })
          }
        >
          Log notice
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
