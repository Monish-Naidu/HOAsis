import { useMicrosoftOpenTelemetry as startTelemetry } from "@microsoft/opentelemetry";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { RedactingSpanProcessor } from "./redact.mjs";

/**
 * Application Insights, started before Next loads (docs/observability.md).
 *
 * The container runs `node --import ./telemetry.mjs server.js`. The order
 * matters: the instrumentation hooks `http` and `fetch` when they are first
 * required, so a start from inside Next, after its server exists, misses
 * the incoming requests and their outbound calls. Plain JavaScript so Node
 * loads it with no build step; `src/instrumentation.node.ts` imports it
 * too, which is what carries these packages into the standalone output and
 * gives a plain `next start` the late, partial version.
 *
 * With no APPLICATIONINSIGHTS_CONNECTION_STRING nothing starts: no network,
 * no patching. Local dev, the unit tests and the browser suite never set it.
 */
const STARTED = Symbol.for("hoasis.telemetry.started");

/** The uptime test and Next's static files would be most of the rows. */
function isNoise(url) {
  return !url || url === "/api/health" || url.startsWith("/_next/");
}

/**
 * The distro's options. Exported so the instrumentation test starts the
 * same configuration against a local ingestion endpoint.
 */
export function telemetryOptions(connectionString) {
  return {
    azureMonitor: {
      azureMonitorExporterOptions: { connectionString },
      enableLiveMetrics: true,
      enableStandardMetrics: true,
      enablePerformanceCounters: true,
    },
    // Every request, at this volume. Lower it when the bill says so. The
    // distro's default rate limit of five traces a second would otherwise
    // replace the ratio and drop most spans of a busy moment.
    samplingRatio: 1,
    tracesPerSecond: 0,
    // Query strings, emails and keys are scrubbed from every span before
    // the live view or the exporter reads it (redact.mjs).
    spanProcessors: [new RedactingSpanProcessor()],
    instrumentationOptions: {
      // `enabled` must be named: an `http` entry without it replaces the
      // distro's default and turns the instrumentation off.
      http: { enabled: true, ignoreIncomingRequestHook: (request) => isNoise(request.url) },
    },
  };
}

/** Supabase and Resend go through `fetch`, which is undici in Node; the distro does not carry that one. */
export function fetchInstrumentation() {
  return new UndiciInstrumentation();
}

function start() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString || globalThis[STARTED]) return false;
  globalThis[STARTED] = true;

  // Microsoft's distro: the global tracer, meter and logger providers, the
  // `http` instrumentation (Stripe's SDK uses `https`), standard metrics,
  // CPU and memory, and the live view in the portal.
  startTelemetry(telemetryOptions(connectionString));
  registerInstrumentations({ instrumentations: [fetchInstrumentation()] });
  return true;
}

/** True when this load was the one that started telemetry. */
export const started = start();
