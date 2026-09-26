import type { AmenityBooking } from "@/lib/types";

/**
 * Reservations already on the books at Willow Creek Estates.
 *
 * Seeded so the picker has something to grey out. A booking screen where every
 * slot is free demonstrates nothing, because the interesting case is the one
 * where a resident wants the hour somebody else already has.
 *
 * Dates are relative to the seeded present, computed once at import.
 */
function dayFromNow(days: number): string {
  const d = new Date(Date.UTC(2026, 7, 20));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const amenityBookings: AmenityBooking[] = [
  {
    id: "bk-1",
    amenityId: "am-clubhouse",
    date: dayFromNow(2),
    startMinute: 18 * 60,
    endMinute: 20 * 60,
    unit: "19",
    ownerName: "Dana Whitcomb",
    status: "confirmed",
  },
  {
    id: "bk-2",
    amenityId: "am-clubhouse",
    date: dayFromNow(5),
    startMinute: 10 * 60,
    endMinute: 12 * 60,
    unit: "31",
    ownerName: "Sofia Bergman",
    status: "confirmed",
  },
  {
    id: "bk-3",
    amenityId: "am-tennis",
    date: dayFromNow(1),
    startMinute: 17 * 60,
    endMinute: 19 * 60,
    unit: "7",
    ownerName: "Arya Mehr",
    status: "held",
  },
];
