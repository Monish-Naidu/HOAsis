import { describe, expect, it, vi } from "vitest";
import { joinReturnPath, openInvitedHome, type InvitedClient } from "@/app/join/invited";
import { sameOriginPath } from "@/app/auth/callback/next-path";

/**
 * An invitation opened by somebody already signed in. The form used to do
 * nothing and say the board had been asked. Now it opens the home when the
 * account holds the seat, and says so plainly when the invitation was for a
 * different address. The two database calls are fakes.
 */
function clientWith(answers: {
  claimError?: string;
  /** How many seats this press claimed, as claim_my_seats answers. */
  claimed?: number;
  member?: { slug: string | null } | null;
  memberError?: string;
}) {
  const order: string[] = [];
  const client: InvitedClient = {
    claimSeats: vi.fn(async () => {
      order.push("claim");
      return answers.claimError
        ? { data: null, error: { message: answers.claimError } }
        : { data: answers.claimed ?? 0, error: null };
    }),
    memberOf: vi.fn(async (code: string) => {
      order.push(`member:${code}`);
      return {
        data: answers.member ?? null,
        error: answers.memberError ? { message: answers.memberError } : null,
      };
    }),
  };
  return { client, order };
}

const who = { code: "a1b2c3", signedInEmail: "dana@work.com" };

describe("opening an invitation while signed in", () => {
  it("claims the seat first, then opens the invited association", async () => {
    const { client, order } = clientWith({ member: { slug: "maple-court" } });
    const outcome = await openInvitedHome(client, who);
    expect(outcome).toEqual({ kind: "open", path: "/c/maple-court/resident" });
    // Claimed before asking, so a seat set out under this address counts.
    expect(order).toEqual(["claim", "member:A1B2C3"]);
  });

  it("opens the resident side when the association has no slug to name", async () => {
    const { client } = clientWith({ member: { slug: null } });
    expect(await openInvitedHome(client, who)).toEqual({ kind: "open", path: "/resident" });
  });

  it("says the invitation was for another address when the account holds no seat there", async () => {
    // Belonging to some other association does not count: the question is
    // asked of the invited one, by its join code.
    const { client } = clientWith({ member: null });
    const outcome = await openInvitedHome(client, who);
    expect(outcome.kind).toBe("other-address");
    expect(outcome).toMatchObject({ message: expect.stringContaining("dana@work.com") });
    expect(outcome).toMatchObject({ message: expect.stringContaining("tell the board which home is yours") });
  });

  describe("when the account already has a home there and the invitation went to another address", () => {
    const invitedElsewhere = { ...who, invitedEmail: "dana@home.com" };

    it("says which address it was sent to and how to take it up, instead of opening the other home in silence", async () => {
      // The seat set out for dana@home.com is still unclaimed: seats are
      // claimed by address, and this account's is dana@work.com.
      const { client, order } = clientWith({ member: { slug: "maple-court" } });
      const outcome = await openInvitedHome(client, invitedElsewhere);
      expect(outcome).toMatchObject({ kind: "other-seat", path: "/c/maple-court/resident" });
      expect(order).toEqual(["claim", "member:A1B2C3"]);
      const message = outcome.kind === "other-seat" ? outcome.message : "";
      expect(message).toContain("This invitation was sent to dana@home.com.");
      expect(message).toContain("You are signed in as dana@work.com, which already has a home here.");
      // Both ways, and neither is a merge: the board moves the home, or it
      // gets an account of its own.
      expect(message).toContain("ask the board to change its email to dana@work.com");
      expect(message).toContain("sign out and create an account with dana@home.com");
    });

    it("opens the home when this press claimed a seat, though the link still names the old address", async () => {
      // The board took the advice and changed the home's email to
      // dana@work.com. The same link, pressed again, claims the seat. It
      // used to answer with the same message and send them back to the board.
      const { client, order } = clientWith({ member: { slug: "maple-court" }, claimed: 1 });
      expect(await openInvitedHome(client, invitedElsewhere)).toEqual({
        kind: "open",
        path: "/c/maple-court/resident",
      });
      expect(order).toEqual(["claim", "member:A1B2C3"]);
    });

    it("does not say the invited home is still waiting, which it cannot know", async () => {
      // Nothing claimed on this press is also what somebody sees who took
      // the home earlier and has since changed their own address.
      const { client } = clientWith({ member: { slug: "maple-court" }, claimed: 0 });
      const outcome = await openInvitedHome(client, invitedElsewhere);
      const message = outcome.kind === "other-seat" ? outcome.message : "";
      expect(message).toContain("If the invited home is not on this account, ask the board to change its email to dana@work.com");
      expect(message).not.toContain("To add the invited home");
    });

    it("reads a claim that answers with no number as nothing claimed", async () => {
      const client: InvitedClient = {
        claimSeats: async () => ({ data: null, error: null }),
        memberOf: async () => ({ data: { slug: "maple-court" }, error: null }),
      };
      expect((await openInvitedHome(client, invitedElsewhere)).kind).toBe("other-seat");
    });

    it("opens the home as before when the invitation was for the signed-in address, however it is typed", async () => {
      const { client } = clientWith({ member: { slug: "maple-court" } });
      expect(await openInvitedHome(client, { ...who, invitedEmail: " Dana@Work.com " })).toEqual({
        kind: "open",
        path: "/c/maple-court/resident",
      });
    });

    it("opens the home when the link carries no address to compare", async () => {
      const { client } = clientWith({ member: { slug: "maple-court" } });
      expect((await openInvitedHome(client, { ...who, invitedEmail: "" })).kind).toBe("open");
      expect((await openInvitedHome(client, { ...who, invitedEmail: null })).kind).toBe("open");
    });

    it("still offers the request to join when the account holds no seat there at all", async () => {
      const { client } = clientWith({ member: null });
      expect((await openInvitedHome(client, invitedElsewhere)).kind).toBe("other-address");
    });
  });

  it("claims nothing and promises nothing when the database does not answer", async () => {
    const failedClaim = clientWith({ claimError: "fetch failed", member: { slug: "maple-court" } });
    expect((await openInvitedHome(failedClaim.client, who)).kind).toBe("error");
    expect(failedClaim.client.memberOf).not.toHaveBeenCalled();

    const failedRead = clientWith({ memberError: "fetch failed" });
    expect((await openInvitedHome(failedRead.client, who)).kind).toBe("error");

    // A seat claimed, and then no answer about the association: still
    // nothing promised.
    const claimedThenFailed = clientWith({ claimed: 1, memberError: "fetch failed" });
    expect((await openInvitedHome(claimedThenFailed.client, who)).kind).toBe("error");

    const thrown: InvitedClient = {
      claimSeats: async () => {
        throw new Error("offline");
      },
      memberOf: async () => ({ data: null, error: null }),
    };
    expect((await openInvitedHome(thrown, who)).kind).toBe("error");
  });
});

describe("coming back to the join page after signing in", () => {
  it("keeps the invited address on the way back", () => {
    expect(joinReturnPath({ invited: true, code: "A1B2C3", email: "dana@home.com" })).toBe(
      "/join?invite=A1B2C3&email=dana%40home.com",
    );
  });

  it("carries only the code when there is no address, or it is a plain code join", () => {
    expect(joinReturnPath({ invited: true, code: "A1B2C3", email: "" })).toBe("/join?invite=A1B2C3");
    expect(joinReturnPath({ invited: false, code: "A1B2C3", email: "dana@home.com" })).toBe("/join?code=A1B2C3");
  });

  it("survives the sign-in page's own check on where it may send somebody", () => {
    const path = joinReturnPath({ invited: true, code: "A1B2C3", email: "dana+hoa@home.com" });
    const next = new URLSearchParams(`next=${encodeURIComponent(path)}`).get("next");
    expect(sameOriginPath(next, "https://yourhoasis.com")).toBe(path);
    expect(new URLSearchParams(path.split("?")[1]).get("email")).toBe("dana+hoa@home.com");
  });
});
