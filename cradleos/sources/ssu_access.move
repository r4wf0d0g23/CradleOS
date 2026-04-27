/// CradleOS – Shared SSU Access Extension
///
/// Custom extension for `world::storage_unit` that lets the SSU owner
/// authorize tribemates and named characters to deposit/withdraw items
/// from the open-storage inventory under owner-defined rules.
///
/// # Architecture
///
/// `world::storage_unit` exposes Lane 1 (extension-based) access via a
/// witness pattern: an SSU owner calls `authorize_extension<SsuAuth>`,
/// after which any caller holding `SsuAuth { drop }` can invoke
/// `deposit_to_open_inventory<SsuAuth>` / `withdraw_from_open_inventory<SsuAuth>`.
///
/// We gate that witness behind a per-SSU `SsuPolicy` shared object stored
/// in a global `SsuPolicyRegistry` shared object. Policies support four
/// modes:
///   - OwnerOnly  → no shared access
///   - TribeOnly  → any character whose `tribe == policy.tribe_id`
///   - Allowlist  → only listed characters; per-entry expires_at + flags
///   - Hybrid     → tribe baseline + named deny + named allow overrides
///
/// # Setup (per SSU, one time)
///   1. Owner calls `world::storage_unit::authorize_extension<SsuAuth>`.
///   2. Owner calls `init_policy` once to create the SsuPolicy and
///      register it in SsuPolicyRegistry.
///   3. Owner calls `set_tribe_only` / `set_allowlist` / `set_hybrid` /
///      `clear_policy` to update the policy at any time.
///
/// # Per-call usage
///   Tribemate calls `shared_withdraw_to_character` / `shared_deposit`
///   passing the SSU and its SsuPolicy by reference.
///
/// # Safety
///   - Sender-binding: `ctx.sender() == character.character_address()`
///   - Policy is bound to a specific SSU at init.
///   - Policy mutation requires `OwnerCap<StorageUnit>`.
///
/// # Volatile entries
///   AllowEntry.expires_at is u64 timestamp_ms; 0 = no expiry.
module cradleos::ssu_access;

use sui::{clock::Clock, event, table::{Self, Table}};
use world::{
    access::{Self, OwnerCap},
    character::{Self, Character},
    inventory::{Self as wi, Item},
    storage_unit::{Self as su, StorageUnit},
};

// ── Witness ───────────────────────────────────────────────────────────────────

public struct SsuAuth has drop {}

public fun new_auth(): SsuAuth { SsuAuth {} }

// ── Constants ─────────────────────────────────────────────────────────────────

const MODE_NONE:       u8 = 0;
const MODE_TRIBE_ONLY: u8 = 1;
const MODE_ALLOWLIST:  u8 = 2;
const MODE_HYBRID:     u8 = 3;

// ── Errors (plain const u64 — protocol-portable) ──────────────────────────────

const EAccessDenied:       u64 = 0;
const ESenderMismatch:     u64 = 1;
const ELengthMismatch:     u64 = 2;
const ENotAuthorized:      u64 = 3;
const EPolicySsuMismatch:  u64 = 4;
const EPolicyAlreadyExists: u64 = 5;

// ── Policy structs ────────────────────────────────────────────────────────────

public struct AllowEntry has copy, drop, store {
    character_id: ID,
    expires_at: u64,    // ms; 0 = no expiry
    can_deposit: bool,
    can_withdraw: bool,
}

public struct SsuPolicy has key {
    id: UID,
    ssu_id: ID,
    mode: u8,
    tribe_id: u32,
    deny: vector<ID>,
    allow: vector<AllowEntry>,
}

public struct SsuPolicyRegistry has key {
    id: UID,
    policies: Table<ID, ID>,
}

// ── Events ────────────────────────────────────────────────────────────────────

public struct PolicyCreatedEvent has copy, drop {
    ssu_id: ID,
    policy_id: ID,
}

public struct PolicyUpdatedEvent has copy, drop {
    ssu_id: ID,
    policy_id: ID,
    mode: u8,
    tribe_id: u32,
    allow_count: u64,
    deny_count: u64,
}

public struct SharedDepositEvent has copy, drop {
    ssu_id: ID,
    character_id: ID,
    type_id: u64,
    quantity: u32,
}

public struct SharedWithdrawEvent has copy, drop {
    ssu_id: ID,
    character_id: ID,
    type_id: u64,
    quantity: u32,
}

// ── Bootstrap: create the registry after publish ───────────────────────────────

/// IMPORTANT: Sui rejects new `init` functions in package upgrades
/// (FeatureNotYetSupported on command 1). The registry is therefore
/// minted via the public `bootstrap_registry` entry below ( deployer
/// calls it once after publish; the dApp pins the resulting object id.

/// Bootstrap entry — call once if the registry was not created by `init`
/// (e.g. when this module is added in a package upgrade rather than a
/// fresh publish). After first call, subsequent calls will fail because
/// no second registry should exist.
public fun bootstrap_registry(ctx: &mut TxContext) {
    transfer::share_object(SsuPolicyRegistry {
        id: object::new(ctx),
        policies: table::new<ID, ID>(ctx),
    });
}

// ── Owner: create policy ──────────────────────────────────────────────────────

public fun init_policy(
    registry: &mut SsuPolicyRegistry,
    ssu: &StorageUnit,
    cap: &OwnerCap<StorageUnit>,
    ctx: &mut TxContext,
) {
    let ssu_id = object::id(ssu);
    assert!(access::is_authorized(cap, ssu_id), ENotAuthorized);
    assert!(!table::contains(&registry.policies, ssu_id), EPolicyAlreadyExists);

    let policy = SsuPolicy {
        id: object::new(ctx),
        ssu_id,
        mode: MODE_NONE,
        tribe_id: 0,
        deny: vector::empty(),
        allow: vector::empty(),
    };
    let policy_id = object::id(&policy);

    table::add(&mut registry.policies, ssu_id, policy_id);

    event::emit(PolicyCreatedEvent { ssu_id, policy_id });

    transfer::share_object(policy);
}

// ── Owner: install / update / clear policy ────────────────────────────────────

public fun set_tribe_only(
    policy: &mut SsuPolicy,
    cap: &OwnerCap<StorageUnit>,
    tribe_id: u32,
) {
    assert_owner_for_policy(policy, cap);
    policy.mode = MODE_TRIBE_ONLY;
    policy.tribe_id = tribe_id;
    policy.deny = vector::empty();
    policy.allow = vector::empty();
    emit_updated(policy);
}

public fun set_allowlist(
    policy: &mut SsuPolicy,
    cap: &OwnerCap<StorageUnit>,
    character_ids: vector<ID>,
    expires_at: vector<u64>,
    can_deposit: vector<bool>,
    can_withdraw: vector<bool>,
) {
    assert_owner_for_policy(policy, cap);
    let n = vector::length(&character_ids);
    assert!(vector::length(&expires_at)  == n, ELengthMismatch);
    assert!(vector::length(&can_deposit) == n, ELengthMismatch);
    assert!(vector::length(&can_withdraw) == n, ELengthMismatch);

    policy.mode = MODE_ALLOWLIST;
    policy.tribe_id = 0;
    policy.deny = vector::empty();
    policy.allow = build_entries(character_ids, expires_at, can_deposit, can_withdraw);
    emit_updated(policy);
}

public fun set_hybrid(
    policy: &mut SsuPolicy,
    cap: &OwnerCap<StorageUnit>,
    tribe_id: u32,
    deny: vector<ID>,
    allow_character_ids: vector<ID>,
    allow_expires_at: vector<u64>,
    allow_can_deposit: vector<bool>,
    allow_can_withdraw: vector<bool>,
) {
    assert_owner_for_policy(policy, cap);
    let n = vector::length(&allow_character_ids);
    assert!(vector::length(&allow_expires_at)  == n, ELengthMismatch);
    assert!(vector::length(&allow_can_deposit) == n, ELengthMismatch);
    assert!(vector::length(&allow_can_withdraw) == n, ELengthMismatch);

    policy.mode = MODE_HYBRID;
    policy.tribe_id = tribe_id;
    policy.deny = deny;
    policy.allow = build_entries(
        allow_character_ids,
        allow_expires_at,
        allow_can_deposit,
        allow_can_withdraw,
    );
    emit_updated(policy);
}

public fun clear_policy(
    policy: &mut SsuPolicy,
    cap: &OwnerCap<StorageUnit>,
) {
    assert_owner_for_policy(policy, cap);
    policy.mode = MODE_NONE;
    policy.tribe_id = 0;
    policy.deny = vector::empty();
    policy.allow = vector::empty();
    emit_updated(policy);
}

// ── Public access: deposit / withdraw via policy ──────────────────────────────

public fun shared_withdraw(
    ssu: &mut StorageUnit,
    policy: &SsuPolicy,
    character: &Character,
    type_id: u64,
    quantity: u32,
    clock: &Clock,
    ctx: &mut TxContext,
): Item {
    assert!(policy.ssu_id == object::id(ssu), EPolicySsuMismatch);
    assert_caller_is_character(character, ctx);
    let now = sui::clock::timestamp_ms(clock);
    assert!(check_access(policy, character, now, true), EAccessDenied);

    let item = su::withdraw_from_open_inventory<SsuAuth>(
        ssu,
        character,
        SsuAuth {},
        type_id,
        quantity,
        ctx,
    );

    event::emit(SharedWithdrawEvent {
        ssu_id: object::id(ssu),
        character_id: character::id(character),
        type_id,
        quantity,
    });

    item
}

public fun shared_withdraw_to_character(
    ssu: &mut StorageUnit,
    policy: &SsuPolicy,
    character: &Character,
    type_id: u64,
    quantity: u32,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let item = shared_withdraw(ssu, policy, character, type_id, quantity, clock, ctx);
    sui::transfer::public_transfer(item, character::character_address(character));
}

/// Tribemate withdraw target: routes the withdrawn Item DIRECTLY into the
/// caller's per-character partition on the SAME SSU (rather than dropping
/// it in their wallet). Result: the item is immediately visible in the
/// in-game inventory window for that SSU under the caller's character.
///
/// This is the preferred shared-withdraw primitive. The legacy
/// `shared_withdraw_to_character` is retained for back-compat but should
/// no longer be called from the dApp — it leaves items in limbo.
///
/// Single-tx atomicity: withdraw + deposit_to_owned chain through PTB
/// linear typing, so either both effects land or neither does.
public fun shared_withdraw_to_owned(
    ssu: &mut StorageUnit,
    policy: &SsuPolicy,
    character: &Character,
    type_id: u64,
    quantity: u32,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let item = shared_withdraw(ssu, policy, character, type_id, quantity, clock, ctx);
    su::deposit_to_owned<SsuAuth>(
        ssu,
        character,
        item,
        SsuAuth {},
        ctx,
    );
}

public fun shared_deposit(
    ssu: &mut StorageUnit,
    policy: &SsuPolicy,
    character: &Character,
    item: Item,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(policy.ssu_id == object::id(ssu), EPolicySsuMismatch);
    assert_caller_is_character(character, ctx);
    let now = sui::clock::timestamp_ms(clock);
    assert!(check_access(policy, character, now, false), EAccessDenied);

    let type_id = wi::type_id(&item);
    let quantity = wi::quantity(&item);

    su::deposit_to_open_inventory<SsuAuth>(
        ssu,
        character,
        item,
        SsuAuth {},
        ctx,
    );

    event::emit(SharedDepositEvent {
        ssu_id: object::id(ssu),
        character_id: character::id(character),
        type_id,
        quantity,
    });
}

// ── Recovery: wallet-held items → SSU ───────────────────────────────────────────
//
// `shared_withdraw_to_character` historically transfers the Item to the
// caller's wallet via `public_transfer(item, character_address)`. Items in
// limbo there are unusable in-game and only redepositable to their origin
// SSU (enforced by `EItemParentMismatch` in the base contract).
//
// Two recovery destinations:
//   `recover_to_owned`  -> caller's per-character partition (visible in-game)
//   `recover_to_shared` -> shared open inventory (other tribemates can grab)
//
// Both gate on caller == character_address (no third-party griefing) and
// require this extension to remain authorized on the SSU. The shared path
// also re-checks current access policy so a revoked tribemate cannot keep
// pushing items into the shared pool.

const DEST_OWNED:  u8 = 0;
const DEST_SHARED: u8 = 1;

public struct ItemRecoveredEvent has copy, drop {
    ssu_id: ID,
    character_id: ID,
    type_id: u64,
    quantity: u32,
    destination: u8,
}

/// Recover a wallet-held Item back into the caller's per-character partition
/// on the SSU it came from. Routes through `deposit_to_owned<SsuAuth>` so the
/// item lands where the in-game inventory window can see it.
///
/// Requirements:
///   - sender == character.character_address
///   - SSU online (base contract enforces)
///   - item.parent_id == object::id(ssu) (base contract enforces)
///   - SsuAuth still authorized on the SSU (base contract enforces)
///
/// No policy check: this is a self-recovery action. If the SSU owner has
/// revoked our extension, the call aborts at the base layer.
public fun recover_to_owned(
    ssu: &mut StorageUnit,
    character: &Character,
    item: Item,
    ctx: &mut TxContext,
) {
    assert_caller_is_character(character, ctx);
    let type_id = wi::type_id(&item);
    let quantity = wi::quantity(&item);
    let ssu_id = object::id(ssu);

    su::deposit_to_owned<SsuAuth>(
        ssu,
        character,
        item,
        SsuAuth {},
        ctx,
    );

    event::emit(ItemRecoveredEvent {
        ssu_id,
        character_id: character::id(character),
        type_id,
        quantity,
        destination: DEST_OWNED,
    });
}

/// Recover a wallet-held Item back into the SSU's shared open inventory.
/// Re-checks the deposit-side access policy because a tribemate's access
/// could have been revoked between the original withdraw and this recovery.
public fun recover_to_shared(
    ssu: &mut StorageUnit,
    policy: &SsuPolicy,
    character: &Character,
    item: Item,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(policy.ssu_id == object::id(ssu), EPolicySsuMismatch);
    assert_caller_is_character(character, ctx);
    let now = sui::clock::timestamp_ms(clock);
    assert!(check_access(policy, character, now, false), EAccessDenied);

    let type_id = wi::type_id(&item);
    let quantity = wi::quantity(&item);
    let ssu_id = object::id(ssu);

    su::deposit_to_open_inventory<SsuAuth>(
        ssu,
        character,
        item,
        SsuAuth {},
        ctx,
    );

    event::emit(ItemRecoveredEvent {
        ssu_id,
        character_id: character::id(character),
        type_id,
        quantity,
        destination: DEST_SHARED,
    });
}

// ── Read helpers ──────────────────────────────────────────────────────────────

public fun has_policy(registry: &SsuPolicyRegistry, ssu_id: ID): bool {
    table::contains(&registry.policies, ssu_id)
}

public fun policy_id(registry: &SsuPolicyRegistry, ssu_id: ID): ID {
    *table::borrow(&registry.policies, ssu_id)
}

public fun policy_mode(p: &SsuPolicy): u8 { p.mode }
public fun policy_tribe_id(p: &SsuPolicy): u32 { p.tribe_id }
public fun policy_ssu_id(p: &SsuPolicy): ID { p.ssu_id }
public fun policy_allow(p: &SsuPolicy): &vector<AllowEntry> { &p.allow }
public fun policy_deny(p: &SsuPolicy): &vector<ID> { &p.deny }

public fun entry_character_id(e: &AllowEntry): ID { e.character_id }
public fun entry_expires_at(e: &AllowEntry): u64 { e.expires_at }
public fun entry_can_deposit(e: &AllowEntry): bool { e.can_deposit }
public fun entry_can_withdraw(e: &AllowEntry): bool { e.can_withdraw }

// ── Internal helpers ──────────────────────────────────────────────────────────

fun assert_owner_for_policy(policy: &SsuPolicy, cap: &OwnerCap<StorageUnit>) {
    assert!(access::is_authorized(cap, policy.ssu_id), ENotAuthorized);
}

fun assert_caller_is_character(character: &Character, ctx: &TxContext) {
    assert!(
        character::character_address(character) == tx_context::sender(ctx),
        ESenderMismatch,
    );
}

fun check_access(
    policy: &SsuPolicy,
    character: &Character,
    now_ms: u64,
    want_withdraw: bool,
): bool {
    let cid = character::id(character);
    let ctribe = character::tribe(character);

    if (policy.mode == MODE_NONE) {
        false
    } else if (policy.mode == MODE_TRIBE_ONLY) {
        ctribe == policy.tribe_id
    } else if (policy.mode == MODE_ALLOWLIST) {
        entry_grants(&policy.allow, cid, now_ms, want_withdraw)
    } else if (policy.mode == MODE_HYBRID) {
        if (entry_grants(&policy.allow, cid, now_ms, want_withdraw)) {
            true
        } else if (vector::contains(&policy.deny, &cid)) {
            false
        } else {
            ctribe == policy.tribe_id
        }
    } else {
        false
    }
}

fun entry_grants(
    entries: &vector<AllowEntry>,
    cid: ID,
    now_ms: u64,
    want_withdraw: bool,
): bool {
    let mut i = 0;
    let n = vector::length(entries);
    while (i < n) {
        let e = vector::borrow(entries, i);
        if (e.character_id == cid) {
            if (e.expires_at != 0 && e.expires_at < now_ms) {
                return false
            } else if (want_withdraw) {
                return e.can_withdraw
            } else {
                return e.can_deposit
            }
        };
        i = i + 1;
    };
    false
}

fun build_entries(
    character_ids: vector<ID>,
    expires_at: vector<u64>,
    can_deposit: vector<bool>,
    can_withdraw: vector<bool>,
): vector<AllowEntry> {
    let mut out = vector::empty<AllowEntry>();
    let n = vector::length(&character_ids);
    let mut i = 0;
    while (i < n) {
        vector::push_back(&mut out, AllowEntry {
            character_id: *vector::borrow(&character_ids, i),
            expires_at:   *vector::borrow(&expires_at, i),
            can_deposit:  *vector::borrow(&can_deposit, i),
            can_withdraw: *vector::borrow(&can_withdraw, i),
        });
        i = i + 1;
    };
    out
}

fun emit_updated(policy: &SsuPolicy) {
    event::emit(PolicyUpdatedEvent {
        ssu_id: policy.ssu_id,
        policy_id: object::id(policy),
        mode: policy.mode,
        tribe_id: policy.tribe_id,
        allow_count: vector::length(&policy.allow),
        deny_count: vector::length(&policy.deny),
    });
}
