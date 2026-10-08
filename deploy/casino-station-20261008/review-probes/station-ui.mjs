import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
const root=new URL('./',import.meta.url),frame=await fs.readFile(new URL('frame.jpg',root));
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
const p=await context.newPage(),inputs=[],errors=[],sockets=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{Object.defineProperty(window,'VideoDecoder',{value:undefined,configurable:true});});
await p.routeWebSocket(/\/join(?:\?|$)/,ws=>{sockets.push(ws);ws.onMessage(x=>{try{const m=JSON.parse(x);if(m.type==='input')inputs.push(m);}catch{}});setTimeout(()=>{ws.send(JSON.stringify({type:'joined',codec:'jpeg'}));ws.send(Buffer.concat([Buffer.alloc(17),frame]));ws.send(JSON.stringify({type:'state',terminal:0}));},10);});
try{
 await p.goto('http://127.0.0.1:5320/#/casino-station');
 const join=p.getByRole('button',{name:'Join station',exact:true});if(await join.isVisible().catch(()=>false))await join.click();
 await p.locator('.station-status i[data-ready=true]').waitFor();
 await p.getByRole('button',{name:'Station controls',exact:true}).click();
 const start=inputs.length;await p.mouse.move(100,430);await p.mouse.down();await p.mouse.move(160,430);await p.waitForTimeout(170);await p.mouse.up();
 const movedWithHelp=inputs.slice(start).some(v=>Object.values(v).some((x,i)=>i>0&&typeof x==='number'&&x!==0));
 await p.screenshot({path:new URL('station-320-help.png',root).pathname});
 const geometry=await p.locator('.station-help').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,viewport:innerWidth};});
 await p.getByRole('button',{name:'Close controls'}).click();
 await p.getByRole('button',{name:/^Games/}).click();const gameCount=await p.locator('.station-games>button').count();
 await p.locator('.station-games>button').filter({has:p.locator('strong',{hasText:'CRAPS'})}).click();await p.locator('.frontier-casino').waitFor();
 const ledgerOwners=await p.locator('.frontier-casino').count();await p.getByRole('button',{name:'Station floor'}).click();await p.locator('.station-bar').waitFor();const afterReturnOwners=await p.locator('.frontier-casino').count();
 const report={method:'actual React UI, isolated mocked video transport; no native slots consumed',movedWithHelp,geometry,gameCount,ledgerOwners,afterReturnOwners,joinedSockets:sockets.length,pageErrors:errors};
 await fs.writeFile(new URL('station-ui.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();}
