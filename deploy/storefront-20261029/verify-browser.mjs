// Real release + live chain data. Synthetic read-only Wallet Standard account;
// sign/execute always reject. TLS-validating Node relay supplies authenticated
// egress to Chromium; no certificate checks are disabled and no API fixtures.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.STOREFRONT_QA_BASE || 'http://127.0.0.1:5356';
const label = process.env.STOREFRONT_QA_LABEL || 'preview';
assert.ok(['preview', 'live'].includes(label));
const candidate=JSON.parse(readFileSync(new URL('live-before.json',import.meta.url))).candidate;
const walletAddress=candidate.wallet;
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
const network=[],errors=[];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  context.setDefaultTimeout(15000);
  let simulateReadFailure = false;
  await context.route('https://**/*', async route => {
    try {
      const req = route.request();
      if (simulateReadFailure && req.url().includes('fullnode.testnet.sui.io')) return route.abort('failed');
      const res = await fetch(req.url(), { method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer(), signal: AbortSignal.timeout(20000) });
      const headers = Object.fromEntries(res.headers); delete headers['content-encoding']; delete headers['content-length'];
      network.push({ url: req.url(), status: res.status, grpcStatus:res.headers.get('grpc-status'), grpcMessage:res.headers.get('grpc-message') });
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
  await page.getByRole('button',{name:'Inventory',exact:true}).click();
  await page.getByRole('heading',{name:'Tribal storage',exact:true}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Storefronts',exact:true}).click();
  await page.getByText('No storefronts yet',{exact:true}).waitFor({timeout:30000});
  const picker=page.getByRole('combobox',{name:'Choose storefront',exact:true});
  await page.waitForFunction(id=>[...document.querySelectorAll('select option')].some(o=>o.value===id),candidate.ssuId,{timeout:30000});
  await picker.selectOption(candidate.ssuId);
  await page.getByRole('heading',{name:'New storefront',exact:true}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Review activation',exact:true}).click();
  await page.getByRole('region',{name:'Review storefront transaction',exact:true}).waitFor({timeout:30000});
  assert.equal(await page.getByRole('button',{name:'Approve in wallet',exact:true}).isDisabled(),true);
  assert.match(await page.locator('.shop-review').innerText(),/not tribal sharing/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.screenshot({path:new URL(`${label}-storefront.png`,import.meta.url).pathname});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:new URL(`${label}-mobile.png`,import.meta.url).pathname});
  await page.setViewportSize({width:1440,height:1050});
  await page.getByRole('button',{name:'Tribal storage',exact:true}).click();
  await page.getByRole('heading',{name:'Tribal storage',exact:true}).waitFor();
  await page.getByRole('button',{name:'Storefronts',exact:true}).click();
  simulateReadFailure=true;
  await page.getByRole('button',{name:'Refresh shops',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Storefronts unavailable.'}).waitFor({timeout:30000});
  simulateReadFailure=false;
  await page.getByRole('button',{name:'Refresh shops',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Storefronts unavailable.'}).waitFor({state:'hidden',timeout:30000});
  assert.equal(await page.evaluate(()=>window.structureQA.writes),0);
  await page.getByRole('button',{name:/disconnect/i}).click();
  await page.getByRole('heading',{name:'Storefronts',exact:true}).waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  const receipt={at:new Date().toISOString(),base,label,readOnlyWalletFixture:true,realChainData:true,transport:'TLS-validating Node relay',catalogEmpty:true,ownedSsuDiscovered:candidate.ssuId,reviewActivationWithoutSigning:true,tribalStorageSeparate:true,readFailureRecovery:true,disconnectHidesHoldings:true,writes:0,errors,network};
  writeFileSync(new URL(`${label}-browser.json`,import.meta.url),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({...receipt,network:{calls:network.length}}));
} catch(error){writeFileSync(new URL(`${label}-failure.txt`,import.meta.url),JSON.stringify({error:String(error),network,errors},null,2));throw error;}finally{await browser.close();}
