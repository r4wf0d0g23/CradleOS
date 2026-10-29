#[test_only]
module cradleos_storefront::storefront_tests;

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


use cradleos_storefront::storefront::{Self as sf, Registry, Shop};
use sui::{coin, sui::SUI};
public struct OTHER has drop {}
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


fun setup(): (ts::Scenario, ID, ID, ID, ID) {
    let mut s = ts::begin(governor()); setup_nwn(&mut s); sf::init_for_testing(s.ctx());
    let a = create_character(&mut s, user_a(), CHARACTER_A_ITEM_ID);
    let b = create_character(&mut s, user_b(), CHARACTER_B_ITEM_ID);
    let (sid,nid) = create_storage_unit(&mut s,a,LOCATION_A_HASH,STORAGE_A_ITEM_ID,STORAGE_A_TYPE_ID);
    online_storage_unit(&mut s,user_a(),a,sid,nid);
    mint_ammo<StorageUnit>(&mut s,sid,a,user_a()); mint_ammo<Character>(&mut s,sid,b,user_b());
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(a);
    let (cap,r) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid); let mut registry = s.take_shared<Registry>();
    let shop=sf::create(&mut registry,&mut su,&cap,utf8(b"Shop"),s.ctx()); let pid = sf::shop_id(&registry,sid);sf::share_shop(shop);
    c.return_owner_cap(cap,r); ts::return_shared(c); ts::return_shared(su); ts::return_shared(registry);
    config(&mut s,a,pid,0,true,4,vector[],vector[],vector[]);
    listing<SUI>(&mut s,a,pid,0,50,true,1,10,1,0,0,0);
    stock(&mut s,a,sid,pid,6);
    (s,a,b,sid,pid)
}
fun config(s: &mut ts::Scenario, a: ID, pid: ID, revision: u64, open: bool, mode: u8,
    tribes: vector<u32>, pilots: vector<ID>, deny: vector<ID>) {
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(a);
    let (cap,r) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut p = s.take_shared_by_id<Shop>(pid);
    sf::configure(&mut p,&cap,revision,utf8(b"Shop"),open,mode,tribes,pilots,deny);
    c.return_owner_cap(cap,r); ts::return_shared(c); ts::return_shared(p);
}
fun listing<T>(s: &mut ts::Scenario, a: ID, pid: ID, revision: u64, price: u64, enabled: bool,
    minimum: u32, maximum: u32, step: u32, start: u64, end: u64, limit: u64) {
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(a);
    let (cap,r) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut p = s.take_shared_by_id<Shop>(pid);
    sf::set_listing<T>(&mut p,&cap,AMMO_TYPE_ID,revision,price,enabled,minimum,maximum,step,start,end,limit);
    c.return_owner_cap(cap,r); ts::return_shared(c); ts::return_shared(p);
}
fun stock(s: &mut ts::Scenario, a: ID, sid: ID, pid: ID, qty: u32) {
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(a);
    let (cap,r) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut su = s.take_shared_by_id<StorageUnit>(sid); let mut p = s.take_shared_by_id<Shop>(pid);
    sf::stock_owner(&mut p,&mut su,&cap,&c,AMMO_TYPE_ID,qty,s.ctx());
    c.return_owner_cap(cap,r); ts::return_shared(c); ts::return_shared(su); ts::return_shared(p);
}
fun buy<T>(s: &mut ts::Scenario, b: ID, sid: ID, pid: ID, qty: u32, paid: u64, sr: u64, lr: u64, now: u64) {
    s.next_tx(user_b()); let c = s.take_shared_by_id<Character>(b);
    let mut su = s.take_shared_by_id<StorageUnit>(sid); let mut p = s.take_shared_by_id<Shop>(pid);
    let mut clock = clock::create_for_testing(s.ctx()); clock.increment_for_testing(now);
    let payment = coin::mint_for_testing<T>(paid,s.ctx());
    sf::buy(&mut p,&mut su,&c,AMMO_TYPE_ID,qty,sr,lr,payment,&clock,s.ctx());
    clock.destroy_for_testing(); ts::return_shared(c); ts::return_shared(su); ts::return_shared(p);
}
#[test]
fun atomic_sale_claim_and_unsold_recovery() {
    let (mut s,a,b,sid,pid) = setup(); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0);
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(a);
    let (cap,r) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut p = s.take_shared_by_id<Shop>(pid); let mut su = s.take_shared_by_id<StorageUnit>(sid);
    let guest = s.take_shared_by_id<Character>(b);
    assert_eq!(sf::stock(&p,AMMO_TYPE_ID),4); assert_eq!(sf::proceeds<SUI>(&p),100);
    sf::unstock(&mut p,&mut su,&cap,&c,AMMO_TYPE_ID,4,s.ctx());
    assert_eq!(su.item_quantity(su.owner_cap_id(),AMMO_TYPE_ID),4);
    assert_eq!(su.item_quantity(c.owner_cap_id(),AMMO_TYPE_ID),4);
    assert_eq!(su.item_quantity(guest.owner_cap_id(),AMMO_TYPE_ID),12);
    assert_eq!(sf::stock(&p,AMMO_TYPE_ID),0);
    sf::claim<SUI>(&mut p,&cap,s.ctx()); assert_eq!(sf::proceeds<SUI>(&p),0);
    c.return_owner_cap(cap,r); ts::return_shared(c); ts::return_shared(guest); ts::return_shared(p); ts::return_shared(su);
    s.next_tx(user_a()); let funds = s.take_from_sender<coin::Coin<SUI>>();
    assert_eq!(coin::burn_for_testing(funds),100); s.end();
}
#[test]
fun personal_stock_and_multiple_sales() {
    let (mut s,a,b,sid,pid) = setup(); mint_ammo<Character>(&mut s,sid,a,user_a());
    s.next_tx(user_a()); let mut c = s.take_shared_by_id<Character>(a);
    let (cap,r) = c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let (cc,rr) = c.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&a),s.ctx());
    let mut p = s.take_shared_by_id<Shop>(pid); let mut su = s.take_shared_by_id<StorageUnit>(sid);
    sf::stock_personal(&mut p,&mut su,&cap,&c,&cc,AMMO_TYPE_ID,4,s.ctx());
    assert_eq!(sf::stock(&p,AMMO_TYPE_ID),10); assert_eq!(su.item_quantity(c.owner_cap_id(),AMMO_TYPE_ID),6);
    c.return_owner_cap(cc,rr); c.return_owner_cap(cap,r); ts::return_shared(c); ts::return_shared(p); ts::return_shared(su);
    buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); buy<SUI>(&mut s,b,sid,pid,3,150,1,1,0);
    s.next_tx(user_a()); let p = s.take_shared_by_id<Shop>(pid);
    assert_eq!(sf::proceeds<SUI>(&p),250); assert_eq!(sf::stock(&p,AMMO_TYPE_ID),5); ts::return_shared(p); s.end();
}
#[test]
fun access_matrix_and_time_start() {
    let (mut s,a,b,sid,pid) = setup();
    config(&mut s,a,pid,1,true,3,vector[100],vector[],vector[a]);
    listing<SUI>(&mut s,a,pid,1,50,true,2,6,2,10,20,4);
    s.next_tx(user_b()); let p = s.take_shared_by_id<Shop>(pid);
    assert!(!sf::permits(&p,a,100)); assert!(sf::permits(&p,b,100)); assert!(!sf::permits(&p,b,200)); ts::return_shared(p);
    buy<SUI>(&mut s,b,sid,pid,2,100,2,2,10); buy<SUI>(&mut s,b,sid,pid,2,100,2,2,19); s.end();
}

#[test]
#[expected_failure(abort_code = 10, location = cradleos_storefront::storefront)]
fun underpayment() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,b,sid,pid,2,99,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 10, location = cradleos_storefront::storefront)]
fun overpayment() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,b,sid,pid,2,101,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 11, location = cradleos_storefront::storefront)]
fun wrong_currency() { let (mut s,a,b,sid,pid) = setup();  buy<OTHER>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 6, location = cradleos_storefront::storefront)]
fun stale_shop() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,b,sid,pid,2,100,0,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 6, location = cradleos_storefront::storefront)]
fun stale_listing() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,b,sid,pid,2,100,1,0,0); s.end(); }

#[test]
#[expected_failure(abort_code = 9, location = cradleos_storefront::storefront)]
fun out_of_stock() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,b,sid,pid,7,350,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 9, location = cradleos_storefront::storefront)]
fun zero_quantity() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,b,sid,pid,0,0,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 8, location = cradleos_storefront::storefront)]
fun shop_paused() { let (mut s,a,b,sid,pid) = setup(); config(&mut s,a,pid,1,false,4,vector[],vector[],vector[]); buy<SUI>(&mut s,b,sid,pid,2,100,2,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storefront::storefront)]
fun closed_access() { let (mut s,a,b,sid,pid) = setup(); config(&mut s,a,pid,1,true,0,vector[],vector[],vector[]); buy<SUI>(&mut s,b,sid,pid,2,100,2,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storefront::storefront)]
fun deny_public() { let (mut s,a,b,sid,pid) = setup(); config(&mut s,a,pid,1,true,4,vector[],vector[],vector[b]); buy<SUI>(&mut s,b,sid,pid,2,100,2,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storefront::storefront)]
fun wrong_tribe() { let (mut s,a,b,sid,pid) = setup(); config(&mut s,a,pid,1,true,1,vector[101],vector[],vector[]); buy<SUI>(&mut s,b,sid,pid,2,100,2,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 7, location = cradleos_storefront::storefront)]
fun not_allowlisted() { let (mut s,a,b,sid,pid) = setup(); config(&mut s,a,pid,1,true,2,vector[],vector[a],vector[]); buy<SUI>(&mut s,b,sid,pid,2,100,2,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 8, location = cradleos_storefront::storefront)]
fun disabled_listing() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,false,1,10,1,0,0,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,2,0); s.end(); }

#[test]
#[expected_failure(abort_code = 12, location = cradleos_storefront::storefront)]
fun before_start() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,1,10,1,10,20,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,2,9); s.end(); }

#[test]
#[expected_failure(abort_code = 12, location = cradleos_storefront::storefront)]
fun end_exclusive() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,1,10,1,10,20,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,2,20); s.end(); }

#[test]
#[expected_failure(abort_code = 9, location = cradleos_storefront::storefront)]
fun wrong_step() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,2,10,2,0,0,0); buy<SUI>(&mut s,b,sid,pid,3,150,1,2,0); s.end(); }

#[test]
#[expected_failure(abort_code = 9, location = cradleos_storefront::storefront)]
fun below_min() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,2,10,1,0,0,0); buy<SUI>(&mut s,b,sid,pid,1,50,1,2,0); s.end(); }

#[test]
#[expected_failure(abort_code = 9, location = cradleos_storefront::storefront)]
fun above_max() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,1,2,1,0,0,0); buy<SUI>(&mut s,b,sid,pid,3,150,1,2,0); s.end(); }

#[test]
#[expected_failure(abort_code = 13, location = cradleos_storefront::storefront)]
fun pilot_cap() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,1,10,1,0,0,3); buy<SUI>(&mut s,b,sid,pid,2,100,1,2,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,2,0); s.end(); }

#[test]
#[expected_failure(abort_code = 1, location = cradleos_storefront::storefront)]
fun spoofed_character() { let (mut s,a,b,sid,pid) = setup();  buy<SUI>(&mut s,a,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 11, location = cradleos_storefront::storefront)]
fun currency_change_rejected() { let (mut s,a,b,sid,pid) = setup(); listing<OTHER>(&mut s,a,pid,1,50,true,1,10,1,0,0,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 5, location = cradleos_storefront::storefront)]
fun price_overflow_rejected() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,18446744073709551615,true,1,10,1,0,0,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 5, location = cradleos_storefront::storefront)]
fun zero_price_rejected() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,0,true,1,10,1,0,0,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 5, location = cradleos_storefront::storefront)]
fun zero_step_rejected() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,1,10,0,0,0,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 5, location = cradleos_storefront::storefront)]
fun invalid_time_rejected() { let (mut s,a,b,sid,pid) = setup(); listing<SUI>(&mut s,a,pid,1,50,true,1,10,1,20,20,0); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

#[test]
#[expected_failure(abort_code = 5, location = cradleos_storefront::storefront)]
fun duplicate_tribe_rejected() { let (mut s,a,b,sid,pid) = setup(); config(&mut s,a,pid,1,true,1,vector[100,100],vector[],vector[]); buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0); s.end(); }

public struct OtherAuth has drop {}
fun occupied_activation(volume: u64) {
    let mut s=ts::begin(governor());setup_nwn(&mut s);sf::init_for_testing(s.ctx());
    let a=create_character(&mut s,user_a(),CHARACTER_A_ITEM_ID);
    let(sid,nid)=create_storage_unit(&mut s,a,LOCATION_A_HASH,STORAGE_A_ITEM_ID,STORAGE_A_TYPE_ID);
    online_storage_unit(&mut s,user_a(),a,sid,nid);
    s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid);let mut reg=s.take_shared<Registry>();
    su.game_item_to_chain_inventory_test(&c,&cap,AMMO_ITEM_ID,AMMO_TYPE_ID,volume,1,s.ctx());
    su.authorize_extension<OtherAuth>(&cap);
    let item=su.withdraw_by_owner(&c,&cap,AMMO_TYPE_ID,1,s.ctx());
    su.deposit_to_open_inventory(&c,item,OtherAuth{},s.ctx());
    let shop=sf::create(&mut reg,&mut su,&cap,utf8(b"Shop"),s.ctx());sf::share_shop(shop);
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);ts::return_shared(reg);s.end();
}
#[test]
#[expected_failure(abort_code=3,location=cradleos_storefront::storefront)]
fun occupied_pool_rejected(){occupied_activation(100)}
#[test]
#[expected_failure(abort_code=3,location=cradleos_storefront::storefront)]
fun zero_volume_stock_rejected(){occupied_activation(0)}
#[test]
#[expected_failure(abort_code=0,location=cradleos_storefront::storefront)]
fun copied_cap_claim_rejected(){
    let(mut s,_,b,sid,pid)=setup();buy<SUI>(&mut s,b,sid,pid,1,50,1,1,0);
    s.next_tx(admin());let acl=s.take_shared<AdminACL>();
    let cap=world::access::create_owner_cap_by_id<StorageUnit>(sid,&acl,s.ctx());ts::return_shared(acl);
    let mut p=s.take_shared_by_id<Shop>(pid);sf::claim<SUI>(&mut p,&cap,s.ctx());
    world::access::transfer_owner_cap(cap,user_a());ts::return_shared(p);s.end();
}
#[test]
#[expected_failure(abort_code=0,location=cradleos_storefront::storefront)]
fun copied_cap_config_rejected(){
    let(mut s,_,_,sid,pid)=setup();s.next_tx(admin());let acl=s.take_shared<AdminACL>();
    let cap=world::access::create_owner_cap_by_id<StorageUnit>(sid,&acl,s.ctx());ts::return_shared(acl);
    let mut p=s.take_shared_by_id<Shop>(pid);sf::configure(&mut p,&cap,1,utf8(b"X"),true,4,vector[],vector[],vector[]);
    world::access::transfer_owner_cap(cap,user_a());ts::return_shared(p);s.end();
}
#[test]
#[expected_failure(abort_code=1,location=cradleos_storefront::storefront)]
fun foreign_personal_inventory_rejected(){
    let(mut s,a,b,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    ts::return_shared(c);s.next_tx(user_b());let mut guest=s.take_shared_by_id<Character>(b);
    let(cc,rr)=guest.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&b),s.ctx());
    s.next_tx(user_a());let mut p=s.take_shared_by_id<Shop>(pid);let mut su=s.take_shared_by_id<StorageUnit>(sid);
    sf::stock_personal(&mut p,&mut su,&cap,&guest,&cc,AMMO_TYPE_ID,1,s.ctx());
    guest.return_owner_cap(cc,rr);let mut c=s.take_shared_by_id<Character>(a);c.return_owner_cap(cap,r);
    ts::return_shared(guest);ts::return_shared(c);ts::return_shared(p);ts::return_shared(su);s.end();
}
#[test]
fun proceeds_follow_transferred_canonical_cap(){
    let(mut s,a,b,sid,pid)=setup();buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0);
    s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    world::access::transfer_owner_cap_with_receipt(cap,r,user_b(),s.ctx());ts::return_shared(c);
    s.next_tx(user_b());let cap=s.take_from_sender<OwnerCap<StorageUnit>>();let mut p=s.take_shared_by_id<Shop>(pid);
    sf::claim<SUI>(&mut p,&cap,s.ctx());assert_eq!(sf::proceeds<SUI>(&p),0);ts::return_shared(p);ts::return_to_sender(&s,cap);
    s.next_tx(user_b());let funds=s.take_from_sender<coin::Coin<SUI>>();assert_eq!(coin::burn_for_testing(funds),100);s.end();
}
#[test]
#[expected_failure(abort_code=world::storage_unit::EExtensionNotAuthorized)]
fun revoked_binding_prevents_sale(){
    let(mut s,a,b,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid);su.revoke_extension_authorization(&cap);
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);buy<SUI>(&mut s,b,sid,pid,1,50,1,1,0);s.end();
}
#[test]
#[expected_failure(abort_code=world::inventory::EInventoryInsufficientCapacity)]
fun full_buyer_partition_prevents_sale(){
    let(mut s,_,b,sid,pid)=setup();s.next_tx(user_b());let mut c=s.take_shared_by_id<Character>(b);
    let(cap,r)=c.borrow_owner_cap<Character>(ts::most_recent_receiving_ticket<OwnerCap<Character>>(&b),s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid);
    su.game_item_to_chain_inventory_test(&c,&cap,AMMO_ITEM_ID,AMMO_TYPE_ID,AMMO_VOLUME,990,s.ctx());
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);buy<SUI>(&mut s,b,sid,pid,1,50,1,1,0);s.end();
}
#[test]
#[expected_failure(abort_code=13,location=cradleos_storefront::storefront)]
fun listing_edit_does_not_reset_lifetime_limit(){
    let(mut s,a,b,sid,pid)=setup();listing<SUI>(&mut s,a,pid,1,50,true,1,10,1,0,0,2);
    buy<SUI>(&mut s,b,sid,pid,2,100,1,2,0);listing<SUI>(&mut s,a,pid,2,50,true,1,10,1,0,0,2);
    buy<SUI>(&mut s,b,sid,pid,1,50,1,3,0);s.end();
}
#[test]
#[expected_failure(abort_code=9,location=cradleos_storefront::storefront)]
fun cannot_recover_more_than_allocated_stock(){
    let(mut s,a,_,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());
    let mut su=s.take_shared_by_id<StorageUnit>(sid);let mut p=s.take_shared_by_id<Shop>(pid);
    sf::unstock(&mut p,&mut su,&cap,&c,AMMO_TYPE_ID,7,s.ctx());
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);ts::return_shared(p);s.end();
}

#[test]
fun claim_after_ssu_destruction(){
    let(mut s,a,b,sid,pid)=setup();buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0);
    s.next_tx(admin());let su=s.take_shared_by_id<StorageUnit>(sid);let mut n=s.take_shared<NetworkNode>();let ec=s.take_shared<EnergyConfig>();let acl=s.take_shared<AdminACL>();
    su.unanchor(&mut n,&ec,&acl,s.ctx());ts::return_shared(n);ts::return_shared(ec);ts::return_shared(acl);
    s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());let mut p=s.take_shared_by_id<Shop>(pid);
    sf::claim<SUI>(&mut p,&cap,s.ctx());assert_eq!(sf::proceeds<SUI>(&p),0);c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(p);
    s.next_tx(user_a());let funds=s.take_from_sender<coin::Coin<SUI>>();assert_eq!(coin::burn_for_testing(funds),100);s.end();
}
#[test]
#[expected_failure(abort_code=world::storage_unit::ENotOnline)]
fun offline_prevents_purchase(){
    let(mut s,a,b,sid,pid)=setup();s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());let mut su=s.take_shared_by_id<StorageUnit>(sid);let mut n=s.take_shared<NetworkNode>();let ec=s.take_shared<EnergyConfig>();
    su.offline(&mut n,&ec,&cap);c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);ts::return_shared(n);ts::return_shared(ec);
    buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0);s.end();
}
#[test]
fun different_currency_proceeds_are_separate(){
    let(mut s,a,b,sid,pid)=setup();buy<SUI>(&mut s,b,sid,pid,2,100,1,1,0);
    s.next_tx(user_a());let mut c=s.take_shared_by_id<Character>(a);
    let(cap,r)=c.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&a),s.ctx());let mut su=s.take_shared_by_id<StorageUnit>(sid);let mut p=s.take_shared_by_id<Shop>(pid);
    su.game_item_to_chain_inventory_test(&c,&cap,777,999,100,5,s.ctx());
    sf::set_listing<OTHER>(&mut p,&cap,999,0,17,true,1,5,1,0,0,0);sf::stock_owner(&mut p,&mut su,&cap,&c,999,5,s.ctx());
    c.return_owner_cap(cap,r);ts::return_shared(c);ts::return_shared(su);ts::return_shared(p);
    s.next_tx(user_b());let c=s.take_shared_by_id<Character>(b);let mut su=s.take_shared_by_id<StorageUnit>(sid);let mut p=s.take_shared_by_id<Shop>(pid);let clock=clock::create_for_testing(s.ctx());
    let payment=coin::mint_for_testing<OTHER>(34,s.ctx());sf::buy(&mut p,&mut su,&c,999,2,1,1,payment,&clock,s.ctx());
    assert_eq!(sf::proceeds<SUI>(&p),100);assert_eq!(sf::proceeds<OTHER>(&p),34);
    clock.destroy_for_testing();ts::return_shared(c);ts::return_shared(su);ts::return_shared(p);s.end();
}
