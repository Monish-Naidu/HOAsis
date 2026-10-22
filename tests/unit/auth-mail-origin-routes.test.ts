import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The sign up and resend routes build a link carrying a sign-in token. A
 * caller who could choose its host would receive somebody else's token, so
 * hostile Host and X-Forwarded-* headers must not reach the link. The mail
 * provider and Auth are stand-ins; nothing is sent.
 */

const h = vi.hoisted(() => ({
  send: vi.fn<(message: { html: string; text: string }) => Promise<unknown>>(async () => ({
    data: { id: "email-1" },
    error: null,
  })),
  generateLink: vi.fn<(args: { options?: { redirectTo?: string } }) => Promise<unknown>>(
    async () => ({
      data: { user: { id: "user-1" }, properties: { hashed_token: "hashed-token-fixture" } },
      error: null,
    }),
  ),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    auth: {
      admin: {
        generateLink: h.generateLink,
        deleteUser: vi.fn(async () => ({})),
        getUserById: async () => ({
          data: { user: { id: "user-1", email_confirmed_at: null, user_metadata: {} } },
        }),
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "user-1" } }) }) }),
    }),
  }),
}));

const { POST: signup } = await import("@/app/api/auth/signup/route");
const { POST: resend } = await import("@/app/api/auth/resend/route");

let caller = 0;
function request(path: string, url: string, headers: Record<string, string>, body: object) {
  caller += 1;
  return new NextRequest(new URL(path, url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${caller}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const HOSTILE = {
  host: "evil.example",
  "x-forwarded-host": "evil.example",
  "x-forwarded-proto": "http",
};

const routes = [
  {
    name: "sign up",
    call: (url: string, headers: Record<string, string>) =>
      signup(
        request("/api/auth/signup", url, headers, {
          email: `founder${caller}@example.com`,
          password: "long enough",
          fullName: "Pat",
        }),
      ),
  },
  {
    name: "resend",
    call: (url: string, headers: Record<string, string>) =>
      resend(request("/api/auth/resend", url, headers, { email: `founder${caller}@example.com` })),
  },
];

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_unit");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe.each(routes)("$name link origin", ({ call }) => {
  it("uses the configured https site when every header names another host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "yourhoasis.com");
    const response = await call("http://evil.example", HOSTILE);
    expect(response.status).toBe(200);
    expect(h.send).toHaveBeenCalledTimes(1);
    const message = h.send.mock.calls[0][0];
    expect(`${message.html}${message.text}`).toContain("https://yourhoasis.com/auth/callback?");
    expect(`${message.html}${message.text}`).not.toContain("evil.example");
    const redirect = h.generateLink.mock.calls[0]?.[0].options?.redirectTo;
    if (redirect) expect(redirect).toBe("https://yourhoasis.com/auth/callback");
  });

  it("mints and sends nothing when the configured site is not valid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "https://evil.example/");
    const response = await call("https://yourhoasis.com", HOSTILE);
    expect(response.status).toBe(503);
    expect(h.generateLink).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("mints and sends nothing from production with no site configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await call("https://yourhoasis.com", { host: "yourhoasis.com" });
    expect(response.status).toBe(503);
    expect(h.generateLink).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("keeps the same-port loopback address in development, ignoring forwarded headers", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await call("http://localhost:3100", {
      host: "127.0.0.1:3100",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    });
    expect(response.status).toBe(200);
    const message = h.send.mock.calls[0][0];
    expect(`${message.html}${message.text}`).toContain("http://127.0.0.1:3100/auth/callback?");
    expect(`${message.html}${message.text}`).not.toContain("evil.example");
  });

  it("refuses a development request addressed to a host that is not loopback", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_HOST", "");
    const response = await call("http://evil.example", HOSTILE);
    expect(response.status).toBe(503);
    expect(h.send).not.toHaveBeenCalled();
  });
});
