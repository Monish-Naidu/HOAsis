import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { ButtonLink } from "@/components/ui/primitives";
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
    // Clipped sideways: the aurora behind the dial reaches past the column.
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <MarketingHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <Reveal>
          <header className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] text-fg sm:text-[60px]">
              One price. Every feature.
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-fg-muted sm:text-[19px]">
              No tiers, no per-person fees, no add-ons. Set your size and read the number.
            </p>
          </header>
        </Reveal>

        <Reveal delay={60} className="mt-12">
          <PriceCalculator />
        </Reveal>

        <div>
          <div className="relative isolate mt-20 overflow-hidden rounded-[28px] bg-navy-950 px-6 py-14 ring-1 ring-inset ring-white/5 dark:bg-navy-900 text-center text-navy-50 sm:py-16">
            <div
              className="pointer-events-none absolute -bottom-32 -left-20 -z-10 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(63_130_242/0.5),transparent)] blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-20 -top-32 -z-10 size-[24rem] rounded-full bg-[radial-gradient(closest-side,rgb(143_118_255/0.45),transparent)] blur-3xl"
              aria-hidden
            />
            <h2 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">
              Try it before anyone quotes you anything.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[17px] leading-relaxed text-navy-200">
              {TRIAL_DAYS} days free. No card, no call, cancel whenever.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <ButtonLink href="/start" variant="hero" size="xl" className="group">
                Set up your association
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
              {/* A text link, not a second button: one filled action per band.
                  Fixed navy ink, because the band is navy in both themes. */}
              <Link
                href="/signin#sample"
                className="text-[15px] font-semibold text-navy-100 underline-offset-4 hover:text-white hover:underline"
              >
                Open the demo
              </Link>
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
