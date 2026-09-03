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

/**
 * The queue opens on "Needs you", which is reports nobody has looked at and
 * notices due this week. The seeded notices are further out than that, so the
 * tests that want a notice switch to "Open" first.
 */
async function openTab(page: import("@playwright/test").Page, name: "Needs you" | "Open" | "Resolved") {
  await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
  await page.waitForTimeout(300);
}

test.describe("evidence", () => {
  test("the board opens the photographs rather than reading a count", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    await expectHealthy(page, "violations with evidence");

    // "3 photos" told a board how many existed and told the household
    // nothing. Both sides now open the same viewer, and on the board's side
    // it is inside the row rather than behind a count.
    await openTab(page, "Open");
    await page
      .getByRole("button", { name: /Commercial vehicle parked overnight/ })
      .first()
      .click();
    await page.waitForTimeout(700);

    const opened = await inspect(page);
    expect(opened.text, "no photograph opened").toContain("Photograph 1 of 3");
    expect(opened.text, "the vantage is not recorded").toContain("From the street");
  });

  test("a photograph taken over a fence is flagged before the notice goes further", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");
    await openTab(page, "Open");

    // The hearing file carries one. Finding it at the hearing is the failure
    // this exists to stop, so the flag sits on the collapsed row rather than
    // waiting for somebody to expand it.
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    const health = await expectHealthy(page, "enforcement queue");

    // Unlooked-at reports are the first thing on the first tab.
    expect(health.text, "the queue is missing").toContain("Nobody has looked yet");
    // The reporter is named once the row is opened, and nowhere else.
    await page.getByRole("button", { name: /table saw/ }).first().click();
    await page.waitForTimeout(300);
    const opened = await inspect(page);
    expect(opened.text).toContain("Reported by Colette Prieto");
    // Board side only, and said explicitly so nobody wires it to the resident.
    expect(opened.text).toContain("Not shown to unit");
    // Two reports, same reporter, same neighbour, neither confirmed. The
    // pattern is the finding rather than either report.
    expect(health.text, "the reporting pattern is not surfaced").toContain(
      "has reported unit 45 2 times",
    );
  });

  test("nothing turns a report into a notice without somebody going to look", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    // The refusal this whole area is built around. There is no button that
    // promotes a complaint, and the page says what there is instead.
    expect(health.text).toContain("never the basis for a notice");

    // An unlooked-at report offers a walk down the street and nothing else.
    await page.getByRole("button", { name: /table saw/ }).first().click();
    await page.waitForTimeout(300);
    await expect(
      page.getByRole("button", { name: "Send notice" }),
      "a notice was offered before anybody looked",
    ).toHaveCount(0);
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

  test("a notice becomes possible only after the board writes what it saw", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /table saw/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "I went and looked" }).first().click();
    await page.getByLabel("What you saw at unit 29").fill(
      "Walked past at 8:50pm on the 19th. Table saw running on the driveway, audible from the street.",
    );
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(500);

    // Now, and only now, a notice can rest on it. It still needs a citation.
    const row = page.getByRole("button", { name: /table saw/ }).first();
    if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
    await page.getByRole("button", { name: "Send notice" }).first().click();
    await page.waitForTimeout(300);
    await expect(
      page.getByRole("button", { name: "Send notice" }).last(),
      "a notice could be sent without a rule and a citation",
    ).toBeDisabled();
  });
});

test.describe("notices from the city", () => {
  test("a county notice carries its case and deadline, and nobody is asked to go and look", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");
    await openTab(page, "Open");

    // Filter to the city and the queue is one row: the county's.
    await page.getByRole("button", { name: "City", exact: true }).click();
    await page.waitForTimeout(300);
    const health = await expectHealthy(page, "city notices");
    expect(health.text).toContain("Snohomish County Code Enforcement");
    expect(health.text).toContain("CE-26-01187");
    expect(health.text).toContain("Deadline");

    await page.getByRole("button", { name: /Retention pond fence/ }).first().click();
    await page.waitForTimeout(300);
    // A city notice is not hearsay. The verification step does not exist for it.
    await expect(page.getByRole("button", { name: "I went and looked" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark resolved" })).toBeVisible();
  });

  test("the board can log one with the agency, the case and the deadline", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/violations");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Log a city notice" }).click();
    await page.getByLabel("Agency").fill("City of Everett Code Enforcement");
    await page.getByLabel("Case number").fill("CE-26-02210");
    await page.getByLabel("Deadline").fill("2026-08-28");
    await page.getByLabel("What the notice says").fill(
      "Sidewalk lifted by the maple at the entrance. Grind or replace.",
    );
    await page.getByRole("button", { name: "Log notice" }).click();
    await page.waitForTimeout(500);

    // Inside two weeks, so it lands on the first tab.
    const health = await expectHealthy(page, "after logging a city notice");
    expect(health.text).toContain("City of Everett Code Enforcement");
    expect(health.text).toContain("CE-26-02210");
  });
});

test.describe("deadlines", () => {
  test("every obligation names its section, or says it does not have one", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/compliance");
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/communications");
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/communications");
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
