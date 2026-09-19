import Link from "next/link";
import { BoardNav } from "@/components/app/board-nav";
import { RequireCapability } from "@/components/app/require-capability";
import { BoardOnly } from "@/components/app/board-only";
import { SetupReturnBar } from "@/components/app/setup-return-bar";
import { LocalCopyBanner } from "@/components/app/local-copy-banner";
import { TrialBanner } from "@/components/app/trial-banner";
import { BillingGate } from "@/components/app/billing-gate";
import {
  AccountMenu,
  RequireSession,
  ViewSwitcher,
} from "@/components/app/account-menu";
import { BoardHero, CommunityName } from "@/components/app/community-hero";
import { BoardBell } from "@/components/app/notifications";
import { ThemeToggle } from "@/components/app/theme";
import { Wordmark } from "@/components/app/logo";
import { Rail } from "@/components/app/rail";
import { PageTransition } from "@/components/app/page-transition";

export const metadata = {
  title: { default: "Board", template: "%s · Your HOAsis" },
};

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireSession>
      <BoardOnly>
        <div className="page-ground min-h-dvh bg-bg lg:pl-[16.5rem]">
          {/* The sidebar floats: inset from the edges with a large radius, to
            match the resident shell. The community's name is not here; the
            banner already says it. */}
          <Rail home="/board" label="Board">
            <BoardNav variant="rail" />
          </Rail>
          <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
              <div className="flex items-center gap-3">
                <Link href="/" className="lg:hidden">
                  <Wordmark />
                </Link>
                <span className="hidden h-5 w-px bg-border sm:block lg:hidden" />
                <CommunityName />
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <ViewSwitcher />
                <BoardBell />
                <ThemeToggle className="hidden sm:inline-flex" />
                <AccountMenu />
              </div>
            </div>
            {/* Horizontal nav on narrow screens */}
            <div className="no-scrollbar overflow-x-auto border-t border-border px-3 py-1.5 lg:hidden">
              <BoardNav />
            </div>
          </header>

          <BoardHero />

          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6 lg:py-8">
            <main className="min-w-0">
              <LocalCopyBanner />
              <TrialBanner />
              <SetupReturnBar />
              <BillingGate>
                <RequireCapability>
                  <PageTransition>{children}</PageTransition>
                </RequireCapability>
              </BillingGate>
            </main>
          </div>
        </div>
      </BoardOnly>
    </RequireSession>
  );
}
