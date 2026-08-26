import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  MessageSquareText,
  ScaleIcon,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Badge, Card } from "@/components/ui/primitives";
import { libraryArticles } from "@/lib/data";

export const metadata = {
  title: "HOAsis, community management for self-managed HOAs",
  description:
    "Everything a management company does, run from your own website. Books that reconcile, an app residents use, and reserves you can actually plan.",
};

/**
 * PLACEHOLDER: the cost case has no numbers yet.
 *
 * The shape of the argument is right, shown as arithmetic rather than a
 * percentage so a reader can check it. The figures are not, because we have
 * not surveyed what management companies in our market actually charge and our
 * own pricing is not set. A plausible looking number here is one we would have
 * to walk back in front of the first board that asks where it came from.
 *
 * Fill in once the pricing study is done. Search PLACEHOLDER to find every
 * spot that is waiting on it.
 */
const TBD = "$—";

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
      "Processor cost and our fee, itemized separately",
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
    body: "Neighbor to neighbor, held for review before it publishes. Anything needing a decision goes to a request instead, where it gets a deadline.",
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
 * the theme, and means a new screenshot drops straight in without matching a
 * baked in border.
 *
 * The device is cropped short and faded into the page rather than shown whole.
 * A full phone next to a column of text is taller than everything around it
 * and drags the eye to the bottom of the section; fading it out keeps the
 * weight on the screen content, which is the part worth looking at.
 */
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[262px] sm:w-[288px]">
      <div className="relative h-[380px] overflow-hidden sm:h-[420px]">
        <div className="rounded-t-[2.75rem] bg-navy-950 px-[10px] pt-[10px] shadow-float ring-1 ring-navy-700/50 dark:ring-navy-600/60">
          <div className="relative overflow-hidden rounded-t-[2.15rem] bg-bg">
            <Image
              src={src}
              alt={alt}
              width={764}
              height={1162}
              priority={false}
              sizes="(max-width: 640px) 262px, 288px"
              className="h-auto w-full"
            />
            {/* Dynamic island. */}
            <span
              className="absolute left-1/2 top-2 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-navy-950"
              aria-hidden
            />
          </div>
        </div>

        {/* Dissolves the device into the section instead of cutting it flat. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-bg/80 to-bg"
          aria-hidden
        />
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
        {/* A soft wash of brand color behind everything, so the section reads as
            designed rather than as a photo with text dropped on it. */}
        <div
          className="absolute inset-0 -z-20 bg-[radial-gradient(120%_90%_at_15%_0%,var(--brand-soft)_0%,transparent_55%)]"
          aria-hidden
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:pb-24 sm:pt-20 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <Badge tone="ok" dot>
                Built for boards that self-manage
              </Badge>
              <h1 className="mt-5 text-balance text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[46px]">
                Run your HOA without{" "}
                <span className="bg-gradient-to-br from-navy-700 to-accent bg-clip-text text-transparent dark:from-navy-200 dark:to-accent">
                  a management company.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-fg-muted">
                Collect dues, keep books that tie out, and answer a records request on time.
                Everything a manager does, run by the people who actually live there.
              </p>
            </Reveal>
            <Reveal delay={170}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/start"
                  className="group inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-raised transition-all hover:-translate-y-0.5 hover:shadow-float"
                >
                  Set up your association
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/signin"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-2 bg-surface px-6 text-[15px] font-semibold text-fg transition-colors hover:bg-surface-2"
                >
                  See the live demo
                </Link>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fg-subtle">
                {["No card to start", "Set up in minutes", "Cancel whenever"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-ok" strokeWidth={2.6} />
                    {item}
                  </span>
                ))}
              </p>
            </Reveal>
          </div>

          {/* The photograph earns its place by being visible, rather than being
              flattened to a texture behind the words. */}
          <Reveal delay={120}>
            <figure className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-border shadow-float">
                <Image
                  src="/marketing/porch.jpg"
                  alt="A shingled house with a wraparound porch on a well kept lawn"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover"
                />
              </div>
              {/* One real number from the demo, floated over the corner, so the
                  hero shows the product rather than only describing it. */}
              <figcaption className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-float backdrop-blur-md sm:-left-8">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                  <Check className="size-4" strokeWidth={2.6} />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-fg">Books tie out</span>
                  <span className="block text-[11px] text-fg-muted">
                    Every report agrees, every month
                  </span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Proof band */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4">
          {[
            // PLACEHOLDER: no measured outcomes here yet. These four are all
            // facts about the product that a reader can verify by clicking
            // around, not results we have surveyed.
            { value: "30 yr", label: "Reserve projection" },
            { value: "2", label: "Approvals before a vendor is paid" },
            { value: "0", label: "Per seat charges" },
            { value: "All", label: "Features on every tier" },
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
              Full service management is quoted per door per month, and so are we. The
              arithmetic below is the whole argument. We are running the survey that fills
              it in, and until it is done these stay as dashes rather than as something
              plausible we would have to take back.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Management company",
                value: TBD,
                detail: "Per home per month, times twelve",
                accent: false,
              },
              {
                label: "HOAsis",
                value: TBD,
                detail: "Per home per month, times twelve",
                accent: false,
              },
              {
                label: "Stays in the community",
                value: TBD,
                detail: "The difference, every year",
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
              Whatever that difference turns out to be, it goes into reserves instead of a
              management fee. Over a decade at a realistic yield, that is the gap between
              replacing a roof on schedule and levying a special assessment for it.
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

      {/* A moment of quiet between the argument and the ask. */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] border border-border shadow-float">
              <Image
                src="/marketing/dusk.jpg"
                alt="A house at dusk with its windows lit"
                fill
                sizes="(max-width: 1024px) 100vw, 520px"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[36px]">
              Board work should not eat your evenings.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-fg-muted">
              Most of what a volunteer board does is chasing: a balance nobody can find, a vote
              nobody finished, a document somebody swears was emailed. That work does not need
              more hours. It needs one place where the numbers already agree.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {[
                ["Dues collect themselves", "Owners pay from their phone, and it lands in the books categorized."],
                ["Votes that finish", "Ballots, quorum, and a receipt each owner can check."],
                ["Answers on file", "Records, minutes, and budgets where owners can find them."],
              ].map(([title, body]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-fg">{title}</span>
                    <span className="block text-[13px] leading-relaxed text-fg-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <section className="relative isolate overflow-hidden bg-navy-900 text-navy-50 dark:bg-navy-800">
        <Image
          src="/marketing/lane.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover"
        />
        {/* Scrim, so the type stays legible over any part of the photograph. */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/90"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-6xl px-5 py-24 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[40px]">
              Have a look before you decide anything.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-navy-200">
              The demo is a real association with real numbers behind it, including a reserve plan
              that does not quite work. Sign in as a board member or a resident and go anywhere.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/start"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-navy-50 px-6 text-[14px] font-semibold text-navy-950 transition-transform hover:-translate-y-0.5"
              >
                Set up your association
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-navy-50/30 px-6 text-[14px] font-semibold text-navy-50 transition-colors hover:bg-navy-50/10"
              >
                Open the demo
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
