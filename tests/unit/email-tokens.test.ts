import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "test-secret-for-unsubscribe-signing";
});

const { signUnsubscribe, verifyUnsubscribe, unsubscribeUrl } = await import(
  "@/lib/email/tokens"
);

const PERSON = "11111111-2222-3333-4444-555555555555";

describe("unsubscribe links", () => {
  it("verifies a link it signed", () => {
    expect(verifyUnsubscribe(PERSON, "newsletter", signUnsubscribe(PERSON, "newsletter"))).toBe(
      true,
    );
  });

  it("rejects a link edited to point at somebody else", () => {
    // The whole point: changing the person in the address bar must not let you
    // unsubscribe a neighbor.
    const token = signUnsubscribe(PERSON, "newsletter");
    expect(verifyUnsubscribe("99999999-2222-3333-4444-555555555555", "newsletter", token)).toBe(
      false,
    );
  });

  it("rejects a link edited to a different category", () => {
    const token = signUnsubscribe(PERSON, "newsletter");
    expect(verifyUnsubscribe(PERSON, "community", token)).toBe(false);
  });

  it("rejects a truncated or empty token", () => {
    const token = signUnsubscribe(PERSON, "newsletter");
    expect(verifyUnsubscribe(PERSON, "newsletter", token.slice(0, 10))).toBe(false);
    expect(verifyUnsubscribe(PERSON, "newsletter", "")).toBe(false);
  });

  it("is stable, so a link found in an old email still works", () => {
    expect(signUnsubscribe(PERSON, "newsletter")).toBe(signUnsubscribe(PERSON, "newsletter"));
  });

  it("builds a URL carrying the person, the category, and the signature", () => {
    const url = new URL(unsubscribeUrl("https://expresshoa.app", PERSON, "community"));
    expect(url.pathname).toBe("/unsubscribe");
    expect(url.searchParams.get("p")).toBe(PERSON);
    expect(url.searchParams.get("c")).toBe("community");
    expect(verifyUnsubscribe(PERSON, "community", url.searchParams.get("t")!)).toBe(true);
  });
});
