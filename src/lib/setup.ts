import type { Community } from "@/lib/data/community";
import type { AssociationOrigin, PreviousSetup } from "@/lib/data/new-community";
import type { Home } from "@/lib/types";
import { OPENING_LINE, billingStatus } from "@/lib/go-live";
import { BEFORE_THE_BANK, BUILDER_STEPS, HANDOVER_STEPS, type PortingStep } from "@/lib/porting";
import { duesVary, homesWithOwnDues, totalDues } from "@/lib/home-types";
import { todayIsoDate } from "@/lib/utils";

/**
 * What a board still has to do, as one list.
 *
 * Every task says why it exists. A checklist that only says "add a budget"
 * teaches nobody anything; one that says a budget has to go out thirty to
 * ninety days before the fiscal year ends is the difference between software
 * and a filing cabinet.
 *
 * Done is read off the records and never off a stored tick, with one honest
 * exception: a few things leave no record ("we have an EIN", "nobody owes
 * anything today"). For those the board saying so is the record, kept in the
 * same place a skipped task is kept, and `doneWhenDismissed` says which.
 *
 * Optional tasks can be dismissed. Plenty of associations genuinely have no
 * amenities, no vendors, and no reserve study, and a list that keeps asking
 * for things you do not have teaches people to ignore lists.
 */

/** What the association said about where it came from. */
export interface PlanFacts {
  origin?: AssociationOrigin;
  previously?: PreviousSetup;
}

export function factsOf(c: Community): PlanFacts {
  return { origin: c.profile?.origin, previously: c.profile?.previously };
}

/**
 * Whether the association had a life before it came here, and so has
 * balances owed on the day it switches: it already runs itself (whatever it
 * ran on, "nothing yet" included, because the owners may still owe) or it is
 * being turned over by a builder. A builder standing one up has no history.
 */
export function switching(f: PlanFacts): boolean {
  return f.origin === "existing" || f.origin === "handover";
}

/** Switching, and not brand new: there are records, such as a reserve study, to bring. */
export function hasRecords(f: PlanFacts): boolean {
  return f.origin === "handover" || (f.origin === "existing" && f.previously !== "fresh");
}

/**
 * Where this association lives, read from its records.
 *
 * A signed in association is loaded from the database, which always says
 * whether Stripe charges are enabled (true or false). A copy built in the
 * browser has a profile and no such flag. The two shipped demos have neither.
 * Approximate only in that a hand built community with a profile and a Stripe
 * flag reads as signed in, which is what a test wants.
 */
export type Where = "signed-in" | "browser-copy" | "demo";

export function whereIs(c: Community): Where {
  if (!c.profile) return "demo";
  return c.association.stripeChargesEnabled === undefined ? "browser-copy" : "signed-in";
}

export interface SetupTask {
  key: string;
  label: string;
  /** One line on the card. What this is. */
  detail: string;
  /** Shown when they open it. Why a board should care. */
  why: string;
  href: string;
  /** True when the data says it is done. Never a stored flag. */
  done: (c: Community, facts?: PlanFacts) => boolean;
  /** True when this cannot be done where the association lives (a browser copy cannot take money). */
  unavailable?: (c: Community) => boolean;
  /** Whether a board may declare this one not applicable. */
  optional?: boolean;
  /** What "we do not have this" means here, in their words. */
  dismissLabel?: string;
  /** For something that leaves no record: the board saying so counts as done. */
  doneWhenDismissed?: boolean;
}

/** An owner is listed: somebody is named, and it is not a stand-in for an empty home. */
export function hasOwner(o: Home): boolean {
  return !o.placeholder && o.members.length > 0;
}

/** Who is on the register, and who is missing. */
export function rosterStatus(c: Community, f: PlanFacts = factsOf(c)) {
  const homes = c.homes.length;
  const withoutOwner = c.homes.filter((o) => !hasOwner(o)).length;
  // A builder still selling expects unsold lots, so the homes existing is the
  // whole of it there. Everyone else has an owner for every home.
  const stillSelling = f.origin === "builder";
  return {
    homes,
    withoutOwner,
    stillSelling,
    done: homes > 1 && (stillSelling || withoutOwner === 0),
  };
}

/** Homes with an opening balance saved. A balance set to nothing leaves no line. */
export function openingBalanceCount(c: Community): number {
  return c.homes.filter((o) =>
    (c.homeCharges[o.id] ?? []).some((l) => OPENING_LINE.test(l.label)),
  ).length;
}

/** The first dues bill: when, and for how much per home. */
export function firstBill(c: Community) {
  const cents = c.association.duesCents;
  const issued = Object.values(c.homeCharges).some((lines) =>
    lines.some((l) => l.kind === "charge" && /dues/i.test(l.label) && !OPENING_LINE.test(l.label)),
  );
  return {
    date: c.nextChargeDate,
    cents,
    cadence: c.association.duesCadence,
    // Counts a home's own amount as well as a kind's.
    varies: duesVary(c.association, c.homes),
    ownCount: homesWithOwnDues(c.homes),
    totalCents: totalDues(c.association, c.homes),
    homes: c.homes.length,
    issued,
    done: cents > 0 && Boolean(c.nextChargeDate),
  };
}

/**
 * Who has been invited, from the records. The founder is left out of every
 * count: their own home has signed in by definition, and counting it made
 * "somebody got in" true before anybody was asked.
 */
export function inviteStatus(c: Community) {
  const founder = c.homes.find((o) => o.boardRole === "President");
  const others = c.homes.filter((o) => o.id !== founder?.id && hasOwner(o));
  const withEmail = others.filter((o) => o.email.trim());
  const sent = c.emailLog.filter((e) => e.category === "invite" && !e.error);
  const reached = withEmail.filter((o) => {
    const email = o.email.trim().toLowerCase();
    return (
      c.accounts.some((a) => a.homeId === o.id) ||
      sent.some((e) => e.to.trim().toLowerCase() === email || (e.unit && e.unit === o.unit))
    );
  });
  return {
    owners: others.length,
    withEmail: withEmail.length,
    noEmail: others.length - withEmail.length,
    reached: reached.length,
    waiting: withEmail.length - reached.length,
    done: withEmail.length > 0 && reached.length === withEmail.length,
  };
}

/**
 * A step that happens outside the product, so nothing records it: the board
 * saying it is done is the record, kept in the dismissal store.
 */
function paperwork(step: PortingStep, dismissLabel: string): SetupTask {
  return {
    key: step.key,
    label: step.title,
    detail: step.detail,
    why: step.because ?? step.detail,
    href: step.href ?? "",
    done: () => false,
    optional: true,
    doneWhenDismissed: true,
    dismissLabel,
  };
}

/** Keys of the situation steps, by the group they sit in. */
export const HANDOVER_KEYS = HANDOVER_STEPS.map((s) => s.key);
export const BUILDER_KEYS = BUILDER_STEPS.map((s) => s.key);

export const SETUP_TASKS: SetupTask[] = [
  /* ------------------------------------------- before you sign the handover */
  ...HANDOVER_STEPS.map((step) => paperwork(step, "Done")),

  /* ---------------------------------------------- before the bank will open */
  ...BEFORE_THE_BANK.map((step) =>
    paperwork(step, step.key === "ein" ? "We already have an EIN" : "It is registered"),
  ),
  ...BUILDER_STEPS.map((step) => paperwork(step, "Done")),

  /* ----------------------------------------------------------- get paid */
  {
    key: "roster",
    label: "Add every home and its owner",
    detail: "A list of who owns what.",
    why: "Everything else hangs off this. A home that is not listed has no balance, no vote, and no way to sign in, and an owner who is not listed cannot be invited. Associations are required to keep a membership register anyway, so this is a list your board already owes somebody.",
    href: "/board/homeowners",
    done: (c, f) => rosterStatus(c, f).done,
  },
  {
    key: "opening-balances",
    label: "Enter starting balances",
    detail: "What each home owed on the day you switched, as one figure.",
    why: "An association that already ran itself has balances on the day it switches, and nothing before that day has to come across. One figure per home makes the books correct from here. Set them before the first bill goes out: a bill sent against the wrong balance is the one that costs a board its credibility in week one.",
    href: "/board/homeowners/opening-balances",
    done: (c) => openingBalanceCount(c) > 0,
    optional: true,
    doneWhenDismissed: true,
    dismissLabel: "Nobody owes anything today",
  },
  {
    key: "payments",
    label: "Turn on online payments",
    detail: "Set up online payments so owners can pay dues from their phone.",
    why: "Owners cannot pay online until Stripe has verified the association and turned charges on. Stripe asks for the EIN letter, a bank account in the association's name and the treasurer's details. Until it says charges are enabled, nothing here claims that payments work.",
    href: "/board/settings#money",
    done: (c) => {
      const where = whereIs(c);
      // The shipped demos take payments by design; a browser copy never does.
      if (where === "demo") return true;
      return where === "signed-in" && Boolean(c.association.stripeChargesEnabled);
    },
    unavailable: (c) => whereIs(c) === "browser-copy",
  },
  {
    key: "first-bill",
    label: "Check the first bill",
    detail: "The date it goes out and what each home is billed.",
    why: "The first bill is the one owners remember. Check the date and the amount against what you told them, and against any balances owed from before. Dues and the due day are set in Settings.",
    href: "/board/settings#money",
    done: (c) => firstBill(c).done,
  },
  {
    key: "invites",
    label: "Invite the owners",
    detail: "An email for every owner, then an invitation, so they can see their balance and pay.",
    why: "An owner with no invitation cannot see a balance, be reminded about dues, or pay. It is also the gap that quietly makes your collection rate look worse than your neighbors are. Owners with no email on file are counted but do not hold this up.",
    href: "/board/homeowners",
    // The two shipped demos are long-running associations whose owners were
    // never "invited" in any record, and a demo that reads as mid-setup with
    // 82 owners waiting is showing the wrong thing. Like payments, it is
    // done there.
    done: (c) => whereIs(c) === "demo" || inviteStatus(c).done,
  },

  /* --------------------------------------------- records owners can ask for */
  {
    key: "documents",
    label: "Upload the governing documents",
    detail: "CC&Rs, bylaws, and the rules.",
    why: "Owners have a statutory right to these in most states, and a board that cannot produce them on request has a problem that gets expensive. Putting them here answers the question before anybody has to ask it.",
    href: "/board/documents",
    done: (c) => c.documents.length > 0,
  },
  {
    // Only while the Budget page is switched on (module `money-budget`).
    key: "budget",
    label: "Budget what you spend",
    detail: "What the dues have to cover.",
    why: "Dues income is already here. Adding the expenses turns it into a budget, which most states require you to distribute to owners between thirty and ninety days before the fiscal year ends. It is also the only way the dashboard can tell you whether spending is on pace.",
    href: "/board/money",
    done: (c) => c.budget.some((line) => line.kind === "expense"),
  },
  {
    key: "insurance",
    label: "Record your insurance",
    detail: "Carrier, policy number and renewal date, kept where the next board can find them.",
    why: "The annual budget report has to disclose your coverage in most states, and the renewal date is the one deadline nobody notices until it has passed. Recording it here keeps it where the next board can find it.",
    href: "/board/settings",
    done: (c) => Boolean(c.association.insuranceCarrier),
    optional: true,
    dismissLabel: "I will add this later",
  },
  {
    key: "reserves",
    label: "Get a reserve study",
    detail: "What wears out, when, and what it costs.",
    why: "Until one exists there is no honest way to say whether your reserves are enough, so we will not pretend to. Some states require one outright above a hundred units, and many CC&Rs require one on a schedule regardless of size.",
    href: "/board/reserves",
    done: (c) => c.reserveComponents.length > 0,
    optional: true,
    dismissLabel: "We do not have one yet",
  },
  {
    // Attached homes only. The single most common townhome and condominium
    // dispute is not a rule, it is who pays when a shared roof leaks, and it
    // is decided by a document most boards have never written down.
    key: "maintenance-matrix",
    label: "Write down who fixes what",
    detail: "Roof, siding, windows, decks, the line where the association stops.",
    why: "In attached housing almost every expensive argument is the same argument: an owner and a board each believing the other is responsible for a shared component. Your declaration usually answers it in language nobody reads. Writing it out once, as a plain list, is the cheapest dispute prevention there is.",
    href: "/board/documents",
    done: (c) => c.documents.some((d) => /maintenance|responsibilit/i.test(d.name)),
    optional: true,
    dismissLabel: "Our declaration is already clear",
  },
  {
    // Condominiums only. Several states added inspection duties after the
    // Surfside collapse, and the deadlines are real.
    key: "structural",
    label: "Check whether you owe a structural inspection",
    detail: "Several states now require one on a schedule, with a funded reserve behind it.",
    why: "After Surfside a number of states introduced milestone inspections and structural reserve requirements for condominium buildings, with hard deadlines and, in some, a bar on waiving the reserves that pay for the findings. The rules differ by state and by building age and height, so the first step is finding out whether yours is covered.",
    href: "/library",
    done: (c) => c.documents.some((d) => /structural|milestone|inspection/i.test(d.name)),
    optional: true,
    dismissLabel: "Checked, it does not apply to us",
  },

  /* ------------------------------------------------------------ the rest */
  {
    key: "board",
    label: "Appoint the rest of the board",
    detail: "Treasurer, secretary, vice president.",
    why: "Right now you are the only person who can do anything. Appointing officers spreads the work and means the association is not locked out if you are away. You choose exactly what each of them can reach.",
    href: "/board/settings",
    done: (c) => c.accounts.filter((a) => a.role !== "resident").length > 1,
    optional: true,
    dismissLabel: "I am the only board member",
  },
  {
    key: "vendors",
    label: "Add your vendors",
    detail: "Landscaper, pool service, insurance agent. Anyone the association pays.",
    why: "Paying a vendor more than six hundred dollars in a year means the IRS wants a W-9 from them and a 1099 in January. Recording them now means that paperwork is already gathered rather than chased in a panic.",
    href: "/board/vendors",
    done: (c) => c.vendors.length > 0,
    optional: true,
    dismissLabel: "We do not pay any vendors",
  },
  {
    key: "amenities",
    label: "List your amenities",
    detail: "Pool, clubhouse, courts.",
    why: "Anything reservable shows up in the resident request form, so owners can book it themselves instead of emailing the board. Plenty of associations have none, which is a perfectly good answer.",
    href: "/board/settings",
    done: (c) => c.amenities.length > 0,
    optional: true,
    dismissLabel: "We have no shared amenities",
  },
  {
    key: "photo",
    label: "Add a cover photograph",
    detail: "What owners see when they sign in.",
    why: "Small, and it is the difference between software that belongs to your association and software somebody bought. Any picture of the neighborhood does the job.",
    href: "/board/settings",
    done: (c) => Boolean(c.settings.photoUrl),
    optional: true,
    dismissLabel: "Not now",
  },
  {
    // What the go-live list checked that nothing else here covers. A real
    // association only: a browser copy has no trial and no subscription.
    key: "billing",
    label: "Add a card before the free days end",
    detail: "So the association keeps running after the trial.",
    why: "Your HOAsis is free for the first days and then billed per home. Adding a card now means nothing stops on the day the free days end.",
    href: "/board/settings#money",
    done: (c) => billingStatus(c, todayIsoDate()).done,
  },
];
