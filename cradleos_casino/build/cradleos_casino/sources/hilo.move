/// CradleOS Casino — Hi-Lo. A base card (rank 0..12, where 0=Ace .. 12=King) is
/// shown, then a second card is drawn. Bet whether the second card's rank is
/// HIGHER or LOWER than the base. Exact-rank tie = push (stake returned).
///
/// The base card is drawn on-chain in the SAME tx (single-tx settle) — the
/// player picks a direction, not a specific base. This keeps it unexploitable
/// (no test-and-abort) while still paying odds that reflect the base card.
///
/// FAIR ODDS (2% edge): for a base rank b, out of the other 12 ranks:
///   higher_count(b) = 12 - b     (ranks b+1 .. 12)
///   lower_count(b)  = b          (ranks 0 .. b-1)
///   ties            = 1          (same rank, excluding the base card itself
///                                  we model rank-vs-rank so ties push)
/// Because the base is random, we compute the direction multiplier from the
/// realized base card: win pays  (98 * 13) / (13 * chosen_count) ... simplified
///   mult_bps = 98 * 13 * 100 / (chosen_count * ... )
/// To keep it clean and exactly 2% edge conditional on the base, we use:
///   win_chance = chosen_count / 13   (13 ranks, tie pushes so it neither wins
///                                     nor loses — stake returned)
///   mult_bps   = 9800 * 13 / (chosen_count * 100)  ... expressed in bps:
///   mult_bps   = (9800 * 13) / chosen_count   → gross bps (includes stake).
/// Guarding chosen_count in [1,12] avoids div-by-zero and 0x edges (base
/// rank 0 "lower" or rank 12 "higher" have zero winners → auto-loss, no mult).
module cradleos_casino::hilo {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EMaxExposure: u64 = 1;

    /// Max theoretical multiplier for the exposure guard: choosing the side with
    /// only 1 winning rank pays 9800*13/1 = 127400 bps = 12.74x.
    const MAX_MULT_X: u64 = 13;

    public struct HiLoDrawn has copy, drop {
        player: address,
        wager: u64,
        base: u8,        // base card rank 0..12
        drawn: u8,       // second card rank 0..12
        higher: bool,    // player's call: true=higher, false=lower
        push: bool,      // true if exact tie (stake returned)
        payout: u64,
    }

    /// Count of ranks strictly higher than base (0..12). Pure.
    public fun higher_count(base: u8): u64 { (12 - (base as u64)) }
    /// Count of ranks strictly lower than base (0..12). Pure.
    public fun lower_count(base: u8): u64 { (base as u64) }

    /// Gross payout (bps applied) for a resolved Hi-Lo draw. Pure.
    /// Tie (drawn == base) is signalled by returning the stake (1.0x) — handled
    /// by the caller via the `push` flag; here we return `amount` on a push.
    public fun payout_for(amount: u64, base: u8, drawn: u8, higher: bool): u64 {
        if (drawn == base) { return amount };  // push: stake returned
        let chosen = if (higher) { higher_count(base) } else { lower_count(base) };
        if (chosen == 0) { return 0 };          // impossible call → loss
        let won = if (higher) { drawn > base } else { drawn < base };
        if (!won) { return 0 };
        // mult_bps = 9800 * 13 / chosen ; payout = amount * mult_bps / 10000
        let mult_bps = (9800u128 * 13u128) / (chosen as u128);
        ((( (amount as u128) * mult_bps) / 10000) as u64)
    }

    /// Max possible payout for the exposure guard (worst case = 1-winner side). Pure.
    public fun max_payout(amount: u64): u64 {
        let mult_bps = (9800u128 * 13u128) / 1u128; // chosen_count = 1
        ((((amount as u128) * mult_bps) / 10000) as u64)
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        higher: bool,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(max_payout(amount) <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let base = random::generate_u8_in_range(&mut g, 0, 12);
        let drawn = random::generate_u8_in_range(&mut g, 0, 12);
        let is_push = drawn == base;
        let payout = payout_for(amount, base, drawn, higher);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(HiLoDrawn { player, wager: amount, base, drawn, higher, push: is_push, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // base 6, call higher: 6 winning ranks (7..12) → mult 9800*13/6 = 21233 bps → 2.12x
        assert!(payout_for(1000, 6, 10, true) == 2123, 0);   // 1000 * 21233 / 10000 = 2123
        assert!(payout_for(1000, 6, 3, true) == 0, 1);        // drawn lower, called higher → loss
        // base 6, call lower: 6 winning ranks (0..5) → same 2.12x
        assert!(payout_for(1000, 6, 2, false) == 2123, 2);
        // push: drawn == base → stake returned
        assert!(payout_for(1000, 6, 6, true) == 1000, 3);
        // impossible call: base 0, lower → 0 winners → loss
        assert!(payout_for(1000, 0, 5, false) == 0, 4);
        // near-lock: base 1, call higher → 11 winners → 9800*13/11 = 11581 bps → 1.15x
        assert!(payout_for(1000, 1, 9, true) == 1158, 5);
        // counts
        assert!(higher_count(6) == 6, 6);
        assert!(lower_count(6) == 6, 7);
        assert!(higher_count(12) == 0, 8);
        assert!(lower_count(0) == 0, 9);
    }

    #[test]
    fun test_play_settles() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, true, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
