"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BatteryFull, Monitor, Signal, Smartphone, Wifi } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { ResidentBell } from "@/components/app/notifications";
import { ThemeToggle } from "@/components/app/theme";
import { RailWordmark, Wordmark } from "@/components/app/logo";
import { residentModuleFor, residentTabs } from "@/components/app/resident-nav";
import { ModuleOff } from "@/components/app/module-gate";
import { PageTransition } from "@/components/app/page-transition";
import { moduleOn } from "@/lib/modules";
import { TabPill } from "@/components/app/tab-pill";
import { AccountMenu, RequireSession, ViewSwitcher } from "@/components/app/account-menu";
import { CommunityHero } from "@/components/app/community-hero";
import { HomeBadge } from "@/components/app/home-badge";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";
import type { CommunitySettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function visibleTabs(settings: CommunitySettings) {
  return residentTabs.filter((t) => moduleOn(t.module) && (!t.visible || t.visible(settings)));
}

/** Only for the pages of a module that is off: the same words for everyone. */
function Gated({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const mod = residentModuleFor(pathname);
  if (mod && !moduleOn(mod)) return <ModuleOff module={mod} />;
  return <PageTransition>{children}</PageTransition>;
}

/**
 * The resident experience runs two ways from the same screens:
 *
 * - Website: a normal responsive portal with a sidebar, which is how most
 *   homeowners will actually sign in.
 * - Phone preview: the identical content inside a device frame, so the board
 *   (and we) can see what the native app will look like.
 *
 * Below `lg` there is no difference. The bottom tab bar takes over.
 */
export function ResidentShell({ children }: { children: React.ReactNode }) {
  const [phonePreview, setPhonePreview] = useState(false);
  const pathname = usePathname();
  const { settings, community } = useAppState();
  const owner = useCurrentOwner();
  const associationName = settings.displayName;
  const tabs = visibleTabs(settings);
  const ownerName = owner?.members[0] ?? "";
  const unit = owner?.unit ?? "";
  const address = owner?.address ?? "";
  // "Lot 12" or "Unit 3", then the street only when one is on file.
  const homeLine = `${homeLabel(community, unit)}${address ? ` · ${address}` : ""}`;

  const topBar = (
    <header className="hidden border-b border-border bg-surface lg:block">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* In website mode the sidebar carries the logo; showing it twice on
            one edge of the screen reads as a mistake. */}
        <div>
          {phonePreview ? (
            <Link href="/">
              <Wordmark />
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          {moduleOn("phone-preview") ? (
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5"
            role="radiogroup"
            aria-label="Resident layout"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!phonePreview}
              onClick={() => setPhonePreview(false)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                !phonePreview ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              <Monitor className="size-3.5" />
              Website
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={phonePreview}
              onClick={() => setPhonePreview(true)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                phonePreview ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
              )}
            >
              <Smartphone className="size-3.5" />
              Mobile app
            </button>
          </div>
          ) : null}
          <ViewSwitcher />
          <ResidentBell />
          <ThemeToggle />
          <AccountMenu compact />
        </div>
      </div>
    </header>
  );

  const appHeader = (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {associationName}
        </p>
        <p className="truncate text-[13px] text-fg-muted">{homeLine}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <ResidentBell compact />
        <Avatar name={ownerName} />
      </div>
    </header>
  );

  /* ---------------------------------------------------------------- phone */
  if (phonePreview) {
    return (
      <RequireSession>
      <div className="min-h-dvh bg-bg lg:bg-surface-2">
        {topBar}
        <div className="lg:flex lg:justify-center lg:px-6 lg:py-10">
          <div className="relative flex min-h-dvh flex-col bg-bg lg:h-[860px] lg:min-h-0 lg:w-[404px] lg:overflow-hidden lg:rounded-[2.75rem] lg:border-[11px] lg:border-navy-950 lg:shadow-float lg:ring-1 lg:ring-navy-700/60">
            <span
              className="pointer-events-none absolute left-1/2 top-1.5 z-30 hidden h-1 w-16 -translate-x-1/2 rounded-full bg-navy-800 lg:block"
              aria-hidden
            />
            {/* The status bar, so the preview reads as the app and not as a
                narrow website. Apple's marketing clock, because every phone
                render since the first keynote says 9:41. */}
            <div
              className="hidden items-center justify-between bg-surface px-7 pb-0.5 pt-2.5 text-[12px] font-semibold text-fg lg:flex"
              aria-hidden
            >
              <span className="tnum">9:41</span>
              <span className="flex items-center gap-1.5">
                <Signal className="size-3.5" strokeWidth={2.4} />
                <Wifi className="size-3.5" strokeWidth={2.4} />
                <BatteryFull className="size-4" strokeWidth={2} />
              </span>
            </div>
            <PhoneHeader
              associationName={associationName}
              ownerName={ownerName}
              homeLine={homeLine}
            />
            <main className="no-scrollbar flex-1 overflow-y-auto pb-6">
              <CommunityHero compact />
              <div className="@container px-4 pt-4">
                <Gated pathname={pathname}>{children}</Gated>
              </div>
            </main>
            <TabBar pathname={pathname} tabs={tabs} />
          </div>
        </div>
        <p className="hidden pb-10 text-center text-[13px] text-fg-subtle lg:block">
          The same screens and tokens carry into the native app.
        </p>
      </div>
      </RequireSession>
    );
  }

  /* -------------------------------------------------------------- website */
  return (
    <RequireSession>
    <div className="min-h-dvh bg-bg lg:pl-[15.5rem]">
      {/* The sidebar floats: inset from the edges with a large radius, so it
          reads as a panel rather than a slab welded to the viewport. No
          community name or unit here; the banner carries both. */}
      <aside className="fixed inset-y-3 left-3 z-40 hidden w-56 flex-col overflow-hidden rounded-[26px] bg-navy-950 shadow-float lg:flex">
        <Link href="/resident" className="flex items-center justify-center px-4 pb-2 pt-6">
          <RailWordmark size={34} />
        </Link>
        <nav
          aria-label="Resident sections"
          className="no-scrollbar flex flex-1 overflow-y-auto px-3 py-3"
        >
          <TabPill
            activeKey={
              tabs.find((t) =>
                t.href === "/resident" ? pathname === t.href : pathname.startsWith(t.href),
              )?.href ?? ""
            }
            // Rows share the leftover height, per the huddle: evenly spaced
            // down the column, not packed at the top.
            className="flex min-h-full w-full flex-col justify-evenly gap-1"
            pillClassName="bg-royal rounded-2xl"
          >
            {tabs.map(({ href, label, icon: Icon, webLabel }) => {
              const active =
                href === "/resident" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  data-tab-key={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[14px] font-medium transition-colors duration-200",
                    active
                      ? "text-white"
                      : "text-navy-200 hover:bg-navy-800/70 hover:text-white",
                  )}
                >
                  <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  {webLabel ?? label}
                </Link>
              );
            })}
          </TabPill>
        </nav>
      </aside>
      {topBar}
      {appHeader}
      <CommunityHero overlay={<HomeBadge />} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 lg:px-6 lg:py-8 lg:pb-8">
        {/* The home screen runs the full width for its dashboard grid; every
            other screen keeps the phone-width column both modes share, centred
            under the banner rather than hugging the rail. The container query
            context is what lets the same page collapse to one column inside
            the phone frame. */}
        <main
          className={cn(
            "mx-auto min-w-0 @container",
            pathname === "/resident" ? "" : "lg:max-w-2xl",
          )}
        >
          <Gated pathname={pathname}>{children}</Gated>
        </main>
      </div>
      <div className="lg:hidden">
        <TabBar pathname={pathname} tabs={tabs} pinned />
      </div>
    </div>
    </RequireSession>
  );
}

function PhoneHeader({
  associationName,
  ownerName,
  homeLine,
}: {
  associationName: string;
  ownerName: string;
  homeLine: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {associationName}
        </p>
        <p className="truncate text-[13px] text-fg-muted">{homeLine}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <ResidentBell compact />
        <Avatar name={ownerName} />
      </div>
    </header>
  );
}

function TabBar({
  pathname,
  tabs,
  pinned = false,
}: {
  pathname: string;
  tabs: typeof residentTabs;
  /**
   * Pinned to the viewport rather than the flow.
   *
   * Inside the phone frame the bar is the last row of a fixed height column,
   * so it sits still on its own. On a real page it is the last element in the
   * document, where `sticky bottom-0` has nothing left to scroll past and the
   * bar simply rides away with the content. Fixed is what keeps it under the
   * reader's thumb, which is the whole point of a tab bar.
   */
  pinned?: boolean;
}) {
  return (
    <nav
      className={cn(
        "z-30 border-t border-border bg-surface/95 backdrop-blur-md",
        pinned ? "fixed inset-x-0 bottom-0" : "sticky bottom-0",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Resident sections"
    >
      <ul
        className="grid"
        // As many columns as tabs, so a hidden section never leaves a hole.
        style={{
          gridTemplateColumns: `repeat(${tabs.filter((t) => !t.webOnly).length}, 1fr)`,
        }}
      >
        {tabs
          .filter((t) => !t.webOnly)
          .map(({ href, label, icon: Icon }) => {
          const active = href === "/resident" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 transition-colors",
                  active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                <Icon
                  className={cn(
                    "size-[19px] transition-transform duration-200 ease-out",
                    active ? "scale-110" : "scale-100",
                  )}
                  strokeWidth={active ? 2.3 : 1.8}
                />
                <span className={cn("text-[12px]", active ? "font-semibold" : "font-medium")}>
                  {label}
                </span>
              </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
