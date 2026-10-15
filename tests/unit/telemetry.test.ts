import { afterEach, describe, expect, it, vi } from "vitest";
import { logs, SeverityNumber, type LogRecord } from "@opentelemetry/api-logs";
import type { LogLine } from "@/lib/log";
import { logRecordFor, telemetrySink, withTrace } from "@/lib/telemetry";

const line: LogLine = {
  ts: "2026-10-15T14:00:17.811Z",
  level: "error",
  msg: "trial notice failed",
  requestId: "K7QM2X4P",
  route: "billing/sweep",
  durationMs: 605,
  associationId: "74ec47cf",
  kind: "ended",
  err: { name: "Error", message: "domain is not verified", stack: "Error: domain\n  at send" },
  counts: { sent: 0, failed: 1 },
};

afterEach(() => {
  logs.disable();
  vi.restoreAllMocks();
});

describe("withTrace", () => {
  it("adds the trace ids when there is a trace, and leaves the line alone when not", () => {
    expect(withTrace(line, { traceId: "t1", spanId: "s1" })).toMatchObject({
      traceId: "t1",
      spanId: "s1",
      msg: "trial notice failed",
    });
    expect(withTrace(line, null)).toBe(line);
  });
});

describe("logRecordFor", () => {
  it("maps the level, keeps scalars, flattens objects, and files the error as an exception", () => {
    const record = logRecordFor(line);
    expect(record.severityNumber).toBe(SeverityNumber.ERROR);
    expect(record.severityText).toBe("error");
    expect(record.body).toBe("trial notice failed");
    expect(record.attributes).toEqual({
      requestId: "K7QM2X4P",
      route: "billing/sweep",
      durationMs: 605,
      associationId: "74ec47cf",
      kind: "ended",
      counts: '{"sent":0,"failed":1}',
      "exception.type": "Error",
      "exception.message": "domain is not verified",
      "exception.stacktrace": "Error: domain\n  at send",
    });
  });

  it("is a plain record for a warning with no error on it", () => {
    const record = logRecordFor({ ...line, level: "warn", err: undefined });
    expect(record.severityNumber).toBe(SeverityNumber.WARN);
    expect(record.attributes).not.toHaveProperty("exception.type");
    expect(record.attributes).not.toHaveProperty("err");
  });

  it("gives an error without a stack an empty one, so it is still an exception", () => {
    const record = logRecordFor({ ...line, err: { name: "TypeError", message: "x" } });
    expect(record.attributes?.["exception.stacktrace"]).toBe("");
    expect(record.attributes?.["exception.type"]).toBe("TypeError");
  });
});

describe("telemetrySink", () => {
  function capture() {
    const records: LogRecord[] = [];
    logs.setGlobalLoggerProvider({
      getLogger: () => ({ enabled: () => true, emit: (r: LogRecord) => records.push(r) }),
    });
    return records;
  }

  it("prints the console line and sends errors on", () => {
    const records = capture();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    telemetrySink(line);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({ requestId: "K7QM2X4P" });
    expect(records).toHaveLength(1);
    expect(records[0].body).toBe("trial notice failed");
  });

  it("keeps info lines on the console only", () => {
    const records = capture();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    telemetrySink({ ...line, level: "info", err: undefined });
    expect(log).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(0);
  });
});
