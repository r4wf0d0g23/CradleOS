// Real release + live chain data. Synthetic read-only Wallet Standard account;
// sign/execute always reject. TLS-validating Node relay supplies authenticated
// egress to Chromium; no certificate checks are disabled and no API fixtures.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.STORAGE_QA_BASE || 'http://127.0.0.1:5342';
const label = process.env.STORAGE_QA_LABEL || 'preview';
assert.ok(['preview', 'live'].includes(label));
const deployment = JSON.parse(readFileSync(new URL('../storage-config-20261029/onchain.json',import.meta.url)));
const walletAddress = '0x9eb4912cc02e0e82c0dec9a97a0b4c5ac3e5fbebc4cde4089cfbc0150e382c33';
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
let page;
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
    window.structureQA.disconnect = () => wallet.features['standard:disconnect'].disconnect();
    window.addEventListener('wallet-standard:app-ready', e => e.detail.register(wallet));
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(wallet) }));
  }, walletAddress);
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: /connect/i }).first().click({ timeout: 15000 });
  await page.getByRole('button', { name: /^(Inventory|Inv)$/i }).click();
  await page.getByRole('button', { name: 'EXPAND ALL', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'EXPAND ALL', exact: true }).click();
  const cards=page.locator('.ssu-card');
  const target=cards.filter({hasText:'Reap Shared storage'});
  await target.getByText('Manage access',{exact:true}).waitFor({timeout:60000});
  await target.getByText('Manage access',{exact:true}).click();
  await target.getByRole('button',{name:'Review configuration',exact:true}).waitFor({timeout:60000});
  const reviewButton=target.getByRole('button',{name:'Review configuration',exact:true});
  await page.waitForFunction(()=>[...document.querySelectorAll('.ssu-card')].filter(c=>c.textContent.includes('Reap Shared storage')).some(c=>[...c.querySelectorAll('button')].some(b=>b.textContent==='Review configuration'&&!b.disabled)),undefined,{timeout:60000});
  for(const mode of ['Closed','Tribes','Pilots','Tribes + pilots','Public']) assert.equal(await target.getByRole('button',{name:mode,exact:true}).count(),1);
  await target.getByRole('button',{name:'Tribes',exact:true}).click();
  await target.getByRole('button',{name:'Add my tribe',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('input[aria-label="Tribe IDs"]')].some(e=>e.value==='98000666'));
  assert.equal(await target.getByRole('textbox',{name:'Tribe IDs',exact:true}).inputValue(),'98000666');
  await reviewButton.click();
  const review=target.getByLabel('Review storage configuration',{exact:true});
  await review.waitFor({timeout:30000});
  assert.ok((await review.innerText()).includes('Tribes: 98000666'));
  assert.ok((await review.innerText()).includes('No items move.'));
  assert.ok(await review.getByRole('button',{name:'Sign & apply',exact:true}).isDisabled());
  assert.equal(await page.evaluate(()=>window.structureQA.writes),0);
  await review.getByRole('button',{name:'Back',exact:true}).click();
  await target.getByRole('button',{name:'Pilots',exact:true}).click();
  await target.getByRole('button',{name:'Add pilot',exact:true}).click();
  await target.getByRole('textbox',{name:'Pilot 1 character ID',exact:true}).fill('0x753a02cc4a064d09704eb7333fb3bfee41317ee60a094571b85b120c4cea1ce5');
  assert.equal(await target.getByLabel('Pilot 1 expiry',{exact:true}).count(),1);
  for(const width of [1440,650,390,320]){
    await page.setViewportSize({width,height:950});
    await target.locator('.ssu-config').scrollIntoViewIfNeeded();
    assert.ok(await target.locator('.ssu-config').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`Configuration overflows at ${width}`);
    await page.screenshot({path:new URL(`${label}-storage-${width}.png`,import.meta.url).pathname});
  }
  assert.equal(await target.getByText('Release pending',{exact:true}).count(),0);
  assert.equal(await target.getByText('Access rules unavailable.',{exact:false}).count(),0);
  assert.equal(await page.evaluate(()=>window.structureQA.writes),0);
  assert.deepEqual(errors,[]);
  const receipt={at:new Date().toISOString(),base,label,packageId:deployment.packageId,registryId:deployment.registryId,realChainData:true,readOnlyWalletFixture:true,ownerConfigurationVisible:true,fiveModes:true,tribeReview:true,liveCharacterTribeLookup:true,pilotExpiryControls:true,consentRequired:true,widths:[1440,650,390,320],writes:0,errors,network};
  writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({...receipt,network:undefined,networkRequests:network.length}));
} catch (error) {
  if (page) { writeFileSync(new URL(`${label}-failure.txt`,import.meta.url),await page.locator('body').innerText().catch(()=>'')); await page.screenshot({path:new URL(`${label}-failure.png`,import.meta.url).pathname}).catch(()=>{}); }
  throw error;
} finally { await browser.close(); }
