import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignInPanel } from "./sign-in-panel";
import { CommunityMasthead, CommunityPanel } from "./community-identity";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";

export const metadata = { title: "Sign in" };

/**
 * Two columns, because there was width going spare and the page read as a
 * narrow strip floating on a washed out photograph.
 *
 * The photograph gets its own half at full strength, which is the only way it
 * says "this is your community" rather than reading as noise. The form gets a
 * plain surface, which is where a form is easiest to fill in. Below the large
 * breakpoint the photograph goes away entirely rather than shrinking, since a
 * letterboxed strip of it would say nothing.
 */
export default function AuthLanding() {
  return (
    <div className="grid min-h-dvh items-start bg-bg lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      <CommunityPanel />

      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="lg:hidden">
            <Wordmark size={34} />
          </Link>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[26rem]">
            <div className="mb-8 hidden lg:block">
              <Link href="/">
                <Wordmark size={36} />
              </Link>
            </div>
            <CommunityMasthead />
            {/* Reads the error a failed confirmation link bounces back with,
                which makes this page dynamic unless it is wrapped. */}
            <Suspense fallback={null}>
              <SignInPanel />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
