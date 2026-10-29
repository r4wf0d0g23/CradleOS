import { describe, it, expect } from "vitest";
import {
  storageTransferAmount,
  storageTransferDirection,
  storageTransferTarget,
} from "./storageTransferIntent";
import type { StorageItem } from "./ssuSafety";
const item: StorageItem = {
  typeId: 42,
  quantity: 10,
  volume: 1,
  itemId: "9",
  partition: "unknown",
  partitionKey: "my-cap",
};
const access = {
  ready: true,
  charOwnerCapId: "my-cap",
  canDeposit: true,
  canWithdraw: true,
};
describe("storage transfer intent boundaries", () => {
  it("routes only caller personal stock into shared", () => {
    expect(storageTransferDirection(item, access)).toBe("deposit");
    expect(
      storageTransferDirection({ ...item, partitionKey: "other-cap" }, access),
    ).toBeNull();
    expect(
      storageTransferDirection({ ...item, partition: "owner_main" }, access),
    ).toBeNull();
    expect(
      storageTransferDirection(item, { ...access, charOwnerCapId: null }),
    ).toBeNull();
    expect(storageTransferTarget("deposit")).toBe("open");
  });
  it("separates permitted withdrawal from owner recovery", () => {
    const shared = { ...item, partition: "open" as const };
    expect(storageTransferDirection(shared, access)).toBe("withdraw");
    expect(
      storageTransferDirection(shared, { ...access, canWithdraw: false }),
    ).toBeNull();
    expect(
      storageTransferDirection(shared, {
        ...access,
        canWithdraw: false,
        ownerCapId: "owner",
      }),
    ).toBe("recover");
    expect(storageTransferTarget("withdraw")).toBe("personal");
    expect(storageTransferTarget("recover")).toBe("personal");
  });
  it("does not offer action while unavailable or forbidden", () => {
    expect(
      storageTransferDirection(item, { ...access, ready: false }),
    ).toBeNull();
    expect(
      storageTransferDirection(item, { ...access, canDeposit: false }),
    ).toBeNull();
    expect(
      storageTransferDirection({ ...item, quantity: 0 }, access),
    ).toBeNull();
  });
  it("keeps exact valid amounts and rejects blanks, fractions, exponents and overflow", () => {
    expect(storageTransferAmount("3", 10)).toBe(3);
    expect(storageTransferAmount("10", 10)).toBe(10);
    expect(storageTransferAmount("4294967295", 4294967295)).toBe(4294967295);
    for (const invalid of [
      "",
      "0",
      "-1",
      "11",
      "1.5",
      "1e1",
      " 2",
      "NaN",
      "Infinity",
      "9007199254740993",
    ])
      expect(storageTransferAmount(invalid, 10)).toBeNull();
    expect(storageTransferAmount("4294967296", 4294967296)).toBeNull();
  });
});
