import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "../helpers/fake-supabase";
import { requestOrigin, sameOriginPath } from "@/app/auth/callback/next-path";

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
    expect(sameOriginPath("/c/maple-court/resident?tab=dues#top", ORIGIN)).toBe(
      "/c/maple-court/resident?tab=dues#top",
    );
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

describe("requestOrigin", () => {
  const parsed = (href: string) => new URL(href);

  it("keeps 127.0.0.1 and [::1], which Next.js reports as localhost, on the same port", () => {
    expect(requestOrigin(parsed("http://localhost:3100/auth/callback"), "127.0.0.1:3100")).toBe(
      "http://127.0.0.1:3100",
    );
    expect(requestOrigin(parsed("http://localhost:3100/auth/callback"), "[::1]:3100")).toBe(
      "http://[::1]:3100",
    );
    expect(requestOrigin(parsed("http://localhost:3100/auth/callback"), "localhost:3100")).toBe(
      "http://localhost:3100",
    );
  });

  it("never lets the Host header pick another site or port", () => {
    const local = parsed("http://localhost:3100/auth/callback");
    for (const host of [
      "evil.example",
      "evil.example:3100",
      "127.0.0.1:3100@evil.example",
      "127.0.0.1:9999",
      "127.0.0.1.evil.example:3100",
      "127.0.0.1:3100/evil",
      "",
    ]) {
      expect(requestOrigin(local, host)).toBe("http://localhost:3100");
    }
    expect(requestOrigin(local, null)).toBe("http://localhost:3100");
  });

  it("leaves a real deployment's origin alone whatever the header says", () => {
    expect(requestOrigin(parsed(`${ORIGIN}/auth/callback`), "127.0.0.1")).toBe(ORIGIN);
    expect(requestOrigin(parsed(`${ORIGIN}/auth/callback`), "evil.example")).toBe(ORIGIN);
  });
});
const fake = createFakeSupabase({ "rpc:my_associations": { data: [{ role: "resident" }] } });

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => fake.client }));

const { GET } = await import("@/app/auth/callback/route");

function callback(query: string) {
  return GET(new NextRequest(`${ORIGIN}/auth/callback?${query}`));
}

beforeEach(() => {
  fake.reset();
});

describe("the callback route", () => {
  it("verifies an emailed token and lands on the screen the notice was about", async () => {
    const response = await callback("token_hash=hash_123&type=magiclink&next=%2Fresident%2Fpay");
    expect(fake.callsTo("auth.verifyOtp")[0].args).toEqual([
      { token_hash: "hash_123", type: "magiclink" },
    ]);
    expect(fake.callsTo("rpc:claim_my_seats")).toHaveLength(1);
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
    fake.once("auth.verifyOtp", { error: { message: "Email link is invalid or has expired" } });
    const response = await callback(
      "token_hash=spent&type=magiclink&next=%2Fc%2Fmaple-court%2Fresident%2Fpay",
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("error")).toBe("Email link is invalid or has expired");
    expect(location.searchParams.get("next")).toBe("/c/maple-court/resident/pay");
    expect(fake.calls.map((call) => call.target)).toEqual(["auth.verifyOtp"]);
  });

  it("does not carry a foreign destination through a failed link either", async () => {
    fake.once("auth.verifyOtp", { error: { message: "expired" } });
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
      fake.on("rpc:my_associations", { data: [] });
      fake.on("rpc:my_join_requests", { data: asked });
      const response = await callback("token_hash=hash_123&type=signup");
      expect(new URL(response.headers.get("location")!).pathname).toBe("/resident");
    }
  });
});

describe("the callback on a loopback address", () => {
  // What Next.js hands the route for a link opened on http://127.0.0.1:3100:
  // a URL that says localhost, and the Host header the browser sent.
  function local(query: string, headers: Record<string, string>) {
    return GET(new NextRequest(`http://localhost:3100/auth/callback?${query}`, { headers }));
  }

  it("lands on the address the link was opened on, where the session cookie is", async () => {
    const response = await local("token_hash=hash_123&type=magiclink&next=%2Fboard", {
      host: "127.0.0.1:3100",
    });
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3100/board");
  });

  it("sends a failed link to sign in on that same address", async () => {
    fake.once("auth.verifyOtp", { error: { message: "expired" } });
    const response = await local("token_hash=spent&type=magiclink&next=%2Fboard", {
      host: "127.0.0.1:3100",
    });
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("http://127.0.0.1:3100");
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("next")).toBe("/board");
  });

  it("ignores a forwarded or foreign host, and still drops a foreign next", async () => {
    for (const next of ["//evil.example", "https://evil.example/x", "/%5Cevil.example"]) {
      const response = await local(`token_hash=hash_123&type=magiclink&next=${next}`, {
        host: "evil.example",
        "x-forwarded-host": "evil.example",
      });
      const location = new URL(response.headers.get("location")!);
      expect(location.origin).toBe("http://localhost:3100");
      expect(location.pathname).toBe("/resident");
    }
  });
});
