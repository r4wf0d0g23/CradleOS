import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url),base=process.env.QA_URL??'http://127.0.0.1:5232/',tag=process.env.QA_TAG??'dev',key='cradleos:casino:practice:v2',pref='cradleos:casino:slot-motion:v1';
const f=JSON.parse(await fs.readFile(new URL('fixtures.json',dir))),report={checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const context=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
const state=()=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key),idle=()=>p.waitForFunction(()=>!document.querySelector('.round-active'));
async function inject(s=f.fullShown,mode='animated'){await p.evaluate(([k,s,pref,mode])=>{sessionStorage.setItem(k,JSON.stringify(s));localStorage.setItem(pref,mode)},[key,s,pref,mode]);await p.reload();await p.locator('[data-slot-game="slot_xeroti"]').waitFor();}
function check(s){report.checks.push(s);console.log(s)}
try{
await p.goto(base+'#/casino');await p.locator('.lounge-game-tile').first().waitFor();
// No future frame leakage; animation cutoff/time and surviving/new cell positions.
await inject();await p.locator('.lounge-result-wrap, .identity-stage').first().scrollIntoViewIfNeeded().catch(()=>{});
await p.getByRole('button',{name:'Next cascade',exact:true}).click();await p.waitForTimeout(300);
const a=await p.locator('.fleet-cell').evaluateAll(es=>es.flatMap(e=>e.getAnimations().map(a=>({delay:a.effect.getTiming().delay,duration:a.effect.getTiming().duration,time:a.currentTime}))));assert.equal(a.length,25);assert(a.every(x=>x.delay>=760));
await p.waitForTimeout(260);await p.locator('.identity-stage').screenshot({path:new URL(`${tag}-feeding-560ms.png`,dir).pathname});
await idle();assert.equal((await state()).pack.slot.cursor,2);check('All 25 replacement cells wait >=760ms; destination and 560ms feeding frame recorded');
for(const mode of ['instant','system']){
 await inject(f.fullShown,mode);await p.getByRole('button',{name:'Next cascade',exact:true}).click();await idle();assert.equal(await p.locator('.cascade-ghost').count(),0);assert.equal((await state()).pack.slot.cursor,2);assert.equal((await state()).balance,f.full.balance);check(`${mode} mode + OS reduce settles once without ghosts`);
}
for(const action of ['resize','hidden','reload','preference']){
 await inject();await p.getByRole('button',{name:'Next cascade',exact:true}).click();await p.waitForTimeout(180);
 if(action==='resize')await p.setViewportSize({width:650,height:900});
 if(action==='hidden')await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
 if(action==='reload'){await p.reload();await p.locator('[data-slot-game="slot_xeroti"]').waitFor();}
 if(action==='preference')await p.getByRole('combobox',{name:'Game animation'}).selectOption('instant');
 await idle();assert.equal(await p.locator('.cascade-ghost').count(),0);const s=await state();assert.equal(s.balance,f.full.balance);assert.equal(s.sequence,1);assert.equal(s.pack.slot.cursor,action==='reload'?1:2);if(action==='reload'){await p.getByRole('button',{name:'Next cascade',exact:true}).click();await idle();assert.equal((await state()).pack.slot.cursor,2);}check(`${action} during devour cancels cleanly; reload resumes unfinished reveal, ledger unchanged`);
 await p.setViewportSize({width:390,height:1100});
}
// Fail both custom assets: numbered symbol fallback and named silhouette fallback remain usable.
await p.route('**/assets/casino/xeroti/**',r=>r.abort());await inject(f.top,'instant');await p.getByRole('button',{name:'Reveal saved spin',exact:true}).click();await idle();assert.equal(await p.locator('.xeroti-hull-fallback').count(),1);assert.equal((await state()).balance,f.top.balance);assert.equal(await p.locator('.fleet-cell .identity-symbol-fallback').count(),25);await p.unroute('**/assets/casino/xeroti/**');check('Native hero asset failure is handled without breaking the round');
// Failed storage must not advance a paid cursor.
await inject();await p.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cradleos:casino:practice:v2')throw new DOMException('blocked');return window.__set.call(this,k,v)}});await p.getByRole('button',{name:'Next cascade',exact:true}).click();await idle();assert.equal((await state()).pack.slot.cursor,1);assert.equal((await state()).balance,f.full.balance);await p.evaluate(()=>Storage.prototype.setItem=window.__set);check('Storage failure refuses cursor advance and preserves ledger');
assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile(new URL(`${tag}-lifecycle.json`,dir),JSON.stringify(report,null,2));await browser.close()}
