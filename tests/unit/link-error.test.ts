import { describe, expect, it } from "vitest";
import { readableLinkError } from "@/lib/email/link-error";

/**
 * A failed emailed link lands on the sign-in page with Supabase's error and
 * where the link was going. Somebody resetting a password cannot sign in, so
 * they must not be told to.
 */
describe("what the sign-in page says about a failed link", () => {
  it("tells somebody whose reset link failed how to get another, not to sign in", () => {
    // What a reset link opened in a different browser used to come back with.
    const pkce = readableLinkError("invalid request: both auth code and code verifier should be non-empty", "/auth/reset");
    expect(pkce).toContain("Forgot your password");
    expect(pkce).not.toMatch(/sign in below/i);

    // And an old or spent one, whatever the words.
    for (const raw of ["Email link is invalid or has expired", "Token has already been used", "anything else"]) {
      const text = readableLinkError(raw, "/auth/reset");
      expect(text).toContain("That reset link did not work.");
      expect(text).not.toMatch(/sign in below|just sign in/i);
    }
  });

  it("knows a reset link by where it was going, query or not", () => {
    expect(readableLinkError("expired", "/auth/reset?from=email")).toContain("reset link");
    expect(readableLinkError("expired", "/resident/pay")).not.toContain("reset link");
  });

  it("keeps the confirmation messages for every other link", () => {
    expect(readableLinkError("Email link is invalid or has expired")).toContain("confirmation link has expired");
    expect(readableLinkError("Token already used", null)).toContain("already been used");
    expect(readableLinkError("something odd", "/resident/pay")).toBe(
      "That link did not work. Try signing in below. If that fails, create the account again.",
    );
  });
});
