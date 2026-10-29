#[test_only]
module cradleos_storage_access::storage_access_tests;

use std::{bcs, string::{utf8, String}, unit_test::assert_eq};
use sui::{clock, derived_object, test_scenario as ts};
use world::{
    access::{OwnerCap, AdminACL, ServerAddressRegistry},
    character::{Self, Character},
    energy::EnergyConfig,
    fuel::FuelConfig,
    in_game_id,
    inventory::Item,
    network_node::{Self, NetworkNode},
    object_registry::ObjectRegistry,
    storage_unit::{Self, StorageUnit},
    test_helpers::{Self, governor, admin, user_a, user_b, tenant}
};

const CHARACTER_A_ITEM_ID: u32 = 1234u32;
const CHARACTER_B_ITEM_ID: u32 = 5678u32;

const LOCATION_A_HASH: vector<u8> =
    x"7a8f3b2e9c4d1a6f5e8b2d9c3f7a1e5b7a8f3b2e9c4d1a6f5e8b2d9c3f7a1e5b";
const MAX_CAPACITY: u64 = 100000;
const STORAGE_A_TYPE_ID: u64 = 5555;
const STORAGE_A_ITEM_ID: u64 = 90002;

// Item constants
const AMMO_TYPE_ID: u64 = 88069;
const AMMO_ITEM_ID: u64 = 1000004145107;
const AMMO_VOLUME: u64 = 100;
const AMMO_QUANTITY: u32 = 10;


const STATUS_ONLINE: u8 = 1;


// Network node constants
const MS_PER_SECOND: u64 = 1000;
const NWN_TYPE_ID: u64 = 111000;
const NWN_ITEM_ID: u64 = 5000;
const FUEL_MAX_CAPACITY: u64 = 1000;
const FUEL_BURN_RATE_IN_MS: u64 = 3600 * MS_PER_SECOND;
const MAX_PRODUCTION: u64 = 100;
const FUEL_TYPE_ID: u64 = 1;
const FUEL_VOLUME: u64 = 10;


use cradleos_storage_access::storage_access::{Self as sa, Registry, Policy};
fun setup_nwn(ts: &mut ts::Scenario) {
    test_helpers::setup_world(ts);
    test_helpers::configure_assembly_energy(ts);
    test_helpers::register_server_address(ts);
}

fun create_network_node(ts: &mut ts::Scenario, character_id: ID): ID {
    ts::next_tx(ts, admin());
    let mut registry = ts::take_shared<ObjectRegistry>(ts);
    let character = ts::take_shared_by_id<Character>(ts, character_id);
    let admin_acl = ts::take_shared<AdminACL>(ts);

    // Check if network node already exists
    let nwn_key = test_helpers::in_game_id(NWN_ITEM_ID);
    let id = if (registry.object_exists(nwn_key)) {
        // Network node exists, derive its ID
        let nwn_addr = derived_object::derive_address(
            object::id(&registry),
            nwn_key,
        );
        object::id_from_address(nwn_addr)
    } else {
        // Network node doesn't exist, create it
        let nwn = network_node::anchor(
            &mut registry,
            &character,
            &admin_acl,
            NWN_ITEM_ID,
            NWN_TYPE_ID,
            LOCATION_A_HASH,
            FUEL_MAX_CAPACITY,
            FUEL_BURN_RATE_IN_MS,
            MAX_PRODUCTION,
            ts.ctx(),
        );
        let id = object::id(&nwn);
        nwn.share_network_node(&admin_acl, ts.ctx());
        id
    };

    ts::return_shared(character);
    ts::return_shared(admin_acl);
    ts::return_shared(registry);
    id
}

fun create_storage_unit(
    ts: &mut ts::Scenario,
    character_id: ID,
    location: vector<u8>,
    item_id: u64,
    type_id: u64,
): (ID, ID) {
    let nwn_id = create_network_node(ts, character_id);
    ts::next_tx(ts, admin());
    let mut registry = ts::take_shared<ObjectRegistry>(ts);
    let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
    let character = ts::take_shared_by_id<Character>(ts, character_id);
    let storage_unit_id = {
        let admin_acl = ts::take_shared<AdminACL>(ts);
        let storage_unit = storage_unit::anchor(
            &mut registry,
            &mut nwn,
            &character,
            &admin_acl,
            item_id,
            type_id,
            MAX_CAPACITY,
            location,
            ts.ctx(),
        );
        let storage_unit_id = object::id(&storage_unit);
        storage_unit.share_storage_unit(&admin_acl, ts.ctx());
        ts::return_shared(admin_acl);
        storage_unit_id
    };
    ts::return_shared(character);
    ts::return_shared(registry);
    ts::return_shared(nwn);
    (storage_unit_id, nwn_id)
}

fun online_storage_unit(
    ts: &mut ts::Scenario,
    user: address,
    character_id: ID,
    storage_id: ID,
    nwn_id: ID,
) {
    // Deposit fuel and bring network node online
    let clock = clock::create_for_testing(ts.ctx());
    ts::next_tx(ts, user);
    let mut character = ts::take_shared_by_id<Character>(ts, character_id);
    let (owner_cap, receipt) = character.borrow_owner_cap<NetworkNode>(
        ts::most_recent_receiving_ticket<OwnerCap<NetworkNode>>(&character_id),
        ts.ctx(),
    );
    ts::next_tx(ts, user);
    {
        let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
        nwn.deposit_fuel_test(
            &owner_cap,
            FUEL_TYPE_ID,
            FUEL_VOLUME,
            10,
            &clock,
        );
        ts::return_shared(nwn);
    };

    ts::next_tx(ts, user);
    {
        let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
        nwn.online(&owner_cap, &clock);
        ts::return_shared(nwn);
    };
    character.return_owner_cap(owner_cap, receipt);

    // Now bring storage unit online
    ts::next_tx(ts, user);
    {
        let mut storage_unit = ts::take_shared_by_id<StorageUnit>(ts, storage_id);
        let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
        let energy_config = ts::take_shared<EnergyConfig>(ts);
        let (owner_cap, receipt) = character.borrow_owner_cap<StorageUnit>(
            ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&character_id),
            ts.ctx(),
        );
        storage_unit.online(&mut nwn, &energy_config, &owner_cap);
        let status = storage_unit.status();
        assert_eq!(status.status_to_u8(), STATUS_ONLINE);
        character.return_owner_cap(owner_cap, receipt);
        ts::return_shared(storage_unit);
        ts::return_shared(nwn);
        ts::return_shared(energy_config);
    };

    ts::return_shared(character);
    clock.destroy_for_testing();
}

fun mint_ammo<T: key>(ts: &mut ts::Scenario, storage_id: ID, character_id: ID, user: address) {
    ts::next_tx(ts, user);
    {
        let mut character = ts::take_shared_by_id<Character>(ts, character_id);
        let (owner_cap, receipt) = character.borrow_owner_cap<T>(
            ts::most_recent_receiving_ticket<OwnerCap<T>>(&character_id),
            ts.ctx(),
        );
        let mut storage_unit = ts::take_shared_by_id<StorageUnit>(ts, storage_id);
        storage_unit.game_item_to_chain_inventory_test<T>(
            &character,
            &owner_cap,
            AMMO_ITEM_ID,
            AMMO_TYPE_ID,
            AMMO_VOLUME,
            AMMO_QUANTITY,
            ts.ctx(),
        );
        character.return_owner_cap(owner_cap, receipt);
        ts::return_shared(character);
        ts::return_shared(storage_unit);
    };
}

fun create_character(ts: &mut ts::Scenario, user: address, item_id: u32): ID {
    create_character_with_tenant(ts, user, item_id, tenant())
}

fun create_character_with_tenant(
    ts: &mut ts::Scenario,
    user: address,
    item_id: u32,
    tenant: String,
): ID {
    ts::next_tx(ts, admin());
    let character_id = {
        let admin_acl = ts::take_shared<AdminACL>(ts);
        let mut registry = ts::take_shared<ObjectRegistry>(ts);
        let character = character::create_character(
            &mut registry,
            &admin_acl,
            item_id,
            tenant,
            100,
            user,
            utf8(b"name"),
            ts::ctx(ts),
        );
        let character_id = object::id(&character);
        character.share_character(&admin_acl, ts.ctx());
        ts::return_shared(registry);
        ts::return_shared(admin_acl);
        character_id
    };
    character_id
}

// Character Owner Caps for owned inventory interaction
fun setup(): (ts::Scenario, ID, ID, ID, ID) {
    let mut s = ts::begin(governor());
    setup_nwn(&mut s);
    sa::init_for_testing(s.ctx());
    let owner = create_character(&mut s, user_a(), CHARACTER_A_ITEM_ID);
    let guest = create_character(&mut s, user_b(), CHARACTER_B_ITEM_ID);
    let (sid, nid) = create_storage_unit(&mut s, owner, LOCATION_A_HASH, STORAGE_A_ITEM_ID, STORAGE_A_TYPE_ID);
    online_storage_unit(&mut s, user_a(), owner, sid, nid);
    mint_ammo<StorageUnit>(&mut s, sid, owner, user_a());
    mint_ammo<Character>(&mut s, sid, guest, user_b());
    s.next_tx(user_a());
    let mut c = s.take_shared_by_id<Character>(owner);
    let mut su = s.take_shared_by_id<StorageUnit>(sid);
    let (cap, receipt) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let mut r = s.take_shared<Registry>();
    let mut p = sa::create_policy(&mut r, &su, &cap, s.ctx());
    let pid = object::id(&p);
    sa::configure(&mut p, &cap, 0, 4, vector[], vector[], vector[], vector[], vector[], vector[]);
    sa::authorize(&p, &mut su, &cap);
    sa::share_policy(p);
    c.return_owner_cap(cap, receipt);
    ts::return_shared(c); ts::return_shared(su); ts::return_shared(r);
    (s, owner, guest, sid, pid)
}
fun config(s: &mut ts::Scenario, owner: ID, pid: ID, revision: u64, mode: u8,
    tribes: vector<u32>, deny: vector<ID>, ids: vector<ID>, expiry: vector<u64>, dep: vector<bool>, wd: vector<bool>) {
    s.next_tx(user_a());
    let mut c = s.take_shared_by_id<Character>(owner);
    let (cap, receipt) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let mut p = s.take_shared_by_id<Policy>(pid);
    sa::configure(&mut p, &cap, revision, mode, tribes, deny, ids, expiry, dep, wd);
    ts::return_shared(p); c.return_owner_cap(cap, receipt); ts::return_shared(c);
}
fun deposit(s: &mut ts::Scenario, cid: ID, sid: ID, pid: ID, qty: u32) {
    s.next_tx(user_b());
    let mut c = s.take_shared_by_id<Character>(cid);
    let (cap, receipt) = c.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&cid), s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid);
    let p = s.take_shared_by_id<Policy>(pid);
    let clock = clock::create_for_testing(s.ctx());
    sa::deposit(&mut su, &p, &c, &cap, AMMO_TYPE_ID, qty, &clock, s.ctx());
    clock.destroy_for_testing(); c.return_owner_cap(cap, receipt);
    ts::return_shared(c); ts::return_shared(su); ts::return_shared(p);
}
fun withdraw(s: &mut ts::Scenario, cid: ID, sid: ID, pid: ID, qty: u32, now: u64) {
    s.next_tx(user_b());
    let c = s.take_shared_by_id<Character>(cid);
    let mut su = s.take_shared_by_id<StorageUnit>(sid);
    let p = s.take_shared_by_id<Policy>(pid);
    let mut clock = clock::create_for_testing(s.ctx());
    clock.increment_for_testing(now);
    sa::withdraw(&mut su, &p, &c, AMMO_TYPE_ID, qty, &clock, s.ctx());
    clock.destroy_for_testing(); ts::return_shared(c); ts::return_shared(su); ts::return_shared(p);
}
#[test]
fun public_round_trip_preserves_owner_stock() {
    let (mut s, _, guest, sid, pid) = setup();
    deposit(&mut s, guest, sid, pid, 6);
    s.next_tx(user_b());
    let su = s.take_shared_by_id<StorageUnit>(sid);
    let c = s.take_shared_by_id<Character>(guest);
    assert_eq!(su.item_quantity(su.owner_cap_id(), AMMO_TYPE_ID), 10);
    assert_eq!(su.item_quantity(c.owner_cap_id(), AMMO_TYPE_ID), 4);
    let keys = su.inventory_keys();
    assert_eq!(su.item_quantity(keys[1], AMMO_TYPE_ID), 6);
    ts::return_shared(c); ts::return_shared(su);
    withdraw(&mut s, guest, sid, pid, 6, 1);
    s.next_tx(user_b());
    let su = s.take_shared_by_id<StorageUnit>(sid);
    let c = s.take_shared_by_id<Character>(guest);
    assert_eq!(su.item_quantity(su.owner_cap_id(), AMMO_TYPE_ID), 10);
    assert_eq!(su.item_quantity(c.owner_cap_id(), AMMO_TYPE_ID), 10);
    assert!(!su.contains_item(keys[1], AMMO_TYPE_ID));
    ts::return_shared(c); ts::return_shared(su); s.end();
}
#[test]
fun permission_matrix_and_expiry_boundary() {
    let (mut s, owner, guest, _, pid) = setup();
    config(&mut s, owner, pid, 1, 3, vector[100], vector[], vector[guest], vector[1000], vector[true], vector[false]);
    s.next_tx(user_b());
    let p = s.take_shared_by_id<Policy>(pid);
    assert!(sa::permits(&p, guest, 100, 999, false));
    assert!(!sa::permits(&p, guest, 100, 999, true));
    assert!(!sa::permits(&p, guest, 100, 1000, false));
    assert!(!sa::permits(&p, guest, 100, 1001, false));
    assert!(sa::permits(&p, owner, 100, 1001, true));
    assert!(!sa::permits(&p, owner, 200, 1001, true));
    ts::return_shared(p);
    config(&mut s, owner, pid, 2, 3, vector[100], vector[guest], vector[guest], vector[0], vector[true], vector[true]);
    s.next_tx(user_b()); let p = s.take_shared_by_id<Policy>(pid);
    assert!(!sa::permits(&p, guest, 100, 0, false)); assert!(!sa::permits(&p, guest, 100, 0, true));
    ts::return_shared(p); s.end();
}
#[test]
fun owner_can_recover_closed_pool() {
    let (mut s, owner, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 6);
    config(&mut s, owner, pid, 1, 0, vector[], vector[], vector[], vector[], vector[], vector[]);
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(owner);
    let (cap, receipt) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid);
    sa::recover_shared(&mut su, &cap, &c, AMMO_TYPE_ID, 6, s.ctx());
    assert_eq!(su.item_quantity(c.owner_cap_id(), AMMO_TYPE_ID), 6);
    assert_eq!(su.item_quantity(su.owner_cap_id(), AMMO_TYPE_ID), 10);
    c.return_owner_cap(cap, receipt); ts::return_shared(c); ts::return_shared(su); s.end();
}

#[test]
#[expected_failure(abort_code = 1, location = cradleos_storage_access::storage_access)]
fun spoofed_character() { let (mut s, owner, _, sid, pid) = setup(); withdraw(&mut s, owner, sid, pid, 1, 0); s.end(); }
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun closed_denies_deposit() {
    let (mut s, owner, guest, sid, pid) = setup();
    config(&mut s, owner, pid, 1, 0, vector[], vector[], vector[], vector[], vector[], vector[]);
    deposit(&mut s, guest, sid, pid, 1); s.end();
}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun expiry_equality_denied() {
    let (mut s, owner, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 2);
    config(&mut s, owner, pid, 1, 2, vector[], vector[], vector[guest], vector[1000], vector[true], vector[true]);
    withdraw(&mut s, guest, sid, pid, 1, 1000); s.end();
}
#[test]
fun expiry_before_boundary_allowed() {
    let (mut s, owner, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 2);
    config(&mut s, owner, pid, 1, 2, vector[], vector[], vector[guest], vector[1000], vector[true], vector[true]);
    withdraw(&mut s, guest, sid, pid, 1, 999); s.end();
}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun tribe_change_immediately_revokes() {
    let (mut s, owner, guest, sid, pid) = setup();
    config(&mut s, owner, pid, 1, 1, vector[100], vector[], vector[], vector[], vector[], vector[]);
    deposit(&mut s, guest, sid, pid, 2);
    s.next_tx(admin()); let mut c = s.take_shared_by_id<Character>(guest); let acl = s.take_shared<AdminACL>();
    c.update_tribe(&acl, 200, s.ctx()); ts::return_shared(c); ts::return_shared(acl);
    withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun deny_wins_over_allow_and_tribe() {
    let (mut s, owner, guest, sid, pid) = setup();
    config(&mut s, owner, pid, 1, 3, vector[100], vector[guest], vector[guest], vector[0], vector[true], vector[true]);
    deposit(&mut s, guest, sid, pid, 1); s.end();
}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun deposit_only_not_bypassed_by_tribe() {
    let (mut s, owner, guest, sid, pid) = setup();
    config(&mut s, owner, pid, 1, 3, vector[100], vector[], vector[guest], vector[0], vector[true], vector[false]);
    deposit(&mut s, guest, sid, pid, 2); withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}
#[test]
#[expected_failure(abort_code = 8, location = cradleos_storage_access::storage_access)]
fun stale_revision_aborts() { let (mut s, owner, _, _, pid) = setup(); config(&mut s, owner, pid, 0, 4, vector[], vector[], vector[], vector[], vector[], vector[]); s.end(); }
#[test]
#[expected_failure(abort_code = 5, location = cradleos_storage_access::storage_access)]
fun duplicate_policy_aborts() {
    let (mut s, owner, _, sid, _) = setup(); s.next_tx(user_a());
    let mut c = s.take_shared_by_id<Character>(owner);
    let (cap, receipt) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let su = s.take_shared_by_id<StorageUnit>(sid); let mut r = s.take_shared<Registry>();
    sa::share_policy(sa::create_policy(&mut r, &su, &cap, s.ctx()));
    c.return_owner_cap(cap, receipt); ts::return_shared(c); ts::return_shared(su); ts::return_shared(r); s.end();
}
#[test]
#[expected_failure(abort_code = 3, location = cradleos_storage_access::storage_access)]
fun unrelated_owner_cap_aborts() {
    let (mut s, owner, _, _, pid) = setup();
    create_storage_unit(&mut s, owner, LOCATION_A_HASH, STORAGE_A_ITEM_ID+1, STORAGE_A_TYPE_ID);
    config(&mut s, owner, pid, 1, 4, vector[], vector[], vector[], vector[], vector[], vector[]); s.end();
}
#[test]
#[expected_failure(abort_code = 4, location = cradleos_storage_access::storage_access)]
fun policy_cannot_target_other_storage() {
    let (mut s, owner, guest, _, pid) = setup();
    let (sid, _) = create_storage_unit(&mut s, owner, LOCATION_A_HASH, STORAGE_A_ITEM_ID+1, STORAGE_A_TYPE_ID);
    withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}
#[test]
#[expected_failure(abort_code = world::storage_unit::EExtensionNotAuthorized)]
fun revocation_blocks_future_transfer() {
    let (mut s, owner, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 2);
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(owner);
    let (cap, receipt) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid); su.revoke_extension_authorization(&cap);
    c.return_owner_cap(cap, receipt); ts::return_shared(c); ts::return_shared(su);
    withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}
public struct OldExportedWitness has drop {}
#[test]
#[expected_failure(abort_code = world::storage_unit::EExtensionNotAuthorized)]
fun previous_witness_cannot_withdraw_owner_main() {
    let (mut s, _, guest, sid, _) = setup(); s.next_tx(user_b());
    let c = s.take_shared_by_id<Character>(guest); let mut su = s.take_shared_by_id<StorageUnit>(sid);
    let item = su.withdraw_item<OldExportedWitness>(&c, OldExportedWitness {}, AMMO_TYPE_ID, 1, s.ctx());
    transfer::public_transfer(item, user_b()); ts::return_shared(c); ts::return_shared(su); s.end();
}
#[test]
#[expected_failure(abort_code = world::storage_unit::EExtensionConfigFrozen)]
fun frozen_binding_cannot_be_replaced() {
    let (mut s, owner, _, sid, pid) = setup(); s.next_tx(user_a());
    let mut c = s.take_shared_by_id<Character>(owner);
    let (cap, receipt) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid); let p = s.take_shared_by_id<Policy>(pid);
    su.authorize_extension<OldExportedWitness>(&cap); su.freeze_extension_config(&cap); sa::authorize(&p, &mut su, &cap);
    c.return_owner_cap(cap, receipt); ts::return_shared(c); ts::return_shared(su); ts::return_shared(p); s.end();
}
#[test]
#[expected_failure(abort_code = world::inventory::EInventoryInsufficientCapacity)]
fun destination_capacity_aborts_whole_transfer() {
    let (mut s, _, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 6);
    // Existing personal quantity is 4. Fill its remaining capacity using the
    // official test mint, so the withdraw step succeeds but redeposit aborts.
    s.next_tx(user_b()); let mut c = s.take_shared_by_id<Character>(guest);
    let (cap, receipt) = c.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&guest), s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid);
    su.game_item_to_chain_inventory_test(&c, &cap, AMMO_ITEM_ID, AMMO_TYPE_ID, AMMO_VOLUME, 996, s.ctx());
    c.return_owner_cap(cap, receipt); ts::return_shared(c); ts::return_shared(su);
    withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storage_access::storage_access)]
fun duplicate_tribes() { let (mut s, owner, _, _, pid) = setup(); config(&mut s, owner, pid, 1, 1, vector[100,100], vector[], vector[], vector[], vector[], vector[]); s.end(); }

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storage_access::storage_access)]
fun duplicate_allow() { let (mut s, owner, guest, _, pid) = setup(); config(&mut s, owner, pid, 1, 2, vector[], vector[], vector[guest,guest], vector[0,0], vector[true,true], vector[true,true]); s.end(); }

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storage_access::storage_access)]
fun duplicate_deny() { let (mut s, owner, guest, _, pid) = setup(); config(&mut s, owner, pid, 1, 3, vector[100], vector[guest,guest], vector[], vector[], vector[], vector[]); s.end(); }

#[test]
#[expected_failure(abort_code = 2, location = cradleos_storage_access::storage_access)]
fun zero_tribe() { let (mut s, owner, _, _, pid) = setup(); config(&mut s, owner, pid, 1, 1, vector[0], vector[], vector[], vector[], vector[], vector[]); s.end(); }

#[test]
#[expected_failure(abort_code = 2, location = cradleos_storage_access::storage_access)]
fun invalid_mode() { let (mut s, owner, _, _, pid) = setup(); config(&mut s, owner, pid, 1, 5, vector[], vector[], vector[], vector[], vector[], vector[]); s.end(); }

#[test]
#[expected_failure(abort_code = 2, location = cradleos_storage_access::storage_access)]
fun mismatched_arrays() { let (mut s, owner, guest, _, pid) = setup(); config(&mut s, owner, pid, 1, 2, vector[], vector[], vector[guest], vector[], vector[true], vector[true]); s.end(); }

#[test]
#[expected_failure(abort_code = 2, location = cradleos_storage_access::storage_access)]
fun hidden_fields() { let (mut s, owner, _, _, pid) = setup(); config(&mut s, owner, pid, 1, 4, vector[100], vector[], vector[], vector[], vector[], vector[]); s.end(); }

#[test]
#[expected_failure(abort_code = 6, location = cradleos_storage_access::storage_access)]
fun tribe_limit() { let (mut s, owner, _, _, pid) = setup(); let mut tribes=vector[]; let mut i=1;
 while(i<=33) { tribes.push_back(i); i=i+1; }; config(&mut s, owner, pid, 1, 1, tribes, vector[], vector[], vector[], vector[], vector[]); s.end(); }

#[test]
#[expected_failure(abort_code = world::storage_unit::ETenantMismatch)]
fun cross_tenant_aborts() {
    let (mut s, _, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 2);
    s.next_tx(admin()); let mut c=s.take_shared_by_id<Character>(guest); let acl=s.take_shared<AdminACL>();
    c.update_tenant_id(&acl, b"OTHER".to_string(), s.ctx()); ts::return_shared(c); ts::return_shared(acl);
    withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}
#[test]
#[expected_failure(abort_code = world::inventory::EInventoryInsufficientQuantity)]
fun overdraw_aborts() { let (mut s, _, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 2); withdraw(&mut s, guest, sid, pid, 3, 0); s.end(); }
#[test]
#[expected_failure(abort_code = world::inventory::ESplitQuantityInvalid)]
fun zero_quantity_aborts() { let (mut s, _, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 0); s.end(); }
#[test]
fun another_personal_partition_unchanged() {
    let (mut s, owner, guest, sid, pid) = setup(); mint_ammo<Character>(&mut s, sid, owner, user_a());
    deposit(&mut s, guest, sid, pid, 4); withdraw(&mut s, guest, sid, pid, 3, 0);
    s.next_tx(user_a()); let c=s.take_shared_by_id<Character>(owner); let su=s.take_shared_by_id<StorageUnit>(sid);
    assert_eq!(su.item_quantity(c.owner_cap_id(), AMMO_TYPE_ID), 10);
    assert_eq!(su.item_quantity(su.owner_cap_id(), AMMO_TYPE_ID), 10);
    ts::return_shared(c); ts::return_shared(su); s.end();
}
#[test]
#[expected_failure(abort_code = world::storage_unit::ENotOnline)]
fun offline_denies_transfer() {
    let (mut s, owner, guest, sid, pid) = setup(); deposit(&mut s, guest, sid, pid, 2);
    s.next_tx(user_a()); let mut c=s.take_shared_by_id<Character>(owner);
    let (cap, receipt)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&owner), s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid); let mut nwn=s.take_shared<NetworkNode>(); let ec=s.take_shared<EnergyConfig>();
    su.offline(&mut nwn, &ec, &cap); c.return_owner_cap(cap, receipt);
    ts::return_shared(c); ts::return_shared(su); ts::return_shared(nwn); ts::return_shared(ec);
    withdraw(&mut s, guest, sid, pid, 1, 0); s.end();
}
#[test]
#[expected_failure(abort_code = 9, location = cradleos_storage_access::storage_access)]
fun wrong_character_cap_rejected() {
    let (mut s, _, guest, sid, pid) = setup(); let other=create_character(&mut s, user_b(), 9876);
    s.next_tx(user_b()); let mut c=s.take_shared_by_id<Character>(other); let guest_c=s.take_shared_by_id<Character>(guest);
    let (cap, receipt)=c.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&other), s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid); let p=s.take_shared_by_id<Policy>(pid); let clock=clock::create_for_testing(s.ctx());
    sa::deposit(&mut su, &p, &guest_c, &cap, AMMO_TYPE_ID, 1, &clock, s.ctx());
    c.return_owner_cap(cap, receipt); clock.destroy_for_testing(); ts::return_shared(c); ts::return_shared(guest_c); ts::return_shared(su); ts::return_shared(p); s.end();
}

fun owner_deposit(s: &mut ts::Scenario, cid: ID, sid: ID, pid: ID, qty: u32, now: u64) {
    s.next_tx(user_a());
    let mut c=s.take_shared_by_id<Character>(cid);
    let (cap, receipt)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&cid), s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid); let p=s.take_shared_by_id<Policy>(pid);
    let mut clock=clock::create_for_testing(s.ctx()); clock.increment_for_testing(now);
    sa::deposit_owner(&mut su, &p, &c, &cap, AMMO_TYPE_ID, qty, &clock, s.ctx());
    clock.destroy_for_testing(); c.return_owner_cap(cap, receipt);
    ts::return_shared(c); ts::return_shared(su); ts::return_shared(p);
}
#[test]
fun owner_deposit_exact_partial_preserves_all_personal_stock() {
    let (mut s, owner, guest, sid, pid)=setup(); mint_ammo<Character>(&mut s, sid, owner, user_a());
    deposit(&mut s, guest, sid, pid, 2);
    owner_deposit(&mut s, owner, sid, pid, 4, 1);
    s.next_tx(user_a()); let su=s.take_shared_by_id<StorageUnit>(sid);
    let a=s.take_shared_by_id<Character>(owner); let b=s.take_shared_by_id<Character>(guest);
    assert_eq!(su.item_quantity(su.owner_cap_id(), AMMO_TYPE_ID),6);
    assert_eq!(su.item_quantity(a.owner_cap_id(), AMMO_TYPE_ID),10);
    assert_eq!(su.item_quantity(b.owner_cap_id(), AMMO_TYPE_ID),8);
    assert_eq!(su.item_quantity(su.inventory_keys()[1], AMMO_TYPE_ID),6);
    ts::return_shared(a); ts::return_shared(b); ts::return_shared(su);
    withdraw(&mut s, guest, sid, pid, 6, 2);
    s.next_tx(user_b()); let su=s.take_shared_by_id<StorageUnit>(sid); let b=s.take_shared_by_id<Character>(guest);
    assert_eq!(su.item_quantity(b.owner_cap_id(),AMMO_TYPE_ID),14);
    assert_eq!(su.item_quantity(su.owner_cap_id(),AMMO_TYPE_ID),6);
    ts::return_shared(b); ts::return_shared(su); s.end();
}
#[test]
fun owner_deposit_full_stack() {
    let (mut s, owner, _, sid, pid)=setup(); owner_deposit(&mut s,owner,sid,pid,10,0);
    s.next_tx(user_a());let su=s.take_shared_by_id<StorageUnit>(sid);
    assert!(!su.contains_item(su.owner_cap_id(),AMMO_TYPE_ID));
    assert_eq!(su.item_quantity(su.inventory_keys()[1],AMMO_TYPE_ID),10);
    ts::return_shared(su);s.end();
}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun owner_deposit_closed_denied() {let(mut s,o,_,sid,pid)=setup();config(&mut s,o,pid,1,0,vector[],vector[],vector[],vector[],vector[],vector[]);owner_deposit(&mut s,o,sid,pid,1,0);s.end();}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun owner_deposit_deny_beats_tribe() {let(mut s,o,_,sid,pid)=setup();config(&mut s,o,pid,1,3,vector[100],vector[o],vector[],vector[],vector[],vector[]);owner_deposit(&mut s,o,sid,pid,1,0);s.end();}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun owner_deposit_expiry_denied() {let(mut s,o,_,sid,pid)=setup();config(&mut s,o,pid,1,2,vector[],vector[],vector[o],vector[1000],vector[true],vector[true]);owner_deposit(&mut s,o,sid,pid,1,1000);s.end();}
#[test]
#[expected_failure(abort_code = 0, location = cradleos_storage_access::storage_access)]
fun owner_deposit_withdraw_only_denied() {let(mut s,o,_,sid,pid)=setup();config(&mut s,o,pid,1,2,vector[],vector[],vector[o],vector[0],vector[false],vector[true]);owner_deposit(&mut s,o,sid,pid,1,0);s.end();}
#[test]
#[expected_failure(abort_code = world::inventory::EInventoryInsufficientQuantity)]
fun owner_deposit_overdraw() {let(mut s,o,_,sid,pid)=setup();owner_deposit(&mut s,o,sid,pid,11,0);s.end();}
#[test]
#[expected_failure(abort_code = world::inventory::ESplitQuantityInvalid)]
fun owner_deposit_zero() {let(mut s,o,_,sid,pid)=setup();owner_deposit(&mut s,o,sid,pid,0,0);s.end();}
#[test]
#[expected_failure(abort_code = 3, location = cradleos_storage_access::storage_access)]
fun owner_deposit_wrong_ssu_cap() {let(mut s,o,_,sid,pid)=setup();create_storage_unit(&mut s,o,LOCATION_A_HASH,STORAGE_A_ITEM_ID+1,STORAGE_A_TYPE_ID);owner_deposit(&mut s,o,sid,pid,1,0);s.end();}
#[test]
#[expected_failure(abort_code = 4, location = cradleos_storage_access::storage_access)]
fun owner_deposit_wrong_policy() {let(mut s,o,_,_,pid)=setup();let(sid,_)=create_storage_unit(&mut s,o,LOCATION_A_HASH,STORAGE_A_ITEM_ID+1,STORAGE_A_TYPE_ID);owner_deposit(&mut s,o,sid,pid,1,0);s.end();}
#[test]
#[expected_failure(abort_code = 1, location = cradleos_storage_access::storage_access)]
fun owner_deposit_spoofed_sender() {
    let(mut s,o,_,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(o);
    let(cap,receipt)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&o),s.ctx());
    s.next_tx(user_b());let mut su=s.take_shared_by_id<StorageUnit>(sid);let p=s.take_shared_by_id<Policy>(pid);let clock=clock::create_for_testing(s.ctx());
    sa::deposit_owner(&mut su,&p,&c,&cap,AMMO_TYPE_ID,1,&clock,s.ctx());
    clock.destroy_for_testing();c.return_owner_cap(cap,receipt);ts::return_shared(c);ts::return_shared(su);ts::return_shared(p);s.end();
}
#[test]
#[expected_failure(abort_code = world::storage_unit::EExtensionNotAuthorized)]
fun owner_deposit_revoked_extension() {
    let(mut s,o,_,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(o);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&o),s.ctx());let mut su=s.take_shared_by_id<StorageUnit>(sid);su.revoke_extension_authorization(&cap);
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);owner_deposit(&mut s,o,sid,pid,1,0);s.end();
}
#[test]
#[expected_failure(abort_code = world::storage_unit::ENotOnline)]
fun owner_deposit_offline() {
    let(mut s,o,_,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(o);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&o),s.ctx());let mut su=s.take_shared_by_id<StorageUnit>(sid);let mut nwn=s.take_shared<NetworkNode>();let ec=s.take_shared<EnergyConfig>();su.offline(&mut nwn,&ec,&cap);
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);ts::return_shared(nwn);ts::return_shared(ec);owner_deposit(&mut s,o,sid,pid,1,0);s.end();
}
#[test]
#[expected_failure(abort_code = world::inventory::EInventoryInsufficientCapacity)]
fun owner_deposit_shared_capacity() {
    let(mut s,o,g,sid,pid)=setup();deposit(&mut s,g,sid,pid,10);
    s.next_tx(user_b());let mut c=s.take_shared_by_id<Character>(g);let(cap,r)=c.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&g),s.ctx());let mut su=s.take_shared_by_id<StorageUnit>(sid);
    su.game_item_to_chain_inventory_test(&c,&cap,AMMO_ITEM_ID,AMMO_TYPE_ID,AMMO_VOLUME,990,s.ctx());c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);
    deposit(&mut s,g,sid,pid,990);owner_deposit(&mut s,o,sid,pid,1,0);s.end();
}
#[test]
#[expected_failure(abort_code = 3, location = cradleos_storage_access::storage_access)]
fun owner_deposit_noncanonical_authorized_cap() {
    let(mut s,o,_,sid,pid)=setup();s.next_tx(admin());let acl=s.take_shared<AdminACL>();
    let cap=world::access::create_owner_cap_by_id<StorageUnit>(sid,&acl,s.ctx());ts::return_shared(acl);
    s.next_tx(user_a());let c=s.take_shared_by_id<Character>(o);let mut su=s.take_shared_by_id<StorageUnit>(sid);let p=s.take_shared_by_id<Policy>(pid);let clock=clock::create_for_testing(s.ctx());
    sa::deposit_owner(&mut su,&p,&c,&cap,AMMO_TYPE_ID,1,&clock,s.ctx());
    world::access::transfer_owner_cap(cap,user_a());clock.destroy_for_testing();ts::return_shared(c);ts::return_shared(su);ts::return_shared(p);s.end();
}
#[test]
#[expected_failure(abort_code = world::storage_unit::EExtensionNotAuthorized)]
fun owner_deposit_foreign_binding() {
    let(mut s,o,_,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(o);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&o),s.ctx());let mut su=s.take_shared_by_id<StorageUnit>(sid);su.authorize_extension<OldExportedWitness>(&cap);
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);owner_deposit(&mut s,o,sid,pid,1,0);s.end();
}
#[test]
fun owner_deposit_keeps_storage_item_origin_after_character_tenant_change() {
    let(mut s,o,_,sid,pid)=setup();s.next_tx(admin());let mut c=s.take_shared_by_id<Character>(o);let acl=s.take_shared<AdminACL>();
    c.update_tenant_id(&acl,b"OTHER".to_string(),s.ctx());ts::return_shared(c);ts::return_shared(acl);owner_deposit(&mut s,o,sid,pid,1,0);
    s.next_tx(user_a());let su=s.take_shared_by_id<StorageUnit>(sid);
    assert_eq!(su.item_quantity(su.owner_cap_id(),AMMO_TYPE_ID),9);
    assert_eq!(su.item_quantity(su.inventory_keys()[1],AMMO_TYPE_ID),1);
    ts::return_shared(su);s.end();
}
