import type { Instrumentation } from "next";
import { logger, REQUEST_ID_HEADER } from "@/lib/log";

/**
 * Server instrumentation (Next's convention: this file, in src/).
 *
 * `register` starts Application Insights on the Node runtime; the Edge
 * runtime (the proxy) runs nothing extra. `onRequestError` is called for
 * every error the server catches while rendering or handling a route: it
 * goes to the log as one JSON line, which the telemetry sink forwards to
 * Application Insights as an exception, and into app_errors so /admin lists
 * it. The request id from the proxy is on the incoming headers, so the row,
 * the line and the exception all carry the same reference.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const header = request.headers[REQUEST_ID_HEADER];
  const requestId = Array.isArray(header) ? header[0] : header;
  const log = logger(context.routePath || request.path, null, { requestId });
  const err = error instanceof Error ? error : new Error(String(error));
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  log.error("unhandled server error", {
    err,
    digest,
    method: request.method,
    path: request.path,
    routeType: context.routeType,
  });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import: the admin client must not be bundled into the Edge runtime.
    const { recordAppError } = await import("@/lib/app-errors");
    await recordAppError({
      reference: requestId,
      source: "server",
      route: context.routePath || request.path,
      message: err.message,
      stack: err.stack,
      userAgent: Array.isArray(request.headers["user-agent"])
        ? request.headers["user-agent"][0]
        : request.headers["user-agent"],
      extra: { digest, method: request.method, path: request.path, routeType: context.routeType },
    });
  }
};
