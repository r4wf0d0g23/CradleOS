import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const OUT='/home/rawdata/.openclaw-captain/workspace/research/cradleos-casino-slot-identities-20261008',URL=process.env.QA_URL??'http://127.0.0.1:5199/',TAG=process.env.QA_TAG??'dev',KEY='cradleos:casino:practice:v2';
const fixtures=JSON.parse(await fs.readFile(`${OUT}/fixtures.json`,'utf8')),report={checks:[],errors:[],badAssets:[]};
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox']});
const state=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY), idle=async p=>p.waitForFunction(()=>!document.querySelector('.round-active'));
const check=s=>{report.checks.push(s);console.log(s)};
function saved(r){const round={id:1,game:r.key,stake:r.stake,payout:r.payout,values:[1,r.frames.length],label:'Saved feature'};return {version:2,balance:1000000-r.stake+r.payout,sequence:1,history:[round],hand:null,table:null,pack:{game:r.key,rounds:[round],slot:r}};}
async function inject(p,r){await p.evaluate(([k,s])=>sessionStorage.setItem(k,JSON.stringify(s)),[KEY,saved(r)]);await p.reload();await p.locator(`[data-slot-game="${r.key}"]`).waitFor();}
try{
for(const width of (process.env.QA_WIDTHS?JSON.parse(process.env.QA_WIDTHS):[320,390,844,1440])){
 const ctx=await browser.newContext({viewport:{width,height:width===844?390:1000},reducedMotion:'reduce',hasTouch:width<1000}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&/\/icons\/|\/casino\//.test(r.url())&&r.url().startsWith(URL))report.badAssets.push(r.url())});await p.goto(URL+'#/casino');await p.locator('.lounge-game-tile').first().waitFor();assert.equal(await p.locator('.lounge-game-tile').count(),33);
 await p.getByRole('button',{name:'SLOTS',exact:true}).click();assert.equal(await p.locator('.lounge-game-tile').count(),9);await p.screenshot({path:`${OUT}/${TAG}-${width}-lobby.png`,fullPage:true});
 for(const [key,r] of Object.entries(fixtures)){
   await inject(p,r);assert(await p.getByRole('button',{name:'$EVE Testnet',exact:true}).isDisabled());assert(await p.getByRole('button',{name:'Donate $EVE',exact:true}).isDisabled());assert(await p.getByLabel('Stake in play chips').isDisabled());
   let old=await state(p);assert.equal(old.pack.slot.cursor,0);assert.equal(await p.locator('.fleet-covered').count(),1);
   await p.getByRole('button',{name:'Reveal saved spin',exact:true}).evaluate(e=>{e.click();e.click();e.click()});await idle(p);let next=await state(p);assert.equal(next.pack.slot.cursor,1);assert.equal(next.balance,old.balance);assert.equal(next.sequence,old.sequence);
   const symbols=await p.locator('.fleet-cell').evaluateAll(es=>es.map(e=>Number(e.dataset.symbol)));assert.deepEqual(symbols,r.frames[0].grid.flat());const marked=await p.locator('.fleet-cell-win').evaluateAll(es=>es.map(e=>Number(e.dataset.cell)).sort((a,b)=>a-b));assert.deepEqual(marked,[...new Set(r.frames[0].wins.flatMap(w=>w.cells))].sort((a,b)=>a-b));
   await p.reload();await p.locator(`[data-slot-game="${key}"]`).waitFor();assert.deepEqual(await state(p),next);await p.getByRole('button',{name:'Reveal all',exact:true}).click();next=await state(p);assert.equal(next.pack.slot.cursor,r.frames.length);assert.equal(next.balance,old.balance);assert.equal(next.sequence,old.sequence);assert(!(await p.getByRole('button',{name:'Donate $EVE',exact:true}).isDisabled()));
   if(key==='slot_vault'||key==='slot_eclipse')await p.screenshot({path:`${OUT}/${TAG}-${width}-${key}.png`,fullPage:true});
   // A real production RNG spin must stay one aggregate paid round even on rapid input.
   await p.locator('.lounge-start').evaluate(e=>{e.click();e.click();e.click()});await idle(p);const real=await state(p);assert.equal(real.sequence,2);assert.equal(real.balance,old.balance-real.pack.slot.stake+real.pack.slot.payout);if(real.pack.slot.cursor<real.pack.slot.frames.length)await p.getByRole('button',{name:'Reveal all',exact:true}).click();
   await p.locator('.fleet-rules summary').click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.locator('.fleet-rules summary').click();
 }
 await p.getByRole('button',{name:'$EVE Testnet',exact:true}).click();assert.equal(await p.locator('.lounge-game-tile').count(),23);assert.equal(await p.locator('.fleet-tile').count(),0);
 check(`${width}px: 33 practice / 9 slots / 23 unchanged testnet; all 8 saved features resume, winning cells match engine, skip preserves ledger, triple-click one paid spin, rules fit`);await ctx.close();
}
// Actual animated reveal, sound persists, storage failure on spin and cursor stays atomic.
{
 const ctx=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'no-preference'}),p=await ctx.newPage();await p.addInitScript(()=>{const Original=window.AudioContext;window.__audio=[];window.AudioContext=class extends Original{constructor(...args){super(...args);window.__audio.push(this)}}});await p.goto(URL+'#/casino');await p.locator('.lounge-game-tile').first().waitFor();
 await inject(p,fixtures.slot_gatecrash);await p.getByRole('button',{name:'Enable casino sound',exact:true}).click();await p.getByRole('button',{name:'Reveal saved spin',exact:true}).click();await p.waitForTimeout(250);assert(await p.locator('.fleet-cell-drop').count()>0);assert.deepEqual(await p.locator('.fleet-cell').evaluateAll(es=>es.map(e=>Number(e.dataset.symbol))),fixtures.slot_gatecrash.frames[0].original.flat());await idle(p);assert(await p.getByRole('button',{name:'Mute casino sound',exact:true}).isVisible());assert(await p.evaluate(()=>window.__audio.at(-1).state==='running'));
 let old=await state(p);await p.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cradleos:casino:practice:v2')throw new DOMException('blocked');return window.__set.call(this,k,v)}});await p.getByRole('button',{name:'Next free spin',exact:true}).click();await idle(p);assert.deepEqual(await state(p),old);assert(await p.getByRole('alert').filter({hasText:'storage is unavailable'}).isVisible());
 await p.evaluate(()=>{Storage.prototype.setItem=window.__set});await p.getByRole('button',{name:'Reveal all',exact:true}).click();old=await state(p);
 await p.evaluate(()=>{Storage.prototype.setItem=function(k,v){if(k==='cradleos:casino:practice:v2')throw new DOMException('blocked');return window.__set.call(this,k,v)}});await p.locator('.lounge-start').click();assert.deepEqual(await state(p),old);await p.evaluate(()=>{Storage.prototype.setItem=window.__set});
 check('Normal motion shows original board then transformation; sound remains enabled; failed cursor/spin storage writes do not debit or advance');await ctx.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);await fs.writeFile(`${OUT}/${TAG}-qa.json`,JSON.stringify(report,null,2));
}finally{await browser.close()}
