"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { themeScript } from "@/components/app/theme";
import { reportClientError } from "@/components/app/error-reporter";
import { referenceFor } from "@/lib/log";
import "./globals.css";

/**
 * The fallback when the root layout itself throws.
 *
 * Renders its own <html> and <body>, because it replaces the layout that
 * would normally provide them, and re-applies the theme script so it reads
 * right in dark mode. Kept to plain elements and semantic tokens on purpose:
 * the less this page imports, the less can fail with it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = referenceFor(error);

  useEffect(() => {
    Sentry.captureException(error, { tags: { reference } });
    reportClientError({
      reference,
      message: error.message || error.name,
      stack: error.stack,
      digest: error.digest,
      extra: { boundary: "global" },
    });
  }, [error, reference]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong · Your HOAsis</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col bg-bg text-fg">
          <main className="flex flex-1 items-center justify-center px-5 pb-20 pt-10">
            <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-card">
              <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">
                Something went wrong
              </h1>
              <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
                The page could not be shown. Reload to try again. If it keeps happening, tell
                us the reference below.
              </p>
              <p className="mt-3 text-footnote text-fg-muted">
                Reference{" "}
                <span className="font-mono font-semibold tracking-wide text-fg">{reference}</span>
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="press inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-body font-semibold text-brand-fg"
                >
                  Try again
                </button>
                <a
                  href="/signin"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-border-2 px-5 text-body font-semibold text-fg"
                >
                  Back to sign in
                </a>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
