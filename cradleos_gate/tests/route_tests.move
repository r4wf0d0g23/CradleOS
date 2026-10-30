#[test_only]
module cradleos_gate::route_tests;

use std::{bcs, string::utf8, unit_test::assert_eq};
use sui::{clock, test_scenario as ts};
use world::{
    access::{AdminACL, OwnerCap, ServerAddressRegistry},
    character::{Self, Character},
    energy::EnergyConfig,
    gate::{Self, Gate, GateConfig, JumpPermit},
    location,
    network_node::{Self, NetworkNode},
    object_registry::ObjectRegistry,
    test_helpers::{Self, admin, governor, server_admin, tenant, user_a, user_b}
};

// Gate constants
const GATE_TYPE_ID_1: u64 = 8888;
const GATE_TYPE_ID_2: u64 = 8889;
const GATE_ITEM_ID_1: u64 = 7001;
const GATE_ITEM_ID_2: u64 = 7002;

// TODO: Move to test_helpers
// Network node constants
const MS_PER_SECOND: u64 = 1000;
const NWN_TYPE_ID: u64 = 111000;
const NWN_ITEM_ID: u64 = 5000;
const FUEL_MAX_CAPACITY: u64 = 1000;
const FUEL_BURN_RATE_IN_MS: u64 = 3600 * MS_PER_SECOND;
const MAX_PRODUCTION: u64 = 100;
const FUEL_TYPE_ID: u64 = 1;
const FUEL_VOLUME: u64 = 10;

// Mock extension witness types
public struct GateAuth has drop {}
public struct WrongGateAuth has drop {}
use cradleos_gate::route::{Self as r, Registry, Route};
use sui::{coin::{Self, Coin}, sui::SUI};

/// TODO: Simulate a builder rule: submit a corpse, receive a ticket.
/// In tests, this just issues a ticket to `character.character_address()` via extension logic.
public fun claim_ticket(
    gate_a: &Gate,
    gate_b: &Gate,
    character: &Character,
    expires_at_timestamp_ms: u64,
    ctx: &mut TxContext,
) {
    // todo: add some requirements to claim a ticket
    gate::issue_jump_permit<GateAuth>(
        gate_a,
        gate_b,
        character,
        GateAuth {},
        expires_at_timestamp_ms,
        ctx,
    );
}

fun setup(ts: &mut ts::Scenario) {
    test_helpers::setup_world(ts);
    test_helpers::configure_fuel(ts);
    test_helpers::configure_assembly_energy(ts);
    test_helpers::register_server_address(ts);

    ts::next_tx(ts, governor());
    gate::init_for_testing(ts.ctx());

    // Configure max distance for our gate type
    ts::next_tx(ts, admin());
    {
        let admin_acl = ts::take_shared<AdminACL>(ts);
        let mut gate_config = ts::take_shared<GateConfig>(ts);
        gate::set_max_distance(
            &mut gate_config,
            &admin_acl,
            GATE_TYPE_ID_1,
            1_000_000_000,
            ts.ctx(),
        );
        ts::return_shared(gate_config);
        ts::return_shared(admin_acl);
    };
}

fun create_character(ts: &mut ts::Scenario, user: address, item_id: u32): ID {
    ts::next_tx(ts, admin());
    let admin_acl = ts::take_shared<AdminACL>(ts);
    let mut registry = ts::take_shared<ObjectRegistry>(ts);
    let character = character::create_character(
        &mut registry,
        &admin_acl,
        item_id,
        tenant(),
        100,
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

fun create_gate(
    ts: &mut ts::Scenario,
    character_id: ID,
    nwn_id: ID,
    type_id: u64,
    item_id: u64,
): ID {
    ts::next_tx(ts, admin());
    let mut registry = ts::take_shared<ObjectRegistry>(ts);
    let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
    let character = ts::take_shared_by_id<Character>(ts, character_id);
    let admin_acl = ts::take_shared<AdminACL>(ts);
    let gate_obj = gate::anchor(
        &mut registry,
        &mut nwn,
        &character,
        &admin_acl,
        item_id,
        type_id,
        test_helpers::get_verified_location_hash(),
        ts.ctx(),
    );
    let gate_id = object::id(&gate_obj);
    gate_obj.share_gate(&admin_acl, ts.ctx());
    ts::return_shared(character);
    ts::return_shared(nwn);
    ts::return_shared(registry);
    ts::return_shared(admin_acl);
    gate_id
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
        nwn.deposit_fuel_test(
            &owner_cap,
            FUEL_TYPE_ID,
            FUEL_VOLUME,
            10,
            &clock,
        );
        nwn.online(&owner_cap, &clock);
        character.return_owner_cap(owner_cap, receipt);
        ts::return_shared(nwn);
        ts::return_shared(character);
        clock.destroy_for_testing();
    };
}

fun link_and_online_gates(
    ts: &mut ts::Scenario,
    character_id: ID,
    nwn_id: ID,
    gate_a_id: ID,
    gate_b_id: ID,
) {
    ts::next_tx(ts, user_a());
    {
        let mut nwn = ts::take_shared_by_id<NetworkNode>(ts, nwn_id);
        let energy_config = ts::take_shared<EnergyConfig>(ts);
        let gate_config = ts::take_shared<GateConfig>(ts);
        let server_registry = ts::take_shared<ServerAddressRegistry>(ts);
        let admin_acl = ts::take_shared<AdminACL>(ts);
        let mut gate_a = ts::take_shared_by_id<Gate>(ts, gate_a_id);
        let mut gate_b = ts::take_shared_by_id<Gate>(ts, gate_b_id);
        let mut character = ts::take_shared_by_id<Character>(ts, character_id);

        let owner_cap_a_id = gate_a.owner_cap_id();
        let owner_cap_b_id = gate_b.owner_cap_id();
        let gate_a_ticket = ts::receiving_ticket_by_id<OwnerCap<Gate>>(owner_cap_a_id);
        let gate_b_ticket = ts::receiving_ticket_by_id<OwnerCap<Gate>>(owner_cap_b_id);
        let (owner_cap_a, receipt_a) = character.borrow_owner_cap<Gate>(gate_a_ticket, ts.ctx());
        let (owner_cap_b, receipt_b) = character.borrow_owner_cap<Gate>(gate_b_ticket, ts.ctx());

        let proof = test_helpers::construct_location_proof(
            test_helpers::get_verified_location_hash(),
        );
        let proof_bytes = bcs::to_bytes(&proof);
        let clock = clock::create_for_testing(ts.ctx());
        gate_a.link_gates(
            &mut gate_b,
            &gate_config,
            &server_registry,
            &admin_acl,
            &owner_cap_a,
            &owner_cap_b,
            proof_bytes,
            &clock,
            ts.ctx(),
        );

        gate_a.online(&mut nwn, &energy_config, &owner_cap_a);
        gate_b.online(&mut nwn, &energy_config, &owner_cap_b);

        clock.destroy_for_testing();
        character.return_owner_cap(owner_cap_a, receipt_a);
        character.return_owner_cap(owner_cap_b, receipt_b);
        ts::return_shared(character);
        ts::return_shared(gate_a);
        ts::return_shared(gate_b);
        ts::return_shared(nwn);
        ts::return_shared(energy_config);
        ts::return_shared(gate_config);
        ts::return_shared(server_registry);
        ts::return_shared(admin_acl);
    };
}

fun ready(): (ts::Scenario, ID, ID, ID, ID) {
    let mut s = ts::begin(governor()); setup(&mut s);
    let cid = create_character(&mut s, user_a(), 1234);
    let nwn = create_network_node(&mut s, cid);
    let a = create_gate(&mut s, cid, nwn, GATE_TYPE_ID_1, GATE_ITEM_ID_1);
    let b = create_gate(&mut s, cid, nwn, GATE_TYPE_ID_1, GATE_ITEM_ID_2);
    bring_network_node_online(&mut s, cid, nwn);
    link_and_online_gates(&mut s, cid, nwn, a, b);
    ts::next_tx(&mut s, user_a()); r::init_for_testing(s.ctx());
    ts::next_tx(&mut s, user_a());
    let mut registry = ts::take_shared<Registry>(&s);
    let mut ga = ts::take_shared_by_id<Gate>(&s, a); let mut gb = ts::take_shared_by_id<Gate>(&s, b);
    let mut c = ts::take_shared_by_id<Character>(&s, cid);
    let (ca, ra) = c.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(ga.owner_cap_id()), s.ctx());
    let (cb, rb) = c.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()), s.ctx());
    let mut route = r::create<SUI>(&mut registry, &mut ga, &mut gb, &ca, &cb, utf8(b"Route"), s.ctx());
    r::configure(&mut route, &ca, &cb, 0, utf8(b"Route"),
        r::rules(4, 100, vector[], vector[], vector[], vector[], 0, 0, 0, 0), r::rates(100, 1000, 300000, 0));
    r::set_locked(&mut route, &ca, &cb, 1, false);
    r::share(route); c.return_owner_cap(ca, ra); c.return_owner_cap(cb, rb);
    ts::return_shared(c); ts::return_shared(ga); ts::return_shared(gb); ts::return_shared(registry);
    (s, cid, a, b, nwn)
}
fun purchase(s: &mut ts::Scenario, cid: ID, a: ID, b: ID, pass: bool, payment: u64, now: u64, revision: u64) {
    ts::next_tx(s, user_a());
    let registry = ts::take_shared<Registry>(s); let mut route = ts::take_shared<Route<SUI>>(s);
    let ga = ts::take_shared_by_id<Gate>(s, a); let gb = ts::take_shared_by_id<Gate>(s, b);
    let c = ts::take_shared_by_id<Character>(s, cid); let mut clock = clock::create_for_testing(s.ctx());
    clock::set_for_testing(&mut clock, now);
    let coin = coin::mint_for_testing<SUI>(payment, s.ctx());
    if (pass) r::buy_pass(&registry, &mut route, &ga, &gb, &c, revision, coin, &clock, s.ctx())
    else r::request_permit(&registry, &mut route, &ga, &gb, &c, revision, coin, &clock, s.ctx());
    clock.destroy_for_testing(); ts::return_shared(c); ts::return_shared(ga); ts::return_shared(gb);
    ts::return_shared(registry); ts::return_shared(route);
}
fun configure(s: &mut ts::Scenario, cid: ID, a: ID, b: ID, rules: r::Rules, rates: r::Rates) {
    ts::next_tx(s, user_a()); let mut route = ts::take_shared<Route<SUI>>(s);
    let ga = ts::take_shared_by_id<Gate>(s, a); let gb = ts::take_shared_by_id<Gate>(s, b);
    let mut c = ts::take_shared_by_id<Character>(s, cid);
    let (ca, ra) = c.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(ga.owner_cap_id()), s.ctx());
    let (cb, rb) = c.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()), s.ctx());
    r::configure(&mut route, &ca, &cb, 2, utf8(b"Changed"), rules, rates);
    c.return_owner_cap(ca, ra); c.return_owner_cap(cb, rb);
    ts::return_shared(c); ts::return_shared(ga); ts::return_shared(gb); ts::return_shared(route);
}
fun public_rules(): r::Rules { r::rules(4, 100, vector[], vector[], vector[], vector[], 0, 0, 0, 0) }
fun default_rates(): r::Rates { r::rates(100, 1000, 300000, 0) }
fun jump(s: &mut ts::Scenario, cid: ID, a: ID, b: ID, now: u64) {
    ts::next_tx(s, user_a());
    let ga = ts::take_shared_by_id<Gate>(s, a); let gb = ts::take_shared_by_id<Gate>(s, b);
    let c = ts::take_shared_by_id<Character>(s, cid); let p = ts::take_from_sender<JumpPermit>(s);
    let mut clock = clock::create_for_testing(s.ctx()); clock::set_for_testing(&mut clock, now);
    gate::test_jump_with_permit(&ga, &gb, &c, p, &clock);
    clock.destroy_for_testing(); ts::return_shared(c); ts::return_shared(ga); ts::return_shared(gb);
}

#[test] fun paid_permit_actual_reverse_jump() {
    let (mut s, c, a, b, _) = ready(); purchase(&mut s,c,a,b,false,100,1000,2);
    jump(&mut s,c,b,a,2000);
    ts::next_tx(&mut s,user_a()); let route=ts::take_shared<Route<SUI>>(&s);
    assert_eq!(r::totals(&route),vector[1,0,100,0,100]); ts::return_shared(route); s.end();
}
#[test] fun pass_purchase_free_permit_then_expiry() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,true,1000,1000,2);
    purchase(&mut s,c,a,b,false,0,2000,2); jump(&mut s,c,a,b,3000);
    purchase(&mut s,c,a,b,false,100,301000,2); jump(&mut s,c,a,b,301001);
    ts::next_tx(&mut s,user_a()); let route=ts::take_shared<Route<SUI>>(&s);
    assert_eq!(r::totals(&route),vector[2,1,1100,0,1100]); ts::return_shared(route); s.end();
}
#[test, expected_failure(abort_code=7, location=cradleos_gate::route)] fun underpayment() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,false,99,1000,2); s.end();
}
#[test, expected_failure(abort_code=7, location=cradleos_gate::route)] fun overpayment() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,false,101,1000,2); s.end();
}
#[test, expected_failure(abort_code=4, location=cradleos_gate::route)] fun stale_quote() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,false,100,1000,1); s.end();
}
#[test, expected_failure(abort_code=1, location=cradleos_gate::route)] fun swapped_policy_endpoints() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,b,a,false,100,1000,2); s.end();
}
#[test, expected_failure(abort_code=10, location=cradleos_gate::route)] fun duplicate_active_pass() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,true,1000,1000,2);
    purchase(&mut s,c,a,b,true,1000,1001,2); s.end();
}
#[test, expected_failure(abort_code=9, location=cradleos_gate::route)] fun foreign_character() {
    let (mut s,_,a,b,_) = ready(); let other=create_character(&mut s,user_b(),5678);
    purchase(&mut s,other,a,b,false,100,1000,2); s.end();
}
#[test, expected_failure(abort_code=6, location=cradleos_gate::route)] fun deny_beats_pass_and_public() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,true,1000,1000,2);
    configure(&mut s,c,a,b,r::rules(4,100,vector[],vector[c],vector[],vector[c],0,0,0,0),default_rates());
    purchase(&mut s,c,a,b,false,0,1001,3); s.end();
}
#[test, expected_failure(abort_code=6, location=cradleos_gate::route)] fun closed_beats_friendly() {
    let (mut s,c,a,b,_) = ready();
    configure(&mut s,c,a,b,r::rules(0,100,vector[],vector[c],vector[],vector[],0,0,0,0),default_rates());
    purchase(&mut s,c,a,b,false,100,1001,3); s.end();
}
#[test, expected_failure(abort_code=6, location=cradleos_gate::route)] fun tribe_deny_beats_friendly() {
    let (mut s,c,a,b,_) = ready();
    configure(&mut s,c,a,b,r::rules(4,100,vector[],vector[c],vector[100],vector[],0,0,0,0),default_rates());
    purchase(&mut s,c,a,b,false,100,1001,3); s.end();
}
#[test] fun discounted_price_rounds_up() {
    let (mut s,c,a,b,_) = ready(); configure(&mut s,c,a,b,public_rules(),r::rates(101,1001,300000,5000));
    purchase(&mut s,c,a,b,false,51,1001,3); jump(&mut s,c,a,b,1002);
    purchase(&mut s,c,a,b,true,501,2000,3);
    ts::next_tx(&mut s,user_a()); let route=ts::take_shared<Route<SUI>>(&s);
    assert_eq!(r::totals(&route),vector[1,1,552,0,552]); ts::return_shared(route); s.end();
}
#[test, expected_failure(abort_code=8, location=cradleos_gate::route)] fun pass_not_sold_beyond_absolute_end() {
    let (mut s,c,a,b,_) = ready();
    configure(&mut s,c,a,b,r::rules(4,100,vector[],vector[],vector[],vector[],0,300001,0,0),default_rates());
    purchase(&mut s,c,a,b,true,1000,2000,3); s.end();
}
#[test, expected_failure(abort_code=gate::EJumpPermitExpired)] fun short_permit_expired_native_reject() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,false,100,1000,2);
    jump(&mut s,c,a,b,61000); s.end();
}
#[test, expected_failure(abort_code=gate::EJumpPermitExpired)] fun permit_clamped_to_pass_expiry() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,true,1000,1000,2);
    purchase(&mut s,c,a,b,false,0,300999,2); jump(&mut s,c,a,b,301000); s.end();
}
#[test, expected_failure(abort_code=gate::EJumpPermitExpired)] fun permit_clamped_to_window_end() {
    let (mut s,c,a,b,_) = ready();
    configure(&mut s,c,a,b,r::rules(4,100,vector[],vector[],vector[],vector[],0,5000,0,0),default_rates());
    purchase(&mut s,c,a,b,false,100,1000,3); jump(&mut s,c,a,b,5000); s.end();
}
#[test] fun native_lockdown_blocks_both_directions() {
    let (mut s,c,a,b,nwn) = ready(); purchase(&mut s,c,a,b,false,100,1000,2);
    ts::next_tx(&mut s,user_a()); let mut route=ts::take_shared<Route<SUI>>(&s);
    let mut ga=ts::take_shared_by_id<Gate>(&s,a); let gb=ts::take_shared_by_id<Gate>(&s,b);
    let mut ch=ts::take_shared_by_id<Character>(&s,c); let mut n=ts::take_shared_by_id<NetworkNode>(&s,nwn);
    let energy=ts::take_shared<EnergyConfig>(&s);
    let (ca,ra)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(ga.owner_cap_id()),s.ctx());
    let (cb,rb)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()),s.ctx());
    r::lockdown(&mut route,&mut ga,&gb,&ca,&cb,&mut n,&energy,2);
    assert!(!gate::is_online(&ga)); assert!(gate::is_online(&gb));
    ch.return_owner_cap(ca,ra); ch.return_owner_cap(cb,rb);
    ts::return_shared(ch); ts::return_shared(ga); ts::return_shared(gb);
    ts::return_shared(n); ts::return_shared(energy); ts::return_shared(route); s.end();
}
#[test] fun owner_claim_exact_proceeds() {
    let (mut s,c,a,b,_) = ready(); purchase(&mut s,c,a,b,true,1000,1000,2);
    ts::next_tx(&mut s,user_a()); let mut route=ts::take_shared<Route<SUI>>(&s);
    let ga=ts::take_shared_by_id<Gate>(&s,a); let gb=ts::take_shared_by_id<Gate>(&s,b);
    let mut ch=ts::take_shared_by_id<Character>(&s,c);
    let (ca,ra)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(ga.owner_cap_id()),s.ctx());
    let (cb,rb)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()),s.ctx());
    r::claim(&mut route,&ca,&cb,s.ctx()); assert_eq!(r::totals(&route),vector[0,1,1000,1000,0]);
    ch.return_owner_cap(ca,ra); ch.return_owner_cap(cb,rb);
    ts::return_shared(ch); ts::return_shared(ga); ts::return_shared(gb); ts::return_shared(route);
    ts::next_tx(&mut s,user_a()); let coin=ts::take_from_sender<Coin<SUI>>(&s);
    assert_eq!(coin::value(&coin),1000); coin::burn_for_testing(coin); s.end();
}
#[test] fun daily_window_and_overnight_end() {
    let day=r::rules(4,0,vector[],vector[],vector[],vector[],0,0,60,120);
    assert_eq!(r::window_end(&day,3600000),7200000);
    let night=r::rules(4,0,vector[],vector[],vector[],vector[],0,0,1380,60);
    assert_eq!(r::window_end(&night,82800000),90000000);
    assert_eq!(r::window_end(&night,1000),3600000);
}
#[test, expected_failure(abort_code=8, location=cradleos_gate::route)] fun exclusive_daily_end() {
    r::window_end(&r::rules(4,0,vector[],vector[],vector[],vector[],0,0,60,120),7200000);
}
#[test, expected_failure(abort_code=3, location=cradleos_gate::route)] fun invalid_discount() { r::rates(0,0,0,10001); }
#[test, expected_failure(abort_code=3, location=cradleos_gate::route)] fun invalid_pass_duration() { r::rates(0,1,0,0); }
#[test, expected_failure(abort_code=3, location=cradleos_gate::route)] fun duplicate_tribes() {
    r::rules(2,100,vector[200,200],vector[],vector[],vector[],0,0,0,0);
}
#[test] fun policy_modes_and_denies() {
    let cid=object::id_from_address(@0x1);
    let tribe=r::rules(1,100,vector[],vector[],vector[],vector[],0,0,0,0);
    assert!(r::permits(&tribe,cid,100)); assert!(!r::permits(&tribe,cid,200));
    let allies=r::rules(2,100,vector[200],vector[],vector[],vector[],0,0,0,0);
    assert!(r::permits(&allies,cid,200)); assert!(!r::permits(&allies,cid,0));
    let pilots=r::rules(3,0,vector[],vector[cid],vector[],vector[],0,0,0,0);
    assert!(r::permits(&pilots,cid,0)); assert!(!r::permits(&pilots,object::id_from_address(@0x2),100));
}

fun lock(s: &mut ts::Scenario,c:ID,a:ID,b:ID,nwn:ID) {
    ts::next_tx(s,user_a()); let mut route=ts::take_shared<Route<SUI>>(s);
    let mut ga=ts::take_shared_by_id<Gate>(s,a); let gb=ts::take_shared_by_id<Gate>(s,b);
    let mut ch=ts::take_shared_by_id<Character>(s,c); let mut n=ts::take_shared_by_id<NetworkNode>(s,nwn);
    let energy=ts::take_shared<EnergyConfig>(s);
    let (ca,ra)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(ga.owner_cap_id()),s.ctx());
    let (cb,rb)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()),s.ctx());
    r::lockdown(&mut route,&mut ga,&gb,&ca,&cb,&mut n,&energy,2);
    ch.return_owner_cap(ca,ra); ch.return_owner_cap(cb,rb);
    ts::return_shared(ch); ts::return_shared(ga); ts::return_shared(gb);
    ts::return_shared(n); ts::return_shared(energy); ts::return_shared(route);
}
#[test, expected_failure(abort_code=gate::ENotOnline)] fun lockdown_rejects_existing_reverse_permit() {
    let (mut s,c,a,b,nwn)=ready();purchase(&mut s,c,a,b,false,100,1000,2);
    lock(&mut s,c,a,b,nwn);jump(&mut s,c,b,a,1001);s.end();
}
#[test, expected_failure(abort_code=5,location=cradleos_gate::route)] fun locked_pass_holder_cannot_mint() {
    let (mut s,c,a,b,nwn)=ready();purchase(&mut s,c,a,b,true,1000,1000,2);
    lock(&mut s,c,a,b,nwn);purchase(&mut s,c,a,b,false,0,1001,3);s.end();
}
#[test, expected_failure(abort_code=0,location=cradleos_gate::route)] fun duplicate_noncanonical_owner_cap_rejected() {
    let (mut s,c,a,b,_)=ready();ts::next_tx(&mut s,user_a());
    let admin_acl=ts::take_shared<AdminACL>(&s);
    let fake=world::access::create_owner_cap_by_id<Gate>(a,&admin_acl,s.ctx());
    let ga=ts::take_shared_by_id<Gate>(&s,a);let gb=ts::take_shared_by_id<Gate>(&s,b);
    let mut ch=ts::take_shared_by_id<Character>(&s,c);let mut route=ts::take_shared<Route<SUI>>(&s);
    let (cb,rb)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()),s.ctx());
    r::configure(&mut route,&fake,&cb,2,utf8(b"Attacker"),public_rules(),default_rates());
    ch.return_owner_cap(cb,rb);world::access::transfer_owner_cap(fake,user_a());
    ts::return_shared(ch);ts::return_shared(ga);ts::return_shared(gb);ts::return_shared(route);ts::return_shared(admin_acl);s.end();
}
#[test, expected_failure(abort_code=11,location=cradleos_gate::route)] fun changed_destination_extension_rejects_sale() {
    let (mut s,c,a,b,_)=ready();ts::next_tx(&mut s,user_a());
    let mut gb=ts::take_shared_by_id<Gate>(&s,b);let mut ch=ts::take_shared_by_id<Character>(&s,c);
    let (cb,rb)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()),s.ctx());
    gate::authorize_extension<WrongGateAuth>(&mut gb,&cb);ch.return_owner_cap(cb,rb);
    ts::return_shared(ch);ts::return_shared(gb);purchase(&mut s,c,a,b,true,1000,1000,2);s.end();
}
#[test] fun deactivation_retains_claimable_proceeds_and_clears_extensions() {
    let (mut s,c,a,b,_)=ready();purchase(&mut s,c,a,b,true,1000,1000,2);
    ts::next_tx(&mut s,user_a());let mut registry=ts::take_shared<Registry>(&s);let mut route=ts::take_shared<Route<SUI>>(&s);
    let mut ga=ts::take_shared_by_id<Gate>(&s,a);let mut gb=ts::take_shared_by_id<Gate>(&s,b);let mut ch=ts::take_shared_by_id<Character>(&s,c);
    let (ca,ra)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(ga.owner_cap_id()),s.ctx());
    let (cb,rb)=ch.borrow_owner_cap<Gate>(ts::receiving_ticket_by_id(gb.owner_cap_id()),s.ctx());
    r::deactivate(&mut registry,&mut route,&mut ga,&mut gb,&ca,&cb,2);
    assert!(!gate::is_extension_configured(&ga)&&!gate::is_extension_configured(&gb));
    r::claim(&mut route,&ca,&cb,s.ctx());assert_eq!(r::totals(&route),vector[0,1,1000,1000,0]);
    ch.return_owner_cap(ca,ra);ch.return_owner_cap(cb,rb);
    ts::return_shared(ch);ts::return_shared(ga);ts::return_shared(gb);ts::return_shared(route);ts::return_shared(registry);s.end();
}
#[test, expected_failure(abort_code=1,location=cradleos_gate::route)] fun cross_tenant_pilot_rejected() {
    let (mut s,_,a,b,_)=ready();ts::next_tx(&mut s,admin());
    let acl=ts::take_shared<AdminACL>(&s);let mut registry=ts::take_shared<ObjectRegistry>(&s);
    let c=character::create_character(&mut registry,&acl,5678,utf8(b"foreign"),100,user_a(),utf8(b"Other"),s.ctx());
    let cid=object::id(&c);c.share_character(&acl,s.ctx());ts::return_shared(acl);ts::return_shared(registry);
    purchase(&mut s,cid,a,b,false,100,1000,2);s.end();
}
