import { Transaction } from "@mysten/sui/transactions";
import {
  deriveDynamicFieldID,
  normalizeStructTag,
  normalizeSuiAddress,
} from "@mysten/sui/utils";
import { blake2b } from "@noble/hashes/blake2.js";
import { SSU_ACCESS_ORIGINAL, WORLD_PKG } from "../constants";

import { storageObject, storageObjects, storageClient, storageRecord, assertStorageType, assertStorageOwner, assertIdField, idFieldId, type StorageReadClient } from './storageRead';

export const SSU_SHARING_PAUSED = true;
export const SSU_SHARING_PAUSE_REASON =
  "Shared transfers are paused: the current extension does not enforce its access rules. The owner must disable it on-chain.";
export const SSU_AUTH = `${SSU_ACCESS_ORIGINAL}::ssu_access::SsuAuth`;
export const SSU_TYPE = `${WORLD_PKG}::storage_unit::StorageUnit`;
export type StoragePartition = "open" | "owner_main" | "unknown";
export type StorageItem = {
  typeId: number;
  quantity: number;
  volume: number;
  itemId: string;
  partition: StoragePartition;
  partitionKey: string;
};
export type StorageSlot = {
  key: string;
  partition: StoragePartition;
  used: number;
  max: number;
  items: StorageItem[];
};
export type SsuSnapshot = {
  id: string;
  type: string;
  version: string;
  ownerCapId: string;
  extension: string | null;
  frozen: boolean;
  online: boolean;
  slots: StorageSlot[];
  readAt: number;
};

function id(value: string): string {
  if (!/^0x[\da-f]{1,64}$/i.test(value))
    throw new Error("Invalid current-world object ID.");
  return normalizeSuiAddress(value);
}
function natural(
  value: unknown,
  label: string,
  limit = Number.MAX_SAFE_INTEGER,
): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^\d+$/.test(String(value))
  )
    throw new Error(`Incomplete ${label}. Retry the chain read.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > limit)
    throw new Error(`Invalid ${label}.`);
  return n;
}
export function openStorageKey(ssuId: string): string {
  const bytes = Uint8Array.from(id(ssuId).slice(2).match(/../g)!, (h) =>
    parseInt(h, 16),
  );
  const suffix = new TextEncoder().encode("open_inventory");
  const input = new Uint8Array(bytes.length + suffix.length);
  input.set(bytes);
  input.set(suffix, bytes.length);
  return (
    "0x" +
    Array.from(blake2b(input, { dkLen: 32 }), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}
export function decodeSsuExtension(value: any): string | null {
  if (value === null) return null;
  if (
    Array.isArray(value) ||
    (value && typeof value === "object" && "vec" in value)
  ) {
    const vec = Array.isArray(value) ? value : value.vec;
    if (!Array.isArray(vec) || vec.length > 1)
      throw new Error("Invalid extension data.");
    if (!vec.length) return null;
    value = vec[0];
  }
  const text =
    typeof value === "string" ? value : (value?.fields?.name ?? value?.name);
  if (
    typeof text !== "string" ||
    !/^(?:0x)?[\da-f]{1,64}::[A-Za-z_][\w]*::[A-Za-z_][\w]*$/.test(text)
  )
    throw new Error("Extension data is unavailable. Refresh to retry.");
  return normalizeStructTag(text.startsWith("0x") ? text : `0x${text}`);
}
export function isUnsafeSsuExtension(extension: string | null): boolean {
  return (
    extension !== null &&
    normalizeStructTag(extension) === normalizeStructTag(SSU_AUTH)
  );
}
/** Read every authoritative partition and verify all versions again before display. */
export async function fetchSsuSnapshot(ssuId: string, api: StorageReadClient = storageClient): Promise<SsuSnapshot> {
  const readAt = Date.now();
  const ssu = await storageObject(ssuId, api);
  assertStorageType(ssu, SSU_TYPE);
  if (ssu.owner.kind !== 3) throw new Error("Not a shared current-world storage unit.");
  const f = ssu.fields, ownerCapId = id(f.owner_cap_id);
  if (!Array.isArray(f.inventory_keys) || f.inventory_keys.length > 200)
    throw new Error("Storage partitions unavailable. Retry.");
  const keys: string[] = f.inventory_keys.map(id);
  const openKey = openStorageKey(ssuId);
  if (new Set(keys).size !== keys.length || !keys.includes(ownerCapId) || !keys.includes(openKey))
    throw new Error("Storage partitions unavailable. Retry.");
  const frozenKeyType = `${WORLD_PKG}::extension_freeze::ExtensionFrozenKey`;
  const frozenId = deriveDynamicFieldID(id(ssuId), frozenKeyType, new Uint8Array([0]));
  const partIds = keys.map(key => idFieldId(ssuId, key));
  const objects = await storageObjects([...partIds, frozenId], api);
  const frozen = objects[objects.length - 1];
  if (frozen) {
    assertStorageType(frozen, `0x2::dynamic_field::Field<${frozenKeyType},${WORLD_PKG}::extension_freeze::ExtensionFrozen>`);
    assertStorageOwner(frozen, ssuId, true);
    // Live compiled empty Move structs contain the synthetic false bool.
    if (storageRecord(frozen.fields.name).dummy_field !== false || storageRecord(frozen.fields.value).dummy_field !== false)
      throw new Error("Storage freeze status unavailable.");
  }
  const slots: StorageSlot[] = keys.map((key, i) => {
    const field = objects[i];
    if (!field) throw new Error("Storage partition unavailable. Retry.");
    assertIdField(field, ssuId, key, `${WORLD_PKG}::inventory::Inventory`);
    const v = storageRecord(field.fields.value), entries = storageRecord(v.items).contents;
    if (!Array.isArray(entries)) throw new Error("Inventory items unavailable. Retry.");
    const partition: StoragePartition = key === openKey ? "open" : key === ownerCapId ? "owner_main" : "unknown";
    const items: StorageItem[] = entries.map((entry: any) => {
      const item = storageRecord(entry?.value);
      const typeId = natural(item.type_id, "item type");
      if (natural(entry.key, "item key") !== typeId || item.tenant !== "stillness" ||
          typeof item.item_id !== "string" || !/^\d+$/.test(item.item_id) || BigInt(item.item_id) > 0xffffffffffffffffn)
        throw new Error("Inventory item unavailable. Retry.");
      return { typeId, quantity: natural(item.quantity, "item quantity", 0xffffffff),
        volume: natural(item.volume, "item volume"), itemId: item.item_id, partition, partitionKey: key };
    });
    if (new Set(items.map(i => i.typeId)).size !== items.length) throw new Error("Duplicate inventory item.");
    const used = natural(v.used_capacity, "used capacity"), max = natural(v.max_capacity, "capacity");
    const volume = items.reduce((sum, item) => sum + BigInt(item.volume) * BigInt(item.quantity), 0n);
    if (used > max || volume !== BigInt(used)) throw new Error("Storage capacity unavailable. Retry.");
    return { key, partition, items, used, max };
  });
  const status = f.status?.status?.["@variant"];
  if (status !== "ONLINE" && status !== "OFFLINE") throw new Error("Storage status unavailable.");
  const after = await storageObjects([ssu.id, ...partIds, frozenId], api);
  const before = [ssu, ...objects];
  if (after.some((o, i) => o?.version !== before[i]?.version))
    throw new Error("Storage changed during the read. Retry.");
  return { id: ssu.id, type: ssu.type, version: ssu.version, ownerCapId,
    extension: decodeSsuExtension(f.extension), frozen: !!frozen, online: status === "ONLINE", slots, readAt };
}

export function assertSharedSsuOperationsEnabled(): void {
  if (SSU_SHARING_PAUSED) throw new Error(SSU_SHARING_PAUSE_REASON);
}

/** Revocation only: no asset movement, replacement, or policy mutation. */
export function buildDisableSsuSharingTx(
  state: SsuSnapshot,
  characterId: string,
  ownerCapId: string,
  wallet: string,
): Transaction {
  if (
    id(ownerCapId) !== state.ownerCapId ||
    normalizeStructTag(state.type) !== normalizeStructTag(SSU_TYPE)
  )
    throw new Error("Storage ownership changed. Refresh before continuing.");
  if (!isUnsafeSsuExtension(state.extension))
    throw new Error(
      "This is not the affected CradleOS extension. Refresh and review the current binding.",
    );
  if (state.frozen)
    throw new Error(
      "This extension is permanently frozen. It cannot be disabled here.",
    );
  if (Date.now() - state.readAt > 30000 || state.readAt > Date.now())
    throw new Error("Storage preview expired. Refresh before continuing.");
  const tx = new Transaction();
  tx.setSender(id(wallet));
  const [cap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [state.type],
    arguments: [tx.object(id(characterId)), tx.object(id(ownerCapId))],
  });
  tx.moveCall({
    target: `${WORLD_PKG}::storage_unit::revoke_extension_authorization`,
    arguments: [tx.object(state.id), cap],
  });
  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [state.type],
    arguments: [tx.object(id(characterId)), cap, receipt],
  });
  return tx;
}
