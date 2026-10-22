/// Fixed-rule oracle markets. No combat, arbitrary outcome, result override,
/// administrator withdrawal, or recipient-selectable payout entry exists.
module cradleos_book::book;
use std::string::{Self, String};
use sui::{balance::{Self, Balance}, coin::{Self, Coin}, clock::Clock, event, table::{Self, Table}};
use world::character::{Self, Character};
const EAuthority: u64 = 0;
const ETerms: u64 = 1;
const EClosed: u64 = 2;
const EAmount: u64 = 3;
const EProof: u64 = 4;
const ENotFinal: u64 = 6;
const ETicket: u64 = 7;
const EPaused: u64 = 8;
const EVersion: u64 = 9;
const VERSION: u64 = 1;
public struct BootstrapCap has key { id: UID }
public struct AdminCap has key, store { id: UID, book_id: ID }
public struct Book<phantom T> has key {
    id: UID, version: u64, paused: bool, tenant: String,
    markets: vector<ID>, deliveries: vector<ID>,
}
public struct Market<phantom T> has key {
    id: UID, version: u64, book_id: ID, tenant: String, creator: address,
    asset: u8, starts: u64, ends: u64, proof_deadline: u64,
    price_feed: vector<u8>, price_exponent: u8, price_strike: u64,
    price_value: u64, price_time: u64,
    pool_a: u64, pool_b: u64, escrow: Balance<T>, result: u8,
    remaining_winning_stake: u64, claims: Table<u64, ID>, claim_count: u64,
}
/// Owned discovery receipt. Escrow rights reside in the shared entitlement.
public struct Ticket<phantom T> has key {
    id: UID, market_id: ID, bettor: address, side: u8, stake: u64, entitlement_id: ID,
}
public struct Entitlement<phantom T> has key {
    id: UID, market_id: ID, bettor: address, side: u8, stake: u64,
    index: u64, paid: bool, payout: u64,
}
public struct MarketCreated has copy, drop { book_id: ID, market_id: ID }
public struct WagerPlaced has copy, drop {
    market_id: ID, ticket_id: ID, entitlement_id: ID, index: u64,
    bettor: address, side: u8, stake: u64,
}
public struct PriceCounted has copy, drop { market_id: ID, publish_time: u64, price: u64 }
public struct Finalized has copy, drop { market_id: ID, result: u8 }
public struct Claimed has copy, drop { market_id: ID, entitlement_id: ID, bettor: address, payout: u64 }
fun init(ctx: &mut TxContext) {
    transfer::transfer(BootstrapCap { id: object::new(ctx) }, ctx.sender());
}
public fun create_book<T>(cap: BootstrapCap, ctx: &mut TxContext) {
    let BootstrapCap { id } = cap;
    id.delete();
    let (book, admin) = new_book<T>(string::utf8(b"stillness"), ctx);
    transfer::share_object(book);
    transfer::public_transfer(admin, ctx.sender());
}
fun new_book<T>(tenant: String, ctx: &mut TxContext): (Book<T>, AdminCap) {
    let book = Book<T> {
        id: object::new(ctx), version: VERSION, paused: false, tenant,
        markets: vector[], deliveries: vector[],
    };
    let cap = AdminCap { id: object::new(ctx), book_id: object::id(&book) };
    (book, cap)
}
public fun set_paused<T>(book: &mut Book<T>, cap: &AdminCap, paused: bool) {
    assert!(cap.book_id == object::id(book), EAuthority);
    assert!(book.version == VERSION, EVersion);
    book.paused = paused;
}
/// Only two liquid, immutable, USD-denominated feeds are supported.
public fun feed(asset: u8): vector<u8> {
    if (asset == 1) x"e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
    else {
        assert!(asset == 2, ETerms);
        x"ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
    }
}
/// Creation is exposed only through the authenticated price adapter.
public(package) fun create_price<T>(
    book: &mut Book<T>, cap: &AdminCap, asset: u8, strike: u64,
    starts: u64, target: u64, clock: &Clock, ctx: &mut TxContext,
) {
    assert!(book.version == VERSION, EVersion);
    assert!(cap.book_id == object::id(book), EAuthority);
    assert!(!book.paused, EPaused);
    let now = clock.timestamp_ms() / 1000;
    assert!(starts >= now + 300 && starts <= now + 2592000, ETerms);
    assert!(target >= starts + 60 && target <= starts + 604800 && strike > 0, ETerms);
    let market = Market<T> {
        id: object::new(ctx), version: VERSION, book_id: object::id(book),
        tenant: book.tenant, creator: ctx.sender(), asset, starts, ends: target,
        proof_deadline: target + 3600, price_feed: feed(asset), price_exponent: 8,
        price_strike: strike, price_value: 0, price_time: 0,
        pool_a: 0, pool_b: 0, escrow: balance::zero(), result: 0,
        remaining_winning_stake: 0, claims: table::new(ctx), claim_count: 0,
    };
    let id = object::id(&market);
    book.markets.push_back(id);
    event::emit(MarketCreated { book_id: object::id(book), market_id: id });
    transfer::share_object(market);
}
public fun place_bet<T>(
    book: &Book<T>, market: &mut Market<T>, player: &Character, side: u8,
    funds: Coin<T>, clock: &Clock, ctx: &mut TxContext,
) {
    assert!(book.version == VERSION && market.version == VERSION, EVersion);
    assert!(market.book_id == object::id(book), EAuthority);
    assert!(!book.paused, EPaused);
    assert!(market.result == 0 && clock.timestamp_ms() / 1000 < market.starts, EClosed);
    assert!(side == 1 || side == 2, ETerms);
    assert!(player.character_address() == ctx.sender() && player.tenant() == market.tenant, EAuthority);
    assert!(ctx.sender() != market.creator, EAuthority);
    let stake = coin::value(&funds);
    assert!(stake > 0, EAmount);
    assert!(market.claim_count < 10000, ETerms);
    if (side == 1) market.pool_a = market.pool_a + stake
    else market.pool_b = market.pool_b + stake;
    balance::join(&mut market.escrow, coin::into_balance(funds));
    let claim = Entitlement<T> {
        id: object::new(ctx), market_id: object::id(market), bettor: ctx.sender(),
        side, stake, index: market.claim_count, paid: false, payout: 0,
    };
    let entitlement_id = object::id(&claim);
    table::add(&mut market.claims, market.claim_count, entitlement_id);
    let ticket = Ticket<T> {
        id: object::new(ctx), market_id: object::id(market), bettor: ctx.sender(),
        side, stake, entitlement_id,
    };
    event::emit(WagerPlaced {
        market_id: object::id(market), ticket_id: object::id(&ticket), entitlement_id,
        index: market.claim_count, bettor: ctx.sender(), side, stake,
    });
    market.claim_count = market.claim_count + 1;
    transfer::share_object(claim);
    transfer::transfer(ticket, ctx.sender());
}
/// Only the sibling authenticated price adapter may submit verified values.
public(package) fun record_price<T>(
    market: &mut Market<T>, feed: vector<u8>, exponent: u8, value: u64, conf: u64,
    previous: u64, published: u64, clock: &Clock,
) {
    assert!(market.version == VERSION, EVersion);
    let now = clock.timestamp_ms() / 1000;
    assert!(market.result == 0 && now >= market.ends && now < market.proof_deadline, EClosed);
    assert!(feed == market.price_feed && exponent == market.price_exponent && value > 0, EProof);
    assert!(previous < market.ends && published >= market.ends && published <= market.ends + 60 && published <= now, EProof);
    assert!((conf as u128) * 10000 <= (value as u128) * 100, EProof);
    if (market.price_time > 0) {
        assert!(market.price_time == published && market.price_value == value, EProof);
        return
    };
    market.price_value = value;
    market.price_time = published;
    event::emit(PriceCounted { market_id: object::id(market), publish_time: published, price: value });
}
public fun finalize<T>(market: &mut Market<T>, clock: &Clock) {
    assert!(market.version == VERSION, EVersion);
    assert!(market.result == 0 && clock.timestamp_ms() / 1000 >= market.proof_deadline, EClosed);
    // Side A: strictly above. Side B: at or below. Missing proof: refund.
    let candidate = if (market.price_time == 0) 3
        else if (market.price_value > market.price_strike) 1 else 2;
    market.result = if (market.pool_a == 0 || market.pool_b == 0) 3 else candidate;
    if (market.result == 1) market.remaining_winning_stake = market.pool_a
    else if (market.result == 2) market.remaining_winning_stake = market.pool_b;
    event::emit(Finalized { market_id: object::id(market), result: market.result });
}
/// Anyone can trigger payment; the beneficiary cannot be changed by the caller.
public fun claim_for<T>(market: &mut Market<T>, claim: &mut Entitlement<T>, ctx: &mut TxContext) {
    assert!(market.version == VERSION, EVersion);
    assert!(market.result != 0, ENotFinal);
    assert!(claim.market_id == object::id(market), ETicket);
    assert!(*table::borrow(&market.claims, claim.index) == object::id(claim), ETicket);
    if (claim.paid) return;
    let stake = claim.stake;
    let payout = if (market.result == 3) stake
        else if (market.result == claim.side) {
            let pool = if (claim.side == 1) market.pool_a else market.pool_b;
            let claimed = pool - market.remaining_winning_stake;
            market.remaining_winning_stake = market.remaining_winning_stake - stake;
            let total = (market.pool_a as u128) + (market.pool_b as u128);
            (((((claimed as u128) + (stake as u128)) * total / (pool as u128))
                - ((claimed as u128) * total / (pool as u128))) as u64)
        } else 0;
    claim.paid = true;
    claim.payout = payout;
    if (payout > 0) transfer::public_transfer(
        coin::from_balance(balance::split(&mut market.escrow, payout), ctx), claim.bettor,
    );
    event::emit(Claimed { market_id: object::id(market), entitlement_id: object::id(claim), bettor: claim.bettor, payout });
}
public fun claim<T>(market: &mut Market<T>, ticket: Ticket<T>, entitlement: &mut Entitlement<T>, ctx: &mut TxContext) {
    let Ticket { id, market_id, bettor, side: _, stake: _, entitlement_id } = ticket;
    assert!(market_id == object::id(market) && bettor == ctx.sender() && entitlement_id == object::id(entitlement), ETicket);
    id.delete();
    claim_for(market, entitlement, ctx);
}
public(package) fun register_delivery<T>(book: &mut Book<T>, id: ID, player: &Character, ctx: &TxContext) {
    assert!(book.version == VERSION, EVersion);
    assert!(!book.paused, EPaused);
    assert!(player.tenant() == book.tenant && player.character_address() == ctx.sender(), EAuthority);
    book.deliveries.push_back(id);
}
public fun result<T>(m: &Market<T>): u8 { m.result }
public fun escrow<T>(m: &Market<T>): u64 { balance::value(&m.escrow) }
public fun market_ids<T>(b: &Book<T>): vector<ID> { b.markets }
public fun entitlement_id<T>(t: &Ticket<T>): ID { t.entitlement_id }
public fun paid<T>(e: &Entitlement<T>): bool { e.paid }
public fun payout<T>(e: &Entitlement<T>): u64 { e.payout }
#[test_only]
public fun setup_for_testing<T>(tenant: String, ctx: &mut TxContext) {
    let (book, cap) = new_book<T>(tenant, ctx);
    transfer::share_object(book);
    transfer::public_transfer(cap, ctx.sender());
}
