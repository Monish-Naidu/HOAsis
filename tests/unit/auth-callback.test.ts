import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sameOriginPath } from "@/app/auth/callback/next-path";

/**
 * Where a link lands after it has proved who somebody is. Two promises:
 * `next` is only ever followed to a path on this site, and a link that did
 * not verify still remembers where it was going. No Supabase: the server
 * client is a stand-in whose answers each test chooses.
 */

const ORIGIN = "https://yourhoasis.com";

describe("sameOriginPath", () => {
  it("keeps a path on this site, query and all", () => {
    expect(sameOriginPath("/resident/pay", ORIGIN)).toBe("/resident/pay");
    expect(sameOriginPath("/c/maple-court/resident?tab=dues#top", ORIGIN)).toBe("/c/maple-court/resident?tab=dues#top");
    expect(sameOriginPath("/auth/reset", ORIGIN)).toBe("/auth/reset");
  });

  it("drops anything the URL parser would resolve to another host", () => {
    // A backslash is read as a slash, and tabs and newlines are removed.
    expect(sameOriginPath("/\\evil.com", ORIGIN)).toBeNull();
    expect(sameOriginPath("/\t/evil.com", ORIGIN)).toBeNull();
    expect(sameOriginPath("/\n/evil.com/signin", ORIGIN)).toBeNull();
    expect(sameOriginPath("//evil.com", ORIGIN)).toBeNull();
    expect(sameOriginPath("/\\/evil.com", ORIGIN)).toBeNull();
  });

  it("drops a path that only leaves the site when it is read a second time", () => {
    // Dot segments collapse on the first parse and leave "//evil.example",
    // which the redirect would then resolve as another host.
    expect(sameOriginPath("/.//evil.example/signin", ORIGIN)).toBeNull();
    expect(sameOriginPath("/%2e//evil.example", ORIGIN)).toBeNull();
    expect(sameOriginPath("/x/..//evil.example", ORIGIN)).toBeNull();
    // A real path with dot segments still resolves to where it points.
    expect(sameOriginPath("/resident/../board/money", ORIGIN)).toBe("/board/money");
  });

  it("drops what is not a path at all", () => {
    expect(sameOriginPath("https://evil.com/x", ORIGIN)).toBeNull();
    expect(sameOriginPath("resident/pay", ORIGIN)).toBeNull();
    expect(sameOriginPath("javascript:alert(1)", ORIGIN)).toBeNull();
    expect(sameOriginPath("", ORIGIN)).toBeNull();
    expect(sameOriginPath(null, ORIGIN)).toBeNull();
  });
});

const verifyOtp = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
const exchangeCodeForSession = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
const rpc = vi.fn(async (name: string): Promise<{ data: unknown }> =>
  name === "my_associations" ? { data: [{ role: "resident" }] } : { data: null },
);

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { verifyOtp, exchangeCodeForSession }, rpc }),
}));

const { GET } = await import("@/app/auth/callback/route");

function callback(query: string) {
  return GET(new NextRequest(`${ORIGIN}/auth/callback?${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the callback route", () => {
  it("verifies an emailed token and lands on the screen the notice was about", async () => {
    const response = await callback("token_hash=hash_123&type=magiclink&next=%2Fresident%2Fpay");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash_123", type: "magiclink" });
    expect(rpc).toHaveBeenCalledWith("claim_my_seats");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/resident/pay`);
  });

  it("will not be used to bounce somebody to another site", async () => {
    for (const next of ["/%5Cevil.com", "/%09/evil.com", "//evil.com", "https://evil.com"]) {
      const response = await callback(`token_hash=hash_123&type=signup&next=${next}`);
      const location = new URL(response.headers.get("location")!);
      expect(location.origin).toBe(ORIGIN);
      // With no destination worth following, it answers as if none was given.
      expect(location.pathname).toBe("/resident");
    }
  });

  it("sends a link that did not verify to sign in, still bound for the same screen", async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: "Email link is invalid or has expired" } });
    const response = await callback("token_hash=spent&type=magiclink&next=%2Fc%2Fmaple-court%2Fresident%2Fpay");
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("error")).toBe("Email link is invalid or has expired");
    expect(location.searchParams.get("next")).toBe("/c/maple-court/resident/pay");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not carry a foreign destination through a failed link either", async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: "expired" } });
    const response = await callback("token_hash=spent&type=magiclink&next=/%5Cevil.com");
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.has("next")).toBe(false);
  });

  it("sends somebody with an account and no association to the fork, never to the founder's setup", async () => {
    // Wrong email at sign up, a declined request, a copied link, a request
    // still waiting: the resident side tells them apart and offers each the
    // right door. Setup is the fork's second choice.
    for (const asked of [[], [{ status: "pending" }], [{ status: "declined" }]]) {
      rpc.mockImplementation(async (name: string) =>
        name === "my_associations" ? { data: [] } : name === "my_join_requests" ? { data: asked } : { data: null },
      );
      const response = await callback("token_hash=hash_123&type=signup");
      expect(new URL(response.headers.get("location")!).pathname).toBe("/resident");
    }
    rpc.mockImplementation(async (name: string) =>
      name === "my_associations" ? { data: [{ role: "resident" }] } : { data: null },
    );
  });
});
