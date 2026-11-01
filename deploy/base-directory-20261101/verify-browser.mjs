// Real release + live chain data. Synthetic read-only Wallet Standard account;
// sign/execute always reject. TLS-validating Node relay supplies authenticated
// egress to Chromium; no certificate checks are disabled and no API fixtures.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:5367';
const label = base.startsWith('https:') ? 'live' : 'preview';
assert.ok(['preview', 'live'].includes(label));
const walletAddress = '0x29a4be9bf591d1409319b4f763b041a82f64225bc4868cf86875f834833bd676';
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const network = [], errors = []; let simulateReadFailure = false;
  await context.route('https://**/*', async route => {
    try {
      const req = route.request();
      if (simulateReadFailure && req.url().includes('fullnode.testnet.sui.io')) return route.abort('failed');
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
    window.addEventListener('wallet-standard:app-ready', e => e.detail.register(wallet));
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(wallet) }));
  }, walletAddress);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: /connect/i }).first().click({ timeout: 15000 });
  await page.getByText('MY STRUCTURES', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('Loading structures…', { exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
  const directory = page.locator('.base-directory');
  const cards = page.locator('[data-base-id]');
  assert.equal(await cards.count(), 6);
  const summary = await page.locator('.base-directory-summary').first().innerText();
  assert.match(summary, /27 structures/); assert.match(summary, /6 turrets/); assert.match(summary, /2 storage/);
  assert.equal(await directory.getByText('Hidden', {exact:true}).count(), 0);
  assert.equal(await directory.getByText('Location unknown', {exact:true}).count(), 6);
  assert.equal(await cards.filter({hasText:'T.R NN'}).count(),1);
  const nodeId='0x5339e0e4e3e17415008ec9020552186bc373d8fb6737a4428da4d80a09f24f98';
  const target=page.locator(`[data-base-id="${nodeId}"]`);
  const before=await target.innerText();
  assert.match(before,/6 turrets · 1 storage · 3 industry/);
  const search=page.getByRole('textbox',{name:'Find base or structure'});
  await search.fill('1000003210130');
  assert.equal(await cards.count(),1);assert.equal(await target.innerText(),before);
  await search.fill('no-such-base');assert.equal(await cards.count(),0);assert.ok(await page.getByText('No matches',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await cards.count(),6);
  await page.getByRole('button',{name:'Collapse all',exact:true}).click();
  assert.equal(await cards.getByRole('button',{name:/^Expand /}).count(),6);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Expand all',exact:true}).waitFor({timeout:60000});
  assert.equal(await cards.getByRole('button',{name:/^Expand /}).count(),6);
  await page.getByRole('button',{name:'Expand all',exact:true}).click();
  assert.equal(await cards.getByRole('button',{name:/^Collapse /}).count(),6);
  const widths=[];
  for(const width of [1440,650,390,320]){
    await page.setViewportSize({width,height:1000});await directory.scrollIntoViewIfNeeded();
    const dimensions=await directory.evaluate(el=>({width:window.innerWidth,document:document.documentElement.scrollWidth,cards:[...el.querySelectorAll('[data-base-id]')].map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})}));
    assert.ok(dimensions.cards.every(c=>c.left>=0 && c.right<=width+1),JSON.stringify(dimensions));
    assert.ok(dimensions.document<=width+1,JSON.stringify(dimensions));
    widths.push(dimensions);
    if(width===1440||width===390){await directory.scrollIntoViewIfNeeded();await page.screenshot({path:new URL(`${label}-${width}.png`,import.meta.url).pathname});}
  }
  assert.equal(await page.evaluate(()=>window.structureQA.writes),0);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  assert.equal(await cards.count(),0);
  const receipt={at:new Date().toISOString(),base,readOnlyWalletFixture:true,realChainData:true,summary,checks:['six owned bases','all 27 structures','truthful location labels','custom and stable ID names','child search retains full base','no matches and clear','collapse persists across reload','expand all','responsive 1440/650/390/320','disconnect clears'],widths,writes:await page.evaluate(()=>window.structureQA.writes),errors};
  writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close();}
