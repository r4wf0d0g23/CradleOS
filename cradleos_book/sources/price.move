/// Authenticated Pyth expiry-price adapter. No unauthenticated settlement entry.
module cradleos_book::price;
use sui::clock::Clock;
use cradleos_book::book::{Self, Book, AdminCap, Market};
use pyth::{pyth as oracle, state::State as PythState, deserialize as d, i64, hot_potato_vector};
use wormhole::{state::State as WormState, vaa, cursor};
const EProof:u64=20;
const PYTH_STATE:address=@0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e;
const WORM_STATE:address=@0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0;
public fun create<T>(book:&mut Book<T>,cap:&AdminCap,asset:u8,strike:u64,starts:u64,target:u64,clock:&Clock,ctx:&mut TxContext){
    book::create_price(book,cap,asset,strike,starts,target,clock,ctx);
}
public fun submit<T>(market:&mut Market<T>,pyth:&PythState,worm:&WormState,data:vector<u8>,clock:&Clock){
    assert!(object::id_to_address(&object::id(pyth))==PYTH_STATE&&object::id_to_address(&object::id(worm))==WORM_STATE,EProof);
    let(vaa_bytes,feed,exponent,value,conf,previous,published)=decode(data);
    let verified=vaa::parse_and_verify(worm,vaa_bytes,clock);
    // Official verifier checks allowed emitter and every Merkle leaf in these
    // exact bytes. No externally supplied Price/PriceInfo is trusted.
    let authenticated=oracle::create_authenticated_price_infos_using_accumulator(pyth,data,verified,clock);
    hot_potato_vector::destroy(authenticated);
    book::record_price(market,feed,exponent,value,conf,previous,published,clock);
}
fun decode(data:vector<u8>):(vector<u8>,vector<u8>,u8,u64,u64,u64,u64){
    assert!(data.length()<=16384,EProof);let mut c=cursor::new(data);
    assert!(d::deserialize_u32(&mut c)==1347305813&&d::deserialize_u8(&mut c)==1,EProof);
    let _minor=d::deserialize_u8(&mut c);let trailing=d::deserialize_u8(&mut c);
    let _padding=d::deserialize_vector(&mut c,trailing as u64);assert!(d::deserialize_u8(&mut c)==0,EProof);
    let vaa_size=d::deserialize_u16(&mut c);let vaa_bytes=d::deserialize_vector(&mut c,vaa_size as u64);
    assert!(d::deserialize_u8(&mut c)==1,EProof);assert!(d::deserialize_u16(&mut c)==85,EProof);
    assert!(d::deserialize_u8(&mut c)==0,EProof);let feed=d::deserialize_vector(&mut c,32);
    let signed_price=d::deserialize_i64(&mut c);let conf=d::deserialize_u64(&mut c);let expo=d::deserialize_i32(&mut c);
    let published=d::deserialize_u64(&mut c);let previous=d::deserialize_i64(&mut c);
    let _ema=d::deserialize_i64(&mut c);let _ema_conf=d::deserialize_u64(&mut c);
    assert!(!i64::get_is_negative(&signed_price)&&!i64::get_is_negative(&previous),EProof);
    assert!(published < 9223372036854775808,EProof);
    let exponent=if(i64::get_is_negative(&expo))i64::get_magnitude_if_negative(&expo)else{assert!(i64::get_magnitude_if_positive(&expo)==0,EProof);0};
    assert!(exponent<=18,EProof);let n=d::deserialize_u8(&mut c);assert!(n<=32,EProof);
    let _proof=d::deserialize_vector(&mut c,(n as u64)*20);cursor::destroy_empty(c);
    (vaa_bytes,feed,exponent as u8,i64::get_magnitude_if_positive(&signed_price),conf,i64::get_magnitude_if_positive(&previous),published)
}
#[test_only]
public fun decode_for_testing(data:vector<u8>):(vector<u8>,vector<u8>,u8,u64,u64,u64,u64){decode(data)}
