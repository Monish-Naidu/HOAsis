import { describe, expect, it } from "vitest";
import { checkNewEmail, emailChangeSent } from "@/lib/email-change";
import { firstName, removableSeats, removeConfirmText, removedToast, type OwnerSeat } from "@/lib/co-owners";

describe("checkNewEmail", () => {
  it("accepts a good address and trims it", () => {
    expect(checkNewEmail("  new@example.com ", "old@example.com")).toEqual({ ok: true, email: "new@example.com" });
  });
  it("refuses an empty one", () => {
    expect(checkNewEmail("   ", "old@example.com").ok).toBe(false);
  });
  it("needs exactly one @ and a dot after it", () => {
    for (const bad of ["nobody", "a@b", "a@@b.com", "a@b@c.com", "@b.com", "a@.com", "a@b.", "a b@c.com"]) {
      expect(checkNewEmail(bad, "old@example.com").ok, bad).toBe(false);
    }
  });
  it("refuses the current address whatever its case", () => {
    const r = checkNewEmail("OLD@Example.com", "old@example.com");
    expect(r).toEqual({ ok: false, message: "That is already your email." });
  });
  it("allows at most 254 characters", () => {
    const at254 = `${"a".repeat(254 - "@x.co".length)}@x.co`;
    expect(at254).toHaveLength(254);
    expect(checkNewEmail(at254, "old@example.com").ok).toBe(true);
    expect(checkNewEmail(`a${at254}`, "old@example.com").ok).toBe(false);
  });
  it("says what happens next", () => {
    expect(emailChangeSent("new@x.com", "old@x.com")).toBe(
      "We sent a link to new@x.com. Your email changes when you open it. Until then you sign in with old@x.com.",
    );
  });
});

describe("co-owner helpers", () => {
  const seats: OwnerSeat[] = [
    { id: "m1", name: "Ana Park", accountId: "p1", removable: true },
    { id: "m2", name: "Ben Park", accountId: "p2", removable: true },
  ];
  it("takes the first name", () => {
    expect(firstName("Ana Maria Park")).toBe("Ana");
    expect(firstName(" Ben ")).toBe("Ben");
  });
  it("offers nothing on a home with one owner", () => {
    expect(removableSeats([seats[0]], "boardie")).toEqual([]);
  });
  it("offers both people to somebody who is neither", () => {
    expect(removableSeats(seats, "boardie")).toHaveLength(2);
  });
  it("never offers the viewer's own seat", () => {
    expect(removableSeats(seats, "p1").map((s) => s.id)).toEqual(["m2"]);
  });
  it("never offers a seat with an office", () => {
    expect(removableSeats([{ ...seats[0], removable: false }, seats[1]], null).map((s) => s.id)).toEqual(["m2"]);
  });
  it("words the confirm and the toast", () => {
    expect(removeConfirmText("Ben Park", "Ana Park", "Unit 4")).toBe(
      "Ben Park loses access to Unit 4 today. Ana Park stays. Saved payment methods Ben Park added are removed.",
    );
    expect(removedToast("Ben Park", "Unit 4")).toBe("Ben Park removed from Unit 4.");
  });
});
