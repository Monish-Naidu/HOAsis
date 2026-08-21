import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { Wordmark } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5">
        <Wordmark size={32} />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-20">
        <Card className="w-full max-w-md p-6">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-fg">
            <Compass className="size-5" />
          </span>
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">
            There is nothing here
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
            The link may be old, or the record may belong to a different account.
          </p>
          <Link
            href="/signin"
            className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[13px] font-medium text-brand-fg"
          >
            Back to sign in
          </Link>
        </Card>
      </main>
    </div>
  );
}
