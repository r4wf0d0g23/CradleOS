import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./',import.meta.url).pathname;
const b=await chromium.launch({executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
const report={checks:[],errors:[],assetFailures:[]};
try{for(const width of [320,390,1440]){const context=await b.newContext({viewport:{width,height:1000},hasTouch:width<1000});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().includes('/icons-cycle7')&&r.status()>=400)report.assetFailures.push(r.url());});
for(const mode of ['owner','nonowner','frozen','foreign','none','error']){
 await p.goto(`http://127.0.0.1:5208/ssu-qa.html?mode=${mode}`);await p.locator('.ssu-card').waitFor();
 await p.getByText('Manage access',{exact:true}).click();
 const review=p.getByRole('button',{name:'Review & disable sharing',exact:true});
 if(mode==='owner'){
 assert.equal(await review.count(),1);await p.getByRole('button',{name:'Shared pool 1',exact:true}).click();assert.equal(await p.locator('.ssu-stock-list li').count(),1);await p.getByRole('button',{name:'All stock 3',exact:true}).click();await p.getByRole('searchbox').fill('carbon');assert.equal(await p.locator('.ssu-stock-list li').count(),1);await p.getByRole('searchbox').fill('');
 await review.click();await p.getByText('Review before signing',{exact:true}).waitFor();const confirm=p.getByRole('button',{name:'Confirm in wallet',exact:true});assert(await confirm.isDisabled());await p.getByRole('checkbox').check();assert(await confirm.isEnabled());assert((await p.locator('.ssu-warning').last().innerText()).includes('Inaccessible pending recovery'));assert((await p.locator('.ssu-warning').last().innerText()).includes('including new arrivals'));assert((await p.locator('.ssu-warning').last().innerText()).includes('Do not change the extension elsewhere while signing'));await p.screenshot({path:`${out}owner-${width}.png`,fullPage:true});
 await p.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await confirm.count(),0);await p.getByText('Storage capacity & details',{exact:true}).click();assert.equal(await p.getByRole('meter').count(),3);
 await p.getByRole('button',{name:'Collapse STRG-1',exact:true}).click();assert.equal(await p.locator('.ssu-stock-list').count(),0);await p.getByRole('button',{name:'Expand STRG-1',exact:true}).click();
 report.checks.push(`${width}: owner filters/search, explicit preview consent, cancel, separate capacities and collapse`);
 }else{assert.equal(await review.count(),0);report.checks.push(`${width}: ${mode} has no revocation action`);}
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}/${mode} no overflow`);
 const heights=await p.locator('.ssu-card button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(heights.every(h=>h>=44),'44px button targets');
}
await context.close();}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetFailures,[]);console.log(JSON.stringify(report,null,2));}finally{await writeFile(`${out}browser.json`,JSON.stringify(report,null,2));await b.close();}
