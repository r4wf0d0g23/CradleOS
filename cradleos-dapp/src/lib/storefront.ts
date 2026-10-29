import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { deriveDynamicFieldID, normalizeStructTag } from "@mysten/sui/utils";
import { EVE_COIN_TYPE, WORLD_PKG } from "../constants";
import {
  STOREFRONT_DEPLOYMENT,
  type StorefrontDeployment,
} from "./storefrontDeployment";
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
  storageClient,
  type StorageReadClient,
} from "./storageRead";
import { assertStoragePreview } from "./storageAccess";
import { SSU_TYPE, type SsuSnapshot } from "./ssuSafety";
export const SHOP_CURRENCIES = [
  { symbol: "$EVE", type: normalizeStructTag(EVE_COIN_TYPE), decimals: 9 },
  { symbol: "SUI", type: normalizeStructTag("0x2::sui::SUI"), decimals: 9 },
] as const;
export type ShopRules = {
  name: string;
  open: boolean;
  mode: number;
  tribes: number[];
  pilots: string[];
  deny: string[];
};
export type ShopListing = {
  typeId: number;
  currency: string;
  price: string;
  stock: number;
  revision: string;
  enabled: boolean;
  minimum: number;
  maximum: number;
  step: number;
  startsAt: number;
  endsAt: number;
  perPilot: string;
};
export type Shop = ShopRules & {
  id: string;
  ssuId: string;
  ownerCapId: string;
  version: string;
  revision: string;
  listings: ShopListing[];
  proceedsId: string;
};
export function shopDeployment(
  d = STOREFRONT_DEPLOYMENT,
): StorefrontDeployment {
  if (!d || storageId(d.worldId) !== storageId(WORLD_PKG))
    throw Error("Storefront unavailable.");
  return {
    packageId: storageId(d.packageId),
    originalId: storageId(d.originalId),
    registryId: storageId(d.registryId),
    worldId: storageId(d.worldId),
  };
}
export function shopExtension(
  extension: string | null,
  d = STOREFRONT_DEPLOYMENT,
): boolean {
  return (
    !!d &&
    !!extension &&
    normalizeStructTag(extension) ===
      `${shopDeployment(d).originalId}::storefront::StorefrontAuth`
  );
}
export function shopU64(v: unknown): string {
  if (
    !["string", "number"].includes(typeof v) ||
    !/^\d+$/.test(String(v)) ||
    (typeof v === "number" && !Number.isSafeInteger(v)) ||
    BigInt(String(v)) > 0xffffffffffffffffn
  )
    throw Error("Invalid integer.");
  return BigInt(String(v)).toString();
}
const u32 = (v: unknown) => {
  const n = storageUint(v);
  if (n > 0xffffffff) throw Error("Invalid quantity.");
  return n;
};
const bool = (v: unknown) => {
  if (typeof v !== "boolean") throw Error("Storefront unavailable.");
  return v;
};
const unique = (v: unknown[]) => {
  if (v.length !== new Set(v).size) throw Error("Duplicate entry.");
};
export function validateShopRules(r: ShopRules): ShopRules {
  if (
    !r.name.trim() ||
    new TextEncoder().encode(r.name).length > 80 ||
    !Number.isInteger(r.mode) ||
    r.mode < 0 ||
    r.mode > 4
  )
    throw Error("Invalid shop settings.");
  bool(r.open);
  if (r.tribes.length > 32 || r.pilots.length > 128 || r.deny.length > 128)
    throw Error("Too many access entries.");
  const out = {
    ...r,
    tribes: r.tribes.map(u32),
    pilots: r.pilots.map(storageId),
    deny: r.deny.map(storageId),
  };
  for (const a of [out.tribes, out.pilots, out.deny]) unique(a);
  if (
    out.tribes.includes(0) ||
    ((r.mode === 0 || r.mode === 4) &&
      (out.tribes.length || out.pilots.length)) ||
    (r.mode === 1 && (!out.tribes.length || out.pilots.length)) ||
    (r.mode === 2 && out.tribes.length)
  )
    throw Error("Invalid access fields.");
  return out;
}
export function validateListing(l: ShopListing): ShopListing {
  const out = {
    ...l,
    currency: normalizeStructTag(l.currency),
    price: shopU64(l.price),
    revision: shopU64(l.revision),
    perPilot: shopU64(l.perPilot),
    minimum: u32(l.minimum),
    maximum: u32(l.maximum),
    step: u32(l.step),
    stock: u32(l.stock),
  };
  shopU64(l.typeId);
  shopU64(l.startsAt);
  shopU64(l.endsAt);
  bool(l.enabled);
  if (l.startsAt > 253402214400000 || l.endsAt > 253402214400000)
    throw Error("Unsupported sale date.");
  if (
    !l.typeId ||
    BigInt(out.price) === 0n ||
    !out.minimum ||
    out.maximum < out.minimum ||
    !out.step ||
    out.minimum % out.step ||
    out.maximum % out.step ||
    (l.endsAt && l.endsAt <= l.startsAt) ||
    (BigInt(out.perPilot) && BigInt(out.perPilot) < BigInt(out.minimum)) ||
    BigInt(out.price) * BigInt(out.maximum) > 0xffffffffffffffffn
  )
    throw Error("Invalid listing.");
  return out;
}
export function shopPermits(
  shop: ShopRules,
  cid: string,
  tribe: number,
): boolean {
  const r = validateShopRules(shop),
    id = storageId(cid);
  return (
    !r.deny.includes(id) &&
    (r.mode === 4 ||
      ((r.mode === 1 || r.mode === 3) && r.tribes.includes(tribe)) ||
      ((r.mode === 2 || r.mode === 3) && r.pilots.includes(id)))
  );
}
export function shopPrice(text: string, currency: string): string {
  const coin = SHOP_CURRENCIES.find(
    (c) => c.type === normalizeStructTag(currency),
  );
  if (!coin || !new RegExp(`^\\d+(?:\\.\\d{1,${coin.decimals}})?$`).test(text))
    throw Error("Enter a positive price.");
  const [whole, decimal = ""] = text.split(".");
  const amount =
    BigInt(whole) * 10n ** BigInt(coin.decimals) +
    BigInt(decimal.padEnd(coin.decimals, "0"));
  if (!amount) throw Error("Enter a positive price.");
  return shopU64(amount.toString());
}
export function formatShopPrice(amount: string, currency: string): string {
  const c = SHOP_CURRENCIES.find(
    (c) => c.type === normalizeStructTag(currency),
  );
  if (!c) return `${shopU64(amount)} units`;
  const n = BigInt(shopU64(amount)),
    scale = 10n ** BigInt(c.decimals),
    fraction = (n % scale)
      .toString()
      .padStart(c.decimals, "0")
      .replace(/0+$/, "");
  return `${n / scale}${fraction ? "." + fraction : ""}`;
}
// Supported gRPC JSON decorates TypeName as a string. Raw struct fixtures and
// alternate readers may retain its single `name` field.
function moveTypeName(value: unknown): string {
  const name = typeof value === "string" ? value : storageRecord(value).name;
  if (typeof name !== "string" || !name) throw Error("Storefront unavailable.");
  return name;
}
function decodeShop(
  o: Awaited<ReturnType<typeof storageObject>>,
  sid: string,
  d: StorefrontDeployment,
): Shop {
  assertStorageType(o, `${d.originalId}::storefront::Shop`);
  const f = o.fields;
  if (
    o.owner.kind !== 3 ||
    storageId(f.ssu_id) !== storageId(sid) ||
    !Array.isArray(f.listings) ||
    f.listings.length > 100
  )
    throw Error("Storefront unavailable.");
  const rules = validateShopRules({
    name: f.name,
    open: f.open,
    mode: storageUint(f.mode),
    tribes: f.tribes.map(storageUint),
    pilots: f.pilots.map(storageId),
    deny: f.deny.map(storageId),
  });
  const listings = f.listings.map((raw: unknown) => {
    const l = storageRecord(raw),
      name = moveTypeName(l.currency);
    return validateListing({
      typeId: storageUint(l.type_id),
      currency: name.startsWith("0x") ? name : `0x${name}`,
      price: shopU64(l.price),
      stock: u32(l.stock),
      revision: shopU64(l.revision),
      enabled: bool(l.enabled),
      minimum: u32(l.minimum),
      maximum: u32(l.maximum),
      step: u32(l.step),
      startsAt: storageUint(l.starts_at),
      endsAt: storageUint(l.ends_at),
      perPilot: shopU64(l.per_pilot),
    });
  });
  unique(listings.map((l: ShopListing) => l.typeId));
  return {
    ...rules,
    id: o.id,
    ssuId: storageId(sid),
    ownerCapId: storageId(f.owner_cap_id),
    version: o.version,
    revision: shopU64(f.revision),
    listings,
    proceedsId: storageId(storageRecord(f.proceeds).id),
  };
}
async function registryTable(d: StorefrontDeployment, api: StorageReadClient) {
  const r = await storageObject(d.registryId, api);
  assertStorageType(r, `${d.originalId}::storefront::Registry`);
  if (r.owner.kind !== 3) throw Error("Storefront unavailable.");
  return storageId(storageRecord(r.fields.shops).id);
}
export async function readShop(
  sid: string,
  d = STOREFRONT_DEPLOYMENT,
  api: StorageReadClient = storageClient,
): Promise<Shop | null> {
  const deployment = shopDeployment(d),
    table = await registryTable(deployment, api);
  const f = (await storageObjects([idFieldId(table, sid)], api))[0];
  if (!f) return null;
  assertIdField(f, table, sid, "0x2::object::ID");
  return decodeShop(
    await storageObject(storageId(f.fields.value), api),
    sid,
    deployment,
  );
}
export async function discoverShops(
  d = STOREFRONT_DEPLOYMENT,
  api: StorageReadClient = storageClient,
): Promise<{ shops: Shop[]; unavailable: number }> {
  const deployment = shopDeployment(d),
    table = await registryTable(deployment, api),
    fields = await storageFields(table, "0x2::object::ID", api);
  const objects = await storageObjects(
    fields.map((f) => storageId(f.fields.value)),
    api,
  );
  const shops: Shop[] = [];
  let unavailable = 0;
  objects.forEach((o, i) => {
    try {
      if (!o) throw Error("Storefront unavailable.");
      shops.push(decodeShop(o, storageId(fields[i].fields.name), deployment));
    } catch {
      unavailable++;
    }
  });
  return { shops, unavailable };
}
export type ShopAction =
  | { kind: "create"; name: string }
  | { kind: "configure"; rules: ShopRules }
  | { kind: "listing"; listing: ShopListing }
  | {
      kind: "stock_owner" | "stock_personal" | "unstock";
      typeId: number;
      quantity: number;
    }
  | { kind: "buy"; typeId: number; quantity: number }
  | { kind: "claim"; currency: string };
export function shopPreviewKey(state: SsuSnapshot, shop: Shop | null) {
  return JSON.stringify([
    state.id,
    state.version,
    state.extension,
    state.frozen,
    state.ownerCapId,
    state.slots,
    shop,
  ]);
}
export function buildShopAction(
  state: SsuSnapshot,
  shop: Shop | null,
  action: ShopAction,
  characterId: string,
  wallet: string,
  capId?: string,
  characterCapId?: string,
  d = STOREFRONT_DEPLOYMENT,
): Transaction {
  const deployment = shopDeployment(d);
  assertStoragePreview(state);
  const cid = storageId(characterId),
    address = storageId(wallet),
    ownerAction = action.kind !== "buy";
  if (
    shop &&
    (shop.ssuId !== storageId(state.id) ||
      shop.ownerCapId !== storageId(state.ownerCapId))
  )
    throw Error("Wrong storefront.");
  if (action.kind === "create") {
    if (
      shop ||
      state.extension ||
      state.frozen ||
      state.slots.some((s) => s.partition === "open" && s.items.length)
    )
      throw Error("Use an empty default-storage SSU.");
    validateShopRules({
      name: action.name,
      open: false,
      mode: 0,
      tribes: [],
      pilots: [],
      deny: [],
    });
  } else if (!shop) throw Error("Storefront unavailable.");
  if (
    !["create", "configure", "listing", "claim"].includes(action.kind) &&
    (!state.online || !shopExtension(state.extension, deployment))
  )
    throw Error("Storefront inactive.");
  if (
    ownerAction &&
    (!capId || storageId(capId) !== storageId(state.ownerCapId))
  )
    throw Error("Owner access required.");
  const tx = new Transaction();
  tx.setSender(address);
  const target = (name: string) =>
    `${deployment.packageId}::storefront::${name}` as `${string}::${string}::${string}`;
  const su = tx.object(state.id),
    c = tx.object(cid),
    p = shop ? tx.object(shop.id) : undefined;
  const [cap, receipt] = ownerAction
    ? tx.moveCall({
        target: `${WORLD_PKG}::character::borrow_owner_cap`,
        typeArguments: [SSU_TYPE],
        arguments: [c, tx.object(capId!)],
      })
    : [];
  if (action.kind === "create") {
    const [created] = tx.moveCall({
      target: target("create"),
      arguments: [
        tx.object(deployment.registryId),
        su,
        cap,
        tx.pure.string(action.name),
      ],
    });
    tx.moveCall({ target: target("share_shop"), arguments: [created] });
  } else if (action.kind === "configure") {
    const r = validateShopRules(action.rules);
    tx.moveCall({
      target: target("configure"),
      arguments: [
        p!,
        cap,
        tx.pure.u64(shop!.revision),
        tx.pure.string(r.name),
        tx.pure.bool(r.open),
        tx.pure.u8(r.mode),
        tx.pure.vector("u32", r.tribes),
        tx.pure.vector("address", r.pilots),
        tx.pure.vector("address", r.deny),
      ],
    });
  } else if (action.kind === "listing") {
    const l = validateListing(action.listing);
    if (!SHOP_CURRENCIES.some((c) => c.type === l.currency))
      throw Error("Unsupported currency.");
    const existing = shop!.listings.find((e) => e.typeId === l.typeId);
    if (
      (existing?.revision ?? "0") !== l.revision ||
      (existing && existing.currency !== l.currency)
    )
      throw Error("Listing changed. Refresh.");
    tx.moveCall({
      target: target("set_listing"),
      typeArguments: [l.currency],
      arguments: [
        p!,
        cap,
        tx.pure.u64(l.typeId),
        tx.pure.u64(l.revision),
        tx.pure.u64(l.price),
        tx.pure.bool(l.enabled),
        tx.pure.u32(l.minimum),
        tx.pure.u32(l.maximum),
        tx.pure.u32(l.step),
        tx.pure.u64(l.startsAt),
        tx.pure.u64(l.endsAt),
        tx.pure.u64(l.perPilot),
      ],
    });
  } else if (action.kind === "claim") {
    const currency = normalizeStructTag(action.currency);
    if (!SHOP_CURRENCIES.some((c) => c.type === currency))
      throw Error("Unsupported currency.");
    tx.moveCall({
      target: target("claim"),
      typeArguments: [currency],
      arguments: [p!, cap],
    });
  } else {
    const qty = u32(action.quantity),
      l = shop!.listings.find((l) => l.typeId === action.typeId);
    if (!qty || !l) throw Error("Invalid stock quantity.");
    if (action.kind === "buy") {
      if (
        !shop!.open ||
        !l.enabled ||
        Date.now() < l.startsAt ||
        (l.endsAt && Date.now() >= l.endsAt) ||
        qty < l.minimum ||
        qty > l.maximum ||
        qty % l.step ||
        qty > l.stock
      )
        throw Error("Offer unavailable.");
      if (!SHOP_CURRENCIES.some((c) => c.type === l.currency))
        throw Error("Unsupported currency.");
      const amount = BigInt(l.price) * BigInt(qty);
      shopU64(amount.toString());
      const payment = coinWithBalance({
        type: l.currency,
        balance: amount,
        useGasCoin: l.currency === SHOP_CURRENCIES[1].type,
      });
      tx.moveCall({
        target: target("buy"),
        typeArguments: [l.currency],
        arguments: [
          p!,
          su,
          c,
          tx.pure.u64(l.typeId),
          tx.pure.u32(qty),
          tx.pure.u64(shop!.revision),
          tx.pure.u64(l.revision),
          payment,
          tx.object("0x6"),
        ],
      });
    } else {
      const partition =
        action.kind === "stock_owner"
          ? state.ownerCapId
          : action.kind === "stock_personal"
            ? characterCapId
            : state.slots.find((s) => s.partition === "open")?.key;
      const available =
        state.slots
          .find((s) => s.key === partition)
          ?.items.find((i) => i.typeId === l.typeId)?.quantity ?? 0;
      if (qty > available || (action.kind === "unstock" && qty > l.stock))
        throw Error("Insufficient stock.");
      if (action.kind === "stock_personal") {
        if (!characterCapId) throw Error("Personal storage unavailable.");
        const type = `${WORLD_PKG}::character::Character`;
        const [cc, rr] = tx.moveCall({
          target: `${WORLD_PKG}::character::borrow_owner_cap`,
          typeArguments: [type],
          arguments: [c, tx.object(characterCapId)],
        });
        tx.moveCall({
          target: target(action.kind),
          arguments: [
            p!,
            su,
            cap,
            c,
            cc,
            tx.pure.u64(l.typeId),
            tx.pure.u32(qty),
          ],
        });
        tx.moveCall({
          target: `${WORLD_PKG}::character::return_owner_cap`,
          typeArguments: [type],
          arguments: [c, cc, rr],
        });
      } else
        tx.moveCall({
          target: target(action.kind),
          arguments: [p!, su, cap, c, tx.pure.u64(l.typeId), tx.pure.u32(qty)],
        });
    }
  }
  if (ownerAction)
    tx.moveCall({
      target: `${WORLD_PKG}::character::return_owner_cap`,
      typeArguments: [SSU_TYPE],
      arguments: [c, cap, receipt],
    });
  return tx;
}

// Earnings remain claimable with the canonical cap even if the world removes the SSU.
export type ShopClaimAuthority = {
  capId: string;
  characterId: string;
  wallet: string;
  direct: boolean;
  readAt: number;
};
export async function readShopClaimAuthority(
  shop: Shop,
  characterId: string,
  wallet: string,
  api: StorageReadClient = storageClient,
): Promise<ShopClaimAuthority | null> {
  const cap = await storageObject(shop.ownerCapId, api);
  assertStorageType(cap, `${WORLD_PKG}::access::OwnerCap<${SSU_TYPE}>`);
  if (storageId(cap.fields.authorized_object_id) !== shop.ssuId)
    throw Error("Proceeds unavailable.");
  const cid = storageId(characterId),
    address = storageId(wallet);
  if (
    !(
      (cap.owner.kind === 2 && storageId(cap.owner.address) === cid) ||
      (cap.owner.kind === 1 && storageId(cap.owner.address) === address)
    )
  )
    return null;
  return {
    capId: cap.id,
    characterId: cid,
    wallet: address,
    direct: cap.owner.kind === 1,
    readAt: Date.now(),
  };
}
export function buildShopClaim(
  shop: Shop,
  currency: string,
  authority: ShopClaimAuthority,
  d = STOREFRONT_DEPLOYMENT,
): Transaction {
  const deployment = shopDeployment(d),
    type = normalizeStructTag(currency);
  if (
    authority.capId !== shop.ownerCapId ||
    Date.now() - authority.readAt > 30000 ||
    authority.readAt > Date.now() ||
    !SHOP_CURRENCIES.some((c) => c.type === type)
  )
    throw Error("Proceeds preview expired.");
  const tx = new Transaction();
  tx.setSender(storageId(authority.wallet));
  const c = tx.object(storageId(authority.characterId));
  if (authority.direct)
    tx.moveCall({
      target: `${deployment.packageId}::storefront::claim`,
      typeArguments: [type],
      arguments: [tx.object(shop.id), tx.object(authority.capId)],
    });
  else {
    const [cap, r] = tx.moveCall({
      target: `${WORLD_PKG}::character::borrow_owner_cap`,
      typeArguments: [SSU_TYPE],
      arguments: [c, tx.object(authority.capId)],
    });
    tx.moveCall({
      target: `${deployment.packageId}::storefront::claim`,
      typeArguments: [type],
      arguments: [tx.object(shop.id), cap],
    });
    tx.moveCall({
      target: `${WORLD_PKG}::character::return_owner_cap`,
      typeArguments: [SSU_TYPE],
      arguments: [c, cap, r],
    });
  }
  return tx;
}

export async function readShopProceeds(
  shop: Shop,
  api: StorageReadClient = storageClient,
): Promise<Record<string, string>> {
  const keys = SHOP_CURRENCIES.map((c) =>
    deriveDynamicFieldID(
      shop.proceedsId,
      "0x1::type_name::TypeName",
      bcs
        .struct("TypeName", { name: bcs.string() })
        .serialize({ name: c.type.slice(2) })
        .toBytes(),
    ),
  );
  const objects = await storageObjects(keys, api);
  const out: Record<string, string> = {};
  objects.forEach((o, i) => {
    const currency = SHOP_CURRENCIES[i].type;
    if (!o) {
      out[currency] = "0";
      return;
    }
    assertStorageType(
      o,
      `0x2::dynamic_field::Field<0x1::type_name::TypeName,0x2::balance::Balance<${currency}>>`,
    );
    if (
      o.id !== keys[i] ||
      o.owner.kind !== 2 ||
      storageId(o.owner.address) !== shop.proceedsId ||
      moveTypeName(o.fields.name) !== currency.slice(2)
    )
      throw Error("Proceeds unavailable.");
    out[currency] = shopU64(
      typeof o.fields.value === "string"
        ? o.fields.value
        : storageRecord(o.fields.value).value,
    );
  });
  return out;
}

// Shared across keyed shop/wallet views and inventory-mode remounts. Held through signer settlement.
export const storefrontOperationLock = { current: false };
