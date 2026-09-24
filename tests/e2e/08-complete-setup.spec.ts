import { test, expect, type Page } from "@playwright/test";
import { expectHealthy, inspect, waitForHydration } from "./helpers";

/**
 * Finishing setup, all the way, for each kind of association.
 *
 * The plan is only worth having if it can be completed. Four of its tasks
 * pointed at screens that could not complete them: there was no way to record
 * insurance, add a budget line, add a reserve component, or give a neighbour
 * an office. A board could work the list forever and never reach the end.
 *
 * So this walks every task to done and asserts the plan says so, for detached
 * homes, townhomes and condominiums, because the three get different lists.
 */

async function clearOnce(page: Page) {
  await page.goto("/start");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("hoasis") || key.startsWith("sb-")) localStorage.removeItem(key);
    }
  });
  await page.reload();
}

type Kind = "Detached homes" | "Townhomes" | "Condominiums";

/** Founds an association from the plat, with three lots and a named buyer. */
async function found(page: Page, name: string, property: Kind) {
  await clearOnce(page);
  await waitForHydration(page);

  // The account step comes first when signed out. Not creating one here,
  // because that is a Supabase row per run; looking around is the labelled
  // way past it and ends in a browser only copy.
  await page.getByRole("button", { name: "Look around first" }).click();
  await page.waitForTimeout(300);

  const next = async () => {
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.waitForTimeout(400);
  };

  await page.getByLabel(/Association name/i).fill(name);
  await next();
  await page.getByLabel(/City/i).fill("Bothell");
  await page.getByLabel(/State/i).selectOption({ label: "Washington" });
  await next();
  await page.getByRole("button", { name: new RegExp(property) }).click();
  await next();
  await page.getByLabel(/Each home pays/i).fill("250");
  await next();

  await page.getByRole("button", { name: /^Pool$/ }).click();
  await next();
  await page.getByRole("button", { name: /We are building the community/ }).click();
  await next();
  await next();

  await page.getByLabel("Your name").fill("Pat Founder");
  await page.getByLabel("Your email").fill("pat@example.com");
  await page.getByLabel("Your home address").fill("1 Founder Way");
  await page.getByLabel(/^(Lot|Home|Unit) number$/).fill("1");
  await next();
  await page.getByLabel("Builder name").fill("Ridgeline Homes");
  await next();
  await page.getByLabel("Phase 1 first lot").fill("1");
  await page.getByLabel("Phase 1 last lot").fill("3");
  await page.waitForTimeout(400);

  // One lot has sold. The other two are the builder's, which is the ordinary
  // state of a community that is still being built.
  await page.getByRole("button", { name: "It has sold" }).first().click();
  await page.getByLabel(/^(Buyer for|Owner of) /).fill("Marcus Bell");
  await page.getByLabel(/^Email for /).fill("marcus@example.com");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(300);
  await next();

  // Connect a bank, so the collect phase can actually finish. Picking an
  // institution then an account, which is the real two step flow.
  await page.getByRole("button", { name: /^BECU/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Skip for now|Create the association/ }).first().click();
  await page.waitForTimeout(1200);
}

/** Uploads a document with the given name, which several tasks key off. */
async function uploadDoc(page: Page, fileName: string) {
  await page.goto("/board/documents");
  await page.waitForLoadState("networkidle");
  // Two file inputs live on this page. Target the labelled upload rather
  // than whichever one happens to be first in the document.
  await page.locator('input[accept*=".pdf"]').first().setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("pdf"),
  });
  await page.waitForTimeout(600);
}

async function completeEverything(page: Page, property: Kind) {
  // Governing documents, plus the two attached housing tasks that key off a
  // document name.
  await uploadDoc(page, "Declaration and Bylaws.pdf");
  if (property !== "Detached homes") {
    await uploadDoc(page, "Maintenance responsibility matrix.pdf");
  }
  if (property === "Condominiums") {
    await uploadDoc(page, "Structural inspection report.pdf");
  }

  // Budget: one expense line, on the Budget tab of Finances.
  await page.goto("/board/money/budget");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add a budget line" }).click();
  await page.getByLabel("Annual amount").fill("18000");
  await page.getByRole("button", { name: "Add it" }).click();
  await page.waitForTimeout(500);

  // Reserves: one component.
  await page.goto("/board/reserves");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add a component" }).click();
  await page.getByLabel("Component name").fill("Clubhouse roof");
  await page.getByLabel("Replacement cost").fill("42000");
  await page.getByRole("button", { name: "Add it" }).click();
  await page.waitForTimeout(500);

  // Settings: insurance, an officer, an amenity, a photograph.
  await page.goto("/board/settings");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Marcus Bell's role").selectOption("treasurer");
  await page.waitForTimeout(400);

  await page.getByPlaceholder("Add an amenity").fill("Clubhouse");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(400);

  await page.locator('input[accept*="image"]').first().setInputFiles({
    name: "cover.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("jpg"),
  });
  await page.waitForTimeout(500);

  // Insurance last, so nothing else on this page re-renders over it.
  await page.goto("/board/settings");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Insurance carrier").fill("Farmers Insurance");
  await page.getByLabel("Insurance carrier").blur();
  await page.waitForTimeout(600);

  // Vendors.
  await page.goto("/board/vendors");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add vendor" }).click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder("Cascade Grounds Co.").fill("Bellevue Lawn");
  await page.getByPlaceholder("Grounds and irrigation").fill("Grounds");
  await page.getByRole("button", { name: "Save vendor" }).click();
  await page.waitForTimeout(600);
}

for (const property of ["Detached homes", "Townhomes", "Condominiums"] as const) {
  test(`${property}: every step maps to a screen that can finish it`, async ({ page }) => {
    test.setTimeout(120_000);
    await found(page, `${property.split(" ")[0]} Complete HOA`, property);
    await completeEverything(page, property);

    await page.goto("/board/setup");
    const health = await expectHealthy(page, `${property} plan after finishing`);

    // A finished plan drops the ratio entirely and says so, so the completion
    // sentence is the assertion and the ratio is only read to report which
    // task is stuck when it is not.
    if (!health.text.includes("Everything is set up")) {
      const open = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main a[href^='/board']"))
          .map((el) => (el.textContent ?? "").trim().split("\n")[0])
          .filter((t) => t && t !== "Open"),
      );
      const ratio = health.text.match(/(\d+) of (\d+)/);
      throw new Error(
        `${property}: plan not complete (${ratio?.[0] ?? "no count"}). ` +
          `Still open: ${JSON.stringify(open)}`,
      );
    }
    expect(health.text, "the plan did not report completion").toContain("Everything is set up");
  });
}

test("the return bar carries a board back, and disappears when done", async ({ page }) => {
  test.setTimeout(120_000);
  await found(page, "Return Bar HOA", "Detached homes");

  // Mid setup, every workspace screen offers the way back.
  await page.goto("/board/documents");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("link", { name: /Back to setting up/ }),
    "no way back to the plan from a task",
  ).toBeVisible();

  await completeEverything(page, "Detached homes");

  await page.goto("/board/documents");
  await page.waitForLoadState("networkidle");
  const after = await inspect(page);
  expect(
    after.text,
    "the bar still nags after everything is finished",
  ).not.toContain("Back to setting up");
});
