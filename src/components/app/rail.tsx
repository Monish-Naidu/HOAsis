import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { RailWordmark } from "@/components/app/logo";
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
