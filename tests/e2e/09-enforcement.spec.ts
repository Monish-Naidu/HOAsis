import { test, expect } from "@playwright/test";
import { SEATS, expectHealthy, inspect, seedSession } from "./helpers";

/**
 * Enforcement, from the two sides that never used to meet.
 *
 * A notice existed on the board's screen and the accused household got a
 * letter, which meant the evidence was something described to them rather than
 * something they could look at. And a neighbour had nowhere to tell the board
 * anything, so it happened by email and left no record of who kept reporting
 * whom.
 *
 * The tests here are mostly about what must not happen: the reporter's name
 * must never reach the accused, and no screen may turn a complaint into a
 * notice without somebody having gone to look.
 */

test.describe("evidence", () => {
  test("the board opens the photographs rather than reading a count", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/requests");
    await expectHealthy(page, "violations with evidence");

    // "3 photos" told a board how many existed and told the household
    // nothing. Both sides now open the same viewer.
    // Named exactly rather than by position: the page has other counts on it
    // and .first() was picking one of them up.
    await page.getByRole("button", { name: "3 photos", exact: true }).click();
    await page.waitForTimeout(700);

    const opened = await inspect(page);
    expect(opened.text, "no photograph opened").toContain("Photograph 1 of");
    expect(opened.text, "the vantage is not recorded").toContain("From the street");
  });

  test("a photograph taken over a fence is flagged before the notice goes further", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/requests");
    await page.waitForLoadState("networkidle");

    // The hearing file carries one. Finding it at the hearing is the failure
    // this exists to stop.
    const health = await inspect(page);
    expect(health.text, "the contestable photograph is not surfaced").toContain(
      "worth checking before this goes further",
    );
  });

  test("the accused household sees the same evidence, and never who reported it", async ({
    page,
  }) => {
    // Unit 26 is the household at hearing stage in the seeded file.
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/notices");
    const health = await expectHealthy(page, "notices about your home");

    // A resident with nothing against them gets told so plainly rather than
    // getting an empty screen.
    expect(health.crashed).toBe(false);
    expect(health.text).toMatch(/Nothing outstanding|What the board is relying on/);
    // The one thing that must never appear on this side.
    for (const reporter of ["Marguerite Lowry", "Ines Farrow", "Hollis Nakamura"]) {
      expect(health.text, `${reporter} was named to the accused`).not.toContain(reporter);
    }
  });
});

test.describe("reports from residents", () => {
  test("a resident is told what happens to a report before they write one", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/report");
    const health = await expectHealthy(page, "report a concern");

    // Somebody deciding whether to report their neighbour is deciding on
    // these two facts, so they come before the form rather than after it.
    expect(health.text, "the privacy promise is not made").toContain(
      "never told who reported them",
    );
    expect(health.text, "it does not say a report is not a notice").toContain(
      "go and see it for themselves",
    );
  });

  test("the board sees who reported, and the pattern of who reports whom", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/requests");
    const health = await expectHealthy(page, "report queue");

    expect(health.text, "the queue is missing").toContain("Reported by residents");
    // Board side only, and said explicitly so nobody wires it to the resident.
    expect(health.text).toContain("Not shown to unit");
    // Two reports, same reporter, same neighbour, neither confirmed. The
    // pattern is the finding rather than either report.
    expect(health.text, "the reporting pattern is not surfaced").toContain(
      "has reported unit 45 2 times",
    );
  });

  test("nothing turns a report into a notice without somebody going to look", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/requests");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    // The refusal this whole area is built around. There is no button that
    // promotes a complaint, and the queue says what there is instead.
    expect(health.text).toContain("never the basis for a notice");
    await expect(
      page.getByRole("button", { name: "I went and looked" }).first(),
      "the only route to a notice is missing",
    ).toBeVisible();

    // And the verification will not save empty.
    await page.getByRole("button", { name: "I went and looked" }).first().click();
    await page.waitForTimeout(400);
    await expect(
      page.getByRole("button", { name: "Save" }),
      "an empty verification could be saved",
    ).toBeDisabled();
  });
});

test.describe("deadlines", () => {
  test("every obligation names its section, or says it does not have one", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/compliance");
    const health = await expectHealthy(page, "compliance register");

    // Washington is written, so the rows carry real sections rather than the
    // chapter level placeholders that used to sit here.
    expect(health.text, "the register is not cited").toContain("RCW");
    expect(health.text, "coverage is not stated").toContain("Where these come from");
    // The distinction a new community needs.
    expect(health.text).toContain("Owed from day one");
  });
});

test.describe("how a notice reaches people", () => {
  test("says plainly when the letter is the notice", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/communications");
    await expectHealthy(page, "communications");

    await page
      .getByRole("button", { name: "Lien or preforeclosure warning", exact: true })
      .click();
    await page.waitForTimeout(400);

    const health = await inspect(page);
    // The failure that looks like a success: the email sends, the board
    // believes it gave notice, and the defect shows up at the foreclosure.
    expect(health.text, "the board is not told paper is the notice").toContain(
      "the letter is the notice",
    );
    expect(health.text).toContain("does not discharge the duty");
  });

  test("text is off, and says exactly what would switch it on", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/communications");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    // A send button that appears to work and delivers nothing is worse than
    // no button, because carriers filter unregistered traffic silently.
    expect(health.text).toContain("Text is off");
    expect(health.text, "the gate is not explained").toContain("Campaign Registry");
    expect(health.text, "consent is not distinguished from having a number").toContain(
      "Having a number is not agreement",
    );
  });
});
