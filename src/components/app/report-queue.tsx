"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  Inbox,
  ShieldQuestion,
  X,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { canRaiseNotice, reportingPatterns, unverifiedReports } from "@/lib/violations";
import type { ViolationReport } from "@/lib/types";
import { formatDate, pluralize } from "@/lib/utils";

const STATUS: Record<
  ViolationReport["status"],
  { label: string; tone: "neutral" | "warn" | "ok" | "danger" }
> = {
  new: { label: "Nobody has looked yet", tone: "warn" },
  verifying: { label: "Being looked at", tone: "warn" },
  verified: { label: "Confirmed by the board", tone: "ok" },
  dismissed: { label: "Looked at, nothing in it", tone: "neutral" },
};

/**
 * What neighbours have told the board.
 *
 * The screen is built around a refusal. There is no button here that turns a
 * report into a notice, because every enforcement attorney who publishes on
 * this says the same thing: a complaint is an input to an investigation and
 * never a basis for enforcement. What there is instead is a box for what a
 * board member saw when they went and looked, and the notice rests on that.
 *
 * The reporter's name appears here and on nothing the accused household can
 * reach. Both halves are deliberate. Naming them turns a rule into a feud, and
 * not recording them at all hides the only thing on this screen that really
 * needs a board's attention: one owner reporting one neighbour over and over.
 */
export function ReportQueue() {
  const { community, account, verifyReport, dismissReport } = useAppState();
  const { notify } = useToast();
  const reports = community.violationReports;
  const waiting = unverifiedReports(reports);
  const patterns = reportingPatterns(reports);

  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"verify" | "dismiss">("verify");

  function start(report: ViolationReport, next: "verify" | "dismiss") {
    setOpenId(openId === report.id && mode === next ? null : report.id);
    setMode(next);
    setNote("");
  }

  function save(report: ViolationReport) {
    const who = account?.name ?? "The board";
    try {
      if (mode === "verify") {
        verifyReport(report.id, who, note);
        notify(`${report.reference} confirmed. A notice can now rest on what you saw.`);
      } else {
        dismissReport(report.id, note);
        notify(`${report.reference} closed. The reporter is not told who looked.`);
      }
      setOpenId(null);
      setNote("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save that", "warn");
    }
  }

  return (
    <>
      {patterns.length > 0 ? (
        <Card className="mb-5 border-warn/30">
          <CardHeader
            icon={<AlertTriangle className="size-4 text-warn" />}
            title={`${pluralize(patterns.length, "reporting pattern")} worth a look`}
            subtitle="One household repeatedly reporting the same neighbour. Shown to the board and to nobody else."
          />
          <div className="divide-y divide-border">
            {patterns.map((pattern) => (
              <div key={`${pattern.reporterId}-${pattern.subjectUnit}`} className="px-5 py-3.5">
                <p className="text-[15px] font-medium text-fg">
                  {pattern.reporterName} has reported unit {pattern.subjectUnit}{" "}
                  {pattern.count} times
                </p>
                {/* The ratio is the tell. Reports that all check out is a
                    diligent neighbour; reports that never do is a dispute the
                    association is being used as an instrument in, and where
                    the households differ in a way the Fair Housing Act cares
                    about it is a complaint against the association. */}
                <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                  {pattern.verified === 0
                    ? "None of them has been confirmed. Worth asking whether this is a dispute between two households before treating the next one as enforcement."
                    : `${pattern.verified} of ${pattern.count} checked out. Keep enforcing those on their own facts, and keep the pattern in mind.`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={<Inbox className="size-4" />}
          title="Reported by residents"
          subtitle="A report is somewhere to start looking. It is never the basis for a notice."
          action={
            waiting.length > 0 ? (
              <Badge tone="warn">{pluralize(waiting.length, "waiting")}</Badge>
            ) : null
          }
        />

        {reports.length === 0 ? (
          <EmptyState
            icon={<ShieldQuestion className="size-6" />}
            title="Nothing reported"
            description="Residents can tell the board about something they have seen. It comes here privately, and the person who reported it is never named to the household it concerns."
          />
        ) : (
          <div className="divide-y divide-border">
            {reports.map((report) => {
              const meta = STATUS[report.status];
              const open = openId === report.id;
              const raisable = canRaiseNotice(report);
              return (
                <div key={report.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-[13px] text-fg-muted">
                      About unit {report.subjectUnit}
                    </span>
                    <span className="text-[13px] text-fg-subtle">
                      {report.reference} · seen {formatDate(report.observedOn, "medium")}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[15px] leading-relaxed text-fg">{report.what}</p>

                  {/* Board only. There is no screen in this product that shows
                      an accused household who reported them. */}
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-subtle">
                    <Eye className="size-3" />
                    Reported by {report.reporterName}, unit {report.reporterUnit}. Not shown to
                    unit {report.subjectUnit}.
                  </p>

                  {report.verification ? (
                    <div className="mt-2.5 rounded-lg border border-ok/25 bg-ok-soft px-3 py-2.5">
                      <p className="text-[13px] font-semibold text-fg">
                        {report.verification.by} looked on{" "}
                        {formatDate(report.verification.on, "medium")}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                        {report.verification.note}
                      </p>
                    </div>
                  ) : null}

                  {report.dismissedReason ? (
                    <p className="mt-2.5 border-l-2 border-border-2 pl-3 text-[13px] leading-relaxed text-fg-muted">
                      {report.dismissedReason}
                    </p>
                  ) : null}

                  {report.status === "new" || report.status === "verifying" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => start(report, "verify")}>
                        <Check className="size-3.5" />
                        I went and looked
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => start(report, "dismiss")}>
                        <X className="size-3.5" />
                        Nothing in it
                      </Button>
                    </div>
                  ) : null}

                  {open ? (
                    <div className="mt-3 rounded-card border border-border bg-surface-2 p-3.5">
                      <label className="block">
                        <span className="text-[13px] font-semibold text-fg-muted">
                          {mode === "verify"
                            ? "What you saw, in your own words"
                            : "Why this is being closed"}
                        </span>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          autoFocus
                          aria-label={
                            mode === "verify"
                              ? `What you saw at unit ${report.subjectUnit}`
                              : `Why ${report.reference} is being closed`
                          }
                          placeholder={
                            mode === "verify"
                              ? "Walked past on the 5th at 6:40am. Truck present, commercial lettering visible from the sidewalk."
                              : "Looked on the 5th. Under the size the Committee reviews, no approval needed."
                          }
                          className="mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
                        />
                      </label>
                      {mode === "verify" ? (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-subtle">
                          This is what a notice would rest on, not what the neighbour told you.
                          Write what you personally observed and when.
                        </p>
                      ) : null}
                      <div className="mt-2.5 flex gap-2">
                        <Button size="sm" onClick={() => save(report)} disabled={!note.trim()}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {raisable && !report.violationId ? (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-fg-muted">
                      Confirmed, so a notice can be opened against unit {report.subjectUnit} on
                      what you saw.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
