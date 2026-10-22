#[test_only]
module cradleos_book::book_tests;

use cradleos_book::book::{Self, Book, Market, Ticket, AdminCap};
use sui::{test_scenario as ts, clock::{Self, Clock}, coin::{Self, Coin}, sui::SUI};
use world::{test_helpers as wh, character::{Self, Character}, access::AdminACL,
    object_registry::ObjectRegistry, killmail::{Self, Killmail}, killmail_registry::KillmailRegistry};

fun at(sc: &mut ts::Scenario, seconds: u64): Clock {
    let mut c = clock::create_for_testing(sc.ctx()); clock::set_for_testing(&mut c, seconds * 1000); c
}
fun setup(wrong_registry: bool): (ts::Scenario, ID, ID) {
    let mut sc = ts::begin(wh::admin()); wh::setup_world(&mut sc);
    sc.next_tx(wh::admin());
    let registry = sc.take_shared<KillmailRegistry>();
    book::setup_for_testing<SUI>(if (wrong_registry) object::id_from_address(@0x123) else object::id(&registry), wh::tenant(), sc.ctx());
    ts::return_shared(registry);
    let mut registry = sc.take_shared<ObjectRegistry>(); let acl = sc.take_shared<AdminACL>();
    let a = character::create_character(&mut registry, &acl, 101, wh::tenant(), 1, @0x11, b"A".to_string(), sc.ctx());
    let b = character::create_character(&mut registry, &acl, 102, wh::tenant(), 1, @0x22, b"B".to_string(), sc.ctx());
    let a_id = object::id(&a); let b_id = object::id(&b);
    character::share_character(a, &acl, sc.ctx()); character::share_character(b, &acl, sc.ctx());
    ts::return_shared(registry); ts::return_shared(acl);
    sc.next_tx(wh::admin()); create(&mut sc, a_id, b_id, 1300, 1900, 5500);
    (sc, a_id, b_id)
}
fun create(sc: &mut ts::Scenario, a_id: ID, b_id: ID, starts: u64, ends: u64, deadline: u64) {
    let mut b = sc.take_shared<Book<SUI>>(); let cap = sc.take_from_sender<AdminCap>();
    let a = sc.take_shared_by_id<Character>(a_id); let other = sc.take_shared_by_id<Character>(b_id); let c = at(sc,1000);
    book::create_market(&mut b, &cap, &a, &other, starts, ends, deadline, 1, 300001, &c, sc.ctx());
    clock::destroy_for_testing(c); ts::return_shared(a); ts::return_shared(other); ts::return_shared(b); ts::return_to_sender(sc, cap);
}
fun bet(sc: &mut ts::Scenario, char_id: ID, who: address, side: u8, value: u64, seconds: u64): ID {
    sc.next_tx(who); let b = sc.take_shared<Book<SUI>>(); let mut m = sc.take_shared<Market<SUI>>();
    let player = sc.take_shared_by_id<Character>(char_id); let c = at(sc, seconds); let funds = coin::mint_for_testing<SUI>(value, sc.ctx());
    book::place_bet(&b, &mut m, &player, side, funds, &c, sc.ctx());
    ts::return_shared(b); ts::return_shared(m); ts::return_shared(player); clock::destroy_for_testing(c);
    sc.next_tx(who); sc.most_recent_id_for_sender<Ticket<SUI>>().destroy_some()
}
fun proof(sc: &mut ts::Scenario, reporter: ID, key: u64, killer: u64, timestamp: u64, loss: u8, system: u64): ID {
    sc.next_tx(wh::admin()); let mut r = sc.take_shared<KillmailRegistry>(); let acl = sc.take_shared<AdminACL>(); let ch = sc.take_shared_by_id<Character>(reporter);
    killmail::create_killmail(&mut r,&acl,key,killer,999,&ch,timestamp,loss,system,sc.ctx());
    let id = sui::derived_object::derive_address(object::id(&r), wh::in_game_id(key));
    ts::return_shared(r); ts::return_shared(acl); ts::return_shared(ch); object::id_from_address(id)
}
fun submit(sc: &mut ts::Scenario, id: ID, seconds: u64) {
    sc.next_tx(@0x55); let mut m = sc.take_shared<Market<SUI>>(); let p = sc.take_shared_by_id<Killmail>(id); let c = at(sc,seconds);
    book::submit_proof(&mut m,&p,&c); ts::return_shared(m); ts::return_shared(p); clock::destroy_for_testing(c);
}
fun finish(sc: &mut ts::Scenario, seconds: u64, expected: u8) {
    sc.next_tx(@0x55); let mut m = sc.take_shared<Market<SUI>>(); let c = at(sc,seconds);
    book::finalize(&mut m,&c); assert!(book::result(&m)==expected,100); ts::return_shared(m); clock::destroy_for_testing(c);
}
fun claim(sc: &mut ts::Scenario, who: address, id: ID, payout: u64) {
    sc.next_tx(who); let mut m = sc.take_shared<Market<SUI>>(); let before = book::escrow(&m);
    let ticket = sc.take_from_sender_by_id<Ticket<SUI>>(id); book::claim(&mut m,ticket,sc.ctx());
    assert!(book::escrow(&m)==before-payout,101); ts::return_shared(m);
    sc.next_tx(who); if(payout>0) { let coin = sc.take_from_sender<Coin<SUI>>(); assert!(coin::value(&coin)==payout,102); coin::burn_for_testing(coin); };
}
fun pause(sc: &mut ts::Scenario) {
    sc.next_tx(wh::admin()); let mut b=sc.take_shared<Book<SUI>>(); let cap=sc.take_from_sender<AdminCap>();
    book::set_paused(&mut b,&cap,true); ts::return_shared(b); ts::return_to_sender(sc,cap);
}

#[test]
fun asymmetric_pool_pays_exactly_and_loser_gets_zero() {
    let (mut sc,a,b)=setup(false); let ta=bet(&mut sc,a,@0x11,1,3,1000); let tb=bet(&mut sc,b,@0x22,2,7,1000);
    let p=proof(&mut sc,a,1,101,1300,1,300001); submit(&mut sc,p,1500); finish(&mut sc,5500,1);
    claim(&mut sc,@0x22,tb,0); claim(&mut sc,@0x11,ta,10); ts::end(sc);
}
#[test]
fun cumulative_rounding_exhausts_pool_without_dust() {
    let (mut sc,a,b)=setup(false); let t1=bet(&mut sc,a,@0x11,1,1,1000); let t2=bet(&mut sc,a,@0x11,1,1,1000); let t3=bet(&mut sc,a,@0x11,1,1,1000);
    let tb=bet(&mut sc,b,@0x22,2,2,1000); let p=proof(&mut sc,a,1,101,1400,1,300001); submit(&mut sc,p,1500); finish(&mut sc,5500,1);
    claim(&mut sc,@0x11,t2,1); claim(&mut sc,@0x11,t1,2); claim(&mut sc,@0x11,t3,2); claim(&mut sc,@0x22,tb,0); ts::end(sc);
}
#[test]
fun tie_refunds_all_stakes() {
    let (mut sc,a,b)=setup(false); let ta=bet(&mut sc,a,@0x11,1,3,1000); let tb=bet(&mut sc,b,@0x22,2,7,1000);
    let pa=proof(&mut sc,a,1,101,1400,1,300001); let pb=proof(&mut sc,b,2,102,1500,1,300001); submit(&mut sc,pa,1900); submit(&mut sc,pb,1900);
    finish(&mut sc,5500,3); claim(&mut sc,@0x11,ta,3); claim(&mut sc,@0x22,tb,7); ts::end(sc);
}
#[test]
fun no_proofs_refunds_and_pause_never_blocks_refunds() {
    let (mut sc,a,b)=setup(false); let ta=bet(&mut sc,a,@0x11,1,3,1000); let tb=bet(&mut sc,b,@0x22,2,7,1000);
    pause(&mut sc); finish(&mut sc,5500,3); claim(&mut sc,@0x11,ta,3); claim(&mut sc,@0x22,tb,7); ts::end(sc);
}
#[test]
fun one_sided_pool_refunds_despite_proven_winner() {
    let (mut sc,a,_b)=setup(false); let ta=bet(&mut sc,a,@0x11,1,3,1000);
    let p=proof(&mut sc,a,1,101,1400,1,300001); submit(&mut sc,p,1500); finish(&mut sc,5500,3); claim(&mut sc,@0x11,ta,3); ts::end(sc);
}
#[test]
fun b_wins_after_permissionless_proof_during_pause() {
    let (mut sc,a,b)=setup(false); let ta=bet(&mut sc,a,@0x11,1,3,1000); let tb=bet(&mut sc,b,@0x22,2,7,1000);
    pause(&mut sc); let p=proof(&mut sc,b,1,102,1899,1,300001); submit(&mut sc,p,5499); finish(&mut sc,5500,2);
    claim(&mut sc,@0x22,tb,10); claim(&mut sc,@0x11,ta,0); ts::end(sc);
}

#[test] #[expected_failure(abort_code=2,location=book)]
fun late_bet_rejected() { let(mut sc,a,_b)=setup(false); bet(&mut sc,a,@0x11,1,1,1300); ts::end(sc); }
#[test] #[expected_failure(abort_code=3,location=book)]
fun zero_bet_rejected() { let(mut sc,a,_b)=setup(false); bet(&mut sc,a,@0x11,1,0,1000); ts::end(sc); }
#[test] #[expected_failure(abort_code=1,location=book)]
fun invalid_side_rejected() { let(mut sc,a,_b)=setup(false); bet(&mut sc,a,@0x11,3,1,1000); ts::end(sc); }
#[test] #[expected_failure(abort_code=0,location=book)]
fun other_players_character_rejected() { let(mut sc,a,_b)=setup(false); bet(&mut sc,a,@0x22,1,1,1000); ts::end(sc); }
#[test] #[expected_failure(abort_code=8,location=book)]
fun paused_bet_rejected() { let(mut sc,a,_b)=setup(false); pause(&mut sc); bet(&mut sc,a,@0x11,1,1,1000); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_registry_rejected() { let(mut sc,a,_b)=setup(true); let p=proof(&mut sc,a,1,101,1400,1,300001); submit(&mut sc,p,1500); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun past_kill_rejected() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1299,1,300001); submit(&mut sc,p,1500); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun event_end_exclusive() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1900,1,300001); submit(&mut sc,p,2000); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun future_timestamp_rejected() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1501,1,300001); submit(&mut sc,p,1500); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_killer_rejected() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,103,1400,1,300001); submit(&mut sc,p,1500); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_loss_rejected() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1400,2,300001); submit(&mut sc,p,1500); ts::end(sc); }
#[test] #[expected_failure(abort_code=4,location=book)]
fun wrong_system_rejected() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1400,1,300002); submit(&mut sc,p,1500); ts::end(sc); }
#[test] #[expected_failure(abort_code=5,location=book)]
fun duplicate_proof_rejected() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1400,1,300001); submit(&mut sc,p,1500); submit(&mut sc,p,1501); ts::end(sc); }
#[test] #[expected_failure(abort_code=2,location=book)]
fun proof_deadline_exclusive() { let(mut sc,a,_b)=setup(false); let p=proof(&mut sc,a,1,101,1400,1,300001); submit(&mut sc,p,5500); ts::end(sc); }
#[test] #[expected_failure(abort_code=2,location=book)]
fun early_finalize_rejected() { let(mut sc,_a,_b)=setup(false); finish(&mut sc,5499,3); ts::end(sc); }
#[test] #[expected_failure(abort_code=2,location=book)]
fun double_finalize_rejected() { let(mut sc,_a,_b)=setup(false); finish(&mut sc,5500,3); finish(&mut sc,5501,3); ts::end(sc); }
#[test] #[expected_failure(abort_code=6,location=book)]
fun early_claim_rejected() { let(mut sc,a,_b)=setup(false); let t=bet(&mut sc,a,@0x11,1,1,1000); claim(&mut sc,@0x11,t,0); ts::end(sc); }
#[test] #[expected_failure]
fun pool_overflow_rejected() { let(mut sc,a,b)=setup(false); bet(&mut sc,a,@0x11,1,18446744073709551615,1000); bet(&mut sc,b,@0x22,2,1,1000); ts::end(sc); }

#[test]
fun maximum_pool_uses_u128_and_consumes_ticket() {
    let(mut sc,a,b)=setup(false); let ta=bet(&mut sc,a,@0x11,1,18446744073709551614,1000); let tb=bet(&mut sc,b,@0x22,2,1,1000);
    let p=proof(&mut sc,a,1,101,1400,1,300001); submit(&mut sc,p,1500); finish(&mut sc,5500,1);
    claim(&mut sc,@0x22,tb,0); claim(&mut sc,@0x11,ta,18446744073709551615);
    assert!(sc.ids_for_sender<Ticket<SUI>>().is_empty(),103); ts::end(sc);
}
#[test] #[expected_failure(abort_code=1,location=book)]
fun insufficient_lead_time_rejected() { let(mut sc,a,b)=setup(false); sc.next_tx(wh::admin()); create(&mut sc,a,b,1299,1900,5500); ts::end(sc); }
#[test] #[expected_failure(abort_code=1,location=book)]
fun short_proof_window_rejected() { let(mut sc,a,b)=setup(false); sc.next_tx(wh::admin()); create(&mut sc,a,b,1300,1900,5499); ts::end(sc); }
#[test] #[expected_failure(abort_code=7,location=book)]
fun ticket_cannot_claim_another_market() {
    let(mut sc,a,b)=setup(false); let t=bet(&mut sc,a,@0x11,1,3,1000);
    sc.next_tx(wh::admin()); create(&mut sc,a,b,1300,1900,5500); finish(&mut sc,5500,3); claim(&mut sc,@0x11,t,3); ts::end(sc);
}
#[test] #[expected_failure(abort_code=0,location=book)]
fun admin_cap_is_book_bound() {
    let(mut sc,_a,_b)=setup(false); sc.next_tx(wh::admin());
    let cap=sc.take_from_sender<AdminCap>(); let old_id=object::id(&cap); ts::return_to_sender(&sc,cap);
    book::setup_for_testing<SUI>(object::id_from_address(@0x123),wh::tenant(),sc.ctx()); sc.next_tx(wh::admin());
    let cap=sc.take_from_sender_by_id<AdminCap>(old_id); let mut b=sc.take_shared<Book<SUI>>(); book::set_paused(&mut b,&cap,true);
    ts::return_shared(b); ts::return_to_sender(&sc,cap); ts::end(sc);
}
