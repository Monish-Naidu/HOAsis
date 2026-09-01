import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Badge, Card } from "@/components/ui/primitives";
import {
  annualFor,
  MANAGEMENT_RANGE_PER_HOME,
  monthlyFor,
  PRICE_EXAMPLES,
  PRICE_PER_HOME_CENTS,
  PRICE_PER_TRANSACTION_CENTS,
  TRIAL_DAYS,
} from "@/lib/pricing";
import { money } from "@/lib/utils";

export const metadata = {
  title: "Pricing",
  description:
    "Simple per home pricing with no feature gating. Payment costs pass through at cost. Unsold lots are billed like any other home.",
};

/**
 * Pricing reads the shared module so the front page and this page cannot quote
 * different numbers, which they did once.
 */
const TIERS = PRICE_EXAMPLES;

/**
 * What a payment actually costs, next to the incumbent.
 *
 * Published because it is checkable. PayHOA's own help pages state $2.45 per
 * ACH and 3.50% plus 50 cents on cards, and Stripe publishes 2.9% plus 30
 * cents. A board can verify every figure in this table without asking us.
 */
/**
 * The comparison we actually win.
 *
 * This table used to sit us against other HOA software on annual cost. At four
 * dollars a home that is a comparison we lose: an 88 home association pays us
 * more than a per-association competitor charges. Publishing it would be a
 * self-inflicted wound and, worse, an argument for the wrong thing.
 *
 * The person reading this page is a builder deciding whether to hand the new
 * association to a management company, or a board that has just been handed
 * one and is looking at what it costs to keep. Neither is choosing between us
 * and another piece of software. So the rows compare per home per month, which
 * is the unit a management proposal is already quoted in.
 *
 * Computed rather than written, so it cannot drift from the rate above.
 */
const COMPARISON_HOMES = 88;
const COMPARISON = [
  {
    scenario: "Per home, per month",
    ours: money(PRICE_PER_HOME_CENTS),
    theirs: `${money(MANAGEMENT_RANGE_PER_HOME.low, { cents: false })} to ${money(
      MANAGEMENT_RANGE_PER_HOME.high,
      { cents: false },
    )}`,
  },
  {
    scenario: `${COMPARISON_HOMES} homes, one month`,
    ours: money(monthlyFor(COMPARISON_HOMES), { cents: false }),
    theirs: `${money(MANAGEMENT_RANGE_PER_HOME.low * COMPARISON_HOMES, {
      cents: false,
    })} to ${money(MANAGEMENT_RANGE_PER_HOME.high * COMPARISON_HOMES, { cents: false })}`,
  },
  {
    scenario: `${COMPARISON_HOMES} homes, one year`,
    ours: money(annualFor(COMPARISON_HOMES), { cents: false }),
    theirs: `${money(MANAGEMENT_RANGE_PER_HOME.low * COMPARISON_HOMES * 12, {
      cents: false,
    })} to ${money(MANAGEMENT_RANGE_PER_HOME.high * COMPARISON_HOMES * 12, { cents: false })}`,
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
  "Live support, phone and chat, from the people who built it",
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
    label: `Our fee: ${money(PRICE_PER_TRANSACTION_CENTS)} per payment`,
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

        <Reveal delay={60}>
          <Card className="mt-8 overflow-hidden">
            <div className="border-b border-border px-6 py-6 text-center">
              <p className="tnum text-[56px] font-semibold leading-none tracking-[-0.04em] text-fg">
                {money(PRICE_PER_HOME_CENTS)}
              </p>
              <p className="mt-2 text-[17px] text-fg-muted">
                per home, per month. Every feature, unlimited residents.
              </p>
              <p className="mt-1 text-[15px] text-fg-muted">
                Plus {money(PRICE_PER_TRANSACTION_CENTS)} per payment, whichever way it arrives.
              </p>
              <p className="mt-3 text-[15px] font-medium text-ok">
                The first {TRIAL_DAYS} days are free. No card to start, cancel whenever.
              </p>
            </div>
            {/* No tiers to compare, so the table is worked examples. A board
                finds the row nearest their own size and stops reading. */}
            <div className="divide-y divide-border">
              {TIERS.map((example) => (
                <div
                  key={example.homes}
                  className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4 ${
                    example.highlight ? "bg-surface-2" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-fg">
                      {example.homes} homes
                      {example.highlight ? (
                        <Badge tone="brand" className="ml-2">
                          Typical
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-fg-muted">{example.note}</p>
                  </div>
                  <p className="tnum shrink-0 text-[17px] font-semibold text-fg">
                    {money(monthlyFor(example.homes), { cents: false })}
                    <span className="text-[13px] font-normal text-fg-muted"> a month</span>
                    <span className="ml-2 text-[13px] font-normal text-fg-subtle">
                      {money(annualFor(example.homes), { cents: false })} a year
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <Card id="included" className="h-full scroll-mt-20 p-6">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                Included, always
              </h2>
              <p className="mt-1.5 text-[15px] text-fg-muted">
A 12 home association gets the same product as a 300 home one. Gating features by
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
                Next to a management company
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                The range is what full service management is published at, per door. Check it
                against the proposal on your desk.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                    <th className="px-6 py-2.5 font-semibold" />
                    <th className="px-4 py-2.5 text-right font-semibold">ExpressHOA</th>
                    <th className="px-6 py-2.5 text-right font-semibold">Management company</th>
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
              Other self-service HOA software bills per association rather than per home, so at
              a large enough community some of it costs less than we do. It also does not do
              reserves. We would rather you knew that than found out later.
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
