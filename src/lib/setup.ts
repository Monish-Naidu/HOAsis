import type { Community } from "@/lib/data/community";

/**
 * What a board still has to do, and how much of it actually matters.
 *
 * Three tiers, drawn from what the law and a competent board actually require
 * rather than from what we happen to have screens for.
 *
 *   essential    an association cannot take a dollar without these
 *   recommended  what members are entitled to ask for, and what a board is
 *                usually required to produce once a year
 *   complete     the rest of a well run association
 *
 * Every task says why it exists. A checklist that only says "add a budget"
 * teaches nobody anything; one that says a budget has to go out thirty to
 * ninety days before the fiscal year ends is the difference between software
 * and a filing cabinet.
 *
 * Optional tasks can be dismissed. Plenty of associations genuinely have no
 * amenities, no vendors, and no reserve study, and a list that keeps asking
 * for things you do not have teaches people to ignore lists.
 */

export type Tier = "essential" | "recommended" | "complete";

export interface SetupTask {
  key: string;
  tier: Tier;
  label: string;
  /** One line on the card. What this is. */
  detail: string;
  /** Shown when they open it. Why a board should care. */
  why: string;
  href: string;
  /** True when the data says it is done. Never a stored flag. */
  done: (c: Community) => boolean;
  /** Whether a board may declare this one not applicable. */
  optional?: boolean;
  /** What "we do not have this" means here, in their words. */
  dismissLabel?: string;
}

export const SETUP_TASKS: SetupTask[] = [
  /* ------------------------------------------------------------ essential */
  {
    key: "roster",
    tier: "essential",
    label: "Add every home",
    detail: "The register of who owns what.",
    why: "Everything else hangs off this. A home that is not on the register has no balance, no vote, and no way to sign in. Associations are required to keep a membership register anyway, so this is a list your board already owes somebody.",
    href: "/board/homeowners",
    done: (c) => c.owners.length > 1,
  },
  {
    key: "bank",
    tier: "essential",
    label: "Connect the operating account",
    detail: "Where dues land.",
    why: "Dues have nowhere to go until this exists. It has to be an account in the association's name and EIN. Most states prohibit collecting into a board member's personal account, and every insurer and auditor will ask.",
    href: "/board/money",
    done: (c) => c.bankAccounts.some((a) => a.kind === "operating"),
  },
  {
    key: "invites",
    tier: "essential",
    label: "Invite your neighbors",
    detail: "An email address for every household that has one.",
    why: "A household with no address cannot be sent a notice, cannot be reminded about dues, and cannot reach their own balance. It is also the one gap that quietly makes your collection rate look worse than your neighbors are.",
    href: "/board/homeowners",
    /**
     * Counted against households, not against homes.
     *
     * In a community still being built most lots are unsold and held by the
     * builder, and that is the ordinary state rather than a gap in the setup.
     * Asking for an email on a lot nobody has bought is a task that cannot be
     * finished, and a plan containing one of those is a plan people stop
     * trusting. A lot gets counted the moment somebody moves into it.
     */
    done: (c) =>
      c.owners
        .filter((o) => o.members.length > 0)
        .every((o) => o.email.trim().length > 0),
  },

  /* ---------------------------------------------------------- recommended */
  {
    key: "documents",
    tier: "recommended",
    label: "Upload the governing documents",
    detail: "CC&Rs, bylaws, and the rules.",
    why: "Owners have a statutory right to these in most states, and a board that cannot produce them on request has a problem that gets expensive. Putting them here answers the question before anybody has to ask it.",
    href: "/board/documents",
    done: (c) => c.documents.length > 0,
  },
  {
    key: "budget",
    tier: "recommended",
    label: "Budget what you spend",
    detail: "What the assessments have to cover.",
    why: "Assessment income is already here. Adding the expenses turns it into a budget, which most states require you to distribute to owners between thirty and ninety days before the fiscal year ends. It is also the only way the dashboard can tell you whether spending is on pace.",
    href: "/board/money",
    done: (c) => c.budget.some((line) => line.kind === "expense"),
  },
  {
    key: "board",
    tier: "recommended",
    label: "Appoint the rest of the board",
    detail: "Treasurer, secretary, vice president.",
    why: "Right now you are the only person who can do anything. Appointing officers spreads the work and means the association is not locked out if you are away. You choose exactly what each of them can reach.",
    href: "/board/settings",
    done: (c) => c.accounts.filter((a) => a.role !== "resident").length > 1,
    optional: true,
    dismissLabel: "I am the only officer",
  },
  {
    key: "insurance",
    tier: "recommended",
    label: "Record your insurance",
    detail: "Carrier, policy number, renewal date.",
    why: "The annual budget report has to disclose your coverage in most states, and the renewal date is the one deadline nobody notices until it has passed. Recording it here means you get told before it lapses.",
    href: "/board/settings",
    done: (c) => Boolean(c.association.insuranceCarrier),
    optional: true,
    dismissLabel: "I will add this later",
  },

  /* ------------------------------------------------------------- complete */
  {
    key: "reserves",
    tier: "complete",
    label: "Commission a reserve study",
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
    tier: "recommended",
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
    tier: "recommended",
    label: "Check whether you owe a structural inspection",
    detail: "Several states now require one on a schedule, with a funded reserve behind it.",
    why: "After Surfside a number of states introduced milestone inspections and structural reserve requirements for condominium buildings, with hard deadlines and, in some, a bar on waiving the reserves that pay for the findings. The rules differ by state and by building age and height, so the first step is finding out whether yours is covered.",
    href: "/library",
    done: (c) => c.documents.some((d) => /structural|milestone|inspection/i.test(d.name)),
    optional: true,
    dismissLabel: "Checked, it does not apply to us",
  },
  {
    key: "vendors",
    tier: "complete",
    label: "Add your vendors",
    detail: "Landscaper, pool service, anyone you pay.",
    why: "Paying a vendor more than six hundred dollars in a year means the IRS wants a W-9 from them and a 1099 in January. Recording them now means that paperwork is already gathered rather than chased in a panic.",
    href: "/board/vendors",
    done: (c) => c.vendors.length > 0,
    optional: true,
    dismissLabel: "We do not pay any vendors",
  },
  {
    key: "amenities",
    tier: "complete",
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
    tier: "complete",
    label: "Add a cover photograph",
    detail: "What owners see when they sign in.",
    why: "Small, and it is the difference between software that belongs to your association and software somebody bought. Any picture of the neighborhood does the job.",
    href: "/board/settings",
    done: (c) => Boolean(c.settings.photoUrl),
    optional: true,
    dismissLabel: "Not now",
  },
];

export const TIER_LABEL: Record<Tier, string> = {
  essential: "Start collecting",
  recommended: "Run it properly",
  complete: "The full picture",
};

export const TIER_BLURB: Record<Tier, string> = {
  essential: "The least an association needs before it can take a payment.",
  recommended: "What owners can ask for, and what most states expect once a year.",
  complete: "Everything else. Skip whatever you do not have.",
};

export interface TaskState extends SetupTask {
  complete: boolean;
  dismissed: boolean;
}

export interface SetupProgress {
  tasks: TaskState[];
  /** Counted out of what is left after dismissals, so skipping does not punish. */
  done: number;
  total: number;
  percent: number;
  essentialsRemaining: number;
  /** True when nothing required is outstanding, so dues can actually be taken. */
  canCollect: boolean;
  allDone: boolean;
}

export function setupProgress(
  community: Community,
  dismissedKeys: Set<string>,
): SetupProgress {
  const tasks: TaskState[] = SETUP_TASKS.map((task) => ({
    ...task,
    complete: task.done(community),
    // A required task cannot be waved away, whatever is in the table.
    dismissed: Boolean(task.optional) && dismissedKeys.has(task.key),
  }));

  const counted = tasks.filter((t) => !t.dismissed);
  const done = counted.filter((t) => t.complete).length;
  const essentialsRemaining = tasks.filter(
    (t) => t.tier === "essential" && !t.complete,
  ).length;

  return {
    tasks,
    done,
    total: counted.length,
    percent: counted.length ? done / counted.length : 1,
    essentialsRemaining,
    canCollect: essentialsRemaining === 0,
    allDone: done === counted.length,
  };
}
