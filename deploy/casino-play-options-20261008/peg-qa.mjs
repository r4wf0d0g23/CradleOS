import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.QA_URL||'http://127.0.0.1:5199/';
const out=process.env.QA_OUT||'research/cradleos-plinko-20261008/local';await mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox']});
const report={base,checks:[],pageerrors:[]};const key='cradleos:casino:practice:v2';
const ledger=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);
try{
for(const [width,bits] of [[320,Array(12).fill(0)],[390,Array(12).fill(1)],[1440,[0,1,0,1,0,1,1,0,1,1,0,0]]]){
 const p=await b.newPage({viewport:{width,height:900},hasTouch:width<700,reducedMotion:'no-preference'});p.on('pageerror',e=>report.pageerrors.push(String(e)));
 await p.addInitScript(()=>{const native=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=function(a){if(a instanceof Uint32Array && a.length===1 && window.qaBits?.length){a[0]=window.qaBits.shift();return a;}return native(a);};});
 await p.goto(base+'#/casino');await p.getByRole('heading',{name:'Practice floor'}).waitFor();await p.locator('.lounge-game-tile').filter({has:p.getByRole('heading',{name:'Debris Drop',exact:true})}).click();
 await p.getByLabel('Stake in play chips').fill('25');await p.evaluate(bits=>{window.qaBits=[...bits];},bits);
 // Capture real animation frames after the actual button event, no timer acceleration.
 const frames=await p.evaluate(async()=>{const frames=[];document.querySelector('.lounge-start').click();document.querySelector('.lounge-start').click();const start=performance.now();return await new Promise(resolve=>{const take=()=>{const ball=document.querySelector('.plinko-ball'),impact=document.querySelector('.plinko-impact');frames.push({ms:performance.now()-start,x:ball?+ball.getAttribute('cx'):null,y:ball?+ball.getAttribute('cy'):null,impact:impact?[+impact.getAttribute('cx'),+impact.getAttribute('cy')]:null,busy:!!document.querySelector('.round-active'),landed:document.querySelector('.lounge-plinko svg')?.getAttribute('data-landed')});if(performance.now()-start<2550)requestAnimationFrame(take);else resolve(frames);};requestAnimationFrame(take);});});
 const state=await ledger(p);assert.equal(state.sequence,1);assert.deepEqual(state.history[0].values,bits);const bucket=bits.reduce((a,b)=>a+b,0),final=frames.at(-1);assert.equal(final.x,42+bucket*18);assert.equal(final.y,219);assert.equal(final.landed,'true');assert.equal(final.busy,false);
 assert.equal(state.balance,1000000-2500+state.history[0].payout);
 const observed=[...new Set(frames.filter(f=>f.impact).map(f=>(f.impact[1]-24)/16))].sort((a,b)=>a-b);assert.deepEqual(observed,Array.from({length:12},(_,i)=>i));
 assert.ok(Math.max(...frames.map(f=>f.x??150))-Math.min(...frames.map(f=>f.x??150))>=8,'ball must visibly move laterally');
 for(const row of observed){const hits=frames.filter(f=>f.impact&&(f.impact[1]-24)/16===row);assert.ok(hits.some(f=>Math.hypot(f.x-f.impact[0],f.y-f.impact[1])<8.5),'visible peg contact '+row);}
 assert.equal(await p.locator(`[data-bucket="${bucket}"]`).getAttribute('data-hit'),'true');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:`${out}/landed-${width}.png`,fullPage:true});await writeFile(`${out}/frames-${width}.json`,JSON.stringify(frames));report.checks.push({width,bucket,frames:frames.length,all12PegContacts:observed,balanceConserved:true});
 // Reduced-motion skips travel; same committed bit sequence still determines payout.
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(bits=>window.qaBits=[...bits],bits);await p.locator('.lounge-start').click();await p.waitForFunction(()=>!document.querySelector('.round-active'));assert.equal((await ledger(p)).sequence,2);assert.equal(await p.locator('.plinko-ball').getAttribute('cx'),String(42+bucket*18));assert.equal(await p.locator('.plinko-impact').count(),0);
 // Reload mid-flight does not redraw, debit or replay a stake.
 await p.emulateMedia({reducedMotion:'no-preference'});await p.evaluate(bits=>window.qaBits=[...bits],bits);await p.locator('.lounge-start').click();const saved=await ledger(p);await p.reload();await p.locator('.plinko-ball').waitFor();assert.deepEqual(await ledger(p),saved);assert.equal(await p.locator('.plinko-ball').getAttribute('cx'),String(42+bucket*18));
 // Refill resets numeric IDs. A fresh id1 must start at the top, not reuse old frame.
 await p.getByRole('button',{name:'Refill',exact:true}).click();await p.getByRole('button',{name:'Reset chips',exact:true}).click();await p.evaluate(bits=>window.qaBits=[...bits],bits);const first=await p.evaluate(async()=>{document.querySelector('.lounge-start').click();return await new Promise(resolve=>requestAnimationFrame(()=>{const el=document.querySelector('.plinko-ball');resolve({x:+el.getAttribute('cx'),y:+el.getAttribute('cy')});}));});assert.equal(first.x,150);assert.ok(first.y<18);
 await p.close();
}
assert.equal(report.pageerrors.length,0);report.ok=true;
}catch(e){report.error=String(e);report.ok=false;process.exitCode=1;console.error(e);}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await b.close();}
