import { expect, type Page } from "@playwright/test";

/**
 * Shared machinery for the end to end suite.
 *
 * Two ideas run through all of it.
 *
 * Sessions are seeded before the first paint rather than clicked through, so a
 * test about the Vendors tab is not also a test of the sign in form. The one
 * suite that does test sign in does it by clicking.
 *
 * And "does the page work" is asserted mechanically rather than by eyeballing
 * a screenshot: no error boundary, no NaN, no dead button, no unlabeled
 * control. A page that renders is not the same as a page that works, and the
 * difference is where the bugs were.
 */

/** Seats as the fixtures actually define them, checked against accounts.ts. */
/**
 * Seats, by community.
 *
 * An account id only exists inside its own association, so seeding Mehr
 * Meadows' President against another community produces no session at all and
 * the app falls back to the sign in page. A test that then asserts "the tab is
 * absent" passes for the wrong reason, which is exactly what happened once.
 */
export const TC1_SEATS = {
  president: "tc1-acct-priya",
  treasurer: "tc1-acct-grant",
} as const;

export const SEATS = {
  president: "acct-arya",
  treasurer: "acct-dana",
  secretary: "acct-sofia",
  vicePresident: "acct-ellis",
  resident: "acct-monish",
  otherResident: "acct-nina",
} as const;

export type SeatName = keyof typeof SEATS;

/** Puts a demo session in place before the app boots. */
export async function seedSession(
  page: Page,
  options: {
    seat?: string;
    view?: "board" | "resident";
    community?: string;
    residentMode?: "website" | "app";
    theme?: "light" | "dark";
  } = {},
) {
  const {
    seat = SEATS.president,
    view = "board",
    community = "mehr-meadows",
    residentMode,
    theme = "light",
  } = options;

  await page.addInitScript(
    ({ seat, view, community, residentMode, theme }) => {
      localStorage.setItem("hoasis-session", JSON.stringify({ accountId: seat, view }));
      localStorage.setItem("hoasis-community", JSON.stringify(community));
      // Raw, not JSON: the theme script compares the stored string directly.
      localStorage.setItem("hoasis-theme", theme);
      if (residentMode) {
        localStorage.setItem("hoasis-resident-mode", JSON.stringify(residentMode));
      }
      // Any real session would take precedence over the demo, so clear it.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sb-")) localStorage.removeItem(key);
      }
    },
    { seat, view, community, residentMode, theme },
  );
}

/** Starts from a clean slate, so one test's writes never reach the next. */
export async function clearState(page: Page) {
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("hoasis") || key.startsWith("sb-")) localStorage.removeItem(key);
    }
  });
}

/**
 * Waits until React has attached its handlers.
 *
 * Every page here is server rendered, so the buttons exist in the HTML a beat
 * before they do anything. Inspecting in that window reports every control as
 * dead, which is true and useless: it is a race in the test rather than a bug
 * in the app. Learned this the hard way.
 */
export async function waitForHydration(page: Page) {
  await page.waitForLoadState("networkidle");
  await page
    .waitForFunction(
      () => {
        const target =
          document.querySelector("main button") ?? document.querySelector("main a");
        if (!target) return true; // A page with no controls is hydrated enough.
        return Object.keys(target).some((k) => k.startsWith("__reactProps$"));
      },
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {
      // A page that never hydrates is a real failure, but the assertions below
      // describe it better than a timeout does.
    });
}

export interface PageHealth {
  crashed: boolean;
  badValues: string[];
  deadButtons: string[];
  unlabeled: number;
  headingCount: number;
  text: string;
}

/**
 * What "this page works" means, checked in the browser.
 *
 * A dead button is one React has no handler for and which is not a submit or a
 * label proxy. Those were a real category of bug here, not a hypothetical.
 */
export async function inspect(page: Page): Promise<PageHealth> {
  await waitForHydration(page);
  return page.evaluate(() => {
    const body = document.body.innerText;
    const crashed =
      body.includes("This page did not load") || body.includes("The app failed");

    const main = document.querySelector("main");
    const text = main?.innerText ?? body;

    const badValues: string[] = [];
    const bad = text.match(/.{0,40}(NaN|Infinity|\[object |Invalid Date|undefined).{0,30}/);
    if (bad) badValues.push(bad[0].replace(/\n+/g, " ").trim());
    const singular = text.match(
      /\b1 (transactions|requests|ballots|accounts|documents|homes|posts|meetings|charges|units|owners|vendors|items|emails|replies|minutes|households|payments)\b/,
    );
    if (singular) badValues.push(`grammar: "${singular[0]}"`);
    const negative = text.match(/in -\d+ days/);
    if (negative) badValues.push(`negative relative date: "${negative[0]}"`);

    const deadButtons: string[] = [];
    let unlabeled = 0;
    for (const el of Array.from(main?.querySelectorAll("button") ?? [])) {
      const name =
        (el.textContent ?? "").trim() ||
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        "";
      if (!name) unlabeled++;

      const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
      const props = key ? (el as unknown as Record<string, { onClick?: unknown; onChange?: unknown }>)[key] : null;
      const wired =
        Boolean(props?.onClick) ||
        Boolean(props?.onChange) ||
        (el as HTMLButtonElement).type === "submit" ||
        Boolean(el.closest("label"));
      if (!wired) deadButtons.push(name.slice(0, 40) || "(unnamed)");
    }

    return {
      crashed,
      badValues,
      deadButtons,
      unlabeled,
      headingCount: main?.querySelectorAll("h1, h2, h3").length ?? 0,
      text,
    };
  });
}

/** Asserts a page is healthy, naming what failed rather than just failing. */
export async function expectHealthy(page: Page, label: string) {
  const health = await inspect(page);
  expect(health.crashed, `${label}: the page crashed into the error boundary`).toBe(false);
  expect(health.badValues, `${label}: bad values on screen`).toEqual([]);
  expect(health.deadButtons, `${label}: buttons with no handler`).toEqual([]);
  expect(health.unlabeled, `${label}: buttons a screen reader cannot name`).toBe(0);
  return health;
}

/**
 * The sidebar, as a board sees it.
 *
 * Nine rows since the 2026-09-24 board pass. Reserves, Notices, Community,
 * Voting and Announcements lost their own lines and live as tabs inside a
 * row (`BOARD_SECTION_TABS`); they keep their routes and their capability
 * gate, which `03-roles` covers.
 */
export const ADMIN_TABS = [
  "Dashboard",
  "Finances",
  "Homeowners",
  "Vendors",
  "Requests",
  "Messages",
  "Meetings",
  "Documents",
  "Settings",
] as const;

/** The pages folded under a sidebar row, as the tabs along its top. */
export const BOARD_SECTION_TABS: Record<string, { row: string; tabs: string[] }> = {
  "/board/money": { row: "Finances", tabs: ["Overview", "Transactions", "Past due", "Reserves"] },
  "/board/requests": { row: "Requests", tabs: ["Requests", "Notices"] },
  "/board/communications": { row: "Messages", tabs: ["Inbox", "Announcements", "Community"] },
  "/board/meetings": { row: "Meetings", tabs: ["Meetings", "Voting"] },
};

/**
 * The resident rail, in order. One list for the rail, the phone bar and More
 * (`resident-nav.tsx`); the bar shortens Documents to Docs.
 */
export const RESIDENT_TABS = [
  "Home",
  "Pay",
  "Requests",
  "Documents",
  "Meetings",
  "Community",
  "Association funds",
  "Settings",
] as const;

/**
 * Clicks a nav item by its visible label.
 *
 * The nav is rendered twice, as a sidebar above the large breakpoint and as a
 * horizontal strip below it. Both are in the DOM at all times and one is
 * hidden by CSS, so taking the first match lands on an element that cannot be
 * clicked and waits out the timeout. Visibility is the filter that matters.
 */
export async function openTab(page: Page, prefix: string, label: string) {
  const link = page
    .locator(`a[href^="${prefix}"]`)
    .filter({ hasText: new RegExp(`^${label}`) })
    .locator("visible=true")
    .first();
  await link.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}
