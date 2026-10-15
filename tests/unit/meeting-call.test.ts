import { describe, expect, it } from "vitest";
import { offersVideoCall } from "@/lib/meeting-call";

describe("offersVideoCall", () => {
  it("is false for a meeting held in a room with nothing typed to join by", () => {
    expect(offersVideoCall({ location: "Clubhouse", dialIn: "" })).toBe(false);
    expect(offersVideoCall({ location: "Clubhouse" })).toBe(false);
    expect(offersVideoCall({ location: "Community room", dialIn: "   " })).toBe(false);
  });

  it("is true when a link or number is typed", () => {
    expect(offersVideoCall({ location: "Clubhouse", dialIn: "https://example.com/room" })).toBe(
      true,
    );
    expect(offersVideoCall({ location: "Clubhouse", dialIn: "425-555-0142" })).toBe(true);
  });

  it("is true when the place says it is a call", () => {
    expect(offersVideoCall({ location: "Video call" })).toBe(true);
    expect(offersVideoCall({ location: "Zoom" })).toBe(true);
    expect(offersVideoCall({ location: "Clubhouse and online" })).toBe(true);
  });
});
