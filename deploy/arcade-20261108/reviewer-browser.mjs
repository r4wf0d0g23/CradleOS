import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://127.0.0.1:5369';
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',env:{...process.env,CHROME_DEVEL_SANDBOX:'/opt/nvidia/dgx-oobe-desktop/chrome-sandbox'}});
const checks=[],errors=[];
try{
 for(const [width,height] of [[1440,960],[650,850],[320,568],[568,320]]){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<1000});
  await ctx.route('https://frontier-drift-arcade.pages.dev/**', async route => {const req=route.request();const r=await fetch(req.url());const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/','/#/arcade','/arcade']){
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   if(path==='/')await page.getByRole('button',{name:'Arcade',exact:true}).click();
   await page.getByRole('heading',{name:'Arcade',exact:true}).waitFor();
   assert.equal(await page.getByText('Wallet required',{exact:true}).count(),0);
   assert.equal(await page.locator('.arcade-card').count(),2);
   await page.locator('.arcade-preview').last().scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.querySelectorAll('.arcade-preview')].every(i=>i.complete&&i.naturalWidth>0));
   const layout=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.arcade-card,.arcade-play')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,height:r.height,tag:e.tagName}})}));
   assert(layout.scroll<=width,JSON.stringify(layout));for(const r of layout.cards){assert(r.x>=0&&r.right<=width,JSON.stringify(r));if(r.tag==='A')assert(r.height>=44);}
   const links=await page.locator('.arcade-play').evaluateAll(els=>els.map(e=>({href:e.href,target:e.target,rel:e.rel,label:e.ariaLabel})));
   assert.deepEqual(links.map(e=>e.href),['https://frontier-drift.pages.dev/','https://frontier-drift-arcade.pages.dev/']);
   for(const l of links){assert.equal(l.target,'_blank');assert(l.rel.includes('noopener')&&l.rel.includes('noreferrer'));assert(l.label.includes('new tab'));}
   if(path==='/#/arcade'){
    await page.getByRole('button',{name:'KNOWN SPACE',exact:true}).click();await page.waitForURL('**/#/known-space');
    await page.goBack();await page.getByRole('heading',{name:'Arcade',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#/arcade');
   }
   checks.push({width,height,path,images:true,bounds:true,public:true,links:true});
  }
  await page.getByRole('link',{name:'Play Rift Run (new tab)'}).focus();
  const outline=await page.locator('.arcade-play').last().evaluate(e=>getComputedStyle(e).outlineWidth);assert.equal(outline,'2px');
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  const hit=await page.locator('.arcade-play').last().evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});assert(hit,'Rift Play is covered at natural bottom');
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'Play Rift Run (new tab)'}).click()]);await popup.waitForLoadState('domcontentloaded');await popup.locator('#launch').waitFor();assert.equal(new URL(popup.url()).origin,'https://frontier-drift-arcade.pages.dev');assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();checks.push({width,height,naturalBottomHit:true,actualPopup:true,openerNull:true});
  await page.screenshot({path:new URL(`reviewer-${width}.png`,import.meta.url).pathname,fullPage:true});
  await ctx.close();
 }
 assert.deepEqual(errors,[]);const result={at:new Date().toISOString(),base,checks,errors};writeFileSync(new URL('reviewer-browser.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
