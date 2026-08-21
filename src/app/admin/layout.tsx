import Link from "next/link";
import { AdminNav } from "@/components/app/admin-nav";
import { AccountMenu, RequireSession, ViewSwitcher } from "@/components/app/account-menu";
import { CommunityHero, CommunityName } from "@/components/app/community-hero";
import { ThemeToggle } from "@/components/app/theme";
import { Wordmark } from "@/components/app/logo";
import {
  association,
  complianceSummary,
  openBallots,
  delinquency,
  openRequests,
  reconciliation,
  unreadThreadCount,
  vendorGaps,
} from "@/lib/data";

export const metadata = { title: { default: "Board", template: "%s · HOAsis" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const recon = reconciliation();
  const comp = complianceSummary();
  const gaps = vendorGaps();

  const badges: Record<string, { count: number; tone: "danger" | "warn" | "neutral" }> = {
    money: { count: recon.needsReview.length, tone: "warn" },
    requests: { count: openRequests().length, tone: "neutral" },
    compliance: {
      count: comp.overdue.length + comp.dueSoon.length,
      tone: comp.overdue.length ? "danger" : "warn",
    },
    communications: { count: unreadThreadCount(), tone: "neutral" },
    voting: { count: openBallots().length, tone: "neutral" },
    homeowners: { count: delinquency().past.length, tone: "warn" },
    vendors: { count: gaps.missingW9.length + gaps.expiringCoi.length, tone: "warn" },
  };

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
          <AdminNav badges={badges} />
        </div>
      </header>

      <CommunityHero subtitle={`${association.addressLine} · ${association.unitCount} homes`} compact />

      <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-4 py-6 lg:px-6 lg:py-8">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-24">
            <AdminNav badges={badges} />
            <div className="mt-6 rounded-card border border-border bg-surface p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                Support
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">
                Phone and chat, 7am–11pm, every day.
              </p>
              <p className="mt-2 text-[13px] font-semibold text-fg">(888) 555-0199</p>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
    </RequireSession>
  );
}
