import { test, expect } from "@playwright/test";
import { SEATS, expectHealthy, inspect, seedSession } from "./helpers";

/**
 * The two things a governing document is for: reading it, and acting on it.
 *
 * Both used to end at a PDF. An owner could download the bylaws and could
 * download a form, and in both cases the product stopped there.
 */

test.describe("bylaws", () => {
  test("an owner can find a rule by a word from a letter they were sent", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents");
    await page.waitForLoadState("networkidle");

    // "fence" appears in the text of an article and in no document title, so a
    // name-only search returns nothing. That is the case worth testing.
    await page.getByLabel("Search documents and bylaws").fill("fence");
    await page.waitForTimeout(400);

    const health = await inspect(page);
    expect(health.text, "searching the bylaw text found nothing").toContain("In the bylaws");
    expect(health.text).toContain("Architectural review");
  });

  test("the plain reading comes first and the exact wording is one click away", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/bylaws");
    await page.waitForLoadState("networkidle");

    const before = (await inspect(page)).text;
    expect(before, "no plain summary rendered").toContain("One home, one vote");
    expect(before, "the legal text is showing before it is asked for").not.toContain(
      "constitutes a quorum",
    );

    await page.getByRole("button", { name: /Read the exact wording/ }).first().click();
    await page.waitForTimeout(400);

    const after = (await inspect(page)).text;
    expect(after, "the governing text never appeared").toContain(
      "As written in the recorded document",
    );
  });

  test("an owner sees what an amendment would actually change", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/bylaws");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.text, "no open amendment is surfaced").toContain("Open for your vote");

    await page.getByText("See exactly what changes").first().click();
    await page.waitForTimeout(400);

    const opened = (await inspect(page)).text;
    // The added paragraph, not a description of it.
    expect(opened, "the marked up wording never appeared").toContain(
      "shall not deny an application for a solar energy system",
    );
  });

  test("a board can draft an amendment and preview it before sending", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/documents/bylaws");
    await expectHealthy(page, "bylaws");

    await page.getByRole("button", { name: "Amend", exact: true }).click();
    await page.waitForTimeout(400);

    const health = await inspect(page);
    expect(health.text, "the board cannot see what owners would see").toContain(
      "What owners will see",
    );
    // The threshold is read out of the association's own amendment article
    // rather than assumed, which is the part that certifies a vote correctly.
    expect(health.text, "the threshold was not read from the bylaws").toContain(
      "percent of all homes",
    );
  });
});

test.describe("forms", () => {
  test("an owner fills in a form, signs it, and gets a reference", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/forms/form-fence");
    await page.waitForLoadState("networkidle");

    // Nothing filled in, so submitting must not be possible.
    const submit = page.getByRole("button", { name: "Sign and submit" });
    await expect(submit, "an empty form could be submitted").toBeDisabled();

    await page.getByLabel(/^Material/).selectOption("Cedar");
    await page.getByLabel(/^Height/).fill("6");
    await page.getByLabel(/^Total run/).fill("48");
    await page.getByLabel(/^Distance from the property line/).fill("6");
    await page.getByLabel(/^Have the adjoining owners been told/).selectOption("Yes");
    await page.getByLabel(/^Planned start date/).fill("2026-09-15");

    // A required attachment, which is the field most applications die on.
    await page.setInputFiles('input[type="file"]', {
      name: "plot-plan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("plot plan"),
    });
    await page.waitForTimeout(300);

    await expect(submit, "signing was not required").toBeDisabled();
    await page.getByLabel("Type your full legal name").fill("Monish Naidu");
    await page.waitForTimeout(300);
    await expect(submit, "a complete, signed form could not be submitted").toBeEnabled();

    await submit.click();
    await page.waitForTimeout(700);

    const health = await inspect(page);
    expect(health.text, "no confirmation").toContain("Sent to the committee");
    expect(health.text, "no reference number was issued").toMatch(/REQ-\d{4}-\d+/);
    // The deadline comes from the association's own article, not a default.
    expect(health.text, "the response deadline was not stated").toContain("to decide");
  });

  test("the submitted form reaches the board as a request", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/forms/form-paint");
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/^Body color/).fill("SW 7015 Repose Gray");
    await page.getByLabel(/^Trim color/).fill("SW 7008 Alabaster");
    await page.getByLabel(/^Is every color from the approved palette/).selectOption({ index: 1 });
    await page.getByLabel(/^Planned start date/).fill("2026-10-01");
    await page.setInputFiles('input[type="file"]', {
      name: "front-elevation.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("photo"),
    });
    await page.getByLabel("Type your full legal name").fill("Monish Naidu");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Sign and submit" }).click();
    await page.waitForTimeout(700);

    const reference = (await inspect(page)).text.match(/REQ-\d{4}-\d+/)?.[0];
    expect(reference, "no reference was issued").toBeTruthy();

    // The whole point: it is a request the board can act on, not a file.
    await seedSession(page, { seat: SEATS.president, view: "admin" });
    await page.goto("/admin/requests");
    await page.waitForLoadState("networkidle");
    const board = await inspect(page);
    expect(board.text, "the board never received the signed form").toContain(
      "Exterior paint color request",
    );
  });

  test("a form with no questions still offers the file", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/forms/form-landscape");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.crashed, "a form without fields crashed").toBe(false);
    expect(health.text, "no fallback for a form that is still a PDF").toContain(
      "still a printed form",
    );
  });
});
