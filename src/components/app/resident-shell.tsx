"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BatteryFull, Monitor, Signal, Smartphone, Wifi } from "lucide-react";
import { Avatar, type TintName } from "@/components/ui/primitives";
import { ResidentBell } from "@/components/app/notifications";
import { SearchButton, SearchPalette } from "@/components/app/search-palette";
import { ThemeToggle } from "@/components/app/theme";
import { Wordmark } from "@/components/app/logo";
import { Rail, RailIcon } from "@/components/app/rail";
import { residentModuleFor, residentTabs } from "@/components/app/resident-nav";
import { ModuleOff } from "@/components/app/module-gate";
import { PageTransition } from "@/components/app/page-transition";
import { moduleOn } from "@/lib/modules";
import { TabPill } from "@/components/app/tab-pill";
import { AccountMenu, RequireSession, ViewSwitcher } from "@/components/app/account-menu";
import { CommunityHero, CommunityName } from "@/components/app/community-hero";
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
  return (
    <PageTransition order={residentTabs.map((t) => t.href)}>{children}</PageTransition>
  );
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
  const homeLine = (() => {
    const label = homeLabel(community, unit);
    // A home keyed by its address already says where it is.
    return address && address !== label ? `${label} · ${address}` : label;
  })();

  // The controls, once. On most pages they sit in the top bar; on the
  // dashboard the bar is gone and they ride on the photo instead.
  const controls = (
        <div className="flex items-center gap-2.5">
          {moduleOn("phone-preview") ? (
          <div role="radiogroup" aria-label="Resident layout">
            <TabPill
              activeKey={phonePreview ? "app" : "web"}
              className="inline-flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 ring-1 ring-inset ring-border"
              pillClassName="bg-surface shadow-raised rounded-md"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!phonePreview}
                data-tab-key="web"
                onClick={() => setPhonePreview(false)}
                className={cn(
                  "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                  !phonePreview ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                <Monitor className="size-3.5" />
                Website
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={phonePreview}
                data-tab-key="app"
                onClick={() => setPhonePreview(true)}
                className={cn(
                  "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                  phonePreview ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                <Smartphone className="size-3.5" />
                Mobile app
              </button>
            </TabPill>
          </div>
          ) : null}
          <SearchButton />
          <ViewSwitcher />
          <ResidentBell />
          {/* In website mode the rail's card carries the toggle. */}
          {phonePreview ? <ThemeToggle /> : null}
          <AccountMenu compact />
        </div>
  );

  const topBar = (
    <header className="hidden border-b border-border bg-surface lg:block">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* In website mode the sidebar carries the logo; showing it twice on
            one edge of the screen reads as a mistake. */}
        <div className="min-w-0">
          {phonePreview ? (
            <Link href="/">
              <Wordmark />
            </Link>
          ) : (
            // The banner does not ride above these pages, so the bar says
            // whose portal this is and which home.
            <div className="min-w-0">
              {/* Somebody with homes in two associations switches here, the
                  same control the board bar has. With one it is just the name. */}
              <div className="-ml-2">
                <CommunityName />
              </div>
              <p className="truncate text-[13px] text-fg-muted">{homeLine}</p>
            </div>
          )}
        </div>
        {controls}
      </div>
    </header>
  );

  const onDashboard = pathname === "/resident";

  const appHeader = (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {associationName}
        </p>
        <p className="truncate text-[13px] text-fg-muted">{homeLine}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <SearchButton compact />
        <ResidentBell compact />
        <Avatar name={ownerName} />
      </div>
    </header>
  );

  /* ---------------------------------------------------------------- phone */
  if (phonePreview) {
    return (
      <RequireSession>
      <SearchPalette />
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
              {pathname === "/resident" ? <CommunityHero compact /> : null}
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
    <SearchPalette />
    <div className="page-ground min-h-dvh bg-bg lg:pl-[16.5rem]">
      {/* The sidebar floats: inset from the edges with a large radius, so it
          reads as a panel rather than a slab welded to the viewport. No
          community name or unit here; the banner carries both. */}
      <Rail home="/resident" label="Resident">
        <nav aria-label="Resident sections" className="flex min-h-full w-full">
          <TabPill
            activeKey={
              tabs.find((t) =>
                t.href === "/resident" ? pathname === t.href : pathname.startsWith(t.href),
              )?.href ?? ""
            }
            // A list packed from the top, 44px a row. Spreading the rows
            // across the column made 80px rows on a laptop, which read as
            // buttons rather than a list. Only a genuinely tall display
            // (Monish's 42" screen, 2026-09-21) spreads them out.
            className="stagger flex min-h-full w-full flex-col justify-start gap-0.5 [@media(min-height:1100px)]:justify-evenly"
            pillClassName="bg-brand-gradient rounded-xl shadow-[0_8px_20px_-8px_rgb(77_139_245/0.7)]"
          >
            {tabs.map(({ href, label, icon: Icon, webLabel, tint }) => {
              const active =
                href === "/resident" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  data-tab-key={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative z-10 flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-200",
                    active
                      ? "text-white"
                      : "text-navy-200 hover:bg-navy-800/70 hover:text-white",
                  )}
                >
                  <RailIcon icon={Icon} tint={tint} active={active} />
                  {webLabel ?? label}
                </Link>
              );
            })}
          </TabPill>
        </nav>
      </Rail>
      {/* The dashboard has no bar: the photo runs to the top of the page and
          the controls sit on it in a frosted tray, because a white strip
          saying the association's name above a photo saying the same thing
          was one name too many (Monish, 2026-09-21). Every other page keeps
          the bar, since it has no photo to carry the name. */}
      {onDashboard ? null : topBar}
      {appHeader}
      {/* The photo and the home card are the front door, not a masthead on
          every page. Elsewhere the page title comes first. */}
      {onDashboard ? (
        <CommunityHero
          overlay={<HomeBadge />}
          toolbar={
            <div className="hidden rounded-2xl bg-surface/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md lg:block">
              {controls}
            </div>
          }
        />
      ) : null}
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 lg:px-6 lg:py-8 lg:pb-8">
        {/* The home screen runs the full width for its dashboard grid; every
            other screen keeps the phone-width column both modes share, centred
            under the banner rather than hugging the rail. The container query
            context is what lets the same page collapse to one column inside
            the phone frame. */}
        <main
          className={cn(
            "mx-auto min-w-0 @container",
            onDashboard ? "" : "lg:max-w-2xl",
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
        <SearchButton compact />
        <ResidentBell compact />
        <Avatar name={ownerName} />
      </div>
    </header>
  );
}

/**
 * The tab bar's selected state, in the tab's own tint. The soft field is
 * the pill and the tint's foreground is the glyph and the label, so the
 * bar says which section it is on in colour as well as in words.
 */
const TAB_PILL: Record<TintName, string> = {
  blue: "bg-tint-blue-soft",
  teal: "bg-tint-teal-soft",
  amber: "bg-tint-amber-soft",
  coral: "bg-tint-coral-soft",
  violet: "bg-tint-violet-soft",
  neutral: "bg-surface-3",
};
const TAB_ACTIVE: Record<TintName, string> = {
  blue: "text-tint-blue-fg",
  teal: "text-tint-teal-fg",
  amber: "text-tint-amber-fg",
  coral: "text-tint-coral-fg",
  violet: "text-tint-violet-fg",
  neutral: "text-fg",
};

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
        // minmax(0, 1fr) rather than 1fr: a bare 1fr will not shrink below
        // its label, and six labels at 320px pushed Account off the screen.
        style={{
          gridTemplateColumns: `repeat(${tabs.filter((t) => !t.webOnly).length}, minmax(0, 1fr))`,
        }}
      >
        {tabs
          .filter((t) => !t.webOnly)
          .map(({ href, label, tabLabel, icon: Icon, tint = "blue" }) => {
          const active = href === "/resident" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex min-h-14 flex-col items-center gap-1 pb-2 pt-2 transition-colors",
                  active ? TAB_ACTIVE[tint] : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                {/* Remounts when it becomes selected, so the tab pops once
                    under the thumb instead of only changing colour. */}
                <span
                  key={active ? "on" : "off"}
                  className={cn(
                    "flex h-7 w-full max-w-11 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out",
                    active ? cn("pop-in scale-100", TAB_PILL[tint]) : "scale-95",
                  )}
                >
                  <Icon className="size-[19px]" strokeWidth={active ? 2.3 : 1.8} />
                </span>
                <span
                  className={cn(
                    // 10px on the narrowest phones, the size iOS sets its own tab
                    // labels in, so "Community" fits a sixth of 320px whole.
                    "block max-w-full truncate text-[10px] tracking-[-0.01em] min-[375px]:text-[11px] min-[430px]:text-[12px] min-[430px]:tracking-normal",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {tabLabel ?? label}
                </span>
              </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
