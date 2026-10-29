import type { StorageItem } from "./ssuSafety";
export type StorageTransferDirection = "deposit" | "withdraw" | "recover";
export type StorageDropTarget = "personal" | "open";
export function storageTransferDirection(
  item: StorageItem,
  access: {
    ready: boolean;
    charOwnerCapId: string | null;
    ownerCapId?: string;
    canDeposit: boolean;
    canWithdraw: boolean;
  },
): StorageTransferDirection | null {
  if (!access.ready || !Number.isInteger(item.quantity) || item.quantity <= 0)
    return null;
  if (item.partition === "open")
    return access.canWithdraw
      ? "withdraw"
      : access.ownerCapId
        ? "recover"
        : null;
  return item.partition === "unknown" &&
    !!access.charOwnerCapId &&
    item.partitionKey === access.charOwnerCapId &&
    access.canDeposit
    ? "deposit"
    : null;
}
export function storageTransferTarget(
  direction: StorageTransferDirection,
): StorageDropTarget {
  return direction === "deposit" ? "open" : "personal";
}
/** Strict decimal integers only; never round/clamp an amount the pilot entered. */
export function storageTransferAmount(
  text: string,
  available: number,
): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) &&
    n >= 1 &&
    n <= Math.min(available, 0xffffffff)
    ? n
    : null;
}
