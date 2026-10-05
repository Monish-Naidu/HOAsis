import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlan, profileFromCommunity, profileFromDraft, setupCounts } from "@/lib/setup-plan";
import { portingPlan } from "@/lib/porting";
import { mehrMeadows } from "@/lib/data/communities";
import { buildCommunity, emptyDraft, type CommunityDraft } from "@/lib/data/new-community";
import { MODULES } from "@/lib/modules";
import type { Community } from "@/lib/data/community";
import type { AssociationProfile } from "@/lib/setup-plan";

const base: AssociationProfile = {
  propertyType: "single-family",
  origin: "builder",
  collects: [],
  sharedSpaces: [],
  homes: 40,
  stateName: "Washington",
};

const keys = (profile: Partial<AssociationProfile>) =>
  buildPlan(mehrMeadows, { ...base, ...profile }).phases.flatMap((p) =>
    p.tasks.map((t) => t.key),
  );

describe("the plan is built from the answers", () => {
  it("asks a condominium about the building it owns", () => {
    const condo = keys({ propertyType: "condos" });
    expect(condo).toContain("structural");
    expect(condo).toContain("maintenance-matrix");
  });

  it("asks townhomes who fixes a shared roof, but not about milestone inspections", () => {
    const town = keys({ propertyType: "townhomes" });
    expect(town).toContain("maintenance-matrix");
    // A townhome association does not own a building the way a condo does.
    expect(town).not.toContain("structural");
  });

  it("asks detached homes about neither", () => {
    const detached = keys({ propertyType: "single-family" });
    expect(detached).not.toContain("maintenance-matrix");
    expect(detached).not.toContain("structural");
  });

  it("never asks a builder about vendors it has not hired yet", () => {
    // Whoever cuts the grass on a site still being built is on the
    // construction contract, not on the association's.
    expect(keys({ origin: "builder" })).not.toContain("vendors");
    // A board taking over inherits vendors it did not choose, some of them
    // under contracts held in the builder's own name.
    expect(keys({ origin: "handover" })).toContain("vendors");
  });

  it("only offers amenities when the board said they have some", () => {
    expect(keys({ sharedSpaces: [] })).not.toContain("amenities");
    expect(keys({ sharedSpaces: ["pool"] })).toContain("amenities");
  });

  it("does not ask a four home association to appoint a board", () => {
    expect(keys({ homes: 3 })).not.toContain("board");
    expect(keys({ homes: 40 })).toContain("board");
  });

  it("orders phases so getting paid comes first", () => {
    const plan = buildPlan(mehrMeadows, base);
    // A builder's paperwork comes before the bank, and the bank before money.
    expect(plan.phases.map((p) => p.id).slice(0, 2)).toEqual(["before-bank", "collect"]);
    const collect = plan.phases.find((p) => p.id === "collect")!;
    expect(collect.title).toBe("Get paid");
    // The milestone is announced rather than inferred from a fraction.
    expect(collect.outcome).toBe("Finish these and owners can pay online.");
  });

  it("counts what it left out, which is the argument for asking", () => {
    const plan = buildPlan(mehrMeadows, base);
    expect(plan.skipped).toBeGreaterThan(0);
    expect(plan.total + plan.skipped).toBeGreaterThanOrEqual(plan.total);
  });

  it("falls back to showing everything for an association with no answers", () => {
    // The shipped demos predate the questions. An association we know nothing
    // about should be shown everything, which is the old behaviour.
    const profile = profileFromCommunity(mehrMeadows);
    expect(profile.collects).toEqual([]);
    expect(buildPlan(mehrMeadows, profile).total).toBeGreaterThan(0);
  });

  it("reads a draft's answers straight through", () => {
    const draft = {
      ...emptyDraft(),
      propertyType: "condos" as const,
      origin: "handover" as const,
      collects: ["utilities" as const],
      sharedSpaces: ["pool" as const],
      stateName: "Florida",
      households: [{ name: "A", email: "a@example.com", unit: "2" }],
    };
    const profile = profileFromDraft(draft);
    expect(profile.propertyType).toBe("condos");
    expect(profile.stateName).toBe("Florida");
    // The founder counts as a home too.
    expect(profile.homes).toBe(2);
  });
});

describe("the situation card is not a second list", () => {
  it("gives each situation a different title, not a reworded list", () => {
    const titles = (["builder", "handover", "existing"] as const).map(
      (o) => portingPlan(o)!.title,
    );
    expect(new Set(titles).size, "two situations got the same plan").toBe(3);
  });

  it("gives a newly formed association the bank paperwork, and only a builder the rest", () => {
    const fresh = portingPlan("existing", "fresh")!;
    expect(fresh.steps.map((s) => s.key)).toEqual(["ein", "register"]);
    expect(fresh.steps[0].title).toBe("Get an EIN");
    expect(fresh.steps[1].title).toBe("Register the association and name a registered agent");
    expect(portingPlan("builder")!.steps.map((s) => s.title)).toEqual([
      "Get an EIN",
      "Register the association and name a registered agent",
      "Decide what the unsold lots pay, and write it down",
      "Fund reserves from the first dues bill",
    ]);
    expect(portingPlan("existing", "platform")!.steps).toEqual([]);
    expect(portingPlan("existing", "manager")!.steps).toEqual([]);
  });

  it("gives a board taking over its six steps, in order, with the original wording", () => {
    const steps = portingPlan("handover")!.steps;
    expect(steps.map((s) => s.title)).toEqual([
      "Get an independent turnover study, before you sign a release",
      "Check what the reserve account actually holds",
      "Ask what the builder paid on the lots it owned",
      "Write down when the construction warranties end",
      "Take the records in a form you can use",
      "Seat your own board and remove the builder's signers",
    ]);
    expect(steps[0].because).toContain("without knowing what it gives up");
    expect(steps[1].detail).toContain("deposit history");
    expect(steps.map((s) => `${s.detail} ${s.because}`).join(" ")).not.toContain("\u2014");
  });

  it("introduces a situation only when the paragraph says something the list does not", () => {
    expect(portingPlan("builder")!.introduces).toBe(true);
    expect(portingPlan("handover")!.introduces).toBe(true);
    expect(portingPlan("existing", "manager")!.introduces).toBe(true);
    // The opening balances item already says it.
    expect(portingPlan("existing", "platform")!.introduces).toBe(false);
  });

  it("never tells anyone to import or migrate records", () => {
    for (const [origin, previously] of [
      ["builder"],
      ["handover"],
      ["existing", "platform"],
      ["existing", "manager"],
      ["existing", "fresh"],
    ] as const) {
      const plan = portingPlan(origin, previously)!;
      const words = [plan.lede, ...plan.steps.map((s) => `${s.title} ${s.detail}`)].join(" ").toLowerCase();
      expect(words, `${origin} mentions a migration`).not.toMatch(
        /spreadsheet|csv|import|management company/,
      );
    }
  });
});

/* ------------------------------------------------------------------------ */
/* The one list: its done rules                                              */
/* ------------------------------------------------------------------------ */

const TODAY = "2026-10-04";

function draft(patch: Partial<CommunityDraft> = {}): CommunityDraft {
  return {
    ...emptyDraft(),
    name: "Alder Creek",
    city: "Bothell",
    state: "WA",
    stateName: "Washington",
    duesCents: 25000,
    duesCadence: "monthly",
    dueDay: 1,
    propertyType: "single-family",
    origin: "existing",
    previously: "platform",
    founder: { name: "Pat Founder", email: "pat@example.com", unit: "1" },
    households: [
      { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
      { name: "Dana Ortiz", email: "dana@example.com", unit: "3" },
      { name: "Lee Park", email: "", unit: "4" },
    ],
    ...patch,
  };
}

/** A signed in association: a profile, a Stripe flag, and only the founder seated. */
function signedIn(patch: (c: Community) => void = () => {}, d: Partial<CommunityDraft> = {}): Community {
  const c = buildCommunity(draft(d), TODAY);
  c.association.stripeChargesEnabled = false;
  c.accounts = c.accounts.filter((a) => a.role !== "resident");
  patch(c);
  return c;
}

const planOf = (c: Community, dismissed: string[] = []) =>
  buildPlan(c, profileFromCommunity(c), new Set(dismissed));
const taskOf = (c: Community, key: string, dismissed: string[] = []) =>
  planOf(c, dismissed).phases.flatMap((p) => p.tasks).find((t) => t.key === key);
const OPENING = {
  id: "o1",
  date: "2026-10-01",
  label: "Balance brought forward",
  kind: "charge" as const,
  amountCents: 12000,
  balanceAfterCents: 12000,
};

describe("the one list, in order", () => {
  it("has Get paid in the order a board can do it", () => {
    const plan = planOf(signedIn());
    const collect = plan.phases.find((p) => p.id === "collect")!;
    expect(collect.tasks.map((t) => t.key)).toEqual([
      "roster",
      "opening-balances",
      "payments",
      "first-bill",
      "invites",
    ]);
    expect(collect.tasks.map((t) => t.label)).toEqual([
      "Add every home and its owner",
      "Enter what each home owes today",
      "Turn on online payments",
      "Check the first bill",
      "Invite the owners",
    ]);
  });

  it("calls the records group by what it is, and the old heading is gone", () => {
    const titles = planOf(signedIn()).phases.map((p) => p.title);
    expect(titles).toContain("Records owners can ask for");
    expect(titles).toContain("The rest");
    expect(titles).not.toContain("What you owe owners");
    expect(titles).not.toContain("Start collecting");
  });
});

describe("add every home and its owner", () => {
  it("is not done while homes have no owner, and says how many", () => {
    const t = taskOf(
      signedIn((x) => {
        // Home 4 has nobody listed.
        x.owners[3] = { ...x.owners[3], members: [], placeholder: true };
      }),
      "roster",
    )!;
    expect(t.complete).toBe(false);
    expect(t.because).toBe("1 of 4 homes has no owner listed.");
  });

  it("is done once every home has an owner", () => {
    const c = signedIn(undefined, {
      households: [
        { name: "Marcus Bell", email: "marcus@example.com", unit: "2" },
        { name: "Lee Park", email: "", unit: "3" },
      ],
    });
    expect(taskOf(c, "roster")!.complete).toBe(true);
  });

  it("names the count the way a roster of twelve reads", () => {
    const households = Array.from({ length: 11 }, (_, i) => ({ name: "", email: "", unit: String(i + 2) }));
    const t = taskOf(signedIn(undefined, { households }), "roster")!;
    expect(t.because).toBe("11 of 12 homes have no owner listed.");
  });

  it("is done for a builder still selling, where unsold lots are expected", () => {
    const c = signedIn(undefined, { origin: "builder", previously: undefined });
    expect(taskOf(c, "roster")!.complete).toBe(true);
    // But the founder alone is not a register.
    const alone = signedIn((x) => { x.owners = x.owners.slice(0, 1); }, { origin: "builder", previously: undefined });
    expect(taskOf(alone, "roster")!.complete).toBe(false);
  });
});

describe("enter what each home owes today", () => {
  it("is shown only for an association that already existed", () => {
    const has = (d: Partial<CommunityDraft>) => Boolean(taskOf(signedIn(undefined, d), "opening-balances"));
    expect(has({ origin: "existing", previously: "platform" })).toBe(true);
    expect(has({ origin: "existing", previously: "manager" })).toBe(true);
    expect(has({ origin: "existing", previously: "fresh" })).toBe(true);
    expect(has({ origin: "handover", previously: undefined })).toBe(true);
    expect(has({ origin: "builder", previously: undefined })).toBe(false);
  });

  it("links to the opening balances screen", () => {
    expect(taskOf(signedIn(), "opening-balances")!.href).toBe("/board/homeowners/opening-balances");
  });

  it("is done when one opening balance is saved", () => {
    expect(taskOf(signedIn(), "opening-balances")!.complete).toBe(false);
    const c = signedIn((x) => { x.ownerCharges[x.owners[1].id] = [OPENING]; });
    expect(taskOf(c, "opening-balances")!.complete).toBe(true);
    expect(taskOf(c, "opening-balances")!.because).toBe("1 home with an opening balance saved.");
  });

  it("is done when the board says nobody owes anything, and stays in the list", () => {
    const t = taskOf(signedIn(), "opening-balances", ["opening-balances"])!;
    expect(t.complete).toBe(true);
    expect(t.because).toBe("You said nobody owes anything today.");
  });
});

describe("turn on online payments", () => {
  it("is done only when Stripe charges are enabled", () => {
    expect(taskOf(signedIn(), "payments")!.complete).toBe(false);
    const started = signedIn((x) => { x.association.stripeAccountId = "acct_1"; });
    expect(taskOf(started, "payments")!.complete).toBe(false);
    expect(taskOf(started, "payments")!.because).toMatch(/Started, not finished/);
    const live = signedIn((x) => {
      x.association.stripeAccountId = "acct_1";
      x.association.stripeChargesEnabled = true;
    });
    expect(taskOf(live, "payments")!.complete).toBe(true);
    expect(taskOf(live, "payments")!.href).toBe("/board/settings#money");
  });

  it("the headline says payments work only when that step is done", () => {
    const without = planOf(signedIn());
    expect(without.canTakePayments).toBe(false);
    expect(without.payments.headline).not.toMatch(/You can take payments/);
    expect(without.payments.headline).toMatch(/steps? left before owners can pay online/);
    // Homes, owners, invites and the rest being done does not change it.
    const everythingButStripe = signedIn((x) => {
      x.ownerCharges[x.owners[1].id] = [OPENING];
      x.emailLog = [{ id: "e", to: "marcus@example.com", category: "invite", subject: "x", sentAt: "2026-10-01T10:00:00Z" },
        { id: "f", to: "dana@example.com", category: "invite", subject: "x", sentAt: "2026-10-01T10:00:00Z" }];
      x.owners[3].placeholder = false;
      x.owners[3].members = ["Lee Park"];
    });
    expect(planOf(everythingButStripe).canTakePayments).toBe(false);
    expect(planOf(everythingButStripe).payments.stepsLeft).toBe(1);

    const withStripe = signedIn((x) => { x.association.stripeChargesEnabled = true; });
    expect(planOf(withStripe).canTakePayments).toBe(true);
    expect(planOf(withStripe).payments.headline).toBe("You can take payments");
  });

  it("is never done in a copy built in the browser, and says why", () => {
    const copy = buildCommunity(draft(), TODAY);
    const t = taskOf(copy, "payments")!;
    expect(t.unavailable).toBe(true);
    expect(t.complete).toBe(false);
    expect(t.because).toBe(
      "A copy in this browser cannot take payments. Set it up for real to turn them on.",
    );
    const plan = planOf(copy);
    expect(plan.canTakePayments).toBe(false);
    expect(plan.payments.sentence).toBe("A copy in this browser cannot take payments.");
  });

  it("does not count the unavailable step, so a copy can reach the end of what it can do", () => {
    const copy = buildCommunity(draft(), TODAY);
    const plan = planOf(copy);
    expect(plan.phases.flatMap((p) => p.tasks).some((t) => t.key === "payments")).toBe(true);
    const counted = plan.phases.flatMap((p) => p.tasks).filter((t) => !t.unavailable).length;
    expect(plan.total).toBe(counted);
  });

  it("stays done in the shipped demos, which take payments by design", () => {
    expect(taskOf(mehrMeadows, "payments")!.complete).toBe(true);
    expect(planOf(mehrMeadows).canTakePayments).toBe(true);
  });
});

describe("check the first bill", () => {
  it("shows the date and the amount per home, and is ticked after the wizard", () => {
    const c = signedIn();
    const t = taskOf(c, "first-bill")!;
    expect(t.complete).toBe(true);
    expect(t.because).toMatch(/^First bill .*2026.*\$250\.00 per home, billed monthly\.$/);
  });

  it("says each home pays what it pays, with the total, when some homes have their own amount", () => {
    const c = signedIn((x) => {
      x.owners = x.owners.map((o, i) => (i === 1 ? { ...o, duesCents: 31_000 } : o));
    });
    const t = taskOf(c, "first-bill")!;
    const total = c.owners.length * 25_000 + 6_000;
    expect(t.because).toContain(`$${(total / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} across ${c.owners.length} homes, each at what it pays`);
    expect(t.because).not.toContain("per home, billed");
  });

  it("is not done with no dues set", () => {
    const c = signedIn((x) => { x.association.duesCents = 0; });
    expect(taskOf(c, "first-bill")!.complete).toBe(false);
  });
});

describe("invite the owners", () => {
  it("is not done with no owners named, and says to add them first", () => {
    const c = signedIn((x) => { x.owners = x.owners.slice(0, 1); });
    const t = taskOf(c, "invites")!;
    expect(t.complete).toBe(false);
    expect(t.because).toMatch(/Add every home's owner first/);
  });

  it("is not done when nobody was invited, even though owners have emails", () => {
    const t = taskOf(signedIn(), "invites")!;
    expect(t.complete).toBe(false);
    expect(t.because).toMatch(/2 owners with an email have not been invited/);
  });

  it("needs every owner with an email invited or signed in, and counts the ones with none", () => {
    const one = signedIn((x) => {
      x.emailLog = [{ id: "e", to: "marcus@example.com", category: "invite", subject: "x", sentAt: "2026-10-01T10:00:00Z" }];
    });
    expect(taskOf(one, "invites")!.complete).toBe(false);

    const both = signedIn((x) => {
      x.emailLog = [{ id: "e", to: "marcus@example.com", category: "invite", subject: "x", sentAt: "2026-10-01T10:00:00Z" }];
      // Dana signed in on her own.
      x.accounts = [...x.accounts, { ...x.accounts[0], id: "a-dana", ownerId: x.owners[2].id, role: "resident" }];
    });
    const t = taskOf(both, "invites")!;
    expect(t.complete).toBe(true);
    // Lee has an owner and no email: counted, and does not block.
    expect(t.because).toMatch(/1 owner has no email on file/);
  });

  it("ignores an invitation that failed to send", () => {
    const c = signedIn((x) => {
      x.emailLog = [
        { id: "e", to: "marcus@example.com", category: "invite", subject: "x", sentAt: "2026-10-01T10:00:00Z", error: "bounced" },
        { id: "f", to: "dana@example.com", category: "invite", subject: "x", sentAt: "2026-10-01T10:00:00Z", error: "bounced" },
      ];
    });
    expect(taskOf(c, "invites")!.complete).toBe(false);
  });

  it("does not count the founder's own sign in as somebody being reached", () => {
    const c = signedIn((x) => { x.owners = x.owners.map((o, i) => (i === 0 ? o : { ...o, email: "" })); });
    expect(taskOf(c, "invites")!.complete).toBe(false);
  });
});

describe("records owners can ask for", () => {
  it("hides Budget what you spend while the Budget page is off, and brings it back", () => {
    expect(MODULES["money-budget"].on).toBe(false);
    const keys = planOf(signedIn()).phases.flatMap((p) => p.tasks.map((t) => t.key));
    expect(keys).not.toContain("budget");
    MODULES["money-budget"].on = true;
    try {
      const back = planOf(signedIn()).phases.flatMap((p) => p.tasks.map((t) => t.key));
      expect(back).toContain("budget");
    } finally {
      MODULES["money-budget"].on = false;
    }
  });

  it("promises nothing the product does not do about insurance", () => {
    const t = taskOf(signedIn(), "insurance")!;
    expect(t.detail).toBe("Carrier, policy number and renewal date, kept where the next board can find them.");
    expect(`${t.detail} ${t.why}`).not.toMatch(/told before it lapses/);
  });

  it("asks an association that kept records to enter its study, and a new one to get one", () => {
    expect(taskOf(signedIn(), "reserves")!.label).toBe("Enter your reserve study");
    expect(taskOf(signedIn(undefined, { origin: "handover", previously: undefined }), "reserves")!.label).toBe(
      "Enter your reserve study",
    );
    expect(taskOf(signedIn(undefined, { origin: "builder", previously: undefined }), "reserves")!.label).toBe(
      "Get a reserve study",
    );
    expect(taskOf(signedIn(undefined, { origin: "existing", previously: "fresh" }), "reserves")!.label).toBe(
      "Get a reserve study",
    );
  });

  it("says nothing about the Budget page anywhere in the plan while it is off", () => {
    const text = planOf(signedIn())
      .phases.flatMap((p) => p.tasks)
      .map((t) => `${t.label} ${t.detail} ${t.because ?? ""}`)
      .join(" ");
    // The reasons mention "the annual budget report", which is a state's rule
    // and not a page; what a board reads on a row never sends it to the page.
    expect(text).not.toMatch(/budget/i);
  });
});

describe("before the bank will open an account", () => {
  it("is for a newly formed association only, ahead of Get paid", () => {
    const builder = planOf(signedIn(undefined, { origin: "builder", previously: undefined }));
    expect(builder.phases[0].title).toBe("Before the bank will open an account");
    expect(builder.phases[0].tasks.map((t) => t.label).slice(0, 2)).toEqual([
      "Get an EIN",
      "Register the association and name a registered agent",
    ]);
    const running = planOf(signedIn());
    expect(running.phases.map((p) => p.id)).not.toContain("before-bank");
  });

  it("counts the board saying it is done, because nothing records an EIN", () => {
    const c = signedIn(undefined, { origin: "builder", previously: undefined });
    expect(taskOf(c, "ein")!.complete).toBe(false);
    expect(taskOf(c, "ein", ["ein"])!.complete).toBe(true);
    expect(taskOf(c, "register", ["ein"])!.complete).toBe(false);
  });
});

describe("the rest, and what the go-live list held", () => {
  it("asks a real association for a card before the free days end, and a copy never", () => {
    const real = signedIn((x) => {
      x.association.trialEndsOn = "2026-12-20";
      x.association.subscriptionStatus = "trialing";
    });
    expect(taskOf(real, "billing")!.complete).toBe(false);
    expect(taskOf(real, "billing")!.because).toMatch(/Free until/);
    const carded = signedIn((x) => {
      x.association.billing = { subscriptionId: "sub_1", brand: "Visa", last4: "4242" };
    });
    expect(taskOf(carded, "billing")!.complete).toBe(true);
    expect(taskOf(buildCommunity(draft(), TODAY), "billing")).toBeUndefined();
    expect(taskOf(mehrMeadows, "billing")).toBeUndefined();
  });

  it("says what the vendors are, in the review's words", () => {
    expect(taskOf(signedIn(), "vendors")!.detail).toBe(
      "Landscaper, pool service, insurance agent. Anyone the association pays.",
    );
  });
});

describe("one answer, everywhere", () => {
  it("does not print a payments claim anywhere but from the plan's one line", () => {
    const ui = readFileSync("src/components/app/setup-plan.tsx", "utf8");
    expect(ui).not.toMatch(/You can already take payments|You can take payments|Dues land here|Start collecting/);
  });
});

describe("each origin gets exactly its own group", () => {
  it("a turnover board: the handover group first, nothing of the builder's", () => {
    const plan = planOf(signedIn(undefined, { origin: "handover", previously: undefined }));
    expect(plan.phases[0].id).toBe("before-handover");
    expect(plan.phases[0].title).toBe("Before you sign the handover");
    expect(plan.phases[0].tasks.map((t) => t.label)).toEqual(
      portingPlan("handover")!.steps.map((s) => s.title),
    );
    expect(plan.phases.map((p) => p.id)).not.toContain("before-bank");
    // Its own board step is kept apart from "Appoint the rest of the board".
    expect(plan.phases[0].tasks.at(-1)!.key).toBe("handover-board");
  });

  it("a builder: the bank group holds four items, and no handover group", () => {
    const plan = planOf(signedIn(undefined, { origin: "builder", previously: undefined }));
    expect(plan.phases[0].id).toBe("before-bank");
    expect(plan.phases[0].tasks.map((t) => t.label)).toEqual([
      "Get an EIN",
      "Register the association and name a registered agent",
      "Decide what the unsold lots pay, and write it down",
      "Fund reserves from the first dues bill",
    ]);
    expect(plan.phases.map((p) => p.id)).not.toContain("before-handover");
  });

  it("an association that already runs itself gets neither group", () => {
    for (const previously of ["platform", "manager"] as const) {
      const ids = planOf(signedIn(undefined, { origin: "existing", previously })).phases.map((p) => p.id);
      expect(ids).not.toContain("before-handover");
      expect(ids).not.toContain("before-bank");
    }
  });

  it("starting from nothing gets the two bank items and not the builder's", () => {
    const plan = planOf(signedIn(undefined, { origin: "existing", previously: "fresh" }));
    expect(plan.phases[0].tasks.map((t) => t.key)).toEqual(["ein", "register"]);
  });

  it("the board saying done counts, and never touches can take payments", () => {
    const c = signedIn(undefined, { origin: "handover", previously: undefined });
    const open = planOf(c);
    const done = planOf(c, ["turnover-study"]);
    expect(done.done).toBe(open.done + 1);
    expect(done.total).toBe(open.total);
    expect(done.payments.stepsLeft).toBe(open.payments.stepsLeft);
    expect(done.canTakePayments).toBe(false);
    const all = planOf(c, ["turnover-study", "reserve-check", "unsold-dues", "warranty", "records", "handover-board"]);
    expect(all.canTakePayments).toBe(false);
  });

  it("does not inflate the count of steps left out by the answers", () => {
    // Situation steps are not "steps that do not apply to an association like yours".
    const running = planOf(signedIn());
    const builder = planOf(signedIn(undefined, { origin: "builder", previously: undefined }));
    expect(running.skipped).toBeLessThan(10);
    expect(builder.skipped).toBeLessThan(10);
  });
});

describe("one count for setup", () => {
  it("reads the same two numbers however it is asked, and dismissing changes both together", () => {
    const profile = profileFromCommunity(mehrMeadows);
    const open = buildPlan(mehrMeadows, profile);
    const counted = open.phases.flatMap((p) => p.tasks).filter((t) => !t.unavailable);
    const c = setupCounts(open);
    expect(c.total).toBe(counted.length);
    expect(c.done).toBe(counted.filter((t) => t.complete).length);
    expect(c.left).toBe(c.total - c.done);
    // The phases add up to the same total, so no screen can count differently.
    expect(open.phases.reduce((n, p) => n + p.total, 0)).toBe(c.total);
    expect(open.phases.reduce((n, p) => n + p.done, 0)).toBe(c.done);

    // A dismissed optional task leaves the plan, and every caller passing the
    // same set sees the same smaller total.
    const optional = counted.find((t) => t.optional && !t.complete && !t.doneWhenDismissed);
    if (optional) {
      const after = setupCounts(buildPlan(mehrMeadows, profile, new Set([optional.key])));
      expect(after.total).toBe(c.total - 1);
      expect(after.done).toBe(c.done);
    }
  });
});
