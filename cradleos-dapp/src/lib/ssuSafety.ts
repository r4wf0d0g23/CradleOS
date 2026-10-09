import { Transaction } from "@mysten/sui/transactions";
import {
  deriveDynamicFieldID,
  normalizeStructTag,
  normalizeSuiAddress,
} from "@mysten/sui/utils";
import { blake2b } from "@noble/hashes/blake2.js";
import { SSU_ACCESS_ORIGINAL, SUI_TESTNET_RPC, WORLD_PKG } from "../constants";

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
async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(`${SUI_TESTNET_RPC}?nocache=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error(
      `Storage data unavailable (HTTP ${r.status}). Retry; this is not an empty inventory.`,
    );
  const j = await r.json();
  if (j.error || !j.result)
    throw new Error(j.error?.message ?? "Incomplete storage response.");
  return j.result;
}
async function object(objectId: string, allowMissing = false): Promise<any> {
  const r = await rpc("sui_getObject", [
    id(objectId),
    { showContent: true, showType: true },
  ]);
  if (allowMissing && r.error?.code === "notExists") return null;
  if (r.error || !r.data?.content?.fields)
    throw new Error("Storage object could not be verified. Refresh to retry.");
  return r.data;
}

/** Read the SSU's authoritative inventory_keys, not a truncated dynamic-field page. */
export async function fetchSsuSnapshot(ssuId: string): Promise<SsuSnapshot> {
  const readAt = Date.now();
  const ssu = await object(ssuId);
  if (
    normalizeStructTag(ssu.content.type) !== normalizeStructTag(SSU_TYPE) ||
    id(ssu.objectId) !== id(ssuId)
  )
    throw new Error("Not a current-world storage unit.");
  const f = ssu.content.fields;
  const ownerCapId = id(f.owner_cap_id);
  if (!Array.isArray(f.inventory_keys) || f.inventory_keys.length > 200)
    throw new Error(
      "Storage partitions are incomplete or exceed the safe read limit.",
    );
  const keys: string[] = f.inventory_keys.map(id);
  if (new Set(keys).size !== keys.length)
    throw new Error("Duplicate storage partition keys.");
  const openKey = openStorageKey(ssuId);
  const frozenId = deriveDynamicFieldID(
    id(ssuId),
    `${WORLD_PKG}::extension_freeze::ExtensionFrozenKey`,
    new Uint8Array([0]),
  );
  const frozen = await object(frozenId, true);
  const slots: StorageSlot[] = [];
  for (const key of keys) {
    const r = await rpc("suix_getDynamicFieldObject", [
      id(ssuId),
      { type: "0x2::object::ID", value: key },
    ]);
    const field = r.data?.content?.fields;
    const v = field?.value?.fields;
    if (
      r.error ||
      !v ||
      id(field.name) !== key ||
      !Array.isArray(v.items?.fields?.contents)
    )
      throw new Error(
        "An inventory partition could not be verified. No partial inventory will be shown.",
      );
    const partition: StoragePartition =
      key === openKey ? "open" : key === ownerCapId ? "owner_main" : "unknown";
    const items: StorageItem[] = v.items.fields.contents.map((entry: any) => {
      const item = entry?.fields?.value?.fields;
      if (!item) throw new Error("Incomplete inventory item.");
      return {
        typeId: natural(item.type_id, "item type"),
        quantity: natural(item.quantity, "item quantity", 0xffffffff),
        volume: natural(item.volume, "item volume"),
        itemId: String(item.item_id ?? ""),
        partition,
        partitionKey: key,
      };
    });
    if (new Set(items.map((i) => i.typeId)).size !== items.length)
      throw new Error("Duplicate item types in an inventory partition.");
    slots.push({
      key,
      partition,
      items,
      used: natural(v.used_capacity, "used capacity"),
      max: natural(v.max_capacity, "capacity"),
    });
  }
  const status = f.status?.fields?.status?.variant;
  if (typeof status !== "string" || !ssu.version)
    throw new Error("Storage status is unavailable.");
  const after = await object(ssuId);
  if (String(after.version) !== String(ssu.version))
    throw new Error(
      "Storage changed during the read. Refresh to get a consistent snapshot.",
    );
  return {
    id: id(ssuId),
    type: ssu.content.type,
    version: String(ssu.version),
    ownerCapId,
    extension: decodeSsuExtension(f.extension),
    frozen: frozen !== null,
    online: status === "ONLINE",
    slots,
    readAt,
  };
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
