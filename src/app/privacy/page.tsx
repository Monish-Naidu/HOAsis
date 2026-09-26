import Link from "next/link";
import { MarketingFooter, MarketingHeader } from "@/components/app/marketing-chrome";
import { Callout } from "@/components/ui/primitives";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata = {
  title: "Privacy policy",
  description: "What Your HOAsis stores, where, who can see it, and how to get it back or deleted.",
};

/** Last edited. Bump when the words change. */
const UPDATED = "September 26, 2026";

/**
 * What we store and who sees it, in the words a board forwards to its
 * attorney. Every statement here is checked against the code: row level
 * security per association, the providers named in docs/tenancy.md, the
 * thirty day soft delete in the danger zone. Draft until a lawyer reads it.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
        <header>
          <p className="text-footnote font-semibold uppercase tracking-wide text-fg-subtle">Legal</p>
          <h1 className="mt-2 text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[44px]">
            Privacy policy
          </h1>
          <p className="mt-3 text-body text-fg-muted">Last updated {UPDATED}.</p>
        </header>

        <Callout tone="warn" className="mt-8" title="Draft, not yet reviewed by a lawyer">
          This describes what the software does today, in plain words. An attorney has not reviewed
          it yet. If your board needs a signed data processing agreement, write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          .
        </Callout>

        <article className="mt-10 space-y-8 text-body leading-relaxed">
          <Section title="1. What we store">
            <p>
              For the association: its name, address, dues, fiscal year, bank account name and last
              four digits, documents the board uploads, budget and ledger lines, meetings, votes,
              notices and messages. For each home: the unit or address, the owner&apos;s name, email
              and phone, the statement of charges and payments, and any autopay plan. For each
              person with an account: name, email, a hashed password, and when they signed in.
            </p>
            <p>
              We never see or store card numbers or bank account numbers. Those go to Stripe from
              the resident&apos;s browser; we keep only the kind of method and its last four digits.
            </p>
          </Section>

          <Section title="2. Where it lives">
            <p>
              The database and file storage are hosted by Supabase in the United States (US East).
              The website runs on Vercel. Payments run on Stripe. Email is sent through Resend.
              Errors are reported to Sentry without personal details. Each of these providers holds
              only what it needs for its part.
            </p>
          </Section>

          <Section title="3. Who can see what">
            <p>
              Every record belongs to one association, and the database refuses to show one
              association&apos;s records to a member of another. Within an association, a resident
              sees their own home and what the board publishes to everyone. Board members see what
              the president has granted them: finances, homeowners, documents, and so on. The
              president decides.
            </p>
            <p>
              We, the people who run the service, can reach the database to keep it running and to
              help when a board writes in. We do not read an association&apos;s records without a
              reason, and we do not sell, share or use them for advertising. Ever.
            </p>
          </Section>

          <Section title="4. Email">
            <p>
              We email residents on the association&apos;s behalf: invitations, bills, receipts,
              reminders, notices of meetings and votes, and messages from the board. Notices the law
              requires an association to send (assessments, delinquency, meetings, ballots) cannot be
              unsubscribed from; everything else carries a one click unsubscribe link. Every email
              sent is logged, and the board can see whether it was delivered.
            </p>
          </Section>

          <Section title="5. Cookies and storage">
            <p>
              We use a session cookie to keep you signed in and browser storage for preferences such
              as theme and text size. There is no advertising or cross site tracking.
            </p>
          </Section>

          <Section title="6. Getting your data back, and deleting it">
            <p>
              The board can export the register and the transactions as CSV from the product at any
              time, and can ask us for everything the association has stored. A person can ask to see
              or correct what we hold about them by writing to us. When an association cancels, its
              records are kept for thirty days so they can be exported or restored, then deleted.
              A resident who leaves an association keeps their account; the home&apos;s history stays
              with the association, because it is the association&apos;s record.
            </p>
          </Section>

          <Section title="7. Children">
            <p>The service is for adults who own or live in a home in an association. We do not knowingly collect information about children.</p>
          </Section>

          <Section title="8. Changes and contact">
            <p>
              If this changes we will email the president of every association and show the date at
              the top. Questions, requests and complaints go to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
              . The{" "}
              <Link href="/terms" className="font-medium text-accent underline underline-offset-2">
                terms of service
              </Link>{" "}
              say what we owe each other.
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
