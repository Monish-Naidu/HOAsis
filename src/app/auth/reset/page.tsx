import Link from "next/link";
import { Wordmark } from "@/components/app/logo";
import { ResetPanel } from "./reset-panel";

export const metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/">
          <Wordmark size={34} />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-20">
        <div className="w-full max-w-sm">
          <ResetPanel />
        </div>
      </main>
    </div>
  );
}
