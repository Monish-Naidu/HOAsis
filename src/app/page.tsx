import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  Headset,
  Landmark,
  LockOpen,
  Megaphone,
  MessagesSquare,
  PencilRuler,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Video,
  Vote,
} from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Avatar, Card, IconTile, type TintName } from "@/components/ui/primitives";
import {
  articleBySlug,
  association,
  libraryArticles,
  liveMeeting,
  openRequests,
  reserveComponents,
  reserveSummary,
  upcomingMeetings,
  vendorGaps,
  vendors,
} from "@/lib/data";
import { FEE_SCHEDULE } from "@/lib/payments/instruments";
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
const ASSURANCES: { icon: typeof Timer; label: string; tint: TintName }[] = [
  { icon: Timer, label: "Set up in minutes", tint: "amber" },
  { icon: CreditCard, label: "No card to start", tint: "teal" },
  // An open lock, not a cross in a circle: the cross read as an error.
  { icon: LockOpen, label: "Cancel whenever", tint: "blue" },
  { icon: Headset, label: "Live support", tint: "violet" },
];

/**
 * A colour means one thing and keeps meaning it, here and in the product:
 * teal is money and anything approved, blue is people and talking, amber is
 * time and work waiting, violet is the record (documents, votes, guides),
 * coral is something that wants attention. For one evening on 2026-10-04
 * every tile was blue; Monish asked for the colour back where it highlights
 * something, and for glyphs that say what they are. The tiles are the quiet
 * two-tone kind (`IconTile`), so five hues read as a system and not as
 * decoration.
 */
const BENEFITS: { icon: typeof Clock; tint: TintName; title: string; body: string }[] = [
  {
    icon: Clock,
    tint: "amber",
    title: "Save time",
    body: "Automate everyday HOA tasks and reduce busywork.",
  },
  {
    icon: PiggyBank,
    tint: "teal",
    title: "Save money",
    body: "Get professional tools without professional management fees.",
  },
  {
    icon: Archive,
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
    body: "Message homeowners and send notices to everyone.",
  },
  {
    icon: Bell,
    tint: "amber",
    title: "Stay informed",
    body: "Get real-time updates on what matters most.",
  },
  {
    icon: Video,
    tint: "violet",
    title: "Meet",
    body: "Hold board meetings anyone can join with a call-in link.",
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
 * backdrop. The render is Monish's from 2026-09-20, an iMac-style display
 * cut out on a transparent ground with a soft white halo baked into its
 * alpha, so it sits on the light theme and glows on the dark one. The real
 * capture is laid on the glass: the screen rectangle was measured off the
 * render (x 174 to 1359, y 55 to 675 of 1536 x 1024), and the capture is
 * taken at the same 1.91:1 so nothing is cropped or stretched.
 */
function MonitorFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="tilt-stage relative mx-auto w-full max-w-[820px]">
      {/* The glow the screen throws on the desk. */}
      <div
        className="pointer-events-none absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[40%] bg-[radial-gradient(closest-side,rgb(63_130_242/0.22),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgb(77_139_245/0.28),transparent)]"
        aria-hidden
      />
      <div className="tilt relative">
        <Image
          src="/marketing/device-monitor.png"
          alt=""
          width={1536}
          height={1024}
          sizes="(max-width: 1024px) 100vw, 820px"
          className="h-auto w-full"
        />
        <div className="absolute left-[11.33%] top-[5.37%] h-[60.55%] w-[77.15%] overflow-hidden rounded-[2px] bg-surface">
          <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 78vw, 640px" className="object-cover object-top" />
        </div>
      </div>
      {/* The ground it sits on. */}
      <div
        className="mx-auto -mt-4 h-5 w-[58%] rounded-[100%] bg-black/20 blur-lg dark:bg-black/50"
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
const PHONE_BASE_WIDTH = 340;
// The matrix at 340px, as measured. Rendering wider is a uniform scale of
// the output, so the linear and translation terms scale and the two
// perspective terms stay put.
const PHONE_MATRIX = [0.33193, -0.063114, -0.000153, -0.029395, 0.341345, -0.00008, 93.253766, 40.420067];

function PhoneFrame({ src, alt, width = PHONE_BASE_WIDTH }: { src: string; alt: string; width?: number }) {
  const k = width / PHONE_BASE_WIDTH;
  const [a, b, pa, c, d, pb, tx, ty] = PHONE_MATRIX;
  const transform = `matrix3d(${a * k}, ${b * k}, 0, ${pa}, ${c * k}, ${d * k}, 0, ${pb}, 0, 0, 1, 0, ${tx * k}, ${ty * k}, 0, 1)`;
  return (
    <div className="relative mx-auto origin-top max-[359px]:scale-[.88]" style={{ width }}>
      <Image
        src="/marketing/device-phone.png"
        alt=""
        width={1086}
        height={1448}
        sizes={`${width}px`}
        className="h-auto w-full"
      />
      <div
        className="absolute left-0 top-0 h-[1030px] w-[430px] origin-top-left overflow-hidden rounded-[50px]"
        style={{ transform }}
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
 * The rails on the demo association's own dues. An owner pays the dues and
 * nothing on top on either rail, which is what the pay screen shows too.
 */
function PaymentsMini() {
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
          return (
            <li key={kind} className="px-1 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="whitespace-nowrap text-[12px] font-semibold text-fg">{label}</p>
                <span className="tnum text-[12px] text-fg-muted">
                  {money(dues)}
                </span>
              </div>
              <div className="mt-0.5 flex items-start justify-between gap-2">
                {/* The schedule's own words, minus the hedge: "About 4
                    business days" and the pill do not share a 220px row. */}
                <p className="min-w-0 text-[11px] leading-snug text-fg-muted">
                  {FEE_SCHEDULE[kind].settlement.replace(/^About /, "")}
                </p>
                {/* Both rails cost the owner the same; the saving lands on
                    the association, and the pay screen says so in the same
                    words. */}
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
function KnowledgeMini() {
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
 * Everything the four tiles leave out, as one strip under them. Notices
 * dropped out of the tiles on 2026-09-20 when Monish put the four biggest
 * pains first; the knowledge center is a tile until compliance takes its
 * place, and moves down here when it does.
 */
/**
 * The strip under the four feature cards. Each item wears the same tile the
 * cards do, so the row reads as the rest of the product and not as a
 * footnote; the grid gives every item the same width.
 */
const EVERYTHING_ELSE: { label: string; icon: typeof Bell; tint: TintName }[] = [
  { label: "Notices", icon: Megaphone, tint: "coral" },
  { label: "Architectural requests", icon: PencilRuler, tint: "blue" },
  { label: "Documents", icon: FileText, tint: "violet" },
  { label: "Communication", icon: MessagesSquare, tint: "blue" },
  { label: "Meetings", icon: CalendarDays, tint: "amber" },
  { label: "Voting", icon: Vote, tint: "violet" },
  ...(moduleOn("compliance")
    ? [{ label: "Board guides", icon: BookOpen, tint: "violet" as TintName }]
    : []),
];

/**
 * In the order Monish set on 2026-09-20: the four things boards hurt over
 * most, money first. Compliance takes the fourth tile once the module is on;
 * until then it is the library, which is where the compliance answers live.
 */
const FEATURES = [
  {
    icon: CreditCard,
    tint: "teal" as TintName,
    title: "Payments & dues",
    line: "Collected, posted, reconciled.",
    mini: <PaymentsMini />,
  },
  {
    // The product's own Vendors icon, so the page and the app agree.
    icon: Truck,
    tint: "amber" as TintName,
    title: "Vendor management",
    line: "Contracts and invoices, one place.",
    mini: <VendorMini />,
  },
  {
    icon: Landmark,
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
        mini: <KnowledgeMini />,
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
 */
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
          tint="blue"
          title="Board meeting"
          body={`${formatDate(next.date)} at ${next.time}, ${next.location}`}
          className={itemClassNames[2]}
        />
      ) : null}
      {live ? (
        <Notice
          icon={Video}
          tint="teal"
          title="Board meeting is live"
          body={`Live now, ${live.attendees.length} joined`}
          className={itemClassNames[3]}
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
      <IconTile icon={icon} tint={tint} size="xl" />
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
      <IconTile icon={icon} tint={tint} size="md" />
      <p className="mt-3 text-[16px] font-semibold tracking-[-0.015em] text-fg">{title}</p>
      <p className="mt-0.5 text-[14px] leading-snug text-fg-muted">{body}</p>
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
        <div className="flex items-center gap-3 rounded-2xl border border-white/50 bg-surface/90 p-3 pr-4 shadow-float backdrop-blur-md dark:border-white/10">
          <IconTile icon={icon} tint={tint} variant="solid" size="md" />
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
            className="absolute bottom-0 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-[0_0_0_3px_rgb(255_255_255/0.35)]"
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
  const kind = request ? request.kind.charAt(0).toUpperCase() + request.kind.slice(1) : "";
  return (
    <>
      {/* The home on the left of the ring. */}
      <HeroChip
        icon={CircleDollarSign}
        tint="teal"
        title={`Dues paid, ${money(association.duesCents)}`}
        body="Bank transfer, posted today"
        x={50}
        y={31.5}
        delay={520}
      />
      {/* The house on the island, the one the whole picture is about. */}
      {meeting ? (
        <HeroChip
          icon={CalendarDays}
          tint="blue"
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
          tint="teal"
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
              the field, and one at the foot dissolves it into the strip. */}
          <div className="absolute inset-0 [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent_0%,black_26%),linear-gradient(to_bottom,transparent_0%,black_10%,black_84%,transparent_100%)] [-webkit-mask-composite:source-in]">
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

        <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-14 sm:pt-20 lg:grid lg:min-h-[clamp(36rem,50vw,46rem)] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-center lg:pb-20 lg:pt-16">
          <div className="lg:pr-8">
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-tint-blue/25 bg-surface/70 py-1 pl-1.5 pr-3 text-[13px] font-semibold text-fg-muted shadow-card backdrop-blur-sm">
                <span className="inline-flex h-5 items-center rounded-full bg-brand-gradient px-2 text-[12px] font-semibold text-primary-fg">
                  New
                </span>
                {TRIAL_DAYS} days free, no card to start
              </p>
              <h1 className="text-balance text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-fg sm:text-[60px]">
                Your community.
                <br />
                <span className="text-gradient">Your HOAsis.</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              {/* Full ink and a halo of the field colour behind it: muted gray
                  at this size sank into the picture's fade on both themes. */}
              <p className="mt-6 max-w-md text-[20px] font-medium leading-relaxed text-fg [text-shadow:0_0_24px_var(--hero-field),0_0_8px_var(--hero-field)]">
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

        <div className="relative -mb-px aspect-[1672/941] w-full [mask-image:linear-gradient(to_bottom,transparent_0%,black_22%)] lg:hidden">
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

      {/* The strip along the bottom of slide one. The huddle called the navy
          band too dark against the white page, so in light mode it is a quiet
          gray with the blue carrying the icons and copy; dark keeps navy. */}
      <div className="border-y border-border bg-surface-2 text-fg dark:border-0 dark:bg-navy-900">
        {/* Four equal cells, each promise centred in its own, so the row
            reads as evenly spaced from edge to edge rather than as a list
            that starts on the left and runs out. */}
        <ul className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-5 py-7 text-[15px] font-semibold sm:grid-cols-4 sm:text-[17px] sm:tracking-[-0.01em]">
          {ASSURANCES.map(({ icon, label, tint }) => (
            <li key={label} className="flex items-center justify-center gap-3">
              <IconTile icon={icon} tint={tint} size="md" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Slide two. The copy sits at the top of the monitor rather than at
          its middle: centred against a tall device, the headline drifted a
          screen below the strip and the section opened on nothing. */}
      {/* Clipped sideways: the glow behind the monitor reaches past the
          column, and on a phone it made the whole page scroll. */}
      <section className="overflow-x-clip border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
          <div>
            <div>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Run your HOA.
                <br />
                Not another job.
              </h2>

            </div>
            <div>
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
            </div>
          </div>
          <div>
            <MonitorFrame
              src="/marketing/product-finances.png"
              alt="The Your HOAsis board dashboard: money in and out by month, spending by category, and the association's balances"
            />
          </div>
        </div>
      </section>

      {/* Slide three. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-hero-field">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" aria-hidden />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <div>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Sound familiar?
              </h2>
              <p className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-fg">
                Meet Eric.
              </p>
              <p className="mt-5 max-w-md text-[18px] leading-relaxed text-fg-muted">
                He just wanted to enjoy his home. Then someone asked him to join the HOA board.
                Suddenly, it felt like a second job.
              </p>
              <p className="mt-6 text-[19px] font-semibold tracking-[-0.015em] text-fg">
                Your HOAsis was built to change that.
              </p>
            </div>
            <div>
              <Link
                href="/start"
                className="press shimmer group mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-[17px] font-semibold text-primary-fg shadow-raised hover:-translate-y-0.5 hover:shadow-glow"
              >
                Start today
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
          <div>
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
          </div>
        </div>
      </section>

      {/* Slide four. */}
      <section id="features" className="scroll-mt-16 border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-24">
          <div>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Built for the way HOA boards actually work.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-[18px] leading-relaxed text-fg-muted">
                Powerful tools for the things that matter most, so your community runs smoothly
                today and is prepared for tomorrow.
              </p>
            </div>
          </div>

          {/* Four across from a laptop width up. Under that they keep their
              width and scroll sideways, because a card at 180px cannot hold
              a screen anyone can read. It was five with a "...and more" card
              that only showed on a 1280px viewport, so most laptops saw four
              and a sliver; the fifth is the strip underneath now. Each card
              sits at its own height: the minis differ. */}
          <div className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {FEATURES.map(({ icon, tint, title, line, mini }) => (
              <div key={title} className="w-[300px] shrink-0 snap-start lg:w-auto">
                <Card className="lift relative overflow-hidden p-6">
                  <div className="flex flex-col items-center text-center">
                    <IconTile icon={icon} tint={tint} size="xl" />
                    <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-fg">
                      {title}
                    </h3>
                    <p className="mt-1 text-[15px] leading-snug text-fg-muted">{line}</p>
                  </div>
                  <div className="mt-5">{mini}</div>
                </Card>
              </div>
            ))}
          </div>

          <div>
            <Card className="mt-6 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border/70 px-6 py-4">
                <IconTile icon={Sparkles} tint="neutral" size="sm" />
                <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">
                  And everything else
                </h3>
                <p className="hidden text-[15px] text-fg-muted sm:block">
                  Included, on the same one rate.
                </p>
              </div>
              {/* One column per item, all the same width, so the row is evenly
                  spaced whatever the count. Under a laptop width it wraps to
                  three, then two. */}
              <ul
                className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none"
              >
                {EVERYTHING_ELSE.map(({ label, icon, tint }) => (
                  <li
                    key={label}
                    className="lift flex flex-col items-center gap-3 bg-surface px-3 py-6 text-center"
                  >
                    <IconTile icon={icon} tint={tint} size="lg" />
                    <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-fg">
                      <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} />
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Slide five. */}
      <section className="relative isolate overflow-hidden border-b border-border bg-hero-field">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" aria-hidden />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-10">
          <div>
            <div>
              <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[48px]">
                Your entire community.
                <br />
                In your pocket.
              </h2>
              <p className="mt-5 max-w-md text-[18px] leading-relaxed text-fg-muted">
                Your HOAsis keeps you informed, connected, and in control from any phone.
                Anytime, anywhere.
              </p>
            </div>
            <div>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {POCKET.map((item) => (
                  <PocketTile key={item.title} {...item} />
                ))}
              </ul>
              <p className="mt-4 text-[15px] text-fg-subtle">
                Works in any browser today. iPhone and Android apps are next.
              </p>
            </div>
          </div>

          {/* The phone in the middle of its column, the four cards hung
              around it, two a side, their inner edges over the device the
              way notifications sit over a lock screen. */}
          <div className="relative lg:min-h-[700px]">
            <div>
              {/* The phone is drawn at 500px so its screen lines up with the
                  frame. A phone reading the page shrinks the whole drawing
                  with zoom instead, which keeps the two aligned. */}
              <div className="tilt-stage mx-auto w-fit max-sm:[zoom:0.62] max-[400px]:[zoom:0.55] lg:absolute lg:left-1/2 lg:top-0 lg:-translate-x-1/2">
                <div className="tilt">
                  <PhoneFrame
                    src="/marketing/product-resident.png"
                    alt="The resident app showing a balance due, a live board meeting, and open ballots"
                    width={500}
                  />
                </div>
              </div>
            </div>
            <div className="lg:absolute lg:inset-0 lg:z-10">
              <PocketNotices
                className="mt-8 grid gap-3 sm:grid-cols-2 lg:contents"
                itemClassNames={[
                  "lg:absolute lg:left-0 lg:top-[14%] lg:w-[236px]",
                  "lg:absolute lg:left-0 lg:top-[58%] lg:w-[236px]",
                  "lg:absolute lg:right-0 lg:top-[30%] lg:w-[236px]",
                  "lg:absolute lg:right-0 lg:top-[66%] lg:w-[256px]",
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* The price, in one line. The strip under the hero promises a free
          trial, and the next question is what comes after it. */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-12 sm:py-14">
          <div>
            <div className="flex flex-wrap items-center gap-5">
              <div className="rounded-2xl border border-border bg-surface-2 px-5 py-4 text-center">
                <p className="tnum text-[40px] font-semibold leading-none tracking-[-0.04em] text-fg">
                  {money(PRICE_PER_HOME_CENTS)}
                </p>
                <p className="mt-1.5 text-[14px] font-medium text-fg-muted">per home, monthly</p>
              </div>
              <div>
                <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-fg sm:text-[32px]">
                  One price. Every feature.
                </h2>
                <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-fg-muted">
                  After your {TRIAL_DAYS} free days. No setup fee, no add-ons, cancel whenever.
                </p>
              </div>
            </div>
          </div>
          <div>
            <Link
              href="/pricing"
              className="press group inline-flex h-11 items-center gap-2 rounded-xl border border-border-2 bg-surface px-5 text-[15px] font-semibold text-fg hover:border-fg-subtle hover:bg-surface-2"
            >
              See pricing
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        {/* The rails, named. Set as quiet wordmarks rather than borrowed logo
            art, and only rails the product actually runs: the huddle said
            mirror PayHOA's row (Plaid, Stripe...), but Plaid was ruled out on
            2026-09-02, and a logo for a service we do not use is a lie. */}
        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-9 gap-y-2 px-5 py-5 sm:justify-between">
            <p className="text-[14px] font-medium text-fg-subtle">Payments run on</p>
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

      {/* Close. The aerial photograph under a navy wash. It was swapped for
          the night illustration on 2026-10-04 and Monish asked for the
          photograph back the same evening: he likes it here. */}
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
          <div>
            <h2 className="mx-auto max-w-2xl text-[36px] font-semibold leading-tight tracking-[-0.035em] sm:text-[52px]">
              Fast for the board.
              <br />
              Calm for the neighborhood.
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
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
