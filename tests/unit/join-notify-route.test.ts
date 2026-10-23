import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeCall } from "../helpers/fake-supabase";

/**
 * The route that tells the board somebody asked to join. The join page calls
 * it on every submit, because a retry and a first ask look the same from the
 * browser, so the once-per-request-and-officer rule has to live here: each
 * officer's copy is a durable row, reserved with its words and link before
 * anything is sent, claimed with a lease, and stamped when it went. A call
 * that died halfway, or an officer whose send failed, is picked up by the
 * next ask without writing to the officers who already have it.
 */

interface Delivery {
  request_id: string;
  email: string;
  profile_id: string | null;
  subject: string;
  url: string;
  status: "pending" | "claimed" | "sent" | "failed";
  attempts: number;
}

/** The stand-in table: one row per officer and request, as 0128 keeps them. */
const deliveries = new Map<string, Delivery>();

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

const pending = {
  id: "req-1",
  full_name: "Nadia Bell",
  email: "nadia@example.com",
  unit_label: "115 Willow Creek Dr",
  note: "Closed last week",
  board_notified_at: null,
};

const fake = createFakeSupabase({
  associations: {
    data: {
      id: "assoc-1",
      name: "Willow Creek Estates",
      slug: "willow-creek",
      contact_email: "board@willowcreek.org",
    },
  },
  "join_requests.select": { data: [pending] },
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
  "join_notice_deliveries.select": () => ({
    data: [...deliveries.values()].filter((row) => row.request_id === "req-1"),
  }),
  "join_notice_deliveries.upsert": (call: FakeCall) => {
    const rows = call.argsOf("upsert")![0] as Delivery[];
    for (const row of rows) {
      // The first writer's copy stands, as the conflict ignore does.
      if (!deliveries.has(row.email)) {
        deliveries.set(row.email, { ...row, status: "pending", attempts: 0 });
      }
    }
    return { error: null };
  },
  "rpc:claim_join_notice": (call: FakeCall) => {
    const { p_email } = call.args[1] as { p_email: string };
    const row = deliveries.get(p_email);
    if (!row || row.status === "sent") return { data: [] };
    // A row left claimed is the last attempt's crash; the answer says when.
    const interrupted = row.status === "claimed" ? "2026-10-21T09:00:00Z" : null;
    row.status = "claimed";
    row.attempts += 1;
    return {
      data: [
        { subject: row.subject, url: row.url, attempts: row.attempts, interrupted_at: interrupted },
      ],
    };
  },
  "rpc:finish_join_notice": (call: FakeCall) => {
    const { p_email, p_ok } = call.args[1] as { p_email: string; p_ok: boolean };
    const row = deliveries.get(p_email);
    if (row) row.status = p_ok ? "sent" : "failed";
    return { data: null, error: null };
  },
  "email_log.insert": { error: null },
});

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

const { POST } = await import("@/app/api/join/notify/route");

let ip = 0;
function ask(body: Record<string, unknown>, from?: string, headers?: Record<string, string>) {
  return POST(
    new NextRequest("https://yourhoasis.com/api/join/notify", {
      method: "POST",
      headers: { "x-forwarded-for": from ?? `10.0.0.${++ip}`, host: "yourhoasis.com", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  deliveries.clear();
  process.env.RESEND_API_KEY = "re_test";
  process.env.NEXT_PUBLIC_SITE_HOST = "yourhoasis.com";
  // The durable claim: a copy is held before it is sent, every time.
  send.mockImplementation(async (message) => {
    const row = deliveries.get(message.to.toLowerCase());
    expect(row?.status, `claim before send for ${message.to}`).toBe("claimed");
    return { data: { id: "email-1" }, error: null };
  });
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
    // Both copies ended stamped sent, so a later claim skips them.
    expect(deliveries.get("dana@example.com")?.status).toBe("sent");
    expect(deliveries.get("grace@willowcreek.org")?.status).toBe("sent");
  });

  it("reserves the words and the link before anything is sent", async () => {
    await ask({ code: "WILLOW", email: "nadia@example.com" });

    const calls = fake.calls;
    const reservedAt = calls.findIndex(
      (call) => call.target === "join_notice_deliveries" && call.has("upsert"),
    );
    const claimedAt = calls.findIndex((call) => call.target === "rpc:claim_join_notice");
    expect(reservedAt).toBeGreaterThan(-1);
    expect(claimedAt).toBeGreaterThan(reservedAt);
    // Each officer's copy was reserved with the subject and link it carried.
    expect(deliveries.get("dana@example.com")?.subject).toBe(
      "Nadia Bell asked to join Willow Creek Estates",
    );
    expect(deliveries.get("grace@willowcreek.org")?.url).toContain(
      "next=%2Fc%2Fwillow-creek%2Fboard%2Fhomeowners",
    );
  });

  it("links straight to this association's Homeowners page, signed in", async () => {
    await ask({ code: "WILLOW", email: "nadia@example.com" });

    const link = (send.mock.calls[0] as unknown as [{ html: string }])[0].html.match(
      /href="([^"]+)"/,
    )![1];
    expect(link).toContain("/auth/callback?token_hash=hash_1&type=magiclink");
    expect(link).toContain("next=%2Fc%2Fwillow-creek%2Fboard%2Fhomeowners");
    expect(link.startsWith("https://yourhoasis.com/")).toBe(true);
  });

  it("marks the request told, and a repeat ask writes to nobody", async () => {
    await ask({ code: "WILLOW", email: "nadia@example.com" });
    // finish_join_notice stamped the request once every copy had gone.
    fake.once("join_requests.select", {
      data: [{ ...pending, board_notified_at: "2026-10-21T10:00:00Z" }],
    });

    const again = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await again.json()) as { already: boolean };

    expect(again.status).toBe(200);
    expect(body.already).toBe(true);
    // Two officers were written to by the first ask; the second added nobody.
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("retries the officer whose send failed, and only that officer", async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: "domain not verified" } });

    const first = await ask({ code: "WILLOW", email: "nadia@example.com" });
    expect(((await first.json()) as { sent: number }).sent).toBe(1);
    expect(deliveries.get("dana@example.com")?.status).toBe("failed");
    expect(deliveries.get("grace@willowcreek.org")?.status).toBe("sent");

    const again = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await again.json()) as { sent: number; failed: number };

    expect(body).toMatchObject({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(3);
    // The retry is provably the same email: the reserved words, the reserved
    // link and the one idempotency key, so a fold inside the provider's
    // window is the same copy, not a second one.
    const danaFirst = send.mock.calls[0] as unknown as [
      { html: string },
      { idempotencyKey: string },
    ];
    const danaRetry = send.mock.calls[2] as unknown as [
      { html: string },
      { idempotencyKey: string },
    ];
    expect(danaRetry[0].html).toBe(danaFirst[0].html);
    expect(danaRetry[1].idempotencyKey).toBe(danaFirst[1].idempotencyKey);
  });

  it("reads the mail log before writing twice to an interrupted send", async () => {
    await ask({ code: "WILLOW", email: "nadia@example.com" });
    // The worker died after claiming: both rows are stuck 'claimed'. Dana's
    // mail did go out (it is in the log); Grace's never left.
    deliveries.get("dana@example.com")!.status = "claimed";
    deliveries.get("grace@willowcreek.org")!.status = "claimed";
    fake.once("email_log.select", { data: { provider_id: "email-7" } }, { data: null });

    const again = await ask({ code: "WILLOW", email: "nadia@example.com" });
    const body = (await again.json()) as { sent: number };

    // Only Grace is written to again; Dana's copy is recorded as sent from
    // the log, with the provider's own id, instead of sent twice.
    expect(body.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(3);
    expect((send.mock.calls[2] as unknown as [{ to: string }])[0].to).toBe("grace@willowcreek.org");
    const finishes = fake.callsTo("rpc:finish_join_notice");
    const dana = finishes.find(
      (call) =>
        (call.args[1] as { p_email: string; p_provider_id?: string }).p_email ===
          "dana@example.com" &&
        (call.args[1] as { p_provider_id?: string }).p_provider_id === "email-7",
    )!;
    expect(dana.args[1]).toMatchObject({ p_ok: true, p_provider_id: "email-7" });
  });

  it("ignores a forwarded host a stranger sent, and builds links from the configured one", async () => {
    const response = await ask({ code: "WILLOW", email: "nadia@example.com" }, undefined, {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "http",
    });

    expect(response.status).toBe(200);
    const link = (send.mock.calls[0] as unknown as [{ html: string }])[0].html.match(
      /href="([^"]+)"/,
    )![1];
    expect(link.startsWith("https://yourhoasis.com/")).toBe(true);
    expect(JSON.stringify(send.mock.calls)).not.toContain("evil.example");
  });

  it("sends nothing, and reserves nothing, when no safe origin is known", async () => {
    delete process.env.NEXT_PUBLIC_SITE_HOST;

    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });

    expect(response.status).toBe(503);
    expect(deliveries.size).toBe(0);
    expect(fake.callsTo("rpc:claim_join_notice")).toHaveLength(0);
    expect(fake.callsTo("auth.admin.generateLink")).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
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
    expect(deliveries.size).toBe(0);
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
    expect(deliveries.size).toBe(0);
  });

  it("answers 404 for a code no association has", async () => {
    fake.once("associations", { data: null });

    const response = await ask({ code: "NOTHING", email: "nadia@example.com" });

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("reserves nothing when no mail key is set, so a later ask can still tell the board", async () => {
    delete process.env.RESEND_API_KEY;

    const response = await ask({ code: "WILLOW", email: "nadia@example.com" });

    expect(response.status).toBe(503);
    expect(deliveries.size).toBe(0);
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
