import test from 'node:test';
import assert from 'node:assert/strict';

// Each test file runs in an isolated Node test worker. Never open a deployed DB.
process.env.CHARACTER_INDEX_DB = ':memory:';
const { openDb, getState, setState } = await import('../db.js');
const { pollIncrement, pollKillsIncrement, pollOwnedIncrement, STILLNESS_WORLD } = await import('../indexer.js');

const objectId = `0x${'1'.repeat(64)}`;
const wallet = `0x${'2'.repeat(64)}`;
const marker = { txDigest: 'already-processed', eventSeq: '0' };
const modules = ['network_node', 'gate', 'assembly', 'turret', 'storage_unit', 'access', 'character'];

function event(payload) {
  return { sequenceNumber: 1, timestamp: '2026-10-02T12:00:00Z',
    transaction: { digest: 'newly-observed' }, contents: { json: payload } };
}

function mockChain(t, kind) {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.query) {
      const payload = kind === 'characters' ? { character_id: objectId } :
        kind === 'killmails' ? { kill_timestamp: '1790942400', killer_id: { item_id: '1' }, victim_id: { item_id: '2' } } :
        { network_node_id: objectId };
      const include = kind !== 'owned_objects' || body.query.includes('::network_node');
      return Response.json({ data: { events: { nodes: include ? [event(payload)] : [],
        pageInfo: { hasPreviousPage: false, hasNextPage: false, startCursor: null, endCursor: null } } } });
    }
    assert.equal(body.method, 'sui_multiGetObjects');
    const suffix = kind === 'characters' ? 'character::Character' : 'network_node::NetworkNode';
    return Response.json({ result: body.params[0].map(id => ({ data: {
      objectId: id, version: '1', type: `${STILLNESS_WORLD}::${suffix}`,
      owner: { Shared: { initial_shared_version: 1 } },
      content: { fields: { character_address: wallet, tribe_id: 1,
        metadata: { fields: { name: 'Test pilot' } }, key: { fields: { item_id: '1' } } } },
    } })) });
  });
}

for (const [table, poller, stateKeys] of [
  ['characters', pollIncrement, {
    'poll:stillness:last_event_digest': marker.txDigest,
    'poll:stillness:last_event_seq': marker.eventSeq,
    'poll:stillness:last_run_ms': '123',
  }],
  ['killmails', pollKillsIncrement, {
    'kills-poll:stillness:last_event_digest': marker.txDigest,
    'kills-poll:stillness:last_event_seq': marker.eventSeq,
    'kills-poll:stillness:last_run_ms': '123',
  }],
  ['owned_objects', pollOwnedIncrement, {
    ...Object.fromEntries(modules.map(mod => [`owned_evt_cursor_stillness_${mod}`, JSON.stringify(marker)])),
    owned_backfill_ok_ms_stillness: '123',
    owned_backfill_ms_stillness: '123',
  }],
]) {
  test(`${table}: a failed database write cannot advance event markers or freshness`, async t => {
    const db = openDb();
    t.after(() => db.close());
    for (const [key, value] of Object.entries(stateKeys)) setState(db, key, value);
    db.exec(`CREATE TRIGGER reject_test_write BEFORE INSERT ON ${table}
      BEGIN SELECT RAISE(ABORT, 'forced write failure'); END;`);
    mockChain(t, table);
    await assert.rejects(poller(db, 'stillness', () => {}), /forced write failure/);
    for (const [key, value] of Object.entries(stateKeys)) assert.equal(getState(db, key), value, key);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  });
}

function mockMixedCandidates(t, { unresolvedTarget = false } = {}) {
  const coinId = `0x${'3'.repeat(64)}`;
  const configId = `0x${'4'.repeat(64)}`;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.query) return Response.json({ data: { events: {
      nodes: body.query.includes('::network_node') ? [event({ node_id: objectId, payment_id: coinId, config_id: configId })] : [],
      pageInfo: { hasPreviousPage: false, hasNextPage: false, startCursor: null, endCursor: null },
    } } });
    assert.equal(body.method, 'sui_multiGetObjects');
    return Response.json({ result: body.params[0].map(id => ({ data: {
      objectId: id, version: '1', owner: { Shared: { initial_shared_version: 1 } },
      type: id === coinId ? '0x2::coin::Coin<0x2::sui::SUI>' :
        `${STILLNESS_WORLD}::${id === configId ? 'energy::EnergyConfig' : 'network_node::NetworkNode'}`,
      ...(unresolvedTarget && id === objectId ? {} : { content: { fields: {} } }),
    } })) });
  });
}

test('owned event candidates skip confirmed non-target types without blocking current structures', async t => {
  const db = openDb(); t.after(() => db.close());
  mockMixedCandidates(t);
  const n = await pollOwnedIncrement(db, 'stillness', () => {});
  assert.equal(n, 1);
  assert.deepEqual(db.prepare('SELECT object_id FROM owned_objects').all(), [{ object_id: objectId }]);
  assert.equal(JSON.parse(getState(db, 'owned_evt_cursor_stillness_network_node')).txDigest, 'newly-observed');
});

test('mixed candidates never turn unresolved target content into a healthy empty poll', async t => {
  const db = openDb(); t.after(() => db.close());
  const key = 'owned_evt_cursor_stillness_network_node';
  setState(db, key, JSON.stringify(marker));
  setState(db, 'owned_backfill_ok_ms_stillness', '123');
  mockMixedCandidates(t, { unresolvedTarget: true });
  await assert.rejects(pollOwnedIncrement(db, 'stillness', () => {}), /unresolved|incomplete/i);
  assert.equal(getState(db, key), JSON.stringify(marker));
  assert.equal(getState(db, 'owned_backfill_ok_ms_stillness'), '123');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM owned_objects').get().n, 0);
});
