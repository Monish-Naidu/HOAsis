import { test, expect } from "@playwright/test";
import { SEATS, expectHealthy, inspect, seedSession } from "./helpers";

/**
 * A home changes hands.
 *
 * The seller leaves, the buyer arrives with a clean statement, and what the
 * seller owed is written as a payment at closing rather than vanishing.
 */
test.describe("recording a sale", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "admin" });
  });

  test("the buyer takes the home and the statement shows the closing", async ({ page }) => {
    await page.goto("/admin/homeowners");
    await expectHealthy(page, "homeowners");

    // Somebody who owes something and is not on the board.
    const sale = page.getByRole("button", { name: /^Record the sale of .*'s home$/ }).nth(3);
    const label = (await sale.getAttribute("aria-label")) ?? "";
    const seller = label.replace("Record the sale of ", "").replace("'s home", "");
    await sale.click();

    await expect(page.getByText(/^Record the sale of unit/)).toBeVisible();
    await page.getByLabel("Buyer name").fill("Priya Nair");
    await page.getByLabel("Buyer email").fill("priya@example.com");
    await page.getByRole("button", { name: "Record the sale", exact: true }).click();

    const after = await inspect(page);
    expect(after.text, "the buyer is not on the roster").toContain("Priya Nair");
    expect(after.text, "the seller is still on the roster").not.toContain(seller);
    await expectHealthy(page, "homeowners after the sale");
  });

  test("opening balances are offered to an established association, not a new build", async ({
    page,
  }) => {
    // The shipped demo predates the question and keeps the button.
    await page.goto("/admin/homeowners");
    await expect(page.getByRole("link", { name: "Opening balances" })).toBeVisible();
  });
});
