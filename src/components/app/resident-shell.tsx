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
import { Rail, RailNav, RailRow } from "@/components/app/rail";
import {
  residentModuleFor,
  residentSectionFor,
  residentTabs,
  visibleResidentTabs,
} from "@/components/app/resident-nav";
import { ResidentSectionTabs } from "@/components/app/resident-section-tabs";
import { useResidentBadges } from "@/components/app/resident-badges";
import { ModuleOff } from "@/components/app/module-gate";
import { PageTransition } from "@/components/app/page-transition";
import { moduleOn } from "@/lib/modules";
import { TabPill } from "@/components/app/tab-pill";
import { AccountMenu, RequireSession, ViewSwitcher } from "@/components/app/account-menu";
import { CommunityHero, CommunityName, PhotoStrip } from "@/components/app/community-hero";
import { HomeBadge } from "@/components/app/home-badge";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";
import { cn } from "@/lib/utils";


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
  const tabs = visibleResidentTabs(settings);
  const badges = useResidentBadges();
  const ownerName = owner?.members[0] ?? "";
  // By section, so Account lights Payments and Voting lights Meetings.
  const sectionHref = residentSectionFor(pathname)?.href ?? "";
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
                  "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-footnote font-medium transition-colors",
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
                  "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-footnote font-medium transition-colors",
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
    <header className="sticky top-0 z-30 hidden border-b border-border bg-surface/95 backdrop-blur-md lg:block">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
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
            <div className="-ml-2 flex min-w-0 items-center gap-3">
              {/* Somebody with homes in two associations switches here, the
                  same control the board bar has. With one it is just the name.
                  The home sits beside it on one line, so this bar is the
                  height of the board's. */}
              <CommunityName />
              <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
              <p className="truncate text-footnote text-fg-muted">{homeLine}</p>
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
        <p className="truncate text-headline font-semibold tracking-[-0.015em] text-fg">
          {associationName}
        </p>
        <p className="truncate text-footnote text-fg-muted">{homeLine}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <SearchButton compact />
        <ResidentBell compact />
        {/* The avatar opens Settings, where text size lives: the place a
            phone user reaches for when something is hard to read. */}
        <Link href="/resident/settings" aria-label="Settings" className="press rounded-full">
          <Avatar name={ownerName} />
        </Link>
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
              className="hidden items-center justify-between bg-surface px-7 pb-0.5 pt-2.5 text-caption font-semibold text-fg lg:flex"
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
        <p className="hidden pb-10 text-center text-footnote text-fg-subtle lg:block">
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
        <RailNav label="Resident sections" activeKey={sectionHref}>
          {tabs
            .filter((t) => !t.phoneOnly && !t.parent)
            .map(({ href, label, icon, webLabel, tint }) => (
              <RailRow
                key={href}
                href={href}
                label={webLabel ?? label}
                icon={icon}
                tint={tint}
                active={href === sectionHref}
                badge={badges[href]}
              />
            ))}
        </RailNav>
      </Rail>
      {/* The dashboard has no bar: the photo runs to the top of the page and
          the controls sit on it in a frosted tray, because a white strip
          saying the association's name above a photo saying the same thing
          was one name too many (Monish, 2026-09-21). Every other page keeps
          the bar, since it has no photo to carry the name. */}
      {/* The white bar is for narrow screens. At lg the photo is the top of
          every page: the dashboard's full banner with the home card, and on
          every other tab the same photo at half height with the switcher,
          the home line and the controls on it (Monish, 2026-09-26). */}
      {appHeader}
      {onDashboard ? (
        <CommunityHero
          overlay={<HomeBadge />}
          toolbar={
            <div className="hidden rounded-2xl bg-surface/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md lg:block">
              {controls}
            </div>
          }
        />
      ) : (
        <>
          <CommunityHero
            short
            subtitle={homeLine}
            nameControl={<CommunityName onPhoto />}
            className="max-lg:hidden"
            toolbar={
              <div className="hidden rounded-2xl bg-surface/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md lg:block">
                {controls}
              </div>
            }
          />
          <PhotoStrip className="lg:hidden" quietBelowLg />
        </>
      )}
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 lg:px-6 lg:py-8 lg:pb-8">
        {/* The same frame as the board: 1400px and the same gutters, so the
            two views line up when switching. Every page is written at phone
            width and lays itself out with container queries, so it fills
            this frame the way the dashboard does instead of sitting as a
            narrow column with ground either side (Monish, 2026-09-26). */}
        <main className="min-w-0 @container">
          <ResidentSectionTabs />
          <Gated pathname={pathname}>{children}</Gated>
        </main>
      </div>
      <div className="lg:hidden">
        <TabBar pathname={pathname} tabs={tabs} badges={badges} pinned />
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
        <p className="truncate text-headline font-semibold tracking-[-0.015em] text-fg">
          {associationName}
        </p>
        <p className="truncate text-footnote text-fg-muted">{homeLine}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <SearchButton compact />
        <ResidentBell compact />
        {/* The avatar opens Settings, where text size lives: the place a
            phone user reaches for when something is hard to read. */}
        <Link href="/resident/settings" aria-label="Settings" className="press rounded-full">
          <Avatar name={ownerName} />
        </Link>
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
  badges = {},
  pinned = false,
}: {
  pathname: string;
  tabs: typeof residentTabs;
  badges?: ReturnType<typeof useResidentBadges>;
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
  const moreHrefs = tabs.filter((t) => t.webOnly).map((t) => t.href);
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
          // More stays lit on any page it lists, so the reader knows where
          // they came from and how to get back.
          const active =
            href === "/resident"
              ? pathname === href
              : href === "/resident/more"
                ? pathname.startsWith(href) || moreHrefs.some((m) => pathname.startsWith(m))
                : pathname.startsWith(href);
          // A section's badge rides its phone tab; a ballot's rides More,
          // since Meetings has no tab of its own there.
          const badge =
            badges[href] ??
            (href === "/resident/more"
              ? Object.entries(badges).find(([k]) => moreHrefs.includes(k))?.[1]
              : undefined);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex min-h-14 flex-col items-center gap-1 pb-2 pt-2 transition-colors",
                  active ? TAB_ACTIVE[tint] : "text-fg-muted hover:text-fg",
                )}
              >
                {/* Remounts when it becomes selected, so the tab pops once
                    under the thumb instead of only changing colour. */}
                <span
                  key={active ? "on" : "off"}
                  className={cn(
                    "relative flex h-7 w-full max-w-11 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out",
                    active ? cn("pop-in scale-100", TAB_PILL[tint]) : "scale-95",
                  )}
                >
                  <Icon className="size-[19px]" strokeWidth={active ? 2.3 : 1.8} />
                  {badge && badge.count > 0 ? (
                    <span
                      className={cn(
                        "tnum absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                        badge.tone === "danger" ? "bg-danger" : badge.tone === "warn" ? "bg-warn" : "bg-fg-muted",
                      )}
                      aria-label={`${badge.count} waiting`}
                    >
                      {badge.count}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    // Fixed px, not the type scale: a sixth of 320px is the
                    // hard limit. 11px is the least that "Community" fits in
                    // whole; wider phones get more.
                    "block max-w-full truncate text-[11px] tracking-[-0.01em] min-[375px]:text-[12px] min-[430px]:text-[13px] min-[430px]:tracking-normal",
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
