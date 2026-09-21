import Link from "next/link";
import { ArrowRight, Landmark, Mail, Receipt, Scale } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { IconTile, type TintName } from "@/components/ui/primitives";
import { TRIAL_DAYS } from "@/lib/pricing";
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
 * The per-payment platform fee came off this page on 2026-09-21 at Monish's
 * ask, so the page quotes the one rate and the processor's pass-through.
 */
const PAYMENT_TILES: { icon: typeof Landmark; tint: TintName; label: string; body: string }[] = [
  {
    icon: Landmark,
    tint: "blue",
    label: "Processor, at cost",
    body: "2.9% + 30¢ on cards, 35¢ on bank transfers. Never marked up.",
  },
  {
    icon: Scale,
    tint: "teal",
    label: "Owner or association pays",
    body: "Your call, set once and changed any time. Waive it on bank transfers if you like.",
  },
  {
    icon: Receipt,
    tint: "violet",
    label: "On every receipt",
    body: "The processor's cost sits on its own line, so nobody has to guess.",
  },
  {
    icon: Mail,
    tint: "amber",
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
              One price. <span className="text-gradient">Every feature.</span>
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
            {PAYMENT_TILES.map(({ icon, tint, label, body }, index) => (
              <Reveal key={label} delay={index * 70}>
                <div className="lift h-full rounded-2xl border border-border bg-surface p-5 shadow-card">
                  <IconTile icon={icon} tint={tint} variant="solid" size="lg" />
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
          <div className="relative isolate mt-14 overflow-hidden rounded-[1.5rem] border border-border bg-navy-900 px-6 py-10 text-center text-navy-50 dark:bg-navy-800 sm:py-12">
            <div
              className="pointer-events-none absolute -bottom-32 -left-20 -z-10 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(63_130_242/0.5),transparent)] blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-20 -top-32 -z-10 size-[24rem] rounded-full bg-[radial-gradient(closest-side,rgb(143_118_255/0.45),transparent)] blur-3xl"
              aria-hidden
            />
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[34px]">
              Try it before anyone quotes you anything.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[16px] leading-relaxed text-navy-200">
              {TRIAL_DAYS} days free. No card, no call, cancel whenever.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/start"
                className="press shimmer group inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[16px] font-semibold text-navy-950 shadow-float hover:-translate-y-0.5"
              >
                Set up your association
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/signin"
                className="press inline-flex h-12 items-center rounded-xl border border-navy-50/30 px-6 text-[16px] font-semibold text-navy-50 hover:bg-navy-50/10"
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
