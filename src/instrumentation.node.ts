import { started } from "../telemetry.mjs";
import { setLogSink } from "@/lib/log";
import { telemetrySink } from "@/lib/telemetry";

/**
 * Application Insights on the Node runtime (docs/observability.md).
 *
 * The container starts telemetry before Next loads (`node --import
 * ./telemetry.mjs server.js`), so by the time this runs the import above
 * finds it started and does nothing more than carry telemetry.mjs and its
 * packages into the standalone output. Under a plain `next start` the
 * import is the start, late but working. Either way, once telemetry is on,
 * the log goes through the sink that adds the trace ids and forwards the
 * warnings and errors.
 */
if (started || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  setLogSink(telemetrySink);
}
