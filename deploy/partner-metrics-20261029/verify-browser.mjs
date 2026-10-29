// Sandboxed Chromium. Live public source via TLS-validating relay; explicit error
// and clock fixtures are separate checks. No wallet registration or signing.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.PARTNER_QA_BASE||'http://127.0.0.1:5343';
const label=process.env.PARTNER_QA_LABEL||'preview';
assert.ok(['preview','live'].includes(label));
const dir=new URL('./',import.meta.url),source='https://keeper.reapers.shop/telemetry/combined';
mkdirSync(new URL('exports/',dir),{recursive:true});
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
 const requests=[],errors=[];let failed=false,lastSource=null;
 await context.route('https://**/*',async route=>{
  const req=route.request();requests.push({url:req.url(),method:req.method()});
  try{
   if(req.url()===source&&failed)return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"injected_read_failure"}'});
   const r=await fetch(req.url(),{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)});
   const body=Buffer.from(await r.arrayBuffer()),headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];
   if(req.url()===source&&r.ok)lastSource=JSON.parse(body.toString());
   await route.fulfill({status:r.status,headers,body});
  }catch{await route.abort();}
 });
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(base+'/partners/metrics/',{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
 await page.waitForFunction(()=>document.querySelector('#metrics-status')?.textContent==='Current',undefined,{timeout:30000});
 assert.equal(await page.title(),'CradleOS · Partner metrics');
 assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
 assert.equal(await page.getByRole('button',{name:/connect/i}).count(),0);
 assert.equal(await page.locator('#combined').innerText(),String(lastSource.combined_mau));
 assert.equal(await page.locator('#signins').innerText(),String(lastSource.wallet_mau));
 assert.equal(await page.locator('#onchain').innerText(),String(lastSource.onchain_mau));
 assert.equal(await page.locator('#releases li').count(),8);
 assert.ok(requests.every(r=>r.method==='GET'),'Partner page sends no telemetry/signing POST');
 const counts={combined:lastSource.combined_mau,signins:lastSource.wallet_mau,onchain:lastSource.onchain_mau,today:lastSource.wallet_dau};
 for(const ext of ['json','csv']){
  const pending=page.waitForEvent('download');await page.locator('#'+ext).click();const download=await pending;
  assert.match(download.suggestedFilename(),/^cradleos-partner-metrics-.*\.(json|csv)$/);
  const path=new URL(`exports/${label}.${ext}`,dir).pathname;await download.saveAs(path);const content=readFileSync(path,'utf8');assert.ok(!content.includes('undefined'));assert.match(content,/sign_in_coverage_since/);
  if(ext==='json'){const s=JSON.parse(content);assert.equal(s.counts.verified_wallets_30d,counts.combined);assert.equal(s.tracked_contracts.length,5);assert.equal(s.selected_releases.length,8);assert.equal(s.source_url,source);assert.equal(s.cycle,7);assert.equal(s.addresses,undefined);}
 }
 for(const width of [1440,650,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);await page.screenshot({path:new URL(`${label}-${width}.png`,dir).pathname,fullPage:true});}
 await page.emulateMedia({media:'print'});assert.ok(await page.locator('#metrics-status').isVisible());assert.ok(await page.locator('.print-source').isVisible());await page.pdf({path:new URL(`${label}.pdf`,dir).pathname,format:'A4',printBackground:true,margin:{top:'12mm',right:'12mm',bottom:'12mm',left:'12mm'}});await page.emulateMedia({media:'screen'});
 // Failure is injected only here, after the live count/export/screenshot evidence.
 failed=true;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#metrics-status')?.textContent==='Unavailable');
 for(const id of ['combined','signins','onchain','today'])assert.equal(await page.locator('#'+id).innerText(),'—');
 assert.ok(await page.locator('#json').isDisabled());assert.ok(await page.locator('#csv').isDisabled());assert.equal(await page.locator('#releases li').count(),8);
 failed=false;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#metrics-status')?.textContent==='Current');
 // Set wall clock forward without firing scheduled timers, as after a suspended tab.
 await page.clock.install({time:new Date()});await page.clock.setSystemTime(Date.now()+180000);await page.locator('#json').click();assert.equal(await page.locator('#metrics-status').innerText(),'Expired');assert.ok(await page.locator('#json').isDisabled());
 await page.clock.setSystemTime(Date.now());
 // Root page stays the application, with no partner metrics navigation link.
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:30000});await page.getByRole('button',{name:/connect/i}).first().waitFor({timeout:20000});
 assert.equal(await page.locator('a[href*="partners/metrics"]').count(),0);assert.equal(await page.getByRole('button',{name:/partner metrics/i}).count(),0);
 if(label==='live'){await page.goto(base+'/partners/metrics',{waitUntil:'domcontentloaded',timeout:30000});await page.getByRole('heading',{name:'Partner metrics',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#metrics-status')?.textContent==='Current',undefined,{timeout:30000});
 }
 assert.deepEqual(errors,[]);
 const evidence={at:new Date().toISOString(),base,label,anonymous:true,walletProvider:false,realSource:true,counts,selectedReleases:8,widths:[1440,650,390,320],exports:['json','csv','pdf'],failureFixtureClearsCounts:true,expiryAtExportWithoutTimers:true,mainNavigationUnchanged:true,directPathVariants:label==='live'?true:'Cloudflare redirect checked after deployment',pageErrors:errors,requests};
 writeFileSync(new URL(`${label}-browser.json`,dir),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,requests:undefined,requestCount:requests.length}));
}catch(e){if(page){writeFileSync(new URL(`${label}-failure.txt`,dir),await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:new URL(`${label}-failure.png`,dir).pathname}).catch(()=>{});}throw e;}finally{await browser.close();}
