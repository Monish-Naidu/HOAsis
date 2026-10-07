import { Home as HomeIcon, Receipt, CreditCard, Banknote } from "lucide-react";
import type { Community } from "@/lib/data/community";
import type { Capability, Home } from "@/lib/types";
import { BOARD_ROUTES, routeOffered } from "@/lib/board-routes";
import { money } from "@/lib/utils";
import { homeLabel } from "@/lib/wording";
import { KIND_LABEL, TINT, type SearchHit } from "./records";

/**
 * Shortcuts the query itself suggests.
 *
 * A dollar amount typed into search is usually a payment somebody wants to
 * record or find; a unit number is a home somebody wants to open. These rows
 * are built from the query rather than found in the index, so they sit above
 * the results and disappear the moment the query stops looking like one.
 * Every link here is a route that exists, with a parameter the page reads.
 */

const AMOUNT = /^\$?\s*(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/;
const UNIT = /^(?:unit|lot|home|#)?\s*(\d{1,5}[a-z]?)$/i;
const BARE_NUMBER = /^\d+$/;

/** Cents, when the whole query is a dollar amount; null otherwise. */
export function amountInQuery(query: string): number | null {
  const m = AMOUNT.exec(query.trim());
  if (!m) return null;
  const cents = Math.round(Number(`${m[1].replace(/,/g, "")}${m[3] ?? ""}`) * 100);
  return cents > 0 ? cents : null;
}

/** The unit as typed, when the whole query reads like a unit number. */
export function unitInQuery(query: string): string | null {
  const m = UNIT.exec(query.trim());
  return m ? m[1].toLowerCase() : null;
}

function shortcut(id: string, title: string, subtitle: string, href: string, icon: SearchHit["icon"]): SearchHit {
  return {
    id,
    kind: "shortcut",
    section: KIND_LABEL.shortcut,
    title,
    subtitle,
    href,
    date: "",
    keywords: "",
    tint: TINT.shortcut,
    icon,
  };
}

const offered = (key: string, community: Community, can: (c: Capability) => boolean) => {
  const route = BOARD_ROUTES.find((r) => r.key === key);
  return route ? routeOffered(route, can, community) : false;
};

/** Shortcuts for a board seat. */
export function boardShortcuts(query: string, community: Community, can: (c: Capability) => boolean): SearchHit[] {
  const out: SearchHit[] = [];
  const unit = unitInQuery(query);
  const homes =
    unit !== null && offered("homeowners", community, can)
      ? community.homes.filter((o) => o.unit.trim().toLowerCase() === unit)
      : [];
  // "55" alone is a unit before it is fifty-five dollars. Typing "$55" or
  // "55.00" says money.
  const cents = homes.length > 0 && BARE_NUMBER.test(query.trim()) ? null : amountInQuery(query);
  if (cents !== null) {
    const typed = (cents / 100).toFixed(2);
    if (offered("vendors", community, can)) {
      out.push(
        shortcut(
          "act-record",
          `Record a payment of ${money(cents)}`,
          "Vendors · a bill you paid, from here or your own bank",
          `/board/vendors?record=1&amount=${typed}`,
          Receipt,
        ),
      );
    }
    if (offered("money-transactions", community, can)) {
      out.push(
        shortcut(
          "act-find-tx",
          `Find transactions for ${money(cents)}`,
          "Finances · Transactions, this year",
          `/board/money/transactions?q=${typed}&from=${community.asOf.slice(0, 4)}-01-01&to=${community.asOf.slice(0, 4)}-12-31`,
          Banknote,
        ),
      );
    }
  }
  {
    for (const o of homes.slice(0, 3)) {
      out.push(
        shortcut(
          `act-open-${o.id}`,
          `Open ${homeLabel(community, o.unit)}`,
          `${o.displayName}${o.address ? ` · ${o.address}` : ""}`,
          `/board/homeowners?open=${encodeURIComponent(o.id)}`,
          HomeIcon,
        ),
      );
    }
  }
  return out;
}

/** Shortcuts for an owner: their own money, never anybody else's home. */
export function residentShortcuts(query: string, community: Community, home: Home | null): SearchHit[] {
  const out: SearchHit[] = [];
  const unit = unitInQuery(query);
  const myHome = unit !== null && home !== null && home.unit.trim().toLowerCase() === unit;
  const cents = myHome && BARE_NUMBER.test(query.trim()) ? null : amountInQuery(query);
  if (cents !== null) {
    out.push(
      shortcut(
        "act-pay",
        `Pay ${money(cents)}`,
        home && home.balanceCents > 0 ? `Payments · you owe ${money(home.balanceCents)}` : "Payments",
        "/resident/pay",
        CreditCard,
      ),
    );
  }
  if (myHome && home) {
    out.push(
      shortcut(
        "act-my-home",
        `Open ${homeLabel(community, home.unit)}`,
        "Account · your balance and history",
        "/resident/account",
        HomeIcon,
      ),
    );
  }
  return out;
}
