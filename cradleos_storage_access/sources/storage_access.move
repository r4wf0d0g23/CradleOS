/// Isolated replacement for the quarantined ssu_access extension.
/// This module never exports its witness or an Item. Owner-main ingress requires the canonical SSU capability.
/// Transfers stay within the SAME storage unit. Personal transfers and canonical
/// owner-main deposits never expose Item values. Existing stock is not migrated.
module cradleos_storage_access::storage_access;

use sui::{clock::{Self, Clock}, event, table::{Self, Table}};
use world::{access::{Self, OwnerCap}, character::{Self, Character},
    storage_unit::{Self as su, StorageUnit}};

// Public type so the world can name it; construction is module-private.
public struct SharedAccess has drop {}
public struct AllowEntry has copy, drop, store {
    character_id: ID, expires_at: u64, can_deposit: bool, can_withdraw: bool,
}
public struct Policy has key {
    id: UID, ssu_id: ID, revision: u64, mode: u8,
    tribe_ids: vector<u32>, deny: vector<ID>, allow: vector<AllowEntry>,
}
public struct Registry has key { id: UID, policies: Table<ID, ID> }
public struct PolicyChanged has copy, drop { ssu_id: ID, policy_id: ID, revision: u64, mode: u8 }
public struct Transfer has copy, drop { ssu_id: ID, character_id: ID, type_id: u64, quantity: u32, to_shared: bool, owner_recovery: bool }
public struct OwnerDeposit has copy, drop { ssu_id: ID, character_id: ID, type_id: u64, quantity: u32 }

const EAccessDenied: u64 = 0;
const ESenderMismatch: u64 = 1;
const EInvalidConfig: u64 = 2;
const EWrongOwner: u64 = 3;
const EWrongStorage: u64 = 4;
const EAlreadyExists: u64 = 5;
const EListLimit: u64 = 6;
const EDuplicate: u64 = 7;
const EStaleRevision: u64 = 8;
const EWrongCharacterCap: u64 = 9;

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry { id: object::new(ctx), policies: table::new(ctx) });
}

/// One canonical, closed policy per SSU. Caller must finish the PTB by sharing it.
public fun create_policy(registry: &mut Registry, ssu: &StorageUnit,
    cap: &OwnerCap<StorageUnit>, ctx: &mut TxContext): Policy {
    let ssu_id = object::id(ssu);
    assert!(access::is_authorized(cap, ssu_id), EWrongOwner);
    assert!(!table::contains(&registry.policies, ssu_id), EAlreadyExists);
    let policy = Policy { id: object::new(ctx), ssu_id, revision: 0, mode: 0,
        tribe_ids: vector[], deny: vector[], allow: vector[] };
    table::add(&mut registry.policies, ssu_id, object::id(&policy));
    emit_policy(&policy);
    policy
}
public fun share_policy(policy: Policy) { transfer::share_object(policy) }

/// Modes: 0 closed; 1 tribes; 2 pilots; 3 tribes + pilots, deny wins; 4 public.
/// Expiry is exclusive: now >= expires_at is expired. Zero means no expiry.
/// A matching allow entry is authoritative, including its direction/expiry;
/// it cannot silently fall back to tribe permission in hybrid mode.
public fun configure(policy: &mut Policy, cap: &OwnerCap<StorageUnit>, expected_revision: u64,
    mode: u8, tribe_ids: vector<u32>, deny: vector<ID>, ids: vector<ID>,
    expiries: vector<u64>, deposits: vector<bool>, withdrawals: vector<bool>) {
    assert!(access::is_authorized(cap, policy.ssu_id), EWrongOwner);
    assert!(policy.revision == expected_revision, EStaleRevision);
    validate(mode, &tribe_ids, &deny, &ids, &expiries, &deposits, &withdrawals);
    let mut allow = vector[];
    ids.do_ref!(|cid| {
        let i = allow.length();
        allow.push_back(AllowEntry { character_id: *cid, expires_at: expiries[i],
            can_deposit: deposits[i], can_withdraw: withdrawals[i] });
    });
    policy.mode = mode; policy.tribe_ids = tribe_ids; policy.deny = deny; policy.allow = allow;
    policy.revision = policy.revision + 1;
    emit_policy(policy);
}

/// Explicit replacement, NOT compare-and-swap: official StorageUnit exposes no
/// binding getter. Owners must approve replacement of ANY current extension and
/// the policy's access to ALL current/future shared stock. Never called on mount.
public fun authorize(policy: &Policy, ssu: &mut StorageUnit, cap: &OwnerCap<StorageUnit>) {
    assert!(policy.ssu_id == object::id(ssu), EWrongStorage);
    su::authorize_extension<SharedAccess>(ssu, cap);
}

public fun withdraw(ssu: &mut StorageUnit, policy: &Policy, character: &Character,
    type_id: u64, quantity: u32, clock: &Clock, ctx: &mut TxContext) {
    check_caller(ssu, policy, character, ctx);
    assert!(permits(policy, character::id(character), character::tribe(character), clock::timestamp_ms(clock), true), EAccessDenied);
    withdraw_to_personal(ssu, character, type_id, quantity, false, ctx);
}

public fun deposit(ssu: &mut StorageUnit, policy: &Policy, character: &Character,
    character_cap: &OwnerCap<Character>, type_id: u64, quantity: u32,
    clock: &Clock, ctx: &mut TxContext) {
    check_caller(ssu, policy, character, ctx);
    assert!(access::is_authorized(character_cap, character::id(character)), EWrongCharacterCap);
    assert!(object::id(character_cap) == character::owner_cap_id(character), EWrongCharacterCap);
    assert!(permits(policy, character::id(character), character::tribe(character), clock::timestamp_ms(clock), false), EAccessDenied);
    let item = su::withdraw_by_owner<Character>(ssu, character, character_cap, type_id, quantity, ctx);
    su::deposit_to_open_inventory<SharedAccess>(ssu, character, item, SharedAccess {}, ctx);
    event::emit(Transfer { ssu_id: object::id(ssu), character_id: character::id(character), type_id,
        quantity, to_shared: true, owner_recovery: false });
}

/// Canonical owner-main -> same-unit shared pool, atomically. Existing ingress
/// rules apply; owning the SSU does not bypass closed/denied/expired policies.
public fun deposit_owner(ssu: &mut StorageUnit, policy: &Policy, character: &Character,
    cap: &OwnerCap<StorageUnit>, type_id: u64, quantity: u32,
    clock: &Clock, ctx: &mut TxContext) {
    check_caller(ssu, policy, character, ctx);
    assert!(access::is_authorized(cap, object::id(ssu)), EWrongOwner);
    assert!(object::id(cap) == su::owner_cap_id(ssu), EWrongOwner);
    assert!(permits(policy, character::id(character), character::tribe(character), clock::timestamp_ms(clock), false), EAccessDenied);
    let item = su::withdraw_by_owner<StorageUnit>(ssu, character, cap, type_id, quantity, ctx);
    su::deposit_to_open_inventory<SharedAccess>(ssu, character, item, SharedAccess {}, ctx);
    event::emit(OwnerDeposit { ssu_id: object::id(ssu), character_id: object::id(character), type_id, quantity });
}

/// Closed policies retain an explicit owner-cap recovery path, to the owner's
/// personal partition only. This cannot take owner-main or other pilots' stock.
public fun recover_shared(ssu: &mut StorageUnit, cap: &OwnerCap<StorageUnit>,
    character: &Character, type_id: u64, quantity: u32, ctx: &mut TxContext) {
    assert!(access::is_authorized(cap, object::id(ssu)), EWrongOwner);
    assert!(character::character_address(character) == ctx.sender(), ESenderMismatch);
    withdraw_to_personal(ssu, character, type_id, quantity, true, ctx);
}

fun withdraw_to_personal(ssu: &mut StorageUnit, character: &Character,
    type_id: u64, quantity: u32, owner_recovery: bool, ctx: &mut TxContext) {
    let item = su::withdraw_from_open_inventory<SharedAccess>(ssu, character, SharedAccess {}, type_id, quantity, ctx);
    su::deposit_to_owned<SharedAccess>(ssu, character, item, SharedAccess {}, ctx);
    event::emit(Transfer { ssu_id: object::id(ssu), character_id: character::id(character),
        type_id, quantity, to_shared: false, owner_recovery });
}
fun check_caller(ssu: &StorageUnit, policy: &Policy, character: &Character, ctx: &TxContext) {
    assert!(policy.ssu_id == object::id(ssu), EWrongStorage);
    assert!(character::character_address(character) == ctx.sender(), ESenderMismatch);
}
fun emit_policy(policy: &Policy) {
    event::emit(PolicyChanged { ssu_id: policy.ssu_id, policy_id: object::id(policy), revision: policy.revision, mode: policy.mode });
}
fun unique<T: copy + drop>(values: &vector<T>) {
    let mut i = 0;
    while (i < values.length()) {
        let mut j = i + 1;
        while (j < values.length()) { assert!(values[i] != values[j], EDuplicate); j = j + 1; };
        i = i + 1;
    };
}
fun validate(mode: u8, tribes: &vector<u32>, deny: &vector<ID>, ids: &vector<ID>,
    expiries: &vector<u64>, deposits: &vector<bool>, withdrawals: &vector<bool>) {
    assert!(mode <= 4, EInvalidConfig);
    assert!(tribes.length() <= 32 && deny.length() <= 128 && ids.length() <= 128, EListLimit);
    assert!(ids.length() == expiries.length() && ids.length() == deposits.length() && ids.length() == withdrawals.length(), EInvalidConfig);
    unique(tribes); unique(deny); unique(ids);
    assert!(!tribes.contains(&0), EInvalidConfig);
    // Unused fields must be empty, so chain state and the editor cannot disagree.
    if (mode == 0 || mode == 4) assert!(tribes.is_empty() && deny.is_empty() && ids.is_empty(), EInvalidConfig);
    if (mode == 1) assert!(!tribes.is_empty() && deny.is_empty() && ids.is_empty(), EInvalidConfig);
    if (mode == 2) assert!(tribes.is_empty() && deny.is_empty(), EInvalidConfig);
    if (mode != 3) assert!(deny.is_empty(), EInvalidConfig);
}
public fun permits(policy: &Policy, cid: ID, tribe: u32, now: u64, withdraw: bool): bool {
    if (policy.mode == 0) return false;
    if (policy.mode == 4) return true;
    if (policy.mode == 1) return policy.tribe_ids.contains(&tribe);
    if (policy.deny.contains(&cid)) return false;
    let mut i = 0;
    while (i < policy.allow.length()) {
        let e = &policy.allow[i];
        if (e.character_id == cid) return (e.expires_at == 0 || now < e.expires_at)
            && (if (withdraw) e.can_withdraw else e.can_deposit);
        i = i + 1;
    };
    policy.mode == 3 && policy.tribe_ids.contains(&tribe)
}
public fun revision(policy: &Policy): u64 { policy.revision }
public fun policy_id(registry: &Registry, ssu_id: ID): ID { *table::borrow(&registry.policies, ssu_id) }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
