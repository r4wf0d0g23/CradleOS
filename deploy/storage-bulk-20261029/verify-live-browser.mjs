// Real release + live chain data. Synthetic read-only Wallet Standard account;
// sign/execute always reject. TLS-validating Node relay supplies authenticated
// egress to Chromium; no certificate checks are disabled and no API fixtures.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.STORAGE_QA_BASE || 'http://127.0.0.1:5351';
const label = process.env.STORAGE_QA_LABEL || 'preview';
assert.ok(['preview', 'live'].includes(label));
const deployment = JSON.parse(readFileSync(new URL('../storage-owner-deposit-20261029/onchain.json',import.meta.url)));
const walletAddress = '0x9eb4912cc02e0e82c0dec9a97a0b4c5ac3e5fbebc4cde4089cfbc0150e382c33';
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  context.setDefaultTimeout(15000);
  const network = [], errors = []; let failCapRead = true; let capFailures = 0;
  await context.route('https://**/*', async route => {
    try {
      const req = route.request();
      const requestBody = req.headers()['content-type']?.includes('grpc-web-text') ? Buffer.from(req.postData() ?? '', 'base64') : req.postDataBuffer();
      if (failCapRead && req.url().includes('ListOwnedObjects') && requestBody?.includes(Buffer.from('::character::Character'))) { capFailures++; return route.abort('failed'); }
      const res = await fetch(req.url(), { method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer(), signal: AbortSignal.timeout(20000) });
      const headers = Object.fromEntries(res.headers); delete headers['content-encoding']; delete headers['content-length'];
      network.push({ url: req.url(), status: res.status });
      await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
    } catch (e) { network.push({ url: route.request().url(), error: e.message }); await route.abort(); }
  });
  await context.addInitScript(address => {
    const listeners = new Set(); let accounts = [];
    window.structureQA = { prompts: 0, writes: 0 };
    const account = { address, publicKey: new Uint8Array(32), chains: ['sui:testnet'], features: ['sui:signPersonalMessage', 'sui:signTransaction', 'sui:signAndExecuteTransaction'] };
    const wallet = { version: '1.0.0', name: 'Eve Vault', icon: 'data:image/svg+xml;base64,PHN2Zy8+', chains: ['sui:testnet'], get accounts() { return accounts; }, features: {
      'standard:connect': { version: '1.0.0', connect: async () => { accounts = [account]; listeners.forEach(f => f({ accounts })); return { accounts }; } },
      'standard:disconnect': { version: '1.0.0', disconnect: async () => { accounts = []; listeners.forEach(f => f({ accounts })); } },
      'standard:events': { version: '1.0.0', on: (_event, fn) => { listeners.add(fn); return () => listeners.delete(fn); } },
      'sui:signPersonalMessage': { version: '1.0.0', signPersonalMessage: async () => { window.structureQA.prompts++; throw Error('User rejected QA identity signature'); } },
      'sui:signTransaction': { version: '2.0.0', signTransaction: async () => { window.structureQA.writes++; throw Error('Read-only QA wallet'); } },
      'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction: async () => { window.structureQA.writes++; throw Error('Read-only QA wallet'); } },
    } };
    window.structureQA.disconnect = () => wallet.features['standard:disconnect'].disconnect();
    window.addEventListener('wallet-standard:app-ready', e => e.detail.register(wallet));
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(wallet) }));
  }, walletAddress);
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: /connect/i }).first().click({ timeout: 15000 });
  await page.getByRole('button', { name: /^(Inventory|Inv)$/i }).click();
  await page.getByRole('button', { name: 'EXPAND ALL', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Expand Reap Shared storage', exact: true }).click();
  const cards=page.locator('.ssu-card');
  const target=cards.filter({hasText:'Reap Shared storage'});
  await target.getByText('Personal access unavailable · Refresh',{exact:true}).waitFor({timeout:15000});
  failCapRead=false;
  await target.getByRole('button',{name:'Refresh Reap Shared storage',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.ssu-card')].filter(c=>c.textContent.includes('Reap Shared storage')).some(c=>!c.textContent.includes('Personal access unavailable')&&c.querySelector('.ssu-stock-list')),undefined,{timeout:60000});
  assert.ok(capFailures>0); assert.equal(await target.getByText('Personal access unavailable · Refresh',{exact:true}).count(),0);
  await target.getByRole('button',{name:'Grid',exact:true}).click();
  assert.equal(await target.locator('.ssu-stock-grid').count(),1);
  await target.getByRole('button',{name:'List',exact:true}).click();
  assert.equal(await target.locator('.ssu-stock-grid').count(),0);
  const counts={stacks:await target.locator('.ssu-stock-list li').count(),draggable:await target.locator('li[draggable="true"]').count()};
  assert.ok(counts.stacks>0);
  for(const width of [1440,650,390,320]){
    await page.setViewportSize({width,height:950});
    for(const view of ['List','Grid']){
      await target.getByRole('button',{name:view,exact:true}).click();
      await target.locator('.ssu-stock-toolbar').scrollIntoViewIfNeeded();
      assert.ok(await target.locator('.ssu-card-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${view} overflow at ${width}`);
      await page.screenshot({path:new URL(`${label}-${view.toLowerCase()}-${width}.png`,import.meta.url).pathname});
    }
  }
  await page.setViewportSize({width:1440,height:1050});
  await target.getByRole('button',{name:'Grid',exact:true}).click();
  await target.getByRole('button',{name:'Withdraw',exact:true}).first().waitFor();
  const bulk=target.getByRole('button',{name:'Share all owner stock',exact:true});
  let ownerBulkReview=false,reviewedStacks=0;
  if(await bulk.count()){
    await bulk.click();
    await target.getByText('Owner storage → Shared pool',{exact:true}).waitFor();
    const amount=target.getByRole('textbox',{name:/^Quantity for /});
    reviewedStacks=await amount.count();assert.ok(reviewedStacks>0);
    await amount.first().fill('1');assert.equal(await amount.first().inputValue(),'1');
    assert.equal(await target.getByRole('region',{name:'Review storage transfer'}).getByRole('checkbox').isChecked(),false);
    await page.screenshot({path:new URL(`${label}-bulk-review.png`,import.meta.url).pathname});
    await target.getByRole('button',{name:'Cancel',exact:true}).click();ownerBulkReview=true;
  }else{
    assert.equal(await target.locator('li').filter({hasText:'Owner storage'}).count(),0);
    assert.equal(await target.getByRole('button',{name:'Deposit all personal stock',exact:true}).count(),0);
    await target.getByRole('button',{name:'Withdraw',exact:true}).first().click();
    await target.getByRole('region',{name:'Review storage transfer'}).waitFor();
    await target.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  const beforeStorage=await page.evaluate(()=>localStorage.getItem('cradleos:storage:view:v1'));assert.equal(beforeStorage,'grid');
  assert.equal(await page.evaluate(()=>window.structureQA.writes),0);
  assert.deepEqual(errors,[]);
  const receipt={at:new Date().toISOString(),base,label,realChainData:true,readOnlyWalletFixture:true,initialCapabilityFailureInjected:capFailures,cardRefreshRecoveredCapability:true,listGridToggle:true,ownerBulkReview,reviewedStacks,bulkUnavailable:ownerBulkReview?null:"No owner or own-personal stock remains in target SSU; fixture covers bulk action",existingSharedWithdrawReview:!ownerBulkReview,originalBindingPreserved:true,gridPreferenceStored:true,widths:[1440,650,390,320],counts,writes:0,errors,network};
  writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({...receipt,network:undefined,networkRequests:network.length}));
} catch (error) {
  if (page) { writeFileSync(new URL(`${label}-failure.txt`,import.meta.url),await page.locator('body').innerText().catch(()=>'')); await page.screenshot({path:new URL(`${label}-failure.png`,import.meta.url).pathname}).catch(()=>{}); }
  throw error;
} finally { await browser.close(); }
