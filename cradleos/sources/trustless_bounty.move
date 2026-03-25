/// CradleOS – Trustless Bounty System v2
///
/// Fully trustless kill bounties verified by on-chain Killmail objects.
/// No attestor required — the chain IS the attestor.
///
/// Bounty types:
///   0 = SHIP_SINGLE      — one ship kill, full payout, done
///   1 = STRUCTURE_SINGLE  — one structure kill, full payout, done
///   2 = PER_SHIP          — pays reward_per_kill per ship kill until pool drains
///   3 = PER_STRUCTURE     — pays reward_per_kill per structure kill until pool drains
///
/// Anti-exploit:
///   - Killer cannot be the bounty target (no self-destruct farming)
///   - Each killmail can only be claimed once per bounty (no double-dipping)
///   - Loss type must match bounty type (ship bounty needs ship kill)
///
/// Pool mechanics (PER_* types):
///   - Poster escrows a pool of Coin<T>
///   - Each valid killmail drains reward_per_kill from the pool
///   - When pool < reward_per_kill, status flips to DRAINED
///   - Poster can top_up to re-open a drained bounty
///   - Poster (or anyone after expiry) can cancel to reclaim remainder
module cradleos::trustless_bounty {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use sui::event;
    use sui::table::{Self, Table};
    use std::string::{Self, String};
    use world::killmail::{Self, Killmail};
    use world::character::Character;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotPoster:         u64 = 0;
    const ENotOpen:           u64 = 1;
    const EZeroReward:        u64 = 2;
    const EVictimMismatch:    u64 = 3;
    const EKillerMismatch:    u64 = 4;
    const EExpired:           u64 = 5;
    const ELossTypeMismatch:  u64 = 6;
    const ESelfDestruct:      u64 = 7;
    const EAlreadyClaimed:    u64 = 8;
    const EPoolDrained:       u64 = 9;
    const EInvalidBountyType: u64 = 10;
    const EZeroPerKill:       u64 = 11;

    // ── Bounty type constants ─────────────────────────────────────────────────

    const TYPE_SHIP_SINGLE:      u8 = 0;
    const TYPE_STRUCTURE_SINGLE: u8 = 1;
    const TYPE_PER_SHIP:         u8 = 2;
    const TYPE_PER_STRUCTURE:    u8 = 3;

    // ── Status constants ──────────────────────────────────────────────────────

    const STATUS_OPEN:      u8 = 0;
    const STATUS_CLAIMED:   u8 = 1;  // single bounties only
    const STATUS_CANCELLED: u8 = 2;
    const STATUS_DRAINED:   u8 = 3;  // per-kill bounties when pool < reward_per_kill

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared.  One global board — monotonic counter for bounty IDs.
    public struct TrustlessBountyBoard has key {
        id: UID,
        bounty_count: u64,
    }

    /// Shared.  One object per bounty.  Generic over coin type T.
    public struct TrustlessBounty<phantom T> has key {
        id: UID,
        board_id: ID,
        bounty_index: u64,
        /// Who posted (and who receives refund on cancel).
        poster: address,
        /// EVE in-game character ID of the target.
        target_char_id: u64,
        /// Human-readable target name.
        target_name: String,
        /// Escrowed reward pool.
        reward: Balance<T>,
        /// 0=SHIP_SINGLE, 1=STRUCTURE_SINGLE, 2=PER_SHIP, 3=PER_STRUCTURE
        bounty_type: u8,
        /// Amount paid per valid kill claim.
        reward_per_kill: u64,
        /// How many kills have been claimed against this bounty.
        kills_claimed: u64,
        /// Running total of coin paid out.
        total_paid_out: u64,
        /// Killmail object IDs already claimed (prevents double-dip).
        claimed_killmails: Table<ID, bool>,
        /// 0=open, 1=claimed(single), 2=cancelled, 3=drained(per-kill)
        status: u8,
        /// Wall-clock ms at creation.
        created_ms: u64,
        /// Wall-clock ms after which anyone may cancel.
        expires_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct BountyPosted has copy, drop {
        bounty_id: ID,
        poster: address,
        target_char_id: u64,
        target_name: String,
        reward_amount: u64,
        bounty_type: u8,
        reward_per_kill: u64,
        expires_ms: u64,
    }

    public struct KillClaimed has copy, drop {
        bounty_id: ID,
        killer: address,
        reward_amount: u64,
        killmail_id: ID,
        kills_total: u64,
    }

    public struct BountyCancelled has copy, drop {
        bounty_id: ID,
        poster: address,
        refund_amount: u64,
    }

    public struct BountyTopUp has copy, drop {
        bounty_id: ID,
        amount: u64,
        new_total: u64,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create and share the global TrustlessBountyBoard.  Call once.
    entry fun create_board_entry(ctx: &mut TxContext) {
        transfer::share_object(TrustlessBountyBoard {
            id: object::new(ctx),
            bounty_count: 0,
        });
    }

    /// Post a new bounty.  Escrows `coin` as the reward pool.
    ///
    /// For SINGLE types: reward_per_kill is ignored (set to total amount).
    /// For PER_* types:  reward_per_kill must be > 0.
    entry fun post_bounty_entry<T>(
        board: &mut TrustlessBountyBoard,
        target_char_id: u64,
        target_name: vector<u8>,
        coin: Coin<T>,
        bounty_type: u8,
        reward_per_kill: u64,
        expires_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let reward_amount = coin.value();
        assert!(reward_amount > 0, EZeroReward);
        assert!(bounty_type <= 3, EInvalidBountyType);

        // For per-kill bounties, reward_per_kill must be > 0
        let effective_per_kill = if (bounty_type == TYPE_PER_SHIP || bounty_type == TYPE_PER_STRUCTURE) {
            assert!(reward_per_kill > 0, EZeroPerKill);
            reward_per_kill
        } else {
            // Single bounties: full payout on one kill
            reward_amount
        };

        let poster     = ctx.sender();
        let created_ms = clock.timestamp_ms();
        let bounty_index = board.bounty_count;
        board.bounty_count = bounty_index + 1;

        let bounty_uid = object::new(ctx);
        let bounty_id  = object::uid_to_inner(&bounty_uid);

        event::emit(BountyPosted {
            bounty_id,
            poster,
            target_char_id,
            target_name: string::utf8(target_name),
            reward_amount,
            bounty_type,
            reward_per_kill: effective_per_kill,
            expires_ms,
        });

        transfer::share_object(TrustlessBounty<T> {
            id: bounty_uid,
            board_id: object::uid_to_inner(&board.id),
            bounty_index,
            poster,
            target_char_id,
            target_name: string::utf8(target_name),
            reward: coin.into_balance(),
            bounty_type,
            reward_per_kill: effective_per_kill,
            kills_claimed: 0,
            total_paid_out: 0,
            claimed_killmails: table::new(ctx),
            status: STATUS_OPEN,
            created_ms,
            expires_ms,
        });
    }

    /// Claim a kill.  Fully trustless — verified against on-chain Killmail.
    ///
    /// Checks:
    ///   1. Bounty is OPEN
    ///   2. Not expired
    ///   3. Killmail not already claimed on this bounty
    ///   4. Killmail victim == bounty target
    ///   5. Killmail killer == provided killer character
    ///   6. Killer is NOT the target (anti self-destruct)
    ///   7. Loss type matches bounty type (ship vs structure)
    ///   8. Pool has enough for payout
    entry fun claim_kill_entry<T>(
        bounty: &mut TrustlessBounty<T>,
        killmail: &Killmail,
        killer_char: &Character,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // 1. Must be open
        assert!(bounty.status == STATUS_OPEN, ENotOpen);

        // 2. Not expired
        let now = clock.timestamp_ms();
        assert!(now < bounty.expires_ms, EExpired);

        // 3. Killmail not already claimed on this bounty
        let killmail_id = killmail::id(killmail);
        assert!(!table::contains(&bounty.claimed_killmails, killmail_id), EAlreadyClaimed);

        // 4. Victim matches target
        let victim_key = killmail::victim_id(killmail);
        assert!(victim_key.item_id() == bounty.target_char_id, EVictimMismatch);

        // 5. Killer matches provided character
        let killmail_killer_key = killmail::killer_id(killmail);
        let char_key = killer_char.key();
        assert!(killmail_killer_key.item_id() == char_key.item_id(), EKillerMismatch);

        // 6. ANTI SELF-DESTRUCT: killer cannot be the target
        assert!(killmail_killer_key.item_id() != bounty.target_char_id, ESelfDestruct);

        // 7. Loss type must match bounty type
        if (bounty.bounty_type == TYPE_SHIP_SINGLE || bounty.bounty_type == TYPE_PER_SHIP) {
            assert!(killmail::is_ship_loss(killmail), ELossTypeMismatch);
        } else {
            assert!(killmail::is_structure_loss(killmail), ELossTypeMismatch);
        };

        // 8. Pool has enough for payout
        let pool_remaining = balance::value(&bounty.reward);
        assert!(pool_remaining >= bounty.reward_per_kill, EPoolDrained);

        // ── Execute payout ────────────────────────────────────────────────────

        // Record this killmail as claimed
        table::add(&mut bounty.claimed_killmails, killmail_id, true);
        bounty.kills_claimed = bounty.kills_claimed + 1;
        bounty.total_paid_out = bounty.total_paid_out + bounty.reward_per_kill;

        // Resolve killer wallet address from Character
        let killer_address = killer_char.character_address();

        // Transfer reward
        let payout = coin::from_balance(
            balance::split(&mut bounty.reward, bounty.reward_per_kill),
            ctx,
        );
        transfer::public_transfer(payout, killer_address);

        // Update status
        if (bounty.bounty_type == TYPE_SHIP_SINGLE || bounty.bounty_type == TYPE_STRUCTURE_SINGLE) {
            // Single bounty: one kill, done
            bounty.status = STATUS_CLAIMED;
        } else if (balance::value(&bounty.reward) < bounty.reward_per_kill) {
            // Per-kill bounty: pool can't cover another kill
            bounty.status = STATUS_DRAINED;
        };

        event::emit(KillClaimed {
            bounty_id: object::uid_to_inner(&bounty.id),
            killer: killer_address,
            reward_amount: bounty.reward_per_kill,
            killmail_id,
            kills_total: bounty.kills_claimed,
        });
    }

    /// Top up a per-kill bounty pool.  Re-opens DRAINED bounties.
    entry fun top_up_entry<T>(
        bounty: &mut TrustlessBounty<T>,
        coin: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == bounty.poster, ENotPoster);
        assert!(bounty.status == STATUS_OPEN || bounty.status == STATUS_DRAINED, ENotOpen);

        let amount = coin.value();
        balance::join(&mut bounty.reward, coin.into_balance());

        // Re-open if was drained and pool now covers at least one kill
        if (bounty.status == STATUS_DRAINED && balance::value(&bounty.reward) >= bounty.reward_per_kill) {
            bounty.status = STATUS_OPEN;
        };

        event::emit(BountyTopUp {
            bounty_id: object::uid_to_inner(&bounty.id),
            amount,
            new_total: balance::value(&bounty.reward),
        });
    }

    /// Cancel a bounty.  Poster can cancel anytime; anyone can cancel after expiry.
    /// Refunds remaining pool to poster.
    entry fun cancel_bounty_entry<T>(
        bounty: &mut TrustlessBounty<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(bounty.status == STATUS_OPEN || bounty.status == STATUS_DRAINED, ENotOpen);
        let now = clock.timestamp_ms();
        let caller = ctx.sender();
        assert!(caller == bounty.poster || now >= bounty.expires_ms, ENotPoster);

        bounty.status = STATUS_CANCELLED;

        let refund_amount = balance::value(&bounty.reward);
        if (refund_amount > 0) {
            let refund = coin::from_balance(
                balance::split(&mut bounty.reward, refund_amount),
                ctx,
            );
            transfer::public_transfer(refund, bounty.poster);
        };

        event::emit(BountyCancelled {
            bounty_id: object::uid_to_inner(&bounty.id),
            poster: bounty.poster,
            refund_amount,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun bounty_count(board: &TrustlessBountyBoard): u64             { board.bounty_count }
    public fun poster<T>(b: &TrustlessBounty<T>): address                  { b.poster }
    public fun target_char_id<T>(b: &TrustlessBounty<T>): u64              { b.target_char_id }
    public fun target_name<T>(b: &TrustlessBounty<T>): &String             { &b.target_name }
    public fun status<T>(b: &TrustlessBounty<T>): u8                       { b.status }
    public fun reward_amount<T>(b: &TrustlessBounty<T>): u64               { balance::value(&b.reward) }
    public fun bounty_type<T>(b: &TrustlessBounty<T>): u8                  { b.bounty_type }
    public fun reward_per_kill<T>(b: &TrustlessBounty<T>): u64             { b.reward_per_kill }
    public fun kills_claimed<T>(b: &TrustlessBounty<T>): u64               { b.kills_claimed }
    public fun total_paid_out<T>(b: &TrustlessBounty<T>): u64              { b.total_paid_out }
    public fun expires_ms<T>(b: &TrustlessBounty<T>): u64                  { b.expires_ms }
    public fun created_ms<T>(b: &TrustlessBounty<T>): u64                  { b.created_ms }
    public fun board_id<T>(b: &TrustlessBounty<T>): ID                     { b.board_id }
    public fun bounty_index<T>(b: &TrustlessBounty<T>): u64                { b.bounty_index }
}
