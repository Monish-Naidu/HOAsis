import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Badge, Card } from "@/components/ui/primitives";
import { PRICING_TIERS } from "@/lib/pricing";
import { money } from "@/lib/utils";

export const metadata = {
  title: "Pricing",
  description: "Simple per home pricing with no feature gating. Payment costs pass through at cost.",
};

/**
 * Pricing reads the shared tier table so the front page and this page cannot
 * quote different numbers, which they did once.
 */
const TIERS = PRICING_TIERS;

/**
 * What a payment actually costs, next to the incumbent.
 *
 * Published because it is checkable. PayHOA's own help pages state $2.45 per
 * ACH and 3.50% plus 50 cents on cards, and Stripe publishes 2.9% plus 30
 * cents. A board can verify every figure in this table without asking us.
 */
const COMPARISON = [
  {
    scenario: "A $285 assessment, paid by bank transfer",
    ours: "$2.35",
    theirs: "$2.45",
  },
  {
    scenario: "A $285 assessment, paid by card",
    ours: "$8.57",
    theirs: "$10.48",
  },
  {
    scenario: "88 homes, software for a year",
    ours: "$1,308",
    theirs: "$1,068",
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

/**
 * The processor's rates are the published card and ACH costs and stay as they
 * are, because we pass those through untouched and a board can verify them
 * against any processor's own page.
 */
const PAYMENTS = [
  {
    label: "The processor's cost",
    detail:
      "2.9% + 30¢ on cards, 35¢ on bank transfers. Passed straight through. We never touch this.",
  },
  {
    label: "Our fee: $2.00 per payment",
    detail:
      "Flat, so it does not grow with the assessment. The board chooses whether the owner pays it at checkout or the association absorbs it.",
  },
  {
    label: "Shown separately, never blended",
    detail:
      "You see the processor's cost and ours as two lines, so you can check the arithmetic rather than take a single rate on trust.",
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
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[48px]">
              Priced so the savings are obvious.
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-fg-muted">
              One number, every feature, no per-seat charges and no upsell for the thing you
              actually needed.
            </p>
          </header>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier, index) => (
            <Reveal key={tier.name} delay={index * 80}>
              <Card
                className={`h-full p-6 ${
                  tier.highlight ? "border-navy-700 shadow-raised dark:border-navy-300" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-fg">{tier.name}</p>
                  {tier.highlight ? <Badge tone="brand">Most common</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] text-fg-muted">{tier.homes}</p>
                <p className="tnum mt-5 text-[40px] font-semibold leading-none tracking-[-0.035em] text-fg">
                  {money(tier.monthlyCents, { cents: false })}
                </p>
                <p className="mt-1.5 text-[13px] text-fg-muted">per month</p>
                <p className="mt-4 border-t border-border pt-4 text-[15px] leading-relaxed text-fg-muted">
                  {tier.note}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full p-6">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                Included on every tier
              </h2>
              <p className="mt-1.5 text-[15px] text-fg-muted">
                A 25 home association gets the same product as a 300 home one. Gating features by
                size punishes exactly the boards with the least help.
              </p>
              <ul className="mt-4 space-y-2.5">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                    <span className="text-[15px] leading-snug text-fg">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={90}>
            <Card className="h-full p-6">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                How payments are priced
              </h2>
              <p className="mt-1.5 text-[15px] text-fg-muted">
                Itemized on every receipt. The thing boards resent is not a fee, it is a blended
                rate that hides one inside the processor&apos;s number.
              </p>
              <ul className="mt-4 space-y-3">
                {PAYMENTS.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                    <span>
                      <span className="block text-[15px] font-medium text-fg">{item.label}</span>
                      <span className="block text-[15px] leading-snug text-fg-muted">
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
                      <span className="block text-[15px] font-medium text-fg">{item.label}</span>
                      <span className="block text-[15px] leading-snug text-fg-muted">
                        {item.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={130}>
          <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                Next to PayHOA
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                Their figures come from their own published pages. Check ours the same way.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                    <th className="px-6 py-2.5 font-semibold" />
                    <th className="px-4 py-2.5 text-right font-semibold">HOAsis</th>
                    <th className="px-6 py-2.5 text-right font-semibold">PayHOA</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.scenario} className="border-b border-border last:border-b-0">
                      <td className="px-6 py-3 text-[15px] text-fg">{row.scenario}</td>
                      <td className="tnum px-4 py-3 text-right text-[15px] font-semibold text-ok">
                        {row.ours}
                      </td>
                      <td className="tnum px-6 py-3 text-right text-[15px] text-fg-muted">
                        {row.theirs}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-6 py-3 text-[13px] leading-relaxed text-fg-subtle">
              We are a little more for the software at 88 homes and meaningfully less on every
              payment, so a community collecting monthly comes out ahead. We would rather show
              you both numbers than only the flattering one.
            </p>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-10 rounded-card border border-border bg-surface p-6 text-center">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
              Try it before anyone quotes you anything.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-fg-muted">
              The demo is a full association with real numbers behind it. No card, no call.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/start"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-[15px] font-semibold text-brand-fg"
              >
                Set up your association
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-2 px-5 text-[15px] font-semibold text-fg hover:bg-surface-2"
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
