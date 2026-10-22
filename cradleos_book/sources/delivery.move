/// Sponsored atomic handoff of current-world Item objects. Not proof of travel
/// or game-inventory deposit; no SSU authorization/witness is created.
module cradleos_book::delivery;
use std::string::String;
use sui::{clock::Clock, coin::{Self,Coin}, balance::{Self,Balance}, event};
use world::{character::{Self,Character}, storage_unit::StorageUnit, inventory::{Self,Item}};
use cradleos_book::book::{Self,Book};
const ETerms:u64=30;const EAuthority:u64=31;const EClosed:u64=32;const EItem:u64=33;
public struct Delivery<phantom T> has key {
    id:UID,book_id:ID,tenant:String,title:String,sponsor:address,sponsor_character:ID,
    origin:ID,item_type:u64,quantity:u64,deadline:u64,reward:Balance<T>,reward_amount:u64,
    status:u8,fulfilled_by:address,fulfilled_at:u64,
}
public struct Created has copy,drop{book_id:ID,delivery_id:ID}
public struct Completed has copy,drop{delivery_id:ID,recipient:address,payout:u64,status:u8}
public fun create<T>(book:&mut Book<T>,sponsor:&Character,origin:&StorageUnit,title:String,item_type:u64,quantity:u64,deadline:u64,reward:Coin<T>,clock:&Clock,ctx:&mut TxContext){
    let now=clock.timestamp_ms()/1000;assert!(deadline>=now+300&&deadline<=now+2592000,ETerms);
    assert!(title.length()>0&&title.length()<=96&&quantity>0&&quantity<=4294967295&&item_type>0,ETerms);
    let reward_amount=coin::value(&reward);assert!(reward_amount>0,ETerms);
    let delivery=Delivery<T>{id:object::new(ctx),book_id:object::id(book),tenant:sponsor.tenant(),title,sponsor:ctx.sender(),sponsor_character:object::id(sponsor),origin:object::id(origin),item_type,quantity,deadline,reward:coin::into_balance(reward),reward_amount,status:0,fulfilled_by:@0x0,fulfilled_at:0};
    let id=object::id(&delivery);book::register_delivery(book,id,sponsor,ctx);
    event::emit(Created{book_id:object::id(book),delivery_id:id});transfer::share_object(delivery);
}
public fun fulfill<T>(d:&mut Delivery<T>,carrier:&Character,origin:&StorageUnit,mut items:vector<Item>,clock:&Clock,ctx:&mut TxContext){
    assert!(d.status==0&&clock.timestamp_ms()/1000<d.deadline,EClosed);
    assert!(carrier.character_address()==ctx.sender()&&carrier.tenant()==d.tenant&&ctx.sender()!=d.sponsor,EAuthority);
    assert!(object::id(origin)==d.origin,EItem);
    assert!(items.length()>0&&items.length()<=32,EItem);let mut total=0;let mut i=0;
    while(i < items.length()){let item=&items[i];assert!(inventory::tenant(item)==d.tenant&&inventory::parent_id(item)==d.origin&&inventory::type_id(item)==d.item_type,EItem);total=total+(inventory::quantity(item) as u64);i=i+1;};
    assert!(total==d.quantity,EItem);d.status=1;d.fulfilled_by=ctx.sender();d.fulfilled_at=clock.timestamp_ms()/1000;
    while(!items.is_empty())transfer::public_transfer(items.pop_back(),d.sponsor);items.destroy_empty();
    let payout=balance::value(&d.reward);transfer::public_transfer(coin::from_balance(balance::withdraw_all(&mut d.reward),ctx),ctx.sender());
    event::emit(Completed{delivery_id:object::id(d),recipient:ctx.sender(),payout,status:1});
}
public fun refund<T>(d:&mut Delivery<T>,clock:&Clock,ctx:&mut TxContext){
    if(d.status!=0)return;assert!(clock.timestamp_ms()/1000>=d.deadline,EClosed);d.status=2;
    let payout=balance::value(&d.reward);transfer::public_transfer(coin::from_balance(balance::withdraw_all(&mut d.reward),ctx),d.sponsor);
    event::emit(Completed{delivery_id:object::id(d),recipient:d.sponsor,payout,status:2});
}
public fun status<T>(d:&Delivery<T>):u8{d.status}
public fun reward<T>(d:&Delivery<T>):u64{balance::value(&d.reward)}
