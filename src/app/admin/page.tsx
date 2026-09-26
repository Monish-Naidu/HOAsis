import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "lucide-react";
import { Badge, Card, CardHeader, IconTile, PageHeader } from "@/components/ui/primitives";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { isPlatformOwner } from "@/lib/platform-owner";
import { loadOpsReport, OPS_WINDOW_DAYS, STUCK_PAYMENT_DAYS, type OpsReport } from "@/lib/ops";
import { money } from "@/lib/utils";

/**
 * The owner's ops page.
 *
 * Seven days of what went wrong, whether the crons ran, and whether the
 * service is healthy right now, on one screen with no account outside this
 * one. Gated on PLATFORM_OWNER_EMAILS: anyone else gets the same 404 as a
 * route that does not exist. Read fresh on every load; nothing here is
 * worth caching and a stale ops page is worse than none.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Ops", robots: { index: false, follow: false } };

export default async function OpsPage() {
  if (!hasSupabase) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!isPlatformOwner(data.user?.email)) notFound();

  const report = await loadOpsReport();

  return (
    <div className="page-ground min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <Link href="/">
          <Wordmark size={32} />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/board" className="text-footnote font-medium text-fg-muted underline hover:text-fg">
            Board
          </Link>
        </div>
      </header>

      <main className="w-full px-5 py-8 sm:px-8">
        <PageHeader
          title="Ops"
          description={`The last ${OPS_WINDOW_DAYS} days. Read fresh on every load. How to read it: docs/observability.md.`}
          icon={<IconTile icon={Activity} tint="coral" variant="solid" size="md" />}
        />

        {report.problems.length > 0 ? (
          <Card className="mb-6 border-danger/40 p-4">
            <p className="text-body font-semibold text-danger">Some of this page could not load</p>
            <ul className="mt-1 list-disc pl-5 text-footnote text-fg-muted">
              {report.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="grid gap-6">
          <Health report={report} />
          <CronRuns report={report} />
          <ErrorGroups report={report} />
          <LatestErrors report={report} />
          <EmailFailures report={report} />
          <AutopayFailures report={report} />
          <StuckPayments report={report} />
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function when(iso: string): string {
  // Absolute, in UTC, because a Vercel log line is in UTC and the two should
  // read side by side.
  return iso.replace("T", " ").slice(0, 16) + "Z";
}

function ago(iso: string, now: string): string {
  const minutes = Math.round((new Date(now).getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function Table({ head, children, empty, count }: {
  head: string[];
  children: ReactNode;
  empty: string;
  count: number;
}) {
  if (count === 0) {
    return <p className="px-5 pb-5 text-footnote text-fg-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-t border-border text-footnote">
        <thead>
          <tr className="text-left text-caption font-medium text-fg-subtle">
            {head.map((h) => (
              <th key={h} className="px-5 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

const cell = "px-5 py-2 align-top";
const mono = `${cell} font-mono text-caption text-fg-muted whitespace-nowrap`;

function Health({ report }: { report: OpsReport }) {
  const { health } = report;
  return (
    <Card>
      <CardHeader
        title="Health"
        subtitle={`Same answer as /api/health, checked ${when(health.at)}.`}
        action={<Badge tone={health.ok ? "ok" : "danger"} dot>{health.ok ? "OK" : "Not OK"}</Badge>}
      />
      <Table head={["Check", "Status", "Detail"]} count={5} empty="">
        {Object.entries(health.checks).map(([name, check]) => (
          <tr key={name}>
            <td className={`${cell} font-medium text-fg`}>{name}</td>
            <td className={cell}>
              <Badge tone={check.ok ? "ok" : "danger"} dot>{check.ok ? "ok" : "fail"}</Badge>
            </td>
            <td className={`${cell} text-fg-muted`}>
              {check.detail}
              {check.ms != null ? ` (${check.ms} ms)` : ""}
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function CronRuns({ report }: { report: OpsReport }) {
  const missing = ["assessments", "billing-sweep", "autopay"].filter(
    (job) => !report.cronRuns.some((r) => r.job === job),
  );
  return (
    <Card>
      <CardHeader
        title="Crons"
        subtitle="Latest call per job. Each runs once a day (vercel.json); a run older than a day is the alarm."
      />
      <Table
        head={["Job", "Started", "Took", "Result", "Summary", "Reference"]}
        count={report.cronRuns.length + missing.length}
        empty="No cron has recorded a run yet."
      >
        {report.cronRuns.map((r) => {
          const took = Math.round(
            (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000,
          );
          const stale =
            new Date(report.now).getTime() - new Date(r.started_at).getTime() > 26 * 3_600_000;
          return (
            <tr key={r.job}>
              <td className={`${cell} font-medium text-fg`}>{r.job}</td>
              <td className={cell}>
                <span className="text-fg">{ago(r.started_at, report.now)}</span>
                <span className="ml-2 font-mono text-caption text-fg-subtle">{when(r.started_at)}</span>
                {stale ? <Badge tone="warn" className="ml-2">stale</Badge> : null}
              </td>
              <td className={`${cell} text-fg-muted`}>{took} s</td>
              <td className={cell}>
                <Badge tone={r.ok ? "ok" : "danger"} dot>{r.ok ? "ok" : "failed"}</Badge>
                {r.error ? <span className="ml-2 text-danger">{r.error}</span> : null}
              </td>
              <td className={`${cell} text-fg-muted`}>{summarize(r.summary)}</td>
              <td className={mono}>{r.request_id ?? ""}</td>
            </tr>
          );
        })}
        {missing.map((job) => (
          <tr key={job}>
            <td className={`${cell} font-medium text-fg`}>{job}</td>
            <td className={`${cell} text-fg-muted`} colSpan={5}>
              No run recorded in the table yet.
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function summarize(summary: Record<string, unknown>): string {
  return Object.entries(summary)
    .filter(([, v]) => typeof v === "number" || typeof v === "boolean" || typeof v === "string")
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(", ");
}

function ErrorGroups({ report }: { report: OpsReport }) {
  return (
    <Card>
      <CardHeader
        title="Errors by message"
        subtitle={`${report.errorGroups.reduce((n, g) => n + g.count, 0)} errors in ${OPS_WINDOW_DAYS} days, grouped.`}
      />
      <Table
        head={["Count", "Message", "Where", "Source", "Latest"]}
        count={report.errorGroups.length}
        empty="Nothing caught. Either it is quiet or nothing is reporting; the health row above says which."
      >
        {report.errorGroups.slice(0, 30).map((g) => (
          <tr key={g.message}>
            <td className={`${cell} font-semibold text-fg tabular-nums`}>{g.count}</td>
            <td className={`${cell} text-fg`}>{g.message}</td>
            <td className={`${cell} text-fg-muted`}>{g.routes.join(", ")}</td>
            <td className={`${cell} text-fg-muted`}>{g.sources.join(", ")}</td>
            <td className={`${cell} text-fg-muted whitespace-nowrap`}>{ago(g.latest, report.now)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function LatestErrors({ report }: { report: OpsReport }) {
  return (
    <Card>
      <CardHeader
        title="Latest errors"
        subtitle="Newest 50. The reference is what a person reads off the error screen; search Vercel logs or Sentry for it."
      />
      <Table
        head={["When", "Reference", "Level", "Source", "Route", "Message", "Association"]}
        count={report.errors.length}
        empty="None in the window."
      >
        {report.errors.map((e) => (
          <tr key={e.id}>
            <td className={`${cell} text-fg-muted whitespace-nowrap`}>{when(e.created_at)}</td>
            <td className={mono}>{e.reference}</td>
            <td className={cell}>
              <Badge tone={e.level === "error" ? "danger" : e.level === "warn" ? "warn" : "neutral"}>
                {e.level}
              </Badge>
            </td>
            <td className={`${cell} text-fg-muted`}>{e.source}</td>
            <td className={`${cell} text-fg-muted`}>{e.route ?? ""}</td>
            <td className={`${cell} text-fg`}>{e.message}</td>
            <td className={`${cell} text-fg-muted`}>
              {e.association_id ? (report.associationNames[e.association_id] ?? e.association_id.slice(0, 8)) : ""}
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function EmailFailures({ report }: { report: OpsReport }) {
  return (
    <Card>
      <CardHeader
        title="Email failures"
        subtitle="email_log rows with a send error or a bounce, failure or complaint from Resend."
      />
      <Table
        head={["When", "Association", "To", "Category", "Subject", "Status", "Error"]}
        count={report.emailFailures.length}
        empty="Every email in the window was accepted and none bounced."
      >
        {report.emailFailures.map((e) => (
          <tr key={e.id}>
            <td className={`${cell} text-fg-muted whitespace-nowrap`}>{when(e.sent_at)}</td>
            <td className={`${cell} text-fg`}>{report.associationNames[e.association_id] ?? e.association_id.slice(0, 8)}</td>
            <td className={`${cell} text-fg-muted`}>{e.to_email}</td>
            <td className={`${cell} text-fg-muted`}>{e.category}</td>
            <td className={`${cell} text-fg`}>{e.subject}</td>
            <td className={cell}>{e.status ? <Badge tone="danger">{e.status}</Badge> : null}</td>
            <td className={`${cell} text-danger`}>{e.error ?? ""}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function AutopayFailures({ report }: { report: OpsReport }) {
  return (
    <Card>
      <CardHeader title="Autopay failures" subtitle="autopay_runs rows the daily run marked failed." />
      <Table
        head={["When", "Association", "Home", "Month", "Amount", "Reason"]}
        count={report.autopayFailures.length}
        empty="No autopay charge failed in the window."
      >
        {report.autopayFailures.map((r) => (
          <tr key={r.id}>
            <td className={`${cell} text-fg-muted whitespace-nowrap`}>{when(r.created_at)}</td>
            <td className={`${cell} text-fg`}>{report.associationNames[r.association_id] ?? r.association_id.slice(0, 8)}</td>
            <td className={mono}>{r.unit_id.slice(0, 8)}</td>
            <td className={`${cell} text-fg-muted`}>{r.month}</td>
            <td className={`${cell} text-fg tabular-nums`}>{money(r.amount_cents)}</td>
            <td className={`${cell} text-danger`}>{r.reason ?? ""}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function StuckPayments({ report }: { report: OpsReport }) {
  return (
    <Card>
      <CardHeader
        title="Payments stuck pending"
        subtitle={`Pending for more than ${STUCK_PAYMENT_DAYS} days. ACH settles in about four; past that the webhook missed an event. Look the intent up in Stripe.`}
      />
      <Table
        head={["Created", "Association", "Home", "Amount", "Rail", "PaymentIntent"]}
        count={report.stuckPayments.length}
        empty="Nothing stuck."
      >
        {report.stuckPayments.map((p) => (
          <tr key={p.id}>
            <td className={`${cell} text-fg-muted whitespace-nowrap`}>{when(p.created_at)}</td>
            <td className={`${cell} text-fg`}>{report.associationNames[p.association_id] ?? p.association_id.slice(0, 8)}</td>
            <td className={mono}>{p.unit_id.slice(0, 8)}</td>
            <td className={`${cell} text-fg tabular-nums`}>{money(p.amount_cents)}</td>
            <td className={`${cell} text-fg-muted`}>{p.rail}</td>
            <td className={mono}>{p.stripe_payment_intent_id ?? ""}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
