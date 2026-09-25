"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, ButtonLink, Card, IconTile } from "@/components/ui/primitives";
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
          <IconTile icon={AlertTriangle} tint="amber" size="md" className="mb-4" />
          <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">
            This page did not load
          </h1>
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
            Nothing was lost. Try again, or head back and come at it from another direction.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-footnote text-fg-subtle">Reference {error.digest}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
            <ButtonLink href="/signin" variant="secondary" size="lg">
              Back to sign in
            </ButtonLink>
          </div>
        </Card>
      </main>
    </div>
  );
}
