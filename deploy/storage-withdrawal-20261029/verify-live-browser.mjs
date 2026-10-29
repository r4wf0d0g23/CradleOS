// Real release + live chain data. Synthetic read-only Wallet Standard account;
// sign/execute always reject. TLS-validating Node relay supplies authenticated
// egress to Chromium; no certificate checks are disabled and no API fixtures.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.STORAGE_QA_BASE || 'http://127.0.0.1:5357';
const label = process.env.STORAGE_QA_LABEL || 'preview';
assert.ok(['preview', 'live'].includes(label));
const deployment = JSON.parse(readFileSync(new URL('../storage-owner-deposit-20261029/onchain.json',import.meta.url)));
const walletAddress = '0x9eb4912cc02e0e82c0dec9a97a0b4c5ac3e5fbebc4cde4089cfbc0150e382c33';
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  context.setDefaultTimeout(15000);
  const network = [], errors = []; let failCapRead = false; let capFailures = 0;
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
  const name='Large Reaper Shared Storage';
  await page.getByRole('button',{name:'Expand '+name,exact:true}).click();
  const target=page.locator('.ssu-card').filter({has:page.getByRole('button',{name:'Collapse '+name,exact:true})});
  await target.getByRole('button',{name:'Move all to owner storage',exact:true}).waitFor({timeout:60000});
  const rows=await target.locator('.ssu-stock-list li').count();assert.equal(rows,13);
  await target.getByRole('button',{name:'Move all to owner storage',exact:true}).click();
  const review=target.getByRole('region',{name:'Review storage transfer'});
  await review.waitFor();assert.equal(await review.getByRole('textbox').count(),13);
  assert.equal(await review.getByLabel('Quantity for 89089').inputValue(),'163');
  assert.equal(await review.getByLabel('Quantity for 84210').inputValue(),'28');
  assert.equal(await review.getByRole('button',{name:'Sign transfer',exact:true}).isDisabled(),true);
  await review.getByLabel('Quantity for 89089').fill('1');
  for(const width of [1440,650,390,320]){await page.setViewportSize({width,height:950});await review.scrollIntoViewIfNeeded();assert.ok(await review.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:new URL(`${label}-recovery-${width}.png`,import.meta.url).pathname});}
  await review.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.setViewportSize({width:650,height:950});
  for(const view of ['List','Grid']){await target.getByRole('button',{name:view,exact:true}).click();await target.locator('.ssu-stock-toolbar').scrollIntoViewIfNeeded();assert.ok(await target.locator('.ssu-card-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:new URL(`${label}-${view.toLowerCase()}.png`,import.meta.url).pathname});}
  assert.equal(await page.evaluate(()=>window.structureQA.writes),0);
  await page.getByRole('button',{name:/disconnect/i}).click();
  await page.getByRole('button',{name:'Move all to owner storage',exact:true}).waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  const receipt={at:new Date().toISOString(),base,label,actualChain:true,readOnlySyntheticWallet:true,actualEveVault:false,rows,foam:163,carbonWeave:28,exactAmountReview:true,responsive:[1440,650,390,320],writes:0,errors,network};
  writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,network:{calls:network.length}}));
} catch(e){if(page){writeFileSync(new URL(`${label}-failure.txt`,import.meta.url),await page.locator('body').innerText());await page.screenshot({path:new URL(`${label}-failure.png`,import.meta.url).pathname}).catch(()=>{});}throw e;}finally{await browser.close();}
