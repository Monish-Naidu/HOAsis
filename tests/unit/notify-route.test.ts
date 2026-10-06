import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "../helpers/fake-supabase";

/**
 * The board notice route, with the sender faked. What is tested is the
 * route's own part: who may send which kind, and that every answer carries
 * the counts the browser reads to decide whether to ask again.
 */

type Counts = { sent: number; failed: number; skipped: number; already: number; remaining: number; errors: string[]; unrecorded?: string };
const done: Counts = { sent: 3, failed: 0, skipped: 0, already: 0, remaining: 0, errors: [] };
const sendNotification = vi.fn<(input: { kind: string; id?: string }) => Promise<Counts>>(async () => done);
vi.mock("@/lib/email/notify", () => ({ sendNotification }));

const recordAppError = vi.fn(async () => "REF");
vi.mock("@/lib/app-errors", () => ({ recordAppError }));

/** The capabilities the caller's seat holds. */
let holds: string[] = [];
let signedIn = true;

const fake = createFakeSupabase({
  "auth.getUser": () => ({ data: { user: signedIn ? { id: "profile-board" } : null } }),
  rpc: (call) => ({ data: holds.includes((call.args[1] as { needed: string }).needed) }),
  memberships: { data: { full_name: "Dana Whitfield" } },
});
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => fake.client }));

const { POST } = await import("@/app/api/email/notify/route");

function notify(body: unknown) {
  return new NextRequest("http://localhost/api/email/notify", {
    method: "POST",
    headers: { host: "localhost" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const NOTHING = { sent: 0, failed: 0, skipped: 0, already: 0, remaining: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  holds = ["communications"];
  signedIn = true;
});

describe("who may send a meeting notice", () => {
  const meeting = { associationId: "assoc-1", kind: "meeting", id: "meeting-1" };

  it("lets the seat that runs meetings send the notice for one", async () => {
    // Voting is what opens the Meetings page and what may write the row.
    // That seat used to press Send notice and have the email refused.
    holds = ["voting"];
    const response = await POST(notify(meeting));
    expect(response.status).toBe(200);
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "meeting", id: "meeting-1" }));
  });

  it("still lets communications send it", async () => {
    const response = await POST(notify(meeting));
    expect(response.status).toBe(200);
  });

  it("does not let voting send an announcement, or a seat with neither send the notice", async () => {
    holds = ["voting"];
    const announcement = await POST(notify({ associationId: "assoc-1", kind: "announcement", id: "ann-1" }));
    expect(announcement.status).toBe(403);
    holds = ["finances"];
    const refused = await POST(notify(meeting));
    expect(refused.status).toBe(403);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("what the route answers", () => {
  const announcement = { associationId: "assoc-1", kind: "announcement", id: "ann-1" };

  it("hands back the counts of a send that finished", async () => {
    const response = await POST(notify(announcement));
    expect(await response.json()).toMatchObject({ sent: 3, failed: 0, skipped: 0, remaining: 0 });
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("says how many remain when the send stopped, and puts the stop on /admin", async () => {
    sendNotification.mockResolvedValueOnce({ sent: 60, failed: 40, skipped: 0, already: 20, remaining: 40, errors: ["Stopped at the time limit."] });
    const response = await POST(notify(announcement));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 60, failed: 40, skipped: 0, already: 20, remaining: 40 });
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
        route: "email/notify",
        extra: expect.objectContaining({ kind: "announcement", id: "ann-1", sent: 60, failed: 0, already: 20, remaining: 40 }),
      }),
    );
  });

  it("puts a send whose record could not be written on /admin, and answers with nothing remaining", async () => {
    // Nothing remaining is what stops the browser calling again: with no
    // record, the next call would write to the same people.
    sendNotification.mockResolvedValueOnce({
      sent: 1,
      failed: 4,
      skipped: 0,
      already: 0,
      remaining: 0,
      errors: ["Stopped. The record of this send could not be saved."],
      unrecorded: "permission denied for table email_log",
    });
    const response = await POST(notify(announcement));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 1, failed: 4, remaining: 0 });
    expect(recordAppError).toHaveBeenCalledTimes(1);
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        route: "email/notify",
        message: "The record of the announcement email could not be saved",
        extra: expect.objectContaining({ kind: "announcement", id: "ann-1", sent: 1, why: "permission denied for table email_log" }),
      }),
    );
  });

  it("carries the same counts, all zero, on every refusal", async () => {
    // The browser reads `remaining` to decide whether to ask again. A
    // refusal with no number there reads as undefined, not as nothing left.
    signedIn = false;
    const signedOut = await POST(notify(announcement));
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toMatchObject({ error: "Sign in first", ...NOTHING });

    signedIn = true;
    const garbled = await POST(notify("not json"));
    expect(garbled.status).toBe(400);
    expect(await garbled.json()).toMatchObject(NOTHING);

    const unnamed = await POST(notify({ associationId: "assoc-1" }));
    expect(unnamed.status).toBe(400);
    expect(await unnamed.json()).toMatchObject(NOTHING);

    const unknown = await POST(notify({ associationId: "assoc-1", kind: "newsletter" }));
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject(NOTHING);

    holds = [];
    const refused = await POST(notify(announcement));
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: "You cannot send that for this association", ...NOTHING });
  });

  it("carries them when the send itself fails, with the reason and a reference", async () => {
    sendNotification.mockRejectedValueOnce(new Error("Nothing to send: that item was not found"));
    const response = await POST(notify(announcement));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ error: "Nothing to send: that item was not found", ...NOTHING });
    expect(typeof body.reference).toBe("string");
  });
});
