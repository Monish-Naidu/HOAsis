import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardCheck,
  Clock,
  CreditCard,
  Headphones,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Avatar, Card } from "@/components/ui/primitives";
import {
  articleBySlug,
  association,
  communitySettings,
  liveMeeting,
  openRequests,
  reserveComponents,
  reserveSummary,
  upcomingMeetings,
  vendorGaps,
  vendors,
} from "@/lib/data";
import { computePaymentCost, FEE_SCHEDULE } from "@/lib/payments/instruments";
import { PRICE_PER_HOME_CENTS, PRICE_PER_TRANSACTION_CENTS, TRIAL_DAYS } from "@/lib/pricing";
import { cn, daysFromToday, formatDate, money, today } from "@/lib/utils";

export const metadata = {
  title: "ExpressHOA. Moving your community forward.",
  description:
    "Everything your HOA needs to get things done quickly, all in one place. Set up in minutes, no card to start, and the first 90 days are free.",
};

/*
 * The page follows the deck Monish brought on 2026-08-28, slide for slide:
 * hero, "Run your HOA", Greg, the five feature cards, the phone. Copy is the
 * deck's, with em dashes replaced. `docs/design/landing-page.md` records the
 * mapping and the few places this departs from the slides.
 */

/**
 * The strip under the hero, from the 2026-09-01 brand concept: four promises
 * with icons. Every item is a promise the product keeps today; the free trial
 * moved to the pricing line, where the question it answers is asked.
 */
const ASSURANCES = [
  { icon: Zap, label: "Setup in Minutes" },
  { icon: CreditCard, label: "No Card to Start" },
  { icon: CircleX, label: "Cancel Whenever" },
  { icon: Headphones, label: "Live Support" },
];

const BENEFITS = [
  {
    icon: Clock,
    title: "Save time",
    body: "Automate everyday HOA tasks and reduce busywork.",
  },
  {
    icon: CircleDollarSign,
    title: "Save money",
    body: "Get professional tools without professional management fees.",
  },
  {
    icon: ShieldCheck,
    title: "Stay compliant",
    body: "Keep records, deadlines, and requirements on track.",
  },
];

const POCKET = [
  {
    icon: CircleCheck,
    title: "Approve",
    body: "Review requests, invoices, and documents on the go.",
  },
  {
    icon: MessagesSquare,
    title: "Communicate",
    body: "Message homeowners and vendors instantly.",
  },
  {
    icon: Bell,
    title: "Stay informed",
    body: "Get real-time updates on what matters most.",
  },
  {
    icon: Video,
    title: "Connect",
    body: "Hop on a secure video call with board members or vendors.",
  },
];


/**
 * The five guides in the Knowledge Center card, in the deck's order: duties,
 * meetings, collections, budgets, reserves. Real articles, so every row opens.
 */
/**
 * Labeled with the articles' own titles, so the link and the page it opens
 * say the same thing. Renaming them for the card reads better until someone
 * clicks "Board member duties" and lands on a page that never uses the words.
 */

/* -------------------------------------------------------------------------- */
/* Device frames                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard on a display, the way Apple shows hardware: the device floats
 * on the page itself with a soft ground shadow, no card and no studio
 * backdrop. The monitor render from 2026-08-31 carried its own baked-in
 * background, which read as a white slab on the dark theme, so the display is
 * drawn here instead: a thin black bezel, an aluminum stand, and the real
 * capture on the glass. The aluminum is fixed silver in both themes, like
 * every device bezel in the product.
 */
function MonitorFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[680px]">
      {/* Silver, per the huddle: the near-black bezel lost its edge against
          the dark theme. The aluminum body reads on both. */}
      <div className="relative rounded-[clamp(12px,2.6vw,18px)] bg-gradient-to-b from-[#e8eaed] via-[#d2d5da] to-[#b6bbc2] p-[clamp(6px,1.4vw,10px)] shadow-[0_30px_70px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/20 dark:shadow-[0_30px_70px_-20px_rgb(0_0_0/0.85)]">
        {/* The machined edge, caught by the light along the top. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[clamp(12px,2.6vw,18px)] ring-1 ring-inset ring-white/50"
          aria-hidden
        />
        <div className="overflow-hidden rounded-[clamp(6px,1.2vw,9px)] bg-black p-px ring-1 ring-black/40">
          <Image
            src={src}
            alt={alt}
            width={2360}
            height={1236}
            sizes="(max-width: 1024px) 100vw, 660px"
            className="h-auto w-full"
          />
        </div>
      </div>
      {/* The stand: a flat neck and a plate, edge on. */}
      <div
        className="mx-auto h-[clamp(40px,8vw,64px)] w-[clamp(64px,13vw,96px)] bg-gradient-to-b from-[#c9ccd1] via-[#dcdfe3] to-[#aeb3b9]"
        aria-hidden
      />
      <div
        className="mx-auto h-[9px] w-[clamp(150px,36vw,240px)] rounded-[4px] bg-gradient-to-b from-[#e3e5e8] to-[#9ba0a6]"
        aria-hidden
      />
      {/* The ground it sits on. */}
      <div
        className="mx-auto -mt-1.5 h-4 w-[70%] rounded-[100%] bg-black/20 blur-lg dark:bg-black/50"
        aria-hidden
      />
    </div>
  );
}

/**
 * The phone photograph around the resident screenshot.
 *
 * The device leans, so the flat capture is mapped onto the screen with a
 * projective transform: the four screen corners were measured off the
 * photograph, and the matrix maps a 430x1030 rectangle onto that quad at this
 * exact render width. Change the width and the matrix must be recomputed
 * (docs/design/dash-2026-09-01 has the measurement notes).
 */
function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    // A fixed render width: the matrix is computed for exactly 340px, and a
    // uniform scale is the only resize that keeps the overlay registered.
    <div className="relative mx-auto w-[340px] origin-top max-[359px]:scale-[.88]">
      <Image
        src="/marketing/device-phone.png"
        alt=""
        width={1086}
        height={1448}
        sizes="340px"
        className="h-auto w-full"
      />
      <div
        className="absolute left-0 top-0 h-[1030px] w-[430px] origin-top-left overflow-hidden rounded-[50px]"
        style={{
          transform:
            "matrix3d(0.331930, -0.063114, 0, -0.000153, -0.029395, 0.341345, 0, -0.000080, 0, 0, 1, 0, 93.253766, 40.420067, 0, 1)",
        }}
      >
        <Image src={src} alt={alt} fill sizes="430px" className="object-cover object-top" />
        {/* A whisper of glass, so the flat capture sits in the photograph. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The feature cards' miniature screens                                        */
/*                                                                             */
/* Each one is drawn from the same records the demo runs on, so the card and   */
/* the product a visitor opens next agree with each other.                     */
/* -------------------------------------------------------------------------- */

function Mini({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-3 shadow-raised", className)}>
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "info"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        tone === "ok" ? "bg-ok-soft text-ok" : "bg-info-soft text-info",
      )}
    >
      {children}
    </span>
  );
}

function ComplianceMini() {
  const update = articleBySlug("washington-recent-changes");
  return (
    <Mini>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-fg">Washington updates</p>
        <Pill tone="ok">New</Pill>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-fg-muted">
        {update?.summary ?? "Bill numbers and effective dates, in plain words."}
      </p>
      <Link
        href={update ? `/library/${update.slug}` : "/library"}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent"
      >
        Read summary
        <ArrowRight className="size-3" />
      </Link>
    </Mini>
  );
}

function Ring({ percent }: { percent: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-12 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-surface-3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        className="stroke-accent"
      />
    </svg>
  );
}

function ReserveMini() {
  const percent = Math.round(reserveSummary().percentFunded * 100);
  const onTrack = percent >= 70;
  const year = today().getUTCFullYear();
  const soonest = [...reserveComponents]
    .sort((a, b) => a.remainingLifeYears - b.remainingLifeYears)
    .slice(0, 3);
  return (
    <Mini>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-fg-muted">Reserve health</p>
          <p className="tnum mt-0.5 text-[22px] font-semibold leading-none tracking-[-0.02em] text-fg">
            {percent}%
          </p>
          <p className={cn("mt-1 text-[11px] font-semibold", onTrack ? "text-ok" : "text-warn")}>
            {onTrack ? "On track" : "Behind the study"}
          </p>
        </div>
        <Ring percent={percent} />
      </div>
      <ul className="mt-3 space-y-2 border-t border-border pt-3">
        {soonest.map((component) => {
          const funded = Math.round((component.fundedCents / component.replacementCostCents) * 100);
          return (
            <li key={component.id}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-fg">{component.name.split(",")[0]}</span>
                <span className="tnum shrink-0 text-fg-muted">
                  {year + component.remainingLifeYears} · {funded}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    "h-full rounded-full",
                    funded >= 80 ? "bg-ok" : funded >= 50 ? "bg-info" : "bg-warn",
                  )}
                  style={{ width: `${funded}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Mini>
  );
}

function VendorMini() {
  return (
    <Mini className="p-2">
      <ul className="divide-y divide-border">
        {vendors.slice(0, 3).map((vendor) => {
          const active =
            vendor.w9OnFile && (!vendor.coiExpires || daysFromToday(vendor.coiExpires) >= 0);
          return (
            <li key={vendor.id} className="px-1 py-1.5">
              <p className="truncate text-[11px] font-semibold leading-tight text-fg">
                {vendor.name}
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-[10px] text-fg-muted">{vendor.service}</p>
                <Pill tone={active ? "ok" : "info"}>{active ? "Active" : "Review"}</Pill>
              </div>
            </li>
          );
        })}
      </ul>
    </Mini>
  );
}



/**
 * The five cards on slide four. Two of them are about guidance rather than a
 * screen, so their links open the library; the other three open the demo,
 * because the honest way to learn more about a feature is to use it.
 */
/**
 * The rails on the demo association's own dues, priced by the same
 * computePaymentCost the product runs, so the card and the pay screen agree.
 */
function PaymentsMini() {
  const policy = {
    flatCents: communitySettings.paymentFeeCents,
    paidBy: communitySettings.paymentFeePaidBy,
    waiveOnAch: communitySettings.paymentFeeWaivedOnAch,
  };
  const dues = association.duesCents;
  return (
    <Mini className="p-2">
      <ul className="divide-y divide-border">
        {(
          [
            { kind: "ach", label: "Bank transfer" },
            { kind: "card", label: "Card" },
          ] as const
        ).map(({ kind, label }) => {
          const cost = computePaymentCost(kind, dues, policy);
          return (
            <li key={kind} className="px-1 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-fg">{label}</p>
                <span className="tnum text-[11px] text-fg-muted">
                  {money(cost.residentPaysCents)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="text-[10px] text-fg-muted">{FEE_SCHEDULE[kind].settlement}</p>
                {/* Under a flat owner fee both rails cost the owner the same;
                    the saving lands on the association, and the pay screen
                    says so in the same words. */}
                {kind === "ach" ? <Pill tone="ok">Saves the HOA</Pill> : null}
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-2 px-1 py-1.5">
          <p className="text-[11px] font-semibold text-fg">Autopay</p>
          <Pill tone="info">On the 1st</Pill>
        </li>
      </ul>
    </Mini>
  );
}

/** Everything the four tiles left out, per the huddle: a list, not a grid. */
function MoreList() {
  return (
    <Mini className="p-3">
      <ul className="grid gap-y-1.5">
        {[
          "Violations",
          "Architectural requests",
          "Documents",
          "Communication",
          "Meetings",
          "Voting",
          "Reporting",
          "Directory",
          "Knowledge center",
          "Board transitions",
        ].map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-[12px] font-medium text-fg">
            <Check className="size-3 shrink-0 text-ok" strokeWidth={3} />
            {item}
          </li>
        ))}
      </ul>
    </Mini>
  );
}

const FEATURES = [
  {
    icon: ShieldCheck,
    tone: "bg-ok-soft text-ok",
    title: "Compliance updates",
    body: "Stay ahead of changing laws and requirements so your community stays protected.",
    href: "/library",
    mini: <ComplianceMini />,
  },
  {
    icon: ChartNoAxesColumn,
    tone: "bg-info-soft text-info",
    title: "Reserve tracking",
    body: "Know what you're saving for and whether you're on track for the future.",
    href: "/signin",
    mini: <ReserveMini />,
  },
  {
    icon: Briefcase,
    tone: "bg-ok-soft text-ok",
    title: "Vendor management",
    body: "Keep vendors, contracts, insurance, and projects organized in one place.",
    href: "/signin",
    mini: <VendorMini />,
  },
  {
    icon: CreditCard,
    tone: "bg-info-soft text-info",
    title: "Payments & dues",
    body: "Dues by bank transfer or card, posted to the books the moment they clear.",
    href: "/signin",
    mini: <PaymentsMini />,
  },
  {
    icon: Sparkles,
    tone: "bg-warn-soft text-warn",
    title: "...and more",
    body: "One subscription, every feature. Nothing is gated behind a bigger plan.",
    href: "/pricing#included",
    mini: <MoreList />,
  },
];

/* -------------------------------------------------------------------------- */
/* The cards floating beside the phone                                         */
/* -------------------------------------------------------------------------- */

function Notice({
  icon: Icon,
  tone,
  title,
  body,
  children,
  className,
}: {
  icon: typeof Bell;
  tone: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-3.5 shadow-float",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tone)}
        >
          <Icon className="size-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight text-fg">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PocketNotices({ className }: { className?: string }) {
  const request = openRequests()[0];
  const coi = vendorGaps().expiringCoi[0];
  const next = upcomingMeetings().find((meeting) => meeting.status !== "live");
  const live = liveMeeting();

  return (
    <div className={className} aria-hidden>
      {request ? (
        <Notice
          icon={ClipboardCheck}
          tone="bg-info-soft text-info"
          title={`New ${request.kind} request`}
          body={`Unit ${request.unit}`}
        />
      ) : null}
      {coi ? (
        <Notice
          icon={ShieldCheck}
          tone="bg-warn-soft text-warn"
          title={`Vendor COI expires in ${daysFromToday(coi.coiExpires!)} days`}
          body={coi.name}
        />
      ) : null}
      {next ? (
        <Notice
          icon={CalendarDays}
          tone="bg-brand-soft text-brand-soft-fg"
          title="Board meeting"
          body={`${formatDate(next.date)} at ${next.time}, ${next.location}`}
        />
      ) : null}
      {live ? (
        <Notice
          icon={Video}
          tone="bg-ok-soft text-ok"
          title="Video call with the board"
          body={`Live now, ${live.attendees.length} joined`}
        >
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex -space-x-2">
              {live.attendees.slice(0, 3).map((person) => (
                <Avatar
                  key={person.name}
                  name={person.name}
                  className="size-7 text-[10px] ring-2 ring-surface"
                />
              ))}
            </div>
            <span className="inline-flex h-8 items-center rounded-lg bg-royal px-3.5 text-[13px] font-semibold text-royal-fg">
              Join call
            </span>
          </div>
        </Notice>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The page                                                                    */
/* -------------------------------------------------------------------------- */

function IconRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-4 py-5">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
        <Icon className="size-6" strokeWidth={1.9} />
      </span>
      <div>
        <p className="text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</p>
        <p className="mt-1 text-[16px] leading-relaxed text-fg-muted">{body}</p>
      </div>
    </li>
  );
}

export default function MarketingHome() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />

      {/* Hero, slide one. The header sits on this field with no bar of its
          own, which is why the section starts at the top of the page and the
          copy carries the top padding. */}
      <section className="relative isolate -mt-[69px] overflow-hidden bg-hero-field pt-[69px]">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block"
          aria-hidden
        >
          {/* The same neighborhood rendered twice, 2026-08-31: day for the
              light theme, night for the dark one. The filter hack that used
              to fake the day version is gone. */}
          <Image
            src="/marketing/hero-day.jpg"
            alt=""
            fill
            priority
            sizes="58vw"
            className="object-cover object-[left_top] dark:hidden"
          />
          <Image
            src="/marketing/hero-night.jpg"
            alt=""
            fill
            sizes="58vw"
            className="hidden object-cover object-[left_top] dark:block"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-hero-field from-[9%] via-hero-field/45 via-[44%] to-transparent to-[82%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-hero-field/65 via-transparent via-[38%] to-hero-field/55" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-14 sm:pt-20 lg:grid lg:min-h-[42rem] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-start lg:pb-24 lg:pt-24">
          <div className="lg:pr-8">
            <Reveal>
              <h1 className="text-balance text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-fg sm:text-[56px]">
                Moving your community
                <br />
                <span className="text-hero-accent">forward.</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-6 max-w-md text-[18px] leading-relaxed text-fg-muted">
                Everything your HOA needs to get things done quickly, all in one place.
              </p>
            </Reveal>
            <Reveal delay={170}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  href="/start"
                  className="group inline-flex h-12 items-center gap-2 rounded-xl bg-royal px-6 text-[17px] font-semibold text-royal-fg shadow-raised transition-all hover:-translate-y-0.5 hover:bg-royal-hover hover:shadow-float"
                >
                  Get started
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/signin"
                  className="inline-flex h-12 items-center rounded-xl border border-border-2 px-6 text-[16px] font-semibold text-fg transition-colors hover:bg-surface-2"
                >
                  Log in
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="relative -mb-px aspect-[16/11] w-full lg:hidden">
          <Image
            src="/marketing/hero-day.jpg"
            alt="An illustrated lakeside neighborhood: white cottages on a green hill, a path winding between them down to the water"
            fill
            priority
            sizes="100vw"
            className="object-cover dark:hidden"
          />
          <Image
            src="/marketing/hero-night.jpg"
            alt=""
            fill
            sizes="100vw"
            className="hidden object-cover dark:block"
          />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-hero-field to-transparent" />
        </div>
      </section>

      {/* The strip along the bottom of slide one. The huddle called the navy
          band too dark against the white page, so in light mode it is a quiet
          gray with the blue carrying the icons and copy; dark keeps navy. */}
      <div className="border-y border-border bg-surface-2 text-accent dark:border-0 dark:bg-navy-800 dark:text-navy-50">
        <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-4 text-[14px] font-medium sm:justify-between">
          {ASSURANCES.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-accent dark:bg-white/10 dark:text-[#7dabf8]">
                <Icon className="size-4" strokeWidth={2} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Slide two. */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Run your HOA.
                <br />
                <span className="text-hero-accent">Not another job.</span>
              </h2>

            </Reveal>
            <Reveal delay={90}>
              <ul className="mt-6 divide-y divide-border">
                {BENEFITS.map((benefit) => (
                  <IconRow key={benefit.title} {...benefit} />
                ))}
              </ul>
              <Link
                href="/start"
                className="group mt-4 inline-flex h-12 items-center gap-2 rounded-xl bg-royal px-6 text-[17px] font-semibold text-royal-fg shadow-raised transition-all hover:-translate-y-0.5 hover:bg-royal-hover hover:shadow-float"
              >
                Get started today
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={160}>
            <MonitorFrame
              src="/marketing/product-dashboard.png"
              alt="The ExpressHOA board dashboard: money in and out by month, spending by category, cash on hand, and transactions waiting for review"
            />
          </Reveal>
        </div>
      </section>

      {/* Slide three. */}
      <section className="border-b border-border bg-hero-field">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Sound familiar?
              </h2>
              <p className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-hero-accent">
                Meet Greg.
              </p>
              <p className="mt-5 max-w-md text-[18px] leading-relaxed text-fg-muted">
                He just wanted to enjoy his home. Then someone asked him to join the HOA board.
                Suddenly, it felt like a second job.
              </p>
              <p className="mt-6 text-[19px] font-semibold tracking-[-0.015em] text-fg">
                ExpressHOA was built to change that.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <Link
                href="/start"
                className="group mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-royal px-6 text-[17px] font-semibold text-royal-fg shadow-raised transition-all hover:-translate-y-0.5 hover:bg-royal-hover hover:shadow-float"
              >
                Start today
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={160}>
            {/* A still, on purpose. The deck drew this as a video player, and
                Monish decided on 2026-08-28 that there is no video to make. A
                play button that opens nothing would say "mock-up". */}
            <div className="overflow-hidden rounded-[1.25rem] border border-border bg-navy-950 shadow-float">
              <Image
                src="/marketing/greg-story.jpg"
                alt="Greg at his kitchen table, head in hand, surrounded by binders and the things pulling at a new board member: endless emails, confusing spreadsheets, unhappy neighbors, vendor headaches, compliance confusion"
                width={1038}
                height={640}
                sizes="(max-width: 1024px) 100vw, 660px"
                className="h-auto w-full"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Slide four. */}
      <section id="features" className="scroll-mt-16 border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Built for the way HOA boards{" "}
                <span className="text-hero-accent">actually work.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-[18px] leading-relaxed text-fg-muted">
                Powerful tools for the things that matter most, so your community runs smoothly
                today and is prepared for tomorrow.
              </p>
            </div>
          </Reveal>

          {/* Five across on a wide screen. Under that they keep their width
              and scroll sideways, because five cards squeezed into three
              columns leaves two orphans on a second row and a card at 180px
              cannot hold a screen anyone can read. */}
          <div className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
            {FEATURES.map(({ icon: Icon, tone, title, body, href, mini }, index) => (
              <Reveal
                key={title}
                delay={index * 70}
                className="w-[284px] shrink-0 snap-start xl:w-auto"
              >
                <Card className="flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5">
                  <div className="flex flex-col items-center text-center">
                    <span
                      className={cn(
                        "flex size-14 items-center justify-center rounded-full",
                        tone,
                      )}
                    >
                      <Icon className="size-6" strokeWidth={1.9} />
                    </span>
                    <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-fg">
                      {title}
                    </h3>
                  </div>
                  <div className="mt-4">{mini}</div>
                  <p className="mt-4 flex-1 text-[14px] leading-relaxed text-fg-muted">{body}</p>
                  <Link
                    href={href}
                    className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline"
                  >
                    Learn more
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Card>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* Slide five. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-hero-field">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Your entire community.
                <br />
                <span className="text-hero-accent">In your pocket.</span>
              </h2>
              <p className="mt-5 max-w-md text-[18px] leading-relaxed text-fg-muted">
                ExpressHOA keeps you informed, connected, and in control from any phone.
                Anytime, anywhere.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <ul className="mt-4 divide-y divide-border">
                {POCKET.map((item) => (
                  <IconRow key={item.title} {...item} />
                ))}
              </ul>
              <p className="mt-2 text-[15px] text-fg-subtle">
                Works in any browser today. iPhone and Android apps are next.
              </p>
            </Reveal>
          </div>

          <div className="relative lg:min-h-[560px]">
            <Reveal delay={160}>
              <div className="lg:absolute lg:left-0 lg:top-0 lg:w-[296px]">
                <PhoneFrame
                  src="/marketing/product-resident.png"
                  alt="The resident app showing a balance due, a live board meeting, and open ballots"
                />
              </div>
            </Reveal>
            <Reveal delay={240}>
              <PocketNotices className="mt-8 grid gap-3 sm:grid-cols-2 lg:absolute lg:right-0 lg:top-6 lg:mt-0 lg:flex lg:w-[320px] lg:flex-col lg:gap-4" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* The price, in one line. The strip under the hero promises a free
          trial, and the next question is what comes after it. */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-12 sm:py-14">
          <Reveal>
            <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-fg sm:text-[32px]">
              One price. Every feature.
            </h2>
            <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-fg-muted">
              {money(PRICE_PER_HOME_CENTS)} per home per month after your {TRIAL_DAYS} free days.{" "}
              {money(PRICE_PER_TRANSACTION_CENTS)} per payment, any rail. No setup fee, no add-ons,
              cancel whenever.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-2 bg-surface px-5 text-[15px] font-semibold text-fg transition-colors hover:bg-surface-2"
            >
              See pricing
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
        {/* The rails, named. Set as quiet wordmarks rather than borrowed logo
            art, and only rails the product actually runs: the huddle said
            mirror PayHOA's row (Plaid, Stripe...), but Plaid was ruled out on
            2026-09-02, and a logo for a service we do not use is a lie. */}
        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-9 gap-y-2 px-5 py-5 sm:justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Payments run on
            </p>
            {["Stripe", "ACH", "Visa", "Mastercard", "Apple Pay", "Google Pay"].map((rail) => (
              <span
                key={rail}
                className="text-[17px] font-bold tracking-tight text-fg-subtle"
              >
                {rail}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Close. */}
      <section className="relative isolate overflow-hidden bg-navy-900 text-navy-50 dark:bg-navy-800">
        <Image src="/marketing/aerial.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/90"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-6xl px-5 py-24 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[36px] font-semibold leading-tight tracking-[-0.035em] sm:text-[48px]">
              Start today.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[18px] leading-relaxed text-navy-200">
              Set up your community in minutes. No card to start, {TRIAL_DAYS} days free, cancel
              whenever.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/start"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy-50 px-6 text-[16px] font-semibold text-navy-950 transition-transform hover:-translate-y-0.5"
              >
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-navy-50/30 px-6 text-[16px] font-semibold text-navy-50 transition-colors hover:bg-navy-50/10"
              >
                Log in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
