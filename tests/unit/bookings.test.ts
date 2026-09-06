import { describe, expect, it } from "vitest";
import { blackoutFor, describeRules, rulesFor, slotsFor, formatMinute } from "@/lib/bookings";
import type { AmenityBooking, CommunityAmenity } from "@/lib/types";

const clubhouse: CommunityAmenity = {
  id: "am-club",
  name: "Clubhouse",
  reservable: true,
  detail: "Main room",
  status: "open",
  rules: { opensHour: 9, closesHour: 12, slotMinutes: 60, maxPerDay: 1, maxPerWeek: 2 },
};

const booking = (over: Partial<AmenityBooking>): AmenityBooking => ({
  id: "b1",
  amenityId: "am-club",
  date: "2026-09-01",
  startMinute: 9 * 60,
  endMinute: 10 * 60,
  unit: "12",
  ownerName: "Neighbour",
  status: "confirmed",
  ...over,
});

describe("booking rules", () => {
  it("offers a slot for every block between opening and closing", () => {
    const slots = slotsFor(clubhouse, "2026-09-01", [], "7");
    expect(slots.map((s) => s.label)).toEqual(["9 AM", "10 AM", "11 AM"]);
  });

  it("never offers a block that would run past closing", () => {
    const short = { ...clubhouse, rules: { ...clubhouse.rules, slotMinutes: 120 } };
    const slots = slotsFor(short, "2026-09-01", [], "7");
    // 9 to 12 fits one two hour block, not two.
    expect(slots).toHaveLength(1);
    expect(slots[0].endMinute).toBe(11 * 60);
  });

  it("marks somebody else's booking as taken, and says so", () => {
    const slots = slotsFor(clubhouse, "2026-09-01", [booking({})], "7");
    expect(slots[0].taken).toBe(true);
    expect(slots[0].allowed).toBe(false);
    expect(slots[0].blockedBecause).toBe("Already booked");
    expect(slots[1].allowed, "an unrelated hour was blocked too").toBe(true);
  });

  it("stops a home booking twice in one day, and distinguishes it from a clash", () => {
    // The two are different problems with different answers, so collapsing
    // them into one greyed out square teaches the resident nothing.
    const slots = slotsFor(clubhouse, "2026-09-01", [booking({ unit: "7" })], "7");
    expect(slots[1].allowed).toBe(false);
    expect(slots[1].blockedBecause).toBe("You already have a booking today");
    expect(slots[0].blockedBecause).toBe("Already booked");
  });

  it("counts the weekly cap across different days of the same week", () => {
    const mine = [
      booking({ id: "a", date: "2026-08-31", unit: "7" }),
      booking({ id: "b", date: "2026-09-02", unit: "7" }),
    ];
    // Monday 31 August and Wednesday 2 September are the same week.
    const slots = slotsFor(clubhouse, "2026-09-04", mine, "7");
    expect(slots.every((s) => !s.allowed)).toBe(true);
    expect(slots[0].blockedBecause).toBe("You have used all 2 this week");
  });

  it("does not count a declined booking against anybody", () => {
    const slots = slotsFor(
      clubhouse,
      "2026-09-01",
      [booking({ unit: "7", status: "declined" })],
      "7",
    );
    expect(slots.every((s) => s.allowed), "a declined booking still blocked the day").toBe(true);
  });

  it("keeps an older amenity's maxHours rather than overriding it", () => {
    const legacy: CommunityAmenity = {
      id: "am-tennis",
      name: "Tennis court",
      reservable: true,
      detail: "",
      status: "open",
      maxHours: 2,
    };
    expect(rulesFor(legacy).maxHours).toBe(2);
  });

  it("states the rules in a sentence a resident can read", () => {
    expect(describeRules(clubhouse)).toBe(
      "9 AM to 12 PM, one hour at a time, once a day, 2 times a week, book up to 30 days ahead.",
    );
  });

  it("closes every slot on a blacked out day and says why", () => {
    const closed: CommunityAmenity = {
      ...clubhouse,
      rules: {
        ...clubhouse.rules,
        blackouts: [{ from: "2026-09-01", to: "2026-09-03", reason: "Floor refinishing" }],
      },
    };
    // Inclusive on both ends: the 3rd is closed, the 4th is open.
    expect(blackoutFor(closed, "2026-09-03")?.reason).toBe("Floor refinishing");
    expect(blackoutFor(closed, "2026-09-04")).toBeUndefined();
    const slots = slotsFor(closed, "2026-09-02", [], "7");
    expect(slots.every((s) => !s.allowed)).toBe(true);
    expect(slots[0].blockedBecause).toBe("Closed: Floor refinishing");
    expect(slotsFor(closed, "2026-09-04", [], "7")[0].allowed).toBe(true);
  });

  it("puts the fee and the deposit in the sentence", () => {
    const paid = {
      ...clubhouse,
      rules: { ...clubhouse.rules, feeCents: 4_000, depositCents: 15_000 },
    };
    expect(describeRules(paid)).toBe(
      "9 AM to 12 PM, one hour at a time, once a day, 2 times a week, book up to 30 days ahead, $40 a booking, $150 deposit.",
    );
  });

  it("formats the clock without a date library", () => {
    expect(formatMinute(0)).toBe("12 AM");
    expect(formatMinute(12 * 60)).toBe("12 PM");
    expect(formatMinute(13 * 60 + 30)).toBe("1:30 PM");
  });
});
