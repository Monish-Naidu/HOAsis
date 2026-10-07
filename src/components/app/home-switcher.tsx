"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { homesLine } from "@/lib/home-choice";
import { homeLabel } from "@/lib/wording";
import { cn, money } from "@/lib/utils";

/**
 * Picks which of their own homes a person is looking at.
 *
 * Wraps whatever the shell already shows for the home, so with one home it
 * renders that and nothing more: the control exists only for the owner of two
 * or three. The list is drawn in a portal, as the association switcher's is,
 * because the banner and the phone frame clip anything drawn inside them.
 */
export function HomeSwitcher({
  children,
  onPhoto,
  className,
}: {
  children: ReactNode;
  /** On the banner photo the hover tint and the chevron are white. */
  onPhoto?: boolean;
  className?: string;
}) {
  const { mySeats } = useAppState();
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  if (mySeats.length < 2) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={place !== null}
        aria-label="Switch home"
        onClick={(event) => {
          if (place) return setPlace(null);
          const box = event.currentTarget.getBoundingClientRect();
          // Kept inside the window on a phone, where the home line starts at
          // the left edge and the list is wider than what is left of the bar.
          const left = Math.max(8, Math.min(box.left, window.innerWidth - 296));
          setPlace({ left, top: box.bottom + 4 });
        }}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md text-left transition-colors",
          onPhoto ? "hover:bg-white/15" : "hover:bg-surface-2",
          className,
        )}
      >
        <span className="min-w-0 truncate">{children}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 opacity-70 transition-transform", place && "rotate-180")}
          aria-hidden
        />
      </button>
      {place ? <HomeList place={place} onClose={() => setPlace(null)} /> : null}
    </>
  );
}

function HomeList({ place, onClose }: { place: { left: number; top: number }; onClose: () => void }) {
  const { mySeats, account, community, chooseHome } = useAppState();
  return createPortal(
    <>
      <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <ul
        role="listbox"
        aria-label="Your homes"
        style={{ left: place.left, top: place.top }}
        className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-card border border-border bg-surface text-fg shadow-float"
      >
        {mySeats.map((seat) => {
          const home = community.homes.find((o) => o.id === seat.homeId);
          const label = homeLabel(community, seat.unit);
          const address = home?.address && home.address !== label ? home.address : "";
          const active = seat.homeId === account?.homeId;
          return (
            <li key={seat.homeId}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  chooseHome(seat.homeId);
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{label}</span>
                  {address ? (
                    <span className="block truncate text-footnote text-fg-subtle">{address}</span>
                  ) : null}
                </span>
                {home ? (
                  <span
                    className={cn(
                      "tnum shrink-0 text-footnote font-medium",
                      home.balanceCents > 0 ? "text-fg" : "text-fg-subtle",
                    )}
                  >
                    {money(home.balanceCents)}
                  </span>
                ) : null}
                {active ? <Check className="size-3.5 shrink-0 text-ok" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </>,
    document.body,
  );
}

/**
 * One quiet line above the balance card, only for an owner of several homes,
 * so the number below is never mistaken for the total of all of them.
 */
export function HomesNote() {
  const { mySeats, account, community } = useAppState();
  if (mySeats.length < 2 || !account) return null;
  return (
    <p className="text-footnote text-fg-muted">
      <HomeSwitcher className="-ml-1 px-1 py-0.5">
        {homesLine(mySeats.length, homeLabel(community, account.unit))}
      </HomeSwitcher>
    </p>
  );
}
