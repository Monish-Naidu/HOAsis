"use client";

import { useState } from "react";
import { Clock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { describeRules, formatMinute, rulesFor } from "@/lib/bookings";
import type { BookingRules, CommunityAmenity } from "@/lib/types";

/**
 * The rules a board sets on a bookable space.
 *
 * Every association already has these. They are on a laminated sign by the
 * clubhouse door, and they are enforced by whoever is willing to have the
 * argument. Writing them down as numbers moves the enforcement into the
 * booking screen, which simply does not offer a slot that breaks one.
 *
 * Collapsed by default, because most boards set them once and never look
 * again, and an expanded panel of seven fields under every amenity is how a
 * settings page becomes unreadable.
 */
export function AmenityRules({
  amenity,
  onChange,
}: {
  amenity: CommunityAmenity;
  onChange: (rules: BookingRules) => void;
}) {
  const [open, setOpen] = useState(false);
  const rules = rulesFor(amenity);
  const set = (patch: Partial<BookingRules>) => onChange({ ...amenity.rules, ...patch });

  const field =
    "h-9 rounded-lg border border-border-2 bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-brand";

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand transition-opacity hover:opacity-80"
      >
        <SlidersHorizontal className="size-3.5" />
        {open ? "Hide booking rules" : "Booking rules"}
      </button>

      {/* The rules in a sentence, always visible. A board should be able to
          check what they set without opening anything. */}
      {!open ? (
        <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-fg-muted">
          <Clock className="mt-0.5 size-3.5 shrink-0" />
          {describeRules(amenity)}
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 rounded-card border border-border bg-surface-2 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Open from</span>
              <select
                value={rules.opensHour}
                onChange={(e) => set({ opensHour: Number(e.target.value) })}
                className={`mt-1.5 w-full ${field}`}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {formatMinute(h * 60)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Until</span>
              <select
                value={rules.closesHour}
                onChange={(e) => set({ closesHour: Number(e.target.value) })}
                className={`mt-1.5 w-full ${field}`}
              >
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                  <option key={h} value={h}>
                    {formatMinute(Math.min(h, 23) * 60 + (h === 24 ? 59 : 0))}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">
                How long is one booking
              </span>
              <select
                value={rules.slotMinutes}
                onChange={(e) => set({ slotMinutes: Number(e.target.value) })}
                className={`mt-1.5 w-full ${field}`}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1 hour 30</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>4 hours</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">
                How far ahead can they book
              </span>
              <select
                value={rules.advanceDays}
                onChange={(e) => set({ advanceDays: Number(e.target.value) })}
                className={`mt-1.5 w-full ${field}`}
              >
                <option value={7}>A week</option>
                <option value={14}>Two weeks</option>
                <option value={30}>A month</option>
                <option value={60}>Two months</option>
                <option value={90}>Three months</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">
                Bookings per home, per day
              </span>
              <input
                type="number"
                min={1}
                max={12}
                value={rules.maxPerDay}
                onChange={(e) => set({ maxPerDay: Math.max(1, Number(e.target.value)) })}
                className={`mt-1.5 w-full ${field}`}
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Per week</span>
              <input
                type="number"
                min={1}
                max={50}
                value={rules.maxPerWeek}
                onChange={(e) => set({ maxPerWeek: Math.max(1, Number(e.target.value)) })}
                className={`mt-1.5 w-full ${field}`}
              />
            </label>
          </div>

          <label className="mt-4 flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={rules.needsApproval ?? false}
              onChange={(e) => set({ needsApproval: e.target.checked })}
              className="mt-0.5 size-4 rounded border-border-2"
            />
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-fg">
                The board approves each booking
              </span>
              <span className="block text-[13px] leading-snug text-fg-muted">
                Leave this off and a free slot is simply taken, which is what most spaces want.
                Turn it on for anything with a deposit or a key.
              </span>
            </span>
          </label>

          {/* What the resident will read, shown back to the board. */}
          <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-[13px] leading-relaxed text-fg-muted">
            <span className="font-semibold text-fg">Residents will see: </span>
            {describeRules({ ...amenity, rules: { ...amenity.rules } })}
          </p>

          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      ) : null}
    </div>
  );
}
