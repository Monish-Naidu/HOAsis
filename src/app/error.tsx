"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, ButtonLink, Card, IconTile } from "@/components/ui/primitives";
import { Wordmark } from "@/components/app/logo";
import { reportClientError } from "@/components/app/error-reporter";
import { referenceFor } from "@/lib/log";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";

/**
 * Route level fallback. Next renders this when a segment throws.
 *
 * The reference is the server's digest when the error came from the server
 * (it is already in that log line), else an id minted for this error, and
 * either way it is posted to /api/log so /admin has the row. A resident
 * reads the code out; the owner finds it. See docs/observability.md.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = referenceFor(error);

  useEffect(() => {
    console.error(`[hoasis] route error ${reference}: ${error.message}`);
    reportClientError({
      reference,
      message: error.message || error.name,
      stack: error.stack,
      digest: error.digest,
      extra: { boundary: "route" },
    });
  }, [error, reference]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5">
        <Wordmark size={32} />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-5 pb-20">
        <Card className="w-full max-w-md p-6">
          <IconTile icon={AlertTriangle} tint="amber" size="md" className="mb-4" />
          <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">
            Something went wrong
          </h1>
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
            Nothing was lost. Try again, or go back and try another way.
            If it keeps happening, write to{" "}
            <a href={supportMailto("Something went wrong")} className="font-medium text-accent underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>{" "}
            with the reference below.
          </p>
          <p className="mt-3 text-footnote text-fg-muted">
            Reference{" "}
            <span className="font-mono font-semibold tracking-wide text-fg">{reference}</span>
          </p>
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
