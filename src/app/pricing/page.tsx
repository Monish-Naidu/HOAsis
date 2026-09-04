import Link from "next/link";
import { ArrowRight, Landmark, Mail, Receipt, Scale } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { PRICE_PER_TRANSACTION_CENTS, TRIAL_DAYS } from "@/lib/pricing";
import { money } from "@/lib/utils";
import { PriceCalculator } from "./price-calculator";

export const metadata = {
  title: "Pricing",
  description:
    "One rate per home per month, every feature included. Payment costs pass through at cost. The first 90 days are free.",
};

/**
 * The page is one dial and a few tiles. It used to be a rate card, two prose
 * columns, a comparison table and a footnote, and Monish read it as words.
 * The rate and the comparison are still here; they are computed from one
 * homes count in `PriceCalculator` so they cannot drift, and everything
 * around them is a tile with a border and one line.
 *
 * The comparison is against a management company, not other software. At
 * this rate a large association pays us more than per-association software
 * charges, so that comparison is one we lose and one the reader is not
 * making: they are deciding whether to hand the association to a manager.
 */

/**
 * How a payment is priced. The processor's rates are its published card and
 * ACH costs, passed through untouched, so a board can check them anywhere.
 */
const PAYMENT_TILES = [
  {
    icon: Landmark,
    tone: "bg-info-soft text-info",
    label: "Processor, at cost",
    body: "2.9% + 30¢ on cards, 35¢ on bank transfers. Never marked up.",
  },
  {
    icon: Receipt,
    tone: "bg-ok-soft text-ok",
    label: `Ours, ${money(PRICE_PER_TRANSACTION_CENTS, { cents: false })} flat`,
    body: "Same on a $100 payment and a $1,000 one. Owner or association pays it, your call.",
  },
  {
    icon: Scale,
    tone: "bg-brand-soft text-brand-soft-fg",
    label: "Two lines, never blended",
    body: "Every receipt shows the processor's cost and ours separately.",
  },
  {
    icon: Mail,
    tone: "bg-warn-soft text-warn",
    label: "Only extra: postage",
    body: "Billed at cost when a notice has to go on paper. Nothing else.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <Reveal>
          <header className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[52px]">
              One price. <span className="text-hero-accent">Every feature.</span>
            </h1>
            <p className="mt-4 text-[18px] leading-relaxed text-fg-muted">
              No tiers, no seats, no add-ons. Set the dial to your size and read the number.
            </p>
          </header>
        </Reveal>

        <Reveal delay={60} className="mt-10">
          <PriceCalculator />
        </Reveal>

        <section className="mt-14">
          <Reveal>
            <h2 className="text-center text-[26px] font-semibold tracking-[-0.03em] text-fg sm:text-[32px]">
              What a payment costs
            </h2>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_TILES.map(({ icon: Icon, tone, label, body }, index) => (
              <Reveal key={label} delay={index * 60}>
                <div className="h-full rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-raised">
                  <span
                    className={`flex size-11 items-center justify-center rounded-full ${tone}`}
                  >
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <p className="mt-4 text-[16px] font-semibold tracking-[-0.015em] text-fg">
                    {label}
                  </p>
                  <p className="mt-1 text-[14px] leading-snug text-fg-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-4 text-center text-[13px] leading-relaxed text-fg-subtle">
              Some HOA software bills per association, so at a large enough community it costs
              less than we do. It also does not do reserves. We would rather you knew.
            </p>
          </Reveal>
        </section>

        <Reveal delay={160}>
          <div className="mt-14 overflow-hidden rounded-[1.5rem] border border-border bg-navy-900 px-6 py-10 text-center text-navy-50 dark:bg-navy-800 sm:py-12">
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[34px]">
              Try it before anyone quotes you anything.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[16px] leading-relaxed text-navy-200">
              {TRIAL_DAYS} days free. No card, no call, cancel whenever.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/start"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy-50 px-6 text-[16px] font-semibold text-navy-950 transition-transform hover:-translate-y-0.5"
              >
                Set up your association
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex h-12 items-center rounded-xl border border-navy-50/30 px-6 text-[16px] font-semibold text-navy-50 transition-colors hover:bg-navy-50/10"
              >
                Open the demo
              </Link>
            </div>
          </div>
        </Reveal>
      </main>
      <MarketingFooter />
    </div>
  );
}
