import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SEATS, seedSession } from "./helpers";

/**
 * An automated accessibility pass over the screens a person meets first:
 * the landing page, the sign-in page, the board's dashboard and Finances,
 * the owner's home and Pay. axe finds what a checklist misses (a control
 * with no name, a contrast that slipped, a landmark that is not there).
 *
 * The rules are WCAG 2.1 A and AA. Anything below "serious" is reported in
 * the test's output but does not fail it, so a new "best practice" rule in
 * a newer axe does not stop a deploy; a serious or critical one does.
 */

const PAGES: { path: string; view: "board" | "resident"; name: string }[] = [
  { path: "/", view: "board", name: "the landing page" },
  { path: "/signin", view: "board", name: "sign in" },
  { path: "/board", view: "board", name: "the dashboard" },
  { path: "/board/money", view: "board", name: "Finances" },
  { path: "/board/homeowners", view: "board", name: "Homeowners" },
  { path: "/resident", view: "resident", name: "the owner's home" },
  { path: "/resident/pay", view: "resident", name: "Pay" },
];

for (const screen of PAGES) {
  test(`${screen.name} has no serious accessibility problems`, async ({ page }) => {
    await seedSession(page, { seat: screen.view === "board" ? SEATS.president : SEATS.resident, view: screen.view });
    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const words = (list: typeof results.violations) =>
      list.map((v) => `${v.id} (${v.impact}): ${v.help}; ${v.nodes.length} node(s), first: ${v.nodes[0]?.target.join(" ")}`).join("\n");
    if (results.violations.length > serious.length) {
      console.log(`${screen.name}, minor:\n${words(results.violations.filter((v) => !serious.includes(v)))}`);
    }
    expect(serious, `${screen.name}:\n${words(serious)}`).toEqual([]);
  });
}

test("the Tab key reaches a skip link first, and it lands on the content", async ({ page }) => {
  await seedSession(page, { seat: SEATS.president, view: "board" });
  await page.goto("/board");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveText("Skip to content");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator("#main")).toBeVisible();
});
