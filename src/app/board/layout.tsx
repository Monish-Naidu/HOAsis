import Link from "next/link";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { BoardNav } from "@/components/app/board-nav";
import { ThemeToggle } from "@/components/app/theme";
import { Wordmark } from "@/components/app/logo";
import { Avatar } from "@/components/ui/primitives";
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

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  const recon = reconciliation();
  const comp = complianceSummary();
  const gaps = vendorGaps();

  const badges = {
    money: { count: recon.needsReview.length, tone: "warn" as const },
    requests: { count: openRequests().length, tone: "neutral" as const },
    compliance: {
      count: comp.overdue.length + comp.dueSoon.length,
      tone: comp.overdue.length ? ("danger" as const) : ("warn" as const),
    },
    communications: { count: unreadThreadCount(), tone: "neutral" as const },
    voting: { count: openBallots().length, tone: "neutral" as const },
    homeowners: { count: delinquency().past.length, tone: "warn" as const },
    vendors: { count: gaps.missingW9.length + gaps.expiringCoi.length, tone: "warn" as const },
  };

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Wordmark />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-fg hover:bg-surface-2 sm:inline-flex"
            >
              {association.name}
              <ChevronDown className="size-3.5 text-fg-subtle" />
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/resident"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-2 px-2.5 text-[12px] font-medium text-fg hover:bg-surface-2 sm:text-[13px]"
            >
              <ArrowLeftRight className="size-3.5" />
              <span className="hidden sm:inline">See the resident view</span>
              <span className="sm:hidden">Resident</span>
            </Link>
            <ThemeToggle className="hidden sm:inline-flex" />
            <div className="flex items-center gap-2">
              <Avatar name="Arya Mehr" />
              <div className="hidden leading-tight lg:block">
                <p className="text-[13px] font-medium text-fg">Arya Mehr</p>
                <p className="text-[11px] text-fg-muted">President</p>
              </div>
            </div>
          </div>
        </div>
        {/* Horizontal nav on narrow screens */}
        <div className="no-scrollbar overflow-x-auto border-t border-border px-3 py-1.5 lg:hidden">
          <BoardNav badges={badges} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-4 py-6 lg:px-6 lg:py-8">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-24">
            <BoardNav badges={badges} />
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
  );
}
