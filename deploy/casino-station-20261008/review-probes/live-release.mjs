import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const OUT=new URL('../',import.meta.url),HOST='spark-2def.tail587192.ts.net',PUBLIC_IP='209.177.145.97';
const build=JSON.parse(await fs.readFile(new URL('candidate-build.json',OUT),'utf8'));
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server',`--host-resolver-rules=MAP ${HOST} ${PUBLIC_IP}, EXCLUDE localhost`]});
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await c.newPage(),errors=[],consoleErrors=[],ws=[],financialRequests=[];const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
p.on('request',r=>{if(r.method()==='POST'){try{const x=r.postDataJSON();if(/executeTransaction|signTransaction|sponsor/i.test(x.method??''))financialRequests.push(x.method);}catch{}}});
p.on('websocket',s=>{const record={url:s.url(),binaryFrames:0,states:0,lastStats:null};ws.push(record);s.on('framereceived',({payload})=>{if(typeof payload!=='string')record.binaryFrames++;else{try{const m=JSON.parse(payload);if(m.type==='state'){record.states++;record.lastStats={frames:m.frames,bytes:m.bytes};}}catch{}}});});
const report={scope:'Actual published app without route fulfillment, mocks or save fixtures. Fresh anonymous touch browser. One native slot at a time.',publicRelay:{host:HOST,forcedPublicIP:PUBLIC_IP},viewport:'390x844 touch',pageErrors:errors,consoleErrors,financialRequests,websockets:ws};
try{
 const response=await p.goto('https://cradleos.io/#/casino-station',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
 report.bundleHashes={};for(const [name,expected] of Object.entries(build.artifactHashes)){const res=await c.request.get('https://cradleos.io/assets/'+name);assert.equal(res.status(),200);const actual=hash(await res.body());assert.equal(actual,expected);report.bundleHashes[name]=actual;}
 await p.locator('.station-status i[data-ready=true]').waitFor({timeout:60000});await p.waitForTimeout(900);
 report.canvas=await p.locator('.casino-station>canvas').evaluate(el=>{const ctx=el.getContext('2d'),{data}=ctx.getImageData(0,0,el.width,el.height),colors=new Set();let nonblack=0;for(let i=0;i<data.length;i+=400){const rgb=[data[i],data[i+1],data[i+2]];colors.add(rgb.join(','));if(rgb.some(v=>v>10))nonblack++;}return{width:el.width,height:el.height,sampledColors:colors.size,nonblackSamples:nonblack};});assert(report.canvas.sampledColors>10&&report.canvas.nonblackSamples>10);
 assert(ws.some(s=>s.url.startsWith(`wss://${HOST}:10000/join`)&&s.binaryFrames>1));
 report.noOverflow=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(report.noOverflow);await p.screenshot({path:new URL('review-probes/live-native-mobile.png',OUT).pathname});
 await p.getByRole('button',{name:'Games 34',exact:true}).tap();await p.getByRole('textbox',{name:'Find a game'}).fill('craps');await p.locator('.station-games>button').tap();assert.equal(await p.locator('.frontier-casino').count(),1);
 await p.getByRole('button').filter({hasText:'PASS LINE'}).tap();const saved=await p.evaluate(()=>sessionStorage.getItem('cradleos:casino:practice:v2'));assert(saved);report.savedPracticeSHA256=hash(saved);
 await p.getByRole('button',{name:'← Station floor',exact:true}).tap();await p.locator('.station-status i[data-ready=true]').waitFor({timeout:60000});assert.equal(await p.locator('.frontier-casino').count(),0);assert.equal(await p.evaluate(()=>sessionStorage.getItem('cradleos:casino:practice:v2')),saved);report.returnedNativeAndExactSave=true;
 await p.getByRole('button',{name:'Games 34',exact:true}).tap();await p.getByRole('textbox',{name:'Find a game'}).fill('craps');await p.locator('.station-games>button').tap();assert.equal(await p.locator('.frontier-casino').count(),1);assert.equal(await p.evaluate(()=>sessionStorage.getItem('cradleos:casino:practice:v2')),saved);report.remountExactSave=true;
 report.noGameOverflow=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(report.noGameOverflow);
 report.noDevToolbar=(await p.locator('[data-dev-toolbar],.dev-toolbar,.debug-toolbar').count())===0;
 assert.deepEqual(errors,[]);assert.deepEqual(financialRequests,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;throw e;}
finally{report.activeConsoleErrors=[...consoleErrors];report.activePageErrors=[...errors];await fs.writeFile(new URL('live-release-review.json',OUT),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await c.close();await b.close();}
