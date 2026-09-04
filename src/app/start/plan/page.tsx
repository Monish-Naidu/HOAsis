import { Suspense } from "react";
import Link from "next/link";
import { PlanScreen } from "./plan-screen";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";

export const metadata = { title: "What is next" };

export default function PlanPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <Link href="/board">
          <Wordmark size={32} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/board"
            className="inline-flex h-8 items-center rounded-lg px-3 text-[15px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Skip for now
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">
        {/* The flow reads ?task= to open at one question. */}
        <Suspense>
          <PlanScreen />
        </Suspense>
      </main>
    </div>
  );
}
