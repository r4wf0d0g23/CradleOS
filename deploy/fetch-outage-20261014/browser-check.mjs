import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const report={routes:[],api:[],errors:[],requests:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')report.requests.push({url:r.url().split('?')[0],error:r.failure()?.errorText});});
 page.on('response',r=>{if(r.status()>=400)report.requests.push({url:r.url().split('?')[0],status:r.status()});});
 for(const hash of ['','#/intel','#/gamedata','#/casino']){
  await page.goto('https://cradleos.io/'+hash,{waitUntil:'domcontentloaded'});
  await page.locator('body').waitFor();
  await page.waitForTimeout(6500);
  const text=await page.locator('body').innerText();
  report.routes.push({hash,title:await page.title(),text:text.slice(0,5000),failedFetch:/failed to fetch/i.test(text)});
 }
 report.api=await page.evaluate(async()=>{
  const root='https://keeper.reapers.shop';
  const jobs=[['index',root+'/index/health',null],['search',root+'/index/character-search?q=Raw&server=stillness',null],['types',root+'/world/v2/types?limit=1',null],['chain',root+'/sui',{jsonrpc:'2.0',id:1,method:'sui_getChainIdentifier',params:[]}],['graphql',root+'/graphql',{query:'{ chainIdentifier }'}]];
  return Promise.all(jobs.map(async([name,url,body])=>{try{const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const j=await r.json();return{name,status:r.status,keys:Object.keys(j),error:j.error??j.errors??null};}catch(e){return{name,error:String(e)}}}));
 });
 await page.screenshot({path:new URL('./public-casino.png',import.meta.url).pathname,fullPage:false});
 await fs.writeFile(new URL('./browser-check.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({routes:report.routes.map(({hash,failedFetch})=>({hash,failedFetch})),api:report.api,errors:report.errors,requests:report.requests},null,2));
}finally{await browser.close();}
