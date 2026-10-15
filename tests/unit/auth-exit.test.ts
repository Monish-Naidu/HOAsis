import { describe, expect, it } from "vitest";
import {
  isExiting,
  noteLeaving,
  clearExiting,
  signOutOfSupabase,
  signOutSettled,
} from "@/lib/auth";

describe("leaving on purpose", () => {
  it("is not exiting until somebody chooses to leave", () => {
    clearExiting();
    expect(isExiting()).toBe(false);
  });

  it("marks a sign out as deliberate, and a session coming back clears it", async () => {
    await signOutOfSupabase();
    expect(isExiting()).toBe(true);
    clearExiting();
    expect(isExiting()).toBe(false);
  });

  it("marks a walk to the sign-in page that ends no real session", () => {
    noteLeaving();
    expect(isExiting()).toBe(true);
    clearExiting();
  });

  it("has nothing to wait for when no sign out is in flight", async () => {
    await expect(signOutSettled()).resolves.toBeUndefined();
  });
});
