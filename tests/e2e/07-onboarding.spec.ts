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
  collects?: string[];
  /** Lots to generate from the plat, as the builder would type them. */
  lots?: { from: number; to: number };
  builder?: string;
};

/** Walks the wizard end to end and lands on the dashboard. */
async function onboard(page: import("@playwright/test").Page, a: Answers) {
  await clearOnce(page);
  await waitForHydration(page);

  // Step 1, who you are.
  await page.getByLabel(/Association name/i).fill(a.name);
  await page.getByLabel(/City/i).fill("Bothell");
  await page.getByLabel(/State/i).selectOption({ label: a.state });
  await page.getByLabel(/Each home pays/i).fill(a.dues);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(300);

  // Step 2, the three questions.
  await page.getByRole("button", { name: new RegExp(a.property) }).click();
  for (const space of a.spaces ?? []) {
    await page.getByRole("button", { name: new RegExp(`^${space}$`) }).click();
  }
  await page.getByRole("button", { name: new RegExp(a.origin) }).click();
  for (const collect of a.collects ?? []) {
    await page.getByRole("button", { name: new RegExp(collect) }).click();
  }
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(300);

  // Step 3, the homes in the plat.
  await page.getByLabel("Your name").fill("Pat Founder");
  await page.getByLabel("Your email").fill("pat@example.com");
  await page.getByLabel(/^Your (lot|home|unit)$/).fill("1");
  if (a.builder) await page.getByLabel("Builder name").fill(a.builder);
  if (a.lots) {
    // A builder's homes come in phases; an established association's in groups.
    await page.getByLabel(/^(Phase|Group) 1 first lot$/).fill(String(a.lots.from));
    await page.getByLabel(/^(Phase|Group) 1 last lot$/).fill(String(a.lots.to));
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(300);

  // Step 4, bank. Skipping is a supported path.
  await page.getByRole("button", { name: /Skip for now|Create the association/ }).first().click();
  await page.waitForTimeout(900);
  // Signed out, the wizard now asks for an account rather than silently
  // building a browser only copy. Exploring is the labelled way past it.
  const explore = page.getByRole("button", { name: "Look around first" });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await page.waitForTimeout(900);
  }
  await page.getByRole("button", { name: /See what is next/ }).click();
  await page.waitForTimeout(900);
}

test.describe("the three questions", () => {
  test("both single answer questions are required before moving on", async ({ page }) => {
    await clearOnce(page);
    await waitForHydration(page);

    await page.getByLabel(/Association name/i).fill("Gate Check HOA");
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await page.getByLabel(/Each home pays/i).fill("120");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(300);

    const next = page.getByRole("button", { name: /^Continue/ });
    await expect(next, "an unanswered situation step let the board through").toBeDisabled();

    await page.getByRole("button", { name: /Detached homes/ }).click();
    await expect(next, "one answer was enough").toBeDisabled();

    await page.getByRole("button", { name: /We are building the community/ }).click();
    await expect(next, "both answered and still blocked").toBeEnabled();
  });

  test("names the two situations it supports, and what each one changes", async ({
    page,
  }) => {
    await clearOnce(page);
    await waitForHydration(page);

    await page.getByLabel(/Association name/i).fill("Three Ways HOA");
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await page.getByLabel(/Each home pays/i).fill("120");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(300);

    const health = await inspect(page);
    // Two doors: the builder, or the owners. A person who is neither should
    // find that out here, not four screens in.
    expect(health.text, "the question is not asked").toContain("Who is setting this up?");
    for (const option of [
      "We are building the community",
      "We are the owners",
      "We are taking over from the builder",
      "We already run our association",
    ]) {
      expect(health.text, `${option} is missing`).toContain(option);
    }
    // The two answers behind the owners' door are told apart explicitly.
    expect(health.text, "no help telling the owners' two answers apart").toContain(
      "If the builder still owns homes here",
    );

    // Picking one says what it will actually do, so the choice is made on
    // consequences rather than on which description sounds closest.
    await page.getByRole("button", { name: /We already run our association/ }).click();
    await page.waitForTimeout(300);
    const picked = await inspect(page);
    expect(picked.text, "picking an option explains nothing").toContain("What that changes");
    expect(picked.text, "the established path still implies an export").toContain(
      "Nothing has to be exported",
    );

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
      collects: ["Utilities we pass on"],
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

  test("the plan names the state on obligations", async ({ page }) => {
    await onboard(page, {
      name: "Sunset Townhomes",
      state: "California",
      dues: "260",
      property: "Townhomes",
      origin: "We are taking over from the builder",
    });

    await page.goto("/board/setup");
    const health = await expectHealthy(page, "plan for a California association");
    expect(health.text, "the plan never mentions their state").toContain("California");
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
    // Either they can collect, or the plan says exactly how many things stand
    // between them and collecting. Never a bare ratio.
    expect(health.text).toMatch(/You can take payments|before you can take a payment/);
  });

  test("the lots in the plat reach the roster, unsold and billable", async ({ page }) => {
    await onboard(page, {
      name: "Ridgeline Phase One",
      state: "Washington",
      dues: "100",
      property: "Detached homes",
      origin: "We are building the community",
      builder: "Ridgeline Homes",
      lots: { from: 1, to: 12 },
    });

    await page.goto("/board/homeowners");
    const health = await expectHealthy(page, "roster generated from the plat");
    // An unsold lot is not vacant. Somebody owns it and owes the assessment,
    // and a roster that leaves those out is a budget that is short.
    expect(health.text, "the builder is not named against its own lots").toContain(
      "Ridgeline Homes",
    );
    // Twelve lots, of which the founder holds one.
    expect(health.text, "the homes never arrived").toMatch(/12 homes|12 units/i);
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
    expect(health.text, "the plan does not name the association").toContain("Landing HOA is live");
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
    // abandon, so both exits are asserted.
    await expect(page.getByRole("link", { name: "Skip for now" })).toBeVisible();
    await page.getByRole("link", { name: /Go to the dashboard/ }).click();
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
      /Start collecting|You can take payments/,
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

    const health = await inspect(page);
    expect(health.text, "no plan for a board taking over").toContain(
      "Find out what you are being handed",
    );
    // Order is the whole argument. A release signed before the study is a
    // release signed without knowing what it gives up.
    expect(health.text).toContain("before you sign a release");
    expect(health.text, "the reason for the order is missing").toMatch(
      /without knowing what it gives up/,
    );
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

    const health = await inspect(page);
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
      builder: "Greenfield Homes",
    });

    const health = await inspect(page);
    expect(health.text).toContain("Stand it up properly");
    expect(health.text, "the EIN is the thing that unblocks a bank account").toContain(
      "Employer Identification Number",
    );
    // A builder setting its own budget has every incentive to leave this out,
    // and it is the largest source of turnover litigation.
    expect(health.text, "nobody tells the builder to charge itself").toContain(
      "what the unsold lots pay",
    );
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
  test("is told to set one opening balance per home, not to import a ledger", async ({
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

    const health = await inspect(page);
    expect(health.text, "no plan for an established association").toContain(
      "Open your books here",
    );
    // The claim that makes a switch tractable: history stays where it is, and
    // one figure per home on one date is enough to be correct from there.
    expect(health.text).toContain("opening balance for every home");
    expect(health.text, "the reason the history does not move is missing").toContain(
      "Importing years of history is where migrations stall",
    );
    // And still nothing about exporting from wherever they were.
    for (const word of ["spreadsheet", "CSV", "management company"]) {
      expect(health.text, `the plan still mentions ${word}`).not.toContain(word);
    }
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

    // Lot 2, which the founder does not hold.
    const box = page.getByLabel(/^Opening balance for .*2$/);
    await box.fill("1240.50");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Set \d+ balances?$/ }).click();
    await page.waitForTimeout(600);

    await page.goto("/board/homeowners");
    const roster = await expectHealthy(page, "roster after opening balances");
    expect(roster.text, "the balance never reached the roster").toContain("1,240.50");
    // A figure typed into a box says what is owed and nothing about how long
    // it has been owed, so nobody lands on the enforcement ladder from it.
    expect(roster.text, "an opening balance put somebody into collections").not.toContain(
      "In collections",
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

test.describe("get started and signing up are the same flow", () => {
  test("finishing without an account asks for one instead of quietly building a copy", async ({
    page,
  }) => {
    await clearOnce(page);
    await waitForHydration(page);

    await page.getByLabel(/Association name/i).fill("Account Gate HOA");
    await page.getByLabel(/City/i).fill("Bothell");
    await page.getByLabel(/State/i).selectOption({ label: "Washington" });
    await page.getByLabel(/Each home pays/i).fill("120");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Detached homes/ }).click();
    await page.getByRole("button", { name: /We are building the community/ }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(300);
    await page.getByLabel("Your name").fill("Pat Founder");
    await page.getByLabel("Your email").fill("pat@example.com");
    await page.getByLabel(/^Your (lot|home|unit)$/).fill("1");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Skip for now|Create the association/ }).first().click();
    await page.waitForTimeout(700);

    const health = await inspect(page);
    // It used to build the association silently, and a board reasonably
    // believed they had set it up. They had not: it lived in one browser.
    expect(health.text, "no account was ever asked for").toContain("Last thing: an account");
    // Carried from the founder they already typed, so nobody enters it twice.
    // Read from the field rather than the text, since an input's value is not
    // part of innerText.
    await expect(
      page.getByLabel(/Your email/i),
      "the email was not carried forward",
    ).toHaveValue("pat@example.com");
    // Looking around is still allowed, and now says what it is.
    expect(health.text, "exploring is not offered as a real choice").toContain(
      "Look around first",
    );
    expect(health.text, "the browser only copy is not explained").toContain(
      "builds a copy in this browser only",
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
    expect(health.text).toContain("Explore Only HOA is live");
  });
});
