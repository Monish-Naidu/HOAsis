import { test, expect } from "@playwright/test";
import { SEATS, expectHealthy, inspect, seedSession } from "./helpers";

/**
 * The two things a governing document is for: reading it, and acting on it.
 *
 * Both used to end at a PDF. An owner could download the bylaws and could
 * download a form, and in both cases the product stopped there.
 */

test.describe("governing documents", () => {
  test("an owner can find a rule by a word from a letter they were sent", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents");
    await page.waitForLoadState("networkidle");

    // "fence" appears in the text of an article and in no document title, so a
    // name-only search returns nothing. That is the case worth testing.
    await page.getByLabel("Search documents and governing documents").fill("fence");
    await page.waitForTimeout(400);

    const health = await inspect(page);
    expect(health.text, "searching the document text found nothing").toContain(
      "In your governing documents",
    );
    expect(health.text).toContain("Architectural review");
  });

  test("search crosses all three documents, because an owner does not know which one to look in", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/governing");
    await page.waitForLoadState("networkidle");

    // A trash can is in the board-adopted rules, a lien is in the recorded
    // declaration, and a quorum is in the bylaws. Nobody moving in knows that.
    await page.getByLabel("Search the governing documents").fill("refuse");
    await page.waitForTimeout(400);
    expect((await inspect(page)).text, "the rules were not searched").toContain(
      "Refuse containers",
    );

    await page.getByLabel("Search the governing documents").fill("foreclose");
    await page.waitForTimeout(400);
    expect((await inspect(page)).text, "the declaration was not searched").toContain(
      "What happens if assessments go unpaid",
    );
  });

  test("the three documents are told apart, and which one wins is stated", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/governing");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.text, "the hierarchy is not explained anywhere").toContain(
      "Three documents, and which one wins",
    );
    // State law sits above all three, which is the part that catches a board
    // enforcing a covenant the legislature has since overridden.
    expect(health.text).toContain("State law");
    expect(health.text, "the declaration is not marked as recorded").toContain(
      "recorded with the county",
    );
    expect(health.text, "a rule is not shown as board adopted").toContain(
      "The board, at a meeting, with no owner vote".toLowerCase(),
    );
  });

  test("an owner is told the eight things a buyer must be warned about", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/what-you-agreed-to");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.crashed, "the disclosure screen crashed").toBe(false);
    expect(health.text, "the lien consequence is not disclosed").toContain(
      "What happens if I fall behind on dues?",
    );
    expect(health.text, "solar is not disclosed").toContain("Can I install solar panels?");

    // Every answer names the provision it came from. An answer with no
    // citation is this product asserting a reading of somebody's documents.
    await page.getByRole("button", { name: /fall behind on dues/ }).click();
    await page.waitForTimeout(400);
    const opened = (await inspect(page)).text;
    expect(opened, "the answer does not cite a provision").toContain("CC&Rs Article V");
    expect(opened, "the exact wording is not reachable").toContain("The exact wording");
  });

  test("the plain reading comes first and the exact wording is one click away", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/governing");
    await page.waitForLoadState("networkidle");

    const before = (await inspect(page)).text;
    expect(before, "no plain summary rendered").toContain("One home, one vote");
    expect(before, "the legal text is showing before it is asked for").not.toContain(
      "constitutes a quorum",
    );

    await page.getByRole("button", { name: /Read the exact wording/ }).first().click();
    await page.waitForTimeout(400);

    const after = (await inspect(page)).text;
    expect(after, "the governing text never appeared").toContain("As written in the");
  });

  test("an owner sees what an amendment would actually change", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/governing");
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/governing");
    await expectHealthy(page, "bylaws");

    await page.getByRole("button", { name: "Amend", exact: true }).click();
    await page.waitForTimeout(400);

    const health = await inspect(page);
    expect(health.text, "the board cannot see what owners would see").toContain(
      "What owners will see",
    );
    // The threshold is read out of the association's own amendment article
    // rather than assumed, which is the part that certifies a vote correctly.
    expect(health.text, "the threshold was not read from the documents").toContain(
      "percent of all homes",
    );
  });

  test("changing a rule and changing a covenant are not the same act", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/governing");
    await expectHealthy(page, "governing documents");

    // Seventy-five percent and a trip to the county recorder.
    await page.getByRole("button", { name: "Declaration, the CC&Rs" }).click();
    await page.waitForTimeout(400);
    const declaration = (await inspect(page)).text;
    expect(declaration, "the declaration threshold is not stated").toContain(
      "seventy-five percent of all homes",
    );
    expect(declaration, "recording is not mentioned").toContain("recording with the county");

    // A board adopts a rule on its own, which is why that layer is the risky
    // one. A screen that presented the two identically would be the bug.
    await page.getByRole("button", { name: "Rules and regulations" }).click();
    await page.waitForTimeout(400);
    const rules = (await inspect(page)).text;
    expect(rules, "a rule change is presented as needing an owner vote").not.toContain(
      "seventy-five percent of all homes",
    );
    expect(rules, "the overreach risk is not flagged").toContain(
      "goes further than the declaration allows",
    );
  });

  test("a starter policy is offered for rules and for neither of the other two", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/governing");
    await expectHealthy(page, "governing documents");

    // A board already holds the authority to adopt a rule. It does not hold
    // the authority to be handed a covenant we wrote and record it against
    // everybody's land, so nothing is offered on the other two layers.
    const declaration = (await inspect(page)).text;
    expect(declaration, "a covenant template was offered").not.toContain(
      "Policies most associations are expected to have",
    );

    await page.getByRole("button", { name: "Rules and regulations" }).click();
    await page.waitForTimeout(400);
    const rules = (await inspect(page)).text;
    expect(rules, "no starter policy is offered at the rules layer").toContain(
      "Policies most associations are expected to have",
    );
    expect(rules, "the obligation behind the policy is not named").toContain("RCW 64.90.495");

    await page.getByRole("button", { name: "Start from this" }).first().click();
    await page.waitForTimeout(400);
    const drafting = (await inspect(page)).text;
    // It lands as a draft in the same form a board would have typed into, and
    // the preview shows the words themselves. The recorded vote at the end is
    // what gives them force.
    expect(drafting, "the board cannot see what the change would be").toContain(
      "What owners will see",
    );
    expect(drafting, "the starter text did not load").toContain(
      "Payments are applied first to assessments",
    );
    await expect(
      page.getByRole("textbox", { name: "Title" }),
      "the title did not load",
    ).toHaveValue("Collections policy");
  });

  test("a board is told which of the eight it cannot answer", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/new-owner");
    await expectHealthy(page, "new owner disclosure");

    const health = await inspect(page);
    expect(health.text, "the coverage count is missing").toContain("8 / 8");
    expect(health.text, "the statutory basis is not given").toContain(
      "Virginia, Colorado and Washington",
    );
  });
});

test.describe("importing a document", () => {
  test("an article number the document already has is refused, not silently dropped", async ({
    page,
  }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/import");
    await page.waitForLoadState("networkidle");

    // Importing the same file twice, or an amended copy that restates one
    // article, is the likeliest mistake here. A button that appears to work
    // and adds nothing is worse than a refusal that says why.
    await page.getByLabel("The text of the document").fill(
      "DECLARATION OF COVENANTS\n\nARTICLE VII. Architectural control\n\nNo exterior alteration shall be made without approval.\n",
    );
    await page.waitForTimeout(600);

    const health = await inspect(page);
    expect(health.text, "the collision was not reported").toContain(
      "already exists in the CC&Rs",
    );
    expect(health.text, "the article was not marked").toContain("Already on file");
    await expect(
      page.getByRole("button", { name: /^Add \d+ article/ }),
      "a no-op import was offered",
    ).toBeDisabled();
  });

  test("text becomes articles a board confirms, and gaps stay visible", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/import");
    await expectHealthy(page, "document import");

    await page.getByLabel("The text of the document").fill(
      [
        "RULES AND REGULATIONS",
        "of Mehr Meadows Homeowners Association",
        "Adopted by resolution of the Board of Directors.",
        "",
        "Section 7.1 Quiet hours",
        "",
        "No amplified sound shall be audible at a lot line between 10:00 p.m. and 7:00 a.m.",
        "",
        "Section 7.2",
        "",
        "Holiday lighting",
        "",
        "Holiday lighting may be displayed from November 15 to January 15.",
      ].join("\n"),
    );
    await page.waitForTimeout(600);

    const parsed = await inspect(page);
    expect(parsed.crashed, "the extractor crashed the page").toBe(false);
    expect(parsed.text, "the headings were not found").toContain("Section 7.1");
    expect(parsed.text, "the document kind was not guessed").toContain("looks like this");
    // Text ahead of the first heading is reported rather than folded into the
    // first article, because a board will cite whatever ends up in there.
    expect(parsed.text, "the preamble was silently swallowed").toContain(
      "ahead of the first heading",
    );
    // 7.2 borrowed its title from the line below, which is right more often
    // than not and is exactly why it has to be flagged rather than trusted.
    expect(parsed.text, "an uncertain heading was not flagged").toContain("Needs a look");

    // The board picks the document. The guess is only ever a suggestion, and a
    // test that leans on it is testing the guess rather than the import.
    await page.getByRole("button", { name: /^Rules and regulations/ }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Add \d+ article/ }).click();
    await page.waitForTimeout(600);

    // Only the one read cleanly starts ticked, so a board clicking straight
    // through imports the confident half and looks at the rest.
    await page.goto("/board/documents/governing");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Rules and regulations" }).click();
    await page.waitForTimeout(400);
    const reader = (await inspect(page)).text;
    expect(reader, "the confirmed article never reached the reader").toContain("Quiet hours");
    expect(reader, "an unconfirmed article was imported anyway").not.toContain(
      "Holiday lighting may be displayed",
    );
  });

  test("nothing writes a plain reading on the board's behalf", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/documents/import");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("The text of the document").fill(
      "ARTICLE XX. Pets\n\nNo more than two domestic animals shall be kept upon a Lot.\n",
    );
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /^Add \d+ article/ }).click();
    await page.waitForTimeout(600);

    // A summary of a covenant is an interpretation, and this product does not
    // put its interpretation into somebody's legal record. The gap is shown.
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/documents/governing");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.text, "the imported article is missing").toContain("Pets");
    expect(health.text, "a plain reading was invented for it").toContain(
      "No plain reading has been written",
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
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/requests");
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
