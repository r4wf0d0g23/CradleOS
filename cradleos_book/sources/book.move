/// Player-funded, permissionlessly proven Frontier kill contests.
/// Scores count qualifying canonical proofs submitted by the frozen deadline.
module cradleos_book::book;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::clock::{Self, Clock};
use sui::derived_object;
use sui::event;
use sui::table::{Self, Table};
use world::character::{Self, Character};
use world::in_game_id::{Self, TenantItemId};
use world::killmail::{Self, Killmail};

const EAuthority: u64 = 0;
const ETerms: u64 = 1;
const EClosed: u64 = 2;
const EAmount: u64 = 3;
const EProof: u64 = 4;
const EDuplicate: u64 = 5;
const ENotFinal: u64 = 6;
const ETicket: u64 = 7;
const EPaused: u64 = 8;
const EVersion: u64 = 9;
const VERSION: u64 = 1;
const REGISTRY: address = @0x69dfecd272649c16aff85bb7638b45a0b3afe40b57433009408aa27c397a4db7;

public struct BootstrapCap has key { id: UID }
public struct AdminCap has key, store { id: UID, book_id: ID }
public struct Book<phantom T> has key {
    id: UID, version: u64, paused: bool, registry: ID, tenant: String,
    markets: vector<ID>,
}
public struct Market<phantom T> has key {
    id: UID, version: u64, book_id: ID, registry: ID, tenant: String,
    a: TenantItemId, b: TenantItemId, character_a: ID, character_b: ID,
    starts: u64, ends: u64, proof_deadline: u64,
    loss_type: u8, system_id: u64,
    pool_a: u64, pool_b: u64, escrow: Balance<T>,
    score_a: u64, score_b: u64, seen: Table<ID, bool>,
    /// 0=pending, 1=A, 2=B, 3=refund. Only finalize writes this field.
    result: u8, remaining_winning_stake: u64,
}
/// No store ability: cannot be transferred by third-party modules.
public struct Ticket<phantom T> has key {
    id: UID, market_id: ID, bettor: address, side: u8, stake: u64,
}
public struct MarketCreated has copy, drop { book_id: ID, market_id: ID }
public struct WagerPlaced has copy, drop { market_id: ID, ticket_id: ID, bettor: address, side: u8, stake: u64 }
public struct ProofCounted has copy, drop { market_id: ID, killmail_id: ID, side: u8 }
public struct Finalized has copy, drop { market_id: ID, result: u8, score_a: u64, score_b: u64 }
public struct Claimed has copy, drop { market_id: ID, ticket_id: ID, bettor: address, payout: u64 }

fun init(ctx: &mut TxContext) {
    transfer::transfer(BootstrapCap { id: object::new(ctx) }, ctx.sender());
}

/// Bootstrap once; consumes the publication capability. No seed funds needed.
public fun create_book<T>(cap: BootstrapCap, ctx: &mut TxContext) {
    let BootstrapCap { id } = cap; id.delete();
    let (book, admin) = new_book<T>(object::id_from_address(REGISTRY), string::utf8(b"stillness"), ctx);
    transfer::share_object(book);
    transfer::public_transfer(admin, ctx.sender());
}
fun new_book<T>(registry: ID, tenant: String, ctx: &mut TxContext): (Book<T>, AdminCap) {
    let book = Book<T> { id: object::new(ctx), version: VERSION, paused: false, registry, tenant, markets: vector[] };
    let admin = AdminCap { id: object::new(ctx), book_id: object::id(&book) };
    (book, admin)
}
public fun set_paused<T>(book: &mut Book<T>, cap: &AdminCap, paused: bool) {
    assert!(cap.book_id == object::id(book), EAuthority);
    assert!(book.version == VERSION, EVersion);
    book.paused = paused;
}

/// All market terms freeze here; no edit/cancel/admin-withdraw path exists.
public fun create_market<T>(
    book: &mut Book<T>, cap: &AdminCap, a: &Character, b: &Character,
    starts: u64, ends: u64, proof_deadline: u64, loss_type: u8, system_id: u64,
    clock: &Clock, ctx: &mut TxContext,
) {
    assert!(book.version == VERSION, EVersion);
    assert!(cap.book_id == object::id(book), EAuthority);
    assert!(!book.paused, EPaused);
    let now = clock::timestamp_ms(clock) / 1000;
    assert!(starts >= now + 300 && starts <= now + 2592000, ETerms);
    assert!(ends >= starts + 60 && ends <= starts + 604800, ETerms);
    assert!(proof_deadline >= ends + 3600 && proof_deadline <= ends + 604800, ETerms);
    assert!(loss_type == 1 || loss_type == 2, ETerms);
    let a_key = character::key(a); let b_key = character::key(b);
    assert!(a_key != b_key, ETerms);
    assert!(character::tenant(a) == book.tenant && character::tenant(b) == book.tenant, ETerms);
    let market = Market<T> {
        id: object::new(ctx), version: VERSION, book_id: object::id(book),
        registry: book.registry, tenant: book.tenant,
        a: a_key, b: b_key, character_a: object::id(a), character_b: object::id(b),
        starts, ends, proof_deadline, loss_type, system_id,
        pool_a: 0, pool_b: 0, escrow: balance::zero(),
        score_a: 0, score_b: 0, seen: table::new(ctx), result: 0, remaining_winning_stake: 0,
    };
    let market_id = object::id(&market);
    book.markets.push_back(market_id);
    event::emit(MarketCreated { book_id: object::id(book), market_id });
    transfer::share_object(market);
}

public fun place_bet<T>(book: &Book<T>, market: &mut Market<T>, player: &Character,
    side: u8, funds: Coin<T>, clock: &Clock, ctx: &mut TxContext) {
    assert!(book.version == VERSION && market.version == VERSION, EVersion);
    assert!(market.book_id == object::id(book), EAuthority);
    assert!(!book.paused, EPaused);
    assert!(market.result == 0 && clock::timestamp_ms(clock) / 1000 < market.starts, EClosed);
    assert!(side == 1 || side == 2, ETerms);
    assert!(character::character_address(player) == ctx.sender() && character::tenant(player) == market.tenant, EAuthority);
    let stake = coin::value(&funds); assert!(stake > 0, EAmount);
    // u64 balance join and checked arithmetic reject over-capacity atomically.
    if (side == 1) market.pool_a = market.pool_a + stake else market.pool_b = market.pool_b + stake;
    balance::join(&mut market.escrow, coin::into_balance(funds));
    let ticket = Ticket<T> { id: object::new(ctx), market_id: object::id(market), bettor: ctx.sender(), side, stake };
    event::emit(WagerPlaced { market_id: object::id(market), ticket_id: object::id(&ticket), bettor: ctx.sender(), side, stake });
    transfer::transfer(ticket, ctx.sender());
}

/// Anyone may contribute a proof. Neither caller nor operator chooses its side.
public fun submit_proof<T>(market: &mut Market<T>, proof: &Killmail, clock: &Clock) {
    assert!(market.version == VERSION, EVersion);
    let now = clock::timestamp_ms(clock) / 1000;
    assert!(market.result == 0 && now >= market.starts && now < market.proof_deadline, EClosed);
    let key = killmail::key(proof); let proof_id = object::id(proof);
    assert!(object::id_to_address(&proof_id) == derived_object::derive_address(market.registry, key), EProof);
    assert!(in_game_id::tenant(&key) == market.tenant, EProof);
    let timestamp = killmail::kill_timestamp(proof);
    assert!(timestamp >= market.starts && timestamp < market.ends && timestamp <= now, EProof);
    assert!((market.loss_type == 1 && killmail::is_ship_loss(proof)) || (market.loss_type == 2 && killmail::is_structure_loss(proof)), EProof);
    let system = killmail::solar_system_id(proof);
    assert!(market.system_id == 0 || market.system_id == in_game_id::item_id(&system), EProof);
    let killer = killmail::killer_id(proof);
    assert!(killer == market.a || killer == market.b, EProof);
    assert!(!table::contains(&market.seen, proof_id), EDuplicate);
    table::add(&mut market.seen, proof_id, true);
    let side = if (killer == market.a) { market.score_a = market.score_a + 1; 1 } else { market.score_b = market.score_b + 1; 2 };
    event::emit(ProofCounted { market_id: object::id(market), killmail_id: proof_id, side });
}

public fun finalize<T>(market: &mut Market<T>, clock: &Clock) {
    assert!(market.version == VERSION, EVersion);
    assert!(market.result == 0 && clock::timestamp_ms(clock) / 1000 >= market.proof_deadline, EClosed);
    if (market.pool_a == 0 || market.pool_b == 0 || market.score_a == market.score_b) {
        market.result = 3;
    } else if (market.score_a > market.score_b) {
        market.result = 1; market.remaining_winning_stake = market.pool_a;
    } else {
        market.result = 2; market.remaining_winning_stake = market.pool_b;
    };
    event::emit(Finalized { market_id: object::id(market), result: market.result, score_a: market.score_a, score_b: market.score_b });
}

public fun claim<T>(market: &mut Market<T>, ticket: Ticket<T>, ctx: &mut TxContext) {
    assert!(market.version == VERSION, EVersion);
    assert!(market.result != 0, ENotFinal);
    let Ticket { id, market_id, bettor, side, stake } = ticket;
    assert!(market_id == object::id(market) && bettor == ctx.sender(), ETicket);
    let ticket_id = object::uid_to_inner(&id); id.delete();
    let payout = if (market.result == 3) { stake }
    else if (market.result == side) {
        let winner_pool = if (side == 1) market.pool_a else market.pool_b;
        let claimed = winner_pool - market.remaining_winning_stake;
        market.remaining_winning_stake = market.remaining_winning_stake - stake;
        let total = (market.pool_a as u128) + (market.pool_b as u128);
        // Cumulative entitlements distribute all dust, with <1 atom rounding
        // difference per ticket, regardless of ticket count or claim order.
        (((((claimed as u128) + (stake as u128)) * total / (winner_pool as u128))
            - ((claimed as u128) * total / (winner_pool as u128))) as u64)
    } else { 0 };
    if (payout > 0) transfer::public_transfer(coin::from_balance(balance::split(&mut market.escrow, payout), ctx), bettor);
    event::emit(Claimed { market_id, ticket_id, bettor, payout });
}

public fun scores<T>(market: &Market<T>): (u64, u64) { (market.score_a, market.score_b) }
public fun result<T>(market: &Market<T>): u8 { market.result }
public fun escrow<T>(market: &Market<T>): u64 { balance::value(&market.escrow) }
public fun market_ids<T>(book: &Book<T>): vector<ID> { book.markets }

#[test_only]
public fun setup_for_testing<T>(registry: ID, tenant: String, ctx: &mut TxContext) {
    let (book, cap) = new_book<T>(registry, tenant, ctx);
    transfer::share_object(book); transfer::public_transfer(cap, ctx.sender());
}
