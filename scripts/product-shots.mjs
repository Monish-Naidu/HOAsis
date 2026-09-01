/**
 * Screenshots of the real product, for the marketing page.
 *
 * Taken from the running app rather than drawn, so the page cannot show
 * something the product does not do. Re-run after a design change; the old
 * shots are the ones that quietly start lying.
 *
 * Capture width matters more than it looks. These are displayed at about
 * 1112px, so a 1400px capture is downscaled to 79% and 15px body text lands
 * near 12px, which is where a screenshot stops being readable and starts
 * saying "this product is cluttered". Capturing near the display width keeps
 * the type close to its native size.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "public/marketing";
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  {
    file: "product-dashboard.png",
    path: "/board",
    seat: { accountId: "acct-arya", view: "board" },
    width: 1180,
    height: 900,
    // Skip the community banner so the frame is the working area. The clip
    // matches the monitor artwork's screen, which is 1.91:1, so the capture
    // lands on it without cropping.
    clipFrom: "main",
    clipHeight: 618,
  },
  {
    file: "product-money.png",
    path: "/board/money",
    seat: { accountId: "acct-arya", view: "board" },
    width: 1180,
    height: 950,
    clipFrom: "main",
    clipHeight: 680,
  },
  {
    file: "product-reserves.png",
    path: "/board/reserves",
    seat: { accountId: "acct-arya", view: "board" },
    width: 1180,
    height: 950,
    clipFrom: "main",
    clipHeight: 680,
  },
  {
    file: "product-resident.png",
    path: "/resident",
    seat: { accountId: "acct-monish", view: "resident" },
    width: 430,
    // The phone artwork's screen quad is 430x1030; capturing at that shape
    // means the projective overlay neither crops nor stretches.
    height: 1030,
    mode: "app",
  },
];

const browser = await chromium.launch();

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();

  // Seed the demo session before anything renders, so the app comes up signed
  // in rather than bouncing to the front door.
  await page.addInitScript(
    ({ seat, mode }) => {
      localStorage.setItem("hoasis-session", JSON.stringify(seat));
      // The setup checklist is onboarding scaffolding. A marketing shot should
      // show the product doing its job, not a new customer's to-do list, so
      // every task is marked skipped before the page renders.
      localStorage.setItem(
        "hoasis:mehr-meadows:setup-skipped",
        JSON.stringify([
          "roster", "bank", "invites", "documents", "budget", "board",
          "insurance", "reserves", "vendors", "amenities", "photo",
        ]),
      );
      localStorage.setItem("hoasis-community", JSON.stringify("mehr-meadows"));
      // Raw, not JSON: the theme script compares the stored string directly.
      localStorage.setItem("hoasis-theme", "light");
      if (mode) localStorage.setItem("hoasis-resident-mode", JSON.stringify(mode));
    },
    { seat: shot.seat, mode: shot.mode },
  );

  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  if (shot.clipFrom) {
    const box = await page.locator(shot.clipFrom).boundingBox();
    await page.screenshot({
      path: `${OUT}/${shot.file}`,
      clip: {
        x: 0,
        y: Math.max(0, box.y - 8),
        width: shot.width,
        height: Math.min(shot.clipHeight, shot.height - Math.max(0, box.y - 8)),
      },
    });
  } else {
    await page.screenshot({ path: `${OUT}/${shot.file}` });
  }

  console.log(`${shot.file}`);
  await context.close();
}

await browser.close();
