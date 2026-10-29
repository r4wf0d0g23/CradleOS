import { describe, it, expect } from "vitest";
import { buildOwnerStorageTransfer } from "./storageOwnerRouting";
import { SSU_TYPE, openStorageKey, type SsuSnapshot } from "./ssuSafety";
import { WORLD_PKG } from "../constants";
import { STORAGE_ACCESS_DEPLOYMENT as d } from "./storageAccessDeployment";
import { assertCycleCompatible } from "./transactionCompatibility";
const id = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const policy = {
  id: id(6),
  ssuId: id(1),
  revision: "1",
  version: "2",
  rules: { mode: 4 as const, tribeIds: [], deny: [], allow: [] },
};
function state(): SsuSnapshot {
  return {
    id: id(1),
    type: SSU_TYPE,
    version: "3",
    ownerCapId: id(2),
    extension: `${d!.originalId}::storage_access::SharedAccess`,
    online: true,
    frozen: false,
    readAt: Date.now(),
    slots: [
      { key: id(2), partition: "owner_main", used: 0, max: 10000, items: [] },
      ...(["unknown", "open"] as const).map((partition, i) => ({
        key: i ? openStorageKey(id(1)) : id(5),
        partition,
        used: 100,
        max: 10000,
        items: [
          {
            typeId: 42,
            quantity: 10,
            volume: 10,
            itemId: "0",
            partition,
            partitionKey: i ? openStorageKey(id(1)) : id(5),
          },
        ],
      })),
    ],
  };
}
const build = (
  direction: "personal_to_owner" | "owner_withdraw" | "owner_recover",
  s = state(),
  rows = [{ typeId: 42, quantity: 3 }],
  owner = id(2),
  personal = id(5),
) =>
  buildOwnerStorageTransfer(
    s,
    policy,
    id(3),
    id(4),
    direction,
    rows,
    owner,
    personal,
  );
describe("owner storage routing", () => {
  it.each(["personal_to_owner", "owner_withdraw", "owner_recover"] as const)(
    "%s borrows each cap once and consumes exact transit items",
    (direction) => {
      const tx = build(direction);
      assertCycleCompatible(tx);
      const calls = tx.getData().commands.map((c) => c.MoveCall!);
      expect(calls.map((c) => c.function)).toEqual([
        "borrow_owner_cap",
        "borrow_owner_cap",
        ...(direction === "personal_to_owner"
          ? []
          : [direction === "owner_recover" ? "recover_shared" : "withdraw"]),
        "withdraw_by_owner",
        "deposit_by_owner",
        "return_owner_cap",
        "return_owner_cap",
      ]);
      expect(
        calls
          .filter((c) => c.function === "borrow_owner_cap")
          .map((c) => c.typeArguments[0]),
      ).toEqual([`${WORLD_PKG}::character::Character`, SSU_TYPE]);
      const w = calls.find((c) => c.function === "withdraw_by_owner")!,
        de = calls.find((c) => c.function === "deposit_by_owner")!;
      expect(de.arguments[1]).toEqual({
        $kind: "Result",
        Result: calls.indexOf(w),
      });
      expect(de.arguments[0]).toEqual(w.arguments[0]);
      expect(JSON.stringify(tx.getData())).not.toMatch(
        /TransferObjects|authorize|configure|chain_item_to_game_inventory/,
      );
    },
  );
  it("personal recovery needs no sharing policy or extension, and frozen binding does not block native recovery", () => {
    const s = { ...state(), extension: null, frozen: true };
    expect(() =>
      buildOwnerStorageTransfer(
        s,
        null,
        id(3),
        id(4),
        "personal_to_owner",
        [{ typeId: 42, quantity: 1 }],
        id(2),
        id(5),
        null,
      ),
    ).not.toThrow();
    expect(() => build("owner_withdraw", s)).toThrow(/binding/);
  });
  it("rejects foreign/wrong owner, absent personal source, offline, expired and foreign-world snapshots", () => {
    expect(() => build("personal_to_owner", state(), undefined, id(9))).toThrow(
      /ownership/,
    );
    expect(() =>
      build("personal_to_owner", state(), undefined, id(2), id(9)),
    ).toThrow(/partition/);
    expect(() =>
      build("personal_to_owner", { ...state(), online: false }),
    ).toThrow(/offline/);
    expect(() =>
      build("personal_to_owner", { ...state(), readAt: Date.now() - 31000 }),
    ).toThrow(/expired/);
    expect(() =>
      build("personal_to_owner", {
        ...state(),
        type: `${id(9)}::storage_unit::StorageUnit`,
      }),
    ).toThrow(/expired/);
  });
  it("enforces source amounts, distinct types and aggregate destination capacity", () => {
    for (const n of [0, -1, 1.5, 11, 0x100000000])
      expect(() =>
        build("personal_to_owner", state(), [{ typeId: 42, quantity: n }]),
      ).toThrow();
    expect(() =>
      build("personal_to_owner", state(), [
        { typeId: 42, quantity: 1 },
        { typeId: 42, quantity: 1 },
      ]),
    ).toThrow(/different/);
    const s = state();
    s.slots[0].max = 29;
    expect(() => build("personal_to_owner", s)).toThrow(/Owner storage full/);
  });
  it("checks temporary personal capacity and stack overflow for shared owner routes", () => {
    const s = state();
    s.slots[1].max = 129;
    expect(() => build("owner_withdraw", s)).toThrow(/Personal storage full/);
    s.slots[1].max = 10000;
    s.slots[1].items[0].quantity = 0xffffffff;
    expect(() => build("owner_recover", s)).toThrow(/Personal stack limit/);
  });
  it("interleaves each shared delivery, leaving existing personal stock unchanged", () => {
    const s = state();
    s.slots[2].items.push({ ...s.slots[2].items[0], typeId: 43 });
    const calls = build("owner_withdraw", s, [
      { typeId: 42, quantity: 1 },
      { typeId: 43, quantity: 2 },
    ])
      .getData()
      .commands.map((c) => c.MoveCall!.function);
    expect(calls.slice(2, -2)).toEqual([
      "withdraw",
      "withdraw_by_owner",
      "deposit_by_owner",
      "withdraw",
      "withdraw_by_owner",
      "deposit_by_owner",
    ]);
  });
});
