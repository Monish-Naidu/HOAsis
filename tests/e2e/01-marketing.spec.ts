import { test, expect } from "@playwright/test";
import { clearState, expectHealthy, inspect, waitForHydration } from "./helpers";

/**
 * The public site, which is the only part a stranger sees.
 *
 * Nothing here is signed in, so a crash or a dead link is visible to every
 * prospect who ever visits.
 */

const PAGES = [
  { path: "/", name: "landing" },
  { path: "/pricing", name: "pricing" },
  { path: "/about", name: "about" },
  { path: "/library", name: "library" },
  { path: "/signin", name: "sign in" },
  { path: "/start", name: "setup" },
];

test.describe("public site", () => {
  for (const { path, name } of PAGES) {
    test(`${name} renders and every control works`, async ({ page }) => {
      await clearState(page);
      const response = await page.goto(path);
      expect(response?.status(), `${name} returned an error status`).toBeLessThan(400);
      await expectHealthy(page, name);
    });
  }

  test("every internal link resolves", async ({ page }) => {
    await clearState(page);
    await page.goto("/");

    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="/"]'))
        .map((a) => a.getAttribute("href")!)
        .filter((h, i, all) => all.indexOf(h) === i),
    );
    expect(hrefs.length, "the landing page has no internal links").toBeGreaterThan(3);

    const broken: string[] = [];
    for (const href of hrefs) {
      const response = await page.request.get(href);
      if (response.status() >= 400) broken.push(`${href} -> ${response.status()}`);
    }
    expect(broken, "links that do not resolve").toEqual([]);
  });

  test("no link is a placeholder", async ({ page }) => {
    await clearState(page);
    for (const { path } of PAGES) {
      await page.goto(path);
      const stubs = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll("a"))
            .map((a) => a.getAttribute("href"))
            .filter((h) => !h || h === "#").length,
      );
      expect(stubs, `${path} has links pointing nowhere`).toBe(0);
    }
  });

  test("the library filters by state and articles open", async ({ page }) => {
    await clearState(page);
    await page.goto("/library");

    const select = page.locator("main select").first();
    await expect(select).toBeVisible();
    const before = (await inspect(page)).text.length;
    await select.selectOption({ index: 2 });
    await page.waitForTimeout(400);
    expect((await inspect(page)).text.length, "the state filter changed nothing").not.toBe(
      before,
    );

    await select.selectOption({ index: 0 });
    await waitForHydration(page);

    const article = page.locator('main a[href^="/library/"]').first();
    await expect(article).toBeVisible();
    // Read the destination first. Changing the filter re-renders the list, so
    // clicking and hoping is how this raced the first time.
    const href = await article.getAttribute("href");
    expect(href, "no article to open").toBeTruthy();

    await Promise.all([page.waitForURL(`**${href}`), article.click()]);
    await expectHealthy(page, "library article");
  });

  test("the pricing page states a real price rather than a placeholder", async ({ page }) => {
    await clearState(page);
    await page.goto("/pricing");
    const text = (await inspect(page)).text;
    // Dashes were deliberate while pricing was unsettled. It is settled now.
    expect(text, "pricing still shows a placeholder dash").not.toContain("$—");
    expect(text).toMatch(/\$\d/);
  });

  test("both themes are legible", async ({ page }) => {
    await clearState(page);
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((t) => {
        localStorage.setItem("hoasis-theme", JSON.stringify(t));
      }, theme);
      await page.goto("/");
      await page.waitForTimeout(300);

      // A transparent body borrows the host's ground and can render one
      // theme's text on the other theme's background.
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );
      expect(background, `${theme}: body has no background of its own`).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
      await expectHealthy(page, `landing in ${theme}`);
    }
  });
});
