/// CradleOS Casino — Double Dice. Roll two d6; bet on the outcome.
///
/// BET KINDS (kind → target semantics):
///   0 UNDER7   — sum 2..6.  Pays 2.30x  (p 15/36, edge 4.17%)
///   1 OVER7    — sum 8..12. Pays 2.30x  (p 15/36, edge 4.17%)
///   2 SEVEN    — sum == 7.  Pays 5.50x  (p 6/36,  edge 8.33%)
///   3 ANY_DBL  — both dice equal. Pays 5.50x (p 6/36, edge 8.33%)
///   4 EXACT    — target = exact sum 2..12. Pays (36/count)*0.95 rounded, edge 5%.
///
/// Payouts are GROSS (include returned stake on a win). Provably fair: both
/// dice drawn from one Sui-beacon tx, published in the event.
module cradleos_casino::double_dice {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    const KIND_UNDER7:  u8 = 0;
    const KIND_OVER7:   u8 = 1;
    const KIND_SEVEN:   u8 = 2;
    const KIND_ANY_DBL: u8 = 3;
    const KIND_EXACT:   u8 = 4;

    /// Max multiplier (x) for the exposure guard: exact 2 or 12 = 34.2x.
    const MAX_MULT_X: u64 = 35;

    public struct DoubleDiceRolled has copy, drop {
        player: address,
        wager: u64,
        kind: u8,
        target: u8,     // meaningful for EXACT (sum 2..12); 0 otherwise
        d1: u8,
        d2: u8,
        payout: u64,
    }

    /// Gross payout (bps) multiplier for an EXACT sum bet. Pure.
    /// (36/count)*0.95 → bps. counts: 2/12=1, 3/11=2, 4/10=3, 5/9=4, 6/8=5, 7=6.
    public fun exact_multiplier_bps(target: u8): u64 {
        let count = exact_count(target);
        if (count == 0) { return 0 };
        // (36 / count) * 0.95 in bps = 36 * 9500 / count
        ((36u128 * 9500 / (count as u128)) as u64)
    }

    /// Number of (d1,d2) combos that sum to `target` (2..12). Pure.
    public fun exact_count(target: u8): u64 {
        if (target < 2 || target > 12) { return 0 };
        let t = (target as u64);
        if (t <= 7) { t - 1 } else { 13 - t }
    }

    /// Gross payout for a resolved Double Dice bet. Pure.
    public fun payout_for(amount: u64, kind: u8, target: u8, d1: u8, d2: u8): u64 {
        let sum = (d1 as u64) + (d2 as u64);
        if (kind == KIND_UNDER7) {
            if (sum >= 2 && sum <= 6) { ((amount as u128) * 23000 / 10000) as u64 } else { 0 }
        } else if (kind == KIND_OVER7) {
            if (sum >= 8 && sum <= 12) { ((amount as u128) * 23000 / 10000) as u64 } else { 0 }
        } else if (kind == KIND_SEVEN) {
            if (sum == 7) { ((amount as u128) * 55000 / 10000) as u64 } else { 0 }
        } else if (kind == KIND_ANY_DBL) {
            if (d1 == d2) { ((amount as u128) * 55000 / 10000) as u64 } else { 0 }
        } else if (kind == KIND_EXACT) {
            if (sum == (target as u64)) {
                let bps = exact_multiplier_bps(target);
                ((amount as u128) * (bps as u128) / 10000) as u64
            } else { 0 }
        } else { 0 }
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        kind: u8,
        target: u8,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(kind <= KIND_EXACT, EBadParams);
        if (kind == KIND_EXACT) { assert!(target >= 2 && target <= 12, EBadParams); };
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let d1 = random::generate_u8_in_range(&mut g, 1, 6);
        let d2 = random::generate_u8_in_range(&mut g, 1, 6);
        let payout = payout_for(amount, kind, target, d1, d2);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(DoubleDiceRolled { player, wager: amount, kind, target, d1, d2, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // UNDER7 wins on sum 2..6
        assert!(payout_for(100, KIND_UNDER7, 0, 2, 3) == 230, 0);  // sum 5 → 2.30x
        assert!(payout_for(100, KIND_UNDER7, 0, 4, 4) == 0, 1);    // sum 8 → loss
        // OVER7
        assert!(payout_for(100, KIND_OVER7, 0, 5, 5) == 230, 2);   // sum 10 → 2.30x
        assert!(payout_for(100, KIND_OVER7, 0, 3, 3) == 0, 3);     // sum 6 → loss
        // SEVEN
        assert!(payout_for(100, KIND_SEVEN, 0, 3, 4) == 550, 4);   // 5.5x
        assert!(payout_for(100, KIND_SEVEN, 0, 3, 3) == 0, 5);
        // ANY_DBL
        assert!(payout_for(100, KIND_ANY_DBL, 0, 5, 5) == 550, 6);
        assert!(payout_for(100, KIND_ANY_DBL, 0, 5, 4) == 0, 7);
        // EXACT counts + multipliers
        assert!(exact_count(2) == 1, 8);
        assert!(exact_count(7) == 6, 9);
        assert!(exact_count(12) == 1, 10);
        assert!(exact_multiplier_bps(2) == 342000, 11);   // 36*9500/1 = 342000 bps = 34.2x
        assert!(exact_multiplier_bps(7) == 57000, 12);    // 36*9500/6 = 57000 bps = 5.7x
        assert!(payout_for(100, KIND_EXACT, 7, 3, 4) == 570, 13);  // sum 7 → 5.7x
        assert!(payout_for(100, KIND_EXACT, 7, 1, 1) == 0, 14);
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
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, KIND_UNDER7, 0, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
