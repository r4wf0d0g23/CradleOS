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
  const start=phase==='open'?now+3600:now-7200,end=phase==='open'?now+7200:now-1800;
  return object(id(n),`${pkg}::book::Market<${coin}>`,{version:'1',book_id:book,tenant:'stillness',creator:id(9),asset:1,
    starts:String(start),ends:String(end),proof_deadline:String(end+3600),
    price_feed:Buffer.from('e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43','hex').toString('base64'),price_exponent:8,price_strike:String(BigInt(n)*100000000n),price_value:'0',price_time:'0',claims:{id:id(88)},claim_count:'0',
    pool_a:'3000000000',pool_b:'2000000000',escrow:'5000000000',result:0,remaining_winning_stake:'0'});
}
try{
  for(const width of [320,390,1440]){
    const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));let newer=false,newReward=false,phase='open',unavailable=false;
    await page.route('**/src/lib/bookDeployment.ts*',async route=>{const r=await route.fetch();let body=await r.text();body=body.replace('packageId: ""',`packageId: "${pkg}"`).replace('bookId: ""',`bookId: "${book}"`).replace('wageringEnabled: false','wageringEnabled: true');await route.fulfill({response:r,body});});
    await page.route('**/src/components/BettingBookPanel.tsx*',async route=>{const r=await route.fetch();let body=await r.text();body=body.replace('useVerifiedAccountContext()',`({account:{address:"${wallet}"}})`);await route.fulfill({response:r,body});});
    await page.route('https://graphql.testnet.sui.io/graphql',async route=>{
      const {query,variables:v={}}=route.request().postDataJSON();
      if(v.id===book){await route.fulfill({json:unavailable?{errors:[{message:'fixture unavailable'}]}:{data:{object:object(book,`${pkg}::book::Book<${coin}>`,{version:'1',paused:false,registry,tenant:'stillness',markets:newer?[id(101),id(102)]:[id(101)],deliveries:newReward?[id(201),id(202)]:[id(201)]})}}});return;}
      if([id(201),id(202)].includes(v.id)){await route.fulfill({json:{data:{object:object(v.id,`${pkg}::delivery::Delivery<${coin}>`,{book_id:book,tenant:'stillness',title:v.id===id(201)?'Ammo reward':'Fuel reward',sponsor:id(7),sponsor_character:id(8),origin:id(9),item_type:'88069',quantity:'10',deadline:String(now+600),reward:'1000000000',reward_amount:'1000000000',status:0,fulfilled_by:id(0),fulfilled_at:'0'})}}});return;}
      if(v.type===`${world}::inventory::Item`){await route.fulfill({json:{data:{objects:{nodes:[object(id(301),`${world}::inventory::Item`,{tenant:'stillness',parent_id:id(9),type_id:'88069',quantity:10})],pageInfo:{hasNextPage:false,endCursor:null}}}}});return;}
      if([id(101),id(102)].includes(v.id)){await route.fulfill({json:{data:{object:market(v.id===id(101)?101:102,phase)}}});return;}
      if(v.type?.startsWith(pkg)){await route.fulfill({json:{data:{objects:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}}});return;}
      await route.continue();
    });
    await page.goto(base+'/#/casino',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Betting Book',exact:true}).click();
    await page.getByRole('heading',{name:'BTC/USD · $101'}).waitFor();
    await page.getByLabel('Stake · EVE').fill('1');await page.getByRole('button',{name:'Review bet',exact:true}).click();
    await page.getByRole('button',{name:'Confirm bet',exact:true}).waitFor();
    if(width===390){
      newer=true;
      await page.getByRole('heading',{name:'BTC/USD · $102'}).waitFor({timeout:20000});
      assert.equal(await page.getByRole('button',{name:'Confirm bet',exact:true}).count(),0,'market refresh must invalidate reviewed bet');
      reports.push({check:'new-market-poll-invalidates-confirmation',pass:true});
    }else await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.locator('.book-detail .book-rules summary').first().click();
    assert.match(await page.locator('.book-detail .book-rules').first().innerText(),/First signed update crossing/);
    await page.getByRole('heading',{name:'Ammo reward',exact:true}).waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Review delivery',exact:true}).click();
    await page.getByRole('button',{name:'Confirm',exact:true}).waitFor();
    assert.match(await page.locator('.book-deliveries .book-confirm').innerText(),/Transfer the selected items/);
    if(width===390){newReward=true;await page.getByRole('heading',{name:'Fuel reward',exact:true}).waitFor({timeout:20000});
      assert.equal(await page.getByRole('button',{name:'Confirm',exact:true}).count(),0);reports.push({check:'reward-poll-invalidates-captured-delivery',pass:true});
    }else await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
    await page.locator('.betting-book').screenshot({path:new URL(`book-fixture-${width}.png`,dir).pathname});
    assert.deepEqual(errors,[]);reports.push({check:`fixture-open-${width}`,pass:true});
    if(width===390){
      phase='proofs';await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Betting Book',exact:true}).click();await page.getByLabel('Signed price proof · hex').waitFor();
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
