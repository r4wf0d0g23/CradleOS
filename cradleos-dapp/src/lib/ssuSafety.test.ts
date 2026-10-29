import { afterEach, expect, it, vi } from "vitest";
import { GrpcTypes } from '@mysten/sui/grpc';
import { deriveDynamicFieldID } from '@mysten/sui/utils';
import { idFieldId, type StorageReadClient } from './storageRead';
import { Transaction } from "@mysten/sui/transactions";
import { WORLD_PKG, SSU_ACCESS_PKG } from "../constants";
import { assertCycleCompatible } from "./transactionCompatibility";
import { CurrentAccountSigner } from "./cycleSigner";
import {
  appendSharedDeposit,
  appendOwnerDepositToOpen,
  appendRecoverToShared,
  buildPromoteToSharedTx,
} from "./ssuAccess";
import {
  buildDisableSsuSharingTx,
  decodeSsuExtension,
  fetchSsuSnapshot,
  openStorageKey,
  SSU_AUTH,
  SSU_TYPE,
  type SsuSnapshot,
} from "./ssuSafety";

const id = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const snapshot = (): SsuSnapshot => ({
  id: id(1),
  ownerCapId: id(2),
  type: SSU_TYPE,
  version: "10",
  extension: SSU_AUTH,
  frozen: false,
  online: true,
  slots: [
    {
      key: openStorageKey(id(1)),
      partition: "open",
      used: 20,
      max: 100,
      items: [
        {
          typeId: 1,
          quantity: 2,
          volume: 10,
          itemId: "1",
          partition: "open",
          partitionKey: openStorageKey(id(1)),
        },
      ],
    },
  ],
  readAt: Date.now(),
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("builds only owner revocation, leaving all assets untouched even with shared stock", () => {
  const tx = buildDisableSsuSharingTx(snapshot(), id(3), id(2), id(4));
  const calls = tx.getData().commands.map((c) => c.MoveCall!);
  expect(calls.map((c) => c.function)).toEqual([
    "borrow_owner_cap",
    "revoke_extension_authorization",
    "return_owner_cap",
  ]);
  expect(calls[1].typeArguments).toEqual([]);
  expect(calls[1].arguments).toHaveLength(2);
  expect(calls[0].typeArguments).toEqual([SSU_TYPE]);
  expect(tx.getData().sender).toBe(id(4));
  expect(() => assertCycleCompatible(tx)).not.toThrow();
  expect(JSON.stringify(tx.getData())).not.toMatch(
    /new_auth|withdraw|deposit|TransferObjects/,
  );
});
it("allows revocation while offline and without free owner capacity", () => {
  expect(() =>
    buildDisableSsuSharingTx(
      { ...snapshot(), online: false },
      id(3),
      id(2),
      id(4),
    ),
  ).not.toThrow();
});
it.each([
  ["frozen", { frozen: true }],
  ["foreign", { extension: `${id(9)}::extension::Auth` }],
  ["none", { extension: null }],
  ["wrong owner", { ownerCapId: id(8) }],
  ["old world", { type: `${id(9)}::storage_unit::StorageUnit` }],
  ["expired", { readAt: 1 }],
])("rejects %s revocation state", (_label, patch) => {
  expect(() =>
    buildDisableSsuSharingTx(
      { ...snapshot(), ...patch } as SsuSnapshot,
      id(3),
      id(2),
      id(4),
    ),
  ).toThrow();
});
it.each([null, [], { vec: [] }])(
  "recognizes explicit unconfigured binding %j",
  (raw) => expect(decodeSsuExtension(raw)).toBeNull(),
);
it.each([
  SSU_AUTH,
  SSU_AUTH.slice(2),
  { fields: { name: SSU_AUTH.slice(2) } },
  { vec: [{ name: SSU_AUTH }] },
])("recognizes active binding %j", (raw) =>
  expect(decodeSsuExtension(raw)).toBe(SSU_AUTH),
);
it.each([
  undefined,
  "",
  "broken",
  {},
  { vec: "bad" },
  [SSU_AUTH, SSU_AUTH],
  [null],
])("fails closed on ambiguous binding %j", (raw) =>
  expect(() => decodeSsuExtension(raw)).toThrow(),
);
it("matches the independently captured live open-inventory key", () => {
  expect(
    openStorageKey(
      "0x63e80d174bdcb508dad45dc9883c235ff31cc49968b854bf02a0ede5eb6d71e7",
    ),
  ).toBe("0xeeb393bc39e1ef8c06bcf161f04e7596084db661db264fc1e0c260f9648bc5d0");
});
function setupReader({ changed = false, fail = false, slots = 2, childChanged = false } = {}) {
  let reads = 0;
  const keys = [id(2), openStorageKey(id(1)), ...Array.from({ length: Math.max(0, slots - 2) }, (_, i) => id(100 + i))];
  const raw = (objectId: string, objectType: string, json: any, owner: any = { kind: 'SHARED', version: '1' }) =>
    ({ objectId, objectType, version: '10', owner, json: { id: objectId, ...json } });
  const ssu = raw(id(1), SSU_TYPE, { owner_cap_id: id(2), inventory_keys: keys, extension: SSU_AUTH,
    status: { status: { '@variant': 'ONLINE' } } });
  const partitions = keys.map(key => raw(idFieldId(id(1), key), `0x2::dynamic_field::Field<0x2::object::ID,${WORLD_PKG}::inventory::Inventory>`, {
    name: key, value: { used_capacity: '20', max_capacity: '100', items: { contents: [{ key: '7', value: { type_id: '7', item_id: '0', tenant: 'stillness', volume: '10', quantity: 2 } }] } },
  }, { kind: 'OBJECT', address: id(1) }));
  const map = new Map([ssu,...partitions].map(o => [o.objectId, o]));
  const batch = vi.fn(({ requests }) => {
    const final = ++reads >= 3;
    return { response: Promise.resolve({ objects: requests.map(({ objectId }: any) => {
      const raw = map.get(objectId);
      if (!raw) return { result: { oneofKind: 'error', error: { code: 5 } } };
      if (fail && objectId !== id(1)) return { result: { oneofKind: 'error', error: { code: 14 } } };
      const version = final && ((changed && objectId === id(1)) || (childChanged && objectId === partitions[0].objectId)) ? '11' : raw.version;
      return { result: { oneofKind: 'object', object: GrpcTypes.Object.fromJson({ ...raw, version }) } };
    }) }) };
  });
  const api = { ledgerService: { batchGetObjects: batch } } as unknown as StorageReadClient;
  return { api, batch, map, ssu, partitions };
}
it('reads more than 20 authoritative partitions completely', async () => {
  const f = setupReader({ slots: 25 }); const state = await fetchSsuSnapshot(id(1), f.api);
  expect(state.slots).toHaveLength(25); expect(state.frozen).toBe(false); expect(f.batch).toHaveBeenCalledTimes(3);
  expect(state.slots[0]).toMatchObject({ partition: 'owner_main', used: 20, items: [{ typeId: 7, quantity: 2 }] });
  expect(state.slots[1].partition).toBe('open');
});
it.each([{ changed: true }, { childChanged: true }])('rejects changing parent OR child snapshots %j', async options => {
  const f = setupReader(options); await expect(fetchSsuSnapshot(id(1), f.api)).rejects.toThrow(/changed during/);
});
it('never reports failed partition as empty', async () => {
  const f = setupReader({ fail: true }); await expect(fetchSsuSnapshot(id(1), f.api)).rejects.toThrow(/unavailable/);
});
it.each(['parent','type','key','itemKey','quantity','tenant','capacity','status','missing','duplicate'])('rejects malformed storage %s', async bad => {
  const f = setupReader(), p = f.partitions[0];
  if (bad === 'parent') p.owner.address = id(99);
  if (bad === 'type') p.objectType = `0x2::dynamic_field::Field<0x2::object::ID,u64>`;
  if (bad === 'key') p.json.name = id(99);
  if (bad === 'itemKey') p.json.value.items.contents[0].key = '8';
  if (bad === 'quantity') p.json.value.items.contents[0].value.quantity = 0x100000000;
  if (bad === 'tenant') p.json.value.items.contents[0].value.tenant = 'other';
  if (bad === 'capacity') p.json.value.used_capacity = '21';
  if (bad === 'status') f.ssu.json.status = {};
  if (bad === 'missing') f.map.delete(p.objectId);
  if (bad === 'duplicate') f.ssu.json.inventory_keys.push(id(2));
  await expect(fetchSsuSnapshot(id(1), f.api)).rejects.toThrow();
});
it('checks a present freeze marker type and parent', async () => {
  const f = setupReader(), keyType = `${WORLD_PKG}::extension_freeze::ExtensionFrozenKey`;
  const frozenId = deriveDynamicFieldID(id(1), keyType, new Uint8Array([0]));
  const marker = { objectId: frozenId, objectType: `0x2::dynamic_field::Field<${keyType},${WORLD_PKG}::extension_freeze::ExtensionFrozen>`, version: '10', owner: { kind: 'OBJECT', address: id(1) }, json: { id: frozenId, name: { dummy_field: false }, value: { dummy_field: false } } };
  f.map.set(frozenId, marker as any); expect((await fetchSsuSnapshot(id(1), f.api)).frozen).toBe(true);
  marker.owner.address = id(99); await expect(fetchSsuSnapshot(id(1), f.api)).rejects.toThrow();
});
it("rejects unsafe shared builders before appending any calls", () => {
  const tx = new Transaction();
  for (const f of [
    appendSharedDeposit,
    appendOwnerDepositToOpen,
    appendRecoverToShared,
  ])
    expect(() => f(tx, {} as any)).toThrow(/paused/);
  expect(() =>
    buildPromoteToSharedTx(id(1), id(2), id(3), 1, 1, id(4)),
  ).toThrow(/paused/);
  expect(tx.getData().commands).toHaveLength(0);
});
it("blocks unsafe sharing at the signer boundary, including serialized payloads", async () => {
  const send = vi.fn(),
    sign = vi.fn();
  const signer = new CurrentAccountSigner({
    signAndExecuteTransaction: send,
    signTransaction: sign,
  } as any);
  const tx = new Transaction();
  tx.moveCall({ target: `${SSU_ACCESS_PKG}::ssu_access::new_auth` });
  await expect(
    signer.signAndExecuteTransaction({ transaction: tx }),
  ).rejects.toThrow(/Unsafe SSU/);
  expect(() => assertCycleCompatible(tx.serialize())).toThrow(/Unsafe SSU/);
  const direct = new Transaction();
  direct.moveCall({
    target: `${WORLD_PKG}::storage_unit::authorize_extension`,
    typeArguments: [SSU_AUTH],
  });
  expect(() => assertCycleCompatible(direct)).toThrow(/Unsafe SSU/);
  expect(send).not.toHaveBeenCalled();
  expect(sign).not.toHaveBeenCalled();
});
it("preserves personal recovery without reopening shared access", () => {
  const tx = new Transaction();
  tx.moveCall({ target: `${SSU_ACCESS_PKG}::ssu_access::recover_to_owned` });
  expect(() => assertCycleCompatible(tx)).not.toThrow();
});
