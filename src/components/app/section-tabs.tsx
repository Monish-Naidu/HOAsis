"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import { routeFor, routeOffered, sectionFor, sectionPages } from "@/lib/board-routes";
import { cn } from "@/lib/utils";

/**
 * The pages inside one sidebar row, as tabs along the top.
 *
 * Nine rows instead of thirteen only works if the pages that lost a row are
 * one tap from the row that kept one. The layout renders this above every
 * board page, and it draws nothing for a section with a single page, so a
 * page never has to remember to include it (the Finances screens each did,
 * and two of them forgot on their empty state).
 *
 * Underline tabs rather than a segmented control: these load pages, and the
 * baseline keeps the segmented control for views of one thing. Each tab is
 * offered on the same terms as a rail row, so a seat never sees a tab that
 * then refuses it.
 *
 * On a phone the strip scrolls sideways and fades at its right edge, so a
 * fourth tab reads as "there is more" rather than not existing.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const { can, community } = useAppState();
  const section = sectionFor(pathname);
  if (!section) return null;

  const tabs = sectionPages(section).filter((route) => routeOffered(route, can, community));
  if (tabs.length < 2) return null;

  const current = routeFor(pathname);
  const label = section.label;

  return (
    <nav
      aria-label={label}
      className="-mt-1 mb-6 border-b border-border"
    >
      <div
        className={cn(
          "no-scrollbar -mb-px flex gap-5 overflow-x-auto pr-8 sm:gap-6 sm:pr-0",
          "max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]",
        )}
      >
        {tabs.map((tab) => {
          const active = current?.key === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center whitespace-nowrap text-callout font-medium transition-colors duration-200",
                active
                  ? "text-fg shadow-[inset_0_-2px_0_var(--primary)]"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {tab.tab ?? tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
