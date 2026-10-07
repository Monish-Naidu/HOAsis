import {chromium} from "@playwright/test";import {ctx,B,D,txt} from "./lib.mjs";
const b=await chromium.launch();const p=await ctx(b);
await p.goto(B+"/");await p.waitForLoadState("networkidle");
console.log((await txt(p)).slice(0,1500));
await p.screenshot({path:D+"home.png"});
const links=await p.locator("a,button").evaluateAll(e=>e.map(x=>(x.textContent||"").trim().slice(0,40)+" -> "+(x.getAttribute("href")||"")));
console.log(links.join("\n"));
console.log(p.logs);
await b.close();
