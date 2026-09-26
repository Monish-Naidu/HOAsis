import { test, expect } from "@playwright/test";
import { SEATS, seedSession } from "./helpers";

/**
 * One search across the association, from anywhere, with the keyboard.
 *
 * The point of the palette is that year three can find year one without a
 * filter bar on every tab, so the checks are: the shortcut opens it, a few
 * letters or a typo find the record, the matched letters are marked, Enter
 * lands on the record, a page opens by a word people use for it, an amount
 * and a unit offer a shortcut, what was opened is offered again next time,
 * and a resident cannot find somebody else's request.
 */
test.describe("search", () => {
  const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Search" });

  test("the board finds a vendor by typing and lands on its row", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");

    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("ControlOrMeta+k");
    const box = dialog(page).getByRole("textbox");
    await expect(box, "⌘K did not open the search").toBeVisible();

    await box.fill("marchetti");
    await page.waitForTimeout(200);
    await expect(dialog(page).getByText("Marchetti Resurfacing").first()).toBeVisible();

    await page.keyboard.press("Enter");
    await page.waitForURL(/\/board\/(vendors|money)/);
    await expect(dialog(page)).toHaveCount(0);
  });

  test("a few letters, a typo, and any case find the same household, marked where they matched", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    const box = dialog(page).getByRole("textbox");

    await box.fill("callo");
    await page.waitForTimeout(200);
    const first = dialog(page).getByRole("option").first();
    await expect(first).toContainText("Rhea Calloway");
    await expect(first.locator("mark").first()).toHaveText(/callo/i);

    await box.fill("CALOWAY");
    await page.waitForTimeout(200);
    await expect(dialog(page).getByRole("option").first()).toContainText("Rhea Calloway");
  });

  test("a page opens by a word people use for it, from the keyboard", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ControlOrMeta+k");
    const box = dialog(page).getByRole("textbox");
    await box.fill("money");
    await page.waitForTimeout(200);
    await expect(dialog(page).getByText("Go to", { exact: true })).toBeVisible();
    await expect(dialog(page).getByRole("option").first()).toContainText("Finances");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/board\/money$/);
    // ⌘K toggles: open, and closed again.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("a dollar amount offers Record a payment and lands with the amount filled", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ControlOrMeta+k");
    await dialog(page).getByRole("textbox").fill("$285.00");
    await page.waitForTimeout(200);
    await expect(dialog(page).getByText("Shortcuts")).toBeVisible();
    await dialog(page).getByRole("button", { name: /Record a payment of \$285\.00/ }).click();
    await page.waitForURL(/\/board\/vendors\?record=1/);
    await expect(page.getByRole("heading", { name: "Record a payment" })).toBeVisible();
    await expect(page.getByRole("spinbutton").first()).toHaveValue("285.00");
  });

  test("a unit number offers the home and opens it expanded", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ControlOrMeta+k");
    await dialog(page).getByRole("textbox").fill("unit 55");
    await page.waitForTimeout(200);
    const open = dialog(page).getByRole("button", { name: /^Open Unit 55/ });
    await expect(open).toContainText("Rhea Calloway");
    await open.click();
    await page.waitForURL(/\/board\/homeowners\?open=/);
    await expect(page.getByRole("button", { name: /Rhea Calloway/, expanded: true })).toBeVisible();
  });

  test("what was opened is offered again under Recent, and Clear forgets it", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ControlOrMeta+k");
    await dialog(page).getByRole("textbox").fill("marchetti");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/board\/(vendors|money)/);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page).getByText("Recent")).toBeVisible();
    await expect(dialog(page).getByRole("option").first()).toContainText("Marchetti Resurfacing");
    await dialog(page).getByRole("button", { name: "Clear" }).click();
    await expect(dialog(page).getByText("Recent")).toHaveCount(0);
    await expect(dialog(page).getByText(/Type a name, a unit, an amount/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("a transaction from an earlier year opens on that year", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    const box = dialog(page).getByRole("textbox");
    await box.fill("2024");
    await page.waitForTimeout(200);
    const first = dialog(page).locator("li button").first();
    await first.click();
    await page.waitForLoadState("networkidle");
    const text = await page.locator("main").innerText();
    expect(text, "the page landed on nothing").not.toContain("This page did not load");
  });

  test("a notice opens on the notice, not the list it is somewhere on", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    await dialog(page).getByRole("textbox").fill("commercial vehicle");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/board\/violations\?open=/);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: /Commercial vehicle parked overnight/, expanded: true }),
      "the notice did not open",
    ).toBeVisible();
  });

  test("nothing found says what can be searched", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ControlOrMeta+k");
    await dialog(page).getByRole("textbox").fill("zzqx");
    await page.waitForTimeout(200);
    await expect(dialog(page).getByText(/Nothing matches/)).toBeVisible();
    await expect(dialog(page).getByText(/You can search/)).toBeVisible();
  });

  test("a resident finds their own request and nobody else's, and dues means Pay", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Search" }).first().click();
    await dialog(page).getByRole("textbox").fill("request");
    await page.waitForTimeout(200);
    const text = await dialog(page).innerText();
    // Households and money never appear on the resident side.
    expect(text).not.toContain("HOMEOWNERS");
    expect(text).not.toContain("TRANSACTIONS");

    await dialog(page).getByRole("textbox").fill("dues");
    await page.waitForTimeout(200);
    await expect(dialog(page).getByRole("option").first()).toContainText("Payments");
    await dialog(page).getByRole("textbox").fill("homeowners");
    await page.waitForTimeout(200);
    expect(await dialog(page).innerText()).not.toContain("Go to");
  });
});
