import Link from "next/link";
import { AdminNav } from "@/components/app/admin-nav";
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
          <aside className="hidden w-52 shrink-0 lg:block">
            {/* Travels with the reader, and scrolls itself if the viewport is
                shorter than the nav rather than being cut off. */}
            <div className="no-scrollbar sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-4">
              <AdminNav />
              <div className="mt-6 rounded-card border border-border bg-surface p-3">
                <p className="text-[13px] font-semibold text-fg-muted">
                  Support
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                  Phone and chat, 7am to 11pm, every day.
                </p>
                <p className="mt-2 text-[15px] font-semibold text-fg">(888) 555-0199</p>
              </div>
            </div>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </RequireSession>
  );
}
