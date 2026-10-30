import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base=process.env.EVENT_QA_BASE||'http://127.0.0.1:5361',label=process.env.EVENT_QA_LABEL||'preview';
assert.ok(['preview','live'].includes(label));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const checks=[],errors=[],network=[];let mode='fail',eventReads=0;
const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(45000);
await context.route('https://**/*',async route=>{
 const req=route.request(),url=req.url(),body=req.postData();
 try{
  assert.ok(!/ExecuteTransaction|SubmitTransaction/.test(url),'No chain writes');
  if(body?.includes('query ChainEventLog')){
   eventReads++;const type=JSON.parse(body).variables.type;
   if(mode==='fail'||mode==='gate-fail'&&type.endsWith('::gate')){network.push({url,simulatedFailure:mode,type});return route.fulfill({status:503,body:'Unavailable'});}
  }
  if(mode==='names-fail'&&url.endsWith('/BatchGetObjects')){network.push({url,simulatedFailure:mode});return route.abort('failed');}
  const r=await fetch(url,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)});
  const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];
  network.push({url,status:r.status});await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});
 }catch(e){network.push({url,error:String(e)});await route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const log=page.locator('.chain-log'),rows=page.locator('.chain-event-list > li');
async function ready(){await log.getByRole('button',{name:'Refresh latest',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.chain-log header button')?.disabled);}
async function refresh(){await log.getByRole('button',{name:'Refresh latest',exact:true}).click();await ready();}
async function allCurrent(){await page.waitForFunction(()=>document.querySelectorAll('.chain-source-status [data-state="Current"]').length===4);}
try{
 await page.clock.install();
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('.chain-ticker-empty').filter({hasText:'Feed unavailable'}).waitFor();
 await page.locator('.chain-ticker-open').click();await ready();
 assert.equal(await rows.count(),0);assert.match(await log.locator('.chain-log-counts').innerText(),/Loaded events · —/);
 checks.push('All-source failure is Unavailable, not an empty-success count');
 mode='live';await refresh();await allCurrent();assert.ok(await rows.count()>0);
 const initialCount=await rows.count(),summary=await rows.first().innerText();assert.doesNotMatch(summary,/NaN|undefined/);
 assert.equal(await log.getByText('Connect EVE Vault',{exact:true}).count(),0);
 checks.push('Public log reads real current-world events and typed names without wallet access');
 await log.getByLabel('Event category').selectOption('Jumps');
 await page.waitForFunction(()=>document.querySelectorAll('.chain-event-list>li').length>0);
 assert.ok((await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.kind))).every(kind=>kind==='jump'));
 const jump=rows.first();await jump.locator('summary').click();
 const gateId=await jump.locator('dl>div').filter({has:page.locator('dt',{hasText:/^From$/})}).locator('code').innerText();
 await log.getByLabel('Search chain events').fill(gateId);
 assert.ok(await rows.count()>0);assert.ok((await rows.allTextContents()).every(text=>text.includes(gateId)));
 const link=await rows.first().getByRole('link',{name:'Transaction'}).getAttribute('href');assert.match(link,/^https:\/\/suiscan.xyz\/testnet\/tx\/[1-9A-HJ-NP-Za-km-z]+$/);
 checks.push('Category, exact gate-ID search and per-event transaction provenance');
 await log.getByRole('button',{name:'Clear',exact:true}).click();
 await log.getByLabel('Event category').selectOption('Losses');
 assert.ok(await rows.count()>0);assert.match(await rows.first().innerText(),/Occurred .*Recorded above/s);
 checks.push('Backfilled losses show occurred time separately from chain-recorded time');
 await log.getByRole('button',{name:'Clear',exact:true}).click();
 await log.getByRole('button',{name:'Load older',exact:true}).click();await ready();
 assert.ok(await rows.count()>initialCount);await log.getByText('History snapshot',{exact:true}).waitFor();
 const beforeHistoryPoll=eventReads;await page.clock.runFor(61000);assert.equal(eventReads,beforeHistoryPoll);
 assert.equal(await page.locator('.chain-ticker-track').count(),0);
 checks.push('Older pages deduplicate, preserve history snapshot and suspend automatic head polling/ticker');
 await refresh();await allCurrent();assert.ok(await rows.count()<=120);
 mode='gate-fail';await refresh();
 await page.locator('.chain-source-status [data-state="Stale"]').filter({hasText:'Gates'}).waitFor();
 assert.ok(await rows.count()>0);assert.ok(await page.locator('.chain-source-status [data-state="Current"]').count()>=2);
 checks.push('One-source outage retains labelled stale rows without failing other sources');
 mode='live';await refresh();await allCurrent();
 await page.clock.setSystemTime(new Date(Date.now()+240000));
 await page.waitForFunction(()=>document.querySelectorAll('.chain-source-status [data-state="Stale"]').length===4);
 assert.equal(await page.locator('.chain-ticker-track').count(),0);
 await page.clock.setSystemTime(new Date());await refresh();await allCurrent();
 checks.push('Index/sample freshness expires; ticker hides stale highlights and recovers');
 await page.locator('.chain-ticker-track').waitFor();
 await page.getByRole('button',{name:'Pause event ticker',exact:true}).click();
 assert.equal(await page.locator('.chain-ticker-track').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Resume event ticker',exact:true}).waitFor();
 await page.getByRole('button',{name:'Resume event ticker',exact:true}).click();
 await page.locator('.chain-ticker-track').waitFor();
 await page.locator('.chain-ticker-group button').first().focus();assert.equal(await page.locator('.chain-ticker-track').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.chain-ticker-track').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('.chain-ticker-copy').isVisible(),false);await page.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await page.locator('.chain-ticker-copy').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.chain-ticker-copy').getAttribute('inert'),'');
 checks.push('Ticker pause persists; focus stops motion; reduced-motion is static; duplicate is inert/hidden to accessibility');
 await page.locator('.chain-ticker-group button').first().click();await ready();assert.ok(await rows.count()>0);
 assert.ok(await log.getByLabel('Search chain events').inputValue());
 await log.getByRole('button',{name:'Clear',exact:true}).click();
 checks.push('Ticker highlight opens the corresponding transaction-filtered event log');
 for(const width of [320,390,650,1440]){
  await page.setViewportSize({width,height:1000});
  for(const selector of ['.chain-log','.chain-ticker'])assert.ok(await page.locator(selector).evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${selector} fits ${width}`);
  if([390,1440].includes(width))await page.screenshot({path:new URL(`${label}-${width}.png`,import.meta.url).pathname,fullPage:false});
 }
 checks.push('Log and ticker fit 320/390/650/1440px');
 mode='names-fail';await page.goto(base+'/#/events',{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});await ready();
 assert.ok(await rows.count()>0);await log.getByText('Names unavailable',{exact:true}).waitFor();
 assert.match(await page.locator('.chain-event-list > li[data-kind="jump"]').first().innerText(),/Pilot \d+ jumped/);
 checks.push('Metadata outage preserves real events with ID fallbacks; direct event-log route works');
 assert.deepEqual(errors,[]);assert.ok(!network.some(n=>/ExecuteTransaction|SubmitTransaction/.test(n.url)));
 const receipt={at:new Date().toISOString(),base,label,checks,liveChainData:true,syntheticFailures:true,writes:0,errors,eventReads,network};
 writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,network:{calls:network.length}}));
}catch(error){await page.screenshot({path:new URL(`${label}-failure.png`,import.meta.url).pathname}).catch(()=>{});writeFileSync(new URL(`${label}-failure.json`,import.meta.url),JSON.stringify({error:String(error),checks,errors,eventReads,network},null,2));throw error;}finally{await browser.close();}
