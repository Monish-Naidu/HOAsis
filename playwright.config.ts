import { defineConfig, devices } from "@playwright/test";

/**
 * End to end tests against a running app.
 *
 * Deliberately not started by Playwright: the dev server is usually already
 * running while somebody works, and letting the config own it means a failing
 * suite kills the server somebody was using. `pnpm e2e` assumes localhost:3000
 * and says so when it is not there.
 */

/**
 * 1440x900: the size the board screens were reviewed at, and the height the
 * sticky sidebar check in `02-board` measures against.
 */
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * Parallel across files, serial inside one.
   *
   * The suite ran on a single worker and took five minutes, which made every
   * change to a screen a five minute wait. Nothing actually forced that: each
   * test gets its own browser context and seeds its own localStorage, and the
   * server holds no per-session state. What does matter is order inside a
   * file, because several specs build an association in one test and read it
   * back in the next, so `fullyParallel` stays off.
   */
  fullyParallel: false,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE ?? "http://localhost:3000",
    trace: "retain-on-failure",
    colorScheme: "light",
    viewport: DESKTOP_VIEWPORT,
  },
  /**
   * The preset carries its own 1280x720 viewport and a project's `use` beats
   * the one above, so every test ran at 1280 while this file asked for 1440.
   * The spread is still what we want for the preset's other traits (desktop
   * user agent, no touch); the viewport is repeated after it so the two
   * cannot disagree.
   *
   * A test that needs a phone sets its own size and wins over this
   * (`03-roles`, the resident tab bar at 390).
   */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP_VIEWPORT },
    },
  ],
});
