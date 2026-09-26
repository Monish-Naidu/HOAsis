"use client";

import { useEffect } from "react";
import { newRequestId } from "@/lib/log";

/**
 * Posting what a browser caught to /api/log.
 *
 * `reportClientError` is what the error pages call with the reference they
 * are showing. `ErrorReporter` renders nothing and listens for the errors
 * nobody caught: a rejected promise with no handler, a throw outside React.
 * A few per page load is the cap; a loop reports itself once, not forever.
 */

const MAX_PER_PAGE = 5;
let reported = 0;

export interface ClientErrorReport {
  reference: string;
  message: string;
  stack?: string | null;
  digest?: string | null;
  route?: string;
  level?: "info" | "warn" | "error";
  extra?: Record<string, unknown>;
}

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === "undefined") return;
  if (reported >= MAX_PER_PAGE) return;
  reported += 1;
  const body = JSON.stringify({
    reference: report.reference,
    message: report.message.slice(0, 500),
    stack: report.stack?.slice(0, 4000) ?? null,
    route: report.route ?? window.location.pathname,
    level: report.level ?? "error",
    extra: { ...(report.extra ?? {}), digest: report.digest ?? undefined, href: window.location.href },
  });
  try {
    // keepalive so a report survives the navigation that often follows an error.
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never be the second error.
  }
}

function describe(reason: unknown): { message: string; stack: string | null } {
  if (reason instanceof Error) return { message: reason.message || reason.name, stack: reason.stack ?? null };
  if (typeof reason === "string") return { message: reason, stack: null };
  try {
    return { message: JSON.stringify(reason).slice(0, 300), stack: null };
  } catch {
    return { message: String(reason), stack: null };
  }
}

// Browser noise that is not a bug in this app.
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed/i, /NetworkError when attempting to fetch/i];

export function ErrorReporter() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const { message, stack } = describe(event.reason);
      if (!message || IGNORED.some((re) => re.test(message))) return;
      reportClientError({ reference: newRequestId(), message, stack, extra: { kind: "unhandledrejection" } });
    };
    const onError = (event: ErrorEvent) => {
      const { message, stack } = describe(event.error ?? event.message);
      if (!message || IGNORED.some((re) => re.test(message))) return;
      reportClientError({ reference: newRequestId(), message, stack, extra: { kind: "window.error" } });
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
