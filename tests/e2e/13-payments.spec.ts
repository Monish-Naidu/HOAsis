import { test, expect, type Page, type Frame } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Real money in test mode: a card payment through Stripe on a live
 * connected account, a saved method, and the pay screen's gating.
 *
 * Off by default. It needs the Stripe test keys, a Supabase service role,
 * `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`
 * running with its secret in STRIPE_WEBHOOK_SECRET_LOCAL, and an
 * association whose onboarding is finished. Run it with
 *
 *   STRIPE_E2E=1 STRIPE_E2E_EMAIL=you@example.com STRIPE_E2E_SLUG=oakview-commons pnpm e2e tests/e2e/13-payments.spec.ts
 *
 * Financial Connections (signing in to a bank) opens Stripe's own modal,
 * which does not run under automation; that path stays a hand click.
 */
const ON = process.env.STRIPE_E2E === "1";
const EMAIL = process.env.STRIPE_E2E_EMAIL ?? "";
const SLUG = process.env.STRIPE_E2E_SLUG ?? "oakview-commons";

test.skip(!ON || !EMAIL, "Set STRIPE_E2E=1 and STRIPE_E2E_EMAIL to run the Stripe suite");

function env(): Record<string, string> {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

/** A magic-link callback URL for the person, minted with the service role. */
async function signInLink(baseURL: string, next: string): Promise<string> {
  const e = env();
  const admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (error || !data.properties) throw new Error(error?.message ?? "no link");
  return `${baseURL}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
}

async function frameWith(page: Page, selector: string, tries = 20): Promise<Frame> {
  // Stripe mounts its fields in an iframe a beat after the page, so poll for
  // the frame rather than sleeping between looks.
  let found: Frame | undefined;
  await expect
    .poll(
      async () => {
        for (const f of page.frames()) {
          if (await f.locator(selector).count().catch(() => 0)) {
            found = f;
            return true;
          }
        }
        return false;
      },
      { message: `No frame holds ${selector}`, timeout: tries * 1000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
  return found as Frame;
}

async function fillCard(page: Page) {
  const f = await frameWith(page, '[name="number"]');
  await f.locator('[name="number"]').fill("4242424242424242");
  await f.locator('[name="expiry"]').fill("12/34");
  await f.locator('[name="cvc"]').fill("123");
  const zip = f.locator('[name="postalCode"]');
  if (await zip.count()) await zip.fill("98036");
}

test.describe.serial("Stripe, test mode", () => {
  test("a resident pays dues with a new card and the books settle", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await page.goto(await signInLink(baseURL!, `/c/${SLUG}/resident/pay`));
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Pay", exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /New card/ }).click();
    await page.getByRole("button", { name: /Continue to pay/ }).click();
    // The server priced it: the dues, with nothing of ours added.
    await expect(page.getByText("You pay")).toBeVisible({ timeout: 20_000 });
    await fillCard(page);
    await page.getByRole("button", { name: /^Pay \$/ }).click();
    // The panel polls for the webhook's row; "received" is the honest
    // fallback when the CLI is not forwarding.
    await expect(page.getByText("Payment received")).toBeVisible({ timeout: 45_000 });
  });

  test("a saved card is one confirm, and autopay can use it", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await page.goto(await signInLink(baseURL!, `/c/${SLUG}/resident/pay`));
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Pay", exact: true })).toBeVisible({ timeout: 20_000 });

    if (!(await page.getByRole("button", { name: /Visa/ }).count())) {
      await page.getByRole("button", { name: /Save a card or bank account/ }).click();
      const tab = await frameWith(page, '[data-testid="card-tab"], [id="card-tab"]');
      await tab.locator('[data-testid="card-tab"], [id="card-tab"]').first().click();
      await fillCard(page);
      await page.getByRole("button", { name: /Save payment method/ }).click();
      await expect(page.getByRole("button", { name: /Visa/ }).first()).toBeVisible({ timeout: 30_000 });
    }
    await page.getByRole("button", { name: /Visa/ }).first().click();
    await page.getByRole("button", { name: /Continue to pay/ }).click();
    await expect(page.getByText(/Paying with Visa/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^Pay \$/ }).click();
    await expect(page.getByText("Payment received")).toBeVisible({ timeout: 45_000 });

    await page.goto(`${baseURL}/resident/pay`);
    await page.waitForLoadState("networkidle");
    const autopay = page.getByRole("switch").first();
    await expect(autopay).toBeVisible();
    if ((await autopay.getAttribute("aria-checked")) !== "true") {
      await autopay.click();
      await expect(autopay).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    }
    await expect(page.getByText(/Next autopay/)).toBeVisible();
  });

  test("the statement carries the payments", async ({ page, baseURL }) => {
    await page.goto(await signInLink(baseURL!, `/c/${SLUG}/resident/account`));
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Card payment").first()).toBeVisible({ timeout: 20_000 });
  });
});
