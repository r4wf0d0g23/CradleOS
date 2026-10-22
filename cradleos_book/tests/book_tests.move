#[test_only]
module cradleos_book::book_tests;
use cradleos_book::{book::{Self, Book, Market, Ticket, AdminCap, Entitlement}, price};
use sui::{test_scenario as ts, clock::{Self, Clock}, coin::{Self, Coin}, sui::SUI};
use world::{test_helpers as wh, character::{Self, Character}, access::AdminACL, object_registry::ObjectRegistry};
fun at(sc: &mut ts::Scenario, seconds: u64): Clock {
    let mut c = clock::create_for_testing(sc.ctx()); clock::set_for_testing(&mut c, seconds * 1000); c
}
fun setup(): (ts::Scenario, ID, ID) {
    let mut sc = ts::begin(wh::admin()); wh::setup_world(&mut sc);
    sc.next_tx(wh::admin()); book::setup_for_testing<SUI>(wh::tenant(), sc.ctx());
    let mut registry = sc.take_shared<ObjectRegistry>(); let acl = sc.take_shared<AdminACL>();
    let a = character::create_character(&mut registry, &acl, 101, wh::tenant(), 1, @0x11, b"A".to_string(), sc.ctx());
    let b = character::create_character(&mut registry, &acl, 102, wh::tenant(), 1, @0x22, b"B".to_string(), sc.ctx());
    let a_id = object::id(&a); let b_id = object::id(&b);
    character::share_character(a, &acl, sc.ctx()); character::share_character(b, &acl, sc.ctx());
    ts::return_shared(registry); ts::return_shared(acl);
    sc.next_tx(wh::admin()); create(&mut sc,1,100,1300,1900);
    (sc, a_id, b_id)
}
fun create(sc: &mut ts::Scenario, asset: u8, strike: u64, starts: u64, ends: u64) {
    let mut b = sc.take_shared<Book<SUI>>(); let cap = sc.take_from_sender<AdminCap>(); let c = at(sc,1000);
    price::create(&mut b,&cap,asset,strike,starts,ends,&c,sc.ctx());
    clock::destroy_for_testing(c); ts::return_shared(b); ts::return_to_sender(sc,cap);
}
fun bet(sc: &mut ts::Scenario, char_id: ID, who: address, side: u8, value: u64, seconds: u64): ID {
    sc.next_tx(who); let b = sc.take_shared<Book<SUI>>(); let mut m = sc.take_shared<Market<SUI>>();
    let player = sc.take_shared_by_id<Character>(char_id); let c = at(sc, seconds); let funds = coin::mint_for_testing<SUI>(value, sc.ctx());
    book::place_bet(&b,&mut m,&player,side,funds,&c,sc.ctx());
    ts::return_shared(b); ts::return_shared(m); ts::return_shared(player); clock::destroy_for_testing(c);
    sc.next_tx(who); sc.most_recent_id_for_sender<Ticket<SUI>>().destroy_some()
}
// Package-private accounting interface. Authentication is tested separately in price_tests.
fun record(sc: &mut ts::Scenario, asset:u8, exponent:u8, value:u64, conf:u64, previous:u64, published:u64, now:u64) {
    sc.next_tx(@0x55); let mut m=sc.take_shared<Market<SUI>>(); let c=at(sc,now);
    book::record_price(&mut m,book::feed(asset),exponent,value,conf,previous,published,&c);
    ts::return_shared(m); clock::destroy_for_testing(c);
}
fun finish(sc:&mut ts::Scenario,seconds:u64,expected:u8) {
    sc.next_tx(@0x55);let mut m=sc.take_shared<Market<SUI>>();let c=at(sc,seconds);
    book::finalize(&mut m,&c);assert!(book::result(&m)==expected,100);ts::return_shared(m);clock::destroy_for_testing(c);
}
fun claim(sc:&mut ts::Scenario,who:address,id:ID,payout:u64) {
    sc.next_tx(who);let mut m=sc.take_shared<Market<SUI>>();let before=book::escrow(&m);
    let t=sc.take_from_sender_by_id<Ticket<SUI>>(id);let mut e=sc.take_shared_by_id<Entitlement<SUI>>(book::entitlement_id(&t));
    book::claim(&mut m,t,&mut e,sc.ctx());assert!(book::paid(&e)&&book::payout(&e)==payout,101);ts::return_shared(e);
    assert!(book::escrow(&m)==before-payout,102);ts::return_shared(m);
    sc.next_tx(who);if(payout>0){let c=sc.take_from_sender<Coin<SUI>>();assert!(coin::value(&c)==payout,103);coin::burn_for_testing(c);};
}
fun pause(sc:&mut ts::Scenario){
    sc.next_tx(wh::admin());let mut b=sc.take_shared<Book<SUI>>();let cap=sc.take_from_sender<AdminCap>();
    book::set_paused(&mut b,&cap,true);ts::return_shared(b);ts::return_to_sender(sc,cap);
}
#[test]
fun asymmetric_pool_exact_payout(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);
    record(&mut sc,1,8,101,1,1899,1900,1900);finish(&mut sc,5500,1);claim(&mut sc,@0x22,tb,0);claim(&mut sc,@0x11,ta,10);ts::end(sc);}
#[test]
fun cumulative_rounding_no_dust(){let(mut sc,a,b)=setup();let t1=bet(&mut sc,a,@0x11,1,1,1000);let t2=bet(&mut sc,a,@0x11,1,1,1000);let t3=bet(&mut sc,a,@0x11,1,1,1000);let tb=bet(&mut sc,b,@0x22,2,2,1000);
    record(&mut sc,1,8,101,1,1899,1900,1900);finish(&mut sc,5500,1);claim(&mut sc,@0x11,t2,1);claim(&mut sc,@0x11,t1,2);claim(&mut sc,@0x11,t3,2);claim(&mut sc,@0x22,tb,0);ts::end(sc);}
#[test]
fun equality_is_explicit_side_b(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);
    record(&mut sc,1,8,100,1,1899,1900,1900);finish(&mut sc,5500,2);claim(&mut sc,@0x11,ta,0);claim(&mut sc,@0x22,tb,10);ts::end(sc);}
#[test]
fun no_proof_refunds_during_pause(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);
    pause(&mut sc);finish(&mut sc,5500,3);claim(&mut sc,@0x11,ta,3);claim(&mut sc,@0x22,tb,7);ts::end(sc);}
#[test]
fun one_sided_pool_refunds(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,3,1000);record(&mut sc,1,8,101,1,1899,1900,1900);finish(&mut sc,5500,3);claim(&mut sc,@0x11,t,3);ts::end(sc);}
#[test]
fun proof_and_payout_work_during_pause(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);pause(&mut sc);
    record(&mut sc,1,8,99,0,1899,1900,5499);finish(&mut sc,5500,2);claim(&mut sc,@0x22,tb,10);claim(&mut sc,@0x11,ta,0);ts::end(sc);}
#[test]
fun stranger_push_pays_fixed_beneficiary_and_replay_is_noop(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,7,1000);
    let ticket=sc.take_from_sender_by_id<Ticket<SUI>>(t);let eid=book::entitlement_id(&ticket);ts::return_to_sender(&sc,ticket);finish(&mut sc,5500,3);
    sc.next_tx(@0x55);let mut m=sc.take_shared<Market<SUI>>();let mut e=sc.take_shared_by_id<Entitlement<SUI>>(eid);
    book::claim_for(&mut m,&mut e,sc.ctx());book::claim_for(&mut m,&mut e,sc.ctx());assert!(book::paid(&e)&&book::payout(&e)==7&&book::escrow(&m)==0,104);
    ts::return_shared(m);ts::return_shared(e);sc.next_tx(@0x55);assert!(sc.ids_for_sender<Coin<SUI>>().is_empty(),105);
    sc.next_tx(@0x11);let c=sc.take_from_sender<Coin<SUI>>();assert!(coin::value(&c)==7,106);coin::burn_for_testing(c);
    sc.next_tx(@0x11);let mut m=sc.take_shared<Market<SUI>>();let ticket=sc.take_from_sender_by_id<Ticket<SUI>>(t);let mut e=sc.take_shared_by_id<Entitlement<SUI>>(eid);book::claim(&mut m,ticket,&mut e,sc.ctx());assert!(book::payout(&e)==7&&book::escrow(&m)==0,107);ts::return_shared(m);ts::return_shared(e);ts::end(sc);}
#[test]
fun maximum_pool_u128_math(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,18446744073709551614,1000);let tb=bet(&mut sc,b,@0x22,2,1,1000);
    record(&mut sc,1,8,101,1,1899,1900,1900);finish(&mut sc,5500,1);claim(&mut sc,@0x22,tb,0);claim(&mut sc,@0x11,ta,18446744073709551615);ts::end(sc);}
#[test]
fun identical_verified_price_replay_is_idempotent(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1899,1900,1900);record(&mut sc,1,8,101,1,1899,1900,1901);finish(&mut sc,5500,3);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun late_bet(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x11,1,1,1300);ts::end(sc);}
#[test] #[expected_failure(abort_code=3,location=book)]
fun zero_bet(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x11,1,0,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=1,location=book)]
fun invalid_side(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x11,3,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=0,location=book)]
fun wrong_character(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x22,1,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=8,location=book)]
fun paused_bet(){let(mut sc,a,_)=setup();pause(&mut sc);bet(&mut sc,a,@0x11,1,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_feed(){let(mut sc,_,_)=setup();record(&mut sc,2,8,101,1,1899,1900,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_exponent(){let(mut sc,_,_)=setup();record(&mut sc,1,7,101,1,1899,1900,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun stale_price(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1898,1899,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun later_cherry_picked_price(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1900,1901,1901);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun excessively_late_first_update(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1899,1961,1961);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun future_price(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1899,1901,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun wide_confidence(){let(mut sc,_,_)=setup();record(&mut sc,1,8,100,2,1899,1900,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun zero_price(){let(mut sc,_,_)=setup();record(&mut sc,1,8,0,0,1899,1900,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun conflicting_price(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1899,1900,1900);record(&mut sc,1,8,102,1,1899,1900,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun late_proof(){let(mut sc,_,_)=setup();record(&mut sc,1,8,101,1,1899,1900,5500);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun early_finalize(){let(mut sc,_,_)=setup();finish(&mut sc,5499,3);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun double_finalize(){let(mut sc,_,_)=setup();finish(&mut sc,5500,3);finish(&mut sc,5501,3);ts::end(sc);}
#[test] #[expected_failure(abort_code=6,location=book)]
fun early_claim(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,1,1000);claim(&mut sc,@0x11,t,0);ts::end(sc);}
#[test] #[expected_failure]
fun pool_overflow(){let(mut sc,a,b)=setup();bet(&mut sc,a,@0x11,1,18446744073709551615,1000);bet(&mut sc,b,@0x22,2,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=1,location=book)]
fun unknown_asset(){let(mut sc,_,_)=setup();sc.next_tx(wh::admin());create(&mut sc,3,100,1300,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=1,location=book)]
fun lead_time(){let(mut sc,_,_)=setup();sc.next_tx(wh::admin());create(&mut sc,1,100,1299,1900);ts::end(sc);}
#[test] #[expected_failure(abort_code=7,location=book)]
fun claim_other_market(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,3,1000);sc.next_tx(wh::admin());create(&mut sc,2,100,1300,1900);finish(&mut sc,5500,3);claim(&mut sc,@0x11,t,3);ts::end(sc);}
#[test] #[expected_failure(abort_code=0,location=book)]
fun cap_book_bound(){let(mut sc,_,_)=setup();sc.next_tx(wh::admin());let cap=sc.take_from_sender<AdminCap>();let old=object::id(&cap);ts::return_to_sender(&sc,cap);
    book::setup_for_testing<SUI>(wh::tenant(),sc.ctx());sc.next_tx(wh::admin());let cap=sc.take_from_sender_by_id<AdminCap>(old);let mut b=sc.take_shared<Book<SUI>>();book::set_paused(&mut b,&cap,true);ts::return_shared(b);ts::return_to_sender(&sc,cap);ts::end(sc);}
#[test] #[expected_failure(abort_code=0,location=book)]
fun creator_wallet_cannot_bet(){let(mut sc,_,_)=setup();sc.next_tx(wh::admin());let mut r=sc.take_shared<ObjectRegistry>();let acl=sc.take_shared<AdminACL>();let ch=character::create_character(&mut r,&acl,103,wh::tenant(),1,wh::admin(),b"Creator".to_string(),sc.ctx());let id=object::id(&ch);character::share_character(ch,&acl,sc.ctx());ts::return_shared(r);ts::return_shared(acl);bet(&mut sc,id,wh::admin(),1,1,1000);ts::end(sc);}
