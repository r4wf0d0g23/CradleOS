// Compare production HTML asset references and every generated JS/CSS byte.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dist=new URL('../../cradleos-dapp/dist/',import.meta.url);
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
try {
 const page=await browser.newPage();
 const response=await page.goto('https://cradleos.io/',{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 const html=await response.body(),local=fs.readFileSync(new URL('index.html',dist));
 const refs=s=>[...s.toString().matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]).sort();
 assert.deepEqual(refs(html),refs(local));
 fs.writeFileSync(new URL('live-index.html',import.meta.url),html);
 const assets=[];
 for(const name of fs.readdirSync(new URL('assets/',dist)).filter(n=>/\.(js|css)$/.test(n))){
  const path='assets/'+name,expected=fs.readFileSync(new URL(path,dist));
  const remote=await page.request.get('https://cradleos.io/'+path);
  assert.equal(remote.status(),200);const bytes=await remote.body();
  assert.equal(sha(bytes),sha(expected));assets.push({path,bytes:bytes.length,sha256:sha(bytes),matches:true});
 }
 const receipt={at:new Date().toISOString(),origin:'https://cradleos.io/',htmlStatus:response.status(),htmlSha256:sha(html),localHtmlSha256:sha(local),assetReferencesMatch:true,assets};
 fs.writeFileSync(new URL('live-assets.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} finally {await browser.close();}
