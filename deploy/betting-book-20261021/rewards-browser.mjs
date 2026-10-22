// Real published book, no fixtures, wallet connections, signatures or transactions.
import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BOOK_QA_BASE??'http://127.0.0.1:5231';
const label=process.env.BOOK_QA_LABEL??'preview';
assert.ok(['preview','live'].includes(label));
const executablePath=process.env.BOOK_BROWSER_EXECUTABLE;
if(!executablePath)throw Error('Supply a sandbox-capable Chromium executable; sandbox is required.');
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath});
const checks=[];
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#/casino',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Betting Book',exact:true}).click();
  await page.getByText('No markets yet',{exact:true}).waitFor({timeout:30000});
  await page.getByText('New bets paused',{exact:true}).waitFor();
  await page.getByText('No rewards yet',{exact:true}).waitFor();
  assert.equal(await page.getByText('Book unavailable',{exact:false}).count(),0);
  assert.equal(await page.getByText('Setup pending',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Review bet',exact:true}).count(),0);
  await page.locator('.book-deliveries summary').filter({hasText:'Sponsor a reward'}).click();
  for(const name of ['Title','Origin SSU','Item type','Exact quantity','Deadline · UTC','Reward · EVE'])await page.getByLabel(name,{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Review reward',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.locator('.betting-book').screenshot({path:new URL(`rewards-${label}-${width}.png`,import.meta.url).pathname});
  checks.push({width,bookLoaded:true,emptyPriceMarkets:true,wageringDisabled:true,rewardFormVisible:true,anonymousSigningBlocked:true,noHorizontalOverflow:true,pageErrors:errors});
  await page.close();
 }
 const receipt={base,checkedAt:new Date().toISOString(),realPublishedBook:true,fixtures:false,noWalletSignatures:true,livePaymentVerified:false,checks};
 fs.writeFileSync(new URL(`rewards-${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
}finally{await browser.close();}
