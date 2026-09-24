import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url),"utf8").split("\n").filter(l=>l&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const OUT = process.env.OUT; mkdirSync(OUT,{recursive:true});
const BASE = "http://localhost:3000";
const MM = "7426f650-4ef0-4a4c-99e9-35ac859196c4";
const BOARD = ["/board","/board/money","/board/money/transactions","/board/money/collections","/board/reserves","/board/homeowners","/board/vendors","/board/requests","/board/violations","/board/communications","/board/meetings","/board/voting","/board/documents","/board/settings","/board/forum"];
const RES = ["/resident","/resident/pay","/resident/requests","/resident/requests/new","/resident/messages","/resident/documents","/resident/forum","/resident/calendar","/resident/vote","/resident/finances","/resident/account"];
const who = process.argv[2];
const P = { president:"monishnaidu18@gmail.com", vp:"monishnaidu18+mm-arya@gmail.com", treasurer:"monishnaidu18+mm-dana@gmail.com", secretary:"monishnaidu18+mm-sofia@gmail.com", owen:"monishnaidu18+mm-owen@gmail.com" };
const browser = await chromium.launch();
const results = [];
async function ctxFor(viewport) {
  const ctx = await browser.newContext({ viewport, colorScheme: "light" });
  await ctx.addInitScript((id) => { try { localStorage.setItem("hoasis:last-association", id); localStorage.setItem("hoasis-theme", "light"); } catch {} }, MM);
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: P[who] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`, { waitUntil: "networkidle", timeout: 90000 });
  return page;
}
async function visit(page, path, tag) {
  const errs = [];
  const onC = m => { if (m.type()==="error") errs.push(m.text().slice(0,200)); };
  const onE = e => errs.push("PAGEERR " + String(e).slice(0,200));
  const onR = async r => { if (r.status() >= 400 && r.url().includes("supabase")) errs.push(`${r.status()} ${r.url().split("?")[0].slice(-60)} ${(await r.text().catch(()=>"")).slice(0,120)}`); };
  page.on("console", onC); page.on("pageerror", onE); page.on("response", onR);
  try { await page.goto(BASE+path, { waitUntil: "networkidle", timeout: 90000 }); } catch {}
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({ h1: [...document.querySelectorAll("h1")].map(h=>h.innerText.trim()).join(" | "), overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, text: (document.querySelector("main")?.innerText ?? document.body.innerText).slice(0, 1500) }));
  page.off("console", onC); page.off("pageerror", onE); page.off("response", onR);
  const file = `${tag}${path.replaceAll("/","_")}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  results.push({ who, tag, path, errs, ...info, file });
}
const isBoard = who !== "owen";
const d = await ctxFor({ width: 1440, height: 900 });
for (const p of (isBoard ? BOARD : RES)) await visit(d, p, `${who}-desk`);
if (!isBoard || who === "president") {
  const m = await ctxFor({ width: 390, height: 844 });
  for (const p of (isBoard ? ["/board","/board/settings"] : RES)) await visit(m, p, `${who}-phone`);
}
writeFileSync(`${OUT}/${who}.json`, JSON.stringify(results, null, 1));
await browser.close();
console.log("done", who);
