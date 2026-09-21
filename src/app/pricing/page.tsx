import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { TRIAL_DAYS } from "@/lib/pricing";
import { PriceCalculator } from "./price-calculator";

export const metadata = {
  title: "Pricing",
  description:
    "One rate per home per month, every feature included. The first 90 days are free.",
};

/**
 * The page is one dial. It used to be a rate card, two prose columns, a
 * comparison table and a footnote, and Monish read it as words. The rate
 * and the comparison are computed from one homes count in `PriceCalculator`
 * so they cannot drift. The "What a payment costs" tiles under the dial
 * came off on 2026-09-21 at Monish's ask; the processor's pass-through is
 * on every receipt, which is where a board actually reads it.
 *
 * The comparison is against a management company, not other software. At
 * this rate a large association pays us more than per-association software
 * charges, so that comparison is one we lose and one the reader is not
 * making: they are deciding whether to hand the association to a manager.
 */

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
