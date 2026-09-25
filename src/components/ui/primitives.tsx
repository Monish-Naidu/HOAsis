import { cloneElement, useId, type ComponentProps, type FormEventHandler, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteTile } from "@/components/app/route-tile";

/* -------------------------------------------------------------------------- */
/* Surface                                                                     */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  as: As = "div",
  ...props
}: Omit<ComponentProps<"div">, "ref"> & {
  as?: "div" | "section" | "article" | "form";
  onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  // A card can be a form so Enter in any field submits it. The handlers
  // are typed for a div; casting keeps one primitive rather than two.
  const Tag = As as "div";
  return (
    <Tag
      className={cn(
        // min-w-0 so a card in a grid or flex row can shrink below the
        // width of a scrolling table inside it. Without it the table's
        // minimum leaks out and the whole page scrolls sideways on a phone.
        "min-w-0 rounded-card border border-border bg-surface shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  tint,
  accent,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** A glyph that aids recognition. Wears a soft tile; `tint` picks which. */
  icon?: ReactNode;
  tint?: TintName;
  /**
   * A hairline of the tint along the top of the card, the same one the
   * stat tiles wear, for a dashboard card that should be found by colour.
   */
  accent?: TintName;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Wraps, so on a phone the action drops under the title instead of
        // pushing the card wider than the screen.
        "flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4",
        // Clipped to the card's own corner radius, less its border, so the
        // hairline follows the curve instead of poking past it.
        accent && "relative overflow-hidden rounded-t-[13px]",
        className,
      )}
    >
      {accent ? (
        <span className={cn("absolute inset-x-0 top-0 h-[3px]", ACCENT_BAR[accent])} aria-hidden />
      ) : null}
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <IconTile tint={tint ?? "blue"} size="sm" className="mt-0.5">
            {icon}
          </IconTile>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-headline font-semibold tracking-[-0.01em] break-words text-fg">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-body leading-snug text-fg-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2 [&>div]:flex-wrap">{action}</div>
      ) : null}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-4", className)}>
      <h2 className="text-footnote font-semibold text-fg-muted">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  icon,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * The lit tile beside the title. Left out, it is the section's own icon
   * from the route table; `false` for a header that should stand bare.
   */
  icon?: ReactNode | false;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {icon === false ? null : icon === undefined ? <RouteTile /> : icon}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-footnote font-semibold text-fg-muted">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-title1 font-semibold leading-tight tracking-[-0.025em] text-fg">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-callout leading-relaxed text-fg-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2 [&>div]:flex-wrap">{action}</div>
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Icon tile                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The five tints, plus a neutral for a tile that should not draw the eye.
 *
 * A tint is recognition, not meaning: the payments card wears blue every
 * time so the eye finds it without reading, the way a well designed icon
 * set does. Meaning still goes through `Tone` (ok, warn, danger).
 */
export type TintName = "blue" | "teal" | "amber" | "coral" | "violet" | "neutral";

/** The hairline along the top of a card or a stat tile. */
export const ACCENT_BAR: Record<TintName, string> = {
  blue: "bg-tint-blue",
  teal: "bg-tint-teal",
  amber: "bg-tint-amber",
  coral: "bg-tint-coral",
  violet: "bg-tint-violet",
  neutral: "bg-border-2",
};

/**
 * The soft field a large tappable tile sits on, in its tint, with a hover
 * that lightens rather than darkens so the tile reads as lit. Both
 * dashboards' quick actions wear this.
 */
export const TINT_FIELD: Record<TintName, string> = {
  blue: "bg-tint-blue-soft hover:bg-tint-blue-soft/70",
  teal: "bg-tint-teal-soft hover:bg-tint-teal-soft/70",
  amber: "bg-tint-amber-soft hover:bg-tint-amber-soft/70",
  coral: "bg-tint-coral-soft hover:bg-tint-coral-soft/70",
  violet: "bg-tint-violet-soft hover:bg-tint-violet-soft/70",
  neutral: "bg-surface-2 hover:bg-surface-3",
};

const TILE_SOFT: Record<TintName, string> = {
  blue: "bg-tint-blue-soft text-tint-blue-fg",
  teal: "bg-tint-teal-soft text-tint-teal-fg",
  amber: "bg-tint-amber-soft text-tint-amber-fg",
  coral: "bg-tint-coral-soft text-tint-coral-fg",
  violet: "bg-tint-violet-soft text-tint-violet-fg",
  neutral: "bg-surface-3 text-fg-muted",
};

const TILE_SIZE = {
  xs: "size-6 rounded-md [&>svg]:size-3.5",
  sm: "size-8 rounded-lg [&>svg]:size-4",
  md: "size-10 rounded-xl [&>svg]:size-[18px]",
  lg: "size-12 rounded-2xl [&>svg]:size-[22px]",
  xl: "size-14 rounded-2xl [&>svg]:size-6",
} as const;

/**
 * A finished icon: a rounded square with a tinted field and the glyph on it.
 *
 * `soft` is the in-product tile, a pale field with a saturated glyph, quiet
 * enough to sit in a row of six. `solid` is the marketing tile, the hue lit
 * from the top left with a white glyph, for a feature card or the assurance
 * strip. Pass a lucide component as `icon` or anything as children.
 */
export function IconTile({
  icon: Icon,
  children,
  tint = "blue",
  variant = "soft",
  size = "md",
  ring = false,
  className,
  strokeWidth,
}: {
  icon?: LucideIcon;
  children?: ReactNode;
  tint?: TintName;
  variant?: "soft" | "solid";
  size?: keyof typeof TILE_SIZE;
  /** A hairline of the tint around the tile, for a tile on a photograph or a busy field. */
  ring?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <span
      data-tint={tint}
      className={cn(
        "icon-tile inline-flex shrink-0 items-center justify-center",
        TILE_SIZE[size],
        variant === "solid" ? "icon-tile-solid text-white" : TILE_SOFT[tint],
        ring && "icon-tile-ring",
        className,
      )}
      aria-hidden
    >
      {Icon ? <Icon strokeWidth={strokeWidth ?? (variant === "solid" ? 2.2 : 2)} /> : children}
    </span>
  );
}

/**
 * The check that says it happened.
 *
 * Pops in, draws its tick, and sends one ring out. For the end of a pay
 * flow, a request sent, a plan finished. Not for a toast; the toast has
 * its own smaller pop.
 */
export function SuccessMark({
  size = 56,
  tone = "ok",
  className,
}: {
  size?: number;
  tone?: "ok" | "primary";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ring-pulse pop-in relative inline-flex items-center justify-center rounded-full",
        tone === "ok" ? "bg-ok text-white" : "bg-brand-gradient text-primary-fg",
        className,
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Done"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.5, height: size * 0.5 }}
      >
        <path className="check-draw" d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

const buttonStyles = {
  base: "press inline-flex items-center justify-center gap-2 rounded-lg py-1.5 text-center text-body font-medium leading-snug text-balance disabled:pointer-events-none disabled:opacity-50",
  variant: {
    // The one filled button on a screen: the brand gradient, lit on hover.
    primary:
      "shimmer bg-brand-gradient text-primary-fg shadow-raised hover:shadow-glow hover:brightness-[1.05]",
    secondary: "border border-border-2 bg-surface text-fg hover:border-fg-subtle hover:bg-surface-2",
    ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
    danger: "border border-danger/30 bg-danger-soft text-danger hover:border-danger/50",
    quiet: "bg-surface-3 text-fg hover:opacity-80",
    // The same filled button, named for the marketing pages that ask for it.
    hero: "shimmer bg-brand-gradient font-semibold text-primary-fg shadow-raised hover:shadow-glow hover:brightness-[1.05]",
  },
  size: {
    // min-h, not h, so a larger text size grows the button instead of
    // spilling out of it. 44px under a finger, Apple's floor.
    sm: "min-h-9 px-3 pointer-coarse:min-h-11",
    md: "min-h-10 px-4 pointer-coarse:min-h-11",
    lg: "min-h-11 px-5 text-body",
    xl: "min-h-12 rounded-xl px-6 text-headline font-semibold",
  },
} as const;

type ButtonVariant = keyof typeof buttonStyles.variant;
type ButtonSize = keyof typeof buttonStyles.size;

/**
 * A button's classes, for something that has to be another element: a
 * <label> that opens a file picker, a <summary>. Anything that can be a
 * Button should be one.
 */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  return cn(buttonStyles.base, buttonStyles.variant[variant], buttonStyles.size[size]);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  // Native buttons default to submit, so a Cancel inside a form would post
  // it. Submit buttons say so explicitly; everything else is just a button.
  return (
    <button
      type={type}
      className={cn(
        buttonStyles.base,
        buttonStyles.variant[variant],
        buttonStyles.size[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cn(
        buttonStyles.base,
        buttonStyles.variant[variant],
        buttonStyles.size[size],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const tones = {
  neutral: "bg-surface-3 text-fg-muted",
  brand: "bg-brand-soft text-brand-soft-fg",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  blue: "bg-tint-blue-soft text-tint-blue-fg",
  teal: "bg-tint-teal-soft text-tint-teal-fg",
  amber: "bg-tint-amber-soft text-tint-amber-fg",
  coral: "bg-tint-coral-soft text-tint-coral-fg",
  violet: "bg-tint-violet-soft text-tint-violet-fg",
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  /** A status dot ahead of the word: the colour, then the word that names it. */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-footnote font-semibold tracking-[0.01em]",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-current opacity-40" style={{ transform: "scale(1.9)" }} />
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

const STAT_ACCENT: Record<TintName, string> = {
  blue: "bg-tint-blue",
  teal: "bg-tint-teal",
  amber: "bg-tint-amber",
  coral: "bg-tint-coral",
  violet: "bg-tint-violet",
  neutral: "bg-border-2",
};

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  accent,
  className,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** A coloured hairline along the top and a tile behind the icon, so four tiles in a row read as four things. */
  accent?: TintName;
  className?: string;
  /** Makes the whole tile the way into its detail screen. */
  href?: string;
}) {
  const As = href ? Link : "div";
  return (
    <As
      // TS wants href present when As is Link and absent when it is a div;
      // the runtime is fine either way, so one cast keeps the union simple.
      {...({ href } as { href: string })}
      className={cn(
        "relative block overflow-hidden rounded-card border border-border bg-surface p-4 shadow-card",
        href && "press transition-colors hover:border-border-2 hover:bg-surface-2",
        className,
      )}
    >
      {accent ? (
        <span className={cn("absolute inset-x-0 top-0 h-[3px]", STAT_ACCENT[accent])} aria-hidden />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-footnote font-semibold text-fg-muted">
          {label}
        </p>
        {icon ? (
          accent ? (
            <IconTile tint={accent} size="sm">
              {icon}
            </IconTile>
          ) : (
            <span className="text-fg-subtle">{icon}</span>
          )
        ) : null}
      </div>
      <p
        className={cn(
          "tnum mt-2 text-title2 font-semibold leading-none tracking-[-0.03em]",
          tone === "ok" && "text-ok",
          tone === "danger" && "text-danger",
          tone === "warn" && "text-warn",
          tone === "neutral" && "text-fg",
          tone === "brand" && "text-fg",
          tone === "info" && "text-info",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-footnote leading-snug text-fg-muted">{hint}</p> : null}
    </As>
  );
}

export function Meter({
  value,
  tone = "brand",
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  "aria-label"?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = {
    brand: "bg-brand-gradient",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    info: "bg-info",
    neutral: "bg-fg-subtle",
    blue: "bg-tint-blue",
    teal: "bg-tint-teal",
    amber: "bg-tint-amber",
    coral: "bg-tint-coral",
    violet: "bg-tint-violet",
  }[tone];
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-[640ms] ease-[cubic-bezier(0.16,1,0.3,1)]", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Avatar({
  name,
  className,
  tone = "brand",
}: {
  /**
   * Optional, because a home can exist with nobody in it.
   *
   * An unsold lot in a new build is owned by the builder and has no named
   * resident, and this used to take the whole roster into the error boundary
   * on the first render. A primitive that a real record can crash is a
   * primitive with the wrong signature.
   */
  name?: string;
  className?: string;
  tone?: "brand" | "neutral";
}) {
  const text = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-footnote font-semibold",
        tone === "brand" ? "bg-brand-soft text-brand-soft-fg" : "bg-surface-3 text-fg-muted",
        className,
      )}
      aria-hidden
    >
      {/* A person glyph rather than an empty circle, per the huddle: a user
          with no photo and no derivable initials still reads as a person. */}
      {text || <UserRound className="size-4" strokeWidth={2} />}
    </span>
  );
}

export function Row({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-body text-fg-muted">{label}</dt>
      <dd className="tnum text-body font-medium text-fg">{children}</dd>
    </div>
  );
}

export function EmptyState({
  icon,
  tint = "neutral",
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  /** The tile behind the icon. Neutral by default; a tint when the empty state is an invitation rather than an absence. */
  tint?: TintName;
  title: string;
  description?: string;
  /** The one thing that would fill this emptiness, when there is one. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <IconTile tint={tint} size="lg" className="pop-in mb-4">
          {icon}
        </IconTile>
      ) : null}
      <p className="text-callout font-medium text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-body text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const border = {
    neutral: "border-border",
    brand: "border-navy-200 dark:border-navy-700",
    ok: "border-ok/25",
    warn: "border-warn/30",
    danger: "border-danger/30",
    info: "border-info/25",
    blue: "border-tint-blue/25",
    teal: "border-tint-teal/25",
    amber: "border-tint-amber/30",
    coral: "border-tint-coral/30",
    violet: "border-tint-violet/25",
  }[tone];
  return (
    <div className={cn("rounded-card border p-4", border, tones[tone], className)}>
      {/* The action sits beside the text where there is room and drops
          under it on a phone; beside a narrow column it squeezed the words
          into a strip three or four wide. */}
      <div className="flex flex-wrap items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-[14rem] flex-1">
          <p className="text-body font-semibold">{title}</p>
          {children ? (
            <div className="mt-1 text-body leading-relaxed opacity-90">{children}</div>
          ) : null}
        </div>
        {action ? (
          <div className="flex min-w-0 max-w-full basis-full flex-wrap gap-2 sm:basis-auto [&>div]:flex-wrap">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "press relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 before:absolute before:-inset-2.5 before:content-[''] disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand-gradient shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)]" : "bg-border-2",
      )}
    >
      <span
        className={cn(
          "knob absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)]",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function SettingRow({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Wraps below sm, so a wide control drops under its label instead of
        // squeezing the label to a word per line on a phone.
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-4 last:border-b-0 sm:flex-nowrap",
        className,
      )}
    >
      <div className="min-w-[12rem] flex-1">
        <p className="text-body font-medium text-fg">{title}</p>
        {description ? (
          <p className="mt-0.5 text-footnote leading-snug text-fg-muted">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 max-w-full shrink-0">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One of a few views, side by side. The one segmented control.
 *
 * There were four hand-built styles of this (money tabs, the date range,
 * the roster filter, open and resolved). This is the shape all of them take.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  fill = false,
  className,
}: {
  options: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  /** `lg` is the touch size, for a control that is the main thing on a phone screen. */
  size?: "md" | "lg";
  /** Stretches across its container, each option an equal share. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "max-w-full overflow-x-auto rounded-lg bg-surface-3 p-0.5 no-scrollbar",
        fill ? "flex [&>button]:flex-1 [&>button]:justify-center" : "inline-flex",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors",
            // A finger needs more than a pointer does.
            size === "lg" ? "min-h-10 px-4 text-callout pointer-coarse:min-h-11" : "min-h-8 px-3 text-footnote pointer-coarse:min-h-11",
            value === o.value ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="tnum text-fg-subtle">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * The one look for a text field: a clear edge (border-2 clears 3:1), 44px
 * tall, body-size text. Focus wears the ring from globals.css. Add layout
 * classes beside it (`cn(fieldClass, "mt-1.5")`), never a second style.
 */
export const fieldClass =
  "min-h-11 w-full rounded-lg border border-border-2 bg-surface px-3 text-body text-fg outline-none transition-colors placeholder:text-fg-subtle hover:border-fg-subtle focus:border-primary";

/** The same field, for several lines. */
export const textareaClass = cn(fieldClass, "py-2.5 leading-relaxed");

/**
 * A field with its words: a visible label above, an optional hint, and an
 * error a screen reader hears. The control is passed as the child and gets
 * its id, aria-describedby and aria-invalid from here, so a placeholder is
 * never the only thing saying what goes in the box.
 */
export function Field({
  label,
  hint,
  error,
  required,
  srOnlyLabel,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** For a grid whose column headers already name the field. */
  srOnlyLabel?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean }>;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn(
          "mb-1 block text-footnote font-semibold text-fg-muted",
          srOnlyLabel && "sr-only",
        )}
      >
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required ?? children.props.required,
      })}
      {hint ? (
        <p id={hintId} className="mt-1 text-footnote text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-footnote font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A native select, dressed: the platform's picker on a phone, our chrome everywhere. */
export function Select({
  className,
  children,
  size = "md",
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: "sm" | "md" }) {
  return (
    <span className={cn("relative inline-flex min-w-0", className)}>
      <select
        className={cn(
          "w-full min-w-0 appearance-none rounded-lg border border-border-2 bg-surface pl-3 pr-8 text-fg outline-none transition-colors hover:border-fg-subtle focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/40",
          size === "sm" ? "min-h-9 text-footnote pointer-coarse:min-h-11" : "min-h-10 text-callout pointer-coarse:min-h-11",
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </span>
  );
}

/** A checkbox in the primary blue. */
export function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-5 shrink-0 cursor-pointer rounded-[5px] border-border-2 accent-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}
