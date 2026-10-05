import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createLimiter, type Limiter } from "@/lib/rate-limit";

/**
 * The invitation route over a batch, with no mail provider and no database.
 * A batch sent again, after a stop or a timeout, must not invite anybody
 * twice; an invitation to one household is always sent, because somebody
 * pressed the button for that household on purpose. And the hourly ceiling
 * counts what is sent, so finishing one long batch over several presses
 * does not run into it.
 */

process.env.RESEND_API_KEY = "re_test_unit";

const send = vi.fn<(message: { to: string }) => Promise<{ data: { id: string }; error: null }>>(async () => ({
  data: { id: "email-1" },
  error: null,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

// The real pacing, minus the waiting. `turnsAllowed` is how many sends fit
// before the time is up.
let turnsAllowed = Infinity;
const turn = vi.fn(async () => undefined);
vi.mock("@/lib/email/pace", async (original) => {
  const real = await original<typeof import("@/lib/email/pace")>();
  return { ...real, createPacer: () => ({ turn, outOfTime: () => turn.mock.calls.length >= turnsAllowed }) };
});

// The route's own limiter and its own arithmetic, with the ceiling held
// here so each test starts from nothing spent and can set a small one.
let ceiling: Limiter = createLimiter({ limit: 600, windowMs: 60 * 60 * 1000 });
vi.mock("@/lib/email/invite-limit", async (original) => {
  const real = await original<typeof import("@/lib/email/invite-limit")>();
  return {
    ...real,
    createInviteLimiter: (): Limiter => ({
      check: (key, cost) => ceiling.check(key, cost),
      size: () => ceiling.size(),
    }),
  };
});

type Member = { unit_id: string; full_name: string; invited_email: string | null; profile_id: string | null; units: { label: string } };
let members: Member[] = [];
let logged: { to_email: string; subject: string; unit_id: string | null }[] = [];

function table(name: string) {
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "in", "gte", "order"]) chain[step] = () => chain;
  // memberships ends on .is("ends_on", null); email_log carries on to
  // .gte() and is read a page at a time.
  chain.is = () => ({
    ...chain,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: members, error: null }).then(resolve),
  });
  chain.range = async (from: number, to: number) => ({ data: logged.slice(from, to + 1), error: null });
  chain.single = async () => ({
    data: name === "associations" ? { name: "Maple Court HOA", join_code: "MAPLE1", slug: "maple-court", city: "Bothell", state: "WA" } : null,
  });
  // A send that went is what the next press's repeat guard reads back.
  chain.insert = async (row: { to_email: string; subject: string; unit_id: string | null; error: string | null }) => {
    if (!row.error) logged.push({ to_email: row.to_email, subject: row.subject, unit_id: row.unit_id });
    return { error: null };
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "profile-board" } } }) },
    rpc: async () => ({ data: true }),
  }),
  supabaseAdmin: () => ({ from: (name: string) => table(name) }),
}));

const { POST } = await import("@/app/api/email/invite/route");
const { INVITES_PER_HOUR } = await import("@/lib/email/invite-limit");

function invite(unitIds: string[]) {
  return new NextRequest("http://localhost/api/email/invite", {
    method: "POST",
    headers: { host: "localhost" },
    body: JSON.stringify({ associationId: "assoc-1", unitIds, kind: "invite" }),
  });
}

function household(n: number): Member {
  return { unit_id: `unit-${n}`, full_name: `Owner ${n}`, invited_email: `owner${n}@example.com`, profile_id: null, units: { label: String(n) } };
}

const subjectFor = (n: number) => `Your home at ${n} is ready on Your HOAsis`;

beforeEach(() => {
  vi.clearAllMocks();
  turnsAllowed = Infinity;
  members = [household(1), household(2), household(3)];
  logged = [];
  ceiling = createLimiter({ limit: INVITES_PER_HOUR, windowMs: 60 * 60 * 1000 });
});

describe("inviting a batch of households", () => {
  it("takes a turn from the pacer before every send", async () => {
    const response = await POST(invite(["unit-1", "unit-2", "unit-3"]));
    expect(await response.json()).toMatchObject({ sent: 3, failed: 0, already: 0, remaining: 0 });
    expect(turn).toHaveBeenCalledTimes(3);
  });

  it("passes over whoever was invited in the last hour when the batch is sent again", async () => {
    logged = [{ to_email: "owner1@example.com", subject: subjectFor(1), unit_id: "unit-1" }];
    const response = await POST(invite(["unit-1", "unit-2", "unit-3"]));
    // Counted on its own: `skipped` is a household with no address.
    expect(await response.json()).toMatchObject({ sent: 2, skipped: 0, already: 1 });
    expect(send.mock.calls.map(([message]) => message.to)).toEqual(["owner2@example.com", "owner3@example.com"]);
  });

  it("stops with an answer when time is up, and says sending again is safe", async () => {
    turnsAllowed = 1;
    const response = await POST(invite(["unit-1", "unit-2", "unit-3"]));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sent: 1, remaining: 2, failed: 2 });
    expect(result.errors[0]).toMatch(/^Stopped at the time limit\. 2 people were not reached\. Send again/);
  });
});

describe("the hourly ceiling over a batch finished in several presses", () => {
  /** Presses send until nobody remains, the way a board finishes a long batch. */
  async function pressUntilDone(unitIds: string[], perPress: number, most = 12) {
    const answers: { status: number; sent?: number; remaining?: number; error?: string }[] = [];
    for (let press = 0; press < most; press++) {
      turn.mockClear();
      turnsAllowed = perPress;
      const response = await POST(invite(unitIds));
      const body = await response.json();
      answers.push({ status: response.status, ...body });
      if (response.status !== 200 || body.remaining === 0) break;
    }
    return answers;
  }

  it("lets two hundred addresses finish at fifty a press", async () => {
    // Each press used to be charged for all two hundred, sent or not: the
    // fourth asked for a total of eight hundred and was refused, with fifty
    // homes still waiting.
    members = Array.from({ length: 200 }, (_, i) => household(i + 1));
    const answers = await pressUntilDone(members.map((m) => m.unit_id), 50);
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200]);
    expect(answers.map((a) => a.sent)).toEqual([50, 50, 50, 50]);
    expect(answers.map((a) => a.remaining)).toEqual([150, 100, 50, 0]);
    expect(send).toHaveBeenCalledTimes(200);
    expect(new Set(send.mock.calls.map(([message]) => message.to)).size).toBe(200);
  });

  it("spends nothing on whoever was passed over or has no address", async () => {
    ceiling = createLimiter({ limit: 2, windowMs: 60 * 60 * 1000 });
    members = [household(1), { ...household(2), invited_email: null }, household(3), household(4)];
    logged = [{ to_email: "owner1@example.com", subject: subjectFor(1), unit_id: "unit-1" }];
    const response = await POST(invite(["unit-1", "unit-2", "unit-3", "unit-4"]));
    // Four on the list, two to send, a ceiling of two: all of it goes.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 2, skipped: 1, already: 1, failed: 0 });
  });

  it("stops at the ceiling partway, says how many went and why the rest did not", async () => {
    ceiling = createLimiter({ limit: 2, windowMs: 60 * 60 * 1000 });
    const response = await POST(invite(["unit-1", "unit-2", "unit-3"]));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    // Not `remaining`: pressing again now would only be refused.
    expect(result).toMatchObject({ sent: 2, failed: 1, remaining: 0 });
    expect(result.errors[0]).toMatch(/more invitations than one association can send in an hour/);
  });

  it("refuses outright, with how long to wait, when the ceiling is already spent", async () => {
    ceiling = createLimiter({ limit: 2, windowMs: 60 * 60 * 1000 });
    await POST(invite(["unit-1", "unit-2", "unit-3"]));
    send.mockClear();
    const again = await POST(invite(["unit-1", "unit-2", "unit-3"]));
    expect(again.status).toBe(429);
    expect(Number(again.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await again.json()).error).toMatch(/Try again later/);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("inviting one household", () => {
  it("always sends, even minutes after the last invitation", async () => {
    members = [household(1)];
    logged = [{ to_email: "owner1@example.com", subject: subjectFor(1), unit_id: "unit-1" }];
    const response = await POST(invite(["unit-1"]));
    expect(await response.json()).toMatchObject({ sent: 1, already: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
