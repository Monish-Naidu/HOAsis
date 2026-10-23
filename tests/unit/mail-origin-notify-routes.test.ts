import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * Every route that mints or sends mail with a link into the app takes its
 * origin from the one place that can vouch for it (src/lib/email/mail-origin.ts),
 * never from the request's Host or X-Forwarded-* headers: a caller who could
 * choose the host would receive somebody else's sign-in token. Each route is
 * driven here with its sender and database as stand-ins; what is tested is
 * the route's own part: hostile headers never reach the mail, and with no
 * safe origin nothing is minted, reserved or sent.
 */

const h = vi.hoisted(() => ({
  send: vi.fn<(message: { to: string; html: string; text: string }) => Promise<unknown>>(
    async () => ({ data: { id: "email-1" }, error: null }),
  ),
  sendNotification: vi.fn<(input: { origin?: string }) => Promise<unknown>>(async () => ({
    sent: 1,
    failed: 0,
    skipped: 0,
    already: 0,
    remaining: 0,
    errors: [],
  })),
  sendOfficeMessageNotice: vi.fn<(input: { origin?: string }) => Promise<unknown>>(async () => ({
    sent: 1,
    failed: 0,
  })),
  sendDuesEmails: vi.fn<(input: { origin?: string }) => Promise<unknown>>(async () => ({
    sent: 1,
    failed: 0,
    skipped: 0,
    already: 0,
    remaining: 0,
    errors: [],
  })),
  recordCronRun: vi.fn<(input: { ok: boolean }) => Promise<unknown>>(async () => undefined),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));
vi.mock("@/lib/email/notify", () => ({ sendNotification: h.sendNotification }));
vi.mock("@/lib/email/office-message", () => ({
  sendOfficeMessageNotice: h.sendOfficeMessageNotice,
}));
vi.mock("@/lib/email/send", () => ({ sendDuesEmails: h.sendDuesEmails }));
vi.mock("@/lib/cron-runs", () => ({ recordCronRun: h.recordCronRun }));

const fake = createFakeSupabase({
  "auth.getUser": { data: { user: { id: "profile-1" } } },
  rpc: { data: true },
  memberships: {
    data: [
      {
        unit_id: "unit-1",
        full_name: "Nadia Bell",
        invited_email: "nadia@example.com",
        profile_id: null,
        units: { label: "115 Willow Creek Dr" },
      },
    ],
  },
  associations: {
    data: {
      name: "Willow Creek Estates",
      join_code: "WILLOW1",
      slug: "willow-creek",
      city: "Portland",
      state: "OR",
      contact_email: "board@willowcreek.org",
    },
  },
  threads: {
    data: {
      id: "thread-1",
      association_id: "assoc-1",
      unit_id: "unit-1",
      subject: "Gate remote",
      to_role: "board",
      messages: [{ id: "m-1", fromRole: "resident", from: "Nadia", body: "Mine stopped working." }],
    },
  },
  "auth.admin.generateLink": { data: { properties: { hashed_token: "hash_1" } } },
  "email_log.insert": { error: null },
});
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => fake.client,
  supabaseAdmin: () => fake.client,
}));

const { POST: notify } = await import("@/app/api/email/notify/route");
const { POST: invite } = await import("@/app/api/email/invite/route");
const { POST: officeMessage } = await import("@/app/api/email/office-message/route");
const { POST: dues } = await import("@/app/api/email/send/route");
const { GET: bills } = await import("@/app/api/email/bills/route");

let caller = 0;
function request(path: string, url: string, headers: Record<string, string>, body?: object) {
  caller += 1;
  return new NextRequest(new URL(path, url), {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${caller}`,
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const HOSTILE = {
  host: "evil.example",
  "x-forwarded-host": "evil.example",
  "x-forwarded-proto": "http",
};

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_unit");
  vi.stubEnv("CRON_SECRET", "cron-secret");
  fake.reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("email/notify link origin", () => {
  const body = { associationId: "assoc-1", kind: "announcement", id: "ann-1" };

  it("builds links from the configured https site, ignoring hostile headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    const response = await notify(
      request("/api/email/notify", "http://evil.example", HOSTILE, body),
    );
    expect(response.status).toBe(200);
    expect(h.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://yourhoasis.com" }),
    );
  });

  it("sends nothing when no safe origin is known", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await notify(
      request("/api/email/notify", "https://yourhoasis.com", { host: "yourhoasis.com" }, body),
    );
    expect(response.status).toBe(503);
    expect(h.sendNotification).not.toHaveBeenCalled();
  });
});

describe("email/invite link origin", () => {
  const body = { associationId: "assoc-1", unitIds: ["unit-1"], kind: "invite" };

  it("builds the join link from the configured https site, ignoring hostile headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    const response = await invite(
      request("/api/email/invite", "http://evil.example", HOSTILE, body),
    );
    expect(response.status).toBe(200);
    expect(h.send).toHaveBeenCalledTimes(1);
    const message = h.send.mock.calls[0][0];
    expect(message.to).toBe("nadia@example.com");
    expect(`${message.html}${message.text}`).toContain("https://yourhoasis.com/");
    expect(`${message.html}${message.text}`).not.toContain("evil.example");
  });

  it("mints and sends nothing when no safe origin is known", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await invite(
      request("/api/email/invite", "https://yourhoasis.com", { host: "yourhoasis.com" }, body),
    );
    expect(response.status).toBe(503);
    expect(h.send).not.toHaveBeenCalled();
    expect(fake.callsTo("auth.admin.generateLink")).toHaveLength(0);
  });
});

describe("email/office-message link origin", () => {
  const body = { threadId: "thread-1" };

  it("builds the thread link from the configured https site, ignoring hostile headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    const response = await officeMessage(
      request("/api/email/office-message", "http://evil.example", HOSTILE, body),
    );
    expect(response.status).toBe(200);
    expect(h.sendOfficeMessageNotice).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://yourhoasis.com", followUp: false }),
    );
  });

  it("sends nothing when no safe origin is known", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await officeMessage(
      request(
        "/api/email/office-message",
        "https://yourhoasis.com",
        { host: "yourhoasis.com" },
        body,
      ),
    );
    expect(response.status).toBe(503);
    expect(h.sendOfficeMessageNotice).not.toHaveBeenCalled();
  });

  it("sends nothing when the thread's last word was the board's", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    fake.once("threads", {
      data: {
        id: "thread-1",
        association_id: "assoc-1",
        unit_id: "unit-1",
        subject: "Gate remote",
        to_role: "board",
        messages: [
          { id: "m-1", fromRole: "resident", from: "Nadia", body: "Mine stopped working." },
          { id: "m-2", fromRole: "board", from: "Dana", body: "A new one is on its way." },
        ],
      },
    });
    const response = await officeMessage(
      request(
        "/api/email/office-message",
        "https://yourhoasis.com",
        { host: "yourhoasis.com" },
        body,
      ),
    );
    expect(response.status).toBe(404);
    expect(h.sendOfficeMessageNotice).not.toHaveBeenCalled();
  });

  it("mails the office again when the owner wrote after the board", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    fake.once("threads", {
      data: {
        id: "thread-1",
        association_id: "assoc-1",
        unit_id: "unit-1",
        subject: "Gate remote",
        to_role: "board",
        messages: [
          { id: "m-1", fromRole: "resident", from: "Nadia", body: "Mine stopped working." },
          { id: "m-2", fromRole: "board", from: "Dana", body: "A new one is on its way." },
          { id: "m-3", fromRole: "resident", from: "Nadia", body: "It arrived, thank you." },
        ],
      },
    });
    const response = await officeMessage(
      request(
        "/api/email/office-message",
        "https://yourhoasis.com",
        { host: "yourhoasis.com" },
        body,
      ),
    );
    expect(response.status).toBe(200);
    expect(h.sendOfficeMessageNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        followUp: true,
        messageKey: "m-3",
        body: "It arrived, thank you.",
      }),
    );
  });
});

describe("email/send link origin", () => {
  const body = {
    associationId: "assoc-1",
    category: "assessment",
    dueDate: "2026-11-01",
  };

  it("sends bills with links built from the configured https site", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    const response = await dues(request("/api/email/send", "http://evil.example", HOSTILE, body));
    expect(response.status).toBe(200);
    expect(h.sendDuesEmails).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://yourhoasis.com" }),
    );
  });

  it("sends nothing when no safe origin is known", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await dues(
      request("/api/email/send", "https://yourhoasis.com", { host: "yourhoasis.com" }, body),
    );
    expect(response.status).toBe(503);
    expect(h.sendDuesEmails).not.toHaveBeenCalled();
  });
});

describe("email/bills link origin", () => {
  it("runs with links built from the configured https site", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    fake.on("associations", { data: [] });
    const response = await bills(
      request("/api/email/bills", "http://evil.example", {
        ...HOSTILE,
        authorization: "Bearer cron-secret",
      }),
    );
    expect(response.status).toBe(200);
    expect(h.recordCronRun).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("records a failed run and sends nothing when no safe origin is known", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await bills(
      request("/api/email/bills", "https://yourhoasis.com", {
        host: "yourhoasis.com",
        authorization: "Bearer cron-secret",
      }),
    );
    expect(response.status).toBe(500);
    expect(h.sendDuesEmails).not.toHaveBeenCalled();
    expect(h.recordCronRun).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("a dry run without a safe origin records nothing but still refuses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await bills(
      request("/api/email/bills?dry=1", "https://yourhoasis.com", {
        host: "yourhoasis.com",
        authorization: "Bearer cron-secret",
      }),
    );
    expect(response.status).toBe(500);
    expect(h.recordCronRun).not.toHaveBeenCalled();
    expect(h.sendDuesEmails).not.toHaveBeenCalled();
  });
});
