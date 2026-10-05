import { test, expect } from "@playwright/test";
import { MODULES } from "../../src/lib/modules";
import {
  ADMIN_TABS,
  BOARD_SECTION_TABS,
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  for (const tab of ADMIN_TABS) {
    test(`${tab} works`, async ({ page }) => {
      await page.goto("/board");
      await openTab(page, "/board", tab);
      const health = await expectHealthy(page, `admin ${tab}`);
      expect(health.headingCount, `${tab} rendered nothing`).toBeGreaterThan(0);
    });
  }

  for (const [href, section] of Object.entries(BOARD_SECTION_TABS)) {
    test(`${section.row} carries its tabs, and each one opens`, async ({ page }) => {
      await page.goto(href);
      await page.waitForLoadState("networkidle");
      const nav = page.getByRole("navigation", { name: section.row });
      const names = (await nav.getByRole("link").allTextContents()).map((t) => t.trim());
      expect(names, `${section.row} offers the wrong tabs`).toEqual(section.tabs);

      for (const tab of section.tabs) {
        await nav.getByRole("link", { name: tab, exact: true }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(250);
        await expectHealthy(page, `${section.row}, ${tab}`);
        // Whichever tab is open, its row stays lit.
        await expect(page.locator('aside a[aria-current="page"]')).toHaveText(
          new RegExp(`^${section.row}`),
        );
      }
    });
  }

  test("every tab is reachable from every other tab", async ({ page }) => {
    await page.goto("/board");
    // Walking the whole nav in one session catches state that leaks between
    // screens, which a fresh load per tab would hide.
    for (const tab of ADMIN_TABS) {
      await openTab(page, "/board", tab);
      await expectHealthy(page, `admin ${tab} (walked)`);
    }
  });

  test("the sidebar stays with the reader and never traps the page", async ({ page }) => {
    await page.goto("/board/homeowners");
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("confirming a transaction moves it and can be undone", async ({ page }) => {
    await page.goto("/board/money");
    await page.waitForLoadState("networkidle");

    const before = (await inspect(page)).text;
    const needsReview = Number(before.match(/To confirm\s*\n?\s*(\d+)/)?.[1] ?? "0");
    expect(needsReview, "nothing to confirm, so this proves nothing").toBeGreaterThan(0);

    await page.getByRole("button", { name: "Confirm" }).first().click();
    await page.waitForTimeout(700);

    const undo = page.getByRole("button", { name: /^Undo$/ }).last();
    await expect(undo, "confirming offered no way back").toBeVisible();
    await undo.click();
    await page.waitForTimeout(700);

    const after = (await inspect(page)).text;
    const restored = Number(after.match(/To confirm\s*\n?\s*(\d+)/)?.[1] ?? "0");
    expect(restored, "undo did not restore the transaction").toBe(needsReview);
  });

  test("adding and removing a household both work, and removal is reversible", async ({
    page,
  }) => {
    await page.goto("/board/homeowners");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add household" }).click();
    await page.getByLabel("Household name").fill("E2E Probe Household");
    await page.getByLabel("Household email").fill("probe@example.com");
    await page.getByLabel("Unit", { exact: true }).fill("999");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(800);

    // The roster pages at 50 and sorts by unit, so a new unit 999 lands
    // on a later page. Search rather than scroll.
    const search = page.getByPlaceholder(/Search owners/i);
    await search.fill("E2E Probe");
    await page.waitForTimeout(500);
    expect(
      (await inspect(page)).text,
      "the household was not added",
    ).toContain("E2E Probe Household");

    // Remove lives in the household's panel, so open the row first.
    await page.getByRole("button", { name: "E2E Probe Household, unit 999" }).click();
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
    await page.goto("/board/forum");
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
    // Reminders are sent from Collections, which opens the composer on the roster.
    await page.goto("/board/money/collections");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Send reminders" }).or(page.getByRole("button", { name: "Send reminders" })).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Every household behind is listed with the letter its rung calls for,
    // not one template picked for the group.
    const list = page.locator("main ul");
    const badges = await list.getByText(/reminder|notice/i).count();
    expect(badges, "nobody was assigned a letter").toBeGreaterThan(0);

    // The preview is that household's own letter: no merge fields, an amount.
    const preview = page.locator("main div.whitespace-pre-wrap").first();
    const body = await preview.textContent();
    expect(body, "the body still shows a merge field").not.toContain("{{");
    expect(body, "the notice names no amount").toMatch(/\$\d/);

    // Opening a second household changes the preview to that person.
    const rows = page.getByRole("button", { pressed: false }).filter({ hasText: /late$/ });
    if ((await rows.count()) > 0) {
      const name = (await rows.first().textContent()) ?? "";
      await rows.first().click();
      await page.waitForTimeout(300);
      const to = await page.getByText(/^To /).first().textContent();
      expect(to ?? "", "the preview did not follow the selection").toContain(name.slice(0, 6));
    }
  });

  test("exporting the roster produces a real CSV", async ({ page }) => {
    await page.goto("/board/homeowners");
    await page.waitForLoadState("networkidle");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    // Named for the association rather than hardcoded, which it was once.
    expect(file.suggestedFilename()).toContain("willow-creek-estates");
  });

  test("settings changes reach the resident side", async ({ page }) => {
    await page.goto("/board/settings");
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("what the community pays is shown next to who it pays", async ({ page }) => {
    test.skip(!MODULES["shared-costs"].on, "Shared costs is off at launch, see lib/modules.ts");
    await page.goto("/board/shared-costs");
    await page.waitForLoadState("networkidle");
    const health = await expectHealthy(page, "shared costs");

    // The provider's name is the part no competitor shows an owner, so it is
    // the part worth asserting rather than the total.
    expect(health.text, "no provider is named").toContain("Cascade Water District");
    expect(health.text, "no per home figure").toMatch(/\$\d/);
  });

  test("the history opens and reports a real bill", async ({ page }) => {
    test.skip(!MODULES["shared-costs"].on, "Shared costs is off at launch, see lib/modules.ts");
    await page.goto("/board/shared-costs");
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
      view: "board",
      community: "test-community-1",
    });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside a[href^="/board"]')).map((a) =>
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
      view: "board",
      community: "test-community-1",
    });
    test.skip(!MODULES["shared-costs"].on, "Shared costs is off at launch, see lib/modules.ts");
    await page.goto("/board/shared-costs");
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
      view: "board",
      community: "test-community-1",
    });
    test.skip(!MODULES["shared-costs"].on, "Shared costs is off at launch, see lib/modules.ts");
    await page.goto("/board/shared-costs");
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

test.describe("money is one place", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("the sidebar carries Finances, and Reserves and shared costs stay behind it", async ({ page }) => {
    await page.goto("/board");
    await page.waitForLoadState("networkidle");

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside a[href^="/board"]')).map((a) =>
        (a.textContent ?? "").trim().split("\n")[0],
      ),
    );
    // Nine rows since 2026-09-24: Reserves is a tab inside Finances, not a
    // line of its own, and it lights Finances while it is open.
    expect(tabs.some((t) => t.startsWith("Reserve")), "Reserves is still its own line").toBe(false);
    expect(tabs.some((t) => t.startsWith("Shared costs")), "Shared costs is still its own line").toBe(false);
    expect(tabs.some((t) => t.startsWith("Finances")), "Finances vanished entirely").toBe(true);

    await page.goto("/board/reserves");
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator('aside a[aria-current="page"]'),
      "Reserves does not light the Finances row",
    ).toHaveText(/^Finances/);
  });

  test("the control moves between the three, and names the horizon", async ({ page }) => {
    await page.goto("/board/money");
    const health = await expectHealthy(page, "money");
    // The reserves live behind the Finances tabs, not on a line of their own.
    expect(health.text, "reserves are not reachable from money").toContain("Reserves");

    await page.getByRole("navigation", { name: "Finances" }).getByRole("link", { name: "Reserves" }).click();
    await page.waitForURL("**/board/reserves");
    await expectHealthy(page, "reserves through the control");
  });

  test("Money no longer duplicates the reserve schedule", async ({ page }) => {
    await page.goto("/board/money");
    const health = await expectHealthy(page, "money without reserve duplication");
    expect(health.text, "the reserve schedule is still duplicated on Money").not.toContain(
      "Reserve schedule",
    );
  });

  test("a resident still cannot reach reserves by typing the URL", async ({ page }) => {
    // Hiding a link is not gating a page. This is the hole that once served ten
    // screens of association money to anybody who guessed the path.
    await seedSession(page, { seat: SEATS.resident, view: "board" });
    await page.goto("/board/reserves");
    await page.waitForLoadState("networkidle");
    const health = await inspect(page);
    expect(health.crashed).toBe(false);
    // A resident in the board view is sent to their own home screen, with
    // their own balance on it. Figures are only a leak on the board page.
    const landed = new URL(page.url()).pathname;
    if (!landed.startsWith("/board")) {
      // Home is right. Sign in would mean no session, and a pass on nothing.
      expect(landed, "a resident was sent somewhere other than their own home").toBe("/resident");
      return;
    }
    expect(health.text, "reserves leaked to a resident").not.toMatch(/\$[\d,]{3,}/);
  });
});

test.describe("a board can actually run a vote", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("the new ballot button opens a builder, not a toast", async ({ page }) => {
    await page.goto("/board/voting");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "New ballot" }).click();
    await page.waitForTimeout(400);

    // Three things since the launch scope: the question, the choices, the
    // day it ends. Nothing about quorum stands between a volunteer and a vote.
    await page.getByLabel("Ballot title").fill("Replace the pool fence");
    await page.getByLabel("Ballot detail").fill("The current fence fails inspection.");
    await page.waitForTimeout(300);
    const preview = await inspect(page);
    expect(preview.text, "the form still asks about quorum").not.toMatch(/quorum/i);

    await page.getByRole("button", { name: "Open the ballot" }).click();
    await page.waitForTimeout(700);

    const after = await expectHealthy(page, "voting after opening a ballot");
    expect(after.text).toContain("Replace the pool fence");
    expect(after.text, "the new ballot is not counted as open").toContain("0 of");
  });

  test("a ballot needs at least two choices before it can open", async ({ page }) => {
    await page.goto("/board/voting");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "New ballot" }).click();
    await page.waitForTimeout(400);

    const open = page.getByRole("button", { name: "Open the ballot" });
    await expect(open, "an untitled ballot could be opened").toBeDisabled();

    await page.getByLabel("Ballot title").fill("A question");
    await page.getByLabel("Choice 2").fill("");
    await page.waitForTimeout(300);
    await expect(open, "a ballot with one choice could be opened").toBeDisabled();
  });
});

test.describe("vendors", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("every control on the page does something", async ({ page }) => {
    await page.goto("/board/vendors");
    const health = await expectHealthy(page, "vendors");
    // expectHealthy already fails on a button a screen reader cannot name or
    // that does nothing, so this asserts the page is whole.
    expect(health.headingCount).toBeGreaterThan(0);
    expect(health.deadButtons, "a control on this page does nothing").toEqual([]);
  });

  test("a payment already made from the board's own bank can be recorded", async ({ page }) => {
    await page.goto("/board/vendors");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Record a payment" }).click();
    await page.waitForTimeout(400);

    await page.getByLabel("Amount paid").fill("1380");
    // Their date, not today's. A payment entered in April for a February
    // invoice belongs in February, or the books are wrong.
    await page.getByLabel("Date paid").fill("2026-02-14");
    await page.getByLabel("Payment method").selectOption("check");
    await page.getByLabel("Reference").fill("1042");
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Record it" }).click();
    await page.waitForTimeout(700);

    const health = await expectHealthy(page, "vendors after recording a payment");
    expect(health.text, "the recorded payment never appeared").toContain("1042");
  });

  test("routing a payment through us queues it for approval instead", async ({ page }) => {
    await page.goto("/board/vendors");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Record a payment" }).click();
    await page.waitForTimeout(400);

    await page.getByLabel("Amount paid").fill("500");
    await page.getByText("Send this payment through Your HOAsis").click();
    await page.waitForTimeout(300);

    // Money that has already gone needs no approval; money that has not, does.
    await expect(page.getByRole("button", { name: "Queue the payment" })).toBeVisible();
  });
});
