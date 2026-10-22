#[test_only]
module cradleos_sports::sports_tests;
use cradleos_sports::sports::{Self as book, Book, Market, Ticket, AdminCap, Entitlement};
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
    sc.next_tx(wh::admin()); create(&mut sc);
    (sc, a_id, b_id)
}
fun create(sc: &mut ts::Scenario) {
    let mut b = sc.take_shared<Book<SUI>>(); let cap = sc.take_from_sender<AdminCap>(); let c = at(sc,1000);
    book::create_market(&mut b,&cap,1,b"Cavaliers".to_string(),b"76ers".to_string(),b"5765055".to_string(),h(1),b"{}".to_string(),2000,&c,sc.ctx());
    clock::destroy_for_testing(c); ts::return_shared(b); ts::return_to_sender(sc,cap);
}
fun h(x:u8):vector<u8> { let mut v=vector[];let mut i=0;while (i < 32){v.push_back(x);i=i+1};v }
fun bet(sc: &mut ts::Scenario, char_id: ID, who: address, side: u8, value: u64, seconds: u64): ID {
    sc.next_tx(who); let b = sc.take_shared<Book<SUI>>(); let mut m = sc.take_shared<Market<SUI>>();
    let player = sc.take_shared_by_id<Character>(char_id); let c = at(sc, seconds); let funds = coin::mint_for_testing<SUI>(value, sc.ctx());
    book::place_bet(&b,&mut m,&player,side,funds,&c,sc.ctx());
    ts::return_shared(b); ts::return_shared(m); ts::return_shared(player); clock::destroy_for_testing(c);
    sc.next_tx(who); sc.most_recent_id_for_sender<Ticket<SUI>>().destroy_some()
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

fun propose(sc:&mut ts::Scenario,who:address,outcome:u8,tuple:u8,block:u64,obs:u64,now:u64){
 sc.next_tx(who);let mut m=sc.take_shared<Market<SUI>>();let c=at(sc,now);let terms=book::terms_hash(&m);
 book::propose(&mut m,terms,outcome,h(tuple),h(9),block,obs,obs,&c,sc.ctx());ts::return_shared(m);clock::destroy_for_testing(c);
}
fun confirm(sc:&mut ts::Scenario,who:address,rev:u64,outcome:u8,tuple:u8,block:u64,obs:u64,now:u64){
 sc.next_tx(who);let mut m=sc.take_shared<Market<SUI>>();let c=at(sc,now);let terms=book::terms_hash(&m);
 book::confirm(&mut m,terms,rev,outcome,h(tuple),h(8),block,obs,obs,&c,sc.ctx());ts::return_shared(m);clock::destroy_for_testing(c);
}
fun finish(sc:&mut ts::Scenario,seconds:u64,expected:u8){
 sc.next_tx(@0x55);let mut m=sc.take_shared<Market<SUI>>();let c=at(sc,seconds);book::finalize(&mut m,&c);assert!(book::result(&m)==expected,100);ts::return_shared(m);clock::destroy_for_testing(c);
}
fun invalidate(sc:&mut ts::Scenario){sc.next_tx(@0x77);let mut m=sc.take_shared<Market<SUI>>();let c=at(sc,3000);let terms=book::terms_hash(&m);book::invalidate(&mut m,terms,1,h(4),&c,sc.ctx());assert!(book::result(&m)==3,110);ts::return_shared(m);clock::destroy_for_testing(c);}
#[test]
fun correct_result_fixed_recipient_payout(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);claim(&mut sc,@0x11,ta,10);claim(&mut sc,@0x22,tb,0);ts::end(sc);}
#[test]
fun side_two_and_pause_recovery(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);pause(&mut sc);propose(&mut sc,@0x77,2,2,100,3000,3000);confirm(&mut sc,@0x77,1,2,2,200,10200,10200);claim(&mut sc,@0x11,ta,0);claim(&mut sc,@0x22,tb,10);ts::end(sc);}
#[test]
fun fractional_original_stake_refund(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);propose(&mut sc,@0x77,3,3,100,3000,3000);confirm(&mut sc,@0x77,1,3,3,200,10200,10200);claim(&mut sc,@0x11,ta,3);claim(&mut sc,@0x22,tb,7);ts::end(sc);}
#[test]
fun one_sided_refund(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,3,1000);propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);claim(&mut sc,@0x11,t,3);ts::end(sc);}
#[test]
fun deadline_without_reporter_refund(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);pause(&mut sc);finish(&mut sc,174800,3);claim(&mut sc,@0x11,ta,3);claim(&mut sc,@0x22,tb,7);ts::end(sc);}
#[test]
fun candidate_at_deadline_refunds(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,174799,174799);finish(&mut sc,174800,3);ts::end(sc);}
#[test]
fun identical_retry_does_not_reset_hold(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);propose(&mut sc,@0x77,1,1,110,4000,4000);sc.next_tx(@0x55);let m=sc.take_shared<Market<SUI>>();assert!(book::revision(&m)==1&&book::candidate_at(&m)==3000,112);ts::return_shared(m);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);ts::end(sc);}
#[test]
fun revision_resets_hold(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);propose(&mut sc,@0x77,2,2,110,4000,4000);confirm(&mut sc,@0x77,2,2,2,200,11200,11200);ts::end(sc);}
#[test]
fun rule_change_refunds(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,3,1000);let tb=bet(&mut sc,b,@0x22,2,7,1000);propose(&mut sc,@0x77,1,1,100,2500,2500);invalidate(&mut sc);claim(&mut sc,@0x11,ta,3);claim(&mut sc,@0x22,tb,7);ts::end(sc);}
#[test] #[expected_failure(abort_code=0,location=book)]
fun wrong_reporter(){let(mut sc,_,_)=setup();propose(&mut sc,@0x66,1,1,100,3000,3000);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun early_result(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,1999,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun early_confirm(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10199,10199);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun stale_revision(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);propose(&mut sc,@0x77,2,2,110,4000,4000);confirm(&mut sc,@0x77,1,2,2,200,11200,11200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_tuple(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,2,200,10200,10200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_result(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,2,1,200,10200,10200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun same_block(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,100,10200,10200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun cached_confirmation(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10199,10200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun stale_observation(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3301);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun future_observation(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3001,3000);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun exact_deadline_no_winner(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,174800,174800);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun invalidated_never_revives(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,2500,2500);invalidate(&mut sc);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun no_candidate(){let(mut sc,_,_)=setup();confirm(&mut sc,@0x77,0,1,1,200,10200,10200);ts::end(sc);}
#[test] #[expected_failure(abort_code=4,location=book)]
fun unresolved_not_candidate(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,0,1,100,3000,3000);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun terminal_result(){let(mut sc,_,_)=setup();propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);propose(&mut sc,@0x77,2,2,300,11000,11000);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun early_refund(){let(mut sc,_,_)=setup();finish(&mut sc,174799,3);ts::end(sc);}
#[test]
fun cumulative_rounding_no_dust(){let(mut sc,a,b)=setup();let t1=bet(&mut sc,a,@0x11,1,1,1000);let t2=bet(&mut sc,a,@0x11,1,1,1000);let t3=bet(&mut sc,a,@0x11,1,1,1000);let tb=bet(&mut sc,b,@0x22,2,2,1000);
    propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);claim(&mut sc,@0x11,t2,1);claim(&mut sc,@0x11,t1,2);claim(&mut sc,@0x11,t3,2);claim(&mut sc,@0x22,tb,0);ts::end(sc);}
#[test]
fun stranger_push_pays_fixed_beneficiary_and_replay_is_noop(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,7,1000);
    let ticket=sc.take_from_sender_by_id<Ticket<SUI>>(t);let eid=book::entitlement_id(&ticket);ts::return_to_sender(&sc,ticket);finish(&mut sc,174800,3);
    sc.next_tx(@0x55);let mut m=sc.take_shared<Market<SUI>>();let mut e=sc.take_shared_by_id<Entitlement<SUI>>(eid);
    book::claim_for(&mut m,&mut e,sc.ctx());book::claim_for(&mut m,&mut e,sc.ctx());assert!(book::paid(&e)&&book::payout(&e)==7&&book::escrow(&m)==0,104);
    ts::return_shared(m);ts::return_shared(e);sc.next_tx(@0x55);assert!(sc.ids_for_sender<Coin<SUI>>().is_empty(),105);
    sc.next_tx(@0x11);let c=sc.take_from_sender<Coin<SUI>>();assert!(coin::value(&c)==7,106);coin::burn_for_testing(c);
    sc.next_tx(@0x11);let mut m=sc.take_shared<Market<SUI>>();let ticket=sc.take_from_sender_by_id<Ticket<SUI>>(t);let mut e=sc.take_shared_by_id<Entitlement<SUI>>(eid);book::claim(&mut m,ticket,&mut e,sc.ctx());assert!(book::payout(&e)==7&&book::escrow(&m)==0,107);ts::return_shared(m);ts::return_shared(e);ts::end(sc);}
#[test]
fun maximum_pool_u128_math(){let(mut sc,a,b)=setup();let ta=bet(&mut sc,a,@0x11,1,18446744073709551614,1000);let tb=bet(&mut sc,b,@0x22,2,1,1000);
    propose(&mut sc,@0x77,1,1,100,3000,3000);confirm(&mut sc,@0x77,1,1,1,200,10200,10200);claim(&mut sc,@0x22,tb,0);claim(&mut sc,@0x11,ta,18446744073709551615);ts::end(sc);}
#[test] #[expected_failure(abort_code=2,location=book)]
fun late_bet(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x11,1,1,1700);ts::end(sc);}
#[test] #[expected_failure(abort_code=3,location=book)]
fun zero_bet(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x11,1,0,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=1,location=book)]
fun invalid_side(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x11,3,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=0,location=book)]
fun wrong_character(){let(mut sc,a,_)=setup();bet(&mut sc,a,@0x22,1,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=8,location=book)]
fun paused_bet(){let(mut sc,a,_)=setup();pause(&mut sc);bet(&mut sc,a,@0x11,1,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=6,location=book)]
fun early_claim(){let(mut sc,a,_)=setup();let t=bet(&mut sc,a,@0x11,1,1,1000);claim(&mut sc,@0x11,t,0);ts::end(sc);}
#[test] #[expected_failure]
fun pool_overflow(){let(mut sc,a,b)=setup();bet(&mut sc,a,@0x11,1,18446744073709551615,1000);bet(&mut sc,b,@0x22,2,1,1000);ts::end(sc);}
#[test] #[expected_failure(abort_code=0,location=book)]
fun creator_wallet_cannot_bet(){let(mut sc,_,_)=setup();sc.next_tx(wh::admin());let mut r=sc.take_shared<ObjectRegistry>();let acl=sc.take_shared<AdminACL>();let ch=character::create_character(&mut r,&acl,103,wh::tenant(),1,wh::admin(),b"Creator".to_string(),sc.ctx());let id=object::id(&ch);character::share_character(ch,&acl,sc.ctx());ts::return_shared(r);ts::return_shared(acl);bet(&mut sc,id,wh::admin(),1,1,1000);ts::end(sc);}

