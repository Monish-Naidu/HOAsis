import { test, expect } from "@playwright/test";
import { RESIDENT_TABS, SEATS, expectHealthy, inspect, openTab, seedSession } from "./helpers";

/**
 * Who can see and do what.
 *
 * Capability checks in this prototype hide and lock the interface; the server
 * side rules are tested separately against Postgres. What matters here is that
 * a treasurer is not offered a control they will be refused, and that a
 * resident is never shown a neighbour's money.
 */

/** Which capabilities each seeded officer holds, per the fixtures. */
const OFFICERS = [
  { name: "president", seat: SEATS.president, expects: ["Money", "Settings", "Voting"] },
  { name: "treasurer", seat: SEATS.treasurer, expects: ["Money"] },
  { name: "secretary", seat: SEATS.secretary, expects: ["Voting", "Documents", "Communications"] },
] as const;

test.describe("officers", () => {
  for (const officer of OFFICERS) {
    test(`the ${officer.name} sees a workspace they can actually use`, async ({ page }) => {
      await seedSession(page, { seat: officer.seat, view: "admin" });
      await page.goto("/admin");
      await expectHealthy(page, `${officer.name} dashboard`);

      const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('aside a[href^="/admin"]')).map((a) =>
          (a.textContent ?? "").trim().split("\n")[0],
        ),
      );
      expect(tabs.length, `${officer.name} has no navigation at all`).toBeGreaterThan(0);

      for (const expected of officer.expects) {
        expect(
          tabs.some((t) => t.startsWith(expected)),
          `${officer.name} cannot reach ${expected}, which their role needs`,
        ).toBe(true);
      }
    });

    test(`every tab the ${officer.name} is offered actually opens`, async ({ page }) => {
      await seedSession(page, { seat: officer.seat, view: "admin" });
      await page.goto("/admin");

      const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('aside a[href^="/admin"]')).map((a) =>
          (a.textContent ?? "").trim().split("\n")[0],
        ),
      );

      // Offering a control that then refuses is worse than not offering it.
      for (const tab of tabs) {
        await openTab(page, "/admin", tab);
        const health = await expectHealthy(page, `${officer.name} on ${tab}`);
        expect(
          health.text,
          `${officer.name} was offered ${tab} and then told they cannot use it`,
        ).not.toContain("You do not have the");
      }
    });
  }

  test("a resident is offered no board navigation", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "admin" });
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside a[href^="/admin"]')).map((a) =>
        (a.textContent ?? "").trim().split("\n")[0],
      ),
    );
    // The dashboard itself is not a capability, but nothing that manages money
    // or settings should be on offer.
    const forbidden = tabs.filter((t) =>
      ["Money", "Settings", "Vendors", "Reserves", "Homeowners"].some((f) => t.startsWith(f)),
    );
    expect(forbidden, "a resident is being offered board tools").toEqual([]);
  });

  test("a resident who types an admin URL is told, not shown", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "admin" });

    for (const path of ["/admin/money", "/admin/settings", "/admin/vendors"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const health = await inspect(page);

      expect(health.crashed, `${path} crashed for a resident`).toBe(false);

      // Assert the property rather than the wording, so rephrasing the refusal
      // does not silently turn this test off: whatever it says, the board's
      // figures must not be on the page.
      expect(
        health.text,
        `${path} showed an association figure to a resident`,
      ).not.toMatch(/\$[\d,]{3,}/);
      for (const leak of ["Operating cash", "Reserves", "Past due", "Needs your review"]) {
        expect(health.text, `${path} leaked "${leak}" to a resident`).not.toContain(leak);
      }
    }
  });
});

test.describe("resident experience", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
  });

  for (const tab of RESIDENT_TABS) {
    test(`${tab} works`, async ({ page }) => {
      await page.goto("/resident");
      await page.waitForLoadState("networkidle");

      const present = await page
        .locator(`a[href^="/resident"]`)
        .filter({ hasText: new RegExp(`^${tab}$`) })
        .locator("visible=true")
        .count();
      test.skip(present === 0, `${tab} is switched off for this association`);

      await openTab(page, "/resident", tab);
      await expectHealthy(page, `resident ${tab}`);
    });
  }

  test("a resident sees their own balance and never a neighbour's", async ({ page }) => {
    await page.goto("/resident/account");
    await page.waitForLoadState("networkidle");
    const mine = (await inspect(page)).text;

    expect(mine, "no unit on the account page").toMatch(/Unit \d+/);
    const myUnit = mine.match(/Unit (\d+)/)![1];

    // The other seeded households by name. None should appear on a personal
    // statement.
    for (const neighbour of ["Rhea Calloway", "Gwen Halloran", "Owen Brady"]) {
      expect(mine, `a neighbour appears on a personal statement`).not.toContain(neighbour);
    }

    await seedSession(page, { seat: SEATS.otherResident, view: "resident" });
    await page.goto("/resident/account");
    await page.waitForLoadState("networkidle");
    const theirs = (await inspect(page)).text;
    const theirUnit = theirs.match(/Unit (\d+)/)?.[1];

    expect(theirUnit, "two residents saw the same unit").not.toBe(myUnit);
  });

  test("the tab bar stays under the reader's thumb on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto("/resident/forum");
    await page.waitForLoadState("networkidle");

    const bar = page.locator('nav[aria-label="Resident sections"]').last();
    const before = await bar.boundingBox();
    test.skip(!before, "no tab bar at this width");

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(400);
    const after = await bar.boundingBox();

    expect(
      Math.abs(after!.y + after!.height - 760),
      "the tab bar rode away with the content instead of staying pinned",
    ).toBeLessThan(3);
  });
});
