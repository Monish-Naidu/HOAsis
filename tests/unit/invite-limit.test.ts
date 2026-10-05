import { describe, expect, it } from "vitest";
import { createInviteLimiter, INVITES_PER_HOUR, spendInvites } from "@/lib/email/invite-limit";

/**
 * The ceiling on invitations, counted per message with an injected clock.
 * A board sending to its whole register is inside it; the same batch sent
 * in a loop is not.
 */
function clock(start = 0) {
  let at = start;
  return { now: () => at, tick: (ms: number) => (at += ms) };
}

describe("the invitation limit", () => {
  it("lets a board send its largest batch, and send it again", () => {
    const limiter = createInviteLimiter(clock().now);
    expect(spendInvites(limiter, "assoc-1", 200).ok).toBe(true);
    expect(spendInvites(limiter, "assoc-1", 200).ok).toBe(true);
    expect(spendInvites(limiter, "assoc-1", 200).ok).toBe(true);
  });

  it("refuses the batch that would pass the ceiling, with how long to wait", () => {
    const c = clock();
    const limiter = createInviteLimiter(c.now);
    expect(spendInvites(limiter, "assoc-1", INVITES_PER_HOUR).ok).toBe(true);
    c.tick(15 * 60 * 1000);
    expect(spendInvites(limiter, "assoc-1", 1)).toEqual({ ok: false, retryAfterSeconds: 45 * 60 });
  });

  it("counts messages, not calls", () => {
    const limiter = createInviteLimiter(clock().now);
    // One call for more than the hour allows is refused on its own.
    expect(spendInvites(limiter, "assoc-1", INVITES_PER_HOUR + 1).ok).toBe(false);
    // And many small calls add up the same way.
    const other = createInviteLimiter(clock().now);
    for (let i = 0; i < INVITES_PER_HOUR; i++) expect(spendInvites(other, "assoc-2", 1).ok).toBe(true);
    expect(spendInvites(other, "assoc-2", 1).ok).toBe(false);
  });

  it("keeps associations apart, and opens again after the hour", () => {
    const c = clock();
    const limiter = createInviteLimiter(c.now);
    expect(spendInvites(limiter, "assoc-1", INVITES_PER_HOUR).ok).toBe(true);
    expect(spendInvites(limiter, "assoc-1", 1).ok).toBe(false);
    expect(spendInvites(limiter, "assoc-2", 200).ok).toBe(true);
    c.tick(60 * 60 * 1000);
    expect(spendInvites(limiter, "assoc-1", 200).ok).toBe(true);
  });

  it("costs nothing when there is nobody to write to", () => {
    const limiter = createInviteLimiter(clock().now);
    expect(spendInvites(limiter, "assoc-1", 0)).toEqual({ ok: true, retryAfterSeconds: 0 });
    expect(limiter.size()).toBe(0);
  });
});
