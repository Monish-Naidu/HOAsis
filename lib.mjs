import { chromium } from "@playwright/test";
export const B="http://localhost:3101";
export const D="/private/tmp/claude-501/-Users-monishnaidu-Developer-HOAsis/56da55fe-282a-492d-8f5c-c8fbab7936ce/scratchpad/walk3-founder/";
export async function ctx(browser,{phone=false,dark=false}={}){
  const c=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900}});
  const p=await c.newPage(); p.logs=[];
  p.on("console",m=>{if(m.type()==="error")p.logs.push("console: "+m.text().slice(0,200)+" @"+p.url())});
  p.on("pageerror",e=>p.logs.push("pageerror: "+e.message.slice(0,200)+" @"+p.url()));
  p.on("requestfailed",r=>p.logs.push("reqfail: "+r.url()+" "+r.failure()?.errorText));
  p.on("response",r=>{if(r.status()>=400)p.logs.push("http"+r.status()+": "+r.url())});
  return p;
}
export const txt=async(p)=>(await p.locator("body").innerText());
