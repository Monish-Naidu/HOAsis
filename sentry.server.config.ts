import * as Sentry from "@sentry/nextjs";

/**
 * Sentry on the Node runtime (route handlers, server components, crons).
 * Loaded by src/instrumentation.ts. With no DSN the SDK is disabled: no
 * network, no console output. See docs/observability.md for the env vars.
 */
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // One in ten requests carries a trace. Errors are always sent.
  tracesSampleRate: 0.1,
  debug: false,
});
