import { test, expect } from "@playwright/test";
import { inspect } from "./helpers";

/**
 * The library exists to be trusted, not just read.
 *
 * Free legal orientation without citations is a liability: a board acts on a
 * deadline that moved two sessions ago and nobody can say where the number came
 * from. So the tests here are mostly about provenance.
 */

test("a state guide cites where every number came from", async ({ page }) => {
  await page.goto("/library/washington-hoa-law");
  await page.waitForLoadState("networkidle");

  const health = await inspect(page);
  expect(health.crashed, "the Washington guide crashed").toBe(false);
  expect(health.text, "no citations section").toContain("Where this comes from");
  expect(health.text, "citations carry no read date").toMatch(/read \w+ \d+, \d{4}/);

  const primary = await page.locator('a[href*="app.leg.wa.gov"], a[href*="leg.wa.gov"]').count();
  expect(primary, "the Washington guide cites no Washington legislature page").toBeGreaterThan(0);
});

test("every state has a guide, and picking one filters to it", async ({ page }) => {
  await page.goto("/library");
  await page.waitForLoadState("networkidle");
  const health = await inspect(page);
  expect(health.crashed).toBe(false);

  for (const state of ["Nevada", "Virginia", "Illinois", "Utah"]) {
    expect(health.text, `${state} is missing from the library`).toContain(state);
  }
});

test("a superseded article redirects rather than 404s", async ({ page }) => {
  // The old Florida piece quoted the 150 parcel website threshold, which is the
  // condominium number, not the HOA one. A bookmark should land on the fix.
  await page.goto("/library/florida-2026-website-rule");
  await page.waitForLoadState("networkidle");

  expect(page.url(), "the old slug did not redirect").toContain("florida-hoa-law");
  const health = await inspect(page);
  expect(health.crashed).toBe(false);
  expect(health.text).not.toContain("150 parcels");
});

test("a state article says plainly that it is not legal advice", async ({ page }) => {
  await page.goto("/library/california-hoa-law");
  await page.waitForLoadState("networkidle");

  const health = await inspect(page);
  expect(health.text, "no disclaimer on a state specific page").toContain(
    "This one is state specific",
  );
});
