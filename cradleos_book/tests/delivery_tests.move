#[test_only]
module cradleos_book::delivery_tests;
use cradleos_book::{book::{Self,Book,AdminCap},delivery::{Self,Delivery}};
use sui::{test_scenario as ts,clock::{Self,Clock},coin::{Self,Coin},sui::SUI};
use world::{test_helpers as wh,access::{OwnerCap,AdminACL},character::{Self,Character},object_registry::ObjectRegistry,
    storage_unit::{Self,StorageUnit},network_node::{Self,NetworkNode},energy::EnergyConfig,inventory::{Self,Item}};
fun at(sc:&mut ts::Scenario,t:u64):Clock{let mut c=clock::create_for_testing(sc.ctx());clock::set_for_testing(&mut c,t*1000);c}
fun setup():(ts::Scenario,ID,ID,ID){
 let mut sc=ts::begin(wh::admin());wh::setup_world(&mut sc);wh::configure_assembly_energy(&mut sc);
 sc.next_tx(wh::admin());book::setup_for_testing<SUI>(wh::tenant(),sc.ctx());
 let mut registry=sc.take_shared<ObjectRegistry>();let acl=sc.take_shared<AdminACL>();
 let a=character::create_character(&mut registry,&acl,101,wh::tenant(),1,wh::user_a(),b"Carrier".to_string(),sc.ctx());let aid=object::id(&a);
 let b=character::create_character(&mut registry,&acl,102,wh::tenant(),1,wh::user_b(),b"Sponsor".to_string(),sc.ctx());let bid=object::id(&b);
 let mut n=network_node::anchor(&mut registry,&a,&acl,5000,111000,x"0102030401020304010203040102030401020304010203040102030401020304",1000,3600000,100,sc.ctx());let nid=object::id(&n);
 let s=storage_unit::anchor(&mut registry,&mut n,&a,&acl,90002,wh::assembly_type_1(),100000,x"0102030401020304010203040102030401020304010203040102030401020304",sc.ctx());let sid=object::id(&s);
 storage_unit::share_storage_unit(s,&acl,sc.ctx());network_node::share_network_node(n,&acl,sc.ctx());
 character::share_character(a,&acl,sc.ctx());character::share_character(b,&acl,sc.ctx());ts::return_shared(registry);ts::return_shared(acl);
 sc.next_tx(wh::user_a());let mut a=sc.take_shared_by_id<Character>(aid);let mut n=sc.take_shared_by_id<NetworkNode>(nid);let c=at(&mut sc,1000);
 let(cap,receipt)=a.borrow_owner_cap<NetworkNode>(ts::most_recent_receiving_ticket<OwnerCap<NetworkNode>>(&aid),sc.ctx());
 n.deposit_fuel_test(&cap,1,10,10,&c);n.online(&cap,&c);a.return_owner_cap(cap,receipt);
 let mut s=sc.take_shared_by_id<StorageUnit>(sid);let energy=sc.take_shared<EnergyConfig>();
 let(cap,receipt)=a.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&aid),sc.ctx());
 s.online(&mut n,&energy,&cap);a.return_owner_cap(cap,receipt);
 ts::return_shared(a);ts::return_shared(n);ts::return_shared(s);ts::return_shared(energy);clock::destroy_for_testing(c);
 sc.next_tx(wh::user_b());let b=sc.take_shared_by_id<Character>(bid);let s=sc.take_shared_by_id<StorageUnit>(sid);let mut book=sc.take_shared<Book<SUI>>();let c=at(&mut sc,1000);let reward=coin::mint_for_testing<SUI>(100,sc.ctx());
 delivery::create(&mut book,&b,&s,b"Exact ammo".to_string(),88069,10,2000,reward,&c,sc.ctx());
 ts::return_shared(book);ts::return_shared(b);ts::return_shared(s);clock::destroy_for_testing(c);(sc,aid,bid,sid)
}
fun item(sc:&mut ts::Scenario,aid:ID,sid:ID,kind:u64,qty:u32):(Character,Item,StorageUnit){
 let mut a=sc.take_shared_by_id<Character>(aid);let mut s=sc.take_shared_by_id<StorageUnit>(sid);
 let(cap,receipt)=a.borrow_owner_cap<StorageUnit>(ts::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&aid),sc.ctx());
 s.game_item_to_chain_inventory_test(&a,&cap,77000,kind,1,qty,sc.ctx());let item=s.withdraw_by_owner(&a,&cap,kind,qty,sc.ctx());
 a.return_owner_cap(cap,receipt);(a,item,s)
}
fun fulfill(sc:&mut ts::Scenario,aid:ID,sid:ID,kind:u64,qty:u32,now:u64){
 sc.next_tx(wh::user_a());let(a,item,origin)=item(sc,aid,sid,kind,qty);let mut d=sc.take_shared<Delivery<SUI>>();let c=at(sc,now);
 delivery::fulfill(&mut d,&a,&origin,vector[item],&c,sc.ctx());assert!(delivery::status(&d)==1&&delivery::reward(&d)==0,100);ts::return_shared(d);ts::return_shared(a);ts::return_shared(origin);clock::destroy_for_testing(c);
}
fun refund(sc:&mut ts::Scenario,now:u64){sc.next_tx(@0x55);let mut d=sc.take_shared<Delivery<SUI>>();let c=at(sc,now);delivery::refund(&mut d,&c,sc.ctx());ts::return_shared(d);clock::destroy_for_testing(c);}
#[test]
fun atomic_exact_handoff_and_no_double_refund(){let(mut sc,a,_,s)=setup();fulfill(&mut sc,a,s,88069,10,1999);refund(&mut sc,2000);refund(&mut sc,2001);
 sc.next_tx(wh::user_a());let c=sc.take_from_sender<Coin<SUI>>();assert!(coin::value(&c)==100,101);coin::burn_for_testing(c);
 sc.next_tx(wh::user_b());assert!(sc.ids_for_sender<Coin<SUI>>().is_empty(),102);let item=sc.take_from_sender<Item>();assert!(inventory::quantity(&item)==10&&inventory::parent_id(&item)==s,103);transfer::public_transfer(item,wh::user_b());ts::end(sc);}
#[test]
fun timeout_refund_fixed_sponsor_and_replay_noop(){let(mut sc,_,_,_)=setup();refund(&mut sc,2000);refund(&mut sc,2001);sc.next_tx(@0x55);assert!(sc.ids_for_sender<Coin<SUI>>().is_empty(),100);
 sc.next_tx(wh::user_b());let c=sc.take_from_sender<Coin<SUI>>();assert!(coin::value(&c)==100,101);coin::burn_for_testing(c);ts::end(sc);}
#[test]
fun pause_does_not_block_delivery(){let(mut sc,a,_,s)=setup();sc.next_tx(wh::admin());let mut b=sc.take_shared<Book<SUI>>();let cap=sc.take_from_sender<AdminCap>();book::set_paused(&mut b,&cap,true);ts::return_shared(b);ts::return_to_sender(&sc,cap);fulfill(&mut sc,a,s,88069,10,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=33,location=delivery)]
fun partial_delivery_rejected(){let(mut sc,a,_,s)=setup();fulfill(&mut sc,a,s,88069,9,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=33,location=delivery)]
fun over_delivery_rejected(){let(mut sc,a,_,s)=setup();fulfill(&mut sc,a,s,88069,11,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=33,location=delivery)]
fun wrong_type_rejected(){let(mut sc,a,_,s)=setup();fulfill(&mut sc,a,s,88070,10,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=32,location=delivery)]
fun deadline_exclusive(){let(mut sc,a,_,s)=setup();fulfill(&mut sc,a,s,88069,10,2000);ts::end(sc);}
#[test] #[expected_failure(abort_code=32,location=delivery)]
fun early_refund_rejected(){let(mut sc,_,_,_)=setup();refund(&mut sc,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=32,location=delivery)]
fun refund_prevents_fulfillment(){let(mut sc,a,_,s)=setup();refund(&mut sc,2000);fulfill(&mut sc,a,s,88069,10,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=31,location=delivery)]
fun another_character_rejected(){let(mut sc,a,b,s)=setup();sc.next_tx(wh::user_a());let(carrier,item,origin)=item(&mut sc,a,s,88069,10);ts::return_shared(carrier);let ch=sc.take_shared_by_id<Character>(b);let mut d=sc.take_shared<Delivery<SUI>>();let c=at(&mut sc,1999);delivery::fulfill(&mut d,&ch,&origin,vector[item],&c,sc.ctx());ts::return_shared(d);ts::return_shared(ch);ts::return_shared(origin);clock::destroy_for_testing(c);ts::end(sc);}
#[test] #[expected_failure(abort_code=32,location=delivery)]
fun second_fulfillment_rejected(){let(mut sc,a,_,s)=setup();fulfill(&mut sc,a,s,88069,10,1999);fulfill(&mut sc,a,s,88069,10,1999);ts::end(sc);}
#[test] #[expected_failure(abort_code=31,location=delivery)]
fun sponsor_cannot_fulfill(){let(mut sc,a,b,s)=setup();sc.next_tx(wh::user_a());let(carrier,item,origin)=item(&mut sc,a,s,88069,10);ts::return_shared(carrier);ts::return_shared(origin);transfer::public_transfer(item,wh::user_b());
 sc.next_tx(wh::user_b());let item=sc.take_from_sender<Item>();let sponsor=sc.take_shared_by_id<Character>(b);let origin=sc.take_shared_by_id<StorageUnit>(s);let mut d=sc.take_shared<Delivery<SUI>>();let c=at(&mut sc,1999);delivery::fulfill(&mut d,&sponsor,&origin,vector[item],&c,sc.ctx());ts::return_shared(d);ts::return_shared(sponsor);ts::return_shared(origin);clock::destroy_for_testing(c);ts::end(sc);}
#[test] #[expected_failure(abort_code=33,location=delivery)]
fun wrong_origin_rejected(){let(mut sc,a,_,s)=setup();sc.next_tx(wh::admin());let mut r=sc.take_shared<ObjectRegistry>();let acl=sc.take_shared<AdminACL>();let ch=sc.take_shared_by_id<Character>(a);let mut n=sc.take_shared<NetworkNode>();let other=storage_unit::anchor(&mut r,&mut n,&ch,&acl,90003,wh::assembly_type_1(),100000,x"0102030401020304010203040102030401020304010203040102030401020304",sc.ctx());let other_id=object::id(&other);storage_unit::share_storage_unit(other,&acl,sc.ctx());ts::return_shared(r);ts::return_shared(acl);ts::return_shared(ch);ts::return_shared(n);
 sc.next_tx(wh::user_a());let mut ch=sc.take_shared_by_id<Character>(a);let mut original=sc.take_shared_by_id<StorageUnit>(s);
 let(cap,receipt)=ch.borrow_owner_cap<StorageUnit>(ts::receiving_ticket_by_id<OwnerCap<StorageUnit>>(original.owner_cap_id()),sc.ctx());
 original.game_item_to_chain_inventory_test(&ch,&cap,77000,88069,1,10,sc.ctx());let item=original.withdraw_by_owner(&ch,&cap,88069,10,sc.ctx());ch.return_owner_cap(cap,receipt);
 let other=sc.take_shared_by_id<StorageUnit>(other_id);let mut d=sc.take_shared<Delivery<SUI>>();let c=at(&mut sc,1999);delivery::fulfill(&mut d,&ch,&other,vector[item],&c,sc.ctx());ts::return_shared(d);ts::return_shared(ch);ts::return_shared(original);ts::return_shared(other);clock::destroy_for_testing(c);ts::end(sc);}
