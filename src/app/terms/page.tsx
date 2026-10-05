import Link from "next/link";
import { MarketingFooter, MarketingHeader } from "@/components/app/marketing-chrome";
import { Callout } from "@/components/ui/primitives";
import { PRICE_PER_HOME_CENTS, TRIAL_DAYS } from "@/lib/pricing";
import { SUPPORT_EMAIL, SUPPORT_RESPONSE } from "@/lib/support";
import { money } from "@/lib/utils";

export const metadata = {
  title: "Terms of service",
  description: "The agreement between an association and Your HOAsis, in plain words.",
};

/** Last edited. Bump when the words change. */
const UPDATED = "October 4, 2026";

/**
 * The terms, written to be read by a board president rather than skimmed by
 * a lawyer. Every promise here is one the code already keeps: the free days
 * come from `src/lib/pricing.ts`, refunds and cancellation from what the
 * billing routes do. A lawyer still has to read it before the first
 * paying customer; the draft note says so out loud.
 */
export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
        <header>
          <p className="text-footnote font-semibold uppercase tracking-wide text-fg-subtle">Legal</p>
          <h1 className="mt-2 text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[44px]">
            Terms of service
          </h1>
          <p className="mt-3 text-body text-fg-muted">Last updated {UPDATED}.</p>
        </header>

        <Callout tone="warn" className="mt-8" title="Draft, not yet reviewed by a lawyer">
          These terms are written in plain words so a board can read them. They have not been
          reviewed by an attorney. Until they have, treat them as a description of how the
          service works rather than a contract, and ask us anything at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          .
        </Callout>

        <article className="mt-10 space-y-8 text-body leading-relaxed">
          <Section title="1. Who this is between">
            <p>
              Your HOAsis is software for homeowner associations, run by Your HOAsis (&ldquo;we&rdquo;).
              The customer is the association, not the person who signs up. The person who creates
              the account says they are authorized by the association&apos;s board to do so.
              Residents who sign in to see their own home are users, not customers; the association
              is responsible for who it invites.
            </p>
          </Section>

          <Section title="2. What the service is">
            <p>
              A place to keep the association&apos;s register of homes and owners, bill and collect
              assessments, keep the books, send notices, and run meetings and votes. We host it,
              back it up, and keep it running. We do not manage the association, give legal or
              accounting advice, or make decisions for the board. Guides in the library are general
              information, not legal advice.
            </p>
          </Section>

          <Section title="3. Price">
            <p>
              {money(PRICE_PER_HOME_CENTS)} per home per month, counting every home on the register
              whether or not it is occupied, billed monthly to a card the board puts on file. That is
              the whole price: we charge nothing per payment. The first {TRIAL_DAYS} days
              are free and no card is needed to start. If no card is on file when the free days end,
              the board side of the service pauses two weeks later; residents can still see their
              own statements. We will give at least thirty days&apos; notice before changing the
              price.
            </p>
          </Section>

          <Section title="4. Payments from residents">
            <p>
              Online payments are processed by Stripe under the association&apos;s own Stripe account.
              Money goes from the resident to the association&apos;s bank account and never sits with
              us. Stripe&apos;s processing fees are Stripe&apos;s, come out of the association&apos;s
              deposit, and are shown on every receipt.
              Refunds of a resident&apos;s payment are the association&apos;s decision and are made
              from its Stripe dashboard. Disputes and chargebacks are between the resident, the
              association and Stripe.
            </p>
          </Section>

          <Section title="5. Your data">
            <p>
              The association&apos;s records are the association&apos;s. We use them only to run the
              service. The board can export the register and the transactions as CSV at any time,
              and can ask us for a complete export. If the association cancels, its data is kept for
              thirty days so it can be exported or restored, then deleted. Who else can see what is in
              the{" "}
              <Link href="/privacy" className="font-medium text-accent underline underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
          </Section>

          <Section title="6. Cancelling and refunds">
            <p>
              Cancel any time from Settings. Billing stops at the end of the current month; there is
              no proration and no cancellation fee. The first month&apos;s software fee is refunded
              on request, no questions asked. After that, fees already charged are not refunded
              except where the service was down for more than a day in that month.
            </p>
          </Section>

          <Section title="7. What we ask of you">
            <p>
              Invite only people who own or live in a home in the association. Keep passwords to
              yourselves. Do not use the service to send anything unlawful, or to collect money the
              association is not entitled to. Board members are responsible for what they record,
              send and charge; the software does what the board tells it.
            </p>
          </Section>

          <Section title="8. Availability">
            <p>
              We aim for the service to be available 99.5% of each month. Payment processing
              availability is Stripe&apos;s. We will tell the board&apos;s president about planned
              downtime and about any incident that affected their data.
            </p>
          </Section>

          <Section title="9. Liability">
            <p>
              We are responsible for keeping the association&apos;s data safe and the figures true to
              what was entered. We are not responsible for decisions the board makes with them, for
              money the association fails to collect, or for a resident&apos;s bank or card. Our total
              liability to an association in any year is limited to the software fees it paid us in
              that year. Nothing here limits liability that cannot be limited by law.
            </p>
          </Section>

          <Section title="10. Changes and contact">
            <p>
              If we change these terms we will email the president and show the date at the top.
              Questions go to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
              . We answer within {SUPPORT_RESPONSE}.
            </p>
          </Section>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-title3 font-semibold tracking-[-0.02em] text-fg">{title}</h2>
      <div className="mt-2 space-y-3 text-fg-muted">{children}</div>
    </section>
  );
}
