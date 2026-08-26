"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Monitor, Smartphone } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/app/theme";
import { Wordmark } from "@/components/app/logo";
import { residentTabs } from "@/components/app/resident-nav";
import { AccountMenu, RequireSession, ViewSwitcher } from "@/components/app/account-menu";
import { CommunityHero } from "@/components/app/community-hero";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import type { CommunitySettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function visibleTabs(settings: CommunitySettings) {
  return residentTabs.filter((t) => !t.visible || t.visible(settings));
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
  const { settings } = useAppState();
  const owner = useCurrentOwner();
  const associationName = settings.displayName;
  const tabs = visibleTabs(settings);
  const ownerName = owner?.members[0] ?? "";
  const unit = owner?.unit ?? "";
  const address = owner?.address ?? "";

  const topBar = (
    <header className="hidden border-b border-border bg-surface lg:block">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3">
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
              App preview
            </button>
          </div>
          <ViewSwitcher />
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
        <p className="truncate text-[13px] text-fg-muted">
          Unit {unit} · {address}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2"
        >
          <Bell className="size-[18px]" strokeWidth={1.9} />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />
        </button>
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
            <PhoneHeader
              associationName={associationName}
              ownerName={ownerName}
              unit={unit}
              address={address}
            />
            <main className="no-scrollbar flex-1 overflow-y-auto pb-6">
              <CommunityHero compact />
              <div className="px-4 pt-4">{children}</div>
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
    <div className="min-h-dvh bg-bg">
      {topBar}
      {appHeader}
      <CommunityHero subtitle={`Unit ${unit} · ${address}`} />
      <div className="mx-auto flex w-full max-w-6xl gap-10 px-4 pb-24 pt-6 lg:px-6 lg:py-8 lg:pb-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="no-scrollbar sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-[15px] font-semibold text-fg">{associationName}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">
                Unit {unit}
                <br />
                {address}
              </p>
            </div>
            <nav aria-label="Resident sections" className="mt-4 flex flex-col gap-1">
              {tabs.map(({ href, label, icon: Icon, webLabel }) => {
                const active =
                  href === "/resident" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-brand-soft text-brand-soft-fg"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    {webLabel ?? label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 rounded-card border border-border bg-surface p-3">
              <p className="text-[13px] font-semibold text-fg-muted">
                Need a person
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                Phone and chat, 7am to 11pm, every day.
              </p>
              <p className="mt-2 text-[15px] font-semibold text-fg">(888) 555-0199</p>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 lg:max-w-2xl">{children}</main>
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
  unit,
  address,
}: {
  associationName: string;
  ownerName: string;
  unit: string;
  address: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {associationName}
        </p>
        <p className="truncate text-[13px] text-fg-muted">
          Unit {unit} · {address}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2"
        >
          <Bell className="size-[18px]" strokeWidth={1.9} />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />
        </button>
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
      <ul className="grid grid-cols-6">
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
                <Icon className="size-[19px]" strokeWidth={active ? 2.3 : 1.8} />
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
