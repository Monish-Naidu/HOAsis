import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Surface                                                                     */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  as: As = "div",
  ...props
}: ComponentProps<"div"> & { as?: "div" | "section" | "article" }) {
  return (
    <As
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
    </As>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Wraps, so on a phone the action drops under the title instead of
        // pushing the card wider than the screen.
        "flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-fg">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-[15px] leading-snug text-fg-muted">{subtitle}</p>
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
      <h2 className="text-[13px] font-semibold text-fg-muted">
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
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-[13px] font-semibold text-fg-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-fg">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2 [&>div]:flex-wrap">{action}</div>
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

const buttonStyles = {
  base: "inline-flex items-center justify-center gap-2 rounded-lg text-[15px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  variant: {
    primary: "bg-brand text-brand-fg hover:opacity-90",
    secondary: "border border-border-2 bg-surface text-fg hover:bg-surface-2",
    ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
    danger: "border border-danger/30 bg-danger-soft text-danger hover:border-danger/50",
    quiet: "bg-surface-3 text-fg hover:opacity-80",
  },
  size: {
    sm: "h-8 px-3",
    md: "h-9 px-4",
    lg: "h-11 px-5 text-sm",
  },
} as const;

type ButtonVariant = keyof typeof buttonStyles.variant;
type ButtonSize = keyof typeof buttonStyles.size;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
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
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-semibold tracking-[0.01em]",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
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
        "block rounded-card border border-border bg-surface p-4 shadow-card",
        href && "transition-colors hover:bg-surface-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg-muted">
          {label}
        </p>
        {icon ? <span className="text-fg-subtle">{icon}</span> : null}
      </div>
      <p
        className={cn(
          "tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em]",
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
      {hint ? <p className="mt-1.5 text-[13px] leading-snug text-fg-muted">{hint}</p> : null}
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
    brand: "bg-navy-700 dark:bg-navy-200",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    info: "bg-info",
    neutral: "bg-fg-subtle",
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
      <div className={cn("h-full rounded-full transition-all", fill)} style={{ width: `${pct}%` }} />
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
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
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
      <dt className="text-[15px] text-fg-muted">{label}</dt>
      <dd className="tnum text-[15px] font-medium text-fg">{children}</dd>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** The one thing that would fill this emptiness, when there is one. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-fg-subtle">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[15px] text-fg-muted">{description}</p>
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
  }[tone];
  return (
    <div className={cn("rounded-card border p-4", border, tones[tone], className)}>
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{title}</p>
          {children ? (
            <div className="mt-1 text-[15px] leading-relaxed opacity-90">{children}</div>
          ) : null}
        </div>
        {action ? (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2 [&>div]:flex-wrap">{action}</div>
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
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-ok" : "bg-surface-3",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
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
        "flex items-start justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-fg">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
