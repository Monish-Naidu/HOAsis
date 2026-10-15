import { useMicrosoftOpenTelemetry as startTelemetry } from "@microsoft/opentelemetry";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";

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

function start() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString || globalThis[STARTED]) return false;
  globalThis[STARTED] = true;

  // Microsoft's distro: the global tracer, meter and logger providers, the
  // `http` instrumentation (Stripe's SDK uses `https`), standard metrics,
  // CPU and memory, and the live view in the portal.
  startTelemetry({
    azureMonitor: {
      azureMonitorExporterOptions: { connectionString },
      enableLiveMetrics: true,
      enableStandardMetrics: true,
      enablePerformanceCounters: true,
    },
    // Every request, at this volume. Lower it when the bill says so.
    samplingRatio: 1,
    instrumentationOptions: {
      http: { ignoreIncomingRequestHook: (request) => isNoise(request.url) },
    },
  });
  // Supabase and Resend go through `fetch`, which is undici in Node; the
  // distro does not carry that one.
  registerInstrumentations({ instrumentations: [new UndiciInstrumentation()] });
  return true;
}

/** True when this load was the one that started telemetry. */
export const started = start();
