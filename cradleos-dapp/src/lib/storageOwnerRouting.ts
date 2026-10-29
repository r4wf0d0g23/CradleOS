import { Transaction } from "@mysten/sui/transactions";
import { WORLD_PKG } from "../constants";
import { storageId } from "./storageRead";
import { SSU_TYPE, type SsuSnapshot } from "./ssuSafety";
import {
  assertStoragePreview,
  secureStorageExtension,
  type StoragePolicy,
} from "./storageAccess";
import { STORAGE_ACCESS_DEPLOYMENT } from "./storageAccessDeployment";

export class StorageCapacityError extends Error {}

export type OwnerStorageDirection =
  | "personal_to_owner"
  | "owner_withdraw"
  | "owner_recover";
/** Same-unit, atomic owner routing. Every transit Item is consumed, both caps returned.
 * Personal recovery needs both canonical holdings, not shared-pool permission.
 * Shared withdrawal retains the existing contract's permission/recovery checks.
 */
export function buildOwnerStorageTransfer(
  state: SsuSnapshot,
  policy: StoragePolicy | null,
  characterId: string,
  wallet: string,
  direction: OwnerStorageDirection,
  rows: { typeId: number; quantity: number }[],
  ownerCapId: string,
  characterCapId: string,
  deployment = STORAGE_ACCESS_DEPLOYMENT,
): Transaction {
  const owner = storageId(ownerCapId),
    personal = storageId(characterCapId);
  if (owner !== state.ownerCapId || owner === personal)
    throw new Error("Storage ownership changed. Refresh.");
  if (!state.online) throw new Error("Storage offline.");
  assertStoragePreview(state);
  if (
    direction !== "personal_to_owner" &&
    (!secureStorageExtension(state.extension, deployment) ||
      !policy ||
      policy.ssuId !== state.id)
  )
    throw new Error("Sharing binding changed. Refresh.");
  if (
    !rows.length ||
    rows.length > 100 ||
    new Set(rows.map((r) => r.typeId)).size !== rows.length
  )
    throw new Error("Choose 1–100 different stacks.");
  const destination = state.slots.find(
    (s) => s.key === owner && s.partition === "owner_main",
  );
  const source = state.slots.find((s) =>
    direction === "personal_to_owner"
      ? s.key === personal && s.partition === "unknown"
      : s.partition === "open",
  );
  if (!destination || !source)
    throw new Error("Storage partition unavailable. Refresh.");
  let volume = 0n;
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.typeId) ||
      row.typeId <= 0 ||
      !Number.isInteger(row.quantity) ||
      row.quantity <= 0 ||
      row.quantity > 0xffffffff
    )
      throw new Error("Invalid transfer quantity.");
    const stock = source.items.find((i) => i.typeId === row.typeId);
    if (!stock || stock.quantity < row.quantity)
      throw new Error("Stock changed. Refresh.");
    const existing = destination.items.find((i) => i.typeId === row.typeId);
    if ((existing?.quantity ?? 0) + row.quantity > 0xffffffff)
      throw new StorageCapacityError("Owner stack limit exceeded.");
    const personalSlot = state.slots.find(
      (s) => s.key === personal && s.partition === "unknown",
    );
    const personalEntry = personalSlot?.items.find(
      (i) => i.typeId === row.typeId,
    );
    // Shared delivery passes through personal storage, one row at a time.
    // The native inventory uses an existing entry's stored volume on deposit.
    const transitVolume =
      direction === "personal_to_owner"
        ? stock.volume
        : (personalEntry?.volume ?? stock.volume);
    if (direction !== "personal_to_owner") {
      if ((personalEntry?.quantity ?? 0) + row.quantity > 0xffffffff)
        throw new StorageCapacityError("Personal stack limit exceeded.");
      if (
        BigInt(personalSlot?.used ?? 0) +
          BigInt(transitVolume) * BigInt(row.quantity) >
        BigInt(personalSlot?.max ?? destination.max)
      )
        throw new StorageCapacityError("Personal storage full.");
    }
    volume += BigInt(existing?.volume ?? transitVolume) * BigInt(row.quantity);
  }
  if (BigInt(destination.used) + volume > BigInt(destination.max))
    throw new StorageCapacityError("Owner storage full.");
  const tx = new Transaction();
  tx.setSender(storageId(wallet));
  const characterType = `${WORLD_PKG}::character::Character`;
  const borrow = (type: string, cap: string) =>
    tx.moveCall({
      target: `${WORLD_PKG}::character::borrow_owner_cap`,
      typeArguments: [type],
      arguments: [tx.object(storageId(characterId)), tx.object(cap)],
    });
  const [pc, pr] = borrow(characterType, personal),
    [sc, sr] = borrow(SSU_TYPE, owner);
  for (const row of rows) {
    if (direction !== "personal_to_owner") {
      const args =
        direction === "owner_recover"
          ? [tx.object(state.id), sc, tx.object(storageId(characterId))]
          : [
              tx.object(state.id),
              tx.object(policy!.id),
              tx.object(storageId(characterId)),
            ];
      tx.moveCall({
        target: `${deployment!.packageId}::storage_access::${direction === "owner_recover" ? "recover_shared" : "withdraw"}`,
        arguments: [
          ...args,
          tx.pure.u64(row.typeId),
          tx.pure.u32(row.quantity),
          ...(direction === "owner_recover" ? [] : [tx.object("0x6")]),
        ],
      });
    }
    const item = tx.moveCall({
      target: `${WORLD_PKG}::storage_unit::withdraw_by_owner`,
      typeArguments: [characterType],
      arguments: [
        tx.object(state.id),
        tx.object(storageId(characterId)),
        pc,
        tx.pure.u64(row.typeId),
        tx.pure.u32(row.quantity),
      ],
    });
    tx.moveCall({
      target: `${WORLD_PKG}::storage_unit::deposit_by_owner`,
      typeArguments: [SSU_TYPE],
      arguments: [
        tx.object(state.id),
        item,
        tx.object(storageId(characterId)),
        sc,
      ],
    });
  }
  for (const [type, cap, receipt] of [
    [characterType, pc, pr],
    [SSU_TYPE, sc, sr],
  ] as const)
    tx.moveCall({
      target: `${WORLD_PKG}::character::return_owner_cap`,
      typeArguments: [type],
      arguments: [tx.object(storageId(characterId)), cap, receipt],
    });
  return tx;
}
