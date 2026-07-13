/// CradleOS Casino — House / Bankroll
///
/// The House is the shared bankroll object that funds all casino games.
/// It is generic over the wager coin type `T` so the same code works with the
/// play-money faucet chip during PoC and with `$EVE` at launch — only the type
/// argument changes at the call site.
///
/// SECURITY MODEL (Sui on-chain randomness):
///   Functions that consume `&Random` MUST be `entry` and non-`public` so they
///   cannot be composed inside a larger PTB that inspects the result and aborts
///   on a loss ("test-and-abort"). The House module itself never touches
///   randomness — it only holds funds and exposes package-private pay/collect
///   primitives that the per-game modules call from inside their own single-tx
///   `entry` resolvers. See sui docs: on-chain randomness + security best
///   practices.
///
/// HOUSE EDGE:
///   The edge is a property of each game's payout table, NOT of this module.
///   This module only guarantees: the house can never pay out more than it
///   holds, and a single bet can never exceed the configured max-bet cap.
module cradleos_casino::house {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::dynamic_field as df;
    use sui::vec_set::{Self, VecSet};

    // ── Errors ─────────────────────────────────────────────────────────────
    const ENotAdmin:          u64 = 0;
    const EZeroAmount:        u64 = 1;
    const EBetTooLarge:       u64 = 2;
    const EBetBelowMin:       u64 = 3;
    const EHouseInsufficient: u64 = 4;
    const EGamePaused:        u64 = 5;
    /// Sender is on the House ban list — barred from placing any wager (v24).
    const EBanned:            u64 = 6;

    /// Dynamic-field key for the lazily-created VecSet<address> ban list (v24).
    /// Stored as a dynamic field (NOT a struct field) so this is upgrade-safe —
    /// Sui forbids adding fields to existing structs.
    public struct BanKey has copy, drop, store {}

    // ── Capability ───────────────────────────────────────────────────────────
    /// Held by the casino operator (CradleOS treasury controller).
    /// Authorizes bankroll top-up/withdraw and risk-parameter changes.
    public struct HouseAdminCap has key, store {
        id: UID,
        house_id: ID,
    }

    // ── House (shared bankroll) ──────────────────────────────────────────────
    public struct House<phantom T> has key {
        id: UID,
        /// Bankroll available to pay winners.
        bank: Balance<T>,
        /// Maximum single wager, in T's smallest unit. Caps single-bet variance.
        max_bet: u64,
        /// Minimum single wager. Prevents dust-spam griefing.
        min_bet: u64,
        /// Global kill switch — when true, all games reject new bets.
        paused: bool,
        /// Lifetime accounting (informational; emitted for transparency).
        total_wagered: u64,
        total_paid_out: u64,
        bets_settled: u64,
    }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct HouseCreated has copy, drop {
        house_id: ID,
        admin: address,
        max_bet: u64,
        min_bet: u64,
    }

    public struct BankrollChanged has copy, drop {
        house_id: ID,
        delta: u64,
        deposit: bool, // true = deposit, false = withdraw
        new_balance: u64,
    }

    public struct RiskParamsChanged has copy, drop {
        house_id: ID,
        max_bet: u64,
        min_bet: u64,
        paused: bool,
    }

    // ── Creation ─────────────────────────────────────────────────────────────
    /// Create a new House bankroll seeded with `seed` coins. Caller receives the
    /// admin cap. Shares the House so any player can play against it.
    public fun create<T>(
        seed: Coin<T>,
        max_bet: u64,
        min_bet: u64,
        ctx: &mut TxContext,
    ): HouseAdminCap {
        let house = House<T> {
            id: object::new(ctx),
            bank: coin::into_balance(seed),
            max_bet,
            min_bet,
            paused: false,
            total_wagered: 0,
            total_paid_out: 0,
            bets_settled: 0,
        };
        let house_id = object::id(&house);
        let cap = HouseAdminCap { id: object::new(ctx), house_id };
        event::emit(HouseCreated {
            house_id,
            admin: tx_context::sender(ctx),
            max_bet,
            min_bet,
        });
        transfer::share_object(house);
        cap
    }

    /// Convenience entry: create + transfer the admin cap to the sender.
    public fun create_and_share<T>(
        seed: Coin<T>,
        max_bet: u64,
        min_bet: u64,
        ctx: &mut TxContext,
    ) {
        let cap = create<T>(seed, max_bet, min_bet, ctx);
        transfer::public_transfer(cap, tx_context::sender(ctx));
    }

    // ── Admin: bankroll management ───────────────────────────────────────────
    public fun deposit<T>(
        house: &mut House<T>,
        cap: &HouseAdminCap,
        funds: Coin<T>,
    ) {
        assert_admin(house, cap);
        let amount = coin::value(&funds);
        assert!(amount > 0, EZeroAmount);
        balance::join(&mut house.bank, coin::into_balance(funds));
        event::emit(BankrollChanged {
            house_id: object::id(house),
            delta: amount,
            deposit: true,
            new_balance: balance::value(&house.bank),
        });
    }

    public fun withdraw<T>(
        house: &mut House<T>,
        cap: &HouseAdminCap,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert_admin(house, cap);
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&house.bank) >= amount, EHouseInsufficient);
        let out = coin::from_balance(balance::split(&mut house.bank, amount), ctx);
        event::emit(BankrollChanged {
            house_id: object::id(house),
            delta: amount,
            deposit: false,
            new_balance: balance::value(&house.bank),
        });
        transfer::public_transfer(out, tx_context::sender(ctx));
    }

    public fun set_risk_params<T>(
        house: &mut House<T>,
        cap: &HouseAdminCap,
        max_bet: u64,
        min_bet: u64,
        paused: bool,
    ) {
        assert_admin(house, cap);
        house.max_bet = max_bet;
        house.min_bet = min_bet;
        house.paused = paused;
        event::emit(RiskParamsChanged {
            house_id: object::id(house),
            max_bet,
            min_bet,
            paused,
        });
    }

    // ── Ban list admin (v24) ───────────────────────────────────────────────
    public struct AddressBanned has copy, drop { house_id: ID, who: address, banned: bool }

    /// Ban a wallet address from placing any wager against this House. Idempotent.
    public fun set_banned<T>(house: &mut House<T>, cap: &HouseAdminCap, who: address, ctx: &mut TxContext) {
        assert_admin(house, cap);
        if (!df::exists_(&house.id, BanKey {})) {
            df::add(&mut house.id, BanKey {}, vec_set::empty<address>());
        };
        let set: &mut VecSet<address> = df::borrow_mut(&mut house.id, BanKey {});
        if (!vec_set::contains(set, &who)) { vec_set::insert(set, who); };
        let _ = ctx;
        event::emit(AddressBanned { house_id: object::id(house), who, banned: true });
    }

    /// Lift a ban on an address. Idempotent.
    public fun unban<T>(house: &mut House<T>, cap: &HouseAdminCap, who: address, ctx: &mut TxContext) {
        assert_admin(house, cap);
        if (df::exists_(&house.id, BanKey {})) {
            let set: &mut VecSet<address> = df::borrow_mut(&mut house.id, BanKey {});
            if (vec_set::contains(set, &who)) { vec_set::remove(set, &who); };
        };
        let _ = ctx;
        event::emit(AddressBanned { house_id: object::id(house), who, banned: false });
    }

    /// True if `who` is on this House's ban list.
    public fun is_banned<T>(house: &House<T>, who: address): bool {
        if (!df::exists_(&house.id, BanKey {})) { return false };
        let set: &VecSet<address> = df::borrow(&house.id, BanKey {});
        vec_set::contains(set, &who)
    }

    /// Abort if the tx sender is banned. Called by every take_wager* path.
    fun assert_not_banned<T>(house: &House<T>, ctx: &TxContext) {
        assert!(!is_banned(house, tx_context::sender(ctx)), EBanned);
    }

    // ── Package-private betting primitives (called by game modules) ───────────
    //
    // A game module resolves an entire bet inside ONE `entry` function that also
    // consumes `&Random`. Within that function it:
    //   1. calls `take_wager` to move the player's stake into the bank,
    //   2. draws randomness + computes the payout,
    //   3. calls `pay_winnings` for the gross payout (stake already in bank).
    //
    // Because these are `public(package)`, only sibling casino game modules can
    // call them — never an external composing contract.

    /// Validate the wager against risk params, absorb it into the bank, and
    /// return the validated wager amount. Aborts if the house is paused, the bet
    /// is out of [min,max], or the bank could not cover a max theoretical payout
    /// is the game's responsibility — this only guards the stake side.
    public(package) fun take_wager<T>(
        house: &mut House<T>,
        wager: Coin<T>,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(&wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= house.max_bet, EBetTooLarge);
        balance::join(&mut house.bank, coin::into_balance(wager));
        house.total_wagered = house.total_wagered + amount;
        amount
    }

    /// Validate a wager against risk params WITHOUT absorbing it into the bank.
    /// Used by commit-reveal games (blackjack_live) that escrow the stake inside
    /// a per-hand object and only deposit it into the bank at settlement.
    /// Returns the validated wager amount. Aborts on paused / out-of-range.
    public(package) fun take_wager_amount<T>(house: &House<T>, wager: &Coin<T>, ctx: &TxContext): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= house.max_bet, EBetTooLarge);
        amount
    }

    /// Multi-bet variant: validates PER-BET amount (amount/count) against limits.
    /// Use for games like plinko play_multi where a single coin covers N independent bets.
    public(package) fun take_wager_amount_multi<T>(house: &House<T>, wager: &Coin<T>, count: u64, ctx: &TxContext): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        assert!(count >= 1, EZeroAmount);
        let amount = coin::value(wager);
        let per_bet = amount / count;
        assert!(per_bet >= house.min_bet, EBetBelowMin);
        assert!(per_bet <= house.max_bet, EBetTooLarge);
        amount
    }

    /// Deposit an escrowed stake Balance into the bank (called at settlement by
    /// commit-reveal games). Advances lifetime wagered accounting.
    public(package) fun deposit_stake<T>(house: &mut House<T>, stake: Balance<T>) {
        let amount = balance::value(&stake);
        house.total_wagered = house.total_wagered + amount;
        balance::join(&mut house.bank, stake);
    }

    /// Pay `amount` from the bank to `recipient`. Called by a game module after
    /// computing a win. `amount` is the GROSS payout (includes returned stake).
    /// Aborts if the bank cannot cover it — this is the hard solvency guarantee.
    public(package) fun pay_winnings<T>(
        house: &mut House<T>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        if (amount == 0) {
            house.bets_settled = house.bets_settled + 1;
            return
        };
        assert!(balance::value(&house.bank) >= amount, EHouseInsufficient);
        let out = coin::from_balance(balance::split(&mut house.bank, amount), ctx);
        house.total_paid_out = house.total_paid_out + amount;
        house.bets_settled = house.bets_settled + 1;
        transfer::public_transfer(out, recipient);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    public fun bank_balance<T>(house: &House<T>): u64 { balance::value(&house.bank) }
    public fun max_bet<T>(house: &House<T>): u64 { house.max_bet }
    public fun min_bet<T>(house: &House<T>): u64 { house.min_bet }
    public fun is_paused<T>(house: &House<T>): bool { house.paused }
    public fun total_wagered<T>(house: &House<T>): u64 { house.total_wagered }
    public fun total_paid_out<T>(house: &House<T>): u64 { house.total_paid_out }
    public fun bets_settled<T>(house: &House<T>): u64 { house.bets_settled }
    public fun cap_house_id(cap: &HouseAdminCap): ID { cap.house_id }

    // ── Internal ─────────────────────────────────────────────────────────────
    fun assert_admin<T>(house: &House<T>, cap: &HouseAdminCap) {
        assert!(cap.house_id == object::id(house), ENotAdmin);
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only]
    use sui::test_scenario;
    #[test_only]
    use sui::sui::SUI;

    /// v24: a banned sender is rejected by take_wager; unban restores access;
    /// is_banned reflects state. Uses the SAME sender for admin+player for
    /// simplicity (ban check is on tx sender at wager time).
    #[test]
    #[expected_failure(abort_code = EBanned)]
    fun test_banned_sender_rejected() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            set_banned(&mut house, &cap, admin, ctx);
            assert!(is_banned(&house, admin), 0);
            // banned sender tries to wager -> aborts EBanned
            let bet = coin::mint_for_testing<SUI>(10, ctx);
            let _ = take_wager(&mut house, bet, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_unban_restores_access() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            set_banned(&mut house, &cap, admin, ctx);
            assert!(is_banned(&house, admin), 0);
            unban(&mut house, &cap, admin, ctx);
            assert!(!is_banned(&house, admin), 1);
            // now wager succeeds (not banned, within cap)
            let bet = coin::mint_for_testing<SUI>(10, ctx);
            let amt = take_wager(&mut house, bet, ctx);
            assert!(amt == 10, 2);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_create_and_deposit_withdraw() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            assert!(bank_balance(&house) == 1_000, 0);
            let ctx = test_scenario::ctx(&mut sc);
            let more = coin::mint_for_testing<SUI>(500, ctx);
            deposit(&mut house, &cap, more);
            assert!(bank_balance(&house) == 1_500, 1);
            withdraw(&mut house, &cap, 300, ctx);
            assert!(bank_balance(&house) == 1_200, 2);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = EBetTooLarge)]
    fun test_wager_cap_enforced() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let oversized = coin::mint_for_testing<SUI>(200, ctx); // > max_bet 100
            let _ = take_wager(&mut house, oversized, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }
}
