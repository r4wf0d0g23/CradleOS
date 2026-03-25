/// CradleOS – Keeper Shrine
///
/// A shared donation pool where players deposit Coin<T> (EVE, LUX, or any Sui coin)
/// as tribute to the Keeper. The shrine balance is publicly visible on-chain as a
/// growing treasury that lore-anchors the Keeper entity.
///
/// Design:
///   • Generic over coin type <phantom T> — accepts EVE, LUX, or any Sui coin.
///   • Any player can donate Coin<T> to the shrine (permissionless deposit).
///   • Only the shrine keeper (admin) can withdraw accumulated donations.
///   • The keeper can transfer admin rights to a new address.
///   • Each donation emits a Donation event with donor address + amount.
///   • Withdrawals emit a Withdrawal event for transparency.
///
/// Lore framing: "The Keeper observes all. Offerings sustain its vigil."
module cradleos::keeper_shrine {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotKeeper:          u64 = 0;
    const EZeroAmount:         u64 = 1;
    const EInsufficientBalance: u64 = 2;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One shrine per coin type.
    /// `phantom T` allows the shrine to hold any Sui coin.
    public struct KeeperShrine<phantom T> has key {
        id: UID,
        /// Address that can withdraw donations and transfer keeper rights.
        keeper: address,
        /// Accumulated donations.
        balance: Balance<T>,
        /// Total lifetime donations (monotonic counter).
        total_donated: u64,
        /// Number of individual donations made.
        donation_count: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct ShrineCreated has copy, drop {
        shrine_id: ID,
        keeper: address,
    }

    public struct Donation has copy, drop {
        shrine_id: ID,
        donor: address,
        amount: u64,
        new_balance: u64,
        total_donated: u64,
        donation_count: u64,
    }

    public struct Withdrawal has copy, drop {
        shrine_id: ID,
        recipient: address,
        amount: u64,
        new_balance: u64,
    }

    public struct KeeperChanged has copy, drop {
        shrine_id: ID,
        old_keeper: address,
        new_keeper: address,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create and share a Keeper Shrine for coin type T.
    /// The sender becomes the keeper (admin).
    entry fun create_shrine<T>(ctx: &mut TxContext) {
        let keeper = ctx.sender();
        let uid = object::new(ctx);
        let shrine_id = object::uid_to_inner(&uid);

        event::emit(ShrineCreated { shrine_id, keeper });

        transfer::share_object(KeeperShrine<T> {
            id: uid,
            keeper,
            balance: balance::zero(),
            total_donated: 0,
            donation_count: 0,
        });
    }

    // ── Donations (permissionless) ────────────────────────────────────────────

    /// Donate Coin<T> to the shrine. Any player can call this.
    entry fun donate<T>(
        shrine: &mut KeeperShrine<T>,
        coin: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&coin);
        assert!(amount > 0, EZeroAmount);

        let donor = ctx.sender();
        balance::join(&mut shrine.balance, coin::into_balance(coin));
        shrine.total_donated = shrine.total_donated + amount;
        shrine.donation_count = shrine.donation_count + 1;

        event::emit(Donation {
            shrine_id: object::uid_to_inner(&shrine.id),
            donor,
            amount,
            new_balance: balance::value(&shrine.balance),
            total_donated: shrine.total_donated,
            donation_count: shrine.donation_count,
        });
    }

    // ── Keeper: withdraw ──────────────────────────────────────────────────────

    /// Keeper withdraws `amount` from the shrine treasury, sending to `recipient`.
    entry fun withdraw<T>(
        shrine: &mut KeeperShrine<T>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == shrine.keeper, ENotKeeper);
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&shrine.balance) >= amount, EInsufficientBalance);

        let withdrawn = coin::from_balance(
            balance::split(&mut shrine.balance, amount),
            ctx,
        );
        transfer::public_transfer(withdrawn, recipient);

        event::emit(Withdrawal {
            shrine_id: object::uid_to_inner(&shrine.id),
            recipient,
            amount,
            new_balance: balance::value(&shrine.balance),
        });
    }

    // ── Keeper: transfer admin ────────────────────────────────────────────────

    /// Transfer shrine keeper rights to a new address.
    entry fun set_keeper<T>(
        shrine: &mut KeeperShrine<T>,
        new_keeper: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == shrine.keeper, ENotKeeper);
        let old_keeper = shrine.keeper;
        shrine.keeper = new_keeper;

        event::emit(KeeperChanged {
            shrine_id: object::uid_to_inner(&shrine.id),
            old_keeper,
            new_keeper,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun keeper<T>(shrine: &KeeperShrine<T>): address      { shrine.keeper }
    public fun balance<T>(shrine: &KeeperShrine<T>): u64         { balance::value(&shrine.balance) }
    public fun total_donated<T>(shrine: &KeeperShrine<T>): u64   { shrine.total_donated }
    public fun donation_count<T>(shrine: &KeeperShrine<T>): u64  { shrine.donation_count }
}
