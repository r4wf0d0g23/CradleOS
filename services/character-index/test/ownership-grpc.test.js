import test from 'node:test';
import assert from 'node:assert/strict';
import { OwnershipGrpc } from '../ownership-grpc.js';

const objects = [
  { objectId: '0x1', version: '7', digest: 'd1', type: '0x0002::coin::Coin<0x0002::sui::SUI>', owner: { AddressOwner: '0xa' }, json: { id: '0x1', balance: '9' } },
  { objectId: '0x2', version: '8', digest: 'd2', type: '0xabc::m::Thing', owner: { AddressOwner: '0xa' }, json: { id: '0x2' } },
];
const client = {
  async listOwnedObjects() { return { objects, cursor: null, hasNextPage: false }; },
  async listBalances() { return { balances: [{ coinType: '0x0002::sui::SUI', balance: '9', addressBalance: '0' }], cursor: null, hasNextPage: false }; },
};

test('translates local gRPC objects into legacy JSON-RPC shape', async () => {
  const grpc = new OwnershipGrpc({ client });
  const result = await grpc.handle('suix_getOwnedObjects', ['0xa', { filter: { Package: '0x2' }, options: { showType: true, showContent: true } }, null, 50]);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].data.type, '0x2::coin::Coin<0x2::sui::SUI>');
  assert.equal(result.data[0].data.content.fields.balance, '9');
});

test('derives all coins and exact legacy balance counts from gRPC', async () => {
  const grpc = new OwnershipGrpc({ client });
  const coins = await grpc.handle('suix_getAllCoins', ['0xa', null, 50]);
  const balances = await grpc.handle('suix_getAllBalances', ['0xa']);
  assert.equal(coins.data.length, 1);
  assert.equal(coins.data[0].coinType, '0x2::sui::SUI');
  assert.equal(balances[0].coinObjectCount, 1);
  assert.equal(balances[0].totalBalance, '9');
});
