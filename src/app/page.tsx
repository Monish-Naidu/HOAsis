import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  MessageSquareText,
  ScaleIcon,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Badge, Card } from "@/components/ui/primitives";
import { communitySettings, libraryArticles } from "@/lib/data";
import { money } from "@/lib/utils";

export const metadata = {
  title: "HOAsis, community management for self-managed HOAs",
  description:
    "Everything a management company does, run from your own website. Books that reconcile, an app residents use, and reserves you can actually plan.",
};

/**
 * The cost case, shown as arithmetic rather than a percentage.
 *
 * A worked example for one plausible association is more persuasive than a
 * claim, and it is honest because the assumption is printed next to the
 * answer. Change the assumption and the reader can redo the sum themselves.
 */
const HOMES = 88;
const MANAGEMENT_PER_DOOR = 14_00;
const HOASIS_PER_DOOR = 2_00;
const managementYear = HOMES * MANAGEMENT_PER_DOOR * 12;
const hoasisYear = HOMES * HOASIS_PER_DOOR * 12;
const savedYear = managementYear - hoasisYear;

/** Each value section pairs a claim with the screen that proves it. */
const SHOWCASE = [
  {
    eyebrow: "Accounting",
    title: "You can tell, at a glance, whether the books are right.",
    body: "Transactions that need a human decision are held out of every report until they get one. Nothing is auto-categorized, duplicates are caught before they reach a statement, and the dashboard says plainly when something is unresolved instead of quietly averaging it in.",
    points: [
      "Live bank feeds, not a nightly batch",
      "Duplicate detection with a one click fix",
      "One balance every report agrees with",
    ],
    image: "/marketing/product-dashboard.png",
    width: 1568,
    height: 694,
    alt: "The board dashboard showing three transactions held out of the reports until reviewed",
  },
  {
    eyebrow: "Reserves",
    title: "Know the year the money runs out, while you can still do something.",
    body: "Every component is replaced in the year its useful life ends, at a cost inflated to that year. Roll it forward and the first negative year is the year a board levies a special assessment. We name it, then solve for the contribution that avoids it.",
    points: [
      "Thirty years projected, not a snapshot",
      "Percent funded against accrued liability",
      "The exact contribution that fixes it",
    ],
    image: "/marketing/product-reserves.png",
    width: 1470,
    height: 720,
    alt: "A thirty year reserve projection with the shortfall years shown in red below the axis",
  },
  {
    eyebrow: "Residents",
    title: "The three things an owner ever does, made quick.",
    body: "Pay, look something up, file a request. Every payment method quotes what it actually costs before anyone commits, and every payment shows which charges it cleared. The same screens ship as the mobile app.",
    points: [
      "Dues at processor cost, no markup",
      "Requests with a certificate you can show a contractor",
      "Association funds open to owners, if the board allows",
    ],
    image: "/marketing/product-resident.png",
    width: 764,
    height: 1162,
    alt: "The resident app showing a balance due, a live board meeting, and open ballots",
    portrait: true,
  },
];

const ALSO = [
  {
    icon: Vote,
    title: "Voting people finish",
    body: "Ballots that hold paragraphs, tallies sealed until close, and a video meeting with dial-in so the vote happens while everyone is on the line.",
  },
  {
    icon: ScaleIcon,
    title: "Compliance with the evidence attached",
    body: "Obligations tracked as dated items with the proof stapled on, so a records request is answered from something already assembled.",
  },
  {
    icon: MessageSquareText,
    title: "A forum, moderated",
    body: "Neighbour to neighbour, held for review before it publishes. Anything needing a decision goes to a request instead, where it gets a deadline.",
  },
  {
    icon: ShieldCheck,
    title: "Nobody moves money alone",
    body: "Two signatures over a threshold, an audit trail on every change, and a President whose access cannot be revoked out from under them.",
  },
];

const JOBS = [
  "Collect assessments and chase the late ones",
  "Pay vendors by ACH with two signatures",
  "Keep the books and produce statements",
  "Hold records and publish what must be public",
  "Send notices with a log that proves delivery",
  "Run elections and certify the result",
  "Log violations through notice, cure, and hearing",
  "Answer owners without losing the thread",
  "Track every compliance deadline that applies",
];

/**
 * A phone around the resident screenshot.
 *
 * The capture is the screen only, with no bezel of its own, so the device is
 * drawn here in CSS. That keeps it crisp at any size, lets the frame follow
 * the theme, and means a new screenshot drops straight in without having to
 * match a baked in border. Deliberately just a bezel: side buttons read as
 * artefacts at this size rather than as detail.
 */
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[268px] sm:w-[292px]">
      <div className="relative overflow-hidden rounded-[2.75rem] bg-navy-950 p-[10px] shadow-float ring-1 ring-navy-700/50 dark:ring-navy-600/60">
        <div className="relative overflow-hidden rounded-[2.15rem] bg-bg">
          <Image
            src={src}
            alt={alt}
            width={764}
            height={1162}
            sizes="(max-width: 640px) 268px, 292px"
            className="h-auto w-full"
          />
          {/* Dynamic island. */}
          <span
            className="absolute left-1/2 top-2 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-navy-950"
            aria-hidden
          />
          {/* Home indicator. */}
          <span
            className="absolute bottom-1.5 left-1/2 h-[4px] w-[104px] -translate-x-1/2 rounded-full bg-navy-950/25"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

export default function MarketingHome() {
  const featured = libraryArticles.slice(0, 3);

  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <Image
          src={communitySettings.photoUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-[0.18] dark:opacity-[0.22]"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-bg/50 via-bg/70 to-bg"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
          <Reveal>
            <Badge tone="ok" dot>
              Built for boards that self-manage
            </Badge>
            <h1 className="mt-5 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[60px]">
              Everything a management company does.
              <span className="block text-fg-muted">Run from your own website.</span>
            </h1>
          </Reveal>
          <Reveal delay={90}>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-muted">
              Volunteer boards do not need a manager to collect dues, keep books that tie out, or
              answer a records request on time. They need software that does not make those things
              harder than they are.
            </p>
          </Reveal>
          <Reveal delay={170}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signin"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-[14px] font-semibold text-brand-fg shadow-raised transition-transform hover:-translate-y-0.5"
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

      {/* Proof band */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4">
          {[
            { value: money(savedYear, { cents: false }), label: "Saved a year, 88 homes" },
            { value: "30 yr", label: "Reserve projection" },
            { value: "At cost", label: "Payment processing" },
            { value: "7 days", label: "Phone and chat support" },
          ].map((stat, index) => (
            <Reveal key={stat.label} delay={index * 60}>
              <div>
                <p className="tnum text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-[12px] leading-snug text-fg-muted">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Showcase */}
      {SHOWCASE.map((section, index) => (
        <section
          key={section.title}
          className={`border-b border-border ${index % 2 === 1 ? "bg-surface" : ""}`}
        >
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2">
            <Reveal className={index % 2 === 1 ? "lg:order-2" : ""}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
                {section.eyebrow}
              </p>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[34px]">
                {section.title}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">{section.body}</p>
              <ul className="mt-5 space-y-2.5">
                {section.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                    <span className="text-[14px] leading-snug text-fg">{point}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={100} className={index % 2 === 1 ? "lg:order-1" : ""}>
              {section.portrait ? (
                <PhoneFrame src={section.image} alt={section.alt} />
              ) : (
                <div className="overflow-hidden rounded-card border border-border shadow-float">
                  <Image
                    src={section.image}
                    alt={section.alt}
                    width={section.width}
                    height={section.height}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="h-auto w-full"
                  />
                </div>
              )}
            </Reveal>
          </div>
        </section>
      ))}

      {/* Cost */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <Image
          src="/marketing/homes.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover opacity-[0.12] dark:opacity-[0.14]"
        />
        <div className="absolute inset-0 -z-10 bg-bg/70" aria-hidden />
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
                accent: false,
              },
              {
                label: "HOAsis",
                value: money(hoasisYear, { cents: false }),
                detail: `${money(HOASIS_PER_DOOR, { cents: false })} per home per month`,
                accent: false,
              },
              {
                label: "Stays in the community",
                value: money(savedYear, { cents: false }),
                detail: "Every year, before anything compounds",
                accent: true,
              },
            ].map((item, index) => (
              <Reveal key={item.label} delay={index * 80}>
                <Card
                  className={`h-full p-5 ${item.accent ? "border-ok/30 bg-ok-soft" : ""}`}
                >
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      item.accent ? "text-ok" : "text-fg-subtle"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p
                    className={`tnum mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] ${
                      item.accent ? "text-ok" : "text-fg"
                    }`}
                  >
                    {item.value}
                  </p>
                  <p
                    className={`mt-2 text-[12px] ${item.accent ? "text-ok opacity-90" : "text-fg-muted"}`}
                  >
                    {item.detail}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={240}>
            <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
              Put {money(savedYear, { cents: false })} a year into reserves instead and, over a
              decade at a realistic yield, it is the difference between replacing a roof on
              schedule and levying a special assessment for it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The nine jobs */}
      <section className="border-b border-border bg-surface">
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
            {JOBS.map((job, index) => (
              <Reveal key={job} delay={index * 35}>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.4} />
                  <span className="text-[14px] leading-snug text-fg">{job}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* And also */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-4 md:grid-cols-2">
            {ALSO.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 70}>
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

      {/* Library */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <Image
          src="/marketing/house.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover opacity-[0.1] dark:opacity-[0.12]"
        />
        <div className="absolute inset-0 -z-10 bg-bg/75" aria-hidden />
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[36px]">
                  A library, free to anyone
                </h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted">
                  No account, no email gate, whether or not you ever use the product. Most of it is
                  general. The state specific parts are where the value is, because nobody else
                  publishes those for free.
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
      <section className="relative isolate overflow-hidden bg-navy-900 text-navy-50 dark:bg-navy-800">
        <Image
          src="/marketing/street.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover opacity-20"
        />
        <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[40px]">
              Have a look before you decide anything.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-navy-200">
              The demo is a real association with real numbers behind it, including a reserve plan
              that does not quite work. Sign in as a board member or a resident and go anywhere.
            </p>
            <Link
              href="/signin"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-navy-50 px-6 text-[14px] font-semibold text-navy-950 transition-transform hover:-translate-y-0.5"
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
