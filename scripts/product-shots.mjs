/**
 * Screenshots of the real product, for the marketing page.
 *
 * Taken from the running app rather than drawn, so the page cannot show
 * something the product does not do. Re-run after a design change; the old
 * shots are the ones that quietly start lying.
 *
 * Every shot is taken twice, light and dark, at 2x. The front page swaps
 * them with the theme (`dark:hidden` / `dark:block`), so a visitor in dark
 * mode sees the product in dark mode.
 *
 * Capture width matters more than it looks. The dashboard is displayed at
 * up to 1112px in a browser frame, so a 1280px capture lands at 87% and the
 * type stays close to its native size. Wider, and 15px body text drops
 * toward 12px, which is where a screenshot stops being readable and starts
 * saying "this product is cluttered".
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "public/marketing";
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  {
    // The top of the board's home, rail and all, at 16:10: what a board
    // member sees when they open the product. The front page's frame is
    // sized to this shape (2560 x 1600 at 2x).
    name: "product-dashboard",
    path: "/board",
    seat: { accountId: "acct-arya", view: "board" },
    width: 1280,
    height: 800,
  },
  {
    name: "product-resident",
    path: "/resident",
    seat: { accountId: "acct-monish", view: "resident" },
    width: 430,
    // The phone artwork's screen quad is 430x1030; capturing at that shape
    // means the projective overlay neither crops nor stretches.
    height: 1030,
    mode: "app",
  },
];

const THEMES = ["light", "dark"];

const browser = await chromium.launch();

for (const shot of SHOTS) {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      colorScheme: theme,
      // The stagger and count-up animations land on their end state, so
      // the capture never catches a row halfway in.
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    // Seed the demo session before anything renders, so the app comes up
    // signed in rather than bouncing to the front door.
    await page.addInitScript(
      ({ seat, mode, theme }) => {
        localStorage.setItem("hoasis-session", JSON.stringify(seat));
        // The setup checklist is onboarding scaffolding. A marketing shot
        // should show the product doing its job, not a new customer's to-do
        // list, so every task is marked skipped before the page renders.
        localStorage.setItem(
          "hoasis:mehr-meadows:setup-skipped",
          JSON.stringify([
            "roster", "bank", "invites", "documents", "budget", "board",
            "insurance", "reserves", "vendors", "amenities", "photo",
          ]),
        );
        localStorage.setItem("hoasis-community", JSON.stringify("mehr-meadows"));
        // Raw, not JSON: the theme script compares the stored string directly.
        localStorage.setItem("hoasis-theme", theme);
        if (mode) localStorage.setItem("hoasis-resident-mode", JSON.stringify(mode));
      },
      { seat: shot.seat, mode: shot.mode, theme },
    );

    await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // The dev-server overlay badge is not part of the product.
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());

    const file = `${shot.name}${theme === "dark" ? "-dark" : ""}.png`;
    await page.screenshot({ path: `${OUT}/${file}` });
    console.log(file);
    await context.close();
  }
}

await browser.close();
