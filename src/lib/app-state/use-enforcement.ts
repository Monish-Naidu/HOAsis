import { useCallback } from "react";
import { type AppDeps, isUuid, logDemoActivity, newId, remoteWrite, sliceStore, ValidationError } from "./core";
import { addDays, todayIsoDate } from "@/lib/utils";
import { NOTHING_CHANGED } from "@/lib/data/remote-store";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Violation, ViolationReport } from "@/lib/types";
import { canRaiseNotice } from "@/lib/violations";
import { activityWords } from "@/lib/activity";

/**
 * Enforcement: what residents report, what the board raises from it, the
 * stages a violation moves through, and city notices.
 */
export function useEnforcementActions(deps: AppDeps) {
  const { remote, communityId } = deps;

  /**
   * A neighbour telling the board about another home.
   *
   * Lands as a report and never as a violation. The gap between those two is
   * the whole of this feature: what a resident submits is an input to an
   * investigation, and it becomes enforceable only once somebody from the
   * association has gone and looked.
   */
  const addViolationReport = useCallback(
    (input: {
      reporterId: string;
      reporterName: string;
      reporterUnit: string;
      subjectUnit: string;
      subjectOwnerId?: string;
      what: string;
      observedOn: string;
    }) => {
      const existing = remote.community
        ? remote.community.violationReports
        : sliceStore(communityId, "violationReports").getSnapshot();
      const sequence = existing.length + 1;
      const report: ViolationReport = {
        id: remote.community ? newId() : `rep-${communityId}-${sequence}-${input.subjectUnit}`,
        reference: `REP-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        reporterId: input.reporterId,
        reporterName: input.reporterName,
        reporterUnit: input.reporterUnit,
        subjectUnit: input.subjectUnit.trim(),
        subjectOwnerId: input.subjectOwnerId,
        what: input.what.trim(),
        observedOn: input.observedOn,
        submittedOn: todayIsoDate(),
        status: "new",
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Sending the report", () =>
          supabaseBrowser().from("violation_reports").insert({
            id: report.id,
            association_id: rc.id,
            reference: report.reference,
            reporter_profile_id: remote.profileId,
            reporter_name: report.reporterName,
            reporter_unit: report.reporterUnit,
            subject_unit: report.subjectUnit,
            subject_unit_id: isUuid(report.subjectOwnerId ?? "") ? report.subjectOwnerId : null,
            what: report.what,
            observed_on: report.observedOn,
            submitted_on: report.submittedOn,
            status: "new",
          }),
        );
        return report;
      }
      sliceStore(communityId, "violationReports").update((all) => [report, ...all]);
      return report;
    },
    [remote.community, remote.profileId, communityId],
  );

  /**
   * The board's own observation, written down.
   *
   * Not a status flip. The note is the thing a notice rests on, so a
   * verification without one is refused rather than recorded, which is the
   * difference between an investigation and a tick.
   */
  const verifyReport = useCallback(
    (reportId: string, by: string, note: string) => {
      if (!note.trim()) {
        throw new ValidationError("Write down what you saw before marking this verified", {
          reportId,
        });
      }
      if (remote.community) {
        void remoteWrite("Saving what you saw", () =>
          supabaseBrowser()
            .from("violation_reports")
            .update(
              {
                status: "verified",
                verified_by: by,
                verified_on: todayIsoDate(),
                verification_note: note.trim(),
              },
              { count: "exact" },
            )
            .eq("id", reportId),
        );
        return;
      }
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: "verified" as const,
                verification: { by, on: todayIsoDate(), note: note.trim() },
              }
            : r,
        ),
      );
    },
    [remote.community, communityId],
  );

  /** Closing a report the board looked at and found nothing in. */
  const dismissReport = useCallback(
    (reportId: string, reason: string) => {
      if (remote.community) {
        void remoteWrite("Closing the report", () =>
          supabaseBrowser()
            .from("violation_reports")
            .update({ status: "dismissed", dismissed_reason: reason.trim() }, { count: "exact" })
            .eq("id", reportId),
        );
        return;
      }
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) =>
          r.id === reportId
            ? { ...r, status: "dismissed" as const, dismissedReason: reason.trim() }
            : r,
        ),
      );
    },
    [remote.community, communityId],
  );

  /**
   * Raising a notice from a verified report.
   *
   * Refuses anything that has not been verified, in the state layer rather
   * than only in the screen, because the screen is the part somebody will
   * later copy. The notice carries the board's citation and the board's
   * photographs; nothing the reporter wrote becomes the allegation.
   */
  const raiseNoticeFromReport = useCallback(
    (
      reportId: string,
      input: { rule: string; ruleCitation: string; ownerId: string; ownerName: string },
    ) => {
      const reports = remote.community
        ? remote.community.violationReports
        : sliceStore(communityId, "violationReports").getSnapshot();
      const report = reports.find((r) => r.id === reportId);
      if (!report) throw new ValidationError("That report is not on file", { reportId });
      if (!canRaiseNotice(report)) {
        throw new ValidationError(
          "Someone has to look at the home and mark this report verified before a notice can be sent",
          { reportId },
        );
      }

      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `VIO-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        unit: report.subjectUnit,
        rule: input.rule.trim(),
        ruleCitation: input.ruleCitation.trim(),
        stage: "courtesy",
        openedDate: todayIsoDate(),
        nextActionDate: addDays(todayIsoDate(), 14),
        // The board's own photographs go on afterwards. Nothing the reporter
        // supplied is carried across as if the association had taken it.
        photos: [],
        fineCents: 0,
        reportId,
      };

      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Raising the notice", async () => {
          const supabase = supabaseBrowser();
          // The report is claimed first, and only while no notice stands on
          // it. This is the write row level security can hide, and it used
          // to come second: the notice went in, the link matched nothing,
          // the board was told nothing had changed, and pressing again
          // raised a second notice on the same report. Refused here, nothing
          // has been written yet, so pressing again is safe.
          const claim = await supabase
            .from("violation_reports")
            .update({ violation_id: violation.id }, { count: "exact" })
            .eq("id", reportId)
            .is("violation_id", null);
          if (claim.error) throw new Error(claim.error.message);
          if (claim.count === 0) throw new Error(NOTHING_CHANGED);
          const { error } = await supabase.from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            fix: violation.fix ?? "",
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: reportId,
            source: "neighbor",
          });
          if (error) {
            // The notice did not go in, so the report is let go of and is
            // back in the queue to be raised again. Not counted: there is
            // nothing more to say if this misses too.
            await supabase
              .from("violation_reports")
              .update({ violation_id: null })
              .eq("id", reportId)
              .eq("violation_id", violation.id);
            throw new Error(error.message);
          }
        });
        return violation;
      }

      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) => (r.id === reportId ? { ...r, violationId: violation.id } : r)),
      );
      return violation;
    },
    [remote.community, communityId],
  );

  const addNotice = useCallback(
    (input: {
      ownerId: string;
      ownerName: string;
      unit: string;
      rule: string;
      fix?: string;
      ruleCitation?: string;
    }) => {
      if (!input.rule.trim() || !input.unit.trim()) {
        throw new ValidationError("Choose a home and name the rule", {});
      }
      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `VIO-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName.trim(),
        unit: input.unit.trim(),
        rule: input.rule.trim(),
        fix: (input.fix ?? "").trim() || undefined,
        ruleCitation: (input.ruleCitation ?? "").trim(),
        stage: "courtesy",
        openedDate: todayIsoDate(),
        nextActionDate: addDays(todayIsoDate(), 14),
        photos: [],
        fineCents: 0,
        source: "board",
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Sending the notice", () =>
          supabaseBrowser().from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            // The words the owner reads under the title (0097). Left out of
            // this insert, they reached the list row in the session that typed
            // them and nobody else.
            fix: violation.fix ?? "",
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: null,
            source: "board",
          }),
        );
        return violation;
      }
      logDemoActivity(communityId, "violation", activityWords.notice(violation.unit, violation.rule), {
        unit_id: violation.ownerId,
        home: violation.unit,
        reference: violation.reference,
      });
      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      return violation;
    },
    [remote.community, communityId],
  );

  const setViolationStage = useCallback(
    (violationId: string, stage: Violation["stage"]) => {
      const today = todayIsoDate();
      const nextActionDate = stage === "cured" ? today : addDays(today, 14);
      const patch: Partial<Violation> =
        stage === "cured"
          ? { stage, nextActionDate, resolvedDate: today }
          : { stage, nextActionDate };
      if (remote.community) {
        void remoteWrite(stage === "cured" ? "Resolving the notice" : "Updating the notice", () =>
          supabaseBrowser()
            .from("violations")
            .update(
              {
                stage,
                next_action_on: nextActionDate,
                resolved_on: stage === "cured" ? today : null,
              },
              { count: "exact" },
            )
            .eq("id", violationId),
        );
        return;
      }
      sliceStore(communityId, "violations").update((all) =>
        all.map((v) => (v.id === violationId ? { ...v, ...patch } : v)),
      );
    },
    [remote.community, communityId],
  );

  const addCityNotice = useCallback(
    (input: {
      agency: string;
      caseNumber: string;
      deadline: string;
      rule: string;
      ownerId?: string;
      ownerName?: string;
      unit?: string;
    }) => {
      const agency = input.agency.trim();
      const caseNumber = input.caseNumber.trim();
      if (!agency || !input.rule.trim() || !input.deadline) {
        throw new ValidationError("A city notice needs the agency, what it says, and the deadline", {});
      }
      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `CITY-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId ?? "",
        // Against the association itself unless a home is named.
        ownerName: input.ownerName?.trim() || "The association",
        unit: input.unit?.trim() || "Common area",
        rule: input.rule.trim(),
        // The agency and case number ride the citation too, so they survive a
        // database that has no column for them yet.
        ruleCitation: caseNumber ? `${agency}, case ${caseNumber}` : agency,
        stage: "first-notice",
        openedDate: todayIsoDate(),
        nextActionDate: input.deadline,
        photos: [],
        fineCents: 0,
        source: "city",
        agency,
        caseNumber: caseNumber || undefined,
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Logging the notice", () =>
          supabaseBrowser().from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: null,
            source: "city",
            agency,
            case_number: caseNumber,
          }),
        );
        return violation;
      }
      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      return violation;
    },
    [remote.community, communityId],
  );

  const markViolationFixed = useCallback(
    (violationId: string, note: string) => {
      const today = todayIsoDate();
      if (remote.community) {
        return remoteWrite("Telling the board", () =>
          supabaseBrowser().rpc("mark_violation_fixed", {
            p_violation_id: violationId,
            p_note: note,
          }),
        );
      }
      sliceStore(communityId, "violations").update((all) =>
        all.map((v) =>
          v.id === violationId && v.stage !== "cured"
            ? { ...v, ownerFixedDate: today, ownerFixedNote: note.trim() || undefined }
            : v,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  return {
    addViolationReport,
    verifyReport,
    dismissReport,
    raiseNoticeFromReport,
    addNotice,
    setViolationStage,
    addCityNotice,
    markViolationFixed,
  };
}
