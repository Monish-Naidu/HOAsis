import Link from "next/link";
import { ArrowRight, Building2, Smartphone } from "lucide-react";
import { Logo, Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";
import { FeatureTabs } from "@/components/app/feature-tabs";
import {
  association,
  ballots,
  cashPosition,
  complianceSummary,
  delinquency,
  interestSummary,
  ledgerEntries,
  openBallots,
  payoutSpeed,
  reserveSummary,
  threads,
  vendors,
} from "@/lib/data";
import { money, shortMoney } from "@/lib/utils";

export default function LandingPage() {
  const cash = cashPosition();
  const delinq = delinquency();
  const comp = complianceSummary();
  const interest = interestSummary();
  const reserve = reserveSummary();
  const speed = payoutSpeed();
  const totalVotes = ballots.reduce(
    (t, b) => t + b.options.reduce((n, o) => n + o.votes, 0),
    0,
  );

  const stats = {
    money: [
      { label: "Cash tracked", value: shortMoney(cash.total) },
      { label: "Interest YTD", value: money(interest.earnedYtd, { cents: false }) },
      { label: "Transactions", value: String(ledgerEntries.length) },
    ],
    residents: [
      { label: "Households", value: String(association.unitCount) },
      { label: "Current", value: `${Math.round(delinq.collectionRate * 100)}%` },
      { label: "On autopay", value: `${Math.round(delinq.autopayRate * 100)}%` },
    ],
    voting: [
      { label: "Open ballots", value: String(openBallots().length) },
      { label: "Votes cast", value: String(totalVotes) },
      { label: "Meeting", value: "Live" },
    ],
    vendors: [
      { label: "ACH settlement", value: `${speed.ach.toFixed(1)} days` },
      { label: "Check settlement", value: `${speed.check.toFixed(0)} days` },
      { label: "Vendors", value: String(vendors.length) },
    ],
    comms: [
      { label: "Threads", value: String(threads.length) },
      { label: "Avg. reply", value: "1.4 days" },
      { label: "Delivered", value: "88" },
    ],
    compliance: [
      { label: "Obligations", value: String(comp.compliant.length + comp.openCount) },
      { label: "Clear", value: String(comp.compliant.length) },
      { label: "Reserves funded", value: `${Math.round(reserve.percentFunded * 100)}%` },
    ],
  };

  return (
    <div className="min-h-dvh bg-bg">
      {/* Banner */}
      <div className="bg-navy-900 text-navy-100 dark:bg-navy-800">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-5 py-2 text-center text-[12px]">
          <span className="size-1.5 shrink-0 rounded-full bg-ok" />
          <span>
            Prototype build · fictional data · {association.name}, {association.addressLine}
          </span>
        </div>
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark size={38} />
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-24">
        {/* Hero */}
        <section className="animate-rise relative overflow-hidden rounded-[1.5rem] border border-border bg-surface px-6 py-12 shadow-card sm:px-12 sm:py-16">
          <div
            className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-navy-100 opacity-60 blur-3xl dark:bg-navy-800 dark:opacity-40"
            aria-hidden
          />
          <div className="relative">
            <Logo size={72} className="mb-7 shadow-raised" />
            <h1 className="max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[56px]">
              Run your HOA without the guesswork.
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-fg-muted">
              Books that reconcile. An app residents use. One system of record, two ways in.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/resident"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-[14px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
              >
                <Smartphone className="size-4" />
                Resident portal
              </Link>
              <Link
                href="/board"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-2 bg-surface px-5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-2"
              >
                <Building2 className="size-4" />
                Board workspace
              </Link>
            </div>
          </div>
        </section>

        {/* Role cards */}
        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <RoleCard
            href="/resident"
            eyebrow="Homeowner"
            title="Resident portal"
            description="Dues, requests, votes, documents, and where the association's money sits."
            icon={<Smartphone className="size-5" />}
            stats={[
              { label: "Balance due", value: money(28_500) },
              { label: "Open requests", value: "2" },
              { label: "Ballots open", value: String(openBallots().length) },
            ]}
            primary
          />
          <RoleCard
            href="/board"
            eyebrow="Board and treasurer"
            title="Board workspace"
            description="Reconciliation, reserves, delinquencies, vendors, voting, and meetings."
            icon={<Building2 className="size-5" />}
            stats={[
              { label: "Total cash", value: shortMoney(cash.total) },
              { label: "Past due", value: shortMoney(delinq.totalCents) },
              { label: "Needs review", value: "3" },
            ]}
          />
        </section>

        {/* Tabs */}
        <section className="mt-16">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
            What&apos;s inside
          </h2>
          <FeatureTabs stats={stats} />
        </section>

        <p className="mt-10 text-[12px] text-fg-subtle">
          Fixture data for a fictional Washington association. No real accounts, no real money.
        </p>
      </main>
    </div>
  );
}

function RoleCard({
  href,
  eyebrow,
  title,
  description,
  icon,
  stats,
  primary,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  stats: { label: string; value: string }[];
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-card border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-border-2 hover:shadow-raised"
    >
      <div>
        <div className="flex items-center justify-between">
          <span
            className={
              primary
                ? "inline-flex size-10 items-center justify-center rounded-xl bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950"
                : "inline-flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-fg"
            }
          >
            {icon}
          </span>
          <ArrowRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{description}</p>
      </div>
      <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] text-fg-subtle">{s.label}</dt>
            <dd className="tnum text-[15px] font-semibold text-fg">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
