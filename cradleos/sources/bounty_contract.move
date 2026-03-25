/// CradleOS – Bounty Contract
///
/// Attestor-gated kill bounties with generic coin escrow.
///
/// Anyone can post a bounty by escrowing Coin<T> and naming:
///   • The target (EVE character ID + display name)
///   • An attestor address trusted to confirm the kill on-chain
///   • An expiry timestamp (ms)
///
/// The attestor calls confirm_kill_entry to release the escrowed reward to
/// whoever executed the kill.  The poster (or anyone, after expiry) can
/// cancel and reclaim the funds.
///
/// One global BountyBoard tracks how many bounties have been posted (ID counter).
/// Each Bounty is a shared object so attestors / posters can transact against it.
module cradleos::bounty_contract {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use sui::event;
    use std::string::{Self, String};
    use world::killmail::Killmail;
    use world::character::Character;
    use world::in_game_id;

    // ── Error codes ───────────────────────────────────────────────────────────

    /// Caller is not the designated attestor for this bounty.
    const ENotAttestor:  u64 = 0;
    /// Caller is not the poster and the bounty has not expired.
    const ENotPoster:    u64 = 1;
    /// Bounty is not in the OPEN state.
    const ENotOpen:      u64 = 2;
    /// Reward coin has zero value.
    const EZeroReward:        u64 = 3;
    /// Killmail victim does not match the bounty target.
    const EVictimMismatch:    u64 = 4;
    /// Killmail killer does not match the provided killer character.
    const EKillerMismatch:    u64 = 5;
    /// Bounty has expired.
    const EExpired:           u64 = 6;

    // ── Status constants ──────────────────────────────────────────────────────

    const STATUS_OPEN:      u8 = 0;
    const STATUS_CLAIMED:   u8 = 1;
    const STATUS_CANCELLED: u8 = 2;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared.  One global board — holds a monotonic counter for bounty IDs.
    public struct BountyBoard has key {
        id: UID,
        bounty_count: u64,
    }

    /// Shared.  One object per bounty. Generic over coin type T.
    public struct Bounty<phantom T> has key {
        id: UID,
        /// ID of the BountyBoard that issued this bounty.
        board_id: ID,
        /// Incrementing serial number within the board (for UI ordering).
        bounty_index: u64,
        /// Who posted the bounty.
        poster: address,
        /// EVE in-game character ID of the target.
        target_char_id: u64,
        /// Human-readable target name.
        target_name: String,
        /// Escrowed reward.
        reward: Balance<T>,
        /// Trusted party who can confirm the kill.
        attestor: address,
        /// Set to the killer's address when claimed.
        killer: Option<address>,
        /// On-chain killmail proof (optional).
        killmail_object_id: Option<address>,
        /// 0 = open, 1 = claimed, 2 = cancelled.
        status: u8,
        /// Wall-clock ms at creation time.
        created_ms: u64,
        /// Wall-clock ms at which anyone may cancel (not only the poster).
        expires_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct BountyPosted has copy, drop {
        bounty_id: ID,
        poster: address,
        target_char_id: u64,
        target_name: String,
        reward_amount: u64,
        attestor: address,
        expires_ms: u64,
    }

    public struct BountyClaimed has copy, drop {
        bounty_id: ID,
        killer: address,
        reward_amount: u64,
        killmail_object_id: Option<address>,
    }

    public struct BountyCancelled has copy, drop {
        bounty_id: ID,
        poster: address,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create and share the global BountyBoard.  Call once at deploy.
    entry fun create_bounty_board_entry(ctx: &mut TxContext) {
        transfer::share_object(BountyBoard {
            id: object::new(ctx),
            bounty_count: 0,
        });
    }

    /// Post a new bounty.  Escrows `coin` as the reward.
    /// `expires_ms` is an absolute wall-clock millisecond timestamp.
    entry fun post_bounty_entry<T>(
        board: &mut BountyBoard,
        target_char_id: u64,
        target_name: vector<u8>,
        coin: Coin<T>,
        attestor: address,
        expires_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let reward_amount = coin.value();
        assert!(reward_amount > 0, EZeroReward);

        let poster       = ctx.sender();
        let created_ms   = clock.timestamp_ms();
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
            attestor,
            expires_ms,
        });

        transfer::share_object(Bounty<T> {
            id: bounty_uid,
            board_id: object::uid_to_inner(&board.id),
            bounty_index,
            poster,
            target_char_id,
            target_name: string::utf8(target_name),
            reward: coin.into_balance(),
            attestor,
            killer: option::none(),
            killmail_object_id: option::none(),
            status: STATUS_OPEN,
            created_ms,
            expires_ms,
        });
    }

    /// Confirm a kill.  Only the designated attestor may call.
    /// Transfers the escrowed reward to `killer_address`.
    entry fun confirm_kill_entry<T>(
        bounty: &mut Bounty<T>,
        killer_address: address,
        _clock: &Clock,
        killmail_object_id: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == bounty.attestor, ENotAttestor);
        assert!(bounty.status == STATUS_OPEN, ENotOpen);

        bounty.status = STATUS_CLAIMED;
        bounty.killer = option::some(killer_address);
        bounty.killmail_object_id = option::some(killmail_object_id);

        let reward_amount = balance::value(&bounty.reward);
        let payout = coin::from_balance(balance::split(&mut bounty.reward, reward_amount), ctx);
        transfer::public_transfer(payout, killer_address);

        event::emit(BountyClaimed {
            bounty_id: object::uid_to_inner(&bounty.id),
            killer: killer_address,
            reward_amount,
            killmail_object_id: option::some(killmail_object_id),
        });
    }

    /// Trustless kill claim.  Anyone may submit a Killmail object whose victim
    /// and killer fields match this bounty.  No attestor is required.
    ///
    /// Verifications:
    ///   1. Bounty must be OPEN.
    ///   2. Bounty must not be expired (wall-clock ms < expires_ms).
    ///   3. killmail.victim_id.item_id() == bounty.target_char_id.
    ///   4. killmail.killer_id.item_id() == killer_char.key().item_id().
    ///
    /// Pays the escrowed reward to the killer's on-chain wallet address.
    entry fun claim_bounty_trustless_entry<T>(
        bounty: &mut Bounty<T>,
        killmail: &Killmail,
        killer_char: &Character,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // 1. Bounty must be OPEN
        assert!(bounty.status == STATUS_OPEN, ENotOpen);

        // 2. Must not be expired
        let now = clock.timestamp_ms();
        assert!(now < bounty.expires_ms, EExpired);

        // 3. Killmail victim must match bounty target
        let victim_key = world::killmail::victim_id(killmail);
        assert!(victim_key.item_id() == bounty.target_char_id, EVictimMismatch);

        // 4. Killmail killer must match the provided killer character
        let killmail_killer_key = world::killmail::killer_id(killmail);
        let char_key = killer_char.key();
        assert!(killmail_killer_key.item_id() == char_key.item_id(), EKillerMismatch);

        // Resolve killer's wallet address from Character object
        let killer_address = killer_char.character_address();

        // Mark claimed
        bounty.status = STATUS_CLAIMED;
        bounty.killer = option::some(killer_address);
        let killmail_obj_addr = object::id_address(killmail);
        bounty.killmail_object_id = option::some(killmail_obj_addr);

        // Pay out reward
        let reward_amount = balance::value(&bounty.reward);
        let payout = coin::from_balance(balance::split(&mut bounty.reward, reward_amount), ctx);
        transfer::public_transfer(payout, killer_address);

        event::emit(BountyClaimed {
            bounty_id: object::uid_to_inner(&bounty.id),
            killer: killer_address,
            reward_amount,
            killmail_object_id: option::some(killmail_obj_addr),
        });
    }

    /// Cancel a bounty.  Caller must be the poster OR the bounty must be expired.
    /// Refunds escrowed reward to the poster.
    entry fun cancel_bounty_entry<T>(
        bounty: &mut Bounty<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(bounty.status == STATUS_OPEN, ENotOpen);
        let now = clock.timestamp_ms();
        let caller = ctx.sender();
        assert!(caller == bounty.poster || now >= bounty.expires_ms, ENotPoster);

        bounty.status = STATUS_CANCELLED;

        let refund_amount = balance::value(&bounty.reward);
        let refund = coin::from_balance(balance::split(&mut bounty.reward, refund_amount), ctx);
        transfer::public_transfer(refund, bounty.poster);

        event::emit(BountyCancelled {
            bounty_id: object::uid_to_inner(&bounty.id),
            poster: bounty.poster,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun bounty_count(board: &BountyBoard): u64                 { board.bounty_count }
    public fun poster<T>(b: &Bounty<T>): address                      { b.poster }
    public fun attestor<T>(b: &Bounty<T>): address                    { b.attestor }
    public fun target_char_id<T>(b: &Bounty<T>): u64                  { b.target_char_id }
    public fun target_name<T>(b: &Bounty<T>): &String                 { &b.target_name }
    public fun status<T>(b: &Bounty<T>): u8                           { b.status }
    public fun reward_amount<T>(b: &Bounty<T>): u64                   { balance::value(&b.reward) }
    public fun killer<T>(b: &Bounty<T>): Option<address>              { b.killer }
    public fun expires_ms<T>(b: &Bounty<T>): u64                      { b.expires_ms }
    public fun created_ms<T>(b: &Bounty<T>): u64                      { b.created_ms }
    public fun board_id<T>(b: &Bounty<T>): ID                         { b.board_id }
    public fun bounty_index<T>(b: &Bounty<T>): u64                    { b.bounty_index }
}
