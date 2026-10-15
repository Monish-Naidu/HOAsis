import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * The route that tells the board somebody asked to join. The join page calls
 * it on every submit, because a retry and a first ask look the same from the
 * browser, so the once-per-request rule has to live here: the request is
 * claimed in the database before anything is sent, and only the call that
 * claimed it writes to anybody.
 */

const send = vi.fn<
  (
    message: { to: string },
    options?: { idempotencyKey: string },
  ) => Promise<{ data: { id: string } | null; error: { message: string } | null }>
>(async () => ({ data: { id: "email-1" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const fake = createFakeSupabase({
  associations: {
    data: {
      id: "assoc-1",
      name: "Willow Creek Estates",
      slug: "willow-creek",
      contact_email: "board@willowcreek.org",
    },
  },
  "join_requests.select": {
    data: [
      {
        id: "req-1",
        full_name: "Nadia Bell",
        email: "nadia@example.com",
        unit_label: "115 Willow Creek Dr",
        note: "Closed last week",
      },
    ],
  },
  "join_requests.update": { data: [{ id: "req-1" }] },
  memberships: {
    data: [
      {
        full_name: "Dana Whitcomb",
        profile_id: "p-1",
        invited_email: "founder@willowcreek.org",
        capabilities: ["settings"],
      },
      {
        full_name: "Grace Okafor",
        profile_id: null,
        invited_email: "grace@willowcreek.org",
        capabilities: ["settings", "finances"],
      },
      {
        full_name: "Tomas Reyes",
        profile_id: "p-3",
        invited_email: "tomas@willowcreek.org",
        capabilities: ["communications"],
      },
    ],
  },
  profiles: { data: [{ id: "p-1", email: "dana@example.com" }] },
  "auth.admin.generateLink": { data: { properties: { hashed_token: "hash_1" } } },
  "email_log.insert": { error: null },
});

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

const { POST } = await import("@/app/api/join/notify/route");

let ip = 0;
function ask(body: Record<string, unknown>, from?: string) {
  return POST(
    new NextRequest("https://yourhoasis.com/api/join/notify", {
      method: "POST",
      headers: { "x-forwarded-for": from ?? `10.0.0.${++ip}`, host: "yourhoasis.com" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  process.env.RESEND_API_KEY = "re_test";
});

describe("telling the board", () => {
  it("emails every officer who can manage homeowners, once per address", async () => {
    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await response.json()) as { ok: boolean; sent: number; failed: number };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);

    // The account's own email wins for a signed in officer; the roster's
    // address serves one who has not signed up. The treasurer, who cannot
    // let anybody in, hears nothing.
    const sentTo = send.mock.calls.map((call) => (call[0] as { to: string }).to);
    expect(sentTo).toEqual(["dana@example.com", "grace@willowcreek.org"]);

    const first = send.mock.calls[0] as unknown as [
      { to: string; subject: string; text: string },
      { idempotencyKey: string },
    ];
    expect(first[0].subject).toBe("Nadia Bell asked to join Willow Creek Estates");
    expect(first[0].text).toContain("115 Willow Creek Dr");
    expect(first[0].text).toContain('They wrote: "Closed last week"');
    expect(first[1].idempotencyKey).toBe("join-request/req-1/dana@example.com");
    expect(fake.callsTo("email_log")[0].argsOf("insert")![0]).toMatchObject({
      association_id: "assoc-1",
      profile_id: "p-1",
      unit_id: null,
      category: "join",
      to_email: "dana@example.com",
    });
  });

  it("links straight to this association's Homeowners page, signed in", async () => {
    await ask({ code: "WILLOW", email: "nadia@example.com" });

    const link = (send.mock.calls[0] as unknown as [{ html: string }])[0].html.match(
      /href="([^"]+)"/,
    )![1];
    expect(link).toContain("/auth/callback?token_hash=hash_1&type=magiclink");
    expect(link).toContain("next=%2Fc%2Fwillow-creek%2Fboard%2Fhomeowners");
  });

  it("claims the request before sending, so a second submit sends nothing", async () => {
    await ask({ code: "WILLOW", email: "nadia@example.com" });
    const claim = fake.callsTo("join_requests").find((call) => call.has("update"))!;
    expect(claim.argsOf("update")![0]).toHaveProperty("board_notified_at");
    expect(claim.chain).toContainEqual(["is", "board_notified_at", null]);

    fake.once("join_requests.update", { data: null });
    const again = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await again.json()) as { already: boolean };

    expect(again.status).toBe(200);
    expect(body.already).toBe(true);
    // Two officers were written to by the first ask; the second added nobody.
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("claims nothing, and says why, when no officer can manage homeowners", async () => {
    fake.once("memberships", {
      data: [
        {
          full_name: "Tomas Reyes",
          profile_id: "p-3",
          invited_email: "tomas@willowcreek.org",
          capabilities: ["communications"],
        },
      ],
    });

    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await response.json()) as { sent: number; failed: number };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ sent: 0, failed: 0 });
    expect(fake.writes().some((call) => call.target === "join_requests")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips an officer with no address and still tells the rest", async () => {
    fake.once("memberships", {
      data: [
        {
          full_name: "Dana Whitcomb",
          profile_id: "p-1",
          invited_email: "founder@willowcreek.org",
          capabilities: ["settings"],
        },
        {
          full_name: "Silent Officer",
          profile_id: null,
          invited_email: null,
          capabilities: ["settings"],
        },
      ],
    });

    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await response.json()) as { sent: number; skipped: number };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ sent: 1, skipped: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when there is no pending request from that address", async () => {
    fake.once("join_requests.select", { data: null });

    const response = await ask({ code: "WILLOW", email: "gone@example.com" });

    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    expect(fake.writes().some((call) => call.target === "join_requests")).toBe(false);
  });

  it("answers 404 for a code no association has", async () => {
    fake.once("associations", { data: null });

    const response = await ask({ code: "NOTHING", email: "nadia@example.com" });

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("claims nothing when no mail key is set, so a later ask can still tell the board", async () => {
    delete process.env.RESEND_API_KEY;

    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });

    expect(response.status).toBe(503);
    expect(fake.writes().some((call) => call.target === "join_requests")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("counts a refused send as a failure and still logs it", async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: "domain not verified" } });

    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await response.json()) as { sent: number; failed: number; errors?: string[] };

    // One of the two officers' send was refused; the other still got the notice.
    expect(body).toMatchObject({ sent: 1, failed: 1 });
    expect(body.errors).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("dana@example.com");
    expect(fake.callsTo("email_log")[0].argsOf("insert")![0]).toMatchObject({
      error: "domain not verified",
    });
  });

  it("refuses a bad address rather than emailing it", async () => {
    expect((await ask({ code: "WILLOW", email: "not an address" })).status).toBe(400);
    expect((await ask({ code: "", email: "nadia@example.com" })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps sign up's limit: eleven asks from one address are refused", async () => {
    fake.on("join_requests.select", { data: null });
    for (let i = 0; i < 10; i++) {
      const response = await ask({ code: "WILLOW", email: "nadia@example.com" }, "10.9.9.9");
      expect(response.status).toBe(200);
    }
    const eleventh = await ask({ code: "WILLOW", email: "nadia@example.com" }, "10.9.9.9");

    expect(eleventh.status).toBe(429);
    expect(((await eleventh.json()) as { error: string }).error).toMatch(/Too many attempts/);
  });
});
