// Explicit local fixtures. No wallet connects, signatures, transactions or live writes.
import {chromium} from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url),base='http://127.0.0.1:5230';
const id=n=>'0x'+n.toString(16).padStart(64,'0'),pkg=id(99),book=id(100),wallet=id(17);
const world='0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92';
const coin='0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE';
const registry='0x69dfecd272649c16aff85bb7638b45a0b3afe40b57433009408aa27c397a4db7';
const now=Math.floor(Date.now()/1000),reports=[];
const browser=await chromium.launch({headless:true,executablePath:'/home/rawdata/.cache/ms-playwright/chromium-1228/chrome-linux/chrome'});
function object(address,type,json){return{address,owner:{__typename:'Shared'},asMoveObject:{contents:{type:{repr:type},json}}};}
function market(n,phase='open'){
  const start=phase==='open'?now+3600:now-7200,end=phase==='open'?now+7200:now-3600,deadline=phase==='ready'?now-1:now+3600;
  return object(id(n),`${pkg}::book::Market<${coin}>`,{version:'1',book_id:book,registry,tenant:'stillness',character_a:id(1),character_b:id(2),a:{item_id:String(n*10),tenant:'stillness'},b:{item_id:String(n*10+1),tenant:'stillness'},starts:String(start),ends:String(end),proof_deadline:String(phase==='open'?now+10800:deadline),loss_type:1,system_id:'0',pool_a:'3000000000',pool_b:'2000000000',score_a:phase==='open'?'0':'2',score_b:phase==='open'?'0':'1',escrow:'5000000000',result:0,remaining_winning_stake:'0'});
}
try{
  for(const width of [320,390,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));let newer=false,phase='open',unavailable=false;
    await page.route('**/src/lib/bookDeployment.ts*',async route=>{const r=await route.fetch();let body=await r.text();body=body.replace('packageId: ""',`packageId: "${pkg}"`).replace('bookId: ""',`bookId: "${book}"`).replace('wageringEnabled: false','wageringEnabled: true');await route.fulfill({response:r,body});});
    await page.route('**/src/components/BettingBookPanel.tsx*',async route=>{const r=await route.fetch();let body=await r.text();body=body.replace('useVerifiedAccountContext()',`({account:{address:"${wallet}"}})`);await route.fulfill({response:r,body});});
    await page.route('https://graphql.testnet.sui.io/graphql',async route=>{
      const {query,variables:v={}}=route.request().postDataJSON();
      if(v.id===book){await route.fulfill({json:unavailable?{errors:[{message:'fixture unavailable'}]}:{data:{object:object(book,`${pkg}::book::Book<${coin}>`,{version:'1',paused:false,registry,tenant:'stillness',markets:newer?[id(101),id(102)]:[id(101)]})}}});return;}
      if([id(101),id(102)].includes(v.id)){await route.fulfill({json:{data:{object:market(v.id===id(101)?101:102,phase)}}});return;}
      if(v.type?.startsWith(pkg)){await route.fulfill({json:{data:{objects:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}}});return;}
      await route.continue();
    });
    await page.goto(base+'/#/casino',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Betting Book',exact:true}).click();
    await page.getByRole('heading',{name:'Pilot 1010 vs Pilot 1011'}).waitFor();
    await page.getByLabel('Stake · EVE').fill('1');await page.getByRole('button',{name:'Review bet',exact:true}).click();
    await page.getByRole('button',{name:'Confirm bet',exact:true}).waitFor();
    if(width===390){
      newer=true;
      await page.getByRole('heading',{name:'Pilot 1020 vs Pilot 1021'}).waitFor({timeout:20000});
      assert.equal(await page.getByRole('button',{name:'Confirm bet',exact:true}).count(),0,'market refresh must invalidate reviewed bet');
      reports.push({check:'new-market-poll-invalidates-confirmation',pass:true});
    }else await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('.book-rules summary').click();
    assert.match(await page.locator('.book-rules').innerText(),/Only qualifying official killmails submitted/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
    await page.locator('.betting-book').screenshot({path:new URL(`book-fixture-${width}.png`,dir).pathname});
    assert.deepEqual(errors,[]);reports.push({check:`fixture-open-${width}`,pass:true});
    if(width===390){
      phase='proofs';await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Betting Book',exact:true}).click();await page.getByLabel('Killmail object ID').waitFor();
      assert.equal(await page.getByRole('button',{name:'Review bet',exact:true}).count(),0);
      reports.push({check:'proof-window-no-new-bets',pass:true});
      unavailable=true;await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Betting Book',exact:true}).click();await page.getByText('Book unavailable',{exact:false}).waitFor({timeout:20000});
      assert.equal(await page.getByText('No markets yet',{exact:true}).count(),0);reports.push({check:'unavailable-is-not-empty',pass:true});
    }
    await context.close();
  }
  const p=await browser.newPage({viewport:{width:390,height:844}});
  await p.goto(base+'/#/casino',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Betting Book',exact:true}).click();await p.getByText('Setup pending',{exact:true}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Review bet',exact:true}).count(),0);reports.push({check:'unconfigured-real-source-fails-closed',pass:true});
  fs.writeFileSync(new URL('browser-qa.json',dir),JSON.stringify({fixtureOnly:true,noWalletSignatures:true,reports},null,2));console.log(JSON.stringify(reports));
}finally{await browser.close();}
