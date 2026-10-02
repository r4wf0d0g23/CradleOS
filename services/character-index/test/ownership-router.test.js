import test from 'node:test';
import assert from 'node:assert/strict';
import { OwnershipRouter } from '../ownership-router.js';

test('uses local gRPC primary without touching recovery cache', async () => {
  let fallbackCalls = 0;
  const router = new OwnershipRouter(
    { async handle() { return { data: ['local'] }; } },
    { async handle() { fallbackCalls++; return { data: ['cache'] }; } },
    { logger: { warn() {} } },
  );
  assert.deepEqual(await router.handle('suix_getOwnedObjects', []), { data: ['local'] });
  assert.equal(fallbackCalls, 0);
  assert.deepEqual(router.stats, { grpcHits: 1, grpcFallbacks: 0, cacheHits: 0 });
});

test('falls back to recovered cache when local gRPC fails', async () => {
  const warnings = [];
  const router = new OwnershipRouter(
    { async handle() { throw new Error('node unavailable'); } },
    { async handle() { return { data: ['cache'] }; } },
    { logger: { warn(message) { warnings.push(message); } } },
  );
  assert.deepEqual(await router.handle('suix_getOwnedObjects', []), { data: ['cache'] });
  assert.equal(warnings.length, 1);
  assert.deepEqual(router.stats, { grpcHits: 0, grpcFallbacks: 1, cacheHits: 1 });
});
