// Real chain/API data; intentional failures test presentation, never sign/send.
// TLS-validating relay supplies Chromium's authenticated external egress.
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.HEADER_QA_BASE || 'http://127.0.0.1:5360';
const label = process.env.HEADER_QA_LABEL || 'preview';
assert.ok(['preview', 'live'].includes(label));
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
const network = [], errors = [], checks = [];
let mode = 'down';
const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  // A preceding health probe may still be finishing when the failure mode
  // changes; allow the next real 30s poll instead of requiring overlap.
  ctx.setDefaultTimeout(45000);
  await ctx.route('https://**/*', async route => {
    const req = route.request(), url = req.url();
    try {
      assert.ok(!/ExecuteTransaction|SubmitTransaction/.test(url), 'No chain writes');
      if (mode === 'down' && /GetServiceInfo|world-api-stillness.*\/health/.test(url) || mode === 'partial' && /GetEpoch$/.test(url)) {
        network.push({ url, simulatedFailure: mode }); return route.abort('failed');
      }
      const res = await fetch(url, { method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer(), signal: AbortSignal.timeout(20000) });
      const headers = Object.fromEntries(res.headers); delete headers['content-encoding']; delete headers['content-length'];
      network.push({ url, status: res.status, grpcStatus: res.headers.get('grpc-status') });
      await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
    } catch (error) { network.push({ url, error: String(error) }); await route.abort(); }
  });
  return ctx;
}
async function state(page, value) { await page.locator(`.header-chain-status[data-state="${value}"]`).waitFor(); }
async function refresh(page) { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); }
async function cleanHeader(page) {
  const text = await page.locator('.header-chain-status').innerText();
  assert.doesNotMatch(text, /NaN|undefined|Infinity|\bRPC\b/);
  assert.equal(await page.getByText('ERA 6: AWAKENING', { exact: true }).count(), 0);
  assert.equal(await page.getByText('NO WALLET', { exact: true }).count(), 0);
  return text;
}
try {
  const desktop = await context(), page = await desktop.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await state(page, 'Unavailable');
  await page.locator('.header-api-status[data-state="Unavailable"]').waitFor();
  assert.doesNotMatch(await cleanHeader(page), /CP #|API \d+ms/);
  checks.push('First-read failure is Unavailable, no fabricated values or successful latency');
  mode = 'live'; await refresh(page); await state(page, 'Live');
  await page.locator('.header-api-status[data-state="Available"]').waitFor();
  const liveText = await cleanHeader(page);
  assert.match(liveText, /CP #[\d,]+/); assert.match(liveText, /Validators \d+/); assert.match(liveText, /Gas [\d,]+ MIST/);
  assert.match(liveText, /API \d+ms/);
  assert.equal(await page.locator('.header-chain-status .header-status-value').evaluate(e => getComputedStyle(e).color), 'rgb(0, 255, 150)');
  checks.push('Live supported gRPC checkpoint/epoch/committee/gas and successful API read timing');
  for (const width of [320, 390, 650, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.locator('.header-chain-status').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
    assert.ok(await page.locator('.header-api-status').isVisible());
    assert.ok(await page.getByRole('link', { name: 'Get EVE Vault' }).isVisible());
    if ([390, 1440].includes(width)) await page.screenshot({ path: new URL(`${label}-desktop-${width}.png`, import.meta.url).pathname });
  }
  checks.push('Header fits 320/390/650/1440; narrow desktop retains correct install choice');
  mode = 'partial'; await refresh(page); await state(page, 'Partial');
  const partial = await cleanHeader(page);
  assert.match(partial, /Validators Unavailable/); assert.match(partial, /Gas Unavailable/); assert.match(partial, /CP #[\d,]+/);
  checks.push('Epoch failure is Partial; checkpoint retained, unknown fields not zero');
  mode = 'down'; await refresh(page); await state(page, 'Stale');
  assert.match(await cleanHeader(page), /API Unavailable/);
  await page.locator('.header-api-status[data-state="Unavailable"]').waitFor();
  checks.push('Failed refresh marks previous chain readings Stale and suppresses old latency');
  mode = 'live'; await refresh(page); await state(page, 'Live');
  await page.locator('.header-api-status[data-state="Available"]').waitFor();
  await page.clock.setSystemTime(new Date(Date.now() + 120000));
  await state(page, 'Stale');
  await page.locator('.header-api-status[data-state="Stale"]').waitFor();
  assert.ok(Number((await cleanHeader(page)).match(/(\d+)s ago/)[1]) >= 90);
  await page.clock.setSystemTime(new Date()); await refresh(page); await state(page, 'Live');
  checks.push('Age advances with clock; suspended/old samples become Stale and recover');
  await desktop.close();

  const mobile = await context({ viewport: { width: 390, height: 844 }, userAgent: mobileUA, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage(); phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(base, { waitUntil: 'domcontentloaded' }); await state(phone, 'Live');
  await phone.getByText('Connect from desktop', { exact: true }).waitFor();
  assert.equal(await phone.getByRole('link', { name: 'Get EVE Vault' }).count(), 0);
  await phone.getByText('NOT CONNECTED', { exact: true }).waitFor();
  await cleanHeader(phone);
  await phone.screenshot({ path: new URL(`${label}-mobile.png`, import.meta.url).pathname });
  checks.push('Mobile without provider shows desktop guidance; no extension ZIP or missing-wallet ownership claim');
  await mobile.close();

  const provider = await context({ viewport: { width: 390, height: 844 }, userAgent: mobileUA, isMobile: true, hasTouch: true });
  await provider.addInitScript(() => {
    const wallet = { version: '1.0.0', name: 'Eve Vault', icon: 'data:image/svg+xml;base64,PHN2Zy8+', chains: ['sui:testnet'], accounts: [], features: {
      'standard:connect': { version: '1.0.0', connect: async () => { throw Error('Read-only provider detection fixture'); } },
      'standard:events': { version: '1.0.0', on: () => () => {} },
      'sui:signPersonalMessage': { version: '1.0.0', signPersonalMessage: async () => { throw Error('Read-only fixture'); } },
      'sui:signTransaction': { version: '2.0.0', signTransaction: async () => { throw Error('Read-only fixture'); } },
      'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction: async () => { throw Error('Read-only fixture'); } },
    } };
    window.addEventListener('wallet-standard:app-ready', e => e.detail.register(wallet));
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: ({ register }) => register(wallet) }));
  });
  const detected = await provider.newPage(); detected.on('pageerror', error => errors.push(error.message));
  await detected.goto(base, { waitUntil: 'domcontentloaded' });
  await detected.locator('.header-missing-vault').waitFor({ state: 'hidden' });
  await detected.getByRole('button', { name: 'Connect EVE Vault', exact: true }).first().waitFor();
  assert.equal(await detected.locator('.header-missing-vault').count(), 0);
  checks.push('Detected provider retains Connect action on mobile; no UA-based connection block (synthetic discovery only)');
  await provider.close();
  assert.deepEqual(errors, []);
  assert.ok(!network.some(n => /ExecuteTransaction|SubmitTransaction/.test(n.url)));
  assert.ok(!network.some(n => /fullnode.testnet.*\/sui\.rpc/.test(n.url) && n.status >= 400));
  const receipt = { at: new Date().toISOString(), base, label, checks, realData: true, simulatedFailures: true, syntheticMobileProviderDiscovery: true, walletSigningTested: false, transport: 'TLS-validating Node fetch relay', errors, network };
  writeFileSync(new URL(`${label}-browser.json`, import.meta.url), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ ...receipt, network: { calls: network.length } }));
} catch (error) {
  writeFileSync(new URL(`${label}-failure.txt`, import.meta.url), JSON.stringify({ error: String(error), checks, errors, network }, null, 2));
  throw error;
} finally { await browser.close(); }
