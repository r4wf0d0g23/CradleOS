import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dist = new URL('../../cradleos-dapp/dist/', import.meta.url);
const hash = b => createHash('sha256').update(b).digest('hex');
const refs = s => [...s.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m => m[1]).sort();
const r = await fetch('https://cradleos.io/', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
assert.equal(r.status, 200);
const html = await r.text();
assert.deepEqual(refs(html), refs(readFileSync(new URL('index.html', dist), 'utf8')));
const assets = [];
for (const file of readdirSync(new URL('assets/', dist)).filter(n => /\.(js|css)$/.test(n))) {
  const path = `assets/${file}`, expected = readFileSync(new URL(path, dist));
  const res = await fetch(`https://cradleos.io/${path}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(res.status, 200); const bytes = Buffer.from(await res.arrayBuffer()); assert.equal(hash(bytes), hash(expected));
  assets.push({ path, bytes: bytes.length, sha256: hash(bytes), matches: true });
}
const receipt = { at: new Date().toISOString(), origin: 'https://cradleos.io/', sourceCommit: process.env.STORAGE_RELEASE_SHA, htmlReferencesMatch: true, assets };
writeFileSync(new URL('live-assets.json', import.meta.url), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
