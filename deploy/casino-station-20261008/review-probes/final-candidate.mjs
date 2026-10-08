import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url),dist=path.resolve('cradleos-dapp/dist'),frame=await fs.readFile(new URL('frame.jpg',root));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox']});const c=await b.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});const p=await c.newPage(),errors=[],wsURLs=[],tx=[];
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST'){try{const v=r.postDataJSON();if(/executeTransaction|signTransaction|sponsor/i.test(v.method??''))tx.push(v.method);}catch{}}});
await p.addInitScript(()=>Object.defineProperty(window,'VideoDecoder',{value:undefined,configurable:true}));
await p.route('https://cradleos.io/**',async route=>{const u=new URL(route.request().url()),f=path.join(dist,u.pathname==='/'?'index.html':u.pathname);try{await route.fulfill({status:200,contentType:mime[path.extname(f)]||'application/octet-stream',body:await fs.readFile(f)});}catch{await route.continue();}});
await p.routeWebSocket(/\/join(?:\?|$)/,ws=>{wsURLs.push(ws.url());setTimeout(()=>{ws.send(JSON.stringify({type:'joined',codec:'jpeg'}));ws.send(Buffer.concat([Buffer.alloc(17),frame]));},20);});
try{
 await p.goto('https://cradleos.io/#/casino');await p.locator('.frontier-casino').waitFor();
 const entry=p.getByRole('button',{name:'Station ↗',exact:true});await entry.waitFor();const rect=await entry.boundingBox();assert(rect.width>=40&&rect.x>=0&&rect.x+rect.width<=320);
 await entry.tap();await p.locator('.station-status i[data-ready=true]').waitFor();assert.equal(await p.locator('.frontier-casino').count(),0);
 assert.match(wsURLs[0],/^wss:\/\/spark-2def\.tail587192\.ts\.net:10000\/join/);
 await p.getByRole('button',{name:'Games 34',exact:true}).tap();await p.getByRole('textbox',{name:'Find a game'}).fill('craps');await p.locator('.station-games>button').tap();assert.equal(await p.locator('.frontier-casino').count(),1);
 await p.getByRole('button').filter({hasText:'PASS LINE'}).tap();const save=await p.evaluate(()=>sessionStorage.getItem('cradleos:casino:practice:v2'));assert(save);
 await p.getByRole('button',{name:'← Station floor',exact:true}).tap();await p.locator('.station-status i[data-ready=true]').waitFor();assert.equal(await p.locator('.frontier-casino').count(),0);assert.equal(await p.evaluate(()=>sessionStorage.getItem('cradleos:casino:practice:v2')),save);
 await p.getByRole('button',{name:'Games 34',exact:true}).tap();await p.getByRole('textbox',{name:'Find a game'}).fill('craps');await p.locator('.station-games>button').tap();assert.equal(await p.evaluate(()=>sessionStorage.getItem('cradleos:casino:practice:v2')),save);
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await p.screenshot({path:new URL('final-candidate-320.png',root).pathname,fullPage:true});
 const report={pass:true,scope:'Reviewed compiled dist fulfilled at primary origin; WebSocket transport mocked, no native slot or public app deployment claim',viewport:'320x568 touch',lobbyStationEntry:true,entryRect:rect,expectedWssEndpoint:wsURLs[0],oneLedgerOwner:true,unmountedOnReturn:true,crapsEscrowExactAcrossReturnRemount:true,noHorizontalOverflow:!overflow,pageErrors:errors,financialRequests:tx};assert.deepEqual(errors,[]);assert.deepEqual(tx,[]);await fs.writeFile(new URL('final-candidate.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await c.close();await b.close();}
