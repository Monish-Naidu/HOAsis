import Image from "next/image";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChartNoAxesColumn,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Headphones,
  Landmark,
  Lock,
  Repeat,
  ShieldCheck,
  Smartphone,
  Users,
  Video,
  Vote,
  Zap,
} from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Avatar, ButtonLink, Card, IconTile, type TintName } from "@/components/ui/primitives";
import {
  articleBySlug,
  association,
  libraryArticles,
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
import { PRICE_PER_HOME_CENTS, TRIAL_DAYS } from "@/lib/pricing";
import { cn, daysFromToday, formatDate, money, today } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";

export const metadata = {
  // Absolute: the root template would otherwise append " · Your HOAsis" to
  // a title that already ends in it.
  title: { absolute: "Your community. Your HOAsis." },
  description:
    "Everything your HOA needs to get things done quickly, all in one place. Set up in minutes, no card to start, and the first 90 days are free.",
};

/*
 * The page started as the deck Monish brought on 2026-08-28, slide for slide:
 * hero, "Run your HOA", Eric, the feature cards, the phone. The 2026-09-24
 * pass kept the slides and their words and changed the finish: one lit tile
 * per feature card and soft ones everywhere else, no hairlines between
 * sections, a flat browser frame around a readable capture, and one call to
 * action per section. `docs/design/landing-page.md` records the mapping.
 */

/**
 * The strip under the hero: four promises, each a promise the product keeps
 * today. A bare glyph in its tint rather than a tile, because four lit tiles
 * in a row under a lit hero read as a second hero.
 */
const ASSURANCES: { icon: typeof Zap; label: string; color: string }[] = [
  { icon: Zap, label: "Setup in minutes", color: "text-tint-amber" },
  { icon: CreditCard, label: "No card to start", color: "text-tint-blue" },
  { icon: CircleX, label: "Cancel whenever", color: "text-tint-coral" },
  { icon: Headphones, label: "Live support", color: "text-tint-teal" },
];

/**
 * Tints are recognition, assigned once per idea and kept everywhere the idea
 * appears: money is teal, time is amber, records are violet, talking is
 * blue. A visitor who reads this row and then the feature cards sees the
 * same colour on the same thing twice.
 */
const BENEFITS: { icon: typeof Clock; tint: TintName; title: string; body: string }[] = [
  {
    icon: Clock,
    tint: "amber",
    title: "Save time",
    body: "Automate everyday HOA tasks and cut the busywork.",
  },
  {
    icon: CircleDollarSign,
    tint: "teal",
    title: "Save money",
    body: "Professional tools without professional management fees.",
  },
  {
    icon: ShieldCheck,
    tint: "violet",
    title: "Keep every record",
    body: "Documents, decisions, and money in one place the next board inherits.",
  },
];

/**
 * The pocket section's four verbs. Each one is something the resident and
 * board screens do today: nothing here messages a vendor or calls one,
 * because the product does not.
 */
const POCKET: { icon: typeof Clock; tint: TintName; title: string; body: string }[] = [
  {
    icon: CircleCheck,
    tint: "teal",
    title: "Approve",
    body: "Requests, invoices, and documents on the go.",
  },
  {
    icon: Bell,
    tint: "coral",
    title: "Notify",
    body: "Send a notice to every home at once.",
  },
  {
    icon: CreditCard,
    tint: "blue",
    title: "Pay",
    body: "Dues by bank or card, or on autopay.",
  },
  {
    icon: CalendarDays,
    tint: "amber",
    title: "Meet",
    body: "Meetings, agendas, and ballots in one place.",
  },
];

/* -------------------------------------------------------------------------- */
/* Device frames                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard in a plain browser window.
 *
 * It sat in a silver desktop render until 2026-09-24. The render dated the
 * page, and at 820px the capture inside it was too small to read, which is
 * the one job a product shot has. A flat window at the full width of the
 * page shows the product at close to its real size, and a frame drawn in
 * tokens follows the theme for free. The capture swaps with the theme too:
 * `pnpm shots` takes a light and a dark one.
 *
 * On a phone the window keeps a 4:3 crop from the top left, where the rail
 * and the first cards are, rather than shrinking the whole desktop to a
 * thumbnail nobody can read.
 */
function BrowserFrame({
  light,
  dark,
  alt,
  width,
  height,
  url,
}: {
  light: string;
  dark: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}) {
  return (
    <div className="relative">
      {/* A pool of the brand under the window, so it sits on light rather
          than on a flat page. Inset, so it never reaches past the column. */}
      <div
        className="pointer-events-none absolute inset-x-[8%] -bottom-8 top-[12%] -z-10 rounded-[40%] bg-[radial-gradient(closest-side,rgb(63_130_242/0.22),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgb(77_139_245/0.3),transparent)]"
        aria-hidden
      />
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-float">
        <div className="relative flex h-9 items-center gap-1.5 border-b border-border bg-surface-2 px-3.5">
          <span className="size-2.5 rounded-full bg-border-2" />
          <span className="size-2.5 rounded-full bg-border-2" />
          <span className="size-2.5 rounded-full bg-border-2" />
          <span className="absolute left-1/2 top-1/2 hidden h-5 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-md bg-surface-3 px-3 text-[11px] font-medium text-fg-subtle sm:inline-flex">
            <Lock className="size-2.5" strokeWidth={2.5} />
            {url}
          </span>
        </div>
        <div className="relative aspect-[4/3] sm:aspect-auto">
          <Image
            src={light}
            alt={alt}
            width={width}
            height={height}
            sizes="(max-width: 1200px) 100vw, 1112px"
            className="h-full w-full object-cover object-left-top dark:hidden sm:h-auto"
          />
          <Image
            src={dark}
            alt={alt}
            width={width}
            height={height}
            sizes="(max-width: 1200px) 100vw, 1112px"
            className="hidden h-full w-full object-cover object-left-top dark:block sm:h-auto"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The phone photograph around the resident screenshot.
 *
 * The device leans, so the flat capture is mapped onto the screen with a
 * projective transform: the four screen corners were measured off the
 * photograph, and the matrix maps a 430x1030 rectangle onto that quad at a
 * 340px render width (docs/design/dash-2026-09-01 has the measurement notes).
 *
 * The frame is always laid out at 340 and sized with CSS `zoom`, which
 * scales layout, the photograph and the matrix together. It used to take a
 * width and scale the matrix to it, which fixed the phone at 500px and
 * pushed the section off the side of every phone narrower than that.
 */
const PHONE_WIDTH = 340;
const PHONE_MATRIX = [0.33193, -0.063114, -0.000153, -0.029395, 0.341345, -0.00008, 93.253766, 40.420067];

function PhoneFrame({
  light,
  dark,
  alt,
  className,
}: {
  light: string;
  dark: string;
  alt: string;
  className?: string;
}) {
  const [a, b, pa, c, d, pb, tx, ty] = PHONE_MATRIX;
  const transform = `matrix3d(${a}, ${b}, 0, ${pa}, ${c}, ${d}, 0, ${pb}, 0, 0, 1, 0, ${tx}, ${ty}, 0, 1)`;
  return (
    <div className={cn("relative mx-auto", className)} style={{ width: PHONE_WIDTH }}>
      <Image
        src="/marketing/device-phone.png"
        alt=""
        width={1086}
        height={1448}
        sizes="480px"
        className="h-auto w-full"
      />
      <div
        className="absolute left-0 top-0 h-[1030px] w-[430px] origin-top-left overflow-hidden rounded-[50px]"
        style={{ transform }}
      >
        <Image src={light} alt={alt} fill sizes="430px" className="object-cover object-top dark:hidden" />
        <Image src={dark} alt={alt} fill sizes="430px" className="hidden object-cover object-top dark:block" />
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
/* Slide four's tiles and their miniature screens                              */
/*                                                                             */
/* Each mini is drawn from the same records the demo runs on, so the tile and  */
/* the product a visitor opens next agree with each other. The tiles are not   */
/* links, and nothing inside them is: a visitor who clicks one wants that      */
/* feature, and every destination we had was the sign-in wall or a page about  */
/* something adjacent. The section's call to action is the one in the top bar. */
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "ok" ? "bg-ok-soft text-ok" : "bg-info-soft text-info",
      )}
    >
      <span className="size-1 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

function ComplianceMini() {
  const update = articleBySlug("washington-recent-changes");
  return (
    <Mini>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg">Washington updates</p>
        <Pill tone="ok">New</Pill>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-fg-muted">
        {update?.summary ?? "Bill numbers and effective dates, in plain words."}
      </p>
      {update ? (
        <p className="tnum mt-2 text-[11px] text-fg-subtle">
          {update.readMinutes} min read · {formatDate(update.publishedDate)}
        </p>
      ) : null}
    </Mini>
  );
}

function Ring({ percent }: { percent: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-14 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-surface-3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        className="stroke-tint-teal"
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
          <p className="text-[12px] font-medium text-fg-muted">Reserve health</p>
          <p className="tnum mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-fg">
            {percent}%
          </p>
          <p className={cn("mt-1 text-[12px] font-semibold", onTrack ? "text-ok" : "text-warn")}>
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
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-fg">{component.name.split(",")[0]}</span>
                <span className="tnum shrink-0 text-fg-muted">
                  {year + component.remainingLifeYears} · {funded}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
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
    <Mini className="p-2.5">
      <ul className="divide-y divide-border">
        {vendors.slice(0, 3).map((vendor) => {
          const active =
            vendor.w9OnFile && (!vendor.coiExpires || daysFromToday(vendor.coiExpires) >= 0);
          return (
            <li key={vendor.id} className="px-1 py-2">
              <p className="truncate text-[12px] font-semibold leading-tight text-fg">
                {vendor.name}
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-[11px] text-fg-muted">{vendor.service}</p>
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
 * The rails on the demo association's own dues, priced by the same
 * computePaymentCost the product runs, so the tile and the pay screen agree.
 */
function PaymentsMini() {
  const policy = {
    flatCents: communitySettings.paymentFeeCents,
    paidBy: communitySettings.paymentFeePaidBy,
    waiveOnAch: communitySettings.paymentFeeWaivedOnAch,
  };
  const dues = association.duesCents;
  return (
    <Mini className="p-2.5">
      <ul className="divide-y divide-border">
        {(
          [
            { kind: "ach", label: "Bank transfer" },
            { kind: "card", label: "Card" },
          ] as const
        ).map(({ kind, label }) => {
          const cost = computePaymentCost(kind, dues, policy);
          return (
            <li key={kind} className="px-1 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="whitespace-nowrap text-[12px] font-semibold text-fg">{label}</p>
                <span className="tnum text-[12px] text-fg-muted">
                  {money(cost.residentPaysCents)}
                </span>
              </div>
              <div className="mt-0.5 flex items-start justify-between gap-2">
                {/* The schedule's own words, minus the hedge: "About 4
                    business days" and the pill do not share a 220px row. */}
                <p className="min-w-0 text-[11px] leading-snug text-fg-muted">
                  {FEE_SCHEDULE[kind].settlement.replace(/^About /, "")}
                </p>
                {/* Under a flat owner fee both rails cost the owner the same;
                    the saving lands on the association, and the pay screen
                    says so in the same words. */}
                {kind === "ach" ? <Pill tone="ok">Saves the HOA</Pill> : null}
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-2 px-1 py-2">
          <p className="text-[12px] font-semibold text-fg">Autopay</p>
          <Pill tone="info">On the 1st</Pill>
        </li>
      </ul>
    </Mini>
  );
}

/** Three guides from the library, the ones a new board reaches for first. */
function GuidesMini() {
  const guides = ["first-90-days-on-a-board", "reading-an-hoa-budget", "running-a-board-meeting"]
    .map((slug) => libraryArticles.find((article) => article.slug === slug))
    .filter((article) => article !== undefined);
  return (
    <Mini className="p-2.5">
      <ul className="divide-y divide-border">
        {guides.map((guide) => (
          <li key={guide.slug} className="px-1 py-2">
            <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-fg">{guide.title}</p>
            <p className="tnum mt-0.5 text-[11px] text-fg-muted">{guide.readMinutes} min read</p>
          </li>
        ))}
      </ul>
    </Mini>
  );
}

/**
 * Everything the four cards leave out, as one wrapped row of chips. It was
 * six 128px cells of lit tiles, which gave the footnote more weight than the
 * features above it. Each chip keeps its idea's tint on the glyph.
 */
const EVERYTHING_ELSE: { label: string; icon: typeof Bell; color: string }[] = [
  { label: "Notices", icon: Bell, color: "text-tint-coral" },
  { label: "Architectural requests", icon: ClipboardCheck, color: "text-tint-blue" },
  { label: "Homeowner directory", icon: Users, color: "text-tint-blue" },
  { label: "Documents", icon: FileText, color: "text-tint-violet" },
  { label: "Meetings", icon: CalendarDays, color: "text-tint-amber" },
  { label: "Voting", icon: Vote, color: "text-tint-violet" },
];

/**
 * In the order Monish set on 2026-09-20: the things boards hurt over most,
 * money first, then vendors, then reserves. Compliance takes the fourth card
 * once the module is on; until then it is the library's guides, which is
 * where those answers live today. It is not called a knowledge center,
 * because there is no such screen.
 */
const FEATURES = [
  {
    icon: CreditCard,
    tint: "blue" as TintName,
    title: "Payments & dues",
    line: "Collected, posted, reconciled.",
    mini: <PaymentsMini />,
  },
  {
    icon: Briefcase,
    tint: "amber" as TintName,
    title: "Vendor management",
    line: "Contracts and invoices, one place.",
    mini: <VendorMini />,
  },
  {
    icon: ChartNoAxesColumn,
    tint: "teal" as TintName,
    title: "Reserve tracking",
    line: "Know if you're on track.",
    mini: <ReserveMini />,
  },
  moduleOn("compliance")
    ? {
        icon: ShieldCheck,
        tint: "violet" as TintName,
        title: "Compliance updates",
        line: "Stay ahead of changing laws.",
        mini: <ComplianceMini />,
      }
    : {
        icon: BookOpen,
        tint: "violet" as TintName,
        title: "Board guides",
        line: "Plain answers for every board job.",
        mini: <GuidesMini />,
      },
];

/** The rails a payment actually runs on, named plainly. */
const RAILS: { icon: typeof Landmark; label: string }[] = [
  { icon: Landmark, label: "Bank transfer" },
  { icon: CreditCard, label: "Credit and debit" },
  { icon: Smartphone, label: "Apple Pay" },
  { icon: Repeat, label: "Autopay" },
];

/* -------------------------------------------------------------------------- */
/* The cards floating beside the phone                                         */
/* -------------------------------------------------------------------------- */

function Notice({
  icon,
  tint,
  title,
  body,
  children,
  className,
}: {
  icon: typeof Bell;
  tint: TintName;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface/95 p-3.5 shadow-float backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tint={tint} size="sm" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight text-fg">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * `itemClassNames` places each card on its own, in order, for the layout
 * that hangs them around the phone; a missing card keeps the others' slots.
 * Every card is derived from a demo record, so it says something the
 * product can back up.
 */
/** Three neighbours in three tints, so the stack reads as three people. */
const AVATAR_TINTS = [
  "bg-tint-blue-soft text-tint-blue-fg",
  "bg-tint-teal-soft text-tint-teal-fg",
  "bg-tint-violet-soft text-tint-violet-fg",
];

function PocketNotices({
  className,
  itemClassNames = [],
}: {
  className?: string;
  itemClassNames?: string[];
}) {
  const request = openRequests()[0];
  const coi = vendorGaps().expiringCoi[0];
  const next = upcomingMeetings().find((meeting) => meeting.status !== "live");
  const live = liveMeeting();

  return (
    <div className={className} aria-hidden>
      {request ? (
        <Notice
          icon={ClipboardCheck}
          tint="blue"
          title={`New ${request.kind} request`}
          body={`Unit ${request.unit}`}
          className={itemClassNames[0]}
        />
      ) : null}
      {coi ? (
        <Notice
          icon={ShieldCheck}
          tint="amber"
          title={`Vendor COI expires in ${daysFromToday(coi.coiExpires!)} days`}
          body={coi.name}
          className={itemClassNames[1]}
        />
      ) : null}
      {next ? (
        <Notice
          icon={CalendarDays}
          tint="violet"
          title="Board meeting"
          body={`${formatDate(next.date)} at ${next.time}, ${next.location}`}
          className={itemClassNames[2]}
        />
      ) : null}
      {live ? (
        <Notice
          icon={Video}
          tint="coral"
          title="The board meeting is live"
          body={`${live.attendees.length} neighbors joined`}
          className={itemClassNames[3]}
        >
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex -space-x-1">
              {live.attendees.slice(0, 3).map((person, i) => (
                <Avatar
                  key={person.name}
                  name={person.name}
                  className={cn("size-7 text-[10px] ring-2 ring-surface", AVATAR_TINTS[i])}
                />
              ))}
            </div>
            <span className="inline-flex h-8 items-center rounded-lg bg-brand-gradient px-3.5 text-[13px] font-semibold text-primary-fg">
              Join
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

/** The headline scale every section below the hero shares. */
const H2 =
  "text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]";
/** Lead copy under a section headline: 17px on a phone, 19 from a tablet up. */
const LEAD = "text-[17px] leading-relaxed text-fg-muted sm:text-[19px]";

/**
 * A soft wash of the brand behind a section, dissolved at the top and the
 * bottom so there is no edge where it starts. It replaces the full-bleed
 * field and the hairline that used to mark every section change.
 */
function Wash({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 bg-aurora [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]",
        className,
      )}
      aria-hidden
    />
  );
}

function Benefit({
  icon,
  tint,
  title,
  body,
}: {
  icon: typeof Clock;
  tint: TintName;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3.5">
      <IconTile icon={icon} tint={tint} size="md" />
      <div>
        <p className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{title}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{body}</p>
      </div>
    </li>
  );
}

/** The pocket section's four verbs: a 2x2 of quiet tiles, rows on a phone. */
function PocketTile({
  icon,
  tint,
  title,
  body,
}: {
  icon: typeof Clock;
  tint: TintName;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-card sm:block">
      <IconTile icon={icon} tint={tint} size="sm" />
      <div>
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-fg sm:mt-3">{title}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-fg-muted">{body}</p>
      </div>
    </li>
  );
}

/**
 * Callouts pinned on the hero picture, each above the home it is about with
 * a line down to its roof, the way a map labels a place. Drawn from the
 * demo's own records so they say something the product can back up.
 *
 * `x` and `y` are the roof point as a percentage of the picture, which keeps
 * the pin on the house at every size because the picture's box holds its
 * aspect. `lineAt` is where along the card's width the line drops, so a card
 * at the picture's edge can hang left of its pin.
 */
function HeroChip({
  icon,
  tint,
  title,
  body,
  x,
  y,
  lineAt = 50,
  delay,
}: {
  icon: typeof Bell;
  tint: TintName;
  title: string;
  body: string;
  x: number;
  y: number;
  lineAt?: number;
  delay: number;
}) {
  return (
    <div
      className="pointer-events-none absolute w-max"
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-${lineAt}%, -100%)` }}
      aria-hidden
    >
      <div className="land" style={{ "--land-delay": `${delay}ms` } as React.CSSProperties}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/50 bg-surface/90 p-2.5 pr-4 shadow-float backdrop-blur-md dark:border-white/10">
          <IconTile icon={icon} tint={tint} size="md" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-fg">{title}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{body}</p>
          </div>
        </div>
        {/* The line down to the roof, and the point where it lands. */}
        <div className="relative h-8">
          <div
            className="absolute top-0 h-full w-px bg-white shadow-[0_0_4px_rgb(0_0_0/0.35)]"
            style={{ left: `${lineAt}%` }}
          />
          <div
            className="absolute bottom-0 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_3px_rgb(255_255_255/0.35)]"
            style={{ left: `${lineAt}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function HeroChips() {
  const request = openRequests()[0];
  const meeting = upcomingMeetings().find((m) => m.status !== "live");
  // The demo association's own dues, priced by the same computePaymentCost
  // the pay screen runs, so the chip and the product agree to the cent.
  const ach = computePaymentCost("ach", association.duesCents, {
    flatCents: communitySettings.paymentFeeCents,
    paidBy: communitySettings.paymentFeePaidBy,
    waiveOnAch: communitySettings.paymentFeeWaivedOnAch,
  });
  const kind = request ? request.kind.charAt(0).toUpperCase() + request.kind.slice(1) : "";
  return (
    <>
      {/* The home on the left of the ring. */}
      <HeroChip
        icon={CircleDollarSign}
        tint="teal"
        title={`Dues paid, ${money(ach.residentPaysCents)}`}
        body={ach.platformCents === 0 ? "Bank transfer, no fee" : "Bank transfer, posted today"}
        x={50}
        y={31.5}
        delay={520}
      />
      {/* The house on the island, the one the whole picture is about. */}
      {meeting ? (
        <HeroChip
          icon={CalendarDays}
          tint="violet"
          title="Board meeting"
          body={`${formatDate(meeting.date)} · ${meeting.location}`}
          x={71.5}
          y={44.8}
          delay={720}
        />
      ) : null}
      {/* The home on the right of the ring, at the picture's edge. */}
      {request ? (
        <HeroChip
          icon={ClipboardCheck}
          tint="blue"
          title={`${kind} request approved`}
          body={`Unit ${request.unit} · from your phone`}
          x={93.6}
          y={32}
          lineAt={82}
          delay={920}
        />
      ) : null}
    </>
  );
}

export default function MarketingHome() {
  return (
    // Clipped sideways at the root: a glow or a hung card that reaches past
    // the column must never make the page scroll left and right on a phone.
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <MarketingHeader />

      {/* Hero. The header sits on this field with no bar of its own, which
          is why the section starts at the top of the page and the copy
          carries the top padding. The field fades into the page at its foot
          instead of stopping at a line. */}
      <section className="relative isolate -mt-[69px] overflow-hidden bg-[linear-gradient(to_bottom,var(--hero-field)_0%,var(--hero-field)_78%,var(--bg)_100%)] pt-[69px]">
        {/* A soft aurora behind the headline column, so the left half of
            the hero is not a flat wash next to a lit picture. */}
        <div className="pointer-events-none absolute inset-0 -z-20 bg-aurora" aria-hidden />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden aspect-[1672/941] lg:block"
          aria-hidden
        >
          {/* The oasis: homes on a ring road around a lake, one lit house on
              the island in the middle. Monish's own pair from 2026-09-20, a
              day render for the light theme and a night one for the dark,
              each already fading out on its left. The box holds the
              picture's aspect and takes its height from the hero, so the
              whole ring is always in frame and never cropped or zoomed; the
              callouts are pinned in picture percentages for the same reason.

              A short mask on the left finishes the picture's own fade into
              the field, and one at the foot dissolves it into the page. */}
          <div className="absolute inset-0 [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent_0%,black_26%),linear-gradient(to_bottom,transparent_0%,black_10%,black_80%,transparent_100%)] [-webkit-mask-composite:source-in]">
            <Image
              src="/marketing/hero-oasis-light.jpg"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 1320px, 100vw"
              className="object-cover dark:hidden"
            />
            <Image
              src="/marketing/hero-oasis-dark.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 1320px, 100vw"
              className="hidden object-cover dark:block"
            />
          </div>
          <HeroChips />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-12 sm:pt-20 lg:grid lg:min-h-[clamp(36rem,50vw,46rem)] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-center lg:pb-20 lg:pt-12">
          <div className="lg:pr-6">
            <Reveal>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 py-1 pl-2.5 pr-3.5 text-[13px] font-medium text-fg-muted shadow-card backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-ok" aria-hidden />
                {TRIAL_DAYS} days free. No card to start.
              </p>
              <h1 className="text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] text-fg min-[400px]:text-[50px] sm:text-[64px]">
                Your community.
                <br />
                <span className="text-gradient">Your HOAsis.</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              {/* Full ink and a halo of the field colour behind it: muted gray
                  at this size sank into the picture's fade on both themes. */}
              <p className="mt-6 max-w-md text-[18px] leading-relaxed text-fg [text-shadow:0_0_24px_var(--hero-field),0_0_8px_var(--hero-field)] sm:text-[20px]">
                Everything your HOA needs to get things done quickly, all in one place.
              </p>
            </Reveal>
            <Reveal delay={170}>
              {/* Stacked full width on a phone, where the pair cannot share a row. */}
              <div className="mt-8 grid gap-3 min-[440px]:flex min-[440px]:flex-wrap min-[440px]:items-center">
                <ButtonLink href="/start" variant="hero" size="xl" className="group">
                  Get started
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </ButtonLink>
                {/* The sample community, not the sign-in form: the nav
                    already has "Log in", and a visitor weighing us wants to
                    see the product, not a password field. */}
                <ButtonLink
                  href="/signin#sample"
                  variant="secondary"
                  size="xl"
                  className="bg-surface/70 font-semibold backdrop-blur-sm"
                >
                  See how it works
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="relative aspect-[1672/941] w-full [mask-image:linear-gradient(to_bottom,transparent_0%,black_22%,black_80%,transparent_100%)] lg:hidden">
          <Image
            src="/marketing/hero-oasis-light.jpg"
            alt="An illustrated neighborhood: homes on a ring road around a lake, with one lit house on the island in the middle"
            fill
            priority
            sizes="100vw"
            className="object-cover dark:hidden"
          />
          <Image
            src="/marketing/hero-oasis-dark.jpg"
            alt="The same neighborhood at night, every window lit"
            fill
            sizes="100vw"
            className="hidden object-cover dark:block"
          />
        </div>
      </section>

      {/* The four promises, straight on the page. One column under 360px,
          where half a phone cannot hold "Setup in minutes" on one line. */}
      <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-x-4 gap-y-3 px-5 pb-4 pt-2 text-[15px] font-medium text-fg min-[360px]:grid-cols-2 sm:grid-cols-4 sm:text-[16px] lg:-mt-6">
        {ASSURANCES.map(({ icon: Icon, label, color }, index) => (
          <li key={label}>
            <Reveal delay={index * 70} className="flex items-center gap-2.5 sm:justify-center">
              <Icon className={cn("size-[18px] shrink-0", color)} strokeWidth={2.2} aria-hidden />
              {label}
            </Reveal>
          </li>
        ))}
      </ul>

      {/* Slide two, now the product's own stage: the headline, the real
          dashboard at the full width of the page, and the three reasons
          under it. */}
      <section className="relative isolate">
        <div className="mx-auto w-full max-w-6xl px-5 pb-4 pt-20 sm:pt-24">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className={H2}>
                Run your HOA.{" "}
                <span className="text-gradient">Not another job.</span>
              </h2>
              <p className={cn(LEAD, "mx-auto mt-5 max-w-xl")}>
                One place for the money, the homes, and the paperwork. For single-family homes,
                townhomes, condos, or a mix.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120} className="mt-12 sm:mt-14">
            <BrowserFrame
              light="/marketing/product-dashboard.png"
              dark="/marketing/product-dashboard-dark.png"
              width={2560}
              height={1600}
              url="yourhoasis.com/board"
              alt="The Your HOAsis board dashboard: what needs the board today, money in and out by month, and the association's balances"
            />
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {BENEFITS.map((benefit) => (
                <Benefit key={benefit.title} {...benefit} />
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Slide three. */}
      <section className="relative isolate">
        <Wash />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Reveal>
              <h2 className={H2}>
                Sound familiar?
                <br />
                <span className="text-gradient">Meet Eric.</span>
              </h2>
              <p className={cn(LEAD, "mt-5 max-w-md")}>
                He just wanted to enjoy his home. Then someone asked him to join the HOA board.
                Suddenly, it felt like a second job.
              </p>
              <p className="mt-5 text-[17px] font-semibold tracking-[-0.015em] text-fg sm:text-[19px]">
                Your HOAsis was built to change that.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <ButtonLink href="/start" variant="hero" size="xl" className="group mt-8">
                Start today
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
            </Reveal>
          </div>
          <Reveal delay={160}>
            {/* A photograph, on purpose. The deck drew this as a video player
                and Monish decided on 2026-08-28 that there is no video to make.
                On 2026-09-03 the slide's render gave way to a real photo of a
                real person, because a render reads as fake to exactly the
                people we are asking to trust us. */}
            <div className="overflow-hidden rounded-2xl border border-border bg-navy-950 shadow-float">
              <Image
                src="/marketing/eric-story.jpg"
                alt="Eric at his kitchen table in a tan overshirt, glasses set down, one hand at his temple, a laptop, a notebook and a spread of printed reports in front of him"
                width={1400}
                height={933}
                sizes="(max-width: 1024px) 100vw, 660px"
                className="h-auto w-full"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Slide four. */}
      <section id="features" className="relative isolate scroll-mt-16">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className={H2}>
                Built for the way HOA boards{" "}
                <span className="text-gradient">actually work.</span>
              </h2>
              <p className={cn(LEAD, "mx-auto mt-5 max-w-xl")}>
                The things boards lose sleep over, handled first.
              </p>
            </div>
          </Reveal>

          {/* Four across from a laptop width up. Under that they keep their
              width and scroll sideways, because a card at 180px cannot hold
              a screen anyone can read. From a laptop up the four stand at one
              height, so the row reads as a set. The one place on the page a
              tile is lit. */}
          <div className="no-scrollbar -mx-5 mt-14 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-5 pb-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:items-stretch lg:overflow-visible lg:px-0">
            {FEATURES.map(({ icon, tint, title, line, mini }, index) => (
              <Reveal
                key={title}
                delay={index * 80}
                className="w-[280px] shrink-0 snap-start lg:w-auto [&>*]:h-full"
              >
                <Card className="lift p-5">
                  <IconTile icon={icon} tint={tint} variant="solid" size="lg" />
                  <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-fg">
                    {title}
                  </h3>
                  <p className="mt-0.5 text-[15px] leading-snug text-fg-muted">{line}</p>
                  <div className="mt-5">{mini}</div>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-10 text-center">
              <p className="text-[15px] font-semibold text-fg">And everything else, on the same one rate</p>
              <ul className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2">
                {EVERYTHING_ELSE.map(({ label, icon: Icon, color }) => (
                  <li
                    key={label}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[14px] font-medium text-fg shadow-card"
                  >
                    <Icon className={cn("size-4 shrink-0", color)} strokeWidth={2.2} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Slide five. One column on a phone, the phone under the copy; from
          a laptop up the four cards hang around the phone, two a side, their
          inner edges over the device the way notifications sit over a lock
          screen. minmax(0,1fr) so the phone can never widen the column. */}
      <section className="relative isolate">
        <Wash />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-10">
          <div>
            <Reveal>
              <h2 className={H2}>
                Your entire community.
                <br />
                <span className="text-gradient">In your pocket.</span>
              </h2>
              <p className={cn(LEAD, "mt-5 max-w-md")}>
                For the board and every homeowner, from any phone.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {POCKET.map((item) => (
                  <PocketTile key={item.title} {...item} />
                ))}
              </ul>
              <p className="mt-4 text-[14px] text-fg-subtle">
                Works in any browser today. iPhone and Android apps are next.
              </p>
            </Reveal>
          </div>

          <div className="relative min-w-0 lg:min-h-[640px]">
            <Reveal delay={160}>
              <div className="lg:absolute lg:left-1/2 lg:top-0 lg:-translate-x-1/2">
                <PhoneFrame
                  light="/marketing/product-resident.png"
                  dark="/marketing/product-resident-dark.png"
                  alt="The resident app showing a balance due, a live board meeting, and open ballots"
                  className="[zoom:0.8] min-[360px]:[zoom:1] sm:[zoom:1.15] lg:[zoom:1.4]"
                />
              </div>
            </Reveal>
            <Reveal delay={240} className="lg:absolute lg:inset-0 lg:z-10">
              <PocketNotices
                className="mt-8 grid gap-3 sm:grid-cols-2 lg:contents"
                itemClassNames={[
                  "lg:absolute lg:left-0 lg:top-[14%] lg:w-[236px]",
                  "lg:absolute lg:left-0 lg:top-[58%] lg:w-[236px]",
                  "lg:absolute lg:right-0 lg:top-[30%] lg:w-[236px]",
                  "lg:absolute lg:right-0 lg:top-[66%] lg:w-[236px]",
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* The price, in one card. The strip under the hero promises a free
          trial, and the next question is what comes after it. No payment
          fee here: that is on every receipt, where a board reads it. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:pb-20">
        <Reveal>
          <Card className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div>
                <p className="tnum text-gradient text-[44px] font-semibold leading-none tracking-[-0.04em]">
                  {money(PRICE_PER_HOME_CENTS)}
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-fg-muted">per home, per month</p>
              </div>
              <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
                <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-fg sm:text-[26px]">
                  One price. Every feature.
                </h2>
                <p className="mt-1 max-w-md text-[15px] leading-relaxed text-fg-muted sm:text-[17px]">
                  After your {TRIAL_DAYS} free days. No setup fee, no add-ons.
                </p>
              </div>
            </div>
            <ButtonLink href="/pricing" variant="secondary" size="lg" className="group shrink-0 self-start lg:self-auto">
              See pricing
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Card>
        </Reveal>
        {/* The rails, named, with plain glyphs rather than borrowed logo
            art, and only rails the product actually runs: Plaid was ruled
            out on 2026-09-02, and a logo for a service we do not use is a
            lie. */}
        <Reveal delay={80}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[14px] font-medium text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4" strokeWidth={2.2} aria-hidden />
              Payments by Stripe
            </span>
            {RAILS.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex h-5 items-center gap-1.5">
                <Icon className="size-4" strokeWidth={2.2} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Close. An inset navy stage rather than a full-bleed band, so it
          ends the page without a seam against the footer. Navy in both
          themes: a fixed surface. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-navy-950 px-6 py-20 ring-1 ring-inset ring-white/5 text-center text-navy-50 sm:py-24">
          <Image src="/marketing/aerial.jpg" alt="" fill sizes="(max-width: 1200px) 100vw, 1112px" className="-z-30 object-cover" />
          <div
            className="absolute inset-0 -z-20 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/90"
            aria-hidden
          />
          {/* Two pools of colour on the navy, so the band glows rather than
              sits: blue low left, violet high right. */}
          <div
            className="pointer-events-none absolute -bottom-40 -left-24 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(63_130_242/0.45),transparent)] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 -top-40 -z-10 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(143_118_255/0.4),transparent)] blur-3xl"
            aria-hidden
          />
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[52px]">
              Fast for the board.
              <br />
              <span className="bg-gradient-to-r from-[#8fb6ff] via-[#b7a6ff] to-[#6fe0bd] bg-clip-text text-transparent">
                Calm for the neighborhood.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-navy-200 sm:text-[19px]">
              Set up in minutes. {TRIAL_DAYS} days free, no card to start.
            </p>
            <ButtonLink href="/start" variant="hero" size="xl" className="group mt-9">
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
