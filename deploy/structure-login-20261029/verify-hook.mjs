// Actual React hook with deferred wallet/verifier fixtures; no real signing.
import { build } from '../../cradleos-dapp/node_modules/esbuild/lib/main.js';
import { chromium } from '/home/rawdata/.npm-global/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../cradleos-dapp/', import.meta.url).pathname;
const source = `import React from 'react';import{createRoot}from'react-dom/client';import{useVerifiedAccount}from'./src/hooks/useVerifiedAccount';
window.qa={account:null,listeners:new Set(),signs:[],proofs:[],telemetry:[],set(a){this.account=a?{address:a}:null;this.listeners.forEach(f=>f());}};
window.fetch=async(u,o)=>{window.qa.telemetry.push(JSON.parse(o.body));return new Response('{}')};
function Probe(){const s=useVerifiedAccount();window.qa.state=s;return React.createElement('div',null,s.isVerified?'verified':s.isVerifying?'verifying':s.verificationError||'connected');}
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Probe)));`;
const result = await build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', plugins: [{ name: 'wallet-fixture', setup(b) {
  b.onResolve({ filter: /^@mysten\/dapp-kit-react$|^@mysten\/sui\/verify$/ }, a => ({ path: a.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ resolveDir: root, contents: a.path.includes('dapp-kit')
    ? `import{useSyncExternalStore}from'react';export const useCurrentAccount=()=>useSyncExternalStore(f=>{window.qa.listeners.add(f);return()=>window.qa.listeners.delete(f)},()=>window.qa.account);const kit={signPersonalMessage:()=>new Promise((resolve,reject)=>window.qa.signs.push({resolve,reject}))};export const useDAppKit=()=>kit;const client={};export const useCurrentClient=()=>client;`
    : `export const verifyPersonalMessageSignature=()=>new Promise((resolve,reject)=>window.qa.proofs.push({resolve,reject}));` }));
} }] });
const server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html'); res.end(req.url === '/app.js' ? result.outputFiles[0].text : '<div id="root"></div><script src="/app.js"></script>'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: '/tmp/cradleos-sandboxed-chrome-20261021.sh' });
const checks = [];
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.qa?.state);
  await page.evaluate(() => window.qa.set('A')); await page.waitForFunction(() => window.qa.signs.length === 1);
  await page.evaluate(() => { window.qa.state.requestVerification(); window.qa.state.requestVerification(); });
  assert.equal(await page.evaluate(() => window.qa.signs.length), 1); checks.push('StrictMode + in-flight requests: one prompt');
  await page.evaluate(() => window.qa.signs[0].reject(new Error('User rejected request')));
  await page.waitForFunction(() => window.qa.state.verificationError === 'declined');
  assert.equal(await page.evaluate(() => window.qa.signs.length), 1); checks.push('decline does not loop or disconnect');
  await page.evaluate(() => window.qa.state.requestVerification()); await page.waitForFunction(() => window.qa.signs.length === 2);
  await page.evaluate(() => window.qa.signs[1].resolve({ signature: 'fixture' })); await page.waitForFunction(() => window.qa.proofs.length === 1);
  await page.evaluate(() => window.qa.set('B')); await page.waitForFunction(() => window.qa.signs.length === 3);
  await page.evaluate(() => window.qa.set('A')); await page.waitForFunction(() => window.qa.signs.length === 4);
  await page.evaluate(() => window.qa.proofs[0].resolve({ toSuiAddress: () => 'A' }));
  assert.equal(await page.evaluate(() => window.qa.state.isVerified), false); assert.equal(await page.evaluate(() => window.qa.telemetry.length), 0);
  await page.evaluate(() => window.qa.signs[2].resolve({ signature: 'stale-B' }));
  assert.equal(await page.evaluate(() => window.qa.proofs.length), 1); checks.push('A-B-A stale signature/proof ignored, no telemetry');
  await page.evaluate(() => window.qa.signs[3].resolve({ signature: 'current-A' })); await page.waitForFunction(() => window.qa.proofs.length === 2);
  await page.evaluate(() => window.qa.proofs[1].resolve({ toSuiAddress: () => 'WRONG' })); await page.waitForFunction(() => window.qa.state.verificationError?.includes('mismatch'));
  assert.equal(await page.evaluate(() => window.qa.telemetry.length), 0); checks.push('mismatched address never verified or reported');
  await page.evaluate(() => window.qa.state.requestVerification()); await page.waitForFunction(() => window.qa.signs.length === 5);
  await page.evaluate(() => window.qa.signs[4].resolve({ signature: 'valid-A' })); await page.waitForFunction(() => window.qa.proofs.length === 3);
  await page.evaluate(() => window.qa.proofs[2].resolve({ toSuiAddress: () => 'A' })); await page.waitForFunction(() => window.qa.state.isVerified);
  assert.equal(await page.evaluate(() => window.qa.telemetry.length), 1); checks.push('current valid proof alone permits verification/telemetry');
  await page.evaluate(() => window.qa.set('B')); await page.waitForFunction(() => window.qa.signs.length === 6);
  assert.equal(await page.evaluate(() => window.qa.state.isVerified), false);
  await page.evaluate(() => window.qa.set(null)); await page.waitForFunction(() => window.qa.state.account === null);
  await page.evaluate(() => window.qa.signs[5].resolve({ signature: 'late' }));
  assert.equal(await page.evaluate(() => window.qa.proofs.length), 3); checks.push('switch/disconnect immediately invalidates verified state');
  assert.deepEqual(errors, []);
  const receipt = { at: new Date().toISOString(), checks, errors, walletAndVerifier: 'deferred fixtures', realPinOrSigningVerified: false };
  writeFileSync(new URL('hook-browser.json', import.meta.url), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} finally { await browser.close(); server.close(); }
