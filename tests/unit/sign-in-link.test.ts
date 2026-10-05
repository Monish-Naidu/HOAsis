import { describe, expect, it, vi } from "vitest";
import { callbackLink, signInFallback, signInUrl } from "@/lib/email/sign-in-link";
import { sameOriginPath } from "@/app/auth/callback/next-path";

/**
 * The link in every notice. It has to arrive at our own callback with a
 * token the server can verify, because the browser client refuses the
 * fragment tokens Supabase's own action_link comes back with. No network:
 * the admin client is a stand-in that answers what generateLink would.
 */

const ORIGIN = "https://yourhoasis.com";

function adminAnswering(answer: unknown) {
  const generateLink = vi.fn(async () => answer);
  return { admin: { auth: { admin: { generateLink } } } as never, generateLink };
}

const minted = {
  data: {
    properties: {
      // What must never be sent: it signs nobody in on this site.
      action_link: "https://ref.supabase.co/auth/v1/verify?token=abc&type=magiclink&redirect_to=x",
      hashed_token: "hash_123",
    },
    user: { id: "u1" },
  },
  error: null,
};

describe("callbackLink", () => {
  it("carries the token hash, how to verify it, and where to land", () => {
    const link = new URL(callbackLink(ORIGIN, { tokenHash: "hash_123", type: "magiclink", path: "/c/maple-court/resident" }));
    expect(link.origin).toBe(ORIGIN);
    expect(link.pathname).toBe("/auth/callback");
    expect(link.searchParams.get("token_hash")).toBe("hash_123");
    expect(link.searchParams.get("type")).toBe("magiclink");
    expect(link.searchParams.get("next")).toBe("/c/maple-court/resident");
  });

  it("keeps a destination the callback will agree to follow", () => {
    const link = new URL(callbackLink(ORIGIN, { tokenHash: "h", type: "invite", path: "/resident/requests/REQ-2026-014" }));
    expect(sameOriginPath(link.searchParams.get("next"), ORIGIN)).toBe("/resident/requests/REQ-2026-014");
  });
});

describe("signInUrl", () => {
  it("sends our own callback with the hashed token, never Supabase's action_link", async () => {
    const { admin, generateLink } = adminAnswering(minted);
    const url = await signInUrl(admin, { email: "gwen@example.com", type: "magiclink", origin: ORIGIN, path: "/resident/pay" });
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "gwen@example.com" });
    expect(url).toBe(`${ORIGIN}/auth/callback?token_hash=hash_123&type=magiclink&next=%2Fresident%2Fpay`);
    expect(url).not.toContain("supabase.co");
  });

  it("asks the callback to verify an invite as an invite", async () => {
    const { admin, generateLink } = adminAnswering(minted);
    const url = await signInUrl(admin, { email: "new@example.com", type: "invite", origin: ORIGIN, path: "/resident/pay" });
    expect(generateLink).toHaveBeenCalledWith({ type: "invite", email: "new@example.com" });
    expect(new URL(url).searchParams.get("type")).toBe("invite");
  });

  it("falls back to the sign-in page, bound for the same screen, when no token is minted", async () => {
    const refused = adminAnswering({ data: { properties: null, user: null }, error: { message: "User already registered" } });
    expect(
      await signInUrl(refused.admin, { email: "a@example.com", type: "invite", origin: ORIGIN, path: "/resident/pay" }),
    ).toBe(`${ORIGIN}/signin?next=%2Fresident%2Fpay`);

    const thrown = { auth: { admin: { generateLink: vi.fn(async () => { throw new Error("fetch failed"); }) } } } as never;
    expect(
      await signInUrl(thrown, { email: "a@example.com", type: "magiclink", origin: ORIGIN, path: "/resident/vote" }),
    ).toBe(signInFallback(ORIGIN, "/resident/vote"));
  });
});
