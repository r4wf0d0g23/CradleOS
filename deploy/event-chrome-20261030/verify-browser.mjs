import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.EVENT_QA_BASE||'http://127.0.0.1:5364',label=process.env.EVENT_QA_LABEL||'preview';
assert.ok(['preview','live'].includes(label));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(40000);
const checks=[],errors=[];let mode='fail',writes=0;
await context.route('https://**/*',async route=>{
 const req=route.request(),url=req.url(),body=req.postData();
 if(/ExecuteTransaction|SubmitTransaction/.test(url)){writes++;return route.abort();}
 if(body?.includes('query ChainEventLog')&&(mode==='fail'||mode==='gate-fail'&&JSON.parse(body).variables.type.endsWith('::gate')))return route.fulfill({status:503,body:'Unavailable'});
 try{const r=await fetch(url,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)});const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});}catch{await route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const log=page.locator('.chain-log'),rows=log.locator('.chain-event-list>li');
async function ready(){await log.getByRole('button',{name:'Refresh',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.chain-log header button')?.disabled);}
async function refresh(){await log.getByRole('button',{name:'Refresh',exact:true}).click();await ready();}
try{
 await page.clock.install();await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.chain-ticker-open').click();await ready();
 assert.equal(await log.locator('.chain-source-status [data-state="Unavailable"]').count(),4);assert.equal(await rows.count(),0);assert.match(await log.locator('.chain-log-counts').innerText(),/— events/);
 assert.equal(await log.getByText('Some sources unavailable · Retry with Refresh latest',{exact:true}).count(),0);
 checks.push('Failure shows specific source warnings and unknown counts, no generic duplicate warning');
 mode='live';await refresh();assert.ok(await rows.count()>0);assert.equal(await log.locator('.chain-source-status').count(),0);
 const counts=await log.locator('.chain-log-counts').innerText();assert.equal((counts.match(/Loaded/g)||[]).length,1);assert.match(counts,/\d+ events/);assert.match(counts,/\d+ jumps/);assert.match(counts,/\d+ pilots/);
 assert.equal(await log.getByLabel('Search chain events').getAttribute('placeholder'),'Search events…');
 checks.push('Healthy status row absent; concise Refresh/Search/counters; no Current labels');
 for(const width of [390,1440]){await page.setViewportSize({width,height:1000});for(const sel of ['.chain-log','.chain-ticker'])assert.ok(await page.locator(sel).evaluate(e=>e.scrollWidth<=e.clientWidth+1));await log.scrollIntoViewIfNeeded();await page.screenshot({path:new URL(`${label}-${width}.png`,import.meta.url).pathname});}
 checks.push('Clean event header fits mobile and desktop');
 mode='gate-fail';await refresh();assert.equal(await log.locator('.chain-source-status>span').count(),1);await log.getByText('Gates · Stale',{exact:true}).waitFor();assert.ok(await rows.count()>0);
 checks.push('Partial outage shows only Gates · Stale and retains loaded rows');
 mode='live';await refresh();assert.equal(await log.locator('.chain-source-status').count(),0);
 await page.clock.setSystemTime(new Date(Date.now()+240000));await page.waitForFunction(()=>document.querySelectorAll('.chain-source-status [data-state="Stale"]').length===4);
 await page.clock.setSystemTime(new Date());await refresh();assert.equal(await log.locator('.chain-source-status').count(),0);
 checks.push('Expired data still surfaces stale warnings and recovery removes them');
 await log.getByRole('button',{name:'Load older',exact:true}).click();await ready();await log.getByText('History',{exact:true}).waitFor();assert.match(await log.locator('.chain-log-counts').innerText(),/^Loaded/);assert.equal(await log.locator('.chain-source-status').count(),0);
 checks.push('Older history remains explicitly qualified without repeating per-source history labels');
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 const result={at:new Date().toISOString(),base,label,checks,errors,writes,liveChainData:true,simulatedFailures:true};writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
