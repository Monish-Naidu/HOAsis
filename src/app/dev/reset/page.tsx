import Link from "next/link";
import { Wordmark } from "@/components/app/logo";
import { TestTools } from "./test-tools";

export const metadata = { title: "Test data" };

/**
 * Clearing up after testing.
 *
 * Reachable only when ALLOW_TEST_RESET is set on the server. The page renders
 * either way; the endpoints behind it refuse, which is the protection that
 * matters, because a URL can be guessed and an absent environment variable
 * cannot be talked into existing.
 */
export default function DevResetPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <Link href="/">
          <Wordmark size={32} />
        </Link>
        <Link
          href="/signin"
          className="text-[13px] font-medium text-fg-muted hover:text-fg"
        >
          Sign in
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <TestTools />
      </main>
    </div>
  );
}
