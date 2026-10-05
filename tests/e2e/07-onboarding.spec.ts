import { test, expect } from "@playwright/test";
import { expectHealthy, inspect, waitForHydration } from "./helpers";

/**
 * Clears saved state exactly once.
 *
 * Deliberately not the shared `clearState`, which installs an init script that
 * runs before every navigation. That is right for a test that never creates
 * anything and fatal here: it wipes the association the moment we navigate to
 * look at it.
 */
async function clearOnce(page: import("@playwright/test").Page) {
  await page.goto("/start");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("hoasis") || key.startsWith("sb-")) localStorage.removeItem(key);
    }
  });
  await page.reload();
}

/**
 * Past the account step, without an account.
 *
 * Signed out, the wizard opens on an account form so the lead exists before
 * any of the work does. These tests never create one, because that would put
 * a row in Supabase for every run. Looking around is the labelled way past
 * it, and ends in a browser only copy.
 */
async function lookAround(page: import("@playwright/test").Page) {
  await clearOnce(page);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Look around first" }).click();
  await page.waitForTimeout(300);
}

/**
 * Onboarding a community that is still being built.
 *
 * There is no roster to import here and no prior association to move. The
 * homes come from the plat, most of them unsold, and the two people who ever
 * do this are the builder standing the association up and the owners taking it
 * over afterwards. Those are opposite first weeks, so these tests mostly
 * assert on what is absent from each: a builder is never asked about vendors
 * it has not hired, and neither is ever told to export anything.
 */

type Answers = {
  name: string;
  state: string;
  dues: string;
  property: "Detached homes" | "Townhomes" | "Condominiums";
  origin:
    | "We are building the community"
    | "We are taking over from the builder"
    | "We already run our association";
  spaces?: string[];
  /** Lots to generate from the plat, as the builder would type them. */
  lots?: { from: number; to: number };
  /** For an established association: where it is coming from. */
  previously?: "A management company" | "Another platform" | "Nothing yet";
};

/** The next question. */
async function step(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(400);
}

/**
 * Walks the founding questions end to end and lands on the plan's welcome
 * screen. One question per screen, so this reads as the questions do.
 */
async function onboard(page: import("@playwright/test").Page, a: Answers) {
  // The account, skipped.
  await lookAround(page);

  // The association: name, place.
  await page.getByLabel(/Association name/i).fill(a.name);
  await step(page);
  await page.getByLabel(/City/i).fill("Bothell");
  await page.getByLabel(/State/i).selectOption({ label: a.state });
  await step(page);

  // The community: who is setting up (which words every later screen uses),
  // kind of homes, what each pays, what is shared. Shared spaces are
  // legitimately empty.
  await page.getByRole("button", { name: new RegExp(a.origin) }).click();
  // Owners who already run it are asked where they are coming from.
  if (a.origin === "We already run our association") {
    await page.getByRole("button", { name: new RegExp(a.previously ?? "Another platform") }).click();
  }
  await step(page);
  await page.getByRole("button", { name: new RegExp(a.property) }).click();
  await step(page);
  await page.getByLabel(/Each home pays/i).fill(a.dues);
  await step(page);
  for (const space of a.spaces ?? []) {
    await page.getByRole("button", { name: new RegExp(`^${space}$`) }).click();
  }
  await step(page);

  // The homes: which is yours, and the plat.
  await page.getByLabel("Your name").fill("Pat Founder");
  await page.getByLabel("Your email").fill("pat@example.com");
  await page.getByLabel("Your home address").fill("1 Founder Way");
  // Where homes go by number the founder's number is required; for detached
  // homes by address it is optional. Filled either way.
  await page.getByLabel(/^(Lot|Home|Unit) number/).fill("1");
  await step(page);
  // A builder's homes come in phases; an established association's in
  // groups. At least one range is required, so a test that names none gets
  // a small default.
  const lots = a.lots ?? { from: 1, to: 3 };
  if ((await page.getByLabel(/^(Phase|Group) 1 first lot$/).count()) > 0) {
    await page.getByLabel(/^(Phase|Group) 1 first lot$/).fill(String(lots.from));
    await page.getByLabel(/^(Phase|Group) 1 last lot$/).fill(String(lots.to));
  } else {
    // Owners who already run detached homes list them by address, and the
    // list may be empty: the founder's own home is already one.
    for (let n = lots.from; n <= lots.to; n += 1) {
      if (n === lots.from) continue;
      await page.getByRole("button", { name: /^Add a (home|unit|lot)$/ }).click();
      await page.getByLabel(/^Address of home \d+$/).last().fill(`${n} Founder Way`);
    }
  }
  await page.waitForTimeout(300);
  await step(page);

  // When billing starts, taken as offered. It is the last question and
  // its button founds the association.
  await page.getByRole("button", { name: "Create the association" }).click();
  await page.waitForTimeout(1200);
}

test.describe("the three questions", () => {
  test("both single answer questions are required before moving on", async ({ page }) => {
    await lookAround(page);

    await page.getByLabel(/Association name/i).fill("Gate Check HOA");
    await step(page);
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await step(page);
    const go = page.getByRole("button", { name: /^Continue/ });
    await expect(go, "an unanswered origin let the board through").toBeDisabled();
    await page.getByRole("button", { name: /We are building the community/ }).click();
    await expect(go, "the origin was answered and still blocked").toBeEnabled();
    await step(page);

    await expect(go, "an unanswered kind of homes let the board through").toBeDisabled();
    await page.getByRole("button", { name: /Detached homes/ }).click();
    await expect(go, "the kind of homes was answered and still blocked").toBeEnabled();
    await step(page);
    await page.getByLabel(/Each home pays/i).fill("120");
    await step(page);

    // Shared spaces are legitimately empty, and say so.
    await expect(page.getByRole("button", { name: "Nothing shared" })).toBeVisible();
    await step(page);

    // Nobody founds an association without saying who they are.
    await expect(go, "a blank name and email let the board through").toBeDisabled();
  });

  test("names the two situations it supports, and what each one changes", async ({
    page,
  }) => {
    await lookAround(page);

    await page.getByLabel(/Association name/i).fill("Three Ways HOA");
    await step(page);
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await step(page);

    const health = await inspect(page);
    // Two doors: the builder, or the owners. A person who is neither should
    // find that out here, not four screens in.
    expect(health.text, "the question is not asked").toContain("Who is setting this up?");
    for (const option of [
      "We are building the community",
      "We are taking over from the builder",
      "We already run our association",
    ]) {
      expect(health.text, `${option} is missing`).toContain(option);
    }

    // Picking one says what it will actually do, so the choice is made on
    // consequences rather than on which description sounds closest.
    await page.getByRole("button", { name: /We already run our association/ }).click();
    await page.waitForTimeout(300);
    const picked = await inspect(page);
    expect(picked.text, "picking an option explains nothing").toContain("What that changes");
    expect(picked.text, "the established path still implies an export").toContain(
      "Nothing has to be exported",
    );
    // The third door asks where they are coming from, and will not move on
    // without an answer: the first weeks differ for each.
    expect(picked.text, "the follow-up is missing").toContain("Where are you coming from?");
    for (const option of ["A management company", "Another platform", "Nothing yet"]) {
      expect(picked.text, `${option} is missing`).toContain(option);
    }
    await expect(page.getByRole("button", { name: /^Continue/ })).toBeDisabled();
    await page.getByRole("button", { name: /Nothing yet/ }).click();
    await expect(page.getByRole("button", { name: /^Continue/ })).toBeEnabled();

    // The builder is told the handover happens inside the product.
    await page.getByRole("button", { name: /We are building the community/ }).click();
    await page.waitForTimeout(300);
    expect((await inspect(page)).text, "the builder is not told how the handover works").toContain(
      "hand them the presidency",
    );
  });
});

test.describe("the plan is built from the answers", () => {
  test("a builder is never shown vendors or amenities it does not have", async ({ page }) => {
    await onboard(page, {
      name: "Cedar Detached HOA",
      state: "Washington",
      dues: "95",
      property: "Detached homes",
      origin: "We are building the community",
    });

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a new detached association");

    // Still building: whoever cuts the grass is on the construction contract,
    // not the association's. Detached: nothing shared to book.
    expect(health.text, "a builder was asked about vendors it has not hired").not.toContain(
      "Add your vendors",
    );
    expect(health.text, "a detached association was asked about amenities").not.toContain(
      "amenities",
    );
    // And it says so, rather than silently showing a shorter list.
    expect(health.text, "the plan never explains what it left out").toMatch(
      /do not apply to an association like yours/,
    );
  });

  test("a condo taking over from the builder gets vendors, with the reason that fits", async ({
    page,
  }) => {
    await onboard(page, {
      name: "Harbor Condominiums",
      state: "Washington",
      dues: "410",
      property: "Condominiums",
      origin: "We are taking over from the builder",
      spaces: ["Pool", "Gym"],
    });

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a condo taking over");

    expect(health.text, "vendors missing for a board taking over").toContain("vendor");
    // The sentence that names their own situation back to them. Contracts in
    // the builder's name simply stop when the builder leaves.
    expect(health.text, "no reason written for this board's situation").toContain(
      "in the builder's name",
    );
    expect(health.text, "amenities missing after picking a pool and a gym").toContain("reserve");
  });

  test("the plan leaves the budget out while that page is switched off", async ({ page }) => {
    await onboard(page, {
      name: "Sunset Townhomes",
      state: "California",
      dues: "260",
      property: "Townhomes",
      origin: "We are taking over from the builder",
    });

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a California association");
    // The one step that named the state was the budget, and the Budget page
    // is switched off for launch, so the step is too. When it comes back
    // this goes back to checking for "California".
    expect(health.text, "the plan points at a page that is switched off").not.toContain("Budget what you spend");
    expect(health.text, "the records group is missing").toContain("Records owners can ask for");
  });
});

test.describe("getting to money", () => {
  test("the milestone is announced rather than left as a fraction", async ({ page }) => {
    await onboard(page, {
      name: "Quick Start HOA",
      state: "Washington",
      dues: "150",
      property: "Detached homes",
      origin: "We are building the community",
      lots: { from: 1, to: 4 },
    });

    await page.goto("/board/setup");
    const health = await inspect(page);
    expect(health.crashed, "the plan crashed").toBe(false);
    // One line, from one answer. This is a copy in the browser, which cannot
    // take money, so it must say so and never claim "You can take payments".
    // (A signed in association says how many steps are left until Stripe is on.)
    expect(health.text).toMatch(
      /cannot take payments|steps? left before owners can pay online/,
    );
    expect(health.text, "a browser copy claimed it can take payments").not.toContain(
      "You can take payments",
    );
  });

  test("the lots in the plat reach the roster, unsold and billable", async ({ page }) => {
    await onboard(page, {
      name: "Ridgeline Phase One",
      state: "Washington",
      dues: "100",
      property: "Detached homes",
      origin: "We are building the community",
      lots: { from: 1, to: 12 },
    });

    await page.goto("/board/homeowners");
    const health = await expectHealthy(page, "roster generated from the plat");
    // An unsold lot is not vacant. It owes the assessment, and a roster that
    // leaves those out is a budget that is short. The builder setting the
    // community up says "Not sold yet"; no builder's name is asked or shown.
    expect(health.text, "the unsold lots are not on the roster").toContain("Not sold yet");
    // Twelve lots, of which the founder holds one.
    // The roster's All filter carries the count.
    expect(health.text, "the homes never arrived").toMatch(/All\s*12\b/);
  });
});

test.describe("the plan is its own screen", () => {
  test("onboarding lands on the plan, not on an empty workspace", async ({ page }) => {
    await onboard(page, {
      name: "Landing HOA",
      state: "Washington",
      dues: "175",
      property: "Detached homes",
      origin: "We are building the community",
    });

    expect(page.url(), "onboarding did not land on the plan").toContain("/start/plan");
    const health = await inspect(page);
    expect(health.crashed).toBe(false);
    expect(health.text, "the plan does not name the association").toMatch(
      /Landing HOA is (live|set up in this browser)/,
    );
  });

  test("the plan is leavable, from the header and from the foot", async ({ page }) => {
    await onboard(page, {
      name: "Escape Hatch HOA",
      state: "Washington",
      dues: "140",
      property: "Detached homes",
      origin: "We are building the community",
    });

    // A plan that has to be finished before the product opens is a plan people
    // abandon, so both exits are asserted: the header, and the welcome's own.
    await expect(page.getByRole("link", { name: "Skip for now" })).toBeVisible();
    await page.getByRole("link", { name: /Open the dashboard/ }).first().click();
    await page.waitForTimeout(900);

    expect(page.url(), "the dashboard link did not leave the plan").toContain("/board");
    const health = await expectHealthy(page, "dashboard after leaving the plan");
    expect(health.text).toContain("Escape Hatch HOA");
  });

  test("the plan is reachable again later", async ({ page }) => {
    await onboard(page, {
      name: "Return Visit HOA",
      state: "Washington",
      dues: "160",
      property: "Detached homes",
      origin: "We are building the community",
    });

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan inside the workspace");
    expect(health.text, "the plan is not available in the workspace").toMatch(
      /Get paid/,
    );
  });
});

test.describe("the dashboard", () => {
  test("shows a link rather than a list once the association is running", async ({ page }) => {
    await onboard(page, {
      name: "Dashboard Shape HOA",
      state: "Washington",
      dues: "180",
      property: "Detached homes",
      origin: "We are building the community",
      lots: { from: 1, to: 6 },
    });

    await page.goto("/board");
    const health = await expectHealthy(page, "new association dashboard");
    expect(health.crashed).toBe(false);
    // Naming the association proves we are actually inside it. Asserting only
    // that headings exist passes on the sign in page, which is where this
    // landed while the test was wiping its own state.
    expect(health.text, "not signed into the new association").toContain(
      "Dashboard Shape HOA",
    );
  });
});

test.describe("the first weeks of a community still being built", () => {
  test("a board taking over is told to study the place before it signs anything", async ({
    page,
  }) => {
    await onboard(page, {
      name: "Handover HOA",
      state: "Washington",
      dues: "300",
      property: "Condominiums",
      origin: "We are taking over from the builder",
    });

    // The short paragraph for the situation, above the one list.
    const intro = await inspect(page);
    expect(intro.text, "no introduction for a board taking over").toContain(
      "Find out what you are being handed",
    );

    // The handover steps are items in the one list, in their own group,
    // first. Order is the whole argument.
    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a board taking over");
    expect(health.text, "no handover group").toContain("Before you sign the handover");
    expect(health.text).toContain("before you sign a release");
    expect(health.text, "the reason for the order is missing").toMatch(
      /without knowing what it gives up/,
    );
    expect(
      health.text.indexOf("Before you sign the handover"),
      "the handover group should come before Get paid",
    ).toBeLessThan(health.text.indexOf("Get paid"));
    // A turnover has balances on the day control passes, so the list asks.
    expect(health.text, "a turnover is not asked what each home owes").toContain(
      "Enter what each home owes today",
    );
    // And it is not given the builder's group.
    expect(health.text).not.toContain("Before the bank will open an account");
  });

  test("a board taking over is told to ask what the builder paid on its own lots", async ({
    page,
  }) => {
    await onboard(page, {
      name: "Deposit History HOA",
      state: "Washington",
      dues: "220",
      property: "Townhomes",
      origin: "We are taking over from the builder",
    });

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a board taking over");
    // The most commonly skipped obligation in the category, and the one that
    // stops being collectable the day the builder dissolves the entity.
    expect(health.text, "nobody asks about dues on the unsold lots").toContain(
      "what the builder paid on the lots it owned",
    );
    // A balance says where you are. The deposit history says whether the
    // builder funded all along or topped it up the week before turnover.
    expect(health.text, "the reserve check is a balance rather than a history").toContain(
      "deposit history",
    );
    for (const title of [
      "Get an independent turnover study, before you sign a release",
      "Check what the reserve account actually holds",
      "Write down when the construction warranties end",
      "Take the records in a form you can use",
      "Seat your own board and remove the builder's signers",
    ]) {
      expect(health.text, `${title} is missing`).toContain(title);
    }
  });

  test("a builder is told to constitute it and to charge its own unsold lots", async ({
    page,
  }) => {
    await onboard(page, {
      name: "Greenfield HOA",
      state: "Washington",
      dues: "120",
      property: "Detached homes",
      origin: "We are building the community",
    });

    const intro = await inspect(page);
    expect(intro.text).toContain("Stand it up properly");

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "builder plan");
    expect(health.text).toContain("Before the bank will open an account");
    expect(health.text, "the EIN is the thing that unblocks a bank account").toContain("Get an EIN");
    expect(health.text).toContain("Register the association and name a registered agent");
    // A builder setting its own budget has every incentive to leave this out,
    // and it is the largest source of turnover litigation.
    expect(health.text, "nobody tells the builder to charge itself").toContain(
      "what the unsold lots pay",
    );
    expect(health.text).toContain("Fund reserves from the first dues bill");
    expect(
      health.text.indexOf("Before the bank will open an account"),
      "the bank paperwork should come before Get paid",
    ).toBeLessThan(health.text.indexOf("Get paid"));
    // Nothing to carry in for a builder, and no handover steps.
    expect(health.text).not.toContain("Enter what each home owes today");
    expect(health.text).not.toContain("Before you sign the handover");
  });

  test("nobody is told to import, export, or leave a management company", async ({ page }) => {
    await onboard(page, {
      name: "No Migration HOA",
      state: "Washington",
      dues: "150",
      property: "Detached homes",
      origin: "We are building the community",
    });

    // There is no prior association to move. Any of these words on this screen
    // means the flow has drifted back to the market we left.
    const health = await inspect(page);
    for (const word of ["spreadsheet", "Import the roster", "management company", "CSV"]) {
      expect(health.text, `the plan still mentions ${word}`).not.toContain(word);
    }
  });
});

test.describe("an association that already runs itself", () => {
  test("is asked what each home owes today, not to import a ledger", async ({
    page,
  }) => {
    await onboard(page, {
      name: "Willow Creek HOA",
      state: "Washington",
      dues: "185",
      property: "Townhomes",
      origin: "We already run our association",
      lots: { from: 1, to: 8 },
    });

    // The books are a list item now, not a numbered card under the list.
    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for an established association");
    expect(health.text, "the opening balances step is missing").toContain(
      "Enter what each home owes today",
    );
    expect(health.text, "an established association was given the builder's paperwork").not.toContain(
      "Before the bank will open an account",
    );
    // And still nothing about exporting from wherever they were.
    for (const word of ["spreadsheet", "CSV", "management company"]) {
      expect(health.text, `the plan still mentions ${word}`).not.toContain(word);
    }
    // The link goes to the screen that sets them.
    await expect(
      page.locator('a[href^="/start/plan?task=opening-balances"]').first(),
    ).toBeVisible();
  });

  test("from nothing yet gets the paperwork a new association needs, and the balances", async ({
    page,
  }) => {
    await onboard(page, {
      name: "Fresh Start HOA",
      state: "Washington",
      dues: "120",
      property: "Detached homes",
      origin: "We already run our association",
      previously: "Nothing yet",
    });
    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a fresh association");
    expect(health.text).toContain("Get an EIN");
    expect(health.text).toContain("Enter what each home owes today");
  });

  test("can actually set those balances, and they reach the statement", async ({ page }) => {
    await onboard(page, {
      name: "Opening Balance HOA",
      state: "Washington",
      dues: "150",
      property: "Detached homes",
      origin: "We already run our association",
      lots: { from: 1, to: 4 },
    });

    await page.goto("/board/homeowners/opening-balances");
    const health = await expectHealthy(page, "opening balances");
    expect(health.text, "the screen does not say what it is for").toContain(
      "day you switched",
    );

    // Home 2, which the founder does not hold. Detached homes of an
    // established association go by address.
    const box = page.getByLabel(/^Opening balance for .*, 2 Founder Way$/);
    await box.fill("1240.50");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Save \d+ balances?$/ }).click();
    await page.waitForTimeout(600);

    await page.goto("/board/homeowners");
    const roster = await expectHealthy(page, "roster after opening balances");
    expect(roster.text, "the balance never reached the roster").toContain("1,240.50");
    // A figure typed into a box says what is owed and nothing about how long
    // it has been owed, so nobody lands on the enforcement ladder from it.
    expect(roster.text, "an opening balance put somebody into collections").not.toMatch(
      /\d+ days? late/,
    );
  });
});

test.describe("what kind of homes changes the plan", () => {
  test("a condominium is asked about the building it owns", async ({ page }) => {
    await onboard(page, {
      name: "Tower Condominiums",
      state: "Washington",
      dues: "420",
      property: "Condominiums",
      origin: "We are building the community",
    });
    await page.goto("/board/setup");
    const health = await expectHealthy(page, "condo plan");

    // Several states added inspection duties after Surfside.
    expect(health.text, "a condo is not asked about structural inspection").toContain(
      "structural inspection",
    );
    // The association insures the building; owners need an HO-6.
    expect(health.text, "the condo insurance split is not explained").toContain("HO-6");
    expect(health.text, "the maintenance line is not addressed").toContain("who fixes what");
  });

  test("townhomes are asked about shared roofs and party walls", async ({ page }) => {
    await onboard(page, {
      name: "Rowhouse Commons",
      state: "Washington",
      dues: "280",
      property: "Townhomes",
      origin: "We are building the community",
    });
    await page.goto("/board/setup");
    const health = await expectHealthy(page, "townhome plan");

    expect(health.text).toContain("who fixes what");
    expect(health.text, "the party wall problem is not named").toMatch(
      /party wall|shared roof/i,
    );
    // A townhome association does not own a building the way a condo does.
    expect(health.text, "townhomes were asked about milestone inspections").not.toContain(
      "structural inspection",
    );
  });

  test("detached homes are asked about neither", async ({ page }) => {
    await onboard(page, {
      name: "Open Lots HOA",
      state: "Washington",
      dues: "95",
      property: "Detached homes",
      origin: "We are building the community",
    });
    await page.goto("/board/setup");
    const health = await expectHealthy(page, "detached plan");

    // No shared wall, no shared roof, so the question never arises.
    expect(health.text, "detached homes were asked who fixes a shared roof").not.toContain(
      "who fixes what",
    );
    expect(health.text).not.toContain("structural inspection");
    // And the insurance line says what is actually true for them.
    expect(health.text, "the detached insurance position is not stated").toContain(
      "Owners insure their own homes",
    );
  });
});

test.describe("a community with more than one kind of home", () => {
  test("townhomes and condos, each range its own kind, each kind its own dues", async ({
    page,
  }) => {
    await lookAround(page);
    await page.getByLabel(/Association name/i).fill("Juniper Row HOA");
    await step(page);
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await step(page);

    // Two kinds picked. Both stay pressed.
    await page.getByRole("button", { name: /We are building the community/ }).click();
    await step(page);
    await page.getByRole("button", { name: /Townhomes/ }).click();
    await page.getByRole("button", { name: /Condominiums/ }).click();
    await expect(page.getByRole("button", { name: /Townhomes/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Condominiums/ })).toHaveAttribute("aria-pressed", "true");
    await step(page);

    // Dues by kind.
    await page.getByRole("radio", { name: "Different by kind" }).click();
    await page.getByLabel("Townhomes pay").fill("300");
    await page.getByLabel("Condos pay").fill("420");
    await step(page);
    await step(page); // nothing shared

    await page.getByLabel("Your name").fill("Pat Founder");
    await page.getByLabel("Your email").fill("pat@example.com");
    await page.getByLabel(/^(Lot|Home|Unit) number$/).fill("25");
    await step(page);

    // Two ranges: townhomes 1 to 20, a condo building 21 to 40.
    await page.getByLabel(/^Phase 1 first lot$/).fill("1");
    await page.getByLabel(/^Phase 1 last lot$/).fill("20");
    await page.getByRole("button", { name: /Add another phase/ }).click();
    await page.getByLabel(/^Phase 2 last lot$/).fill("40");
    // A new range starts as the kind nobody has used yet.
    await expect(
      page.getByRole("radiogroup", { name: "Kind of home in Phase 2" }).getByRole("radio", { name: "Condos" }),
    ).toHaveAttribute("aria-checked", "true");
    const summary = await inspect(page);
    expect(summary.text).toContain("20 townhomes at $300");
    expect(summary.text).toContain("20 condos at $420");
    // 20 x 300 + 20 x 420, the founder's condo included.
    expect(summary.text).toContain("$14,400 per month");
    await step(page);
    await page.getByRole("button", { name: "Create the association" }).click();
    await page.waitForTimeout(1200);

    await page.goto("/board/homeowners");
    await waitForHydration(page);
    const roster = await expectHealthy(page, "roster of a mixed community");
    expect(roster.text).toContain("Townhome");
    expect(roster.text).toContain("Condo");
    await page.getByLabel("Kind of home").selectOption("condos");
    await expect(page.locator("main li", { hasText: "· Condo" })).toHaveCount(20);
    await expect(page.locator("main li", { hasText: "· Townhome" })).toHaveCount(0);

    await page.goto("/board/settings");
    await waitForHydration(page);
    await expect(page.getByLabel("Condos, per month")).toHaveValue("420");
    await expect(page.getByLabel("Townhomes, per month")).toHaveValue("300");
  });
});

test.describe("get started and signing up are the same flow", () => {
  test("the account comes first, and the email can wait", async ({ page }) => {
    await clearOnce(page);
    await waitForHydration(page);

    const health = await inspect(page);
    // The account used to be the last screen, and a board that typed a roster
    // and left rather than pick a password was nobody. Now it is the first,
    // so whoever leaves on step three still exists.
    expect(health.text, "the account is not the first step").toContain("Start with an account");
    expect(health.text, "the step count hides the account step").toMatch(/Step 1 of \d+/);
    // And the confirmation email is deferred, said in so many words, so
    // nobody goes to their inbox before the work.
    expect(health.text, "the email is not deferred").toContain(
      "Confirming your email can wait until the end",
    );
    // Looking around is still allowed, and says what it is.
    expect(health.text, "exploring is not offered as a real choice").toContain(
      "Look around first",
    );
    expect(health.text, "the browser only copy is not explained").toContain(
      "builds a copy in this browser only",
    );

    // Nothing reaches Supabase until all three fields are filled.
    const next = page.getByRole("button", { name: /^Continue/ });
    await expect(next, "an empty account form let the board through").toBeDisabled();
    await page.getByLabel("Your name").fill("Pat Founder");
    await page.getByLabel("Your email").fill("pat@example.com");
    await expect(next, "no password was enough").toBeDisabled();
    await page.getByLabel("Pick a password").fill("long enough");
    await expect(next, "a complete form is still blocked").toBeEnabled();

    // Not creating the account in a test, so look around instead. The name
    // and email typed here still carry to the homes step, so nobody enters
    // them twice. Read from the field, since a value is not part of innerText.
    await page.getByRole("button", { name: "Look around first" }).click();
    await page.waitForTimeout(300);
    expect((await inspect(page)).text, "looking around lost the step count").toMatch(
      /Step 2 of \d+/,
    );
    await page.getByLabel(/Association name/i).fill("Account First HOA");
    await step(page);
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await step(page);
    await page.getByRole("button", { name: /We are building the community/ }).click();
    await step(page);
    await page.getByRole("button", { name: /Detached homes/ }).click();
    await step(page);
    await page.getByLabel(/Each home pays/i).fill("120");
    await step(page);
    await step(page); // nothing shared
    await expect(page.getByLabel("Your name"), "the name was not carried forward").toHaveValue(
      "Pat Founder",
    );
    await expect(
      page.getByLabel("Your email"),
      "the email was not carried forward",
    ).toHaveValue("pat@example.com");
  });

  test("looking around ends in a copy that says it is one", async ({ page }) => {
    await onboard(page, {
      name: "Browser Copy HOA",
      state: "Washington",
      dues: "120",
      property: "Detached homes",
      origin: "We are building the community",
    });

    const health = await inspect(page);
    // It used to build the association silently, and a board reasonably
    // believed they had set it up. They had not: it lived in one browser.
    expect(health.text, "the copy passes itself off as the association").toContain(
      "is set up in this browser",
    );
    expect(health.text, "the copy does not say where it lives").toContain(
      "copy in this browser only",
    );
  });

  test("looking around still works, and still reaches the plan", async ({ page }) => {
    await onboard(page, {
      name: "Explore Only HOA",
      state: "Washington",
      dues: "110",
      property: "Detached homes",
      origin: "We are building the community",
    });
    expect(page.url()).toContain("/start/plan");
    const health = await inspect(page);
    // A browser-only copy says so in the heading rather than claiming to be live.
    expect(health.text).toMatch(/Explore Only HOA is (live|set up in this browser)/);
  });
});
