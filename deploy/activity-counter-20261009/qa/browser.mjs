import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.argv[2] || 'http://127.0.0.1:5205/';
const live=process.argv.includes('--live');
const out=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const report={mode:live?'Actual public API and production UI; no mocked activity or wallet signing':'Actual application; intercepted telemetry fixtures only',url,checks:[],errors:[]};
const sample=()=>({schema_version:2,metric:'verified_wallets',window_days:30,since:new Date(Date.now()-30*86400000).toISOString(),generated_at:new Date().toISOString(),wallet_coverage_since:'2026-10-09T00:00:00Z',wallet_mau:2,wallet_dau:1,onchain_mau:2,combined_mau:3,onchain_status:'current',onchain_indexed_at:new Date().toISOString()});
try {
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
  if(!live)await page.route('**/telemetry/combined',r=>r.fulfill({json:sample()}));
  await page.goto(url);const pill=page.locator('[data-activity-counter]');const button=pill.getByRole('button');
  await button.filter({hasText:'verified wallets · 30d'}).waitFor();
  await button.click();await pill.getByText('CradleOS activity',{exact:true}).waitFor();
  assert.equal(await button.getAttribute('aria-expanded'),'true');
  assert((await pill.innerText()).includes('Each wallet counts once'));
  assert((await pill.innerText()).includes('Earlier unverified records are excluded'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const rect=await pill.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0);
  assert((await button.boundingBox()).height>=44);
  await pill.screenshot({path:`${out}${live?'live':'fixture'}-${width}.png`});
  await button.focus();await page.keyboard.press('Enter');assert.equal(await button.getAttribute('aria-expanded'),'false');
  report.checks.push(`${width}: ${await button.innerText()}, expand/collapse, keyboard, touch target, viewport bounds and honest coverage copy`);
  await page.close();
 }
 if(!live){
  const cases=[['zero',{wallet_mau:0,wallet_dau:0,onchain_mau:0,combined_mau:0},'0 verified wallets · 30d'],['stale',{onchain_status:'stale',onchain_mau:null,combined_mau:null},'Activity incomplete'],['unavailable',{onchain_status:'unavailable',onchain_indexed_at:null,onchain_mau:null,combined_mau:null},'Activity incomplete'],['malformed',{combined_mau:99},'Activity unavailable'],['legacy',{schema_version:undefined},'Activity unavailable'],['oldIndex',{onchain_indexed_at:'2020-01-01T00:00:00Z'},'Activity unavailable']];
  for(const [name,patch,text] of cases){const p=await browser.newPage({viewport:{width:320,height:900}});await p.route('**/telemetry/combined',r=>r.fulfill({json:{...sample(),...patch}}));await p.goto(url);await p.locator('[data-activity-counter]').getByRole('button',{name:new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).waitFor();report.checks.push(`${name}: ${text}`);await p.close();}
  const p=await browser.newPage();await p.clock.install();let mode='good',requests=0,offset=0;
  await p.route('**/telemetry/combined',r=>{requests++;return mode==='error'?r.fulfill({status:503,body:'unavailable'}):r.fulfill({json:{...sample(),generated_at:new Date(Date.now()+offset).toISOString(),onchain_indexed_at:new Date(Date.now()+offset).toISOString()}});});
  await p.goto(url);const pill=p.locator('[data-activity-counter]');await pill.getByText('3 verified wallets · 30d',{exact:false}).waitFor();
  mode='error';offset=61000;await p.clock.runFor(61000);await pill.getByText('Activity unavailable',{exact:false}).waitFor();assert(!(await pill.innerText()).includes('3 verified'));
  mode='good';offset=122000;await p.clock.runFor(61000);await pill.getByText('3 verified wallets · 30d',{exact:false}).waitFor();assert(requests>=3);
  report.checks.push('Refresh failure clears cached total; later success restores it');await p.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();await fs.writeFile(out+(live?'live-browser.json':'fixture-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
