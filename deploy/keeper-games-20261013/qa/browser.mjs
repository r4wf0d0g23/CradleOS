import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const DIR=new URL('./',import.meta.url),URLBASE=process.env.QA_URL??'http://127.0.0.1:5250/',TAG=process.env.QA_TAG??'preview',KEY='cradleos:casino:practice:v2',live=process.env.LIVE_ONLY==='1';
const f=JSON.parse(await fs.readFile(new URL('fixtures.json',DIR))),report={url:URLBASE,checks:[],errors:[],badAssets:[]};
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const names={keeper_cipher:'Keeper’s Cipher',keeper_archive:'Archive Resonance',keeper_passage:'Keeper’s Passage'},glyphs=['Shard','Echo','Orbit','Pulse','Veil','Anchor'];
const state=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY);
const idle=p=>p.waitForFunction(()=>document.querySelector('.keeper-games')?.dataset.running==='false');
async function open(p,game){await p.goto(URLBASE+'#/casino');await p.locator('.lounge-game-tile').first().waitFor();assert.equal(await p.locator('.lounge-game-tile').count(),44);await p.locator('.lounge-game-tile').filter({hasText:names[game]}).click();await p.locator('.keeper-games').waitFor();}
async function inject(p,s,mode='animated'){await p.evaluate(([k,s,m])=>{sessionStorage.setItem(k,JSON.stringify(s));localStorage.setItem('cradleos:casino:slot-motion:v1',m)},[KEY,s,mode]);await p.reload();await p.locator('.keeper-games').waitFor();await idle(p);}
async function guess(p,values){for(const n of values)await p.getByRole('button',{name:`Add ${glyphs[n]}`,exact:true}).click();await p.getByRole('button',{name:'Transmit code',exact:true}).click();}
async function photo(p,n){await p.locator('.keeper-games').screenshot({path:new URL(`${TAG}-${n}.png`,DIR).pathname});}
async function bounded(p){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await p.locator('.keeper-games').evaluate(el=>[...el.querySelectorAll('button')].filter(e=>e.offsetWidth&&e.offsetHeight).every(e=>{const a=e.getBoundingClientRect();return a.left>=0&&a.right<=innerWidth+1})));}
function check(s){report.checks.push(s);console.log(s)}
try{
 for(const width of JSON.parse(process.env.QA_WIDTHS??'[320,390,1440]')){
  for(const game of Object.keys(names)){
   const ctx=await browser.newContext({viewport:{width,height:1000},hasTouch:width<1000,reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(URLBASE)&&r.status()>=400&&/keeper\//.test(r.url()))report.badAssets.push(r.url())});
   await open(p,game);await bounded(p);await photo(p,`${width}-${game}-idle`);
   await p.locator('.kp-controls .kp-primary').evaluate(e=>{e.click();e.click();e.click()});await idle(p);let s=await state(p);assert.equal(s.frontier.sequence,1);assert.equal(s.balance,997500);assert.equal(s.frontier.current.actions.length,0);
   if(game==='keeper_cipher'){assert.equal(await p.locator('.kp-secret .kp-unknown').count(),3);await guess(p,[0,1,2]);await idle(p);s=await state(p);if(!s.frontier.current.collected){await p.getByRole('button',{name:'End trial · 0 return',exact:true}).click();await idle(p);}}
   if(game==='keeper_archive'){await p.getByRole('button',{name:'Hold all',exact:true}).click();await p.getByRole('button',{name:'Keep all',exact:true}).click();await idle(p);}
   if(game==='keeper_passage'){await p.getByRole('button',{name:'Stage 1 gate 1',exact:true}).click();await idle(p);s=await state(p);if(!s.frontier.current.collected){await p.locator('.kp-controls .kp-primary').click();await idle(p);}}
   s=await state(p);assert(s.frontier.current.collected);assert.equal(s.balance,997500+s.frontier.history[0].payout);await bounded(p);await photo(p,`${width}-${game}-natural`);
   const saved=JSON.stringify(s);await p.reload();await p.locator('.lounge-game-tile').first().waitFor();assert.equal(JSON.stringify(await state(p)),saved);await p.locator('.lounge-game-tile').filter({hasText:names[game]}).click();await idle(p);assert.equal(JSON.stringify(await state(p)),saved);
   check(`${width} ${game}: fresh natural round, one debit, correct saved payout, completed reload silent, bounds`);
   if(!live){
    if(game==='keeper_cipher'){
     await inject(p,f.cipher);await guess(p,[2,1,0]);await p.waitForTimeout(250);assert.equal(await p.locator('[data-clue="1,2"]').count(),0);await idle(p);assert.equal(await p.locator('[data-clue="1,2"]').count(),1);await guess(p,[0,1,2]);await p.waitForTimeout(250);assert.equal(await p.locator('.kp-secret .kp-unknown').count(),3);await photo(p,`${width}-cipher-transmission`);await idle(p);s=await state(p);assert.equal(s.frontier.history[0].payout,11250);assert.deepEqual(await p.locator('.kp-secret .kp-glyph small').allTextContents(),['Shard','Echo','Orbit']);await photo(p,`${width}-cipher-win`);
     await inject(p,f.cipherDone);assert.equal(await p.locator('.kp-secret .kp-unknown').count(),3);assert.equal((await state(p)).balance,997500);await p.getByRole('button',{name:'Reveal result',exact:true}).evaluate(e=>{e.click();e.click()});await idle(p);assert.equal((await state(p)).balance,1042500);
    }
    if(game==='keeper_archive'){
     await inject(p,f.archive);for(let i=0;i<3;i++)await p.locator('.kp-archive-glyph').nth(i).click();await p.getByRole('button',{name:'Redraw 2',exact:true}).click();await p.waitForTimeout(300);assert.deepEqual(await p.locator('.kp-archive-glyph .kp-glyph small').allTextContents(),['Shard','Shard','Shard','Echo','Orbit']);const pose=await p.locator('.kp-archive-glyph').evaluateAll(es=>es.map(e=>getComputedStyle(e).transform));assert.equal(pose[0],'none');assert.notEqual(pose[4],'none');await photo(p,`${width}-archive-redraw`);await idle(p);assert.equal((await state(p)).frontier.history[0].payout,45000);assert.deepEqual(await p.locator('.kp-archive-glyph .kp-glyph small').allTextContents(),Array(5).fill('Shard'));await photo(p,`${width}-archive-win`);
     await inject(p,f.archiveDone);assert.deepEqual(await p.locator('.kp-archive-glyph .kp-glyph small').allTextContents(),['Shard','Shard','Shard','Echo','Orbit']);await p.getByRole('button',{name:'Reveal result',exact:true}).click();await idle(p);assert.equal((await state(p)).balance,1042500);
    }
    if(game==='keeper_passage'){
     await inject(p,f.passage);await p.getByRole('button',{name:/Deep/}).click();await p.getByRole('button',{name:'Stage 1 gate 1',exact:true}).click();await p.waitForTimeout(250);assert.equal(await p.locator('.kp-safe').count(),0);await idle(p);assert.equal(await p.locator('.kp-safe').count(),2);assert.equal(await p.locator('.kp-chosen').count(),1);await p.getByRole('button',{name:/Bank 48/}).click();await idle(p);assert.equal((await state(p)).balance,1002300);await photo(p,`${width}-passage-bank`);
     await inject(p,f.passage);await p.getByRole('button',{name:/Deep/}).click();await p.getByRole('button',{name:'Stage 1 gate 4',exact:true}).click();await idle(p);assert.equal((await state(p)).balance,997500);assert.equal(await p.locator('.kp-closed.kp-chosen').count(),1);await photo(p,`${width}-passage-loss`);
     await inject(p,f.passageLoss);assert.equal(await p.locator('.kp-safe').count(),0);await p.getByRole('button',{name:'Reveal result',exact:true}).click();await idle(p);assert.equal((await state(p)).balance,997500);
    }
    await bounded(p);check(`${width} ${game}: deterministic reveal boundaries, outcomes, motion and pending reload/collect once`);
   }
   await ctx.close();
  }
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);
}finally{await fs.writeFile(new URL(`${TAG}-browser.json`,DIR),JSON.stringify(report,null,2));await browser.close()}
