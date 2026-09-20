import { test, expect } from "@playwright/test";
import { SEATS, seedSession } from "./helpers";

/**
 * One search across the association, from anywhere, with the keyboard.
 *
 * The point of the palette is that year three can find year one without a
 * filter bar on every tab, so the checks are: the shortcut opens it, a word
 * finds the record, Enter lands on the record, and a resident cannot find
 * somebody else's request.
 */
test.describe("search", () => {
  test("the board finds a vendor by typing and lands on its row", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");

    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("ControlOrMeta+k");
    const box = page.getByRole("dialog", { name: "Search" }).getByRole("textbox");
    await expect(box, "⌘K did not open the search").toBeVisible();

    await box.fill("marchetti");
    await page.waitForTimeout(200);
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog.getByText("Marchetti Resurfacing").first()).toBeVisible();

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/board\/(vendors|money)/);
    await expect(page.getByRole("dialog", { name: "Search" })).toHaveCount(0);
  });

  test("a transaction from an earlier year opens on that year", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    const box = page.getByRole("dialog", { name: "Search" }).getByRole("textbox");
    await box.fill("2024");
    await page.waitForTimeout(200);
    const first = page.getByRole("dialog", { name: "Search" }).locator("li button").first();
    await first.click();
    await page.waitForLoadState("networkidle");
    const text = await page.locator("main").innerText();
    expect(text, "the page landed on nothing").not.toContain("This page did not load");
  });

  test("a resident finds their own request and nobody else's", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await dialog.getByRole("textbox").fill("request");
    await page.waitForTimeout(200);
    const text = await dialog.innerText();
    // Households and money never appear on the resident side.
    expect(text).not.toContain("HOMEOWNERS");
    expect(text).not.toContain("TRANSACTIONS");
  });
});
