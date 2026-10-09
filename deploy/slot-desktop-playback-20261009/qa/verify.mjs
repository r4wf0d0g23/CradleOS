import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./',import.meta.url).pathname,base=process.env.QA_BASE??'http://127.0.0.1:5210',live=base.startsWith('https:'),KEY='cradleos:casino:practice:v2',PREF='cradleos:casino:slot-motion:v1';
const fixtures=JSON.parse(await readFile(out+'fixtures.json','utf8')),report={base,mode:'isolated browser Play Money; actual UI and engine-produced saved fixtures; no wallet signing',checks:[],frames:[],errors:[],assetFailures:[]};
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',ignoreDefaultArgs:['--hide-scrollbars'],args:['--no-sandbox','--no-proxy-server']});
const check=s=>{report.checks.push(s);console.log(s)},state=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY),idle=p=>p.waitForFunction(()=>!document.querySelector('.round-active'));
function saved(r,cursor){r=structuredClone(r);r.cursor=cursor;const round={id:1,game:r.key,stake:r.stake,payout:r.payout,values:[1,r.frames.length],label:'Saved feature'};return {version:2,balance:1000000-r.stake+r.payout,sequence:1,history:[round],hand:null,table:null,pack:{game:r.key,rounds:[round],slot:r}};}
async function inject(p,key,cursor=0){await p.evaluate(([k,s])=>sessionStorage.setItem(k,JSON.stringify(s)),[KEY,saved(fixtures[key],cursor)]);await p.reload({waitUntil:'domcontentloaded'});await p.locator('.fleet-board').waitFor();return state(p);}
const start=p=>p.locator('.fleet-reveal-controls button').first().click();
async function phase(p,at){await p.waitForFunction(t=>performance.now()-Number(document.querySelector('.fleet-board').dataset.motionStart)>=t,at);return p.locator('.fleet-board').evaluate(e=>({at:performance.now()-Number(e.dataset.motionStart),active:!!document.querySelector('.round-active'),raw:e.dataset.rawStopped,windows:[...e.querySelectorAll('.slot-reel-strip,.cascade-ghost-layer,.vault-socket-shutter,.vault-socket-shutter > i,.slot-gate-sweep')].map(x=>({cls:x.className,display:getComputedStyle(x).display,transform:getComputedStyle(x).transform})),falls:[...e.querySelectorAll('[data-motion-source]')].map(x=>getComputedStyle(x).transform),grid:e.querySelector('.fleet-grid').getBoundingClientRect().toJSON()}));}
try{for(const width of [1440,390]){
 const c=await b.newContext({viewport:{width,height:1000},hasTouch:width<1000,reducedMotion:width===1440?'reduce':'no-preference'}),p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&/\.(js|css|png)(\?|$)/.test(r.url())&&r.status()>=400)report.assetFailures.push(r.url());});
 await p.goto(base+'/#/casino');await p.locator('.lounge-game-tile').first().waitFor();
 for(const [key,r] of Object.entries(fixtures)){
  if(live && !(width===1440?['slot_scrapyard','slot_reactor','slot_vault','slot_gatecrash']:['slot_scrapyard']).includes(key))continue;
  const cursor=['slot_reactor','slot_feral','slot_vault','slot_gatecrash'].includes(key)?1:key==='slot_drones'?3:0;
  const before=await inject(p,key,cursor);const control=p.getByRole('combobox',{name:'Reel animation'});await control.selectOption('animated');assert.equal(await control.inputValue(),'animated');
  await start(p);assert(await control.isDisabled());const early=await phase(p,100),later=await phase(p,550);report.frames.push({width,key,early,later});assert(early.active&&later.active);
  assert(early.windows.length>0,key+' visible overlays');assert(early.windows.every(x=>x.display!=='none'));
  if(['slot_reactor','slot_feral'].includes(key))assert(later.falls.some((x,i)=>x!==early.falls[i]),key+' gravity');
  else assert(later.windows.some((x,i)=>x.transform!==early.windows[i]?.transform),key+' reel travel');
  if(key==='slot_gatecrash'){const sweep=await phase(p,2160);assert(sweep.windows.some(x=>x.cls==='slot-gate-sweep'&&x.display!=='none'));report.frames.push({width,key,sweep});}if(key==='slot_scrapyard')await p.screenshot({path:out+`${live?'live':'preview'}-${width}-animated.png`,fullPage:false});
  await idle(p);const after=await state(p);assert.equal(after.balance,before.balance);assert.equal(after.sequence,before.sequence);assert.equal(after.pack.slot.cursor,cursor+1);assert.deepEqual(after.pack.slot.frames,before.pack.slot.frames);assert.deepEqual(await p.locator('.fleet-cell').evaluateAll(es=>es.map(e=>+e.dataset.symbol)),r.frames[cursor].grid.flat());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check(`${width} ${key}: Animated visible travel under ${width===1440?'OS reduced':'normal motion'}, exact endpoint, one cursor, unchanged ledger`);
 }
 // Classic reels use a separate timeline: opt-in must reach that renderer too.
 await p.evaluate(k=>sessionStorage.removeItem(k),KEY);await p.reload();await p.locator('.lounge-game-tile').filter({hasText:'Salvage Reels'}).click();const ctl=p.getByRole('combobox',{name:'Reel animation'});assert.equal(await ctl.inputValue(),'animated');await p.locator('.lounge-start').click();await p.waitForTimeout(200);const t1=Number(await p.locator('.casino-moving-reels').getAttribute('data-progress'));const x1=await p.locator('.casino-moving-reels .reel-moving > .game-icon').evaluateAll(es=>es.map(e=>getComputedStyle(e).transform));await p.waitForTimeout(400);const t2=Number(await p.locator('.casino-moving-reels').getAttribute('data-progress'));assert(t1<1&&t2>t1&&t2<1);const x2=await p.locator('.casino-moving-reels .reel-moving > .game-icon').evaluateAll(es=>es.map(e=>getComputedStyle(e).transform));assert(x1.some((x,i)=>x!=='none'&&x!==x2[i]),'actual classic icon transforms change');report.frames.push({width,classic:{t1,t2,x1,x2}});const committed=await state(p);await idle(p);const settled=await state(p);assert.equal(settled.balance,committed.balance);assert.equal(settled.sequence,1);await p.reload();await ctl.waitFor();assert.equal(await ctl.inputValue(),'animated');assert.deepEqual(await state(p),settled);check(`${width} classic slots: moving timeline, preference survives reload, one debit/result unchanged`);
 await c.close();
}
// Reduced/system/instant modes, saved continuity, cancellation and storage boundaries.
if(!live){
const c=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base+'/#/casino');
let before=await inject(p,'slot_scrapyard');let ctl=p.getByRole('combobox',{name:'Reel animation'});assert.equal(await ctl.inputValue(),'system');assert((await ctl.innerText()).includes('System · Reduced'));await start(p);await p.waitForTimeout(150);assert.equal(await p.locator('.round-active,.slot-reel-window').count(),0);assert.equal((await state(p)).pack.slot.cursor,1);check('System respects desktop reduced-motion default');
await p.emulateMedia({reducedMotion:'no-preference'});before=await inject(p,'slot_scrapyard');await ctl.selectOption('instant');await start(p);await p.waitForTimeout(150);assert.equal(await p.locator('.round-active,.slot-reel-window').count(),0);assert.equal((await state(p)).balance,before.balance);check('Instant bypasses motion on normal system without ledger change');
for(const mode of ['hidden','resize','media-change','reload']){
 before=await inject(p,'slot_gatecrash',1);await ctl.selectOption('animated');await start(p);await p.waitForTimeout(150);
 if(mode==='hidden')await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 if(mode==='resize')await p.setViewportSize({width:700,height:1000});
 if(mode==='media-change')await p.emulateMedia({reducedMotion:'reduce'});
 if(mode==='reload'){await p.reload();await p.locator('.fleet-board').waitFor();assert.equal((await state(p)).pack.slot.cursor,1);await start(p);}
 await p.waitForTimeout(150);
 if(mode==='media-change')assert(await p.locator('.slot-reel-window').count()>0,'explicit Animated survives OS change');
 if(mode==='hidden'||mode==='resize')assert.equal(await p.locator('.slot-reel-window,.slot-gate-sweep').count(),0,'sticky cancellation');
 await idle(p);const after=await state(p);assert.equal(after.balance,before.balance);assert.equal(after.pack.slot.cursor,2);await p.setViewportSize({width:1440,height:1000});await p.emulateMedia({reducedMotion:'no-preference'});check(mode+': explicit playback/cancellation completes once without new debit');
}
await p.evaluate(([key,pref])=>{sessionStorage.removeItem(key);localStorage.setItem(pref,'animated');},[KEY,PREF]);await p.reload();await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.lounge-game-tile').filter({hasText:'Signal Flip'}).click();assert.equal(await p.getByRole('combobox',{name:'Reel animation'}).count(),0);assert.equal(await p.locator('[data-slot-motion="animated"]').count(),0);await p.locator('.lounge-start').click();await p.waitForTimeout(150);assert.equal(await p.locator('.round-active').count(),0);check('Animated slot preference does not override non-slot OS reduced motion');
await p.evaluate(([key,pref])=>{sessionStorage.removeItem(key);localStorage.setItem(pref,'invalid');},[KEY,PREF]);await p.reload();await p.locator('.lounge-game-tile').filter({hasText:'Scrapyard Circuit'}).click();assert.equal(await ctl.inputValue(),'system');
await p.evaluate(pref=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===pref)throw new DOMException('blocked');return original.call(this,k,v);};},PREF);await ctl.selectOption('animated');await p.locator('.lounge-start').click();await p.waitForTimeout(200);assert(await p.locator('.slot-reel-window').count()>0);await idle(p);assert.equal((await state(p)).sequence,1);check('Invalid preference falls back to System; cosmetic storage failure cannot block one real spin');await c.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetFailures,[]);
}finally{await writeFile(out+(live?'live-browser.json':'preview-browser.json'),JSON.stringify(report,null,2));await b.close();}
