import { test, expect } from "@playwright/test";
import { MODULES } from "../../src/lib/modules";
import { SEATS, expectHealthy, inspect, seedSession } from "./helpers";

/**
 * Notices, the simple version, from both sides.
 *
 * Since the 2026-09-19 launch scope the board's page is two lists and three
 * actions: send a notice, print it, mark it resolved. The full enforcement
 * queue (neighbour reports, verification, city notices, reporting patterns)
 * still exists behind `enforcement-full` in lib/modules.ts, and the specs
 * that covered it are in git history under this file's name. What survives
 * here is the part that protects the household: they see the same
 * photographs the board sees, and never who reported them.
 */

async function openTab(page: import("@playwright/test").Page, name: "Open" | "Resolved") {
  // A segmented control since 2026-09-24: pressed buttons, not tabs.
  await page
    .getByRole("group", { name: "Which notices" })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await page.waitForTimeout(300);
}

test.describe("notices", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("an opened notice draws no empty photograph frames", async ({ page }) => {
    await page.goto("/board/violations");
    await expectHealthy(page, "notices with evidence");
    await openTab(page, "Open");
    await page
      .getByRole("button", { name: /Commercial vehicle parked overnight/ })
      .first()
      .click();
    await page.waitForTimeout(700);

    // The demo's notices list photographs with no file behind them. They
    // were drawn as grey frames captioned "Photograph 1 of 3"; a frame with
    // nothing in it is not evidence, so the viewer only draws real files.
    const opened = await inspect(page);
    expect(opened.crashed, "opening the notice crashed").toBe(false);
    expect(opened.text, "the notice did not open").toContain("Commercial vehicle parked overnight");
    expect(opened.text, "an empty photograph frame is still drawn").not.toContain("Photograph 1 of 3");
  });

  test("a notice is a home, what needs fixing, and one button", async ({ page }) => {
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "New notice" }).click();
    await page.waitForTimeout(300);
    const send = page.getByRole("button", { name: "Send notice" });
    await expect(send, "an empty notice could be sent").toBeDisabled();

    await page.getByLabel("Which home").selectOption({ index: 1 });
    await page.getByLabel("What needs fixing").fill(
      "Trash cans are out front on non-collection days. Please keep them behind the fence.",
    );
    await expect(send).toBeEnabled();
    await send.click();
    await page.waitForTimeout(500);

    const after = await expectHealthy(page, "after sending a notice");
    expect(after.text).toContain("Trash cans are out front");
    // Nothing on the page asks about stages, hearings or fines.
    expect(after.text).not.toMatch(/hearing|fine/i);
  });

  test("marking a notice resolved moves it to the other list", async ({ page }) => {
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");
    await openTab(page, "Open");

    const row = page.getByRole("button", { name: /Commercial vehicle parked overnight/ }).first();
    await row.click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Mark resolved" }).first().click();
    await page.waitForTimeout(500);

    await openTab(page, "Resolved");
    const resolved = await inspect(page);
    expect(resolved.text).toContain("Commercial vehicle parked overnight");
  });

  test("the full queue is one switch away, and off", async ({ page }) => {
    test.skip(MODULES["enforcement-full"].on, "the full queue is on; nothing to prove");
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");
    const health = await inspect(page);
    expect(health.text).not.toContain("Log a city notice");
    expect(health.text).not.toContain("Nobody has looked yet");
  });
});

test.describe("the household's side", () => {
  test("the accused household sees the same evidence, and never who reported it", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/notices");
    const health = await expectHealthy(page, "notices about your home");

    expect(health.crashed).toBe(false);
    expect(health.text).toMatch(/No notices|The board's evidence/);
    for (const reporter of ["Marguerite Lowry", "Ines Farrow", "Hollis Nakamura"]) {
      expect(health.text, `${reporter} was named to the accused`).not.toContain(reporter);
    }
  });

  test("reporting a neighbour is switched off and says so", async ({ page }) => {
    test.skip(MODULES["resident-report"].on, "reports are on; the older specs apply");
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/report");
    const health = await expectHealthy(page, "report a concern, off");
    expect(health.text).toContain("not switched on");
  });
});

test.describe("switched off pages", () => {
  test("compliance says it is off rather than rendering", async ({ page }) => {
    test.skip(MODULES.compliance.on, "compliance is on; the older spec applies");
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/compliance");
    const health = await expectHealthy(page, "compliance, off");
    expect(health.text).toContain("not switched on");
    expect(health.text, "the register rendered anyway").not.toContain("RCW");
  });
});

test.describe("how a notice reaches people", () => {
  test.beforeEach(() => {
    test.skip(!MODULES["delivery-panel"].on, "the delivery panel is off at launch, see lib/modules.ts");
  });

  test("says plainly when the letter is the notice", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/communications");
    await expectHealthy(page, "communications");

    await page
      .getByRole("button", { name: "Lien or preforeclosure warning", exact: true })
      .click();
    await page.waitForTimeout(400);

    const health = await inspect(page);
    expect(health.text, "the board is not told paper is the notice").toContain(
      "the letter is the notice",
    );
    expect(health.text).toContain("does not count as official notice");
  });

  test("text is off, and says exactly what would switch it on", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/communications");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.text).toContain("Text is off");
    expect(health.text, "the gate is not explained").toContain("Campaign Registry");
    expect(health.text, "consent is not distinguished from having a number").toContain(
      "Having a number is not agreement",
    );
  });
});
