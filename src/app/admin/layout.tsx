import Link from "next/link";
import { AdminNav } from "@/components/app/admin-nav";
import { RequireCapability } from "@/components/app/require-capability";
import { SetupReturnBar } from "@/components/app/setup-return-bar";
import { LocalCopyBanner } from "@/components/app/local-copy-banner";
import { AccountMenu, RequireSession, ViewSwitcher } from "@/components/app/account-menu";
import { CommunityHero, CommunityName } from "@/components/app/community-hero";
import { ThemeToggle } from "@/components/app/theme";
import { Wordmark } from "@/components/app/logo";

export const metadata = { title: { default: "Board", template: "%s · HOAsis" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession>
      <div className="min-h-dvh bg-bg">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Wordmark />
              </Link>
              <span className="hidden h-5 w-px bg-border sm:block" />
              <CommunityName />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ViewSwitcher />
              <ThemeToggle className="hidden sm:inline-flex" />
              <AccountMenu />
            </div>
          </div>
          {/* Horizontal nav on narrow screens */}
          <div className="no-scrollbar overflow-x-auto border-t border-border px-3 py-1.5 lg:hidden">
            <AdminNav />
          </div>
        </header>

        <CommunityHero withLocation compact />

        <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-4 py-6 lg:px-6 lg:py-8">
          <aside className="hidden w-56 shrink-0 lg:block">
            {/* Travels with the reader, and scrolls itself if the viewport is
                shorter than the nav rather than being cut off. */}
            <div className="no-scrollbar sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-4">
              {/* The navy rail from the dashboard design: a fixed surface in
                  both themes, like the device bezels. */}
              <div className="rounded-card bg-navy-950 p-2 shadow-card ring-1 ring-navy-700/40">
                <AdminNav variant="rail" />
              </div>
              {/* A phone number and "7am to 11pm, every day" sat here. Neither
                  was true, and a support commitment nobody can honour is the
                  worst kind of copy to ship: it is believed. The library is
                  real, free, and the thing most questions are actually about. */}
              <div className="mt-6 rounded-card border border-border bg-surface p-3">
                <p className="text-[13px] font-semibold text-fg-muted">Stuck on something</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                  The library covers what your state requires, in plain words.
                </p>
                <Link
                  href="/library"
                  className="mt-2 inline-block text-[15px] font-semibold text-brand hover:underline"
                >
                  Open the library
                </Link>
              </div>
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            <LocalCopyBanner />
            <SetupReturnBar />
            <RequireCapability>{children}</RequireCapability>
          </main>
        </div>
      </div>
    </RequireSession>
  );
}
