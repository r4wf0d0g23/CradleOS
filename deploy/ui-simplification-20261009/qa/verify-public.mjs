import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./',import.meta.url).pathname, base=process.env.QA_BASE??'http://127.0.0.1:5207', live=base.startsWith('https:');
const report={mode:live?'anonymous production; no wallet':'production preview; no wallet',base,checks:[],errors:[],assetFailures:[]};
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const overflow=async(p)=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow: '+p.url());
try{
for(const width of [320,1440]){
 const c=await b.newContext({viewport:{width,height:900},hasTouch:width<1000});const p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&/\.(js|css|png)(\?|$)/.test(r.url())&&r.status()>=400)report.assetFailures.push(r.url());});
 await p.goto(base+'/#/casino');
 const pill=p.locator('[data-activity-counter]');await pill.waitFor();await p.getByRole('button',{name:'Play Money',exact:true}).waitFor();
 await p.waitForFunction(()=>document.querySelector('[data-activity-counter]')?.textContent?.includes('verified wallets'),{},{timeout:20000});
 await pill.locator('button').click();await p.locator('#cradleos-activity-details dl').waitFor();
 const size=await pill.boundingBox();assert(size.height<240&&size.width<=251);assert.equal(await pill.locator('p').count(),0);assert.equal(await pill.locator('dt').count(),5);assert((await pill.innerText()).includes('Sign-ins · 30d'));
 assert.equal(await p.locator('.lounge-hero').count(),0);assert.equal(await p.locator('.cycle-status details').count(),0);await overflow(p);
 await p.screenshot({path:`${out}${live?'live':'preview'}-casino-${width}.png`,fullPage:false});
 await pill.locator('button').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#cradleos-activity-details').count(),0);
 report.checks.push({width,check:'casino hero removed; compact label/value activity; keyboard collapse; cycle strip',activity:await pill.innerText(),popup:size});
 if(live){await c.close();continue;}
 const go=async(route)=>{await p.evaluate(r=>{location.hash='/'+r;},route);await p.waitForTimeout(400);};
 await p.getByRole('button',{name:'Donate $EVE',exact:true}).click();await p.getByText(/Irreversible gift/).waitFor();assert((await p.locator('body').innerText()).includes('No withdrawal or profit-sharing rights'));await overflow(p);report.checks.push({width,check:'donation concise consequences; connect-wallet gate'});
 await go('gamedata');await p.getByRole('navigation',{name:'Game Data sections'}).waitFor();
 for(const name of ['ITEMS','ICONS','CLIENT RECIPES','CLIENT TEXT','EVENT TYPES','CYCLE 7 CHANGES','SOURCES']){await p.getByRole('button',{name,exact:true}).click();await p.waitForTimeout(300);await overflow(p);}
 assert(await p.locator('a[href$=".json"]').count()>0);report.checks.push({width,check:'all seven Game Data sections; source downloads preserved'});
 await p.getByRole('button',{name:'ITEMS',exact:true}).click();await p.getByRole('textbox',{name:'Search items'}).fill('D1 Fuel');await p.waitForTimeout(150);assert((await p.locator('body').innerText()).includes('Type ID 88335'));report.checks.push({width,check:'item search and content retained'});
 await go('industry');await p.getByRole('button',{name:'Try D1 Fuel',exact:true}).click();await p.getByLabel('Recipe route',{exact:true}).selectOption({index:1});await p.getByLabel('Units wanted').fill('100');await p.getByRole('button',{name:'Copy material list',exact:true}).waitFor();await p.getByRole('button',{name:'Supply chain',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Supply chain',exact:true}).getAttribute('aria-pressed'),'true');await overflow(p);report.checks.push({width,check:'recipe selection, quantity and supply-chain outputs'});
 await p.screenshot({path:`${out}preview-industry-${width}.png`,fullPage:false});
 for(const route of ['query','intel','defense','storage','voting','tribe','gates','origins','dapps']){await go(route);await overflow(p);report.checks.push({width,check:route+' route renders without overflow'});}
 await c.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetFailures,[]);console.log(JSON.stringify(report,null,2));
}finally{await writeFile(out+(live?'live-browser.json':'public-browser.json'),JSON.stringify(report,null,2));await b.close();}
