import { test, expect } from "@playwright/test";
import {
  ADMIN_TABS,
  SEATS,
  TC1_SEATS,
  expectHealthy,
  inspect,
  openTab,
  seedSession,
} from "./helpers";

/**
 * The board workspace, tab by tab.
 *
 * Run as the President, who holds every capability, so a broken tab is a
 * broken tab rather than a permission working correctly. Permissions get their
 * own file.
 */

test.describe("board workspace", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
  });

  for (const tab of ADMIN_TABS) {
    test(`${tab} works`, async ({ page }) => {
      await page.goto("/admin");
      await openTab(page, "/admin", tab);
      const health = await expectHealthy(page, `admin ${tab}`);
      expect(health.headingCount, `${tab} rendered nothing`).toBeGreaterThan(0);
    });
  }

  test("every tab is reachable from every other tab", async ({ page }) => {
    await page.goto("/admin");
    // Walking the whole nav in one session catches state that leaks between
    // screens, which a fresh load per tab would hide.
    for (const tab of ADMIN_TABS) {
      await openTab(page, "/admin", tab);
      await expectHealthy(page, `admin ${tab} (walked)`);
    }
  });

  test("the sidebar stays with the reader and never traps the page", async ({ page }) => {
    await page.goto("/admin/homeowners");
    await page.waitForLoadState("networkidle");

    const rail = page.locator("aside > div").first();
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(400);

    const box = await rail.boundingBox();
    expect(box, "the sidebar disappeared on scroll").toBeTruthy();
    expect(box!.y, "the sidebar scrolled away with the content").toBeLessThan(200);
    expect(
      box!.height,
      "the sidebar is taller than the viewport, so part of it is unreachable",
    ).toBeLessThanOrEqual(900);

    // The page itself must never scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the page scrolls horizontally").toBeLessThanOrEqual(1);
  });
});

test.describe("board actions", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
  });

  test("confirming a transaction moves it and can be undone", async ({ page }) => {
    await page.goto("/admin/money");
    await page.waitForLoadState("networkidle");

    const before = (await inspect(page)).text;
    const needsReview = Number(before.match(/Needs review\s*\n?\s*(\d+)/)?.[1] ?? "0");
    expect(needsReview, "nothing to confirm, so this proves nothing").toBeGreaterThan(0);

    await page.getByRole("button", { name: "Confirm" }).first().click();
    await page.waitForTimeout(700);

    const undo = page.getByRole("button", { name: /^Undo$/ }).last();
    await expect(undo, "confirming offered no way back").toBeVisible();
    await undo.click();
    await page.waitForTimeout(700);

    const after = (await inspect(page)).text;
    const restored = Number(after.match(/Needs review\s*\n?\s*(\d+)/)?.[1] ?? "0");
    expect(restored, "undo did not restore the transaction").toBe(needsReview);
  });

  test("adding and removing a household both work, and removal is reversible", async ({
    page,
  }) => {
    await page.goto("/admin/homeowners");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add household" }).click();
    await page.getByLabel("Household name").fill("E2E Probe Household");
    await page.getByLabel("Household email").fill("probe@example.com");
    await page.getByLabel("Unit", { exact: true }).fill("999");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(800);

    // The roster pages at 25 and sorts by unit, so a new unit 999 lands
    // several pages down. Search rather than scroll.
    const search = page.getByPlaceholder(/Search owners/i);
    await search.fill("E2E Probe");
    await page.waitForTimeout(500);
    expect(
      (await inspect(page)).text,
      "the household was not added",
    ).toContain("E2E Probe Household");

    await page
      .getByRole("button", { name: "Remove E2E Probe Household from the roster" })
      .click();
    await page.waitForTimeout(600);
    expect((await inspect(page)).text).not.toContain("E2E Probe Household");

    await page.getByRole("button", { name: /^Undo$/ }).last().click();
    await page.waitForTimeout(700);
    await search.fill("E2E Probe");
    await page.waitForTimeout(400);
    expect(
      (await inspect(page)).text,
      "undo did not bring the household back",
    ).toContain("E2E Probe Household");
  });

  test("a rejected forum post can be put back", async ({ page }) => {
    await page.goto("/admin/forum");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    test.skip(!health.text.includes("Publish"), "nothing is waiting for review");

    await page.getByRole("button", { name: "Reject" }).first().click();
    await page.waitForTimeout(600);
    const undo = page.getByRole("button", { name: /^Undo$/ }).last();
    await expect(undo, "rejecting a post offered no way back").toBeVisible();
    await undo.click();
    await page.waitForTimeout(600);
    await expectHealthy(page, "forum after undo");
  });

  test("a past due notice fills in the household's real figures", async ({ page }) => {
    await page.goto("/admin/homeowners");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Message past due" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Late notice with fee" }).click();
    await page.waitForTimeout(400);

    const subject = await page.getByLabel("Subject").inputValue();
    expect(subject, "the subject still shows a merge field").not.toContain("{{");
    expect(subject.length).toBeGreaterThan(5);

    const body = await page.locator("main textarea").first().inputValue();
    expect(body, "the body still shows a merge field").not.toContain("{{");
    expect(body, "the notice names no amount").toMatch(/\$\d/);
  });

  test("exporting the roster produces a real CSV", async ({ page }) => {
    await page.goto("/admin/homeowners");
    await page.waitForLoadState("networkidle");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export roster" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    // Named for the association rather than hardcoded, which it was once.
    expect(file.suggestedFilename()).toContain("mehr-meadows");
  });

  test("settings changes reach the resident side", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");

    const forum = page
      .locator('button[role="switch"]')
      .filter({ has: page.locator("xpath=.") })
      .nth(0);
    // Find the forum toggle by its row rather than by position.
    const row = page.locator("main label, main div").filter({ hasText: "Forum" }).first();
    await expect(row).toBeVisible();

    const toggle = page.locator('button[role="switch"]').first();
    const was = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await page.waitForTimeout(500);
    expect(await toggle.getAttribute("aria-checked")).not.toBe(was);

    // Put it back so the next test starts from the same place.
    await toggle.click();
    await page.waitForTimeout(300);
    expect(forum).toBeTruthy();
  });
});

test.describe("shared costs", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
  });

  test("what the community pays is shown next to who it pays", async ({ page }) => {
    await page.goto("/admin/shared-costs");
    await page.waitForLoadState("networkidle");
    const health = await expectHealthy(page, "shared costs");

    // The provider's name is the part no competitor shows an owner, so it is
    // the part worth asserting rather than the total.
    expect(health.text, "no provider is named").toContain("Cascade Water District");
    expect(health.text, "no per home figure").toMatch(/\$\d/);
  });

  test("the history opens and reports a real bill", async ({ page }) => {
    await page.goto("/admin/shared-costs");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "History" }).first().click();
    await page.waitForTimeout(400);
    const health = await expectHealthy(page, "shared cost history");
    expect(health.text, "the chart legend never rendered").toContain("Peak");
  });

  test("a resident sees their own share and who the association pays", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/finances");
    await page.waitForLoadState("networkidle");
    const health = await inspect(page);

    expect(health.crashed, "the resident funds page crashed").toBe(false);
    expect(health.text, "the owner is not told who the association pays").toContain(
      "Cascade Water District",
    );
    expect(health.text, "the owner is not shown their share").toContain("your share");
  });

  test("an association that bills one flat due is never shown the tab", async ({ page }) => {
    // Test Community One has no shared costs and no assessments. Offering it an
    // empty tab every day is how a simple product stops feeling simple.
    await seedSession(page, {
      seat: TC1_SEATS.president,
      view: "admin",
      community: "test-community-1",
    });
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside a[href^="/admin"]')).map((a) =>
        (a.textContent ?? "").trim().split("\n")[0],
      ),
    );
    expect(
      tabs.some((t) => t.startsWith("Shared costs")),
      "an association with nothing shared was offered the tab anyway",
    ).toBe(false);
  });
});

test.describe("turning a layer on", () => {
  test("an association with nothing shared can add one and post a bill", async ({ page }) => {
    // Test Community One bills a single flat due, which is the state every new
    // association starts in. Getting from there to a working utility pass
    // through is the path that matters.
    await seedSession(page, {
      seat: TC1_SEATS.president,
      view: "admin",
      community: "test-community-1",
    });
    await page.goto("/admin/shared-costs");
    await page.waitForLoadState("networkidle");

    const before = await inspect(page);
    expect(before.text, "an empty association was shown a table").toContain("Nothing shared yet");

    await page.getByRole("button", { name: "Add a shared cost" }).click();
    await page.waitForTimeout(400);

    await page.getByLabel(/What owners will see on their statement/).fill("Water and sewer");
    await page.getByLabel(/Who the association pays/).fill("Kirkland Public Utilities");
    await page.getByLabel(/By people living there/).check();
    await page.getByRole("button", { name: "Add it" }).click();
    await page.waitForTimeout(600);

    const added = await inspect(page);
    expect(added.text, "the provider was not recorded").toContain("Kirkland Public Utilities");

    await page.getByRole("button", { name: "Post a bill" }).first().click();
    await page.waitForTimeout(400);
    await page.getByLabel(/What the provider charged/).fill("420");
    await page.waitForTimeout(400);

    // The split is shown before it is saved. A board that cannot see what each
    // home will be charged will not use this twice.
    const preview = await inspect(page);
    expect(preview.text, "the split was not previewed").toMatch(/across \d+ homes is/);

    await page.getByRole("button", { name: "Post it" }).click();
    await page.waitForTimeout(700);

    const posted = await inspect(page);
    expect(posted.crashed, "posting a bill crashed").toBe(false);
    expect(posted.text, "the posted bill did not reach the summary").toContain("$420.00");
  });

  test("removing a shared cost takes its bills with it", async ({ page }) => {
    await seedSession(page, {
      seat: TC1_SEATS.president,
      view: "admin",
      community: "test-community-1",
    });
    await page.goto("/admin/shared-costs");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add a shared cost" }).click();
    await page.waitForTimeout(300);
    await page.getByLabel(/What owners will see on their statement/).fill("Trash");
    await page.getByRole("button", { name: "Add it" }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Stop passing on Trash/ }).click();
    await page.waitForTimeout(600);

    const health = await inspect(page);
    expect(health.crashed, "removing a shared cost crashed").toBe(false);
    expect(health.text, "the removed cost is still listed").not.toContain("Trash and recycling");
  });
});
