import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.MAP_QA_BASE||'http://127.0.0.1:5366',label=process.env.MAP_QA_LABEL||'preview',live=label==='production';
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/tmp/cradleos-sandboxed-chrome-20261021.sh'});
const context=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true});context.setDefaultTimeout(30000);let writes=0,mode='real';const errors=[],checks=[],api=[];
await context.route('https://**/*',async route=>{
 const req=route.request(),url=req.url();if(/ExecuteTransaction|SubmitTransaction/.test(url)){writes++;return route.abort();}
 const isMap=url.startsWith('https://keeper.reapers.shop/known-space');
 try{
  if(isMap && mode==='error')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'});
  const target=isMap&&!live?url.replace('https://keeper.reapers.shop','http://127.0.0.1:8046'):url;
  const r=await fetch(target,{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(20000)}),headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];
  let body=Buffer.from(await r.arrayBuffer());if(isMap){api.push({url,status:r.status});if(mode==='empty'){const s=JSON.parse(body);s.gates=[];s.edges=[];s.recentJumps=[];s.coverage.jumpCount=0;body=Buffer.from(JSON.stringify(s));}}
  await route.fulfill({status:r.status,headers,body});
 }catch{await route.abort();}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/#/known-space`,{waitUntil:'domcontentloaded'});const panel=page.locator('.known-space'),svg=panel.locator('svg');await panel.locator('.known-space-node').first().waitFor();await panel.getByRole('button',{name:'Refresh',exact:true}).waitFor();
 const count=await panel.locator('.known-space-node').count();assert.ok(count>0);checks.push({check:'Public route loads actual jump-backed graph without wallet',nodes:count});
 await panel.screenshot({path:new URL(`${label}-desktop.png`,import.meta.url).pathname});
 const start=await svg.getAttribute('viewBox');await panel.getByRole('button',{name:'Zoom in',exact:true}).click();assert.notEqual(await svg.getAttribute('viewBox'),start);await panel.getByRole('button',{name:'Fit',exact:true}).click();
 await svg.focus();await page.keyboard.press('ArrowRight');assert.notEqual(await svg.getAttribute('viewBox'),start);await panel.getByRole('button',{name:'Fit',exact:true}).click();
 await panel.locator('.known-space-node').first().focus();await page.keyboard.press('Enter');await panel.locator('.known-space-details code').first().waitFor();
 const item=await panel.locator('.known-space-details').innerText();assert.match(item,/Item \d+/);const itemId=item.match(/Item (\d+)/)[1];
 await panel.getByRole('textbox',{name:'Search systems or gates'}).fill(itemId);await panel.locator('.known-space-results button').first().click();assert.ok(await panel.locator('[data-dim="true"]').count()>0);await panel.getByRole('button',{name:'Clear',exact:true}).click();await panel.getByRole('button',{name:'Fit',exact:true}).click();
 await panel.locator('.known-space-edge').first().focus();await page.keyboard.press('Enter');await panel.locator('.known-space-details a[href*="suiscan"]').first().waitFor();checks.push({check:'Zoom, keyboard pan, node/edge selection, search and provenance links'});
 const slider=panel.getByRole('slider',{name:'Discovery replay time'});const min=Number(await slider.getAttribute('min')),max=Number(await slider.getAttribute('max')),at=Math.floor((min+max)/2);await slider.fill(String(at));await page.waitForFunction(()=>document.querySelector('.known-space-timeline button')?.disabled===false);await panel.getByRole('button',{name:'Refresh',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.known-space-status')?.textContent.includes('Loading snapshot'));
 assert.ok(api.some(x=>x.url.includes(`at=${at}`)&&x.status===200));await panel.locator('.known-space-timeline').getByRole('button',{name:'Live',exact:true}).click();await panel.getByRole('button',{name:'Refresh',exact:true}).waitFor();checks.push({check:'Historical replay and Live return',at});
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert.ok(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await panel.screenshot({path:new URL(`${label}-mobile-${width}.png`,import.meta.url).pathname});}
 checks.push({check:'390px and 320px map/control layout fits'});
 await page.setViewportSize({width:390,height:1000});await svg.scrollIntoViewIfNeeded();
 const touchBox=await svg.boundingBox(),cx=touchBox.x+touchBox.width/2,cy=touchBox.y+touchBox.height/2,touchStart=await svg.getAttribute('viewBox'),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-25,y:cy,id:1},{x:cx+25,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy,id:1},{x:cx+65,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notEqual(await svg.getAttribute('viewBox'),touchStart);
 await panel.getByRole('button',{name:'Fit',exact:true}).click();await panel.locator('.known-space-node').first().focus();await page.keyboard.press('Enter');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await svg.evaluate(e=>e.getAnimations({subtree:true}).length),0);checks.push({check:'Actual mobile pinch zoom and no map animation under reduced motion'});
 mode='error';await panel.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.known-space-status')?.textContent.includes('Stale'));assert.ok(await panel.locator('.known-space-node').count()>0);checks.push({check:'Failed refresh preserves graph and marks Stale'});
 if(!live){mode='empty';await panel.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.known-space-empty')?.textContent.includes('No observed gates'));mode='error';await page.reload();await page.waitForFunction(()=>document.querySelector('.known-space-empty')?.textContent.includes('unavailable'));checks.push({check:'Explicit empty and initial-failure UI fixtures distinguish zero from unavailable'});}
 assert.equal(writes,0);assert.deepEqual(errors,[]);const receipt={at:new Date().toISOString(),base,label,checks,api,errors,writes,realChainData:true};writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close();}
