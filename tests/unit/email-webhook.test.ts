import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * The delivery webhook's contract, with no provider network and no database.
 *
 * Resend posts every email event here, signed, at least once and in any
 * order. The route's half of the contract: a signature that does not check
 * out is refused before anything is read or written; a database failure is a
 * retryable 500, never an acknowledgment for work that did not land; and the
 * status decision itself is one atomic SQL call (0129) so simultaneous or
 * out of order events cannot move a message backwards.
 *
 * Signatures below are computed by hand from the standard webhooks spec
 * (HMAC-SHA256 over `id.timestamp.payload`, base64, `v1,` prefixed), and the
 * route verifies with the provider SDK's own verifier: if either side
 * drifted from the spec, these tests fail.
 */

const SECRET = `whsec_${randomBytes(24).toString("base64")}`;
process.env.RESEND_API_KEY = "re_test";
process.env.RESEND_WEBHOOK_SECRET = SECRET;

function signatureFor(payload: string, secret: string = SECRET, id: string = "msg_1") {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": String(timestamp),
    "svix-signature": `v1,${signature}`,
  };
}

// The atomic status application answers one of these; 0129 owns the ladder.
const fake = createFakeSupabase({
  "rpc:apply_email_delivery": { data: "applied" },
});

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));

const { POST } = await import("@/app/api/email/webhook/route");

const applies = () =>
  fake.callsTo("rpc:apply_email_delivery").map((call) => call.args[1] as Record<string, unknown>);

function post(event: object, headers?: Record<string, string>) {
  const payload = JSON.stringify(event);
  return POST(
    new NextRequest("https://yourhoasis.com/api/email/webhook", {
      method: "POST",
      headers: headers ?? signatureFor(payload),
      body: payload,
    }),
  );
}

function delivered(emailId: string = "provider-1", over: Record<string, unknown> = {}) {
  return {
    type: "email.delivered",
    created_at: "2026-10-22T10:15:00.000Z",
    data: { email_id: emailId, ...over },
  };
}

beforeEach(() => {
  fake.reset();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
});

describe("the signature gate", () => {
  it("answers 500, and touches nothing, while the secret is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const response = await post(delivered());

    expect(response.status).toBe(500);
    expect(fake.calls).toHaveLength(0);
  });

  it("answers 400 when the signing headers are missing", async () => {
    const response = await post(delivered(), {});

    expect(response.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it("answers 400 for a signature made with the wrong secret, and writes nothing", async () => {
    const payload = JSON.stringify(delivered());
    const forged = signatureFor(payload, `whsec_${randomBytes(24).toString("base64")}`);

    const response = await post(delivered(), forged);

    expect(response.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it("answers 400 for a tampered body under an otherwise valid header", async () => {
    const headers = signatureFor(JSON.stringify(delivered("provider-1")));

    const response = await post(delivered("provider-2"), headers);

    expect(response.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("events that change nothing", () => {
  it("acknowledges a type it does not track without a database call", async () => {
    const response = await post({ type: "email.domain.updated", created_at: "", data: {} });
    const body = (await response.json()) as { received: boolean; ignored: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, ignored: "email.domain.updated" });
    expect(fake.calls).toHaveLength(0);
  });

  it("acknowledges a tracked event that names no message", async () => {
    const response = await post({ type: "email.sent", created_at: "", data: {} });

    expect(response.status).toBe(200);
    expect(fake.calls).toHaveLength(0);
  });

  it("acknowledges a message nobody logged, as itself and not a fault", async () => {
    fake.once("rpc:apply_email_delivery", { data: "unknown-email" });

    const response = await post(delivered("provider-nobody-logged"));
    const body = (await response.json()) as { received: boolean; ignored: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, ignored: "unknown email" });
  });
});

describe("applying an event", () => {
  it("hands the provider id, the mapped status and the event time to one atomic call", async () => {
    const response = await post(delivered());
    const body = (await response.json()) as { received: boolean; status: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, status: "delivered" });
    expect(applies()).toEqual([
      {
        p_provider_id: "provider-1",
        p_status: "delivered",
        p_status_at: "2026-10-22T10:15:00.000Z",
      },
    ]);
  });

  it.each([
    ["email.sent", "sent"],
    ["email.delivery_delayed", "delayed"],
    ["email.delivered", "delivered"],
    ["email.opened", "opened"],
    ["email.clicked", "clicked"],
    ["email.bounced", "bounced"],
    ["email.complained", "complained"],
    ["email.failed", "failed"],
  ])("maps %s to %s", async (type, status) => {
    fake.once("rpc:apply_email_delivery", { data: "applied" });

    const response = await post({
      type,
      created_at: "2026-10-22T10:15:00Z",
      data: { email_id: "e" },
    });

    expect(response.status).toBe(200);
    expect(applies()[0]).toMatchObject({ p_status: status });
  });

  it("reports an event that arrived too late as kept, not applied", async () => {
    fake.once("rpc:apply_email_delivery", { data: "kept" });

    const response = await post({
      type: "email.sent",
      created_at: "2026-10-22T09:00:00Z",
      data: { email_id: "e" },
    });
    const body = (await response.json()) as { received: boolean; kept: boolean };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true, kept: true });
  });

  it("answers a retryable 500, not an acknowledgment, when the database write fails", async () => {
    fake.once("rpc:apply_email_delivery", {
      data: null,
      error: { message: "connection to server was lost" },
    });

    const response = await post(delivered());
    const body = (await response.json()) as { received?: boolean; error?: string };

    expect(response.status).toBe(500);
    expect(body.received).toBeUndefined();
    expect(body.error).toBeTruthy();
  });
});
