import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ScaleIcon,
  Smartphone,
  Scale,
  Wallet,
} from "lucide-react";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";
import { association, cashPosition, complianceSummary, delinquency } from "@/lib/data";
import { money, shortMoney } from "@/lib/utils";

const pillars = [
  {
    icon: Wallet,
    title: "Books that tie out",
    body: "Live bank feeds, duplicate detection, and one balance every report agrees with. If something doesn't reconcile, the product says so.",
  },
  {
    icon: Smartphone,
    title: "An app residents use",
    body: "Pay, look something up, file a request. Built phone-first, with Apple Pay and Google Pay.",
  },
  {
    icon: Scale,
    title: "Compliance as a feature",
    body: "Every state obligation tracked as a dated item with its evidence attached.",
  },
];

export default function LandingPage() {
  const cash = cashPosition();
  const delinq = delinquency();
  const comp = complianceSummary();

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark size={30} />
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        <section className="animate-rise pt-10 sm:pt-16">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-fg-muted">
            <span className="size-1.5 rounded-full bg-ok" />
            Prototype · {association.name}, {association.unitCount} units
          </p>
          <h1 className="max-w-3xl text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] text-fg sm:text-[52px]">
            Run your HOA without the guesswork.
            <span className="block text-fg-muted">
              Books that reconcile. An app residents use. Compliance handled.
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            One system of record, two ways in.
          </p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <RoleCard
            href="/resident"
            eyebrow="Homeowner"
            title="Resident portal"
            description="Pay dues, track a request, pull a document. Built at phone width."
            icon={<Smartphone className="size-5" />}
            stats={[
              { label: "Balance due", value: money(28_500) },
              { label: "Open requests", value: "2" },
            ]}
            primary
          />
          <RoleCard
            href="/board"
            eyebrow="Board & treasurer"
            title="Board workspace"
            description="Cash, reconciliation, delinquencies, vendor payments, and a live compliance register."
            icon={<Building2 className="size-5" />}
            stats={[
              { label: "Total cash", value: shortMoney(cash.total) },
              { label: "Past due", value: shortMoney(delinq.totalCents) },
              { label: "Compliance open", value: String(comp.openCount) },
            ]}
          />
        </section>

        <section className="mt-16">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
            What it argues
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {pillars.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-card border border-border bg-surface p-5 shadow-card"
              >
                <span className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
                  <Icon className="size-[18px]" strokeWidth={1.9} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-card border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <ScaleIcon className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <p className="text-[13px] leading-relaxed text-fg-muted">
              Fixture data for a fictional Washington association.
            </p>
          </div>
        </section>
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
        <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</h2>
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
