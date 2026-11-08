import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {catalog} from '../site/catalog.js';
const b=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',env:{...process.env,CHROME_DEVEL_SANDBOX:'/opt/nvidia/dgx-oobe-desktop/chrome-sandbox'}});
try{for(const g of catalog){const p=await b.newPage({viewport:{width:1000,height:900}});await p.goto('http://127.0.0.1:5370/games/'+g.id+'/');await p.getByRole('button',{name:'PLAY',exact:true}).click();await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+100));
if(g.id==='gatebreaker')await p.locator('[data-action=primary]').click();
if(g.id==='scrapline-defense'){await p.locator('[data-action="build:cutter"]').click();await p.locator('[data-action=wave]').click();}
await p.clock.runFor(g.id==='signal-diver'?4000:6000);
const r=await p.locator('#arena').boundingBox(),side=Math.min(r.width,r.height);await p.screenshot({path:new URL('cover-'+g.id+'.png',import.meta.url).pathname,clip:{x:r.x+(r.width-side)/2,y:r.y+(r.height-side)/2,width:side,height:side}});await p.close();}}finally{await b.close()}
