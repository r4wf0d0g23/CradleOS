import { afterEach, expect, it, vi } from "vitest";
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
function setupReader({ changed = false, fail = false, slots = 2 } = {}) {
  let reads = 0;
  const keys = [
    id(2),
    openStorageKey(id(1)),
    ...Array.from({ length: Math.max(0, slots - 2) }, (_, i) => id(100 + i)),
  ];
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const { method, params } = JSON.parse(String(init.body));
    let result: any;
    if (method === "sui_getObject" && params[0] === id(1)) {
      result = {
        data: {
          objectId: id(1),
          version: String(10 + (changed && reads++ ? 1 : 0)),
          content: {
            type: SSU_TYPE,
            fields: {
              owner_cap_id: id(2),
              inventory_keys: keys,
              extension: { fields: { name: SSU_AUTH } },
              status: { fields: { status: { variant: "ONLINE" } } },
            },
          },
        },
      };
    } else if (method === "sui_getObject")
      result = { error: { code: "notExists" } };
    else if (fail)
      return new Response(
        JSON.stringify({ error: { message: "partition unavailable" } }),
      );
    else
      result = {
        data: {
          content: {
            fields: {
              name: params[1].value,
              value: {
                fields: {
                  used_capacity: "0",
                  max_capacity: "100",
                  items: { fields: { contents: [] } },
                },
              },
            },
          },
        },
      };
    return new Response(JSON.stringify({ result }));
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
it("reads more than 20 authoritative partitions completely", async () => {
  const fetcher = setupReader({ slots: 25 });
  const state = await fetchSsuSnapshot(id(1));
  expect(state.slots).toHaveLength(25);
  expect(state.frozen).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(28);
});
it("rejects mixed-version inventory snapshots", async () => {
  setupReader({ changed: true });
  await expect(fetchSsuSnapshot(id(1))).rejects.toThrow(/changed during/);
});
it("never reports a failed partition as empty", async () => {
  setupReader({ fail: true });
  await expect(fetchSsuSnapshot(id(1))).rejects.toThrow(
    /partition unavailable/,
  );
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
