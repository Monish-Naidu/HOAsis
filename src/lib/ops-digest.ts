import type { OpsReport } from "@/lib/ops";
import { DAY_MS, money } from "@/lib/utils";

/**
 * The daily "something went wrong" email, built from the ops report.
 *
 * Monish asked for a way of knowing when things go wrong without opening
 * /admin. This is the cheapest shape: the report the page already reads,
 * cut to the last day, sent to the platform owners when there is anything
 * in it. A quiet day sends nothing, so an email from here always means
 * something. Mondays send a short "all quiet" so a silent week is known to
 * be silence and not a broken digest.
 *
 * Pure: the route reads the report and the clock and hands them here, so
 * the wording can be tested without a database.
 */

export interface Digest {
  /** False on a quiet day that is not a Monday: nothing is sent. */
  send: boolean;
  subject: string;
  text: string;
  html: string;
}

function since(now: string, hours: number): string {
  return new Date(new Date(now).getTime() - hours * (DAY_MS / 24)).toISOString();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildDigest(report: OpsReport, now: string, adminUrl: string): Digest {
  const from = since(now, 24);
  const errors = report.errors.filter((e) => e.created_at >= from);
  const emailFailures = report.emailFailures.filter((e) => e.sent_at >= from);
  const autopayFailures = report.autopayFailures.filter((a) => a.created_at >= from);
  const cronFailures = report.cronRuns.filter((c) => !c.ok);
  const name = (id: string | null) => (id && report.associationNames[id]) || "an association";

  const sections: { title: string; lines: string[] }[] = [];
  if (!report.health.ok) {
    const failing = Object.entries(report.health.checks)
      .filter(([, check]) => !check.ok)
      .map(([what, check]) => `${what}: ${check.detail ?? "failing"}`);
    sections.push({ title: "Health", lines: failing });
  }
  if (cronFailures.length) {
    sections.push({
      title: "Daily jobs that failed",
      lines: cronFailures.map((c) => `${c.job}: ${c.error ?? "failed"} (${c.started_at.slice(0, 16).replace("T", " ")} UTC)`),
    });
  }
  if (errors.length) {
    const groups = new Map<string, number>();
    for (const e of errors) groups.set(e.message.slice(0, 120), (groups.get(e.message.slice(0, 120)) ?? 0) + 1);
    sections.push({
      title: `Errors in the last day (${errors.length})`,
      lines: [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([m, n]) => (n > 1 ? `${n} × ${m}` : m)),
    });
  }
  if (report.stuckPayments.length) {
    sections.push({
      title: "Payments pending for more than five days",
      lines: report.stuckPayments.map((p) => `${name(p.association_id)}: ${money(p.amount_cents)} by ${p.rail}`),
    });
  }
  if (autopayFailures.length) {
    sections.push({
      title: "Autopay that did not go through",
      lines: autopayFailures.map((a) => `${name(a.association_id)}: ${money(a.amount_cents)}, ${a.reason ?? "no reason recorded"}`),
    });
  }
  if (emailFailures.length) {
    sections.push({
      title: `Emails that failed (${emailFailures.length})`,
      lines: emailFailures.slice(0, 10).map((e) => `${name(e.association_id)}: ${e.subject} to ${e.to_email}: ${e.error ?? e.status ?? "failed"}`),
    });
  }
  if (report.problems.length) {
    sections.push({ title: "The report itself could not read", lines: report.problems });
  }

  const monday = new Date(now).getUTCDay() === 1;
  if (!sections.length) {
    const subject = "Your HOAsis: all quiet this week";
    const body = "Nothing failed in the last seven days: no errors, every daily job ran, no email or autopay failures, no payment stuck. This note comes on Mondays so you know the digest itself is alive.";
    return {
      send: monday,
      subject,
      text: `${body}\n\n${adminUrl}`,
      html: `<p style="font:15px/1.5 -apple-system,Segoe UI,sans-serif">${escapeHtml(body)}</p><p><a href="${adminUrl}">Open /admin</a></p>`,
    };
  }

  const count = sections.reduce((t, s) => t + s.lines.length, 0);
  const subject = `Your HOAsis: ${count} ${count === 1 ? "thing" : "things"} to look at`;
  const text = sections.map((s) => `${s.title}\n${s.lines.map((l) => `- ${l}`).join("\n")}`).join("\n\n") + `\n\n${adminUrl}`;
  const html =
    sections
      .map(
        (s) =>
          `<h3 style="font:600 16px -apple-system,Segoe UI,sans-serif;margin:18px 0 6px">${escapeHtml(s.title)}</h3><ul style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;margin:0;padding-left:18px">${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
      )
      .join("") + `<p style="margin-top:20px"><a href="${adminUrl}">Open /admin</a></p>`;
  return { send: true, subject, text, html };
}
