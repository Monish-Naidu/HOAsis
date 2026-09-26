"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import {
  residentSectionFor,
  residentSectionPages,
  residentTabFor,
  visibleResidentTabs,
} from "@/components/app/resident-nav";
import { cn } from "@/lib/utils";

/**
 * The pages inside one resident sidebar row, as tabs along the top.
 *
 * The same strip the board has above Finances and Meetings. Eight rows
 * instead of eleven only works if the pages that lost a row are one tap
 * from the row that kept one. Draws nothing for a section with a single
 * page, so a page never has to remember it.
 */
export function ResidentSectionTabs() {
  const pathname = usePathname();
  const { settings } = useAppState();
  const section = residentSectionFor(pathname);
  if (!section) return null;

  const tabs = residentSectionPages(section, visibleResidentTabs(settings));
  if (tabs.length < 2) return null;

  const current = residentTabFor(pathname);

  return (
    <nav aria-label={section.webLabel ?? section.label} className="-mt-1 mb-6 border-b border-border">
      <div
        className={cn(
          // The same strip, spacing and fade the board's SectionTabs draws.
          "no-scrollbar -mb-px flex gap-5 overflow-x-auto pr-8 sm:gap-6 sm:pr-0",
          "max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]",
        )}
      >
        {tabs.map((tab) => {
          const active = current?.href === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center whitespace-nowrap text-callout font-medium transition-colors duration-200",
                active ? "text-fg shadow-[inset_0_-2px_0_var(--primary)]" : "text-fg-muted hover:text-fg",
              )}
            >
              {tab.tab ?? tab.webLabel ?? tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
