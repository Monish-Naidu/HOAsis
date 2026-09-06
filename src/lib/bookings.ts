import type { AmenityBooking, Blackout, BookingRules, CommunityAmenity } from "@/lib/types";
import { money, todayIsoDate } from "@/lib/utils";

/**
 * Turning a board's rules into the slots a resident may actually pick.
 *
 * The alternative, which is what most associations run today, is a laminated
 * sign by the door and an argument in the group chat. Offering only the slots
 * that comply is kinder than accepting a booking and then refusing it, and it
 * removes the board from the enforcement business entirely.
 *
 * Times are minutes from midnight throughout. Nothing here touches a timezone,
 * because a booking is local to the clubhouse and always was.
 */

export const DEFAULT_RULES: Required<
  Pick<BookingRules, "opensHour" | "closesHour" | "slotMinutes" | "maxHours" | "maxPerDay" | "maxPerWeek" | "advanceDays">
> = {
  opensHour: 8,
  closesHour: 22,
  slotMinutes: 60,
  maxHours: 2,
  maxPerDay: 1,
  maxPerWeek: 3,
  advanceDays: 30,
};

export function rulesFor(amenity: CommunityAmenity): typeof DEFAULT_RULES & BookingRules {
  return {
    ...DEFAULT_RULES,
    // An older amenity carries maxHours at the top level. Honour it rather
    // than silently overriding it with the default.
    ...(amenity.maxHours ? { maxHours: amenity.maxHours } : {}),
    ...(amenity.rules ?? {}),
  };
}

export interface Slot {
  startMinute: number;
  endMinute: number;
  label: string;
  /** Taken by somebody else. */
  taken: boolean;
  /** Allowed by the rules, given what this home has already booked. */
  allowed: boolean;
  /** Why not, in the words the rule was written in. */
  blockedBecause?: string;
}

/** "2:30 PM", without pulling in a date library for four lines. */
export function formatMinute(minute: number): string {
  const hour24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minutes === 0
    ? `${hour12} ${suffix}`
    : `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function isoDaysFrom(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday-based week an ISO date falls in, used for the weekly cap. */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * The blackout covering a day, if one does.
 *
 * A blackout is a closed sign with a reason on it: the floor is being
 * refinished, the board booked it for the annual meeting, it is Christmas.
 * Inclusive on both ends, because "closed the 24th to the 26th" means the
 * 26th too, in the words the board would use.
 */
export function blackoutFor(amenity: CommunityAmenity, date: string): Blackout | undefined {
  return (amenity.rules?.blackouts ?? []).find((b) => b.from <= date && date <= b.to);
}

export function isBlackedOut(amenity: CommunityAmenity, date: string): boolean {
  return Boolean(blackoutFor(amenity, date));
}

/**
 * Every slot on one day, marked with whether this home may take it.
 *
 * A slot is offered unless a specific rule stops it, and when one does the slot
 * says which. "Booked by unit 12" and "you already have one today" are
 * different problems with different answers, and collapsing them into a greyed
 * out square teaches the resident nothing.
 */
export function slotsFor(
  amenity: CommunityAmenity,
  date: string,
  bookings: AmenityBooking[],
  unit: string,
): Slot[] {
  const rules = rulesFor(amenity);
  const onThisDay = bookings.filter(
    (b) => b.amenityId === amenity.id && b.date === date && b.status !== "declined",
  );
  const mine = bookings.filter((b) => b.unit === unit && b.status !== "declined");
  const minePerDay = mine.filter((b) => b.amenityId === amenity.id && b.date === date).length;
  const minePerWeek = mine.filter(
    (b) => b.amenityId === amenity.id && weekKey(b.date) === weekKey(date),
  ).length;

  const dayCapReached = minePerDay >= rules.maxPerDay;
  const weekCapReached = minePerWeek >= rules.maxPerWeek;
  const closed = blackoutFor(amenity, date);

  const slots: Slot[] = [];
  for (
    let start = rules.opensHour * 60;
    start + rules.slotMinutes <= rules.closesHour * 60;
    start += rules.slotMinutes
  ) {
    const end = start + rules.slotMinutes;
    const taken = onThisDay.some((b) => start < b.endMinute && end > b.startMinute);

    let blockedBecause: string | undefined;
    if (closed) blockedBecause = `Closed: ${closed.reason || "not available"}`;
    else if (taken) blockedBecause = "Already booked";
    else if (dayCapReached)
      blockedBecause =
        rules.maxPerDay === 1
          ? "You already have a booking today"
          : `You have used all ${rules.maxPerDay} bookings today`;
    else if (weekCapReached) blockedBecause = `You have used all ${rules.maxPerWeek} this week`;

    slots.push({
      startMinute: start,
      endMinute: end,
      label: formatMinute(start),
      taken,
      allowed: !blockedBecause,
      blockedBecause,
    });
  }
  return slots;
}

/** The days a resident may pick between, from today to the advance limit. */
export function bookableDays(amenity: CommunityAmenity, from = todayIsoDate()): string[] {
  const rules = rulesFor(amenity);
  return Array.from({ length: rules.advanceDays + 1 }, (_, i) => isoDaysFrom(from, i));
}

/**
 * The rules as one line of English, for the board and the resident alike.
 *
 * Written out rather than shown as fields because a resident should be able to
 * read what they are allowed to do without decoding a settings panel.
 */
export function describeRules(amenity: CommunityAmenity): string {
  const r = rulesFor(amenity);
  const parts: string[] = [];

  parts.push(`${formatMinute(r.opensHour * 60)} to ${formatMinute(r.closesHour * 60)}`);
  parts.push(
    r.slotMinutes === 60
      ? "one hour at a time"
      : r.slotMinutes % 60 === 0
        ? `${r.slotMinutes / 60} hours at a time`
        : `${r.slotMinutes} minutes at a time`,
  );
  parts.push(
    r.maxPerDay === 1 ? "once a day" : `up to ${r.maxPerDay} times a day`,
  );
  if (r.maxPerWeek < r.maxPerDay * 7) parts.push(`${r.maxPerWeek} times a week`);
  parts.push(`book up to ${r.advanceDays} days ahead`);
  // Whole dollars in a sentence; a sign reads "$40", not "$40.00".
  const whole = (cents: number) => money(cents, { cents: cents % 100 !== 0 });
  if (r.feeCents && r.feeCents > 0) parts.push(`${whole(r.feeCents)} a booking`);
  if (r.depositCents && r.depositCents > 0) parts.push(`${whole(r.depositCents)} deposit`);

  return `${parts.join(", ")}.`;
}
