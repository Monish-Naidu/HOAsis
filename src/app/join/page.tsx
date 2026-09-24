import { Suspense } from "react";
import Link from "next/link";
import { JoinPanel } from "./join-panel";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";

export const metadata = { title: "Join your association" };

export default function JoinPage() {
  // The card sits in the middle of the screen on a faint aurora. Pinned to
  // the top of an empty page, it read as something that had failed to load.
  return (
    <div className="relative isolate grid min-h-dvh grid-rows-[auto_1fr] bg-bg">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-60" aria-hidden />
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Wordmark size={34} />
        </Link>
        <ThemeToggle />
      </header>
      <main className="grid place-items-center px-5 pb-16 pt-4">
        <div className="w-full max-w-sm">
          <Suspense fallback={null}>
            <JoinPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
