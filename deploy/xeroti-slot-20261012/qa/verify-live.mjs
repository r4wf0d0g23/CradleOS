import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url),dist=new URL('cradleos-dapp/dist/',root),html=await fs.readFile(new URL('index.html',dist),'utf8');
const paths=[...html.matchAll(/(?:src|href)="(\/assets\/index-[^"]+)"/g)].map(m=>m[1]).concat(['/assets/casino/xeroti/xeroti-hero.webp','/assets/casino/xeroti/xeroti-symbol.png','/casino/xeroti-slot-math.json']);
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
try{const page=await browser.newPage();await page.goto('https://cradleos.io/#/casino');await page.locator('.lounge-game-tile').first().waitFor();const served=await page.content();assert(paths.slice(0,2).every(p=>served.includes(p)));const verified=[];
for(const path of paths){const result=await page.evaluate(async path=>{const r=await fetch(path);if(!r.ok)throw Error(String(r.status));const a=await r.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',a);return{path,sha256:[...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,'0')).join(''),bytes:a.byteLength}},path);const local=await fs.readFile(new URL(path.slice(1),dist));assert.equal(result.sha256,createHash('sha256').update(local).digest('hex'));verified.push(result)}
await fs.writeFile(new URL('../live-build.json',import.meta.url),JSON.stringify({origin:'https://cradleos.io',transport:'Chromium same-origin fetch; direct urllib request received403',status:'exact-match',verified},null,2));console.log(verified);
}finally{await browser.close()}
