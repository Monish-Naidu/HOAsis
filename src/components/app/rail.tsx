import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { RailWordmark } from "@/components/app/logo";
import { RailYou } from "@/components/app/rail-you";
import { TabPill } from "@/components/app/tab-pill";
import type { TintName } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * The floating navy rail both shells hang their sections on.
 *
 * A deliberately fixed surface, like the phone bezel: navy in both themes,
 * with a pool of the brand blue behind the wordmark so the top of the panel
 * is lit rather than flat, and a hairline of light around the edge so it
 * reads as a panel sitting on the page. The children are the nav; each
 * shell decides what goes in it.
 */
export function Rail({
  home,
  label,
  children,
}: {
  home: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className="rail fixed inset-y-3 left-3 z-40 hidden w-60 flex-col overflow-hidden rounded-[26px] shadow-float lg:flex"
    >
      <Link href={home} className="bird-lift relative flex items-center justify-center px-4 pb-2 pt-6">
        <RailWordmark size={34} />
      </Link>
      <div className="no-scrollbar relative flex flex-1 overflow-y-auto px-3 py-3">{children}</div>
      <RailYou />
    </aside>
  );
}

/**
 * The icon on a rail row, on its own small tile.
 *
 * At rest the tile is a dark field with the section's tint on the glyph, so
 * a column of twelve rows reads as twelve different places rather than one
 * grey list. The pointer lights the tile in that tint; the selected row's
 * tile goes frosted white, because it already sits on the blue pill. The
 * tile remounts when it becomes selected, so it pops once as it lands.
 */
export function RailIcon({
  icon: Icon,
  tint = "blue",
  active = false,
}: {
  icon: LucideIcon;
  tint?: TintName;
  active?: boolean;
}) {
  return (
    <span
      key={active ? "on" : "off"}
      data-tint={tint}
      data-active={active || undefined}
      className={cn(
        "rail-tile inline-flex size-7 shrink-0 items-center justify-center rounded-[9px]",
        active && "pop-in",
      )}
      aria-hidden
    >
      <Icon className="size-4" strokeWidth={active ? 2.3 : 2} />
    </span>
  );
}

/** A count beside a rail row: something waits here. */
export interface RailBadge {
  count: number;
  tone: "danger" | "warn" | "neutral";
}

/**
 * The column of rows inside the rail, with the travelling pill behind them.
 *
 * One rule for both shells, because the two used to have their own and
 * drifted: the board's rows stopped at 48px and packed from the top, which
 * left a third of the column dark, while the resident's grew to fill it
 * (Monish, 2026-09-25). Rows grow to share the column, so on a tall display
 * each fills its slot instead of floating in a gap (Monish, on a 42" screen,
 * 2026-09-21); capped so a laptop still reads a list, and past the cap the
 * spacing takes over. Packing them from the top was tried 2026-09-24 and
 * read as cramped; he asked for this back.
 */
export function RailNav({
  label,
  activeKey,
  children,
}: {
  label: string;
  activeKey: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={label} className="flex min-h-full w-full">
      <TabPill
        activeKey={activeKey}
        className="stagger flex min-h-full w-full flex-col justify-evenly gap-1.5"
        pillClassName="bg-brand-gradient rounded-2xl shadow-[0_8px_20px_-8px_rgb(77_139_245/0.7)]"
      >
        {children}
      </TabPill>
    </nav>
  );
}

/** One row on the rail: tile, name, and the count if something waits. */
export function RailRow({
  href,
  tabKey,
  label,
  icon,
  tint,
  active,
  badge,
}: {
  href: string;
  /** What the pill looks for; the href unless the shell keys rows otherwise. */
  tabKey?: string;
  label: string;
  icon: LucideIcon;
  tint?: TintName;
  active: boolean;
  badge?: RailBadge;
}) {
  return (
    <Link
      href={href}
      data-tab-key={tabKey ?? href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // The selected background is the travelling pill behind the row,
        // not a class on the link, so it slides rather than cuts.
        "group relative z-10 flex min-h-11 max-h-[5.5rem] flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-body font-medium transition-colors duration-200",
        active ? "text-white" : "text-navy-200 hover:bg-navy-800/70 hover:text-white",
      )}
    >
      <RailIcon icon={icon} tint={tint} active={active} />
      <span className="truncate">{label}</span>
      {badge && badge.count > 0 ? (
        <span
          className={cn(
            "tnum ml-auto rounded bg-navy-800 px-1.5 py-0.5 text-caption font-bold",
            // Fixed accents for the fixed surface. The dark theme's warn and
            // danger read on navy; the light theme's sink.
            badge.tone === "danger" && "text-[#e2837a]",
            badge.tone === "warn" && "text-[#dfa845]",
            badge.tone === "neutral" && "text-navy-200",
          )}
        >
          {badge.count}
        </span>
      ) : null}
    </Link>
  );
}
