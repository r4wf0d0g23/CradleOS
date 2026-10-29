import type { StorageItem } from "./ssuSafety";
export type StorageTransferDirection =
  | "deposit"
  | "owner_deposit"
  | "withdraw"
  | "recover"
  | "owner_withdraw"
  | "owner_recover"
  | "personal_to_owner";
export type StorageDropTarget = "personal" | "open" | "owner_main";
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
  if (item.partition === "open" && access.ownerCapId)
    return !access.charOwnerCapId
      ? null
      : access.canWithdraw
        ? "owner_withdraw"
        : "owner_recover";
  if (item.partition === "open")
    return access.canWithdraw
      ? "withdraw"
      : access.ownerCapId
        ? "recover"
        : null;
  if (item.partition === "owner_main")
    return !!access.ownerCapId &&
      item.partitionKey === access.ownerCapId &&
      access.canDeposit
      ? "owner_deposit"
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
  return direction === "deposit" || direction === "owner_deposit"
    ? "open"
    : direction === "owner_withdraw" ||
        direction === "owner_recover" ||
        direction === "personal_to_owner"
      ? "owner_main"
      : "personal";
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
