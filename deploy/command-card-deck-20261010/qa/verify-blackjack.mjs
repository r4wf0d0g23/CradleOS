import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const OUT=new URL('./',import.meta.url).pathname,BASE=process.env.QA_URL??'http://127.0.0.1:5213/',TAG=process.env.QA_TAG??'blackjack',KEY='cradleos:casino:practice:v2';
const {fixtures}=JSON.parse(await fs.readFile(new URL('../../blackjack-astral-20261009/qa/fixtures.json',import.meta.url),'utf8'));
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const report={url:BASE,checks:[],errors:[],assetFailures:[],frames:[]};
const read=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),KEY);
const idle=p=>p.waitForFunction(()=>!document.querySelector('.round-active'));
async function inject(p,state){await p.evaluate(([k,s])=>sessionStorage.setItem(k,JSON.stringify(s)),[KEY,state]);await p.reload();await p.locator('.astral-table').waitFor();}
async function probe(p){return p.locator('.astral-slot').evaluateAll(es=>es.map(e=>({value:e.dataset.value,p:+e.dataset.cardProgress,flying:e.dataset.flying,aria:e.getAttribute('aria-label'),flight:e.querySelector('.astral-flight').style.transform,hover:getComputedStyle(e.querySelector('.astral-hover')).transform})));}
async function noOverflow(p){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'viewport overflow');assert(await p.locator('.astral-table').evaluate(e=>e.scrollWidth<=e.clientWidth+2),'table overflow');}
try{
for(const width of JSON.parse(process.env.QA_WIDTHS??'[320,1440]')){
 const ctx=await b.newContext({viewport:{width,height:1100},hasTouch:width<1000}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().includes('/icons-cycle7')&&r.status()>=400)report.assetFailures.push(r.url());});
 await p.goto(BASE+'#/casino');await p.locator('.lounge-game-tile').filter({has:p.getByRole('heading',{name:'Command Deck',exact:true})}).click();
 await p.getByRole('button',{name:'Pause drift',exact:true}).click();assert.equal(await p.locator('.astral-table').getAttribute('data-drift'),'off');
 await p.locator('.lounge-start').click();const paid=await read(p);await p.waitForTimeout(170);const first=await probe(p);await p.waitForTimeout(210);const second=await probe(p);assert(first.some((v,i)=>v.flight!==second[i].flight),'cards actually fly');assert(second.filter(c=>c.p<.5).every(c=>c.value===undefined&&c.aria==='Unrevealed card'),'early faces masked');assert.equal(await p.locator('.astral-table').getAttribute('data-drift'),'off','paused drift survives idle-to-hand remount');
 await idle(p);assert.deepEqual(await read(p),paid,'animation cannot rewrite ledger');await noOverflow(p);report.frames.push({width,first,second});report.checks.push(`${width}: fresh deal curves from shoe, early faces masked, ledger unchanged, pause preference survives deal`);
 await inject(p,fixtures.one);const before=await read(p);assert.deepEqual(before,fixtures.one);assert.equal((await probe(p)).filter(c=>c.value===undefined).length,1,'hole card remains hidden after reload');
 await p.getByRole('button',{name:'Resume drift',exact:true}).click();let hover=(await probe(p))[0].hover;await p.waitForTimeout(220);assert.notEqual((await probe(p))[0].hover,hover,'settled cards float');
 await p.getByRole('button',{name:'Hit',exact:true}).click();await p.waitForTimeout(200);let hit=await probe(p);assert.equal(hit.filter(c=>c.flying==='true').length,1,'only new hit card flies');await idle(p);assert.deepEqual(await read(p),fixtures.hit,'hit exact existing engine result');
 await inject(p,fixtures.one);await p.getByRole('button',{name:/^Double/}).click();await idle(p);assert.deepEqual(await read(p),fixtures.double,'double exact existing engine result');report.checks.push(`${width}: reload hole masking, visible hover, hit-only flight, exact hit/double accounting`);
 await inject(p,fixtures.split);await p.getByRole('button',{name:/^Split/}).click();await p.waitForTimeout(260);const other=await p.locator('.casino-seat-grid section').nth(2).locator('.astral-slot').evaluateAll(es=>es.map(e=>({p:+e.dataset.cardProgress,fly:e.dataset.flying})));assert(other.every(c=>c.p===1&&c.fly==='false'),'unaffected split seat not redealt');await idle(p);assert.deepEqual(await read(p),fixtures.splitNext);await p.locator('.astral-table').scrollIntoViewIfNeeded();await p.locator('.astral-table').screenshot({path:`${OUT}${TAG}-${width}-split.png`});await noOverflow(p);
 let turns=0;while((await read(p)).table){await p.getByRole('button',{name:'Stand',exact:true}).click();await idle(p);assert(++turns<8);}
 const settled=await read(p),table=settled.pack.table;assert.deepEqual((await probe(p)).map(c=>+c.value),[...table.dealer,...table.hands.flatMap(h=>h.cards)]);await p.reload();await p.locator('.astral-table').waitFor();assert.deepEqual(await read(p),settled);report.checks.push(`${width}: split preserves unrelated seats, all hands settle to exact shoe, reload preserves ledger`);
 await p.getByRole('button',{name:'Pause drift',exact:true}).click();hover=(await probe(p))[0].hover;await p.waitForTimeout(150);assert.equal((await probe(p))[0].hover,hover);await p.reload();await p.locator('.astral-table').waitFor();assert.equal(await p.locator('.astral-table').getAttribute('data-drift'),'off');assert.equal(await p.locator('.astral-drift-toggle').evaluate(e=>e.getBoundingClientRect().height>=44),true);report.checks.push(`${width}: pause halts float, survives reload, 44px accessible control`);
 await ctx.close();
}
const ctx=await b.newContext({viewport:{width:390,height:1000}}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(BASE+'#/casino');
for(const boundary of ['reduce-back','hidden','reload','resize']){
 await p.emulateMedia({reducedMotion:'no-preference'});await inject(p,fixtures.one);await p.getByRole('button',{name:'Hit',exact:true}).click();const committed=await read(p);await p.waitForTimeout(160);
 if(boundary==='reduce-back'){await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(60);assert.equal(await p.locator('.astral-table').getAttribute('data-drift'),'off');await p.emulateMedia({reducedMotion:'no-preference'});}
 if(boundary==='hidden')await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 if(boundary==='reload')await p.reload();
 if(boundary==='resize')await p.setViewportSize({width:320,height:1000});
 await idle(p);assert.deepEqual(await read(p),committed);assert((await probe(p)).every(c=>c.p===1));await noOverflow(p);report.checks.push(`${boundary}: paid hand preserved, no replay or duplicate settlement`);
 if(boundary==='hidden')await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
}
await p.emulateMedia({reducedMotion:'reduce'});await inject(p,fixtures.one);await p.getByRole('button',{name:'Hit',exact:true}).click();await idle(p);assert.deepEqual(await read(p),fixtures.hit);assert.equal(await p.locator('.astral-table').getAttribute('data-drift'),'off');assert.equal(await p.locator('.astral-table').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);report.checks.push('OS reduction + Animated: exact finite reveal outcome; no ongoing ambient drift');
await ctx.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetFailures,[]);console.log(JSON.stringify({checks:report.checks,errors:report.errors,assetFailures:report.assetFailures},null,2));
}catch(e){report.failure=String(e);throw e;}finally{await fs.writeFile(`${OUT}${TAG}-browser.json`,JSON.stringify(report,null,2));await b.close();}
