/// Pair-wide gate access. Native permits are single-use and direction-agnostic.
/// No function exports GateAuth. All funds and policies are independent of CradleOS core.
module cradleos_gate::route;

use std::{string::String, type_name};
use sui::{balance::{Self, Balance}, clock::{Self, Clock}, coin::{Self, Coin},
    event, table::{Self, Table}};
use world::{access::{Self, OwnerCap}, character::{Self, Character},
    energy::EnergyConfig, gate::{Self, Gate}, network_node::NetworkNode};

public struct GateAuth has drop {}
public struct Registry has key { id: UID, routes: Table<ID, ID>, history: Table<ID, bool> }
public struct Rules has store, drop, copy {
    mode: u8, member_tribe: u32, allies: vector<u32>, pilots: vector<ID>,
    denied_tribes: vector<u32>, denied_pilots: vector<ID>,
    starts_at: u64, ends_at: u64, daily_start: u64, daily_end: u64,
}
public struct Rates has store, drop, copy {
    toll: u64, pass_price: u64, pass_duration: u64, member_discount_bps: u64,
}
public struct Activity has store, drop, copy {
    kind: u8, character: ID, paid: u64, timestamp_ms: u64, expires_at: u64,
}
public struct Route<phantom T> has key {
    id: UID, gate_a: ID, gate_b: ID, cap_a: ID, cap_b: ID, name: String,
    active: bool, locked: bool, revision: u64, rules: Rules, rates: Rates,
    passes: Table<ID, u64>, proceeds: Balance<T>,
    permits_issued: u64, passes_sold: u64, collected: u128, claimed: u128,
    activity: vector<Activity>,
}
public struct RouteCreated has copy, drop { route_id: ID, gate_a: ID, gate_b: ID }
public struct Changed has copy, drop { route_id: ID, revision: u64, active: bool, locked: bool }
public struct PermitIssued has copy, drop {
    route_id: ID, character: ID, permit_id: ID, paid: u64, expires_at: u64,
}
public struct PassPurchased has copy, drop { route_id: ID, character: ID, paid: u64, expires_at: u64 }
public struct Claimed has copy, drop { route_id: ID, recipient: address, amount: u64 }

const EOwner: u64 = 0;
const EPair: u64 = 1;
const ERegistry: u64 = 2;
const EConfig: u64 = 3;
const ERevision: u64 = 4;
const EClosed: u64 = 5;
const EAccess: u64 = 6;
const EPayment: u64 = 7;
const ETime: u64 = 8;
const ESender: u64 = 9;
const EPass: u64 = 10;
const EExtension: u64 = 11;
const EOffline: u64 = 12;
const DAY: u64 = 86400000;
const MAX_PASS: u64 = 2592000000;
const PERMIT_MS: u64 = 60000;

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry { id: object::new(ctx), routes: table::new(ctx), history: table::new(ctx) });
}

/// Modes 0 closed, 1 tribe, 2 tribe+allies, 3 named pilots, 4 public.
/// Denies win; explicit allowed pilots may supplement modes 1/2. Closed denies all.
/// Equal daily endpoints mean all day. Otherwise UTC minutes, including overnight windows.
public fun rules(mode: u8, member_tribe: u32, allies: vector<u32>, pilots: vector<ID>,
    denied_tribes: vector<u32>, denied_pilots: vector<ID>,
    starts_at: u64, ends_at: u64, daily_start: u64, daily_end: u64): Rules {
    assert!(mode <= 4 && allies.length() <= 32 && denied_tribes.length() <= 32
        && pilots.length() <= 128 && denied_pilots.length() <= 128, EConfig);
    assert!(!allies.contains(&0) && !denied_tribes.contains(&0), EConfig);
    unique(&allies); unique(&pilots); unique(&denied_tribes); unique(&denied_pilots);
    assert!((mode != 1 && mode != 2) || member_tribe != 0, EConfig);
    assert!(daily_start < 1440 && daily_end < 1440 && (ends_at == 0 || ends_at > starts_at), EConfig);
    Rules { mode, member_tribe, allies, pilots, denied_tribes, denied_pilots,
        starts_at, ends_at, daily_start, daily_end }
}
public fun rates(toll: u64, pass_price: u64, pass_duration: u64, member_discount_bps: u64): Rates {
    assert!(member_discount_bps <= 10000, EConfig);
    assert!((pass_duration == 0 && pass_price == 0) ||
        (pass_duration >= 300000 && pass_duration <= MAX_PASS), EConfig);
    Rates { toll, pass_price, pass_duration, member_discount_bps }
}

/// Activation requires both canonical gate capabilities, a current reciprocal link,
/// and no existing extension. Existing protected gates must be explicitly deactivated first.
public fun create<T>(registry: &mut Registry, a: &mut Gate, b: &mut Gate,
    ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>, name: String, ctx: &mut TxContext): Route<T> {
    canonical(a, ca); canonical(b, cb); valid_name(&name);
    assert!(object::id(a) != object::id(b) && gate::are_gates_linked(a, b)
        && tenant(a) == tenant(b), EPair);
    assert!(!gate::is_extension_configured(a) && !gate::is_extension_configured(b), EExtension);
    let ga = object::id(a); let gb = object::id(b);
    assert!(!table::contains(&registry.routes, ga) && !table::contains(&registry.routes, gb), ERegistry);
    let r = Route<T> { id: object::new(ctx), gate_a: ga, gate_b: gb,
        cap_a: object::id(ca), cap_b: object::id(cb), name, active: true, locked: true, revision: 0,
        rules: rules(0, 0, vector[], vector[], vector[], vector[], 0, 0, 0, 0),
        rates: rates(0, 0, 0, 0), passes: table::new(ctx), proceeds: balance::zero(),
        permits_issued: 0, passes_sold: 0, collected: 0, claimed: 0, activity: vector[] };
    table::add(&mut registry.routes, ga, object::id(&r));
    table::add(&mut registry.routes, gb, object::id(&r));
    table::add(&mut registry.history, object::id(&r), true);
    gate::authorize_extension<GateAuth>(a, ca); gate::authorize_extension<GateAuth>(b, cb);
    event::emit(RouteCreated { route_id: object::id(&r), gate_a: ga, gate_b: gb });
    r
}
public fun share<T>(r: Route<T>) { transfer::share_object(r) }

public fun configure<T>(r: &mut Route<T>, ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>,
    revision: u64, name: String, rules: Rules, rates: Rates) {
    owner(r, ca, cb); exact(r, revision); valid_name(&name); assert!(r.active, EClosed);
    r.name = name; r.rules = rules; r.rates = rates; changed(r);
}
/// Pauses issuance; existing permits remain valid until their expiry.
public fun set_locked<T>(r: &mut Route<T>, ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>,
    revision: u64, locked: bool) {
    owner(r, ca, cb); exact(r, revision); assert!(r.active, EClosed);
    r.locked = locked; changed(r);
}
/// Hard lockdown: taking one endpoint offline prevents ALL native jumps, including
/// already-issued permits. UI must call this atomic path, not just set_locked.
public fun lockdown<T>(r: &mut Route<T>, a: &mut Gate, b: &Gate,
    ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>, parent: &mut NetworkNode,
    energy: &EnergyConfig, revision: u64) {
    owner(r, ca, cb); exact(r, revision); pair(r, a, b); assert!(r.active, EClosed);
    r.locked = true;
    if (gate::is_online(a)) gate::offline(a, parent, energy, ca);
    changed(r);
}
/// Explicit owner action restores public transit on both gates. Old passes remain
/// readable but inactive. Proceeds can still be claimed with the same capabilities.
public fun deactivate<T>(registry: &mut Registry, r: &mut Route<T>, a: &mut Gate, b: &mut Gate,
    ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>, revision: u64) {
    owner(r, ca, cb); exact(r, revision); pair(r, a, b); registered(registry, r);
    assert!(r.active, EClosed);
    // Only revoke this extension, never a later unrelated owner configuration.
    if (ours(a)) gate::revoke_extension_authorization(a, ca);
    if (ours(b)) gate::revoke_extension_authorization(b, cb);
    table::remove(&mut registry.routes, r.gate_a); table::remove(&mut registry.routes, r.gate_b);
    r.active = false; r.locked = true; changed(r);
}

public fun buy_pass<T>(registry: &Registry, r: &mut Route<T>, a: &Gate, b: &Gate,
    c: &Character, revision: u64, payment: Coin<T>, clock: &Clock, ctx: &mut TxContext) {
    let now = clock::timestamp_ms(clock);
    ready(registry, r, a, b, c, revision, now, ctx);
    assert!(r.rates.pass_duration != 0 && pass_until(r, object::id(c)) <= now, EPass);
    let paid = discounted(r.rates.pass_price, r, character::tribe(c));
    assert!(coin::value(&payment) == paid, EPayment);
    let expiry = now + r.rates.pass_duration;
    // A pass may span closed daily windows, but not the route's absolute end.
    assert!(r.rules.ends_at == 0 || expiry <= r.rules.ends_at, ETime);
    let cid = object::id(c);
    if (table::contains(&r.passes, cid)) *table::borrow_mut(&mut r.passes, cid) = expiry
    else table::add(&mut r.passes, cid, expiry);
    balance::join(&mut r.proceeds, coin::into_balance(payment));
    r.collected = r.collected + (paid as u128); r.passes_sold = r.passes_sold + 1;
    record(r, 1, cid, paid, now, expiry);
    event::emit(PassPurchased { route_id: object::id(r), character: cid, paid, expires_at: expiry });
}

public fun request_permit<T>(registry: &Registry, r: &mut Route<T>, a: &Gate, b: &Gate,
    c: &Character, revision: u64, payment: Coin<T>, clock: &Clock, ctx: &mut TxContext) {
    let now = clock::timestamp_ms(clock);
    ready(registry, r, a, b, c, revision, now, ctx);
    let cid = object::id(c); let until = pass_until(r, cid);
    let paid = if (until > now) 0 else discounted(r.rates.toll, r, character::tribe(c));
    assert!(coin::value(&payment) == paid, EPayment);
    let mut expiry = window_end(&r.rules, now).min(now + PERMIT_MS);
    if (until > now) expiry = expiry.min(until);
    assert!(expiry > now, ETime);
    let permit_id = gate::issue_jump_permit_with_id<GateAuth>(a, b, c, GateAuth {}, expiry, ctx);
    balance::join(&mut r.proceeds, coin::into_balance(payment));
    r.collected = r.collected + (paid as u128); r.permits_issued = r.permits_issued + 1;
    record(r, 0, cid, paid, now, expiry);
    event::emit(PermitIssued { route_id: object::id(r), character: cid, permit_id, paid, expires_at: expiry });
}
public fun claim<T>(r: &mut Route<T>, ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>, ctx: &mut TxContext) {
    owner(r, ca, cb);
    let amount = balance::value(&r.proceeds);
    r.claimed = r.claimed + (amount as u128);
    transfer::public_transfer(coin::from_balance(balance::withdraw_all(&mut r.proceeds), ctx), ctx.sender());
    event::emit(Claimed { route_id: object::id(r), recipient: ctx.sender(), amount });
}

public fun permits(r: &Rules, cid: ID, tribe: u32): bool {
    if (r.mode == 0 || r.denied_pilots.contains(&cid) || (tribe != 0 && r.denied_tribes.contains(&tribe))) return false;
    if (r.mode == 4 || r.pilots.contains(&cid)) return true;
    if (r.mode == 3) return false;
    if (tribe != 0 && tribe == r.member_tribe) return true;
    r.mode == 2 && tribe != 0 && r.allies.contains(&tribe)
}
public fun pass_until<T>(r: &Route<T>, cid: ID): u64 {
    if (table::contains(&r.passes, cid)) *table::borrow(&r.passes, cid) else 0
}
/// Returns the current open interval's end. Throws outside an open interval.
public fun window_end(r: &Rules, now: u64): u64 {
    assert!(now >= r.starts_at && (r.ends_at == 0 || now < r.ends_at), ETime);
    let mut end = if (r.ends_at == 0) 18446744073709551615 else r.ends_at;
    if (r.daily_start != r.daily_end) {
        let start = r.daily_start * 60000; let stop = r.daily_end * 60000;
        let day = now / DAY * DAY; let time = now % DAY;
        if (start < stop) { assert!(time >= start && time < stop, ETime); end = end.min(day + stop); }
        else { assert!(time >= start || time < stop, ETime);
            end = end.min(if (time >= start) day + DAY + stop else day + stop); };
    };
    end
}
fun discounted<T>(price: u64, r: &Route<T>, tribe: u32): u64 {
    let bps = if (tribe != 0 && tribe == r.rules.member_tribe) r.rates.member_discount_bps else 0;
    // Round UP after discount so a positive tariff never silently becomes free.
    ((((price as u128) * ((10000 - bps) as u128)) + 9999) / 10000) as u64
}
fun caller(c: &Character, ctx: &TxContext) { assert!(character::character_address(c) == ctx.sender(), ESender) }
fun canonical(g: &Gate, cap: &OwnerCap<Gate>) {
    assert!(object::id(cap) == gate::owner_cap_id(g) && access::is_authorized(cap, object::id(g)), EOwner);
}
fun owner<T>(r: &Route<T>, ca: &OwnerCap<Gate>, cb: &OwnerCap<Gate>) {
    assert!(object::id(ca) == r.cap_a && object::id(cb) == r.cap_b
        && access::is_authorized(ca, r.gate_a) && access::is_authorized(cb, r.gate_b), EOwner);
}
fun pair<T>(r: &Route<T>, a: &Gate, b: &Gate) {
    assert!(object::id(a) == r.gate_a && object::id(b) == r.gate_b
        && gate::owner_cap_id(a) == r.cap_a && gate::owner_cap_id(b) == r.cap_b, EPair);
}
fun registered<T>(registry: &Registry, r: &Route<T>) {
    assert!(table::contains(&registry.routes, r.gate_a) && table::contains(&registry.routes, r.gate_b), ERegistry);
    assert!(*table::borrow(&registry.routes, r.gate_a) == object::id(r)
        && *table::borrow(&registry.routes, r.gate_b) == object::id(r), ERegistry);
}
fun ours(g: &Gate): bool {
    option::contains(gate::extension_type(g), &type_name::with_defining_ids<GateAuth>())
}
fun ready<T>(registry: &Registry, r: &Route<T>, a: &Gate, b: &Gate, c: &Character,
    revision: u64, now: u64, ctx: &TxContext) {
    caller(c, ctx); exact(r, revision); pair(r, a, b); registered(registry, r);
    assert!(r.active && !r.locked, EClosed);
    assert!(gate::are_gates_linked(a, b), EPair);
    assert!(ours(a) && ours(b), EExtension);
    assert!(gate::is_online(a) && gate::is_online(b), EOffline);
    assert!(character::tenant(c) == tenant(a) && character::tenant(c) == tenant(b), EPair);
    assert!(permits(&r.rules, object::id(c), character::tribe(c)), EAccess);
    let _ = window_end(&r.rules, now);
}
/// Gate has no public key getter. Decode ONLY the stable prefix of the pinned
/// native public layout: UID(address), TenantItemId(u64, String). Sui compatible
/// upgrades cannot alter this layout. No client-provided tenant is trusted.
fun tenant(g: &Gate): String {
    let mut bytes = sui::bcs::new(std::bcs::to_bytes(g));
    let _ = bytes.peel_address(); let _ = bytes.peel_u64();
    std::string::utf8(bytes.peel_vec!(|b| b.peel_u8()))
}
fun exact<T>(r: &Route<T>, revision: u64) { assert!(r.revision == revision, ERevision) }
fun valid_name(name: &String) { assert!(name.length() > 0 && name.length() <= 80, EConfig) }
fun unique<T: copy + drop + store>(values: &vector<T>) {
    let mut i = 0;
    while (i < values.length()) { let mut j = i + 1;
        while (j < values.length()) { assert!(values[i] != values[j], EConfig); j = j + 1; }; i = i + 1; };
}
fun changed<T>(r: &mut Route<T>) {
    r.revision = r.revision + 1;
    event::emit(Changed { route_id: object::id(r), revision: r.revision, active: r.active, locked: r.locked });
}
fun record<T>(r: &mut Route<T>, kind: u8, character: ID, paid: u64, timestamp_ms: u64, expires_at: u64) {
    if (r.activity.length() >= 20) { r.activity.remove(0); };
    r.activity.push_back(Activity { kind, character, paid, timestamp_ms, expires_at });
}
#[test_only] public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
#[test_only] public fun totals<T>(r: &Route<T>): vector<u128> {
    vector[r.permits_issued as u128, r.passes_sold as u128, r.collected, r.claimed, balance::value(&r.proceeds) as u128]
}
