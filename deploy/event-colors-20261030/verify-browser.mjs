import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.EVENT_QA_BASE||'http://127.0.0.1:5362',label=process.env.EVENT_QA_LABEL||'preview';
assert.ok(['preview','live'].includes(label));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}), errors=[],checks=[];let namesFail=false,writes=0;
context.setDefaultTimeout(40000);
await context.route('https://**/*',async route=>{
 const req=route.request(),url=req.url();
 if(/ExecuteTransaction|SubmitTransaction/.test(url)){writes++;return route.abort();}
 if(namesFail&&url.endsWith('/BatchGetObjects'))return route.abort();
 try{
  const r=await fetch(url,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)});
  const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];
  await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});
 }catch{await route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const log=page.locator('.chain-log');
async function ready(){await log.getByRole('button',{name:'Refresh latest',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.chain-log header button')?.disabled);}
async function styleCheck(selector){
 const values=await page.locator(selector).evaluateAll(nodes=>nodes.map(e=>({identified:e.dataset.identified,color:getComputedStyle(e).color,weight:getComputedStyle(e).fontWeight,text:e.textContent})));
 assert.ok(values.length>0);
 for(const v of values){assert.equal(v.color,v.identified==='true'?'rgb(255, 220, 155)':'rgb(139, 141, 146)');assert.equal(v.weight,v.identified==='true'?'600':'400');assert.ok(v.text.trim());}
 return {count:values.length,identified:values.filter(v=>v.identified==='true').length,unidentified:values.filter(v=>v.identified==='false').length};
}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.chain-ticker-open').click();await ready();
 const text=await styleCheck('.chain-event-text .chain-entity');assert.ok(text.identified>0);assert.ok(text.unidentified>0);
 checks.push({check:'Real named entities gold/semibold; unresolved IDs gray/normal; all labels retained',...text});
 await page.locator('.chain-event-list > li').filter({has:page.locator('.chain-event-text [data-identified="true"]')}).first().locator('summary').click();
 checks.push({check:'Expanded details use same identity colors',...await styleCheck('.chain-event-list details[open] .chain-entity')});
 checks.push({check:'Ticker and inert duplicate use same identity colors',...await styleCheck('.chain-ticker .chain-entity')});
 const ticker=page.locator('.chain-ticker-group').first(),copy=page.locator('.chain-ticker-copy');
 assert.deepEqual(await ticker.locator('.chain-entity').allTextContents(),await copy.locator('.chain-entity').allTextContents());
 assert.equal(await copy.getAttribute('inert'),'');assert.equal(await copy.getAttribute('aria-hidden'),'true');
 const name=await log.locator('.chain-event-text [data-identified="true"]').first().innerText();
 await log.getByLabel('Search chain events').fill(name);assert.ok(await log.locator('.chain-event-list>li').count()>0);await log.getByRole('button',{name:'Clear',exact:true}).click();
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const s of ['.chain-log','.chain-ticker'])assert.ok(await page.locator(s).evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:new URL(`${label}-${width}.png`,import.meta.url).pathname});
 }
 checks.push({check:'Search preserved; desktop/mobile layout fits'});
 namesFail=true;await page.goto(base+'/#/events',{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});await ready();await log.getByText('Names unavailable',{exact:true}).waitFor();
 const fallback=await styleCheck('.chain-event-list > li[data-kind="jump"] .chain-event-text .chain-entity');assert.equal(fallback.identified,0);assert.ok(fallback.unidentified>0);
 checks.push({check:'Metadata failure retains muted readable jump IDs',...fallback});
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 const result={at:new Date().toISOString(),base,label,checks,errors,writes,realChainData:true,simulatedMetadataOutage:true};
 writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
