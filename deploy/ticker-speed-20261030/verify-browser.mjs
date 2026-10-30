import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.EVENT_QA_BASE||'http://127.0.0.1:5365',label=process.env.EVENT_QA_LABEL||'preview';
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(30000);const errors=[],checks=[];let writes=0;
await context.route('https://**/*',async route=>{const req=route.request(),url=req.url();if(/ExecuteTransaction|SubmitTransaction/.test(url)){writes++;return route.abort();}try{const r=await fetch(url,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)}),headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});}catch{await route.abort();}});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});const track=page.locator('.chain-ticker-track');await track.waitFor();
 // Metadata can replace numeric IDs; sample after first feed load finishes.
 await page.locator('.chain-ticker-open').click();await page.locator('.chain-log header button').filter({hasText:'Refresh'}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.chain-log header button').disabled);
 await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);
 const sample=await track.evaluate(e=>{const lengths=[...e.querySelectorAll('.chain-ticker-group:first-child button')].map(b=>b.textContent.slice(b.querySelector('time').textContent.length+3).length);return{duration:parseFloat(getComputedStyle(e).animationDuration),chars:lengths.reduce((a,b)=>a+b,0),count:lengths.length,state:getComputedStyle(e).animationPlayState};});
 assert.equal(sample.state,'running');assert.ok(Math.abs(sample.duration-Math.max(22.5,sample.chars/18))<0.001);assert.ok(Math.abs(sample.duration*2-Math.max(45,sample.chars/9))<0.002);
 const start=await track.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m41);
 await page.waitForFunction(x=>new DOMMatrix(getComputedStyle(document.querySelector('.chain-ticker-track')).transform).m41<x-2,start);
 checks.push({check:'Duration halved and ticker visibly advances',...sample});
 await page.locator('.chain-ticker').hover();assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');await page.mouse.move(0,0);
 await page.locator('.chain-ticker-group button').first().focus();assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.getByRole('button',{name:'Pause event ticker',exact:true}).click();assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await track.evaluate(e=>getComputedStyle(e).animationName),'none');
 checks.push({check:'Hover, keyboard, explicit pause and reduced-motion preserved'});
 await page.setViewportSize({width:390,height:900});assert.ok(await page.locator('.chain-ticker').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 const result={at:new Date().toISOString(),base,label,checks,mobileFits:true,errors,writes,realChainData:true};writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
