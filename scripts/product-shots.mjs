/**
 * Screenshots of the real product, for the marketing page.
 *
 * Taken from the running app rather than drawn, so the page cannot show
 * something the product does not do. Re-run after a design change; the old
 * shots are the ones that quietly start lying.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "public/marketing";
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  {
    file: "product-dashboard.png",
    path: "/admin",
    seat: { accountId: "acct-arya", view: "admin" },
    width: 1400,
    height: 900,
    // Skip the community banner so the frame is the working area.
    clipFrom: "main",
    clipHeight: 620,
  },
  {
    file: "product-money.png",
    path: "/admin/money",
    seat: { accountId: "acct-arya", view: "admin" },
    width: 1400,
    height: 950,
    clipFrom: "main",
    clipHeight: 640,
  },
  {
    file: "product-reserves.png",
    path: "/admin/reserves",
    seat: { accountId: "acct-arya", view: "admin" },
    width: 1400,
    height: 950,
    clipFrom: "main",
    clipHeight: 640,
  },
  {
    file: "product-resident.png",
    path: "/resident",
    seat: { accountId: "acct-monish", view: "resident" },
    width: 430,
    height: 880,
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
      localStorage.setItem("hoasis-community", JSON.stringify("mehr-meadows"));
      localStorage.setItem("hoasis-theme", JSON.stringify("light"));
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
