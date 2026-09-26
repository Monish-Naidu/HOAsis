"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IconTile } from "@/components/ui/primitives";
import { residentTabFor } from "@/components/app/resident-nav";

/**
 * A resident page's title with the section's lit tile beside it.
 *
 * The tile is looked up from the tab list by path, so it is the same glyph
 * and tint as the row in the rail and the tab under the thumb. At phone
 * width the tile and the title are a step smaller than the board's; in the
 * website's wider column they grow to the board's PageHeader sizes, so the
 * two shells read as one product (Monish, 2026-09-25). Container queries,
 * not breakpoints, because the phone frame also renders at desktop width.
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
  const tab = residentTabFor(pathname);
  return (
    <div className="flex items-start justify-between gap-3 @md:items-end @md:gap-4">
      <div className="flex min-w-0 items-center gap-3 @md:gap-4">
        {tab ? (
          <IconTile
            icon={tab.icon}
            tint={tab.tint ?? "blue"}
            variant="solid"
            size="md"
            className="pop-in @md:size-12 @md:rounded-2xl @md:[&>svg]:size-[22px]"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-title2 font-semibold leading-tight tracking-[-0.025em] text-fg @md:text-title1">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-body text-fg-muted @md:mt-1 @md:text-callout @md:leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
