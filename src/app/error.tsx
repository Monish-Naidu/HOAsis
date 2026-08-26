"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { Wordmark } from "@/components/app/logo";

/** Route level fallback. Next renders this when a segment throws. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[hoasis] route error${error.digest ? ` ${error.digest}` : ""}: ${error.message}`);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5">
        <Wordmark size={32} />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-20">
        <Card className="w-full max-w-md p-6">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-warn-soft text-warn">
            <AlertTriangle className="size-5" />
          </span>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
            This page did not load
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
            Nothing was lost. Try again, or head back and come at it from another direction.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-[13px] text-fg-subtle">Reference {error.digest}</p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <Button variant="primary" size="md" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
            <Link
              href="/signin"
              className="inline-flex h-9 items-center rounded-lg border border-border-2 px-4 text-[15px] font-medium text-fg hover:bg-surface-2"
            >
              Back to sign in
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
