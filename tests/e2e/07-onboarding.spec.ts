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
 * Onboarding, in the shapes real associations arrive in.
 *
 * The point of the three questions is that two different boards get two
 * different plans. So these tests mostly assert on what is absent: a detached
 * single family association should never be shown an amenity step, and a brand
 * new one should never be asked about vendors it has not hired.
 */

type Answers = {
  name: string;
  state: string;
  dues: string;
  property: "Detached homes" | "Townhomes" | "Condominiums";
  origin: "Brand new" | "Already running it ourselves" | "Leaving a management company";
  spaces?: string[];
  collects?: string[];
  households?: string;
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

  // Step 3, homes.
  await page.getByLabel("Your name").fill("Pat Founder");
  await page.getByLabel("Your email").fill("pat@example.com");
  await page.getByLabel("Your unit").fill("1");
  if (a.households) {
    await page.getByRole("button", { name: "Paste a list instead" }).click();
    await page.getByLabel(/Paste your roster/i).fill(a.households);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Add \d+ homes?$/ }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(300);

  // Step 4, bank. Skipping is a supported path.
  await page.getByRole("button", { name: /Skip for now|Create the association/ }).first().click();
  await page.waitForTimeout(1200);
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

    await page.getByRole("button", { name: /Brand new/ }).click();
    await expect(next, "both answered and still blocked").toBeEnabled();
  });
});

test.describe("the plan is built from the answers", () => {
  test("a new detached association is never shown vendors or amenities", async ({ page }) => {
    await onboard(page, {
      name: "Cedar Detached HOA",
      state: "Washington",
      dues: "95",
      property: "Detached homes",
      origin: "Brand new",
    });

    await page.goto("/admin/setup");
    const health = await expectHealthy(page, "plan for a new detached association");

    // Brand new: nobody has been hired yet. Detached: nothing shared to book.
    expect(health.text, "a brand new association was asked about vendors").not.toContain(
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

  test("a condo leaving a manager gets vendors, with the reason that fits", async ({ page }) => {
    await onboard(page, {
      name: "Harbor Condominiums",
      state: "Washington",
      dues: "410",
      property: "Condominiums",
      origin: "Leaving a management company",
      spaces: ["Pool", "Gym"],
      collects: ["Utilities we pass on"],
    });

    await page.goto("/admin/setup");
    const health = await expectHealthy(page, "plan for a condo leaving a manager");

    expect(health.text, "vendors missing for a board leaving a manager").toContain("vendor");
    // The sentence that names their own situation back to them.
    expect(health.text, "no reason written for this board's situation").toContain(
      "Your manager holds these contracts",
    );
    expect(health.text, "amenities missing after picking a pool and a gym").toContain("reserve");
  });

  test("the plan names the state on obligations", async ({ page }) => {
    await onboard(page, {
      name: "Sunset Townhomes",
      state: "California",
      dues: "260",
      property: "Townhomes",
      origin: "Already running it ourselves",
    });

    await page.goto("/admin/setup");
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
      origin: "Brand new",
      households: "Marcus Bell, marcus@example.com, 2\nYuki Tanaka, yuki@example.com, 3",
    });

    await page.goto("/admin/setup");
    const health = await inspect(page);
    expect(health.crashed, "the plan crashed").toBe(false);
    // Either they can collect, or the plan says exactly how many things stand
    // between them and collecting. Never a bare ratio.
    expect(health.text).toMatch(/You can take payments|before you can take a payment/);
  });

  test("a pasted roster reaches the association", async ({ page }) => {
    await onboard(page, {
      name: "Roster Import HOA",
      state: "Washington",
      dues: "100",
      property: "Detached homes",
      origin: "Brand new",
      households:
        'Marcus Bell, marcus@example.com, 2\n"Tanaka, Yuki", yuki@example.com, 3\nOwen Brady, 4',
    });

    await page.goto("/admin/homeowners");
    const health = await expectHealthy(page, "roster after import");
    expect(health.text, "the pasted households never arrived").toContain("Marcus Bell");
    // The quoted comma case, which used to split into a household called
    // Tanaka living in unit Yuki.
    expect(health.text, "a quoted name was split on its comma").toContain("Tanaka, Yuki");
  });
});

test.describe("the plan is its own screen", () => {
  test("onboarding lands on the plan, not on an empty workspace", async ({ page }) => {
    await onboard(page, {
      name: "Landing HOA",
      state: "Washington",
      dues: "175",
      property: "Detached homes",
      origin: "Brand new",
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
      origin: "Brand new",
    });

    // A plan that has to be finished before the product opens is a plan people
    // abandon, so both exits are asserted.
    await expect(page.getByRole("link", { name: "Skip for now" })).toBeVisible();
    await page.getByRole("link", { name: /Go to the dashboard/ }).click();
    await page.waitForTimeout(900);

    expect(page.url(), "the dashboard link did not leave the plan").toContain("/admin");
    const health = await expectHealthy(page, "dashboard after leaving the plan");
    expect(health.text).toContain("Escape Hatch HOA");
  });

  test("the plan is reachable again later", async ({ page }) => {
    await onboard(page, {
      name: "Return Visit HOA",
      state: "Washington",
      dues: "160",
      property: "Detached homes",
      origin: "Brand new",
    });

    await page.goto("/admin/setup");
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
      origin: "Brand new",
      households: "Marcus Bell, marcus@example.com, 2",
    });

    await page.goto("/admin");
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
