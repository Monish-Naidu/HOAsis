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
import { Avatar, Card, IconTile, type TintName } from "@/components/ui/primitives";
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
import { moduleOn } from "@/lib/modules";

export const metadata = {
  title: "Your HOAsis. Moving your community forward.",
  description:
    "Everything your HOA needs to get things done quickly, all in one place. Set up in minutes, no card to start, and the first 90 days are free.",
};

/*
 * The page follows the deck Monish brought on 2026-08-28, slide for slide:
 * hero, "Run your HOA", Eric, the five feature cards, the phone. Copy is the
 * deck's, with em dashes replaced. `docs/design/landing-page.md` records the
 * mapping and the few places this departs from the slides.
 */

/**
 * The strip under the hero, from the 2026-09-01 brand concept: four promises
 * with icons. Every item is a promise the product keeps today; the free trial
 * moved to the pricing line, where the question it answers is asked.
 */
const ASSURANCES: { icon: typeof Zap; label: string; tint: TintName }[] = [
  { icon: Zap, label: "Setup in Minutes", tint: "amber" },
  { icon: CreditCard, label: "No Card to Start", tint: "blue" },
  { icon: CircleX, label: "Cancel Whenever", tint: "coral" },
  { icon: Headphones, label: "Live Support", tint: "teal" },
];

/**
 * Tints are recognition, assigned once per idea and kept everywhere the idea
 * appears: money is teal, time is amber, records are violet, talking is
 * blue, video is coral. A visitor who reads the strip and then the feature
 * cards sees the same colour on the same thing twice.
 */
const BENEFITS: { icon: typeof Clock; tint: TintName; title: string; body: string }[] = [
  {
    icon: Clock,
    tint: "amber",
    title: "Save time",
    body: "Automate everyday HOA tasks and reduce busywork.",
  },
  {
    icon: CircleDollarSign,
    tint: "teal",
    title: "Save money",
    body: "Get professional tools without professional management fees.",
  },
  {
    icon: ShieldCheck,
    tint: "violet",
    title: "Keep every record",
    body: "Documents, decisions, and money in one place the next board inherits.",
  },
];

const POCKET: { icon: typeof Clock; tint: TintName; title: string; body: string }[] = [
  {
    icon: CircleCheck,
    tint: "teal",
    title: "Approve",
    body: "Review requests, invoices, and documents on the go.",
  },
  {
    icon: MessagesSquare,
    tint: "blue",
    title: "Communicate",
    body: "Message homeowners and vendors instantly.",
  },
  {
    icon: Bell,
    tint: "amber",
    title: "Stay informed",
    body: "Get real-time updates on what matters most.",
  },
  {
    icon: Video,
    tint: "coral",
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
    <div className="tilt-stage relative mx-auto w-full max-w-[680px]">
      {/* The glow the screen throws on the desk. */}
      <div
        className="pointer-events-none absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[40%] bg-[radial-gradient(closest-side,rgb(63_130_242/0.22),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgb(77_139_245/0.28),transparent)]"
        aria-hidden
      />
      {/* Studio Display proportions, silver finish: all screen, a thin
          aluminum rim, no chin. The true product's near-black glass face is
          exactly what the huddle killed for disappearing on the dark theme,
          so the rim stays aluminum. */}
      <div className="tilt relative rounded-[clamp(8px,1.6vw,14px)] bg-gradient-to-b from-[#eceef0] via-[#d7dade] to-[#bcc1c7] p-[clamp(5px,1vw,8px)] shadow-[0_30px_70px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/20 dark:shadow-[0_30px_70px_-20px_rgb(0_0_0/0.85)]">
        {/* The machined edge, caught by the light along the top. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[clamp(8px,1.6vw,14px)] ring-1 ring-inset ring-white/60"
          aria-hidden
        />
        {/* A whisper of black glass between aluminum and picture. */}
        <div className="overflow-hidden rounded-[clamp(4px,0.8vw,7px)] bg-black p-[2px]">
          <div className="overflow-hidden rounded-[clamp(3px,0.6vw,5px)] bg-surface">
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
      </div>
      {/* The stand: a slim arm and a low rounded foot, edge on. */}
      <div
        className="mx-auto h-[clamp(38px,7.5vw,58px)] w-[clamp(48px,9vw,68px)] rounded-b-[3px] bg-gradient-to-b from-[#c4c8cd] via-[#dcdfe3] to-[#adb2b9] shadow-[inset_1px_0_1px_rgb(255_255_255/0.5),inset_-1px_0_1px_rgb(0_0_0/0.12)]"
        aria-hidden
      />
      <div
        className="mx-auto h-[7px] w-[clamp(130px,28vw,190px)] rounded-full bg-gradient-to-b from-[#e6e8eb] to-[#9ba0a6]"
        aria-hidden
      />
      {/* The ground it sits on. */}
      <div
        className="mx-auto -mt-1 h-4 w-[64%] rounded-[100%] bg-black/20 blur-lg dark:bg-black/50"
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
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
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
        <p className="text-[12px] font-semibold text-fg">Washington updates</p>
        <Pill tone="ok">New</Pill>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-fg-muted">
        {update?.summary ?? "Bill numbers and effective dates, in plain words."}
      </p>
      {update ? (
        <p className="tnum mt-2 text-[10px] text-fg-subtle">
          {update.readMinutes} min read · {formatDate(update.publishedDate)}
        </p>
      ) : null}
    </Mini>
  );
}

/** Two notices the way the board sees them: one waiting, one the owner says is fixed. */
function NoticesMini() {
  const rows = [
    { home: "Unit 14", what: "Trash cans out front", state: "Owner says fixed", tone: "ok" as const },
    { home: "Unit 3", what: "Fence paint peeling", state: "Sent 4 days ago", tone: "info" as const },
  ];
  return (
    <Mini>
      <p className="text-[12px] font-semibold text-fg">Open notices</p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.home} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-medium text-fg">{row.home}</span>
              <span className="block truncate text-[11px] text-fg-muted">{row.what}</span>
            </span>
            <Pill tone={row.tone}>{row.state}</Pill>
          </li>
        ))}
      </ul>
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

/** Everything the four tiles leave out, as one strip under them. */
const EVERYTHING_ELSE = [
  "Notices",
  "Architectural requests",
  "Documents",
  "Communication",
  "Meetings",
  "Voting",
  "Knowledge center",
];

const FEATURES = [
  // Compliance leads only while that module is on; until then the first
  // tile is the thing every board does in month one.
  moduleOn("compliance")
    ? {
        icon: ShieldCheck,
        tint: "violet" as TintName,
        title: "Compliance updates",
        line: "Stay ahead of changing laws.",
        mini: <ComplianceMini />,
      }
    : {
        icon: ClipboardCheck,
        tint: "coral" as TintName,
        title: "Notices",
        line: "Send one, and see it fixed.",
        mini: <NoticesMini />,
      },
  {
    icon: ChartNoAxesColumn,
    tint: "teal" as TintName,
    title: "Reserve tracking",
    line: "Know if you're on track.",
    mini: <ReserveMini />,
  },
  {
    icon: Briefcase,
    tint: "amber" as TintName,
    title: "Vendor management",
    line: "Contracts and invoices, one place.",
    mini: <VendorMini />,
  },
  {
    icon: CreditCard,
    tint: "blue" as TintName,
    title: "Payments & dues",
    line: "Collected, posted, reconciled.",
    mini: <PaymentsMini />,
  },
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
        "lift rounded-2xl border border-border bg-surface p-3.5 shadow-float",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tint={tint} variant="solid" size="sm" />
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
          tint="blue"
          title={`New ${request.kind} request`}
          body={`Unit ${request.unit}`}
        />
      ) : null}
      {coi ? (
        <Notice
          icon={ShieldCheck}
          tint="amber"
          title={`Vendor COI expires in ${daysFromToday(coi.coiExpires!)} days`}
          body={coi.name}
        />
      ) : null}
      {next ? (
        <Notice
          icon={CalendarDays}
          tint="violet"
          title="Board meeting"
          body={`${formatDate(next.date)} at ${next.time}, ${next.location}`}
        />
      ) : null}
      {live ? (
        <Notice
          icon={Video}
          tint="coral"
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
            <span className="inline-flex h-8 items-center rounded-lg bg-brand-gradient px-3.5 text-[13px] font-semibold text-primary-fg shadow-raised">
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
    <li className="flex items-start gap-4 py-5">
      <IconTile icon={icon} tint={tint} variant="solid" size="xl" ring />
      <div>
        <p className="text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</p>
        <p className="mt-1 text-[16px] leading-relaxed text-fg-muted">{body}</p>
      </div>
    </li>
  );
}

/**
 * The pocket section's four verbs, as a 2x2 of bordered tiles rather than a
 * third icon list down the page. Same words, a third of the height.
 */
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
    <li className="lift rounded-2xl border border-border bg-surface p-4 shadow-card">
      <IconTile icon={icon} tint={tint} variant="solid" size="md" />
      <p className="mt-3 text-[16px] font-semibold tracking-[-0.015em] text-fg">{title}</p>
      <p className="mt-0.5 text-[14px] leading-snug text-fg-muted">{body}</p>
    </li>
  );
}

/**
 * Two chips pinned on the hero picture, drawn from the demo's own records so
 * they say something the product can back up. They land a beat after the
 * headline and then float, the way a notification sits on a lock screen.
 */
function HeroChip({
  icon,
  tint,
  title,
  body,
  className,
  delay,
}: {
  icon: typeof Bell;
  tint: TintName;
  title: string;
  body: string;
  className?: string;
  delay: number;
}) {
  return (
    <div
      className={cn("land pointer-events-none", className)}
      style={{ "--land-delay": `${delay}ms` } as React.CSSProperties}
      aria-hidden
    >
      <div className={cn(delay > 700 ? "float-late" : "float")}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-surface/85 p-3 pr-4 shadow-float backdrop-blur-md dark:border-white/10">
          <IconTile icon={icon} tint={tint} variant="solid" size="md" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-fg">{title}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroChips() {
  const request = openRequests()[0];
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
      <HeroChip
        icon={CircleDollarSign}
        tint="teal"
        title={`Dues paid, ${money(ach.residentPaysCents)}`}
        body={ach.platformCents === 0 ? "Bank transfer, no fee" : "Bank transfer, posted today"}
        className="absolute left-[27%] top-[17%]"
        delay={520}
      />
      {request ? (
        <HeroChip
          icon={ClipboardCheck}
          tint="blue"
          title={`${kind} request approved`}
          body={`Unit ${request.unit} · from your phone`}
          className="absolute bottom-[24%] right-[7%]"
          delay={820}
        />
      ) : null}
    </>
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
        {/* The field: a soft aurora behind the headline column, so the left
            half of the hero is not a flat wash next to a lit photograph. */}
        <div className="pointer-events-none absolute inset-0 -z-20 bg-aurora" aria-hidden />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[68%] lg:block"
          aria-hidden
        >
          {/* The oasis: homes on a ring road around a lake, one lit house on
              the island in the middle. Monish asked for it back on 2026-09-19;
              it is the picture the name comes from. One night render, lifted
              and softened on the light theme, as shot on the dark one.

              The picture dissolves into the field through a mask on its own
              box rather than a wash painted over it: a wash is a strip of
              one flat color, and the moment the field behind it stopped being
              flat (the aurora) that strip showed as a line. A mask has no
              color, so there is nothing to mismatch. */}
          <div className="absolute inset-0 [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent_0%,black_44%),linear-gradient(to_bottom,transparent_0%,black_16%,black_84%,transparent_100%)] [-webkit-mask-composite:source-in]">
            <Image
              src="/marketing/hero-oasis.jpg"
              alt=""
              fill
              priority
              sizes="58vw"
              className="object-cover object-[center_top] brightness-[1.22] saturate-[.9] dark:brightness-100 dark:saturate-100"
            />
            {/* The lit house on the island, lit a little more: a warm radial
                glow blended over the picture, centred where the island sits. */}
            <div
              className="absolute left-[54%] top-[50%] size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_205_120/0.55),rgb(255_205_120/0.12)_45%,transparent_70%)] mix-blend-screen blur-xl dark:bg-[radial-gradient(closest-side,rgb(255_196_92/0.5),rgb(255_196_92/0.1)_45%,transparent_70%)]"
            />
          </div>
          <HeroChips />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-14 sm:pt-20 lg:grid lg:min-h-[36rem] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-center lg:pb-20 lg:pt-16">
          <div className="lg:pr-8">
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-tint-blue/25 bg-surface/70 py-1 pl-1.5 pr-3 text-[13px] font-semibold text-fg-muted shadow-card backdrop-blur-sm">
                <span className="inline-flex h-5 items-center rounded-full bg-brand-gradient px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-primary-fg">
                  New
                </span>
                {TRIAL_DAYS} days free, no card to start
              </p>
              <h1 className="text-balance text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-fg sm:text-[60px]">
                Moving your HOA
                <br />
                <span className="text-gradient">forward.</span>
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
                  className="press shimmer group inline-flex h-12 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-[17px] font-semibold text-primary-fg shadow-raised hover:-translate-y-0.5 hover:shadow-glow"
                >
                  Get started
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/signin"
                  className="press inline-flex h-12 items-center rounded-xl border border-border-2 bg-surface/60 px-6 text-[16px] font-semibold text-fg backdrop-blur-sm hover:bg-surface"
                >
                  Log in
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="relative -mb-px aspect-[16/11] w-full [mask-image:linear-gradient(to_bottom,transparent_0%,black_22%)] lg:hidden">
          <Image
            src="/marketing/hero-oasis.jpg"
            alt="An illustrated neighborhood at night: homes on a ring road around a lake, with one lit house on the island in the middle"
            fill
            priority
            sizes="100vw"
            className="object-cover brightness-[1.22] saturate-[.9] dark:brightness-100 dark:saturate-100"
          />
        </div>
      </section>

      {/* The strip along the bottom of slide one. The huddle called the navy
          band too dark against the white page, so in light mode it is a quiet
          gray with the blue carrying the icons and copy; dark keeps navy. */}
      <div className="border-y border-border bg-surface text-fg dark:border-0 dark:bg-navy-900">
        <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-4 text-[14px] font-semibold sm:justify-between">
          {ASSURANCES.map(({ icon, label, tint }, index) => (
            <Reveal key={label} delay={index * 70}>
              <li className="inline-flex items-center gap-2.5">
                <IconTile icon={icon} tint={tint} variant="solid" size="sm" />
                {label}
              </li>
            </Reveal>
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
                <span className="text-gradient">Not another job.</span>
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
                className="press shimmer group mt-4 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-[17px] font-semibold text-primary-fg shadow-raised hover:-translate-y-0.5 hover:shadow-glow"
              >
                Get started today
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={160}>
            <MonitorFrame
              src="/marketing/product-dashboard.png"
              alt="The Your HOAsis board dashboard: money in and out by month, spending by category, cash on hand, and transactions waiting for review"
            />
          </Reveal>
        </div>
      </section>

      {/* Slide three. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-hero-field">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" aria-hidden />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Sound familiar?
              </h2>
              <p className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-gradient">
                Meet Eric.
              </p>
              <p className="mt-5 max-w-md text-[18px] leading-relaxed text-fg-muted">
                He just wanted to enjoy his home. Then someone asked him to join the HOA board.
                Suddenly, it felt like a second job.
              </p>
              <p className="mt-6 text-[19px] font-semibold tracking-[-0.015em] text-fg">
                Your HOAsis was built to change that.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <Link
                href="/start"
                className="press shimmer group mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-[17px] font-semibold text-primary-fg shadow-raised hover:-translate-y-0.5 hover:shadow-glow"
              >
                Start today
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={160}>
            {/* A photograph, on purpose. The deck drew this as a video player
                and Monish decided on 2026-08-28 that there is no video to make.
                On 2026-09-03 the slide's render gave way to a real photo of a
                real person, because a render reads as fake to exactly the
                people we are asking to trust us. */}
            <div className="tilt-stage">
            <div className="tilt overflow-hidden rounded-[1.25rem] border border-border bg-navy-950 shadow-float">
              <Image
                src="/marketing/eric-story.jpg"
                alt="Eric at his kitchen table in a tan overshirt, glasses set down, one hand at his temple, a laptop, a notebook and a spread of printed reports in front of him"
                width={1400}
                height={933}
                sizes="(max-width: 1024px) 100vw, 660px"
                className="h-auto w-full"
              />
            </div>
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
                <span className="text-gradient">actually work.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-[18px] leading-relaxed text-fg-muted">
                Powerful tools for the things that matter most, so your community runs smoothly
                today and is prepared for tomorrow.
              </p>
            </div>
          </Reveal>

          {/* Four across from a laptop width up. Under that they keep their
              width and scroll sideways, because a card at 180px cannot hold
              a screen anyone can read. It was five with a "...and more" card
              that only showed on a 1280px viewport, so most laptops saw four
              and a sliver; the fifth is the strip underneath now. Each card
              sits at its own height: the minis differ. */}
          <div className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {FEATURES.map(({ icon, tint, title, line, mini }, index) => (
              <Reveal
                key={title}
                delay={index * 80}
                className="w-[272px] shrink-0 snap-start lg:w-auto"
              >
                <Card className="lift relative overflow-hidden p-5">
                  <div className="flex flex-col items-center text-center">
                    <IconTile icon={icon} tint={tint} variant="solid" size="lg" ring />
                    <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em] text-fg">
                      {title}
                    </h3>
                    <p className="mt-1 text-[14px] leading-snug text-fg-muted">{line}</p>
                  </div>
                  <div className="mt-4">{mini}</div>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-gradient-to-r from-tint-blue-soft via-surface-2 to-tint-violet-soft px-5 py-4">
              <span className="mr-1 inline-flex items-center gap-2 text-[14px] font-semibold text-fg">
                <IconTile icon={Sparkles} tint="amber" variant="solid" size="xs" />
                And everything else
              </span>
              {EVERYTHING_ELSE.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[13px] font-medium text-fg-muted"
                >
                  <Check className="size-3 text-ok" strokeWidth={3} />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Slide five. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-hero-field">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" aria-hidden />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Your entire community.
                <br />
                <span className="text-gradient">In your pocket.</span>
              </h2>
              <p className="mt-5 max-w-md text-[18px] leading-relaxed text-fg-muted">
                Your HOAsis keeps you informed, connected, and in control from any phone.
                Anytime, anywhere.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {POCKET.map((item) => (
                  <PocketTile key={item.title} {...item} />
                ))}
              </ul>
              <p className="mt-4 text-[15px] text-fg-subtle">
                Works in any browser today. iPhone and Android apps are next.
              </p>
            </Reveal>
          </div>

          <div className="relative lg:min-h-[560px]">
            <Reveal delay={160}>
              <div className="tilt-stage lg:absolute lg:left-0 lg:top-0 lg:w-[296px]">
                <div className="tilt">
                <PhoneFrame
                  src="/marketing/product-resident.png"
                  alt="The resident app showing a balance due, a live board meeting, and open ballots"
                />
                </div>
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
            <div className="flex flex-wrap items-center gap-5">
              <div className="rounded-2xl border border-tint-blue/20 bg-gradient-to-br from-tint-blue-soft to-tint-violet-soft px-5 py-4 text-center shadow-card">
                <p className="tnum text-gradient text-[40px] font-semibold leading-none tracking-[-0.04em]">
                  {money(PRICE_PER_HOME_CENTS)}
                </p>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
                  per home, monthly
                </p>
              </div>
              <div>
                <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-fg sm:text-[32px]">
                  One price. Every feature.
                </h2>
                <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-fg-muted">
                  After your {TRIAL_DAYS} free days. {money(PRICE_PER_TRANSACTION_CENTS)} per
                  payment, any rail. No setup fee, no add-ons, cancel whenever.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <Link
              href="/pricing"
              className="press group inline-flex h-11 items-center gap-2 rounded-xl border border-border-2 bg-surface px-5 text-[15px] font-semibold text-fg hover:border-fg-subtle hover:bg-surface-2"
            >
              See pricing
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
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
        <Image src="/marketing/aerial.jpg" alt="" fill sizes="100vw" className="-z-30 object-cover" />
        <div
          className="absolute inset-0 -z-20 bg-gradient-to-b from-navy-950/85 via-navy-950/75 to-navy-950/90"
          aria-hidden
        />
        {/* Two pools of colour on the navy, so the band glows rather than
            sits: blue low left, violet high right. Fixed, because the band
            is the same navy in both themes. */}
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(63_130_242/0.45),transparent)] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-40 -z-10 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(143_118_255/0.4),transparent)] blur-3xl"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-6xl px-5 py-24 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-[36px] font-semibold leading-tight tracking-[-0.035em] sm:text-[52px]">
              Fast for the board.
              <br />
              <span className="bg-gradient-to-r from-[#8fb6ff] via-[#b7a6ff] to-[#6fe0bd] bg-clip-text text-transparent">
                Calm for the neighborhood.
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[18px] leading-relaxed text-navy-200">
              Set up your community in minutes. No card to start, {TRIAL_DAYS} days free, cancel
              whenever.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/start"
                className="press shimmer group inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[16px] font-semibold text-navy-950 shadow-float hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgb(143_180_255/0.6)]"
              >
                Get started
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/signin"
                className="press inline-flex h-12 items-center gap-2 rounded-xl border border-navy-50/30 px-6 text-[16px] font-semibold text-navy-50 hover:bg-navy-50/10"
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
