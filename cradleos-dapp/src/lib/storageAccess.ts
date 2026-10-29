import { Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";
import { WORLD_PKG } from "../constants";
import {
  STORAGE_ACCESS_DEPLOYMENT,
  type StorageAccessDeployment,
} from "./storageAccessDeployment";
import {
  storageObject,
  storageObjects,
  storageFields,
  storageId,
  storageUint,
  storageRecord,
  assertStorageType,
  assertIdField,
  idFieldId,
  type StorageReadClient,
  storageClient,
} from "./storageRead";
import { SSU_TYPE, type SsuSnapshot } from "./ssuSafety";

export type StorageGrant = {
  characterId: string;
  expiresAt: number;
  canDeposit: boolean;
  canWithdraw: boolean;
};
export type StorageRules = {
  mode: 0 | 1 | 2 | 3 | 4;
  tribeIds: number[];
  deny: string[];
  allow: StorageGrant[];
};
export type StoragePolicy = {
  id: string;
  ssuId: string;
  revision: string;
  version: string;
  rules: StorageRules;
};
export const CLOSED_RULES: StorageRules = {
  mode: 0,
  tribeIds: [],
  deny: [],
  allow: [],
};
export const STORAGE_MODE_LABELS = [
  "Closed",
  "Tribes",
  "Pilots",
  "Tribes + pilots",
  "Public",
] as const;
export function storageDeployment(
  d = STORAGE_ACCESS_DEPLOYMENT,
): StorageAccessDeployment {
  if (!d) throw new Error("Sharing configuration unavailable.");
  if (storageId(d.worldId) !== storageId(WORLD_PKG))
    throw new Error("Storage deployment is from another world.");
  return {
    packageId: storageId(d.packageId),
    originalId: storageId(d.originalId),
    registryId: storageId(d.registryId),
    worldId: storageId(d.worldId),
  };
}
export function secureStorageExtension(
  extension: string | null,
  d = STORAGE_ACCESS_DEPLOYMENT,
): boolean {
  return (
    !!d &&
    !!extension &&
    normalizeStructTag(extension) ===
      normalizeStructTag(
        `${storageDeployment(d).originalId}::storage_access::SharedAccess`,
      )
  );
}
const unique = (xs: (number | string)[]) => {
  if (new Set(xs).size !== xs.length) throw new Error("Duplicate entry.");
};
export function validateStorageRules(input: StorageRules): StorageRules {
  if (![0, 1, 2, 3, 4].includes(input.mode))
    throw new Error("Choose an access mode.");
  if (
    input.tribeIds.length > 32 ||
    input.deny.length > 128 ||
    input.allow.length > 128
  )
    throw new Error("Limit: 32 tribes, 128 pilots per list.");
  const r: StorageRules = {
    mode: input.mode,
    tribeIds: input.tribeIds.map((n) => {
      if (!Number.isInteger(n) || n < 1 || n > 0xffffffff)
        throw new Error("Invalid tribe ID.");
      return n;
    }),
    deny: input.deny.map(storageId),
    allow: input.allow.map((e) => {
      if (
        !Number.isSafeInteger(e.expiresAt) ||
        e.expiresAt < 0 ||
        e.expiresAt > 253402214400000 ||
        typeof e.canDeposit !== "boolean" ||
        typeof e.canWithdraw !== "boolean"
      )
        throw new Error("Invalid pilot permission.");
      return { ...e, characterId: storageId(e.characterId) };
    }),
  };
  unique(r.tribeIds);
  unique(r.deny);
  unique(r.allow.map((e) => e.characterId));
  if (
    ((r.mode === 0 || r.mode === 4) &&
      (r.tribeIds.length || r.deny.length || r.allow.length)) ||
    (r.mode === 1 && (!r.tribeIds.length || r.deny.length || r.allow.length)) ||
    (r.mode === 2 && (r.tribeIds.length || r.deny.length)) ||
    (r.mode !== 3 && r.deny.length)
  )
    throw new Error("Invalid fields for access mode.");
  return r;
}
/** Matches Move: deny wins, listed pilot overrides tribe, expiry is exclusive. */
export function storagePermits(
  r: StorageRules,
  characterId: string,
  tribeId: number,
  withdraw: boolean,
  now = Date.now(),
): boolean {
  const rules = validateStorageRules(r),
    cid = storageId(characterId);
  if (rules.mode === 0) return false;
  if (rules.mode === 4) return true;
  if (rules.mode === 1) return rules.tribeIds.includes(tribeId);
  if (rules.deny.includes(cid)) return false;
  const entry = rules.allow.find((e) => e.characterId === cid);
  if (entry)
    return (
      (entry.expiresAt === 0 || now < entry.expiresAt) &&
      (withdraw ? entry.canWithdraw : entry.canDeposit)
    );
  return rules.mode === 3 && rules.tribeIds.includes(tribeId);
}
function u64(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    BigInt(value) > 0xffffffffffffffffn
  )
    throw new Error("Policy unavailable.");
  return value;
}
function decodePolicy(
  o: Awaited<ReturnType<typeof storageObject>>,
  ssuId: string,
  d: StorageAccessDeployment,
): StoragePolicy {
  assertStorageType(o, `${d.originalId}::storage_access::Policy`);
  const f = o.fields;
  if (
    o.owner.kind !== 3 ||
    storageId(f.ssu_id) !== storageId(ssuId) ||
    !Array.isArray(f.tribe_ids) ||
    !Array.isArray(f.deny) ||
    !Array.isArray(f.allow)
  )
    throw new Error("Policy unavailable.");
  return {
    id: o.id,
    ssuId: storageId(ssuId),
    version: o.version,
    revision: u64(f.revision),
    rules: validateStorageRules({
      mode: storageUint(f.mode) as StorageRules["mode"],
      tribeIds: f.tribe_ids.map(storageUint),
      deny: f.deny.map(storageId),
      allow: f.allow.map((v: unknown) => {
        const e = storageRecord(v);
        return {
          characterId: storageId(e.character_id),
          expiresAt: storageUint(e.expires_at),
          canDeposit: e.can_deposit,
          canWithdraw: e.can_withdraw,
        };
      }),
    }),
  };
}
async function policyTable(d: StorageAccessDeployment, api: StorageReadClient) {
  const registry = await storageObject(d.registryId, api);
  assertStorageType(registry, `${d.originalId}::storage_access::Registry`);
  if (registry.owner.kind !== 3)
    throw new Error("Policy registry unavailable.");
  return storageId(storageRecord(registry.fields.policies).id);
}
export async function readStoragePolicy(
  ssuId: string,
  deployment = STORAGE_ACCESS_DEPLOYMENT,
  api: StorageReadClient = storageClient,
): Promise<StoragePolicy | null> {
  const d = storageDeployment(deployment),
    table = await policyTable(d, api);
  const f = (await storageObjects([idFieldId(table, ssuId)], api))[0];
  if (!f) return null; // typed NOT_FOUND only; errors are not empty policies
  assertIdField(f, table, ssuId, "0x2::object::ID");
  return decodePolicy(
    await storageObject(storageId(f.fields.value), api),
    ssuId,
    d,
  );
}
export async function discoverStoragePolicies(
  characterId: string,
  tribeId: number,
  owned: Set<string>,
  deployment = STORAGE_ACCESS_DEPLOYMENT,
  api: StorageReadClient = storageClient,
): Promise<StoragePolicy[]> {
  const d = storageDeployment(deployment),
    table = await policyTable(d, api);
  const fields = await storageFields(table, "0x2::object::ID", api);
  const objects = await storageObjects(
    fields.map((f) => storageId(f.fields.value)),
    api,
  );
  return objects
    .map((o, i) => {
      if (!o) throw new Error("Shared storage unavailable.");
      return decodePolicy(o, storageId(fields[i].fields.name), d);
    })
    .filter(
      (p) =>
        !owned.has(p.ssuId) &&
        (storagePermits(p.rules, characterId, tribeId, false) ||
          storagePermits(p.rules, characterId, tribeId, true)),
    );
}
export function assertStoragePreview(state: SsuSnapshot) {
  if (
    normalizeStructTag(state.type) !== normalizeStructTag(SSU_TYPE) ||
    Date.now() - state.readAt > 30000 ||
    state.readAt > Date.now()
  )
    throw new Error("Storage preview expired. Refresh.");
}
export function storagePreviewKey(
  state: SsuSnapshot,
  policy: StoragePolicy | null,
) {
  return JSON.stringify([
    state.id,
    state.version,
    state.extension,
    state.frozen,
    state.ownerCapId,
    state.slots,
    policy,
  ]);
}
function ownerCap(
  tx: Transaction,
  state: SsuSnapshot,
  characterId: string,
  capId: string,
) {
  if (storageId(capId) !== storageId(state.ownerCapId))
    throw new Error("Storage ownership changed. Refresh.");
  return tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [SSU_TYPE],
    arguments: [tx.object(storageId(characterId)), tx.object(storageId(capId))],
  });
}
export function buildStorageConfiguration(
  state: SsuSnapshot,
  existing: StoragePolicy | null,
  rules: StorageRules,
  characterId: string,
  capId: string,
  wallet: string,
  replaceExtension: boolean,
  deployment = STORAGE_ACCESS_DEPLOYMENT,
): Transaction {
  const d = storageDeployment(deployment),
    r = validateStorageRules(rules);
  assertStoragePreview(state);
  if (existing && storageId(existing.ssuId) !== storageId(state.id))
    throw new Error("Wrong storage policy.");
  if (!secureStorageExtension(state.extension, d) && !replaceExtension)
    throw new Error("Review extension replacement.");
  if (state.frozen && replaceExtension)
    throw new Error("Extension is permanently frozen.");
  const tx = new Transaction();
  tx.setSender(storageId(wallet));
  const [cap, receipt] = ownerCap(tx, state, characterId, capId);
  const policy = existing
    ? tx.object(existing.id)
    : tx.moveCall({
        target: `${d.packageId}::storage_access::create_policy`,
        arguments: [tx.object(d.registryId), tx.object(state.id), cap],
      })[0];
  tx.moveCall({
    target: `${d.packageId}::storage_access::configure`,
    arguments: [
      policy,
      cap,
      tx.pure.u64(existing?.revision ?? "0"),
      tx.pure.u8(r.mode),
      tx.pure.vector("u32", r.tribeIds),
      tx.pure.vector("address", r.deny),
      tx.pure.vector(
        "address",
        r.allow.map((e) => e.characterId),
      ),
      tx.pure.vector(
        "u64",
        r.allow.map((e) => e.expiresAt),
      ),
      tx.pure.vector(
        "bool",
        r.allow.map((e) => e.canDeposit),
      ),
      tx.pure.vector(
        "bool",
        r.allow.map((e) => e.canWithdraw),
      ),
    ],
  });
  if (replaceExtension)
    tx.moveCall({
      target: `${d.packageId}::storage_access::authorize`,
      arguments: [policy, tx.object(state.id), cap],
    });
  if (!existing)
    tx.moveCall({
      target: `${d.packageId}::storage_access::share_policy`,
      arguments: [policy],
    });
  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [SSU_TYPE],
    arguments: [tx.object(storageId(characterId)), cap, receipt],
  });
  return tx;
}
export function buildStorageTransfer(
  state: SsuSnapshot,
  policy: StoragePolicy,
  characterId: string,
  wallet: string,
  direction: "deposit" | "withdraw" | "recover",
  rows: { typeId: number; quantity: number }[],
  capId?: string,
  deployment = STORAGE_ACCESS_DEPLOYMENT,
): Transaction {
  const d = storageDeployment(deployment);
  assertStoragePreview(state);
  if (!secureStorageExtension(state.extension, d) || policy.ssuId !== state.id)
    throw new Error("Sharing binding changed. Refresh.");
  if (!state.online) throw new Error("Storage offline.");
  if (!rows.length || rows.length > 100)
    throw new Error("Choose 1–100 stacks.");
  unique(rows.map((r) => r.typeId));
  const tx = new Transaction();
  tx.setSender(storageId(wallet));
  let cap: ReturnType<Transaction["moveCall"]>[number] | undefined,
    receipt: ReturnType<Transaction["moveCall"]>[number] | undefined;
  const capType =
    direction === "recover" ? SSU_TYPE : `${WORLD_PKG}::character::Character`;
  if (direction !== "withdraw") {
    if (!capId) throw new Error("Owner capability unavailable.");
    if (direction === "recover")
      [cap, receipt] = ownerCap(tx, state, characterId, capId);
    else
      [cap, receipt] = tx.moveCall({
        target: `${WORLD_PKG}::character::borrow_owner_cap`,
        typeArguments: [capType],
        arguments: [
          tx.object(storageId(characterId)),
          tx.object(storageId(capId)),
        ],
      });
  }
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.typeId) ||
      row.typeId <= 0 ||
      !Number.isInteger(row.quantity) ||
      row.quantity <= 0 ||
      row.quantity > 0xffffffff
    )
      throw new Error("Invalid transfer quantity.");
    const slot = state.slots.find((s) =>
      direction === "deposit"
        ? s.key === storageId(capId!)
        : s.partition === "open",
    );
    if (
      !slot ||
      (slot.items.find((i) => i.typeId === row.typeId)?.quantity ?? 0) <
        row.quantity
    )
      throw new Error("Stock changed. Refresh.");
    const args =
      direction === "recover"
        ? [tx.object(state.id), cap!, tx.object(storageId(characterId))]
        : [
            tx.object(state.id),
            tx.object(policy.id),
            tx.object(storageId(characterId)),
            ...(direction === "deposit" ? [cap!] : []),
          ];
    tx.moveCall({
      target: `${d.packageId}::storage_access::${direction === "recover" ? "recover_shared" : direction}`,
      arguments: [
        ...args,
        tx.pure.u64(row.typeId),
        tx.pure.u32(row.quantity),
        ...(direction === "recover" ? [] : [tx.object("0x6")]),
      ],
    });
  }
  if (cap && receipt)
    tx.moveCall({
      target: `${WORLD_PKG}::character::return_owner_cap`,
      typeArguments: [capType],
      arguments: [tx.object(storageId(characterId)), cap, receipt],
    });
  return tx;
}
