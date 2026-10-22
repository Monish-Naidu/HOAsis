/**
 * A real Node process with the production telemetry configuration, run by
 * tests/unit/telemetry-spans.test.ts. Vitest's module runner hides `http`
 * from the instrumentation's require hook, so the spans are made here, in
 * plain Node as the container makes them, and printed as one JSON line.
 *
 * The Azure exporter is pointed at a closed loopback port: nothing leaves
 * the machine. A processor after the scrubber, where the exporter's batch
 * processor sits, records each span as it ends; one before it records the
 * attributes as the instrumentation set them, to prove the markers were
 * really there.
 */
import { createRequire } from "node:module";

process.env.APPLICATIONINSIGHTS_STATSBEAT_DISABLED_ALL = "true";
process.env.MICROSOFT_OTEL_SDKSTATS_DISABLED = "true";
process.env.OTEL_NODE_RESOURCE_DETECTORS = "env";

const markers = JSON.parse(process.argv[2]);
const require = createRequire(import.meta.url);
const { telemetryOptions, fetchInstrumentation } = await import("../../telemetry.mjs");
const { useMicrosoftOpenTelemetry: startTelemetry } = await import("@microsoft/opentelemetry");
const { registerInstrumentations } = await import("@opentelemetry/instrumentation");
const { trace, SpanStatusCode } = await import("@opentelemetry/api");

const raw = [];
const ended = [];
const noop = { forceFlush: () => Promise.resolve(), shutdown: () => Promise.resolve() };

const connectionString =
  "InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=http://127.0.0.1:9/;LiveEndpoint=http://127.0.0.1:9/";
const options = telemetryOptions(connectionString);
startTelemetry({
  ...options,
  azureMonitor: {
    ...options.azureMonitor,
    azureMonitorExporterOptions: { connectionString, disableOfflineStorage: true },
  },
  spanProcessors: [
    { ...noop, onStart: (span) => raw.push({ ...span.attributes }), onEnd: () => {} },
    ...options.spanProcessors,
    {
      ...noop,
      onStart: () => {},
      onEnd: (span) =>
        ended.push({
          name: span.name,
          kind: span.kind,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanContext?.spanId,
          attributes: { ...span.attributes },
          events: span.events.map((e) => ({ name: e.name, attributes: { ...e.attributes } })),
          status: { ...span.status },
          durationNs: span.duration[0] * 1e9 + span.duration[1],
        }),
    },
  ],
});
registerInstrumentations({ instrumentations: [fetchInstrumentation()] });

const http = require("http");
const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

const upstream = http.createServer((request, response) => {
  response.writeHead(request.url.startsWith("/fail") ? 502 : 200);
  response.end("ok");
});
const upstreamPort = await listen(upstream);

const app = http.createServer(async (_request, response) => {
  const base = `http://127.0.0.1:${upstreamPort}`;
  const units = await fetch(
    `${base}/rest/v1/units?email=${encodeURIComponent(markers.email)}&apikey=${markers.stripe}&token=${markers.token}#${markers.fragment}`,
    { headers: { authorization: `Bearer ${markers.jwt}` } },
  );
  await units.text();
  const failing = await fetch(`${base}/fail?access_token=${markers.token}`);
  await failing.text();
  const span = trace.getActiveSpan();
  span?.recordException(
    new Error(`could not reach ${markers.email} with password=${markers.password}`),
  );
  span?.setStatus({
    code: SpanStatusCode.ERROR,
    message: `failed for ${markers.email} ${markers.stripe}`,
  });
  response.writeHead(500);
  response.end("nope");
});
const appPort = await listen(app);

const status = await new Promise((resolve, reject) => {
  const request = http.request(
    {
      host: "127.0.0.1",
      port: appPort,
      auth: `user:${markers.password}`,
      path: `/api/join/lookup?code=${markers.token}&email=${encodeURIComponent(markers.email)}&key=${markers.stripe}`,
      headers: { referer: `http://127.0.0.1/start?token=${markers.token}` },
    },
    (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    },
  );
  request.on("error", reject);
  request.end();
});
await new Promise((resolve) => setTimeout(resolve, 50));
app.close();
upstream.close();

// No shutdown: its final flush would only retry the closed port.
process.stdout.write(`SPANS ${JSON.stringify({ status, raw, ended })}\n`, () => process.exit(0));
