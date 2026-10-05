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
  // Voting lives under Meetings and the inbox under Messages since the
  // 2026-09-24 board pass; the row is what the sidebar offers.
  { name: "president", seat: SEATS.president, expects: ["Finances", "Settings", "Meetings"] },
  { name: "treasurer", seat: SEATS.treasurer, expects: ["Finances"] },
  { name: "secretary", seat: SEATS.secretary, expects: ["Meetings", "Documents", "Messages"] },
] as const;

test.describe("officers", () => {
  for (const officer of OFFICERS) {
    test(`the ${officer.name} sees a workspace they can actually use`, async ({ page }) => {
      await seedSession(page, { seat: officer.seat, view: "board" });
      await page.goto("/board");
      await expectHealthy(page, `${officer.name} dashboard`);

      const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('aside a[href^="/board"]')).map((a) =>
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
      await seedSession(page, { seat: officer.seat, view: "board" });
      await page.goto("/board");

      const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('aside a[href^="/board"]')).map((a) =>
          (a.textContent ?? "").trim().split("\n")[0],
        ),
      );

      // Offering a control that then refuses is worse than not offering it.
      for (const tab of tabs) {
        await openTab(page, "/board", tab);
        const health = await expectHealthy(page, `${officer.name} on ${tab}`);
        // The refusal itself, by its marker. This used to look for a
        // sentence the app never prints, so it could not fail.
        expect(
          await page.getByTestId("board-refusal").count(),
          `${officer.name} was offered ${tab} and then told they cannot open it`,
        ).toBe(0);
      }
    });
  }

  test("a resident is offered no board navigation", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "board" });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside a[href^="/board"]')).map((a) =>
        (a.textContent ?? "").trim().split("\n")[0],
      ),
    );
    // The dashboard itself is not a capability, but nothing that manages money
    // or settings should be on offer.
    const forbidden = tabs.filter((t) =>
      ["Finances", "Settings", "Vendors", "Reserve", "Homeowners"].some((f) => t.startsWith(f)),
    );
    expect(forbidden, "a resident is being offered board tools").toEqual([]);
  });

  test("a resident who types an admin URL is told, not shown", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "board" });

    for (const path of ["/board/money", "/board/settings", "/board/vendors"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const health = await inspect(page);

      expect(health.crashed, `${path} crashed for a resident`).toBe(false);

      // A resident in the board view is sent to their own home screen, which
      // shows their own balance. That is theirs to see; what matters is that
      // the board page did not render, so the figures are checked only if
      // the browser is still on it.
      const landed = new URL(page.url()).pathname;
      if (!landed.startsWith("/board")) {
        // Sent home is the right answer. Sent to sign in would mean the
        // session never took, and the test would be passing on nothing.
        expect(landed, `${path} sent a resident somewhere other than their own home`).toBe("/resident");
        continue;
      }

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

  // Rows a module can switch off for everyone. Only these may be absent;
  // the rest are on every resident's rail, and a missing one is a failure.
  const MODULE_GATED = new Set(["Community", "Meetings", "Association funds"]);

  for (const tab of RESIDENT_TABS) {
    test(`${tab} works`, async ({ page }) => {
      await page.goto("/resident");
      await page.waitForLoadState("networkidle");

      // A row with something waiting carries its count inside the link, so
      // "Payments" reads "Payments1". Anchoring on the bare label skipped
      // exactly the rows a resident with a balance most needs to work.
      const present = await page
        .locator(`a[href^="/resident"]`)
        .filter({ hasText: new RegExp(`^${tab}\\d*$`) })
        .locator("visible=true")
        .count();
      if (MODULE_GATED.has(tab)) {
        test.skip(present === 0, `${tab} is switched off for this association`);
      } else {
        expect(present, `${tab} is missing from the resident rail`).toBeGreaterThan(0);
      }

      await openTab(page, "/resident", tab);
      await expectHealthy(page, `resident ${tab}`);
    });
  }

  // Not rows on the rail: each lives under another row as a section tab, so
  // they are opened by address.
  for (const [name, path] of [
    ["Voting", "/resident/vote"],
    ["Account", "/resident/account"],
  ] as const) {
    test(`${name} works`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(new URL(page.url()).pathname, `${name} did not open`).toBe(path);
      await expectHealthy(page, `resident ${name}`);
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

test.describe("booking an amenity", () => {
  test("a resident is offered only the slots the board allows", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/requests/new");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Booking|Reserve/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByLabel("Amenity").selectOption({ label: "Clubhouse" });
    await page.waitForTimeout(500);

    const health = await inspect(page);
    expect(health.crashed, "the slot picker crashed").toBe(false);
    // The rules are stated in words a resident can read, not as fields.
    expect(health.text, "the rules are not stated").toMatch(/at a time|once a day|ahead/);
    // And real times are offered.
    expect(health.text).toMatch(/\d+ (AM|PM)/);
  });

  test("a slot somebody else holds cannot be taken", async ({ page }) => {
    await seedSession(page, { seat: SEATS.resident, view: "resident" });
    await page.goto("/resident/requests/new");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Booking|Reserve/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByLabel("Amenity").selectOption({ label: "Clubhouse" });
    await page.waitForTimeout(500);

    // Every offered time is a button; a taken one is disabled rather than
    // absent, so the resident can see it exists and pick another day.
    const disabled = await page.locator("button[disabled]").count();
    expect(disabled, "nothing was ever unavailable, so the rules do nothing").toBeGreaterThan(0);
  });
});

test.describe("the board sets the rules", () => {
  test("booking rules are readable without opening anything", async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
    await page.goto("/board/settings");
    await page.waitForLoadState("networkidle");

    const health = await inspect(page);
    expect(health.crashed).toBe(false);
    // A board should be able to check what they set at a glance.
    expect(health.text, "the rules are hidden behind a panel").toMatch(
      /at a time|once a day|days ahead/,
    );

    await page.getByRole("button", { name: "Booking rules" }).first().click();
    await page.waitForTimeout(400);
    const opened = await inspect(page);
    expect(opened.text, "the controls never appeared").toContain("How long is one booking");
    expect(opened.text, "the per home cap is missing").toContain("Bookings per home, per day");
  });
});
