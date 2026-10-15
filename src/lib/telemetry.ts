import { context, trace } from "@opentelemetry/api";
import { logs, SeverityNumber, type LogRecord } from "@opentelemetry/api-logs";
import { consoleSink, type LogLine } from "@/lib/log";

/**
 * Where a log line goes when Application Insights is on (set by
 * src/instrumentation.node.ts): to the console as before, now with the ids
 * of the trace it was written in, and, for warnings and errors, to
 * Application Insights as a log record. A line with an `err` on it arrives
 * there as an exception, so the reference a person reads off the screen
 * finds the console line, the trace and the exception.
 *
 * Info lines stay on the console only: Log Analytics already keeps those,
 * and sending them twice would double the bill for nothing.
 */

export interface TraceIds {
  traceId: string;
  spanId: string;
}

/** The line with the trace's ids on it, or the line as it was. */
export function withTrace(line: LogLine, ids: TraceIds | null): LogLine {
  return ids ? { ...line, ...ids } : line;
}

/** The ids of the span this line is written in, if any. */
function activeTraceIds(): TraceIds | null {
  const span = trace.getSpan(context.active());
  if (!span) return null;
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}

const SEVERITY: Record<LogLine["level"], SeverityNumber> = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

type Attributes = Record<string, string | number | boolean>;

/**
 * The log record for a line. Scalars become attributes as they are,
 * objects as JSON; `err` (already name, message and stack after scrubbing)
 * becomes the exception fields Application Insights lists under Exceptions.
 */
export function logRecordFor(line: LogLine): LogRecord {
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(line)) {
    if (key === "ts" || key === "level" || key === "msg" || key === "err") continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = value;
    } else if (value != null) {
      attributes[key] = JSON.stringify(value);
    }
  }
  const err = line.err;
  if (err && typeof err === "object") {
    const { name, message, stack } = err as { name?: unknown; message?: unknown; stack?: unknown };
    attributes["exception.type"] = String(name ?? "Error");
    attributes["exception.message"] = String(message ?? line.msg);
    // The exporter files an exception only when a stack is there too.
    attributes["exception.stacktrace"] = typeof stack === "string" ? stack : "";
  }
  return {
    severityNumber: SEVERITY[line.level],
    severityText: line.level,
    body: line.msg,
    attributes,
  };
}

/** The sink: console first, then Application Insights for anything above info. */
export function telemetrySink(line: LogLine): void {
  const traced = withTrace(line, activeTraceIds());
  consoleSink(traced);
  if (traced.level !== "info") logs.getLogger("hoasis").emit(logRecordFor(traced));
}
