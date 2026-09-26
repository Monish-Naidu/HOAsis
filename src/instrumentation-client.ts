import * as Sentry from "@sentry/nextjs";

/**
 * Sentry in the browser. Runs before the app is interactive (Next's
 * instrumentation-client convention). With no NEXT_PUBLIC_SENTRY_DSN the
 * SDK is disabled and this file does nothing observable.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // No session replay integration on purpose: it records screens with
  // balances and addresses on them.
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
