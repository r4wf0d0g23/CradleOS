import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=new URL('./',import.meta.url).pathname,base=process.env.QA_BASE??'http://127.0.0.1:5227';
const fixtures=JSON.parse(await readFile(out+'fixtures.json','utf8')),key='cradleos:casino:practice:v2';
const report={base,scope:'Isolated engine-produced saved Play Money and lifecycle browser checks. Viewport emulation, no wallet.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const state=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);
const faces=p=>p.locator('.physical-die').evaluateAll(es=>es.map(e=>+e.dataset.face));
const settle=async p=>{await p.waitForFunction(()=>!document.querySelector('.round-active')&&!Array.from(document.querySelectorAll('.craps-roll')).some(x=>x.textContent.includes('Rolling')),null,{timeout:15000});};
async function run(name,width,fn,fixture){const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}); const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));let r={name,width};try{await p.goto(base+'/#/casino');await p.getByRole('combobox',{name:'Game animation'}).waitFor();if(fixture){await p.evaluate(({key,fixture})=>sessionStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await p.reload();await p.locator('.industrial-dice-stage,.industrial-craps-tray').waitFor();}await fn(p,r);r.ok=true;}catch(e){r.error=e.message;await p.screenshot({path:out+'boundary-'+name+'-'+width+'-error.png'});}finally{report.checks.push(r);await c.close();console.log(name,width,r.ok?'PASS':r.error);await writeFile(out+'boundaries-browser.json',JSON.stringify(report,null,2));}}
try{
for(const width of [320,1440]) for(const which of ['low','high','pending']) await run('saved-'+which,width,async(p,r)=>{
 const craps=which==='pending',title=craps?'Frontier Craps':'Reactor Dice';await p.locator('.industrial-dice-stage,.industrial-craps-tray').waitFor();await p.waitForTimeout(250);const before=await state(p);
 if(craps){assert.equal(await p.locator('.physical-die').count(),0);assert.equal(await p.locator('[aria-label="Saved dice unrevealed"]').count(),1);assert.equal(await p.locator('.die-matched').count(),0);await p.waitForTimeout(2800);assert.deepEqual(await state(p),before);await p.getByRole('button',{name:/Reveal saved roll/}).click();await settle(p);const after=await state(p);assert.deepEqual(after.craps.rolls,before.craps.rolls);assert.equal(after.balance,before.balance);assert.equal(after.craps.sequence,before.craps.sequence);assert.equal(after.craps.pending,false);assert.deepEqual(await faces(p),[3,4]);}
 else {assert.deepEqual(await faces(p),which==='low'?[1,2,3]:[4,5,6]);assert.deepEqual(before,fixtures[which]);await p.reload();await p.locator('.industrial-dice-stage,.industrial-craps-tray').waitFor();await p.waitForTimeout(200);assert.deepEqual(await state(p),before);assert.deepEqual(await faces(p),which==='low'?[1,2,3]:[4,5,6]);}
 await p.locator(craps?'.craps-throw-zone':'.industrial-dice-stage').screenshot({path:out+'saved-'+which+'-'+width+'.png'});r.faces=await faces(p);
},fixtures[which]);
for(const mode of ['instant','system','hidden','resize','reload']) await run(mode,390,async(p,r)=>{
 await p.locator('.lounge-game-tile').filter({hasText:'Triple Resonance'}).click();if(['instant','system'].includes(mode))await p.getByRole('combobox',{name:'Game animation'}).selectOption(mode);
 await p.locator('.lounge-start').click();await p.waitForTimeout(150);const before=await state(p);
 if(mode==='hidden'){await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(100);assert(await p.locator('.physical-die').evaluateAll(es=>es.every(e=>e.dataset.dieProgress==='1')));await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});}
 if(mode==='resize')await p.setViewportSize({width:320,height:900});
 if(mode==='reload'){await p.reload();await p.locator('.industrial-dice-stage').waitFor();}
 if(['system','instant'].includes(mode))assert(await p.locator('.physical-die').evaluateAll(es=>es.every(e=>e.dataset.dieProgress==='1')));
 await settle(p);assert.deepEqual(await state(p),before);assert.deepEqual(await faces(p),before.history[0].values);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));r.faces=await faces(p);
});
await run('craps-midroll-reload',390,async(p,r)=>{
 await p.locator('.lounge-game-tile').filter({hasText:'Frontier Craps'}).click();await p.getByRole('button',{name:/Add Pass line /}).click();await p.locator('.craps-roll').click();await p.waitForTimeout(160);const committed=await state(p);assert(committed.craps.pending);await p.reload();await p.locator('.industrial-craps-tray').waitFor();await p.waitForTimeout(2800);assert.deepEqual(await state(p),committed);assert.equal(await p.locator('.physical-die').count(),0);await p.getByRole('button',{name:/Reveal saved roll/}).click();await settle(p);const after=await state(p);assert.equal(after.balance,committed.balance);assert.deepEqual(after.craps.rolls,committed.craps.rolls);assert(!after.craps.pending);r.faces=await faces(p);
});
}finally{await browser.close();await writeFile(out+'boundaries-browser.json',JSON.stringify(report,null,2));}
assert.equal(report.checks.filter(x=>!x.ok).length,0);assert.deepEqual(report.errors,[]);
