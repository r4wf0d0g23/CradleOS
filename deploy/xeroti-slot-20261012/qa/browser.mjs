import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url),BASE=process.env.QA_URL??'http://127.0.0.1:5232/',TAG=process.env.QA_TAG??'dev',KEY='cradleos:casino:practice:v2';
const fixtures=JSON.parse(await fs.readFile(new URL('./fixtures.json',dir))),report={url:BASE,checks:[],errors:[],badAssets:[]};
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const state=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY),idle=p=>p.waitForFunction(()=>!document.querySelector('.round-active'));
const shot=(p,name)=>p.locator('[data-slot-game="slot_xeroti"]').screenshot({path:new URL(`${TAG}-${name}.png`,dir).pathname});
const check=s=>{report.checks.push(s);console.log(s)};
async function inject(p,s,mode='animated'){await p.evaluate(([k,s,m])=>{sessionStorage.setItem(k,JSON.stringify(s));localStorage.setItem('cradleos:casino:slot-motion:v1',m)},[KEY,s,mode]);await p.reload();await p.locator('[data-slot-game="slot_xeroti"]').waitFor();}
async function geometry(p){return p.locator('.xeroti-connections').evaluate(svg=>{const b=svg.getBoundingClientRect();return [...svg.querySelectorAll('line')].map(l=>{const c=svg.parentElement.querySelector(`[data-cell="${l.dataset.from}"]`).getBoundingClientRect();return Math.hypot(+l.getAttribute('x1')+b.left-c.left-c.width/2,+l.getAttribute('y1')+b.top-c.top-c.height/2)})})}
try{
for(const width of JSON.parse(process.env.QA_WIDTHS??'[320,390,1440]')){
 const ctx=await browser.newContext({viewport:{width,height:1100},reducedMotion:'reduce',hasTouch:width<1000}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&/\/assets\/casino\/|\/casino\/|\/icons\//.test(r.url())&&r.url().startsWith(BASE))report.badAssets.push(r.url())});
 await p.goto(BASE+'#/casino');await p.locator('.lounge-game-tile').first().waitFor();
 await p.getByRole('button',{name:'SLOTS',exact:true}).click();assert.equal(await p.locator('.lounge-game-tile').count(),10);
 await p.locator('.lounge-game-tile').filter({hasText:'Xeroti'}).click();await p.locator('[data-slot-game="slot_xeroti"]').waitFor();
 await shot(p,`${width}-idle`);
 // Fresh production RNG, no injected result.
 await p.locator('.lounge-start').evaluate(e=>{e.click();e.click();e.click()});await idle(p);let s=await state(p);assert.equal(s.sequence,1);assert.equal(s.balance,1000000-s.pack.slot.stake+s.pack.slot.payout);if(s.pack.slot.cursor<s.pack.slot.frames.length)await p.getByRole('button',{name:'Reveal all',exact:true}).click();
 check(`${width}: fresh natural spin, rapid activation one debit, ten slot tiles`);
 if(process.env.LIVE_ONLY==='1'){await shot(p,`${width}-live-result`);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await ctx.close();continue;}
 for(const name of ['loss','partial','full']){
  const fixture=fixtures[name],r=fixture.pack.slot;await inject(p,fixture);
  assert.equal(await p.locator('.fleet-covered').count(),1);assert.equal(await p.locator('.xeroti-entity').getAttribute('data-hunger-stage'),'0');
  assert.equal(await p.locator('.xeroti-instrument .lit').count(),0);
  await p.getByRole('button',{name:'Reveal saved spin',exact:true}).evaluate(e=>{e.click();e.click()});await p.waitForTimeout(250);assert.equal(await p.locator('.round-active').count(),1);await idle(p);
  assert.deepEqual(await p.locator('.fleet-cell').evaluateAll(es=>es.map(e=>+e.dataset.symbol)),r.frames[0].grid.flat());
  assert.equal((await state(p)).balance,fixture.balance);assert.equal((await state(p)).pack.slot.cursor,1);
  if(r.frames[0].wins.length){assert((await geometry(p)).every(n=>n<1));}
  if(name==='partial'||name==='full'){
   await shot(p,`${width}-${name}-win`);
   await p.getByRole('button',{name:'Next cascade',exact:true}).click();await p.waitForTimeout(150);
   const ghosts=await p.locator('.cascade-ghost').evaluateAll(es=>es.map(e=>({id:+e.dataset.ghost,x:+e.dataset.devourX,y:+e.dataset.devourY,animations:e.getAnimations().map(a=>({duration:a.effect.getTiming().duration,keyframes:a.effect.getKeyframes()}))})));
   assert.equal(ghosts.length,new Set(r.frames[0].wins.flatMap(w=>w.cells)).size);
   assert(ghosts.every(g=>Number.isFinite(g.x)&&g.y<0&&g.animations[0].duration===760));
   await shot(p,`${width}-${name}-devour`);await idle(p);assert.equal((await state(p)).pack.slot.cursor,2);
   await p.reload();await p.locator('[data-slot-game="slot_xeroti"]').waitFor();assert.equal(await p.locator('.round-active').count(),0);
   if(r.frames.length>2)await p.getByRole('button',{name:'Reveal all',exact:true}).click();
  }
  s=await state(p);assert.equal(s.pack.slot.cursor,r.frames.length);assert.equal(s.balance,fixture.balance);assert.equal(s.sequence,1);
  await p.reload();await p.locator('[data-slot-game="slot_xeroti"]').waitFor();assert.equal(await p.locator('.round-active').count(),0);assert.deepEqual(await state(p),s);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await p.locator('.fleet-rules summary').click();assert((await p.locator('.fleet-rules').innerText()).includes('Cascade continuation (1,000,000 spins)'));assert.equal(await p.locator('a[href$="xeroti-slot-math.json"]').count(),1);await p.locator('.fleet-rules summary').click();
 assert.equal(await p.locator('.xeroti-entity img').evaluate(e=>e.complete&&e.naturalWidth>0),true);
 check(`${width}: loss/partial/full25 outcomes, measured veins, 760ms devouring only winners, four-stage cap, saved recovery, no extra debit, readable rules/native art`);
 await ctx.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);
}finally{await fs.writeFile(new URL(`${TAG}-browser.json`,dir),JSON.stringify(report,null,2));await browser.close()}
