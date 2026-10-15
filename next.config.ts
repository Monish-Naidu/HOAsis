import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // The container image (Dockerfile) runs the standalone server, which is
  // the whole app and the parts of node_modules it reaches, nothing else.
  // Only when asked for: `next start` and the browser suite want the
  // ordinary output, and standalone makes `next start` complain.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // The trace that decides what standalone carries takes two files of
  // @swc/helpers and misses the ESM ones Next's own require hook asks for at
  // start, with pnpm's layout. Carry the whole package; it is small.
  outputFileTracingIncludes:
    process.env.BUILD_STANDALONE === "1"
      ? { "/**": ["./node_modules/.pnpm/@swc+helpers*/node_modules/@swc/helpers/**"] }
      : undefined,
  async redirects() {
    return [
      // The board shell lived at /admin until 2026-09-01. Old deep links keep
      // working; permanent, because the old name is not coming back. The bare
      // /admin is the owner's ops page since 2026-09-25 (docs/observability.md),
      // so the pattern is `:path+`, one segment or more. `:path*` also matches
      // none, and sent /admin itself to /board before the page was looked at.
      { source: "/admin/:path+", destination: "/board/:path+", permanent: true },
    ];
  },
};

/**
 * Sentry's build step: source maps to Sentry when SENTRY_AUTH_TOKEN is set
 * (nothing sets it today), nothing at all when it is not. The
 * runtime SDK is separately inert without a DSN (sentry.*.config.ts).
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  bundleSizeOptimizations: { excludeDebugStatements: true },
});
