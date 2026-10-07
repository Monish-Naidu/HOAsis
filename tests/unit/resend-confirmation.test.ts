import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * "Send it again" on the Check your email screen: the route that sends the
 * confirmation link again, and the client's reading of its answers.
 * No Supabase and no Resend: both are stand-ins whose answers a test picks.
 */

const fake = createFakeSupabase({
  profiles: { data: { id: "u1" } },
  "auth.admin.generateLink": { data: { properties: { hashed_token: "hash_9" } }, error: null },
  "auth.admin.getUserById": {
    data: { user: { id: "u1", email_confirmed_at: null, user_metadata: { full_name: "Pat Lee" } } },
  },
});
const send = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("@/lib/email/sender", () => ({ emailSender: () => "Your HOAsis <hello@example.com>" }));
vi.mock("@/lib/log", () => ({ logger: () => ({ info() {}, warn() {}, error() {} }) }));

const { POST } = await import("@/app/api/auth/resend/route");

let ip = 0;
function ask(email: unknown) {
  // A fresh caller each time, so the per-caller limit is not what is tested
  // unless a test says so.
  return POST(
    new NextRequest("https://yourhoasis.com/api/auth/resend", {
      method: "POST",
      headers: { "x-forwarded-for": `10.0.0.${++ip}`, host: "yourhoasis.com" },
      body: JSON.stringify({ email }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  process.env.RESEND_API_KEY = "re_test";
});

describe("the resend route", () => {
  it("sends a fresh confirmation link to an address that has not confirmed", async () => {
    const response = await ask("pat-a@example.com");

    expect(response.status).toBe(200);
    expect(fake.callsTo("auth.admin.generateLink")[0].args).toEqual([{ type: "magiclink", email: "pat-a@example.com" }]);
    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0] as unknown as [{ to: string; text: string }];
    expect(mail[0].to).toBe("pat-a@example.com");
    expect(mail[0].text).toContain("/auth/callback?token_hash=hash_9&type=magiclink");
  });

  it("sends nothing, and answers the same, for an unknown or already confirmed address", async () => {
    fake.once("profiles", { data: null });
    expect((await ask("nobody@example.com")).status).toBe(200);

    fake.once("auth.admin.getUserById", { data: { user: { id: "u1", email_confirmed_at: "2026-08-01", user_metadata: {} } } });
    expect((await ask("done@example.com")).status).toBe(200);

    // Asking Auth for a link to an unknown address would create the account.
    expect(fake.callsTo("auth.admin.generateLink")).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a fourth press for one address inside ten minutes, in the limiter's words", async () => {
    for (let i = 0; i < 3; i++) expect((await ask("limited@example.com")).status).toBe(200);
    const fourth = await ask("limited@example.com");

    expect(fourth.status).toBe(429);
    expect(((await fourth.json()) as { error: string }).error).toMatch(/Too many attempts/);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("refuses a bad address and a missing key", async () => {
    expect((await ask("not an email")).status).toBe(400);
    delete process.env.RESEND_API_KEY;
    expect((await ask("pat-b@example.com")).status).toBe(503);
  });
});

describe("resendConfirmation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("says ok when the route sent it, and carries the refusal when it did not", async () => {
    const { resendConfirmation } = await import("@/app/join/resend");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    expect(await resendConfirmation(" pat@example.com ")).toEqual({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "pat@example.com" });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many attempts. Wait a minute and try again." }),
    });
    expect(await resendConfirmation("pat@example.com")).toEqual({
      ok: false,
      message: "Too many attempts. Wait a minute and try again.",
    });
    vi.unstubAllGlobals();
  });
});
