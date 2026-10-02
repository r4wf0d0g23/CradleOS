import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import http from 'node:http';
import { OwnershipCache } from '../ownership-cache.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE wallet_objects(owner TEXT,object_id TEXT,type_full TEXT,object_json TEXT,refreshed_ms INTEGER,PRIMARY KEY(owner,object_id));
    CREATE TABLE wallet_sync_state(owner TEXT PRIMARY KEY,last_ok_ms INTEGER DEFAULT 0,last_attempt_ms INTEGER DEFAULT 0,last_access_ms INTEGER DEFAULT 0,object_count INTEGER DEFAULT 0,checkpoint INTEGER,balances_json TEXT,last_error TEXT);`);
  return db;
}
const owner = '0x1';
const normalized = `0x${'1'.padStart(64, '0')}`;
function entry(id, type, balance) {
  return { data: { objectId: id, version: '7', digest: `digest-${id}`, type, owner: { AddressOwner: normalized }, previousTransaction: 'tx', content: { dataType: 'moveObject', type, fields: balance == null ? {} : { balance: String(balance) } } } };
}
function insert(db, entries) {
  const stmt = db.prepare('INSERT INTO wallet_objects VALUES(?,?,?,?,?)');
  for (const e of entries) stmt.run(normalized, e.data.objectId, e.data.type, JSON.stringify(e), Date.now());
}

test('filters and projects owned objects', () => {
  const db = makeDb(); const cache = new OwnershipCache(db, { alchemyUrl: 'unused' });
  insert(db, [entry('0xa', '0x2::coin::Coin<0x2::sui::SUI>', 4), entry('0xb', '0x9::m::Thing')]);
  const result = cache.ownedObjects(owner, { filter: { MoveModule: { package: '0x9', module: 'm' } }, options: { showType: true } });
  assert.equal(result.data.length, 1); assert.equal(result.data[0].data.type, '0x9::m::Thing'); assert.equal(result.data[0].data.content, undefined);
});

test('derives coins and balances from one snapshot', () => {
  const db = makeDb(); const cache = new OwnershipCache(db, { alchemyUrl: 'unused' });
  const type = '0x2::coin::Coin<0x2::sui::SUI>';
  insert(db, [entry('0xa', type, 4), entry('0xb', type, 9)]);
  db.prepare('INSERT INTO wallet_sync_state(owner,balances_json) VALUES(?,?)').run(normalized, JSON.stringify([{ coinType: '0x2::sui::SUI', coinObjectCount: 2, totalBalance: '13', lockedBalance: {}, fundsInAddressBalance: '7' }]));
  assert.equal(cache.coins(owner).data.length, 2);
  assert.deepEqual(cache.balances(owner), [{ coinType: '0x2::sui::SUI', coinObjectCount: 2, totalBalance: '13', lockedBalance: {}, fundsInAddressBalance: '7' }]);
});

test('refresh is paginated, atomic, and retains bounded stale data on upstream failure', async (t) => {
  const db = makeDb();
  let fail = false;
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const call = JSON.parse(raw);
    res.setHeader('content-type', 'application/json');
    if (fail) { res.statusCode = 503; return res.end('{}'); }
    let result;
    if (call.method === 'suix_getOwnedObjects') {
      const cursor = call.params[2];
      result = cursor ? { data: [entry('0xb', '0x9::m::Thing')], hasNextPage: false, nextCursor: null }
        : { data: [entry('0xa', '0x9::m::Thing')], hasNextPage: true, nextCursor: '0xa' };
    } else if (call.method === 'sui_getLatestCheckpointSequenceNumber') result = '123';
    else if (call.method === 'suix_getAllBalances') result = [];
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  const cache = new OwnershipCache(db, { alchemyUrl: url, ttlMs: 0, maxStaleMs: 60_000 });
  const state = await cache.ensureFresh(owner, { force: true });
  assert.equal(state.object_count, 2); assert.equal(state.checkpoint, 123); assert.equal(cache.entries(owner).length, 2);
  fail = true;
  const stale = await cache.ensureFresh(owner, { force: true });
  assert.equal(stale.object_count, 2); assert.equal(cache.entries(owner).length, 2);
});
