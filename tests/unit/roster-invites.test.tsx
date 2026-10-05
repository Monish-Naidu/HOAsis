import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inviteToast, sendInvitations } from "@/app/board/homeowners/homeowners-screen";

/**
 * Inviting everybody who has not signed up, from the roster.
 *
 * The route reads two hundred homes from a call and no more. The screen sent
 * every waiting home in one call, so in an association of four hundred the
 * second two hundred were never invited and never counted, and pressing
 * again sent the same first two hundred ids. The route is a stand-in here
 * that answers as the test tells it to.
 */

const OVER = "That is more invitations than one association can send in an hour. Try again later.";

type Answer = { status?: number; body: Record<string, unknown> };
let calls: string[][];
let answer: (unitIds: string[], call: number) => Answer;

const homes = (count: number) => Array.from({ length: count }, (_, i) => `unit-${i + 1}`);
/** A call that invited everybody it was given. */
const all = (unitIds: string[]): Answer => ({
  body: { sent: unitIds.length, failed: 0, skipped: 0, already: 0, remaining: 0, errors: [] },
});

beforeEach(() => {
  calls = [];
  answer = all;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const { unitIds } = JSON.parse(init.body) as { unitIds: string[] };
      calls.push(unitIds);
      const said = answer(unitIds, calls.length);
      const status = said.status ?? 200;
      return { ok: status < 400, status, json: async () => said.body };
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("sendInvitations", () => {
  it("sends every home, two hundred to a call", async () => {
    const outcome = await sendInvitations("assoc-1", homes(450));

    expect(calls.map((c) => c.length)).toEqual([200, 200, 50]);
    expect(new Set(calls.flat()).size).toBe(450);
    expect(outcome).toEqual({ sent: 450, already: 0, failed: 0 });
  });

  it("does not leave one home on its own in the last call", async () => {
    // The route takes a call for one home as a press for that household and
    // sends it even if it was invited a minute ago.
    await sendInvitations("assoc-1", homes(201));

    expect(calls.map((c) => c.length)).toEqual([199, 2]);
    expect(new Set(calls.flat()).size).toBe(201);
  });

  it("asks for a batch again while the route says homes remain", async () => {
    const answers: Answer[] = [
      { body: { sent: 120, failed: 30, already: 0, remaining: 30, errors: ["Stopped at the time limit"] } },
      // The second call passes over the 120 the first one reached.
      { body: { sent: 30, failed: 0, already: 120, remaining: 0, errors: [] } },
    ];
    answer = (_ids, call) => answers[call - 1];
    const outcome = await sendInvitations("assoc-1", homes(150));

    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    // Its own earlier sends are not counted as people who already had it.
    expect(outcome).toEqual({ sent: 150, already: 0, failed: 0 });
  });

  it("counts who was invited before the press apart from who was sent now", async () => {
    answer = () => ({ body: { sent: 8, failed: 0, already: 12, remaining: 0, errors: [] } });
    const outcome = await sendInvitations("assoc-1", homes(20));

    expect(outcome).toEqual({ sent: 8, already: 12, failed: 0 });
    expect(inviteToast(outcome)).toEqual({
      message: "8 invitations sent, 12 already invited in the last hour",
      tone: "ok",
    });
  });

  it("stops asking a route that is not getting any further", async () => {
    answer = () => ({ body: { sent: 0, failed: 40, already: 0, remaining: 40, errors: ["Stopped at the time limit"] } });
    const outcome = await sendInvitations("assoc-1", homes(40));

    expect(calls).toHaveLength(2);
    expect(outcome).toEqual({ sent: 0, already: 0, failed: 40, reason: "Stopped at the time limit" });
  });

  it("does not ask for ever, even when each call gets a little further", async () => {
    answer = (_ids, call) => ({
      body: { sent: 1, failed: 150 - call, already: call - 1, remaining: 150 - call, errors: ["Stopped at the time limit"] },
    });
    const outcome = await sendInvitations("assoc-1", homes(150));

    expect(calls).toHaveLength(8);
    expect(outcome).toMatchObject({ sent: 8, failed: 142 });
  });

  it("says why when the hourly ceiling stopped it partway, and counts every home not reached", async () => {
    answer = (unitIds, call) =>
      call === 1
        ? { body: { sent: 150, failed: 50, already: 0, remaining: 0, errors: [OVER] } }
        : { status: 429, body: { error: OVER } };
    const outcome = await sendInvitations("assoc-1", homes(400));

    // The second batch was refused outright, and nothing was asked after it.
    expect(calls).toHaveLength(2);
    expect(outcome).toEqual({ sent: 150, already: 0, failed: 250, reason: OVER, refused: true });
    expect(inviteToast(outcome)).toEqual({
      message: `150 invitations sent, 250 not sent. ${OVER}`,
      tone: "warn",
    });
  });

  it("gives the route's reason alone when nothing went at all", async () => {
    answer = () => ({ status: 403, body: { error: "You cannot invite for this association" } });
    const outcome = await sendInvitations("assoc-1", homes(3));

    expect(outcome).toMatchObject({ sent: 0, failed: 3, refused: true });
    expect(inviteToast(outcome)).toEqual({
      message: "You cannot invite for this association",
      tone: "warn",
    });
  });

  it("keeps what went before the mail service dropped out", async () => {
    answer = (unitIds, call) => {
      if (call === 2) throw new Error("network");
      return all(unitIds);
    };
    const outcome = await sendInvitations("assoc-1", homes(300));

    expect(outcome).toEqual({
      sent: 200,
      already: 0,
      failed: 100,
      reason: "The mail service could not be reached. Try again in a few minutes.",
      refused: true,
    });
  });
});

describe("inviteToast", () => {
  it("names the household when one was invited", () => {
    expect(inviteToast({ sent: 1, already: 0, failed: 0 }, "The Parks")).toEqual({
      message: "Invitation sent to The Parks",
      tone: "ok",
    });
  });

  it("gives the first reason when addresses failed", () => {
    expect(
      inviteToast({ sent: 38, already: 0, failed: 2, reason: "ana@example.com: The domain is not verified" }),
    ).toEqual({
      message: "38 invitations sent, 2 not sent. ana@example.com: The domain is not verified",
      tone: "warn",
    });
  });

  it("does not call a second press within the hour a failure", () => {
    expect(inviteToast({ sent: 0, already: 40, failed: 0 })).toEqual({
      message: "0 invitations sent, 40 already invited in the last hour",
      tone: "ok",
    });
  });
});
