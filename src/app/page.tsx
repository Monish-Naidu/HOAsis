import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Check,
  PiggyBank,
  ScaleIcon,
  Smartphone,
  Vote,
} from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Badge, Card } from "@/components/ui/primitives";
import { communitySettings, libraryArticles } from "@/lib/data";
import { money } from "@/lib/utils";

export const metadata = {
  title: "HOAsis, community management for self-managed HOAs",
  description:
    "Everything a management company does, run from your own website. Books that reconcile, an app residents use, and compliance handled.",
};

/**
 * A worked example rather than a slogan.
 *
 * Management is commonly quoted per door per month. Showing the arithmetic for
 * one plausible association is more persuasive than a percentage, and it is
 * honest about the assumption because the assumption is stated.
 */
const HOMES = 88;
const MANAGEMENT_PER_DOOR = 14_00;
const HOASIS_PER_DOOR = 2_00;

const managementYear = HOMES * MANAGEMENT_PER_DOOR * 12;
const hoasisYear = HOMES * HOASIS_PER_DOOR * 12;
const savedYear = managementYear - hoasisYear;

const PILLARS = [
  {
    icon: Banknote,
    title: "Books that reconcile",
    body: "Live bank feeds, duplicate detection, and one balance every report agrees with. Anything that needs a human decision is held out of the reports until it gets one.",
  },
  {
    icon: Smartphone,
    title: "An app residents use",
    body: "Pay, look something up, file a request. Dues priced at what the processor charges, quoted before anyone commits.",
  },
  {
    icon: PiggyBank,
    title: "Reserves you can plan",
    body: "Thirty years projected forward, with the first year the money runs out named out loud, and the contribution that avoids it solved for you.",
  },
  {
    icon: Vote,
    title: "Voting people finish",
    body: "Ballots that hold paragraphs, tallies sealed until close, and a video meeting with dial-in so a vote can happen while everyone is on the line.",
  },
  {
    icon: ScaleIcon,
    title: "Compliance as a feature",
    body: "State obligations tracked as dated items with the evidence attached, so the answer to an owner's records request is already assembled.",
  },
  {
    icon: BookOpen,
    title: "A library, free to anyone",
    body: "How to run a meeting, read a budget, collect a late assessment. General guidance plus the state specific parts nobody publishes for free.",
  },
];

const DOES = [
  "Collect assessments and chase the late ones",
  "Pay vendors by ACH with two signatures",
  "Keep the books and produce statements",
  "Hold the records and publish what must be public",
  "Send notices with a delivery log that proves it",
  "Run elections and record the result",
  "Log violations through notice, cure, and hearing",
  "Answer owners without losing the thread",
  "Track every compliance deadline that applies",
];

export default function MarketingHome() {
  const featured = libraryArticles.slice(0, 3);

  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.12] dark:opacity-[0.16]"
          style={{ backgroundImage: `url(${communitySettings.photoUrl})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/40 to-bg" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
          <Reveal>
            <Badge tone="ok" dot>
              Built for boards that self-manage
            </Badge>
            <h1 className="mt-5 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[58px]">
              Everything a management company does.
              <span className="block text-fg-muted">Run from your own website.</span>
            </h1>
          </Reveal>
          <Reveal delay={90}>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-fg-muted">
              Volunteer boards do not need a manager to collect dues, keep books that tie out, or
              answer a records request on time. They need software that does not make those things
              harder than they are.
            </p>
          </Reveal>
          <Reveal delay={170}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signin"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-[14px] font-semibold text-brand-fg transition-transform hover:-translate-y-0.5"
              >
                See the live demo
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/library"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-2 bg-surface px-5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-2"
              >
                <BookOpen className="size-4" />
                Free library
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Cost */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
          <Reveal>
            <h2 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[36px]">
              The savings are not a rounding error.
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted">
              Full service management is commonly quoted per door per month. Here is the
              arithmetic for an {HOMES} home association, with the assumption stated so you can
              argue with it.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Management company",
                value: money(managementYear, { cents: false }),
                detail: `${money(MANAGEMENT_PER_DOOR, { cents: false })} per home per month`,
                tone: "muted" as const,
              },
              {
                label: "HOAsis",
                value: money(hoasisYear, { cents: false }),
                detail: `${money(HOASIS_PER_DOOR, { cents: false })} per home per month`,
                tone: "muted" as const,
              },
              {
                label: "Stays in the community",
                value: money(savedYear, { cents: false }),
                detail: "Every year, before anything compounds",
                tone: "ok" as const,
              },
            ].map((item, index) => (
              <Reveal key={item.label} delay={index * 80}>
                <Card className="h-full p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                    {item.label}
                  </p>
                  <p
                    className={`tnum mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] ${
                      item.tone === "ok" ? "text-ok" : "text-fg"
                    }`}
                  >
                    {item.value}
                  </p>
                  <p className="mt-2 text-[12px] text-fg-muted">{item.detail}</p>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={240}>
            <p className="mt-5 text-[13px] leading-relaxed text-fg-muted">
              Put {money(savedYear, { cents: false })} a year into reserves instead and, at a
              realistic yield over a decade, it is the difference between replacing a roof on
              schedule and levying a special assessment for it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* What it does */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
          <Reveal>
            <h2 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[36px]">
              The nine jobs you are paying someone else to do.
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted">
              A management contract bundles these and quotes one number. Here they are unbundled,
              and every one of them is in the product.
            </p>
          </Reveal>
          <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOES.map((item, index) => (
              <Reveal key={item} delay={index * 40}>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                  <span className="text-[14px] leading-snug text-fg">{item}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
          <Reveal>
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[36px]">
              What is actually different
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 60}>
                <Card className="h-full p-5 transition-transform hover:-translate-y-0.5">
                  <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-fg">
                    <Icon className="size-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-fg">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Library teaser */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[36px]">
                  A library, free to anyone
                </h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted">
                  No account, no email gate. Most of it is general. The state specific parts are
                  where the value is, because nobody else publishes those for free.
                </p>
              </div>
              <Link
                href="/library"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-2 bg-surface px-4 text-[13px] font-semibold text-fg hover:bg-surface-2"
              >
                Browse all {libraryArticles.length}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {featured.map((article, index) => (
              <Reveal key={article.slug} delay={index * 70}>
                <Link href={`/library/${article.slug}`} className="group block h-full">
                  <Card className="h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-raised">
                    <Badge tone="neutral">{article.topic}</Badge>
                    <h3 className="mt-2.5 text-[16px] font-semibold leading-snug tracking-[-0.015em] text-fg">
                      {article.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                      {article.summary}
                    </p>
                    <p className="mt-3 text-[11px] text-fg-subtle">
                      {article.readMinutes} minute read
                    </p>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="bg-navy-900 text-navy-50 dark:bg-navy-800">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 text-center sm:py-20">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
              Have a look before you decide anything.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-navy-200">
              The demo is a real association with real numbers behind it. Sign in as a board
              member or as a resident and go anywhere.
            </p>
            <Link
              href="/signin"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-navy-50 px-5 text-[14px] font-semibold text-navy-950 transition-transform hover:-translate-y-0.5"
            >
              Open the demo
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
