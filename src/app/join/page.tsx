import { Suspense } from "react";
import Link from "next/link";
import { JoinPanel } from "./join-panel";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";

export const metadata = { title: "Join your association" };

export default function JoinPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Wordmark size={34} />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <Suspense fallback={null}>
            <JoinPanel />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
