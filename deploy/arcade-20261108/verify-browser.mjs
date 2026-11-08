import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5369',label=base.startsWith('https:')?'live':'preview';
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',env:{...process.env,CHROME_DEVEL_SANDBOX:'/opt/nvidia/dgx-oobe-desktop/chrome-sandbox'}});
const checks=[],errors=[],failed=[];
try {
 for(const [width,height] of [[1440,960],[390,844],[320,568],[568,320]]){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<1000});
  // Existing QA TLS-validating relay; responses are actual public bytes, not fixtures.
  await ctx.route('https://**/*',async route=>{try {const q=route.request(),r=await fetch(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postDataBuffer(),signal:AbortSignal.timeout(25000)});const headers=Object.fromEntries(r.headers);delete headers['content-length'];delete headers['content-encoding'];await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});}catch(e){failed.push({url:route.request().url(),error:e.message});await route.abort();}});
  ctx.on('page',p=>p.on('pageerror',e=>errors.push({url:p.url(),error:e.message})));
  const p=await ctx.newPage();
  await p.goto(base+'/',{waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:'Arcade',exact:true}).click();
  await p.getByRole('heading',{name:'Arcade',exact:true}).waitFor();
  assert.equal(await p.locator('.arcade-card').count(),2);
  assert.equal(await p.getByText('Wallet required',{exact:true}).count(),0);
  const bounds=await p.locator('.arcade-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width}}));
  assert(bounds.every(r=>r.x>=0&&r.right<=width+1&&r.width>0),JSON.stringify(bounds));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('.arcade-preview').last().scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>[...document.querySelectorAll('.arcade-preview')].every(i=>i.complete&&i.naturalWidth===800));
  await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  assert(await p.locator('.arcade-play').last().evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'last Play hit target obscured');
  await p.screenshot({path:new URL(`${label}-${width}.png`,import.meta.url).pathname,fullPage:true});
  for(const [title,url,selector,snapshot] of [
   ['Frontier Drift','https://frontier-drift.pages.dev/','[data-special=new]','frontierSnapshot'],
   ['Rift Run','https://frontier-drift-arcade.pages.dev/','#launch','riftSnapshot']]){
   const link=p.getByRole('link',{name:`Play ${title} (new tab)`,exact:true});
   assert.equal(await link.getAttribute('href'),url);
   const opened=ctx.waitForEvent('page');
   if(width<1000)await link.tap();else {await link.focus();await p.keyboard.press('Enter');}
   const game=await opened;await game.waitForLoadState('domcontentloaded');
   await game.locator(selector).waitFor({timeout:30000});
   assert.equal(new URL(game.url()).origin,new URL(url).origin);
   assert.equal(await game.evaluate(()=>window.opener),null);
   await game.waitForFunction(n=>typeof window[n]==='function',snapshot);
   if(width<1000)await game.locator(selector).tap();else await game.locator(selector).click();
   await game.waitForFunction(n=>['flight','playing'].includes(window[n]().status),snapshot);
   // Actual keyboard/touch interaction, no game state injection.
   if(title==='Rift Run'){
    if(width<1000)await game.locator('#pulse').tap();else await game.keyboard.press('Space');
    await game.locator('#pause').click();await game.locator('#resume').waitFor();
   }else{await game.keyboard.down('d');await game.waitForTimeout(200);await game.keyboard.up('d');await game.keyboard.press('p');}
   checks.push({width,height,title,launch:true,play:true,originalOrigin:true,openerIsNull:true});
   await game.close();assert(await p.getByRole('heading',{name:'Arcade',exact:true}).isVisible());
  }
  // Public direct hash, path alias, reload, and navigation out/back.
  for(const path of ['/#/arcade','/arcade']){await p.goto(base+path);await p.getByRole('heading',{name:'Arcade',exact:true}).waitFor();await p.reload();await p.getByRole('heading',{name:'Arcade',exact:true}).waitFor();}
  await p.getByRole('button',{name:'CASINO',exact:true}).click();await p.waitForURL(url=>url.hash==='#/casino');
  await p.getByRole('button',{name:'ARCADE',exact:true}).click();await p.getByRole('heading',{name:'Arcade',exact:true}).waitFor();
  checks.push({width,height,normalAndKioskNavigation:true,directHashAndPath:true,reload:true,noOverflow:true,imagesLoaded:true});
  await ctx.close();console.log('PASS',width,height);
 }
 assert.deepEqual(errors,[]);
 writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify({base,at:new Date().toISOString(),checks,errors,failed},null,2));
 console.log(JSON.stringify({checks:checks.length,errors,failed}));
}finally{await browser.close()}
