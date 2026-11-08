import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://cradleos.io',dist=new URL('../../cradleos-dapp/dist/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex'),assets=[];
const root=await fetch(origin+'/');assert.equal(root.status,200);const html=await root.text(),localHtml=readFileSync(new URL('index.html',dist),'utf8');
const refs=s=>[...s.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]).sort();assert.deepEqual(refs(html),refs(localHtml));
for(const path of refs(html)){const r=await fetch(origin+path);assert.equal(r.status,200);const actual=Buffer.from(await r.arrayBuffer()),expected=readFileSync(new URL(path.slice(1),dist));assert.equal(hash(actual),hash(expected));assets.push({path,bytes:actual.length,sha256:hash(actual),matches:true})}
const errors=[],failed=[],b=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',env:{...process.env,CHROME_DEVEL_SANDBOX:'/opt/nvidia/dgx-oobe-desktop/chrome-sandbox'}});
try{
 const ctx=await b.newContext({viewport:{width:320,height:568},hasTouch:true});
 await ctx.route('https://**/*',async route=>{try{const q=route.request(),r=await fetch(q.url(),{method:q.method(),headers:q.headers(),body:['GET','HEAD'].includes(q.method())?undefined:q.postDataBuffer(),signal:AbortSignal.timeout(25000)});const headers=Object.fromEntries(r.headers);delete headers['content-length'];delete headers['content-encoding'];await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});}catch(e){failed.push({url:route.request().url(),error:e.message});await route.abort()}});
 ctx.on('page',p=>p.on('pageerror',e=>errors.push({url:p.url(),error:e.message})));
 const p=await ctx.newPage();await p.goto(origin+'/#/arcade',{waitUntil:'domcontentloaded'});await p.getByRole('heading',{name:'Arcade',exact:true}).waitFor();assert.equal(await p.locator('.arcade-card').count(),10);
 assert.equal(await p.getByRole('link',{name:'Play Frontier Drift (new tab)'}).getAttribute('href'),'https://frontier-drift.pages.dev/');assert.equal(await p.getByRole('link',{name:'Play Rift Run (new tab)'}).getAttribute('href'),'https://frontier-drift-arcade.pages.dev/');
 assert.equal(await p.getByText('Wallet required',{exact:true}).count(),0);
 for(const img of await p.locator('.arcade-preview').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(im=>im.decode())}
 await p.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await p.waitForTimeout(400);
 const last=p.getByRole('link',{name:'Play Scrapline Defense (new tab)',exact:true});const hit=await last.evaluate(el=>{const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,width:r.width,height:r.height,unobstructed:el.contains(target)}});assert(hit.unobstructed);assert(hit.height>=44);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:new URL('integration-live-review-320.png',import.meta.url).pathname});
 const opened=ctx.waitForEvent('page');await last.tap();const game=await opened;await game.waitForLoadState('domcontentloaded');await game.getByRole('button',{name:'PLAY',exact:true}).waitFor({timeout:30000});assert.equal(game.url(),'https://frontier-arcade.pages.dev/games/scrapline-defense/');assert.equal(await game.evaluate(()=>opener),null);
 await game.getByRole('button',{name:'PLAY',exact:true}).tap();await game.waitForFunction(()=>arcadeSnapshot()?.state==='playing');await game.locator('[data-action="build:cutter"]').tap();await game.locator('[data-action="wave"]').tap();await game.waitForFunction(()=>arcadeSnapshot().wave===1&&arcadeSnapshot().enemies.length>0);await game.locator('#pause').tap();assert.equal(await game.evaluate(()=>arcadeSnapshot().paused),true);await game.close();assert(await p.getByRole('heading',{name:'Arcade',exact:true}).isVisible());assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 writeFileSync(new URL('integration-live-review.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),origin,assets,cards:10,oldDestinationsUnchanged:true,walletFree:true,allImagesDecoded:true,lastAction:hit,actualPopup:'https://frontier-arcade.pages.dev/games/scrapline-defense/',openerNull:true,actualBuildWavePause:true,errors,failed},null,2));console.log(JSON.stringify({result:'PASS',assets:assets.length,cards:10,lastAction:hit,launch:'Scrapline Defense',errors,failed}));
}finally{await b.close()}
