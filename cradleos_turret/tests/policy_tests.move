#[test_only]
module cradleos_turret::tests;

use std::{bcs, string::utf8, unit_test::assert_eq};
use sui::{clock, test_scenario as ts};
use world::{
    access::{AdminACL, OwnerCap},
    character::{Self, Character},
    energy::EnergyConfig,
    network_node::{Self, NetworkNode},
    object_registry::ObjectRegistry,
    test_helpers::{Self, admin, tenant, user_a, user_b},
    turret::{Self, Turret}
};

// Turret constants
const TURRET_TYPE_ID: u64 = 5555;
const TURRET_ITEM_ID_1: u64 = 6001;

// Network node constants (match gate_tests)
const MS_PER_SECOND: u64 = 1000;
const NWN_TYPE_ID: u64 = 111000;
const NWN_ITEM_ID: u64 = 5000;
const FUEL_MAX_CAPACITY: u64 = 1000;
const FUEL_BURN_RATE_IN_MS: u64 = 3600 * MS_PER_SECOND;
const MAX_PRODUCTION: u64 = 100;
const FUEL_TYPE_ID: u64 = 1;
const FUEL_VOLUME: u64 = 10;

// BCS layout for TargetCandidate: (u64, u64, u64, u32, u32, u64, u64, u64, bool, u64, behaviour_change u8). behaviour_change: 0=UNSPECIFIED, 1=ENTERED, 2=STARTED_ATTACK, 3=STOPPED_ATTACK
public struct TargetCandidateBcs has copy, drop {
    item_id: u64,
    type_id: u64,
    group_id: u64,
    character_id: u32,
    character_tribe: u32,
    hp_ratio: u64,
    shield_ratio: u64,
    armor_ratio: u64,
    is_aggressor: bool,
    priority_weight: u64,
    behaviour_change: u8,
}


use cradleos_turret::turret as policy;
fun setup(ts: &mut ts::Scenario) {
    test_helpers::setup_world(ts);
    test_helpers::configure_fuel(ts);
    test_helpers::configure_assembly_energy(ts);
    test_helpers::register_server_address(ts);
}

fun create_character(ts: &mut ts::Scenario, user: address, item_id: u32, tribe_id: u32): ID {
    ts::next_tx(ts, admin());
    {
        let admin_acl = ts::take_shared<AdminACL>(ts);
        let mut registry = ts::take_shared<ObjectRegistry>(ts);
        let character = character::create_character(
            &mut registry,
            &admin_acl,
            item_id,
            tenant(),
            tribe_id,
            user,
            utf8(b"name"),
            ts.ctx(),
        );
        let character_id = object::id(&character);
        character.share_character(&admin_acl, ts.ctx());
        ts::return_shared(registry);
        ts::return_shared(admin_acl);
        character_id
    }
}

fun create_network_node(ts: &mut ts::Scenario, character_id: ID): ID {
    ts::next_tx(ts, admin());
    let mut registry = ts::take_shared<ObjectRegistry>(ts);
    let character = ts::take_shared_by_id<Character>(ts, character_id);
    let admin_acl = ts::take_shared<AdminACL>(ts);
    let nwn = network_node::anchor(
        &mut registry,
        &character,
        &admin_acl,
        NWN_ITEM_ID,
        NWN_TYPE_ID,
        test_helpers::get_verified_location_hash(),
        FUEL_MAX_CAPACITY,
        FUEL_BURN_RATE_IN_MS,
        MAX_PRODUCTION,
        ts.ctx(),
    );
    let nwn_id = object::id(&nwn);
    nwn.share_network_node(&admin_acl, ts.ctx());
    ts::return_shared(character);
    ts::return_shared(registry);
    ts::return_shared(admin_acl);
    nwn_id
}

fun create_turret(ts: &mut ts::Scenario, character_id: ID, nwn_id: ID, item_id: u64): ID {
    ts::next_tx(ts, admin());
    let mut registry = ts::take_shared<ObjectRegistry>(ts);
    let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
    let character = ts::take_shared_by_id<Character>(ts, character_id);
    let admin_acl = ts::take_shared<AdminACL>(ts);
    let turret_obj = turret::anchor(
        &mut registry,
        &mut nwn,
        &character,
        &admin_acl,
        item_id,
        TURRET_TYPE_ID,
        test_helpers::get_verified_location_hash(),
        ts.ctx(),
    );
    let turret_id = object::id(&turret_obj);
    turret_obj.share_turret(&admin_acl, ts.ctx());
    ts::return_shared(character);
    ts::return_shared(nwn);
    ts::return_shared(registry);
    ts::return_shared(admin_acl);
    turret_id
}

fun bring_network_node_online(ts: &mut ts::Scenario, character_id: ID, nwn_id: ID) {
    ts::next_tx(ts, user_a());
    {
        let clock = clock::create_for_testing(ts.ctx());
        let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
        let mut character = ts::take_shared_by_id<Character>(ts, character_id);
        let nwn_owner_cap_id = nwn.owner_cap_id();
        let nwn_ticket = ts::receiving_ticket_by_id<OwnerCap<NetworkNode>>(nwn_owner_cap_id);
        let (owner_cap, receipt) = character.borrow_owner_cap<NetworkNode>(nwn_ticket, ts.ctx());
        nwn.deposit_fuel_test(&owner_cap, FUEL_TYPE_ID, FUEL_VOLUME, 10, &clock);
        nwn.online(&owner_cap, &clock);
        character.return_owner_cap(owner_cap, receipt);
        ts::return_shared(nwn);
        ts::return_shared(character);
        clock.destroy_for_testing();
    };
}

fun bring_turret_online(ts: &mut ts::Scenario, character_id: ID, turret_id: ID, nwn_id: ID) {
    ts::next_tx(ts, user_a());
    {
        let mut turret = ts::take_shared_by_id<Turret>(ts, turret_id);
        let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
        let energy_config = ts::take_shared<EnergyConfig>(ts);
        let mut character = ts::take_shared_by_id<Character>(ts, character_id);
        let owner_cap_id = turret.owner_cap_id();
        let turret_ticket = ts::receiving_ticket_by_id<OwnerCap<Turret>>(owner_cap_id);
        let (owner_cap, receipt) = character.borrow_owner_cap<Turret>(turret_ticket, ts.ctx());
        turret.online(&mut nwn, &energy_config, &owner_cap);
        character.return_owner_cap(owner_cap, receipt);
        ts::return_shared(character);
        ts::return_shared(turret);
        ts::return_shared(nwn);
        ts::return_shared(energy_config);
    };
}

fun bytes(mode: u8): vector<u8> { vector[mode, 0, 0, 2, 0, 0, 0, 0] }
fun candidate(id: u64, pilot: u32, tribe: u32, group: u64, health: u64, aggressor: bool, change: u8): TargetCandidateBcs {
    TargetCandidateBcs { item_id: id, type_id: 1, group_id: group, character_id: pilot,
        character_tribe: tribe, hp_ratio: health, shield_ratio: health, armor_ratio: health,
        is_aggressor: aggressor, priority_weight: 18446744073709551615, behaviour_change: change }
}
fun evaluate(raw: vector<u8>, candidates: vector<TargetCandidateBcs>): vector<turret::ReturnTargetPriorityList> {
    let cfg = policy::decode_settings(&raw).destroy_some();
    policy::evaluate(&cfg, &turret::unpack_candidate_list(bcs::to_bytes(&candidates)), 100, 7, 92402)
}

#[test]
fun fixture_wire_utf8_preservation() {
    // Shared TS/Move fixture: friends 300; hostile 4294967295; friendly tribe 7; hostile 9.
    let raw = x"02010203012c01000001ffffffff01070000000109000000";
    let original = utf8(x"636166c3a920e29a93");
    let desc = policy::with_settings(original, raw);
    assert_eq!(desc, utf8(x"636166c3a920e29a930a5b637261646c656f732d7475727265743a76313a3032303130323033303132633031303030303031666666666666666630313037303030303030303130393030303030305d"));
    assert!(policy::read_settings(desc).is_some());
    assert_eq!(policy::strip_settings(desc), original);
    let edited = policy::with_settings(desc, bytes(0));
    assert_eq!(policy::strip_settings(edited), original);
}
#[test]
fun truncation_and_invalid_wire() {
    let valid = x"02010203012c01000001ffffffff01070000000109000000";
    let mut partial = vector[];
    let mut i = 0;
    while (i < valid.length()) { assert!(policy::decode_settings(&partial).is_none()); partial.push_back(valid[i]); i = i + 1; };
    partial.push_back(0); assert!(policy::decode_settings(&partial).is_none());
    assert!(policy::decode_settings(&vector[4,0,0,0,0,0,0,0]).is_none());
    assert!(policy::decode_settings(&vector[2,4,0,0,0,0,0,0]).is_none());
    assert!(policy::decode_settings(&vector[2,0,5,0,0,0,0,0]).is_none());
    assert!(policy::decode_settings(&vector[2,0,0,4,0,0,0,0]).is_none());
    assert!(policy::decode_settings(&vector[2,0,0,0,17,0,0,0]).is_none());
    assert!(policy::decode_settings(&vector[2,0,0,0,1,0,0,0,0,0,0,0]).is_none());
    assert!(policy::decode_settings(&x"02000000010700000001070000000000").is_none());
    assert!(policy::decode_settings(&x"02000000020700000007000000000000").is_none());
}
#[test]
fun malformed_descriptions() {
    vector[b"", b"ordinary", b"\n[cradleos-turret:v2:0200000000000000]", b"\n[cradleos-turret:v1:",
        b"\n[cradleos-turret:v1:]", b"\n[cradleos-turret:v1:0]", b"\n[cradleos-turret:v1:02000000000000zz]",
        b"\n[cradleos-turret:v1:0200000000000000]tail"].do!(|b| { assert!(policy::read_settings(utf8(b)).is_none()); });
    let mut too_long = vector[];
    let mut i = 0u64; while(i < 8193) { too_long.push_back(65); i = i + 1; };
    assert!(policy::read_settings(utf8(too_long)).is_none());
}
#[test]
fun owner_and_same_tribe_always_safe() {
    let r = evaluate(bytes(2), vector[candidate(1,100,8,31,50,true,2),candidate(2,101,7,31,50,true,2),candidate(3,102,8,31,50,false,1)]);
    assert_eq!(r.length(),1); assert_eq!(r[0].return_target_item_id(),3);
}
#[test]
fun explicit_hostile_override_and_friend_safety() {
    let raw = x"02000002016600000001650000000000"; // friend102, hostile101
    let r = evaluate(raw, vector[candidate(1,101,7,31,50,true,2),candidate(2,102,8,31,50,true,2)]);
    assert_eq!(r.length(),1); assert_eq!(r[0].return_target_item_id(),1);
}
#[test]
fun modes_and_stopped() {
    let cs = vector[candidate(1,101,8,31,50,false,1),candidate(2,102,8,31,50,true,2),candidate(3,103,8,31,50,true,3)];
    assert_eq!(evaluate(bytes(0),cs).length(),0);
    let r = evaluate(bytes(1),cs); assert_eq!(r.length(),1); assert_eq!(r[0].return_target_item_id(),2);
    assert_eq!(evaluate(bytes(2),cs).length(),2); assert_eq!(evaluate(bytes(3),cs).length(),0);
    assert_eq!(evaluate(vector[2,0,0,0,0,0,0,0],cs).length(),3);
}
#[test]
fun marked_tribe_does_not_override_same_tribe() {
    let r = evaluate(x"030000020000000107000000",vector[candidate(1,101,7,31,1,true,2)]);
    assert_eq!(r.length(),0);
    let r = evaluate(x"030000020000000108000000",vector[candidate(1,101,8,31,1,false,1)]);
    assert_eq!(r.length(),1);
}
#[test]
fun health_clamped_and_preferred_class() {
    let cs = vector[candidate(1,101,8,31,150,false,1),candidate(2,102,8,25,0,true,2),candidate(3,103,8,31,5,false,1)];
    let r = evaluate(vector[2,1,1,2,0,0,0,0],cs);
    assert_eq!(r[0].return_priority_weight(),1001); assert_eq!(r[1].return_priority_weight(),101); assert_eq!(r[2].return_priority_weight(),1096);
    assert_eq!(evaluate(vector[2,0,1,3,0,0,0,0],cs).length(),2);
}
#[test]
fun npcs_and_unknown_turret_strict_class() {
    let cs=vector[candidate(1,0,0,0,50,true,2)];
    assert_eq!(evaluate(bytes(1),cs).length(),1);
    assert_eq!(evaluate(vector[2,0,1,3,0,0,0,0],cs).length(),0);
    let cfg=policy::decode_settings(&vector[2,0,1,3,0,0,0,0]).destroy_some();
    assert_eq!(policy::evaluate(&cfg,&turret::unpack_candidate_list(bcs::to_bytes(&cs)),100,7,99999).length(),0);
}

fun save(ts: &mut ts::Scenario, cid: ID, tid: ID) {
    let mut c = ts::take_shared_by_id<Character>(ts,cid);
    let mut t = ts::take_shared_by_id<Turret>(ts,tid);
    let (cap, receipt) = c.borrow_owner_cap<Turret>(ts::receiving_ticket_by_id(t.owner_cap_id()), ts.ctx());
    policy::save_settings(&mut t,&cap,bytes(2),false);
    c.return_owner_cap(cap,receipt); ts::return_shared(c); ts::return_shared(t);
}
#[test]
fun official_four_argument_callback_and_restore() {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7);
    let nid=create_network_node(&mut s,cid); let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1);
    bring_network_node_online(&mut s,cid,nid); bring_turret_online(&mut s,cid,tid,nid);
    ts::next_tx(&mut s,user_a()); save(&mut s,cid,tid);
    ts::next_tx(&mut s,user_a());
    let mut c=ts::take_shared_by_id<Character>(&s,cid); let mut t=ts::take_shared_by_id<Turret>(&s,tid);
    let data=bcs::to_bytes(&vector[candidate(1,100,7,31,50,true,2),candidate(2,101,8,31,50,true,2)]);
    let out=policy::get_target_priority_list(&t,&c,data,t.verify_online());
    let result=turret::unpack_return_priority_list(out);
    assert_eq!(result.length(),1); assert_eq!(result[0].return_target_item_id(),2);
    let (cap,receipt)=c.borrow_owner_cap<Turret>(ts::receiving_ticket_by_id(t.owner_cap_id()),s.ctx());
    turret::update_metadata_description(&mut t,&cap,utf8(b"invalid configuration"));
    assert_eq!(turret::unpack_return_priority_list(policy::get_target_priority_list(&t,&c,bcs::to_bytes(&vector[candidate(2,101,8,31,50,true,2)]),t.verify_online())).length(),0);
    policy::save_settings(&mut t,&cap,bytes(2),false);
    policy::restore_defaults(&mut t,&cap); assert!(!t.is_extension_configured());
    assert_eq!(world::metadata::description(t.metadata().borrow()),utf8(b"invalid configuration"));
    c.return_owner_cap(cap,receipt); ts::return_shared(c); ts::return_shared(t); ts::end(s);
}
#[test]
#[expected_failure(abort_code=character::ESenderCannotAccessCharacter)]
fun wrong_wallet_cannot_configure() {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7); let nid=create_network_node(&mut s,cid); let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1);
    ts::next_tx(&mut s,user_b()); save(&mut s,cid,tid); ts::end(s);
}
#[test]
fun frozen_ours_still_editable() {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7); let nid=create_network_node(&mut s,cid); let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1);
    ts::next_tx(&mut s,user_a()); save(&mut s,cid,tid);
    ts::next_tx(&mut s,user_a());
    let mut c=ts::take_shared_by_id<Character>(&s,cid); let mut t=ts::take_shared_by_id<Turret>(&s,tid);
    let (cap,receipt)=c.borrow_owner_cap<Turret>(ts::receiving_ticket_by_id(t.owner_cap_id()),s.ctx());
    t.freeze_extension_config(&cap); policy::save_settings(&mut t,&cap,bytes(0),false);
    assert!(t.is_extension_frozen()); c.return_owner_cap(cap,receipt); ts::return_shared(c); ts::return_shared(t); ts::end(s);
}
public struct OtherAuth has drop {}
#[test]
#[expected_failure(abort_code=2, location=cradleos_turret::turret)]
fun frozen_other_rejected() {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7); let nid=create_network_node(&mut s,cid); let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1);
    ts::next_tx(&mut s,user_a());
    let mut c=ts::take_shared_by_id<Character>(&s,cid); let mut t=ts::take_shared_by_id<Turret>(&s,tid);
    let (cap,receipt)=c.borrow_owner_cap<Turret>(ts::receiving_ticket_by_id(t.owner_cap_id()),s.ctx());
    t.authorize_extension<OtherAuth>(&cap); t.freeze_extension_config(&cap); policy::save_settings(&mut t,&cap,bytes(2),false);
    c.return_owner_cap(cap,receipt); ts::return_shared(c); ts::return_shared(t); ts::end(s);
}

#[test]
#[expected_failure(abort_code=turret::ETurretNotAuthorized)]
fun wrong_turret_cap_rejected() {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7); let nid=create_network_node(&mut s,cid);
    let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1); let tid2=create_turret(&mut s,cid,nid,6002);
    ts::next_tx(&mut s,user_a());
    let mut c=ts::take_shared_by_id<Character>(&s,cid); let mut t=ts::take_shared_by_id<Turret>(&s,tid);
    let other=ts::take_shared_by_id<Turret>(&s,tid2);
    let (cap,receipt)=c.borrow_owner_cap<Turret>(ts::receiving_ticket_by_id(other.owner_cap_id()),s.ctx());
    policy::save_settings(&mut t,&cap,bytes(2),false);
    c.return_owner_cap(cap,receipt); ts::return_shared(c); ts::return_shared(t); ts::return_shared(other); ts::end(s);
}
#[test]
#[expected_failure(abort_code=2,location=cradleos_turret::turret)]
fun other_binding_requires_opt_in() { binding_case(false,false,false); }
#[test]
fun other_binding_explicit_replace() { binding_case(true,false,false); }
#[test]
#[expected_failure(abort_code=2,location=cradleos_turret::turret)]
fun cannot_restore_another_app() { binding_case(false,true,false); }
#[test]
#[expected_failure(abort_code=turret::EExtensionConfigFrozen)]
fun cannot_restore_frozen_ours() { binding_case(true,true,true); }
fun binding_case(replace: bool, restore: bool, freeze: bool) {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7); let nid=create_network_node(&mut s,cid); let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1);
    ts::next_tx(&mut s,user_a());
    let mut c=ts::take_shared_by_id<Character>(&s,cid); let mut t=ts::take_shared_by_id<Turret>(&s,tid);
    let (cap,receipt)=c.borrow_owner_cap<Turret>(ts::receiving_ticket_by_id(t.owner_cap_id()),s.ctx());
    t.update_metadata_name(&cap,utf8(b"Keep this name")); t.update_metadata_url(&cap,utf8(b"https://example.org/original"));
    t.authorize_extension<OtherAuth>(&cap);
    if (!restore || freeze) policy::save_settings(&mut t,&cap,bytes(2),replace);
    if (freeze) t.freeze_extension_config(&cap);
    if (restore) policy::restore_defaults(&mut t,&cap);
    assert_eq!(world::metadata::name(t.metadata().borrow()),utf8(b"Keep this name"));
    assert_eq!(world::metadata::url(t.metadata().borrow()),utf8(b"https://example.org/original"));
    c.return_owner_cap(cap,receipt); ts::return_shared(c); ts::return_shared(t); ts::end(s);
}
#[test]
#[expected_failure(abort_code=3,location=cradleos_turret::turret)]
fun mismatched_receipt_rejected() {
    let mut s=ts::begin(admin()); setup(&mut s);
    let cid=create_character(&mut s,user_a(),100,7); let nid=create_network_node(&mut s,cid);
    let tid=create_turret(&mut s,cid,nid,TURRET_ITEM_ID_1); let other_id=create_turret(&mut s,cid,nid,6002);
    bring_network_node_online(&mut s,cid,nid); bring_turret_online(&mut s,cid,other_id,nid);
    ts::next_tx(&mut s,user_a());
    let c=ts::take_shared_by_id<Character>(&s,cid); let t=ts::take_shared_by_id<Turret>(&s,tid); let other=ts::take_shared_by_id<Turret>(&s,other_id);
    policy::get_target_priority_list(&t,&c,vector[],other.verify_online());
    ts::return_shared(c); ts::return_shared(t); ts::return_shared(other); ts::end(s);
}
