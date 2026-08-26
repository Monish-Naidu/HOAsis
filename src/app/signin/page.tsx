import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignInPanel } from "./sign-in-panel";
import { CommunityBackdrop, CommunityMasthead } from "./community-identity";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";



export const metadata = { title: "Sign in" };

export default function AuthLanding() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <CommunityBackdrop />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[45dvh] bg-gradient-to-b from-transparent to-bg"
        aria-hidden
      />

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Wordmark size={34} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <CommunityMasthead />
          <SignInPanel />
        </div>
      </main>
    </div>
  );
}
