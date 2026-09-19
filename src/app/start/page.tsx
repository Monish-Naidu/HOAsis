import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SetupWizard } from "./setup-wizard";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";

export const metadata = {
  title: "Set up your association",
  description: "Create an association on Your HOAsis in a few minutes.",
};

export default function StartPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-8">
        <Link href="/">
          <Wordmark size={32} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">
        <SetupWizard />
      </main>
    </div>
  );
}
