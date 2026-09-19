"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IconTile } from "@/components/ui/primitives";
import { residentTabs } from "@/components/app/resident-nav";

/**
 * A resident page's title with the section's lit tile beside it.
 *
 * The tile is looked up from the tab list by path, so it is the same glyph
 * and tint as the row in the rail and the tab under the thumb. Phone width,
 * so the tile is a step smaller than the board's.
 */
export function ResidentTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const tab = [...residentTabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((t) => (t.href === "/resident" ? pathname === t.href : pathname.startsWith(t.href)));
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {tab ? (
          <IconTile icon={tab.icon} tint={tab.tint ?? "blue"} variant="solid" size="md" className="pop-in" />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[15px] text-fg-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
