import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase, type FakeCall } from "../helpers/fake-supabase";
import { requestAlertRecipients } from "@/lib/email/request-alert";

/**
 * The route that tells the board a request arrived, or that its owner wrote
 * again. Driven end to end with the database and the mailer as stand-ins:
 * the caller's own session decides what they may see, the thread's last
 * event decides whether there is anything to tell, and the seats that hold
 * the requests capability decide who hears it.
 */

const send = vi.fn<
  (
    message: { to: string; subject: string; html: string; text: string },
    options?: { idempotencyKey: string },
  ) => Promise<{ data: { id: string } | null; error: { message: string } | null }>
>(async () => ({ data: { id: "email-1" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

/** Who is calling; null is a signed-out browser. */
let caller: { id: string } | null = { id: "profile-resident" };
/** The homes the caller sits on, as my_unit_ids answers. */
let myUnits: string[] = ["unit-1"];
/** The requests-capability seats the board holds. */
let boardSeats: Record<string, unknown>[] = [];
/** email_optouts rows for the 'request' category. */
let optOuts: { profile_id: string }[] = [];

const requestRow = {
  id: "req-1",
  association_id: "assoc-1",
  unit_id: "unit-1",
  reference: "REQ-2026-0042",
  title: "Gate remote stopped working",
  kind: "maintenance",
  filed_by: "profile-resident",
  thread: [
    { id: "rt-1", actor: "Nadia Bell", actorRole: "resident", body: "The clicker does nothing." },
  ],
};

const fake = createFakeSupabase({
  "auth.getUser": () => ({ data: { user: caller } }),
  "rpc:my_unit_ids": () => ({ data: myUnits }),
  "requests.select": { data: [requestRow] },
  units: { data: { label: "115 Willow Creek Dr" } },
  "memberships.select": (call: FakeCall) =>
    // The board's seats are asked for with contains(); the filer's own seat
    // is asked for by home and profile.
    call.has("contains") ? { data: boardSeats } : { data: { full_name: "Nadia Bell" } },
  profiles: { data: [{ id: "p-1", email: "dana@example.com" }] },
  "email_optouts.select": () => ({ data: optOuts }),
  associations: {
    data: {
      id: "assoc-1",
      name: "Willow Creek Estates",
      slug: "willow-creek",
      contact_email: "board@willowcreek.org",
    },
  },
  "auth.admin.generateLink": { data: { properties: { hashed_token: "hash_1" } } },
  "email_log.insert": { error: null },
});
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => fake.client,
  supabaseAdmin: () => fake.client,
}));

const { POST } = await import("@/app/api/email/request-alert/route");

let ip = 0;
function alert(body: Record<string, unknown>, headers?: Record<string, string>) {
  return POST(
    new NextRequest("https://yourhoasis.com/api/email/request-alert", {
      method: "POST",
      headers: { "x-forwarded-for": `10.0.0.${++ip}`, host: "yourhoasis.com", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  caller = { id: "profile-resident" };
  myUnits = ["unit-1"];
  optOuts = [];
  boardSeats = [
    {
      full_name: "Dana Whitcomb",
      profile_id: "p-1",
      invited_email: "dana-roster@example.com",
      capabilities: ["requests"],
    },
    {
      full_name: "Grace Okafor",
      profile_id: null,
      invited_email: "grace@example.com",
      capabilities: ["requests", "settings"],
    },
    // The filer holds the capability too; nobody is alerted about their own ask.
    {
      full_name: "Nadia Bell",
      profile_id: "profile-resident",
      invited_email: "nadia@example.com",
      capabilities: ["requests"],
    },
    {
      full_name: "Tomas Reyes",
      profile_id: "p-3",
      invited_email: "tomas@example.com",
      capabilities: ["finances"],
    },
  ];
  process.env.RESEND_API_KEY = "re_test";
  process.env.NEXT_PUBLIC_SITE_HOST = "yourhoasis.com";
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.NEXT_PUBLIC_SITE_HOST;
});

describe("a new request", () => {
  it("emails the seats that answer requests, except the filer and the opted out", async () => {
    const response = await alert({ requestId: "req-1", kind: "filed" });
    const body = (await response.json()) as { sent: number; failed: number };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ sent: 2, failed: 0 });
    // The account's own email wins over the roster's; the finances seat and
    // the filer hear nothing.
    const sentTo = send.mock.calls.map((call) => call[0].to);
    expect(sentTo).toEqual(["dana@example.com", "grace@example.com"]);

    const first = send.mock.calls[0];
    expect(first[0].subject).toBe(
      "New maintenance request REQ-2026-0042: Gate remote stopped working · Willow Creek Estates",
    );
    expect(first[0].text).toContain("Nadia Bell, 115 Willow Creek Dr");
    expect(first[1]?.idempotencyKey).toBe("request-filed/req-1/filed/dana@example.com");
    const link = first[0].html.match(/href="([^"]+)"/)![1];
    expect(link.startsWith("https://yourhoasis.com/")).toBe(true);
    expect(link).toContain("next=%2Fc%2Fwillow-creek%2Fboard%2Frequests");
    expect(fake.callsTo("email_log")[0].argsOf("insert")![0]).toMatchObject({
      association_id: "assoc-1",
      unit_id: "unit-1",
      category: "request",
      to_email: "dana@example.com",
    });
  });

  it("leaves out an officer who asked not to hear about requests", async () => {
    optOuts = [{ profile_id: "p-1" }];

    const response = await alert({ requestId: "req-1", kind: "filed" });

    expect(response.status).toBe(200);
    expect(send.mock.calls.map((call) => call[0].to)).toEqual(["grace@example.com"]);
  });

  it("builds links from the configured site when hostile headers name another", async () => {
    const response = await alert(
      { requestId: "req-1", kind: "filed" },
      { "x-forwarded-host": "evil.example", "x-forwarded-proto": "http" },
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(send.mock.calls)).not.toContain("evil.example");
  });

  it("sends nothing when no safe origin is known", async () => {
    delete process.env.NEXT_PUBLIC_SITE_HOST;

    const response = await alert({ requestId: "req-1", kind: "filed" });

    expect(response.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
    expect(fake.callsTo("auth.admin.generateLink")).toHaveLength(0);
  });

  it("counts a refused send and still tells the rest", async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: "domain not verified" } });

    const response = await alert({ requestId: "req-1", kind: "filed" });
    const body = (await response.json()) as { sent: number; failed: number };

    expect(body).toMatchObject({ sent: 1, failed: 1 });
    expect(fake.callsTo("email_log")[0].argsOf("insert")![0]).toMatchObject({
      error: "domain not verified",
    });
  });
});

describe("an owner's follow-up", () => {
  const replied = {
    ...requestRow,
    thread: [
      { id: "rt-1", actor: "Nadia Bell", actorRole: "resident", body: "The clicker does nothing." },
      { id: "rt-2", actor: "Dana Whitcomb", actorRole: "board", body: "Which gate is this?" },
      { id: "rt-3", actor: "Nadia Bell", actorRole: "resident", body: "The one on Willow Lane." },
    ],
  };

  it("emails the board with the reply's words, keyed to the thread event", async () => {
    fake.on("requests.select", { data: [replied] });

    const response = await alert({ requestId: "req-1", kind: "reply" });

    expect(response.status).toBe(200);
    const first = send.mock.calls[0];
    expect(first[0].subject).toBe(
      "New reply on REQ-2026-0042: Gate remote stopped working · Willow Creek Estates",
    );
    expect(first[0].text).toContain('They wrote: "The one on Willow Lane."');
    expect(first[1]?.idempotencyKey).toBe("request-reply/req-1/rt-3/dana@example.com");
  });

  it("sends nothing when the thread's last word was the board's", async () => {
    fake.on("requests.select", {
      data: [{ ...requestRow, thread: [...replied.thread.slice(0, 2)] }],
    });

    const response = await alert({ requestId: "req-1", kind: "reply" });

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("who may ask", () => {
  it("answers 401 signed out", async () => {
    caller = null;

    const response = await alert({ requestId: "req-1", kind: "filed" });

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("answers 403 for a request on a home the caller does not sit on", async () => {
    myUnits = ["unit-9"];

    const response = await alert({ requestId: "req-1", kind: "filed" });

    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("answers 404 for a request the caller cannot see", async () => {
    fake.once("requests.select", { data: null });

    const response = await alert({ requestId: "req-1", kind: "filed" });

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("answers 400 without a request and a kind", async () => {
    expect((await alert({ kind: "filed" })).status).toBe(400);
    expect((await alert({ requestId: "req-1", kind: "peek" })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("requestAlertRecipients", () => {
  const seats = [
    {
      full_name: "Dana",
      profile_id: "p-1",
      invited_email: "dana-roster@example.com",
      capabilities: ["requests"],
    },
    // Dana's second seat on another home: one email, not two.
    {
      full_name: "Dana",
      profile_id: "p-1",
      invited_email: "dana-roster@example.com",
      capabilities: ["requests"],
    },
    {
      full_name: "Grace",
      profile_id: null,
      invited_email: "grace@example.com",
      capabilities: ["settings"],
    },
    {
      full_name: "Quiet",
      profile_id: "p-4",
      invited_email: "quiet@example.com",
      capabilities: ["requests"],
    },
    { full_name: "No Address", profile_id: null, invited_email: null, capabilities: ["requests"] },
  ];
  const emails = new Map([
    ["p-1", "dana@example.com"],
    ["p-4", "quiet@example.com"],
  ]);

  it("keeps the requests seats, once per address, the account's email first", () => {
    const people = requestAlertRecipients(seats, emails, null, new Set());

    expect(people.map((p) => p.email)).toEqual(["dana@example.com", "quiet@example.com"]);
  });

  it("leaves out the actor and the opted out", () => {
    const people = requestAlertRecipients(seats, emails, "p-1", new Set(["quiet@example.com"]));

    expect(people).toEqual([]);
  });
});
