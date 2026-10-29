import { describe, expect, it, vi } from "vitest";
import { GrpcTypes } from "@mysten/sui/grpc";
import { WORLD_PKG } from "../constants";
import { STORAGE_ACCESS_DEPLOYMENT } from "./storageAccessDeployment";
import {
  SSU_AUTH,
  SSU_TYPE,
  openStorageKey,
  type SsuSnapshot,
} from "./ssuSafety";
import { assertCycleCompatible } from "./transactionCompatibility";
import {
  buildStorageConfiguration,
  buildStorageTransfer,
  CLOSED_RULES,
  discoverStoragePolicies,
  readStoragePolicy,
  secureStorageExtension,
  storagePermits,
  storagePreviewKey,
  validateStorageRules,
  type StoragePolicy,
  type StorageRules,
} from "./storageAccess";
import { idFieldId, type StorageReadClient } from "./storageRead";

const id = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const d = {
  packageId: id(99),
  originalId: id(99),
  registryId: id(98),
  worldId: WORLD_PKG,
};
const auth = `${d.originalId}::storage_access::SharedAccess`;
const publicRules: StorageRules = { ...CLOSED_RULES, mode: 4 };
const policy: StoragePolicy = {
  id: id(6),
  ssuId: id(1),
  revision: "7",
  version: "88",
  rules: publicRules,
};
const item = (key: string, partition: "open" | "unknown", quantity = 10) => ({
  typeId: 42,
  quantity,
  volume: 10,
  itemId: "7",
  partition,
  partitionKey: key,
});
const snapshot = (): SsuSnapshot => ({
  id: id(1),
  type: SSU_TYPE,
  version: "7",
  ownerCapId: id(2),
  frozen: false,
  online: true,
  readAt: Date.now(),
  extension: auth,
  slots: [
    {
      key: openStorageKey(id(1)),
      partition: "open",
      used: 100,
      max: 10000,
      items: [item(openStorageKey(id(1)), "open")],
    },
    {
      key: id(5),
      partition: "unknown",
      used: 100,
      max: 10000,
      items: [item(id(5), "unknown")],
    },
  ],
});
const create = (
  state = snapshot(),
  p: StoragePolicy | null = policy,
  replace = false,
  rules = publicRules,
) =>
  buildStorageConfiguration(state, p, rules, id(3), id(2), id(4), replace, d);
const transfer = (
  direction: "withdraw" | "deposit" | "recover",
  state = snapshot(),
  rows = [{ typeId: 42, quantity: 4 }],
  cap?: string,
) => buildStorageTransfer(state, policy, id(3), id(4), direction, rows, cap, d);
describe("enforced storage access semantics", () => {
  it("gives deny precedence and never falls back from a listed pilot to tribe", () => {
    const r: StorageRules = {
      mode: 3,
      tribeIds: [100],
      deny: [],
      allow: [
        {
          characterId: id(1),
          expiresAt: 1000,
          canDeposit: true,
          canWithdraw: false,
        },
      ],
    };
    expect(storagePermits(r, id(1), 100, false, 999)).toBe(true);
    expect(storagePermits(r, id(1), 100, true, 999)).toBe(false);
    expect(storagePermits(r, id(1), 100, false, 1000)).toBe(false);
    expect(storagePermits(r, id(2), 100, true, 1001)).toBe(true);
    expect(storagePermits({ ...r, deny: [id(1)] }, id(1), 100, false, 0)).toBe(
      false,
    );
  });
  it.each([0, 1, 2, 3, 4] as const)(
    "mode %s has explicit membership semantics",
    (mode) => {
      const r: StorageRules = {
        mode,
        tribeIds: mode === 1 || mode === 3 ? [100] : [],
        deny: [],
        allow:
          mode === 2
            ? [
                {
                  characterId: id(1),
                  expiresAt: 0,
                  canDeposit: true,
                  canWithdraw: true,
                },
              ]
            : [],
      };
      expect(storagePermits(r, id(1), 100, true, 0)).toBe(mode !== 0);
      expect(storagePermits(r, id(2), 200, true, 0)).toBe(mode === 4);
    },
  );
  it.each([
    { ...CLOSED_RULES, mode: 5 },
    { ...CLOSED_RULES, mode: 1, tribeIds: [0] },
    { ...CLOSED_RULES, mode: 1, tribeIds: [1, 1] },
    {
      ...CLOSED_RULES,
      mode: 1,
      tribeIds: Array.from({ length: 33 }, (_, i) => i + 1),
    },
    { ...publicRules, deny: [id(1)] },
    { ...CLOSED_RULES, mode: 3, deny: ["0x1", id(1)] },
    {
      ...CLOSED_RULES,
      mode: 2,
      allow: [
        {
          characterId: id(1),
          expiresAt: -1,
          canDeposit: true,
          canWithdraw: true,
        },
      ],
    },
    {
      ...CLOSED_RULES,
      mode: 2,
      allow: [
        {
          characterId: id(1),
          expiresAt: 253402214400001,
          canDeposit: true,
          canWithdraw: true,
        },
      ],
    },
    {
      ...CLOSED_RULES,
      mode: 2,
      allow: Array.from({ length: 129 }, (_, i) => ({
        characterId: id(i + 1),
        expiresAt: 0,
        canDeposit: true,
        canWithdraw: true,
      })),
    },
  ])("rejects malformed or ambiguous policy %#", (r) =>
    expect(() => validateStorageRules(r as StorageRules)).toThrow(),
  );
});
describe("owner PTB and transfer boundaries", () => {
  it("creates, configures, authorizes and shares in one cap-borrow transaction; no assets move", () => {
    const tx = create({ ...snapshot(), extension: null }, null, true),
      calls = tx.getData().commands.map((c) => c.MoveCall!);
    expect(calls.map((c) => c.function)).toEqual([
      "borrow_owner_cap",
      "create_policy",
      "configure",
      "authorize",
      "share_policy",
      "return_owner_cap",
    ]);
    expect(calls[0].typeArguments).toEqual([SSU_TYPE]);
    expect(calls[1].package).toBe(d.packageId);
    expect(tx.getData().sender).toBe(id(4));
    expect(JSON.stringify(tx.getData())).not.toMatch(
      /new_auth|ssu_access|withdraw|deposit|TransferObjects/,
    );
    // Unpublished pins are not added to the common signer by merely constructing a PTB.
    expect(() => assertCycleCompatible(tx)).toThrow(
      /not in the current deployment/,
    );
  });
  it("accepts the activated package while still rejecting the legacy authorization witness", () => {
    expect(STORAGE_ACCESS_DEPLOYMENT?.worldId).toBe(WORLD_PKG);
    const tx = buildStorageConfiguration(
      { ...snapshot(), extension: null },
      null,
      CLOSED_RULES,
      id(3),
      id(2),
      id(4),
      true,
    );
    expect(() => assertCycleCompatible(tx)).not.toThrow();
    expect(tx.getData().commands[1].MoveCall?.package).toBe(
      STORAGE_ACCESS_DEPLOYMENT?.packageId,
    );
    tx.moveCall({
      target: `${WORLD_PKG}::storage_unit::authorize_extension`,
      typeArguments: [SSU_AUTH],
      arguments: [],
    });
    expect(() => assertCycleCompatible(tx)).toThrow(/Unsafe SSU sharing/);
  });
  it("updates using the expected revision without silently replacing an extension", () => {
    const tx = create();
    expect(tx.getData().commands.map((c) => c.MoveCall?.function)).toEqual([
      "borrow_owner_cap",
      "configure",
      "return_owner_cap",
    ]);
    expect(() => create({ ...snapshot(), extension: SSU_AUTH })).toThrow(
      /replacement/,
    );
    expect(() =>
      create({ ...snapshot(), extension: SSU_AUTH }, policy, true),
    ).not.toThrow();
  });
  it("keeps legacy auth quarantined and never mistakes it for the replacement", () => {
    expect(secureStorageExtension(SSU_AUTH, d)).toBe(false);
    expect(secureStorageExtension(auth, d)).toBe(true);
    expect(() =>
      buildStorageConfiguration(
        snapshot(),
        policy,
        publicRules,
        id(3),
        id(2),
        id(4),
        false,
        null,
      ),
    ).toThrow(/unavailable/);
  });
  it.each([
    { readAt: 1 },
    { readAt: Date.now() + 600000 },
    { ownerCapId: id(9) },
    { type: `${id(9)}::storage_unit::StorageUnit` },
  ])("rejects stale/unbound owner preview %#", (patch) =>
    expect(() => create({ ...snapshot(), ...patch })).toThrow(),
  );
  it("frozen secure binding permits rule update but no rebinding", () => {
    expect(() => create({ ...snapshot(), frozen: true })).not.toThrow();
    expect(() => create({ ...snapshot(), frozen: true }, policy, true)).toThrow(
      /frozen/,
    );
  });
  it("rejects foreign SSU policy and world pins", () => {
    expect(() => create(snapshot(), { ...policy, ssuId: id(8) })).toThrow(
      /Wrong storage/,
    );
    expect(() =>
      buildStorageConfiguration(
        snapshot(),
        policy,
        publicRules,
        id(3),
        id(2),
        id(4),
        false,
        { ...d, worldId: id(9) },
      ),
    ).toThrow(/another world/);
  });
  it.each(["withdraw", "deposit", "recover"] as const)(
    "%s uses only the narrow wrapper and exact capability type",
    (direction) => {
      const tx = transfer(
        direction,
        snapshot(),
        undefined,
        direction === "recover" ? id(2) : id(5),
      );
      const calls = tx.getData().commands.map((c) => c.MoveCall!);
      expect(calls.map((c) => c.function)).toEqual(
        direction === "withdraw"
          ? ["withdraw"]
          : [
              "borrow_owner_cap",
              direction === "recover" ? "recover_shared" : "deposit",
              "return_owner_cap",
            ],
      );
      if (direction !== "withdraw")
        expect(calls[0].typeArguments).toEqual([
          direction === "recover"
            ? SSU_TYPE
            : `${WORLD_PKG}::character::Character`,
        ]);
      expect(JSON.stringify(tx.getData())).not.toMatch(
        /withdraw_item|deposit_item|new_auth|TransferObjects/,
      );
    },
  );
  it.each([0, -1, 11, 1.5, 0x100000000])(
    "rejects invalid quantity %s",
    (quantity) =>
      expect(() =>
        transfer("withdraw", snapshot(), [{ typeId: 42, quantity }]),
      ).toThrow(),
  );
  it("cannot use another personal partition, duplicate stacks, legacy auth or offline state", () => {
    expect(() => transfer("deposit", snapshot(), undefined, id(8))).toThrow(
      /Stock changed/,
    );
    expect(() =>
      transfer("withdraw", snapshot(), [
        { typeId: 42, quantity: 1 },
        { typeId: 42, quantity: 1 },
      ]),
    ).toThrow(/Duplicate/);
    expect(() =>
      transfer("withdraw", { ...snapshot(), extension: SSU_AUTH }),
    ).toThrow(/binding/);
    expect(() =>
      transfer("withdraw", { ...snapshot(), online: false }),
    ).toThrow(/offline/);
  });
  it("review identity changes for policy revision and shared arrivals, not just timestamps", () => {
    const s = snapshot();
    expect(storagePreviewKey(s, policy)).toBe(
      storagePreviewKey({ ...s, readAt: s.readAt + 1 }, policy),
    );
    expect(storagePreviewKey(s, policy)).not.toBe(
      storagePreviewKey(s, { ...policy, revision: "8" }),
    );
    expect(storagePreviewKey(s, policy)).not.toBe(
      storagePreviewKey({ ...s, slots: [] }, policy),
    );
  });
});
function readFixture() {
  const table = id(97),
    field = idFieldId(table, id(1));
  const records = new Map<string, any>([
    [
      d.registryId,
      {
        objectId: d.registryId,
        objectType: `${d.originalId}::storage_access::Registry`,
        version: "10",
        owner: { kind: "SHARED", version: "1" },
        json: { id: d.registryId, policies: { id: table, size: "1" } },
      },
    ],
    [
      field,
      {
        objectId: field,
        objectType:
          "0x2::dynamic_field::Field<0x2::object::ID,0x2::object::ID>",
        version: "10",
        owner: { kind: "OBJECT", address: table },
        json: { id: field, name: id(1), value: policy.id },
      },
    ],
    [
      policy.id,
      {
        objectId: policy.id,
        objectType: `${d.originalId}::storage_access::Policy`,
        version: "88",
        owner: { kind: "SHARED", version: "1" },
        json: {
          id: policy.id,
          ssu_id: id(1),
          revision: "7",
          mode: 4,
          tribe_ids: [],
          deny: [],
          allow: [],
        },
      },
    ],
  ]);
  const batch = vi.fn(({ requests }) => ({
    response: Promise.resolve({
      objects: requests.map(({ objectId }: any) =>
        records.has(objectId)
          ? {
              result: {
                oneofKind: "object",
                object: GrpcTypes.Object.fromJson(records.get(objectId)),
              },
            }
          : {
              result: {
                oneofKind: "error",
                error: { code: 5, message: "not found" },
              },
            },
      ),
    }),
  }));
  const fields = vi.fn(() => ({
    response: Promise.resolve({
      dynamicFields: [
        {
          fieldId: field,
          parent: table,
          fieldObject: GrpcTypes.Object.fromJson(records.get(field)),
        },
      ],
      nextPageToken: new Uint8Array(),
    }),
  }));
  return {
    records,
    field,
    api: {
      ledgerService: { batchGetObjects: batch },
      stateService: { listDynamicFields: fields },
    } as unknown as StorageReadClient,
    batch,
  };
}
describe("canonical supported policy reads", () => {
  it("loads exact registry→SSU→policy binding", async () => {
    const f = readFixture();
    expect(await readStoragePolicy(id(1), d, f.api)).toEqual(policy);
  });
  it("only typed missing mapping means no policy", async () => {
    const f = readFixture();
    f.records.delete(f.field);
    expect(await readStoragePolicy(id(1), d, f.api)).toBeNull();
    f.batch.mockImplementation(() => ({
      response: Promise.reject(new Error("transport")),
    }));
    await expect(readStoragePolicy(id(1), d, f.api)).rejects.toThrow(
      "transport",
    );
  });
  it.each(["policy", "registry", "mapping", "owner", "revision"])(
    "rejects mismatched %s",
    async (kind) => {
      const f = readFixture();
      if (kind === "policy") f.records.get(policy.id).json.ssu_id = id(8);
      if (kind === "registry")
        f.records.get(d.registryId).objectType =
          `${id(8)}::storage_access::Registry`;
      if (kind === "mapping") f.records.get(f.field).json.name = id(8);
      if (kind === "owner")
        f.records.get(policy.id).owner = { kind: "ADDRESS", address: id(4) };
      if (kind === "revision") f.records.get(policy.id).json.revision = "-1";
      await expect(readStoragePolicy(id(1), d, f.api)).rejects.toThrow();
    },
  );
  it("discovers eligible non-owned units without conflating absence and failure", async () => {
    const f = readFixture();
    expect(
      await discoverStoragePolicies(id(3), 100, new Set(), d, f.api),
    ).toEqual([policy]);
    expect(
      await discoverStoragePolicies(id(3), 100, new Set([id(1)]), d, f.api),
    ).toEqual([]);
    f.records.delete(policy.id);
    await expect(
      discoverStoragePolicies(id(3), 100, new Set(), d, f.api),
    ).rejects.toThrow();
  });
});

describe("owner-main sharing upgrade boundary", () => {
  const ownerState = () => {
    const s = snapshot();
    s.slots.push({
      key: id(2),
      partition: "owner_main",
      used: 100,
      max: 10000,
      items: [{ ...item(id(2), "unknown"), partition: "owner_main" }],
    });
    return s;
  };
  it("uses the SSU cap and only owner-main stock, retaining original type identity", () => {
    const next = { ...d, packageId: id(100) };
    const tx = buildStorageTransfer(
      ownerState(),
      policy,
      id(3),
      id(4),
      "owner_deposit",
      [{ typeId: 42, quantity: 3 }],
      id(2),
      next,
    );
    const calls = tx.getData().commands.map((c) => c.MoveCall!);
    expect(calls.map((c) => c.function)).toEqual([
      "borrow_owner_cap",
      "deposit_owner",
      "return_owner_cap",
    ]);
    expect(calls[0].typeArguments).toEqual([SSU_TYPE]);
    expect(calls[1].package).toBe(next.packageId);
    expect(calls[1].arguments).toHaveLength(7);
    expect(secureStorageExtension(auth, next)).toBe(true);
    expect(
      secureStorageExtension(
        `${next.packageId}::storage_access::SharedAccess`,
        next,
      ),
    ).toBe(false);
    expect(JSON.stringify(tx.getData())).not.toMatch(
      /authorize_extension|TransferObjects|create_policy/,
    );
  });
  it("rejects missing/wrong owner capabilities and source substitution", () => {
    const build = (s = ownerState(), cap: string | undefined = id(2)) =>
      buildStorageTransfer(
        s,
        policy,
        id(3),
        id(4),
        "owner_deposit",
        [{ typeId: 42, quantity: 3 }],
        cap,
        d,
      );
    expect(() => build(ownerState(), id(5))).toThrow(/ownership changed/);
    expect(() =>
      buildStorageTransfer(
        ownerState(),
        policy,
        id(3),
        id(4),
        "owner_deposit",
        [{ typeId: 42, quantity: 3 }],
        undefined,
        d,
      ),
    ).toThrow(/capability/);
    expect(() => build(snapshot())).toThrow(/Stock changed/);
    const s = ownerState();
    s.slots.find((v) => v.partition === "owner_main")!.items[0].quantity = 2;
    expect(() => build(s)).toThrow(/Stock changed/);
  });
});
