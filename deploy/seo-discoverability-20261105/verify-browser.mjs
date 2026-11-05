import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://127.0.0.1:5368';
const label=base.startsWith('https:')?'live':'preview';
const browser=await chromium.launch({headless:true,chromiumSandbox:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',env:{...process.env,CHROME_DEVEL_SANDBOX:'/opt/nvidia/dgx-oobe-desktop/chrome-sandbox'}});
const checks=[],errors=[],networkFailures=[];
try {
  for (const javaScriptEnabled of [false,true]) {
    const ctx=await browser.newContext({javaScriptEnabled,viewport:{width:1440,height:1000}});
    // TLS-validating Node relay, same as prior release QA; no disabled certificate checks.
    await ctx.route('https://**/*',async route=>{
      try {const req=route.request();const res=await fetch(req.url(),{method:req.method(),headers:req.headers(),body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(25000)});const headers=Object.fromEntries(res.headers);delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:res.status,headers,body:Buffer.from(await res.arrayBuffer())});}
      catch(e){networkFailures.push({url:route.request().url(),error:e.message});await route.abort();}
    });
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    for (const route of ['/guide/','/guide/features/','/guide/getting-started/','/guide/faq/']) {
      const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);
      assert.equal(await page.locator('h1').count(),1);
      assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://cradleos.io'+route);
      assert.ok((await page.locator('main').innerText()).length>1000);
      for (const width of [1440,650,390,320]) {
        await page.setViewportSize({width,height:1000});
        const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(dims.scroll<=dims.width,JSON.stringify({route,...dims}));
        checks.push({route,javaScriptEnabled,width,status:200,noOverflow:true});
      }
      if(javaScriptEnabled && route==='/guide/')await page.screenshot({path:new URL(label+'-guide-mobile.png',import.meta.url).pathname,fullPage:true});
    }
    await page.goto(base+'/guide/',{waitUntil:'networkidle'});
    await page.getByRole('navigation',{name:'Guide navigation'}).getByRole('link',{name:'Features',exact:true}).click();
    await page.waitForURL(base+'/guide/features/');
    await page.getByRole('link',{name:'Setup guide',exact:true}).click();await page.waitForURL(base+'/guide/getting-started/');
    await page.getByRole('main').getByRole('link',{name:'Open app',exact:true}).click();await page.waitForURL(base+'/');
    if(javaScriptEnabled){
      await page.getByText('Wallet required',{exact:true}).waitFor({timeout:30000});
      assert.equal(await page.locator('h1').count(),1);
      await page.getByRole('link',{name:'Guide',exact:true}).click();await page.waitForURL(base+'/guide/');
      await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:new URL(label+'-guide-desktop.png',import.meta.url).pathname,fullPage:true});
      await page.goto(base+'/#/known-space',{waitUntil:'domcontentloaded'});
      await page.getByText('Known Space',{exact:true}).first().waitFor({timeout:30000});
      checks.push({route:'/#/known-space',appStarted:true});
    }else{assert.ok(await page.getByRole('heading',{name:'CradleOS — EVE Frontier tribe management tools'}).isVisible());assert.ok(await page.getByRole('link',{name:'Guide',exact:true}).isVisible());}
    checks.push({javaScriptEnabled,guideNavigation:true,appReturn:true});await ctx.close();
  }
  assert.deepEqual(errors,[]);
  const receipt={at:new Date().toISOString(),base,checks,errors,networkFailures};writeFileSync(new URL(label+'-browser.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} finally {await browser.close();}
