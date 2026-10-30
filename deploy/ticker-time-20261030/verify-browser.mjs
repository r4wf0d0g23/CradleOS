import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.EVENT_QA_BASE||'http://127.0.0.1:5363',label=process.env.EVENT_QA_LABEL||'preview';
assert.ok(['preview','live'].includes(label));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(40000);
const checks=[],errors=[];let mode='live',writes=0;
await context.route('https://**/*',async route=>{
 const req=route.request(),url=req.url();
 if(/ExecuteTransaction|SubmitTransaction/.test(url)){writes++;return route.abort();}
 try{
  const r=await fetch(url,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)});
  const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];
  let body=Buffer.from(await r.arrayBuffer());
  if(mode==='old'&&req.postData()?.includes('query ChainEventLog')){
   const data=JSON.parse(body.toString());
   for(const n of data.data?.events?.nodes??[]){n.timestamp=new Date(Date.now()-3600000).toISOString();if(n.contents?.json?.kill_timestamp)n.contents.json.kill_timestamp=String(Math.floor((Date.now()-7200000)/1000));}
   body=Buffer.from(JSON.stringify(data));
  }
  await route.fulfill({status:r.status,headers,body});
 }catch{await route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const log=page.locator('.chain-log'),group=page.locator('.chain-ticker-group').first();
const ready=async()=>{await log.getByRole('button',{name:'Refresh latest',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.chain-log header button')?.disabled);};
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.chain-ticker-open').click();await ready();
 const records=await group.locator('button').evaluateAll(ns=>ns.map(n=>({id:n.dataset.eventId,time:Date.parse(n.querySelector('time').dateTime)})));
 assert.ok(records.length>0&&records.length<=8);const now=Date.now();
 assert.ok(records.every((r,i)=>r.time<=now&&now-r.time<900000&&(!i||r.time>=records[i-1].time)));
 const copy=await page.locator('.chain-ticker-copy > span').evaluateAll(ns=>ns.map(n=>({id:n.dataset.eventId,time:Date.parse(n.querySelector('time').dateTime)})));
 assert.deepEqual(copy,records);
 const logTimes=await log.locator('.chain-event-meta time').evaluateAll(ns=>ns.map(n=>Date.parse(n.dateTime)));
 assert.ok(logTimes.every((t,i)=>!i||t<=logTimes[i-1]));
 checks.push({check:'Latest-only ticker increases in time, at most8/15min; copy matches; full log remains newest-first',count:records.length,records});
 await page.getByRole('button',{name:'Pause event ticker',exact:true}).click();
 assert.equal(await page.locator('.chain-ticker-track').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 const digest=records[0].id.split('#')[0];await group.locator('button').first().click();assert.equal(await log.getByLabel('Search chain events').inputValue(),digest);
 await log.getByRole('button',{name:'Clear',exact:true}).click();
 for(const width of [390,1440]){await page.setViewportSize({width,height:1000});for(const sel of ['.chain-ticker','.chain-log'])assert.ok(await page.locator(sel).evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:new URL(`${label}-${width}.png`,import.meta.url).pathname});}
 checks.push({check:'Pause, transaction-filter click, identity colors and mobile/desktop layouts retained'});
 mode='old';await log.getByRole('button',{name:'Refresh latest',exact:true}).click();await ready();
 await page.waitForFunction(()=>document.querySelectorAll('.chain-source-status [data-state="Current"]').length===4);
 assert.equal(await page.locator('.chain-ticker-track').count(),0);await page.locator('.chain-ticker-empty').filter({hasText:'No recent highlights'}).waitFor();
 assert.ok(await log.locator('.chain-event-list>li').count()>0);
 checks.push({check:'Fresh sources with only old events show no ticker highlights, preserving full log history',simulatedOldEvents:true});
 mode='live';await log.getByRole('button',{name:'Refresh latest',exact:true}).click();await ready();await page.locator('.chain-ticker-track').waitFor();
 checks.push({check:'Latest feed recovers after refresh'});
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 const receipt={at:new Date().toISOString(),base,label,checks,errors,writes,liveChainData:true};writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close();}
