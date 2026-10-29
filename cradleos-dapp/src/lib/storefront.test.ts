import { describe, it, expect } from "vitest";
import { WORLD_PKG } from "../constants";
import { SSU_TYPE, openStorageKey, type SsuSnapshot } from "./ssuSafety";
import {
  SHOP_CURRENCIES,
  buildShopAction,
  shopPrice,
  formatShopPrice,
  validateListing,
  validateShopRules,
  shopPermits,
  shopExtension,
  shopU64,
  type Shop,
  type ShopListing,
  type ShopAction,
} from "./storefront";
const id = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const d = {
  packageId: id(99),
  originalId: id(99),
  registryId: id(98),
  worldId: WORLD_PKG,
};
const listing: ShopListing = {
  typeId: 42,
  currency: SHOP_CURRENCIES[0].type,
  price: "1000000001",
  stock: 20,
  revision: "1",
  enabled: true,
  minimum: 2,
  maximum: 20,
  step: 2,
  startsAt: 0,
  endsAt: 0,
  perPilot: "0",
};
const shop: Shop = {
  id: id(6),
  ssuId: id(1),
  ownerCapId: id(2),
  version: "1",
  revision: "1",
  name: "Shop",
  open: true,
  mode: 4,
  tribes: [],
  pilots: [],
  deny: [],
  listings: [listing],
  proceedsId: id(9),
};
const state = (): SsuSnapshot => ({
  id: id(1),
  type: SSU_TYPE,
  version: "1",
  ownerCapId: id(2),
  extension: `${d.packageId}::storefront::StorefrontAuth`,
  online: true,
  frozen: false,
  readAt: Date.now(),
  slots: [
    ["owner_main", id(2)],
    ["unknown", id(5)],
    ["open", openStorageKey(id(1))],
  ].map(([partition, key]) => ({
    key,
    partition: partition as any,
    max: 1000,
    used: 20,
    items: [
      {
        partition: partition as any,
        partitionKey: key,
        typeId: 42,
        quantity: 20,
        volume: 1,
        itemId: "42",
      },
    ],
  })),
});
const build = (
  a: ShopAction,
  s = state(),
  p: Shop | null = shop,
  cap: string | undefined = id(2),
) => buildShopAction(s, p, a, id(3), id(4), cap, id(5), d);
const calls = (tx: ReturnType<typeof build>) =>
  tx
    .getData()
    .commands.flatMap((c) => (c.$kind === "MoveCall" ? [c.MoveCall] : []));
describe("exact money and offer validation", () => {
  it("preserves single base unit and u64 maximum without floating rounding", () => {
    expect(shopPrice("0.000000001", listing.currency)).toBe("1");
    expect(shopPrice("18446744073.709551615", listing.currency)).toBe(
      "18446744073709551615",
    );
    expect(formatShopPrice("18446744073709551615", listing.currency)).toBe(
      "18446744073.709551615",
    );
  });
  it.each(["0", "-1", "1e3", "1.0000000001", "NaN", "18446744073.709551616"])(
    "rejects bad price %s",
    (v) => expect(() => shopPrice(v, listing.currency)).toThrow(),
  );
  it("pins full coin type not ticker", () =>
    expect(() => shopPrice("1", `${id(77)}::EVE::EVE`)).toThrow());
  it("rejects unsafe number and negative u64", () => {
    expect(() => shopU64(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => shopU64("-1")).toThrow();
  });
  it.each([
    { minimum: 0 },
    { step: 0 },
    { step: 3 },
    { maximum: 1 },
    { price: "18446744073709551615" },
    { startsAt: 20, endsAt: 20 },
    { endsAt: 8640000000000001 },
    { perPilot: "1" },
  ])("rejects impossible listing %j", (patch) =>
    expect(() => validateListing({ ...listing, ...patch })).toThrow(),
  );
  it("validates normalized permissions with deny overriding public", () => {
    expect(shopPermits({ ...shop, deny: [id(3)] }, id(3), 100)).toBe(false);
    expect(shopPermits({ ...shop, mode: 3, tribes: [100] }, id(3), 100)).toBe(
      true,
    );
    expect(shopPermits({ ...shop, mode: 2, pilots: [id(3)] }, id(3), 999)).toBe(
      true,
    );
  });
  it("rejects duplicate IDs and stale fields", () => {
    expect(() =>
      validateShopRules({ ...shop, mode: 1, tribes: [100, 100] }),
    ).toThrow();
    expect(() => validateShopRules({ ...shop, tribes: [100] })).toThrow();
  });
});
describe("storefront transaction isolation", () => {
  it("buy has only storefront buy, no owner cap or tribal calls", () => {
    const c = calls(build({ kind: "buy", typeId: 42, quantity: 2 }));
    expect(c.map((c) => c.function)).toEqual(["buy"]);
    expect(c[0].module).toBe("storefront");
    expect(c[0].typeArguments).toEqual([listing.currency]);
  });
  it("owner stocking borrows and returns only canonical SSU cap", () =>
    expect(
      calls(build({ kind: "stock_owner", typeId: 42, quantity: 2 })).map(
        (c) => c.function,
      ),
    ).toEqual(["borrow_owner_cap", "stock_owner", "return_owner_cap"]));
  it("personal stocking requires both capabilities", () =>
    expect(
      calls(build({ kind: "stock_personal", typeId: 42, quantity: 2 })).map(
        (c) => c.function,
      ),
    ).toEqual([
      "borrow_owner_cap",
      "borrow_owner_cap",
      "stock_personal",
      "return_owner_cap",
      "return_owner_cap",
    ]));
  it("activation cannot replace tribal binding", () =>
    expect(() => build({ kind: "create", name: "X" }, state(), null)).toThrow(
      "empty default",
    ));
  it("activation cannot take occupied unbound shared stock", () =>
    expect(() =>
      build(
        { kind: "create", name: "X" },
        { ...state(), extension: null },
        null,
      ),
    ).toThrow("empty default"));
  it("activation only fresh, empty, unfrozen default SSU", () => {
    const s = { ...state(), extension: null, slots: [] };
    expect(
      calls(build({ kind: "create", name: "X" }, s, null)).map(
        (c) => c.function,
      ),
    ).toEqual(["borrow_owner_cap", "create", "share_shop", "return_owner_cap"]);
    expect(() =>
      build({ kind: "create", name: "X" }, { ...s, frozen: true }, null),
    ).toThrow();
  });
  it("rejects wrong/non-owner cap", () => {
    expect(() =>
      build(
        { kind: "stock_owner", typeId: 42, quantity: 1 },
        state(),
        shop,
        id(7),
      ),
    ).toThrow("Owner");
    expect(() =>
      buildShopAction(
        state(),
        shop,
        { kind: "unstock", typeId: 42, quantity: 1 },
        id(3),
        id(4),
        undefined,
        undefined,
        d,
      ),
    ).toThrow("Owner");
  });
  it("does not allow another personal partition", () =>
    expect(() =>
      buildShopAction(
        state(),
        shop,
        { kind: "stock_personal", typeId: 42, quantity: 1 },
        id(3),
        id(4),
        id(2),
        id(11),
        d,
      ),
    ).toThrow("stock"));
  it("rejects stale previews", () =>
    expect(() =>
      build(
        { kind: "buy", typeId: 42, quantity: 2 },
        { ...state(), readAt: Date.now() - 30001 },
      ),
    ).toThrow("expired"));
  it("wrong shop link fails closed", () =>
    expect(() =>
      build({ kind: "buy", typeId: 42, quantity: 2 }, state(), {
        ...shop,
        ssuId: id(44),
      }),
    ).toThrow("Wrong"));
  it.each([0, 1, 21, 1.5, NaN, Infinity])(
    "rejects unsupported order quantity %s",
    (quantity) =>
      expect(() => build({ kind: "buy", typeId: 42, quantity })).toThrow(),
  );
  it("sale requires current witness and online unit", () => {
    expect(() =>
      build(
        { kind: "buy", typeId: 42, quantity: 2 },
        { ...state(), extension: null },
      ),
    ).toThrow("inactive");
    expect(() =>
      build(
        { kind: "buy", typeId: 42, quantity: 2 },
        { ...state(), online: false },
      ),
    ).toThrow("inactive");
  });
  it("does not lock claim to online/witness state", () =>
    expect(
      calls(
        build(
          { kind: "claim", currency: listing.currency },
          { ...state(), extension: null, online: false },
        ),
      ).map((c) => c.function),
    ).toEqual(["borrow_owner_cap", "claim", "return_owner_cap"]));
  it("cannot change currency on existing listing", () =>
    expect(() =>
      build({
        kind: "listing",
        listing: { ...listing, currency: SHOP_CURRENCIES[1].type },
      }),
    ).toThrow("Listing changed"));
  it("rejects old listing revision", () =>
    expect(() =>
      build({ kind: "listing", listing: { ...listing, revision: "0" } }),
    ).toThrow("Listing changed"));
  it("disabled shop/listing cannot purchase", () => {
    expect(() =>
      build({ kind: "buy", typeId: 42, quantity: 2 }, state(), {
        ...shop,
        open: false,
      }),
    ).toThrow();
    expect(() =>
      build({ kind: "buy", typeId: 42, quantity: 2 }, state(), {
        ...shop,
        listings: [{ ...listing, enabled: false }],
      }),
    ).toThrow();
  });
  it("current-world deployment and exact witness only", () => {
    expect(shopExtension(state().extension, d)).toBe(true);
    expect(shopExtension(`${id(88)}::storefront::StorefrontAuth`, d)).toBe(
      false,
    );
    expect(() =>
      buildShopAction(
        state(),
        shop,
        { kind: "claim", currency: listing.currency },
        id(3),
        id(4),
        id(2),
        undefined,
        { ...d, worldId: id(77) },
      ),
    ).toThrow();
  });
});

import { GrpcTypes } from "@mysten/sui/grpc";
import { bcs } from "@mysten/sui/bcs";
import { deriveDynamicFieldID } from "@mysten/sui/utils";
import { idFieldId, type StorageReadClient } from "./storageRead";
import {
  readShop,
  discoverShops,
  readShopClaimAuthority,
  readShopProceeds,
  buildShopClaim,
} from "./storefront";
function readFixture() {
  const table = id(90),
    records = new Map<string, any>(),
    field = idFieldId(table, id(1));
  const put = (
    objectId: string,
    objectType: string,
    json: any,
    owner: any = { kind: "SHARED", version: "1" },
  ) =>
    records.set(objectId, {
      objectId,
      objectType,
      version: "1",
      owner,
      json: { id: objectId, ...json },
    });
  put(d.registryId, `${d.originalId}::storefront::Registry`, {
    shops: { id: table, size: "1" },
  });
  put(
    field,
    "0x2::dynamic_field::Field<0x2::object::ID,0x2::object::ID>",
    { name: id(1), value: shop.id },
    { kind: "OBJECT", address: table },
  );
  put(shop.id, `${d.originalId}::storefront::Shop`, {
    ssu_id: id(1),
    owner_cap_id: id(2),
    revision: "1",
    name: "Shop",
    open: true,
    mode: 4,
    tribes: [],
    pilots: [],
    deny: [],
    proceeds: { id: id(9), size: "0" },
    purchases: { id: id(10), size: "0" },
    listings: [
      {
        type_id: "42",
        currency: { name: listing.currency.slice(2) },
        price: listing.price,
        stock: 20,
        revision: "1",
        enabled: true,
        minimum: 2,
        maximum: 20,
        step: 2,
        starts_at: "0",
        ends_at: "0",
        per_pilot: "0",
      },
    ],
  });
  put(
    id(2),
    `${WORLD_PKG}::access::OwnerCap<${SSU_TYPE}>`,
    { authorized_object_id: id(1) },
    { kind: "OBJECT", address: id(3) },
  );
  let errorCode = 5;
  const api = {
    ledgerService: {
      batchGetObjects: ({ requests }: any) => ({
        response: Promise.resolve({
          objects: requests.map(({ objectId }: any) => ({
            result: records.has(objectId)
              ? {
                  oneofKind: "object",
                  object: GrpcTypes.Object.fromJson(records.get(objectId)),
                }
              : {
                  oneofKind: "error",
                  error: { code: errorCode, message: "lookup failed" },
                },
          })),
        }),
      }),
    },
    stateService: {
      listDynamicFields: () => ({
        response: Promise.resolve({
          dynamicFields: [...records.entries()]
            .filter(
              ([, o]) => o.owner.kind === "OBJECT" && o.owner.address === table,
            )
            .map(([fieldId, o]) => ({
              fieldId,
              parent: table,
              fieldObject: GrpcTypes.Object.fromJson(o),
            })),
          nextPageToken: new Uint8Array(),
        }),
      }),
    },
  } as unknown as StorageReadClient;
  return {
    records,
    put,
    table,
    field,
    api,
    setError: (n: number) => {
      errorCode = n;
    },
  };
}
describe("supported registry, proceeds and cap ownership reads", () => {
  it("binds registry, shop, canonical SSU and exact currency", async () => {
    const f = readFixture();
    expect(await readShop(id(1), d, f.api)).toEqual(shop);
  });
  it("decodes populated gRPC shops with string-decorated TypeName", async () => {
    const f = readFixture();
    f.records.get(shop.id).json.listings[0].currency =
      listing.currency.slice(2);
    expect(await readShop(id(1), d, f.api)).toEqual(shop);
    expect(await discoverShops(d, f.api)).toEqual({
      shops: [shop],
      unavailable: 0,
    });
  });
  it.each([null, 12, {}, { name: 12 }])(
    "rejects malformed TypeName %j",
    async (currency) => {
      const f = readFixture();
      f.records.get(shop.id).json.listings[0].currency = currency;
      await expect(readShop(id(1), d, f.api)).rejects.toThrow();
    },
  );
  it("does not report transport failures as absent shop", async () => {
    const f = readFixture();
    f.records.delete(f.field);
    f.setError(14);
    await expect(readShop(id(1), d, f.api)).rejects.toThrow();
  });
  it("isolates valid-onchain but unsupported shop without losing valid shop", async () => {
    const f = readFixture(),
      sid = id(12),
      other = id(13),
      field = idFieldId(f.table, sid);
    f.put(
      field,
      "0x2::dynamic_field::Field<0x2::object::ID,0x2::object::ID>",
      { name: sid, value: other },
      { kind: "OBJECT", address: f.table },
    );
    const raw = structuredClone(f.records.get(shop.id).json);
    raw.ssu_id = sid;
    raw.listings[0].type_id = "18446744073709551615";
    f.put(other, `${d.originalId}::storefront::Shop`, raw);
    f.records.get(other).json.id = other;
    const r = await discoverShops(d, f.api);
    expect(r.shops).toEqual([shop]);
    expect(r.unavailable).toBe(1);
  });
  it("rejects substituted registry target with mismatched SSU", async () => {
    const f = readFixture();
    f.records.get(shop.id).json.ssu_id = id(15);
    await expect(readShop(id(1), d, f.api)).rejects.toThrow();
  });
  it("claim ownership comes from canonical cap even without any SSU object", async () => {
    const f = readFixture(),
      a = await readShopClaimAuthority(shop, id(3), id(4), f.api);
    expect(a?.direct).toBe(false);
    expect(a?.capId).toBe(id(2));
    expect(
      calls(buildShopClaim(shop, listing.currency, a!, d)).map(
        (c) => c.function,
      ),
    ).toEqual(["borrow_owner_cap", "claim", "return_owner_cap"]);
  });
  it("direct held cap bypasses Character borrow but still enforces holder", async () => {
    const f = readFixture();
    f.records.get(id(2)).owner = { kind: "ADDRESS", address: id(4) };
    const a = await readShopClaimAuthority(shop, id(3), id(4), f.api);
    expect(a?.direct).toBe(true);
    expect(
      calls(buildShopClaim(shop, listing.currency, a!, d)).map(
        (c) => c.function,
      ),
    ).toEqual(["claim"]);
    expect(await readShopClaimAuthority(shop, id(3), id(7), f.api)).toBeNull();
  });
  it("foreign Character and changed target cannot claim", async () => {
    const f = readFixture();
    expect(await readShopClaimAuthority(shop, id(17), id(4), f.api)).toBeNull();
    f.records.get(id(2)).json.authorized_object_id = id(17);
    await expect(
      readShopClaimAuthority(shop, id(3), id(4), f.api),
    ).rejects.toThrow();
  });
  it("typed NOT_FOUND only is zero earnings", async () => {
    const f = readFixture();
    expect(await readShopProceeds(shop, f.api)).toEqual({
      [SHOP_CURRENCIES[0].type]: "0",
      [SHOP_CURRENCIES[1].type]: "0",
    });
    f.setError(14);
    await expect(readShopProceeds(shop, f.api)).rejects.toThrow();
  });
  it("decodes exact TypeName Bag Balance and rejects spoofed parent", async () => {
    const f = readFixture(),
      type = listing.currency,
      name = type.slice(2),
      key = deriveDynamicFieldID(
        shop.proceedsId,
        "0x1::type_name::TypeName",
        bcs.string().serialize(name).toBytes(),
      );
    f.put(
      key,
      `0x2::dynamic_field::Field<0x1::type_name::TypeName,0x2::balance::Balance<${type}>>`,
      { name: { name }, value: { value: "18446744073709551615" } },
      { kind: "OBJECT", address: shop.proceedsId },
    );
    expect((await readShopProceeds(shop, f.api))[type]).toBe(
      "18446744073709551615",
    );
    f.records.get(key).owner.address = id(11);
    await expect(readShopProceeds(shop, f.api)).rejects.toThrow();
  });
  it.each(["1", "18446744073709551615"])(
    "decodes decorated TypeName and Balance %s with exact field binding",
    async (amount) => {
      const f = readFixture(),
        type = listing.currency,
        name = type.slice(2);
      const key = deriveDynamicFieldID(
        shop.proceedsId,
        "0x1::type_name::TypeName",
        bcs.string().serialize(name).toBytes(),
      );
      f.put(
        key,
        `0x2::dynamic_field::Field<0x1::type_name::TypeName,0x2::balance::Balance<${type}>>`,
        { name, value: amount },
        { kind: "OBJECT", address: shop.proceedsId },
      );
      expect((await readShopProceeds(shop, f.api))[type]).toBe(amount);
      f.records.get(key).json.name = SHOP_CURRENCIES[1].type.slice(2);
      await expect(readShopProceeds(shop, f.api)).rejects.toThrow();
      f.records.get(key).json.name = name;
      f.records.get(key).objectType =
        `0x2::dynamic_field::Field<0x1::type_name::TypeName,0x2::balance::Balance<${SHOP_CURRENCIES[1].type}>>`;
      await expect(readShopProceeds(shop, f.api)).rejects.toThrow();
    },
  );
  it.each(["-1", "1.5", "18446744073709551616", "", null, 9007199254740992])(
    "rejects malformed decorated Balance %j",
    async (amount) => {
      const f = readFixture(),
        type = listing.currency,
        name = type.slice(2);
      const key = deriveDynamicFieldID(
        shop.proceedsId,
        "0x1::type_name::TypeName",
        bcs.string().serialize(name).toBytes(),
      );
      f.put(
        key,
        `0x2::dynamic_field::Field<0x1::type_name::TypeName,0x2::balance::Balance<${type}>>`,
        { name, value: amount },
        { kind: "OBJECT", address: shop.proceedsId },
      );
      await expect(readShopProceeds(shop, f.api)).rejects.toThrow();
    },
  );
});
