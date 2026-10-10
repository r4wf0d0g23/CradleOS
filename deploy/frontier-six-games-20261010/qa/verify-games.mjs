import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname,base=process.env.QA_BASE??'http://127.0.0.1:5230',tag=process.env.QA_TAG??'preview';
const games={frontier_remainder:'Reactor Remainder',frontier_broker:'Derelict Broker',frontier_holdem:'Command Hold’em',frontier_wing:'Wing Command',frontier_race:'Gate Runner',frontier_pusher:'Salvage Pusher'};
const widths=(process.env.QA_WIDTHS??'320,390,1440').split(',').map(Number),key='cradleos:casino:practice:v2';
const report={base,mode:'Fresh tab-local Play Money; pointer/viewport emulation, no wallet',checks:[],errors:[],assetFailures:[]};
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const read=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);
const idle=p=>p.waitForFunction(()=>document.querySelector('.frontier-games')?.dataset.running==='false',null,{timeout:20000});
const click=(p,name)=>p.getByRole('button',{name,exact:true}).click();
async function secrecy(p,game){
 if(game==='frontier_holdem'){assert.equal(await p.locator('.fn-poker>section').first().locator('[data-value]').count(),0,'dealer concealed');}
 if(game==='frontier_wing'){assert.equal(await p.locator('.fn-wing-dealer [data-value]').count(),0,'wing dealer concealed');}
 if(game==='frontier_broker'){assert.equal(await p.locator('.fn-cargo.owned.opened').count(),0,'owned cargo concealed');}
}
try{for(const width of widths)for(const [game,name] of Object.entries(games).filter(([key])=>!process.env.QA_FILTER||process.env.QA_FILTER.split(',').includes(key))){
 const c=await b.newContext({viewport:{width,height:1000},reducedMotion:width===1440?'reduce':'no-preference',hasTouch:width<500,isMobile:width<500});const p=await c.newPage();const row={width,game};
 p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&/casino\/|icons-cycle7/.test(r.url()))report.assetFailures.push([r.url(),r.status()]);});
 try{
 await p.goto(base+'/#/casino');await p.locator('.lounge-game-tile').filter({hasText:name}).click();
 assert.equal(await p.getByRole('combobox',{name:'Game animation'}).inputValue(),'animated');
 await click(p,game==='frontier_remainder'?'Sort ore':game==='frontier_broker'?'Open contract':game==='frontier_race'?'Launch race':game==='frontier_pusher'?'Drop · 25 chips':'Deal');
 const initial=await read(p);assert(initial.frontier);const sealed=initial.frontier.current.draw,id=initial.frontier.current.id;
 assert.equal(initial.balance,1000000-(game==='frontier_holdem'?5000:2500));
 const snap=()=>p.locator('.fn-scene').evaluate(e=>({p:e.dataset.progress,transforms:[...e.querySelectorAll('[transform],.fn-runner,.motion-card')].slice(0,100).map(n=>n.getAttribute('transform')??n.getAttribute('style'))}));
 const f1=await snap();await p.waitForTimeout(300);const f2=await snap();assert.notDeepEqual(f1,f2,'animation progresses');row.frames=[f1.p,f2.p];
 if(['frontier_holdem','frontier_wing'].includes(game)){for(let i=0;i<5;i++){await secrecy(p,game);await p.waitForTimeout(130);}}
 if(width===320){await p.reload();await p.locator(`[data-frontier-game=${game}]`).waitFor();assert.deepEqual((await read(p)).frontier.current.draw,sealed);row.pendingReload=true;}
 await idle(p);
 if(game==='frontier_broker'){
   await click(p,'Cargo 1');for(let i=0;i<5;i++){await secrecy(p,game);await p.waitForTimeout(140);}await idle(p);
   for(let i=2;i<=4;i++){await click(p,`Cargo ${i}`);for(let j=0;j<4;j++){await secrecy(p,game);await p.waitForTimeout(160);}await idle(p);}
   await p.locator('.fn-scene').screenshot({path:out+`${tag}-${width}-${game}-offer.png`});await click(p,'Accept');
 } else if(game==='frontier_holdem'){
   await secrecy(p,game);await click(p,'Check');for(let i=0;i<4;i++){await secrecy(p,game);await p.waitForTimeout(170);}await idle(p);
   assert.equal(await p.locator('.fn-community [data-value]').count(),3);await click(p,'Check');await idle(p);await secrecy(p,game);
   assert.equal(await p.locator('.fn-community [data-value]').count(),5);await click(p,'Raise 1× · 25');
 } else if(game==='frontier_wing'){
   await secrecy(p,game);await click(p,'Auto-arrange');assert.equal(await p.locator('.fn-wing-selection button[aria-pressed=true]').count(),2);await p.locator('.fn-scene').screenshot({path:out+`${tag}-${width}-${game}-formation.png`});await click(p,'Lock formation');
 }else if(width===320){await click(p,'Reveal saved round');}
 await idle(p);const final=await read(p);assert(final.frontier.current.collected);const receipt=final.frontier.history[0];assert.equal(final.balance,1000000-receipt.wager+receipt.payout);assert.deepEqual(final.frontier.current.draw,sealed);assert.equal(final.frontier.current.id,id);row.receipt=receipt;
 row.overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(row.overflow<=1,'no page overflow');
 await p.locator('.fn-scene').screenshot({path:out+`${tag}-${width}-${game}-result.png`});
 const status=await p.locator('.fn-status').innerText();row.status=status;await p.reload();const reloaded=await read(p);assert.deepEqual(reloaded,final,'settled save survives reload');row.ok=true;
 }catch(e){row.error=e.stack;await p.screenshot({path:out+`${tag}-${width}-${game}-error.png`}).catch(()=>{});}finally{console.log(width,game,row.ok?'PASS':row.error);report.checks.push(row);await writeFile(out+tag+'-games.json',JSON.stringify(report,null,2));await c.close();}
}}finally{await b.close();await writeFile(out+tag+'-games.json',JSON.stringify(report,null,2));}
assert.equal(report.checks.filter(r=>!r.ok).length,0);assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetFailures,[]);
