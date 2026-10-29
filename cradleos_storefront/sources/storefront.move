/// Dedicated SSU shops. Never exports a witness or Item; every item stays in its SSU.
module cradleos_storefront::storefront;

use std::{bcs, string::String, type_name::{Self, TypeName}};
use sui::{bag::{Self, Bag}, balance::{Self, Balance}, clock::{Self, Clock},
    coin::{Self, Coin}, event, table::{Self, Table}};
use world::{access::{Self, OwnerCap}, character::{Self, Character}, inventory,
    storage_unit::{Self as su, StorageUnit}};

public struct StorefrontAuth has drop {}
public struct Registry has key { id: UID, shops: Table<ID, ID> }
public struct Shop has key {
    id: UID, ssu_id: ID, owner_cap_id: ID, revision: u64, name: String,
    open: bool, mode: u8, tribes: vector<u32>, pilots: vector<ID>, deny: vector<ID>,
    listings: vector<Listing>, purchases: Table<PurchaseKey, u64>, proceeds: Bag,
}
public struct Listing has store, drop {
    type_id: u64, currency: TypeName, price: u64, stock: u32, revision: u64,
    enabled: bool, minimum: u32, maximum: u32, step: u32,
    starts_at: u64, ends_at: u64, per_pilot: u64,
}
public struct PurchaseKey has copy, drop, store { type_id: u64, character_id: ID }
public struct ShopCreated has copy, drop { shop_id: ID, ssu_id: ID }
public struct ShopChanged has copy, drop { shop_id: ID, revision: u64 }
public struct ListingChanged has copy, drop { shop_id: ID, type_id: u64, revision: u64 }
public struct StockChanged has copy, drop { shop_id: ID, type_id: u64, quantity: u32, added: bool }
public struct Sale has copy, drop { shop_id: ID, ssu_id: ID, buyer: ID, type_id: u64, quantity: u32, currency: TypeName, paid: u64 }
public struct ProceedsClaimed has copy, drop { shop_id: ID, recipient: address, currency: TypeName, amount: u64 }

const EOwner: u64 = 0;
const ESender: u64 = 1;
const EStorage: u64 = 2;
const EOccupied: u64 = 3;
const EExists: u64 = 4;
const EConfig: u64 = 5;
const ERevision: u64 = 6;
const EAccess: u64 = 7;
const EClosed: u64 = 8;
const EQuantity: u64 = 9;
const EPayment: u64 = 10;
const ECurrency: u64 = 11;
const ETime: u64 = 12;
const ELimit: u64 = 13;
const EListing: u64 = 14;

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry { id: object::new(ctx), shops: table::new(ctx) });
}

/// Fresh, empty open pool only. Uses the pinned native Inventory BCS layout:
/// u64 capacity, u64 used_capacity, VecMap entries. Empty = capacity ++ 0u64 ++ 0u8.
/// Exact comparison also rejects zero-volume items. A layout change fails closed.
fun assert_empty(ssu: &StorageUnit) {
    if (!su::has_open_storage(ssu)) return;
    let inv = su::inventory(ssu, su::open_storage_key(ssu));
    let mut expected = bcs::to_bytes(&inventory::max_capacity(inv));
    expected.append(bcs::to_bytes(&0u64)); expected.push_back(0);
    assert!(bcs::to_bytes(inv) == expected, EOccupied);
}

public fun create(registry: &mut Registry, ssu: &mut StorageUnit,
    cap: &OwnerCap<StorageUnit>, name: String, ctx: &mut TxContext): Shop {
    canonical(ssu, cap);
    let sid = object::id(ssu);
    assert!(!table::contains(&registry.shops, sid), EExists);
    assert_empty(ssu); valid_name(&name);
    let shop = Shop { id: object::new(ctx), ssu_id: sid, owner_cap_id: object::id(cap),
        revision: 0, name, open: false, mode: 0, tribes: vector[], pilots: vector[], deny: vector[],
        listings: vector[], purchases: table::new(ctx), proceeds: bag::new(ctx) };
    table::add(&mut registry.shops, sid, object::id(&shop));
    su::authorize_extension<StorefrontAuth>(ssu, cap);
    event::emit(ShopCreated { shop_id: object::id(&shop), ssu_id: sid });
    shop
}
public fun share_shop(shop: Shop) { transfer::share_object(shop) }

/// Modes 0 closed, 1 tribes, 2 pilots, 3 tribes or pilots, 4 public. Deny always wins.
public fun configure(shop: &mut Shop, cap: &OwnerCap<StorageUnit>, revision: u64,
    name: String, open: bool, mode: u8, tribes: vector<u32>, pilots: vector<ID>, deny: vector<ID>) {
    owner(shop, cap); assert!(shop.revision == revision, ERevision); valid_name(&name);
    assert!(mode <= 4 && tribes.length() <= 32 && pilots.length() <= 128 && deny.length() <= 128, EConfig);
    unique(&tribes); unique(&pilots); unique(&deny); assert!(!tribes.contains(&0), EConfig);
    if (mode == 0 || mode == 4) assert!(tribes.is_empty() && pilots.is_empty(), EConfig);
    if (mode == 1) assert!(!tribes.is_empty() && pilots.is_empty(), EConfig);
    if (mode == 2) assert!(tribes.is_empty(), EConfig);
    shop.name = name; shop.open = open; shop.mode = mode; shop.tribes = tribes;
    shop.pilots = pilots; shop.deny = deny; shop.revision = shop.revision + 1;
    event::emit(ShopChanged { shop_id: object::id(shop), revision: shop.revision });
}

/// Currency immutable per item type. Removing/recreating listings never resets purchase limits.
/// revision=0 creates; updates require the exact existing nonzero revision.
public fun set_listing<T>(shop: &mut Shop, cap: &OwnerCap<StorageUnit>, type_id: u64,
    revision: u64, price: u64, enabled: bool, minimum: u32, maximum: u32, step: u32,
    starts_at: u64, ends_at: u64, per_pilot: u64) {
    owner(shop, cap);
    assert!(type_id > 0 && price > 0 && minimum > 0 && maximum >= minimum && step > 0, EConfig);
    assert!(minimum % step == 0 && maximum % step == 0, EConfig);
    assert!(ends_at == 0 || ends_at > starts_at, EConfig);
    assert!(per_pilot == 0 || per_pilot >= (minimum as u64), EConfig);
    assert!((price as u128) * (maximum as u128) <= 18446744073709551615, EConfig);
    let mut i = 0;
    while (i < shop.listings.length() && shop.listings[i].type_id != type_id) i = i + 1;
    if (i == shop.listings.length()) {
        assert!(revision == 0 && i < 100, EListing);
        shop.listings.push_back(Listing { type_id, currency: type_name::with_defining_ids<T>(), price,
            stock: 0, revision: 0, enabled, minimum, maximum, step, starts_at, ends_at, per_pilot });
    };
    let l = &mut shop.listings[i];
    assert!(l.revision == revision, ERevision);
    assert!(l.currency == type_name::with_defining_ids<T>(), ECurrency);
    l.price = price; l.enabled = enabled; l.minimum = minimum; l.maximum = maximum; l.step = step;
    l.starts_at = starts_at; l.ends_at = ends_at; l.per_pilot = per_pilot; l.revision = revision + 1;
    event::emit(ListingChanged { shop_id: object::id(shop), type_id, revision: revision + 1 });
}

public fun stock_owner(shop: &mut Shop, ssu: &mut StorageUnit, cap: &OwnerCap<StorageUnit>,
    character: &Character, type_id: u64, quantity: u32, ctx: &mut TxContext) {
    linked(shop, ssu); owner(shop, cap); canonical(ssu, cap); caller(character, ctx);
    assert!(quantity > 0, EQuantity);
    let i = index(shop, type_id);
    let item = su::withdraw_by_owner<StorageUnit>(ssu, character, cap, type_id, quantity, ctx);
    su::deposit_to_open_inventory(ssu, character, item, StorefrontAuth {}, ctx);
    shop.listings[i].stock = shop.listings[i].stock + quantity;
    event::emit(StockChanged { shop_id: object::id(shop), type_id, quantity, added: true });
}
public fun stock_personal(shop: &mut Shop, ssu: &mut StorageUnit, cap: &OwnerCap<StorageUnit>,
    character: &Character, character_cap: &OwnerCap<Character>, type_id: u64, quantity: u32, ctx: &mut TxContext) {
    linked(shop, ssu); owner(shop, cap); canonical(ssu, cap); caller(character, ctx);
    assert!(object::id(character_cap) == character::owner_cap_id(character)
        && access::is_authorized(character_cap, object::id(character)), EOwner);
    assert!(quantity > 0, EQuantity);
    let i = index(shop, type_id);
    let item = su::withdraw_by_owner<Character>(ssu, character, character_cap, type_id, quantity, ctx);
    su::deposit_to_open_inventory(ssu, character, item, StorefrontAuth {}, ctx);
    shop.listings[i].stock = shop.listings[i].stock + quantity;
    event::emit(StockChanged { shop_id: object::id(shop), type_id, quantity, added: true });
}
public fun unstock(shop: &mut Shop, ssu: &mut StorageUnit, cap: &OwnerCap<StorageUnit>,
    character: &Character, type_id: u64, quantity: u32, ctx: &mut TxContext) {
    linked(shop, ssu); owner(shop, cap); canonical(ssu, cap); caller(character, ctx);
    let i = index(shop, type_id);
    assert!(quantity > 0 && quantity <= shop.listings[i].stock, EQuantity);
    deliver(ssu, character, type_id, quantity, ctx);
    shop.listings[i].stock = shop.listings[i].stock - quantity;
    event::emit(StockChanged { shop_id: object::id(shop), type_id, quantity, added: false });
}
public fun buy<T>(shop: &mut Shop, ssu: &mut StorageUnit, character: &Character,
    type_id: u64, quantity: u32, shop_revision: u64, listing_revision: u64,
    payment: Coin<T>, clock: &Clock, ctx: &mut TxContext) {
    linked(shop, ssu); caller(character, ctx);
    assert!(shop.revision == shop_revision, ERevision);
    assert!(shop.open, EClosed);
    let cid = object::id(character);
    assert!(permits(shop, cid, character::tribe(character)), EAccess);
    let i = index(shop, type_id);
    let l = &shop.listings[i];
    assert!(l.revision == listing_revision, ERevision);
    assert!(l.enabled, EClosed);
    assert!(l.currency == type_name::with_defining_ids<T>(), ECurrency);
    let now = clock::timestamp_ms(clock);
    assert!(now >= l.starts_at && (l.ends_at == 0 || now < l.ends_at), ETime);
    assert!(quantity >= l.minimum && quantity <= l.maximum && quantity % l.step == 0 && quantity <= l.stock, EQuantity);
    let key = PurchaseKey { type_id, character_id: cid };
    let purchased = if (table::contains(&shop.purchases, key)) *table::borrow(&shop.purchases, key) else 0;
    let total = purchased + (quantity as u64);
    assert!(l.per_pilot == 0 || total <= l.per_pilot, ELimit);
    let paid = l.price * (quantity as u64);
    assert!(coin::value(&payment) == paid, EPayment);
    deliver(ssu, character, type_id, quantity, ctx);
    shop.listings[i].stock = shop.listings[i].stock - quantity;
    if (table::contains(&shop.purchases, key)) *table::borrow_mut(&mut shop.purchases, key) = total
    else table::add(&mut shop.purchases, key, total);
    let currency = type_name::with_defining_ids<T>();
    if (!bag::contains(&shop.proceeds, currency)) bag::add(&mut shop.proceeds, currency, balance::zero<T>());
    balance::join(bag::borrow_mut<TypeName, Balance<T>>(&mut shop.proceeds, currency), coin::into_balance(payment));
    event::emit(Sale { shop_id: object::id(shop), ssu_id: shop.ssu_id, buyer: cid, type_id, quantity, currency, paid });
}
/// Proceeds belong to the canonical SSU capability, not a cached seller address.
public fun claim<T>(shop: &mut Shop, cap: &OwnerCap<StorageUnit>, ctx: &mut TxContext) {
    owner(shop, cap);
    let currency = type_name::with_defining_ids<T>();
    let funds = bag::remove<TypeName, Balance<T>>(&mut shop.proceeds, currency);
    let amount = balance::value(&funds);
    transfer::public_transfer(coin::from_balance(funds, ctx), ctx.sender());
    event::emit(ProceedsClaimed { shop_id: object::id(shop), recipient: ctx.sender(), currency, amount });
}
fun deliver(ssu: &mut StorageUnit, character: &Character, type_id: u64, quantity: u32, ctx: &mut TxContext) {
    let item = su::withdraw_from_open_inventory(ssu, character, StorefrontAuth {}, type_id, quantity, ctx);
    su::deposit_to_owned(ssu, character, item, StorefrontAuth {}, ctx);
}
fun canonical(ssu: &StorageUnit, cap: &OwnerCap<StorageUnit>) {
    assert!(object::id(cap) == su::owner_cap_id(ssu) && access::is_authorized(cap, object::id(ssu)), EOwner);
}
fun owner(shop: &Shop, cap: &OwnerCap<StorageUnit>) {
    assert!(object::id(cap) == shop.owner_cap_id && access::is_authorized(cap, shop.ssu_id), EOwner);
}
fun caller(c: &Character, ctx: &TxContext) { assert!(character::character_address(c) == ctx.sender(), ESender); }
fun linked(shop: &Shop, ssu: &StorageUnit) { assert!(shop.ssu_id == object::id(ssu) && shop.owner_cap_id == su::owner_cap_id(ssu), EStorage); }
fun valid_name(name: &String) { assert!(name.length() > 0 && name.length() <= 80, EConfig); }
fun unique<T: copy + drop>(values: &vector<T>) {
    let mut i = 0;
    while (i < values.length()) { let mut j = i + 1;
        while (j < values.length()) { assert!(values[i] != values[j], EConfig); j = j + 1; }; i = i + 1; };
}
fun index(shop: &Shop, type_id: u64): u64 {
    let mut i = 0;
    while (i < shop.listings.length()) { if (shop.listings[i].type_id == type_id) return i; i = i + 1; };
    abort EListing
}
public fun permits(shop: &Shop, cid: ID, tribe: u32): bool {
    if (shop.deny.contains(&cid) || shop.mode == 0) return false;
    shop.mode == 4 || ((shop.mode == 1 || shop.mode == 3) && shop.tribes.contains(&tribe))
        || ((shop.mode == 2 || shop.mode == 3) && shop.pilots.contains(&cid))
}
public fun shop_id(registry: &Registry, sid: ID): ID { *table::borrow(&registry.shops, sid) }
public fun stock(shop: &Shop, type_id: u64): u32 { shop.listings[index(shop, type_id)].stock }
public fun proceeds<T>(shop: &Shop): u64 {
    let key = type_name::with_defining_ids<T>();
    if (bag::contains(&shop.proceeds, key)) balance::value(bag::borrow<TypeName, Balance<T>>(&shop.proceeds, key)) else 0
}
#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
