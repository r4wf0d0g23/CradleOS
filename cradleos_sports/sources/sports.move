/// Fixed two-team Polymarket settlement via a disclosed trusted reporter.
/// No administrator withdrawal or recipient-selectable payout entry exists.
module cradleos_sports::sports;
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
    markets: vector<ID>, reporter: address, conditions: Table<vector<u8>, ID>,
}
public struct Market<phantom T> has key {
    id: UID, version: u64, book_id: ID, tenant: String, creator: address,
    league: u8, label_a: String, label_b: String, source_market: String,
    condition: vector<u8>, terms_json: String, terms_hash: vector<u8>, reporter: address,
    starts: u64, cutoff: u64, proof_deadline: u64, invalidated: bool,
    candidate: u8, revision: u64, candidate_at: u64, candidate_block: u64,
    tuple_hash: vector<u8>, receipt_hash: vector<u8>,
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
public struct Candidate has copy, drop { market_id: ID, revision: u64, result: u8, received_at: u64, block: u64, tuple_hash: vector<u8>, receipt_hash: vector<u8> }
public struct Invalidated has copy, drop { market_id: ID, reason: u8, receipt_hash: vector<u8> }
public struct Finalized has copy, drop { market_id: ID, result: u8 }
public struct Claimed has copy, drop { market_id: ID, entitlement_id: ID, bettor: address, payout: u64 }
fun init(ctx: &mut TxContext) {
    transfer::transfer(BootstrapCap { id: object::new(ctx) }, ctx.sender());
}
public fun create_book<T>(cap: BootstrapCap, reporter: address, ctx: &mut TxContext) {
    let BootstrapCap { id } = cap;
    id.delete();
    let (book, admin) = new_book<T>(string::utf8(b"stillness"), reporter, ctx);
    transfer::share_object(book);
    transfer::public_transfer(admin, ctx.sender());
}
fun new_book<T>(tenant: String, reporter: address, ctx: &mut TxContext): (Book<T>, AdminCap) {
    assert!(reporter != @0x0 && reporter != ctx.sender(), EAuthority);
    let book = Book<T> {
        id: object::new(ctx), version: VERSION, paused: false, tenant,
        markets: vector[], reporter, conditions: table::new(ctx),
    };
    let cap = AdminCap { id: object::new(ctx), book_id: object::id(&book) };
    (book, cap)
}
public fun set_paused<T>(book: &mut Book<T>, cap: &AdminCap, paused: bool) {
    assert!(cap.book_id == object::id(book), EAuthority);
    assert!(book.version == VERSION, EVersion);
    book.paused = paused;
}
/// Admin curates fixed professional fixtures; complete source terms are committed.
public fun create_market<T>(
    book: &mut Book<T>, cap: &AdminCap, league: u8, label_a: String, label_b: String,
    source_market: String, condition: vector<u8>, terms_json: String,
    starts: u64, clock: &Clock, ctx: &mut TxContext,
) {
    assert!(book.version == VERSION, EVersion);
    assert!(cap.book_id == object::id(book), EAuthority);
    assert!(!book.paused, EPaused);
    let now = clock.timestamp_ms() / 1000;
    assert!((league == 1 || league == 2) && starts >= now + 600 && starts <= now + 604800, ETerms);
    assert!(label_a.length() > 0 && label_a.length() <= 40 && label_b.length() > 0 && label_b.length() <= 40 && label_a != label_b, ETerms);
    assert!(source_market.length() > 0 && source_market.length() <= 32 && condition.length() == 32, ETerms);
    assert!(terms_json.length() > 0 && terms_json.length() <= 8192, ETerms);
    assert!(!table::contains(&book.conditions, condition), ETerms);
    let terms_hash = std::hash::sha2_256(*terms_json.as_bytes());
    let market = Market<T> {
        id: object::new(ctx), version: VERSION, book_id: object::id(book),
        tenant: book.tenant, creator: ctx.sender(), league, label_a, label_b,
        source_market, condition, terms_json, terms_hash, reporter: book.reporter,
        starts, cutoff: starts - 300, proof_deadline: starts + 172800, invalidated: false,
        candidate: 0, revision: 0, candidate_at: 0, candidate_block: 0,
        tuple_hash: vector[], receipt_hash: vector[],
        pool_a: 0, pool_b: 0, escrow: balance::zero(), result: 0,
        remaining_winning_stake: 0, claims: table::new(ctx), claim_count: 0,
    };
    let id = object::id(&market);
    table::add(&mut book.conditions, condition, id);
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
    assert!(market.result == 0 && clock.timestamp_ms() / 1000 < market.cutoff, EClosed);
    assert!(side == 1 || side == 2, ETerms);
    assert!(player.character_address() == ctx.sender() && player.tenant() == market.tenant, EAuthority);
    assert!(ctx.sender() != market.creator && ctx.sender() != market.reporter, EAuthority);
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
fun authority<T>(market: &Market<T>, terms_hash: &vector<u8>, clock: &Clock, ctx: &TxContext): u64 {
    assert!(market.version == VERSION, EVersion);
    assert!(ctx.sender() == market.reporter && *terms_hash == market.terms_hash, EAuthority);
    let now = clock.timestamp_ms() / 1000;
    assert!(market.result == 0 && !market.invalidated && now < market.proof_deadline, EClosed);
    now
}
fun fresh(now: u64, observed_at: u64, block_time: u64) {
    assert!(observed_at <= now && now - observed_at <= 300, EProof);
    assert!(block_time <= observed_at + 30 && block_time + 300 >= observed_at, EProof);
}
/// Identical result retries do not restart the hold; changed tuples advance revision.
public fun propose<T>(market: &mut Market<T>, terms_hash: vector<u8>, outcome: u8,
    tuple_hash: vector<u8>, receipt_hash: vector<u8>, block: u64, block_time: u64,
    observed_at: u64, clock: &Clock, ctx: &TxContext,
) {
    let now = authority(market, &terms_hash, clock, ctx);
    assert!(now >= market.starts, EClosed);
    fresh(now, observed_at, block_time);
    assert!(outcome >= 1 && outcome <= 3 && tuple_hash.length() == 32 && receipt_hash.length() == 32 && block > 0, EProof);
    if (market.candidate == outcome && market.tuple_hash == tuple_hash) return;
    assert!(block >= market.candidate_block, EProof);
    market.candidate = outcome; market.revision = market.revision + 1;
    market.candidate_at = now; market.candidate_block = block;
    market.tuple_hash = tuple_hash; market.receipt_hash = receipt_hash;
    event::emit(Candidate { market_id: object::id(market), revision: market.revision,
        result: outcome, received_at: now, block, tuple_hash, receipt_hash });
}
public fun confirm<T>(market: &mut Market<T>, terms_hash: vector<u8>, revision: u64,
    outcome: u8, tuple_hash: vector<u8>, receipt_hash: vector<u8>, block: u64,
    block_time: u64, observed_at: u64, clock: &Clock, ctx: &TxContext,
) {
    let now = authority(market, &terms_hash, clock, ctx);
    fresh(now, observed_at, block_time);
    assert!(market.candidate > 0 && revision == market.revision && outcome == market.candidate && tuple_hash == market.tuple_hash, EProof);
    assert!(observed_at >= market.candidate_at + 7200 && block_time >= market.candidate_at + 7200 && block > market.candidate_block, EProof);
    assert!(receipt_hash.length() == 32, EProof);
    market.receipt_hash = receipt_hash;
    finish(market, outcome);
}
/// Rule/fixture mutation or observed early start permanently returns original stakes.
public fun invalidate<T>(market: &mut Market<T>, terms_hash: vector<u8>, reason: u8,
    receipt_hash: vector<u8>, clock: &Clock, ctx: &TxContext,
) {
    let _ = authority(market, &terms_hash, clock, ctx);
    assert!(reason >= 1 && reason <= 3 && receipt_hash.length() == 32, EProof);
    market.invalidated = true; market.receipt_hash = receipt_hash;
    event::emit(Invalidated { market_id: object::id(market), reason, receipt_hash });
    finish(market, 3);
}
fun finish<T>(market: &mut Market<T>, outcome: u8) {
    market.result = if (market.pool_a == 0 || market.pool_b == 0) 3 else outcome;
    if (market.result == 1) market.remaining_winning_stake = market.pool_a
    else if (market.result == 2) market.remaining_winning_stake = market.pool_b;
    event::emit(Finalized { market_id: object::id(market), result: market.result });
}
/// Reporter-independent hard-deadline recovery. Pause never prevents recovery.
public fun finalize<T>(market: &mut Market<T>, clock: &Clock) {
    assert!(market.version == VERSION, EVersion);
    assert!(market.result == 0 && clock.timestamp_ms() / 1000 >= market.proof_deadline, EClosed);
    finish(market, 3);
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
public fun result<T>(m: &Market<T>): u8 { m.result }
public fun escrow<T>(m: &Market<T>): u64 { balance::value(&m.escrow) }
public fun market_ids<T>(b: &Book<T>): vector<ID> { b.markets }
public fun entitlement_id<T>(t: &Ticket<T>): ID { t.entitlement_id }
public fun paid<T>(e: &Entitlement<T>): bool { e.paid }
public fun payout<T>(e: &Entitlement<T>): u64 { e.payout }
#[test_only]
public fun setup_for_testing<T>(tenant: String, ctx: &mut TxContext) {
    let (book, cap) = new_book<T>(tenant, @0x77, ctx);
    transfer::share_object(book);
    transfer::public_transfer(cap, ctx.sender());
}

public fun terms_hash<T>(m: &Market<T>): vector<u8> { m.terms_hash }
public fun revision<T>(m: &Market<T>): u64 { m.revision }
public fun candidate_at<T>(m: &Market<T>): u64 { m.candidate_at }
