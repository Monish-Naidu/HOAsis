import Link from "next/link";
import { ArrowRight, Check, Info, Minus } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Badge, Callout, Card } from "@/components/ui/primitives";

export const metadata = {
  title: "Pricing",
  description: "Simple per home pricing with no feature gating. Payment costs pass through at cost.",
};

/**
 * Pricing.
 *
 * The numbers are placeholders and say so. The structure is not: no feature
 * gating between tiers, and payment processing passed through at cost. Both
 * are deliberate positions against how this category usually prices, so they
 * are stated even while the figures are still being worked out.
 */
const TIERS = [
  {
    name: "Small",
    homes: "Up to 40 homes",
    price: "$—",
    unit: "per month",
    note: "Flat, not per door, so a small board is not punished for being small.",
    highlight: false,
  },
  {
    name: "Standard",
    homes: "41 to 250 homes",
    price: "$—",
    unit: "per home, per month",
    note: "The common case. Everything included, no add-ons.",
    highlight: true,
  },
  {
    name: "Large",
    homes: "251 homes and up",
    price: "$—",
    unit: "per home, per month",
    note: "Rate steps down as the community grows.",
    highlight: false,
  },
];

const INCLUDED = [
  "Every feature, on every tier",
  "Unlimited board members and residents",
  "Accounting, reconciliation, and reserve planning",
  "Resident website and mobile app",
  "Voting, meetings, and video with dial-in",
  "Documents and the public records page",
  "Compliance register for your state",
  "Community forum with moderation",
  "Phone and chat support, seven days a week",
];

const PAYMENTS = [
  {
    label: "The processor's cost",
    detail:
      "2.9% + 30¢ on cards, 35¢ on bank transfers. Passed straight through. We never touch this.",
  },
  {
    label: "Our fee: $1.50 per payment",
    detail:
      "Flat, so it does not grow with the assessment. The board chooses whether the owner pays it at checkout or the association absorbs it, and can waive it on bank transfers entirely.",
  },
  {
    label: "Cheaper than the incumbent, on both rails",
    detail:
      "On a $285 assessment that is $1.85 by bank transfer against $2.45, and $10.07 by card against $10.48. Itemised, so you can check the arithmetic.",
  },
];

const NOT_INCLUDED = [
  { label: "Postal mail", detail: "Billed at cost when a notice has to go on paper." },
  { label: "Your bank's fees", detail: "Whatever your institution charges, unchanged." },
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <Reveal>
          <header className="max-w-2xl">
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[44px]">
              Priced so the savings are obvious.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
              One number, every feature, no per-seat charges and no upsell for the thing you
              actually needed.
            </p>
          </header>
        </Reveal>

        <Callout
          tone="info"
          className="mt-8"
          icon={<Info className="size-4" />}
          title="The figures are still being set"
        >
          The structure below is settled. The numbers are not, so they are shown as dashes rather
          than as something plausible we would have to walk back.
        </Callout>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 80}>
              <Card
                className={`h-full p-6 ${
                  tier.highlight ? "border-navy-700 shadow-raised dark:border-navy-300" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-fg">{tier.name}</p>
                  {tier.highlight ? <Badge tone="brand">Most common</Badge> : null}
                </div>
                <p className="mt-1 text-[12px] text-fg-muted">{tier.homes}</p>
                <p className="tnum mt-5 text-[40px] font-semibold leading-none tracking-[-0.035em] text-fg">
                  {tier.price}
                </p>
                <p className="mt-1.5 text-[12px] text-fg-muted">{tier.unit}</p>
                <p className="mt-4 border-t border-border pt-4 text-[13px] leading-relaxed text-fg-muted">
                  {tier.note}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full p-6">
              <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-fg">
                Included on every tier
              </h2>
              <p className="mt-1.5 text-[13px] text-fg-muted">
                A 25 home association gets the same product as a 300 home one. Gating features by
                size punishes exactly the boards with the least help.
              </p>
              <ul className="mt-4 space-y-2.5">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                    <span className="text-[14px] leading-snug text-fg">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={90}>
            <Card className="h-full p-6">
              <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-fg">
                How payments are priced
              </h2>
              <p className="mt-1.5 text-[13px] text-fg-muted">
                Itemised on every receipt. The thing boards resent is not a fee, it is a blended
                rate that hides one inside the processor&apos;s number.
              </p>
              <ul className="mt-4 space-y-3">
                {PAYMENTS.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                    <span>
                      <span className="block text-[14px] font-medium text-fg">{item.label}</span>
                      <span className="block text-[13px] leading-snug text-fg-muted">
                        {item.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 space-y-3 border-t border-border pt-4">
                {NOT_INCLUDED.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <Minus className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                    <span>
                      <span className="block text-[14px] font-medium text-fg">{item.label}</span>
                      <span className="block text-[13px] leading-snug text-fg-muted">
                        {item.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="mt-10 rounded-card border border-border bg-surface p-6 text-center">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
              Try it before anyone quotes you anything.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-fg-muted">
              The demo is a full association with real numbers behind it. No card, no call.
            </p>
            <Link
              href="/signin"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-[13px] font-semibold text-brand-fg"
            >
              Open the demo
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Reveal>
      </main>
      <MarketingFooter />
    </div>
  );
}
