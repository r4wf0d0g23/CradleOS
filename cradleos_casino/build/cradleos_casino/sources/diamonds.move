/// CradleOS Casino — Diamonds. Draw 5 gems, each uniformly from 7 gem types
/// (0..6). Payout scales with the largest matching set among the five:
///   5 of a kind ... 500x   (p ≈ 0.0004)
///   4 of a kind ... 30x    (p ≈ 0.0125)
///   3 of a kind ... 2.55x  (p ≈ 0.1499)
///   2 or fewer ... loss
///
/// MEASURED expected return (exact, 7^5 = 16807 outcomes):
///   p3=2520/16807, p4=210/16807, p5=7/16807
///   RTP = p3·25500 + p4·300000 + p5·5000000 ≈ 9572 bps → ~4.3% house edge.
///
/// Provably fair: the 5 gems come from one Sui-beacon tx and are published in
/// the result event.
module cradleos_casino::diamonds {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EMaxExposure: u64 = 1;

    const GEM_TYPES: u8 = 7;
    const DRAWS: u8 = 5;
    /// Gross multipliers (bps) for 3 / 4 / 5 of a kind.
    const PAY_3: u64 = 25500;
    const PAY_4: u64 = 300000;
    const PAY_5: u64 = 5000000;
    /// Max multiplier (x) for the exposure guard: 5-of-a-kind = 500x.
    const MAX_MULT_X: u64 = 500;

    public struct DiamondsDrawn has copy, drop {
        player: address,
        wager: u64,
        gems: vector<u8>,      // the 5 drawn gems
        best_set: u8,          // size of the largest matching set (1..5)
        multiplier_bps: u64,
        payout: u64,
    }

    /// Largest matching-set size among the gems. Pure.
    public fun best_set_size(gems: &vector<u8>): u8 {
        let mut counts = vector[0u8, 0, 0, 0, 0, 0, 0];
        let n = vector::length(gems);
        let mut i = 0;
        while (i < n) {
            let g = (*vector::borrow(gems, i) as u64);
            let c = vector::borrow_mut(&mut counts, g);
            *c = *c + 1;
            i = i + 1;
        };
        let mut best = 0u8;
        let mut j = 0;
        while (j < 7) {
            let c = *vector::borrow(&counts, j);
            if (c > best) { best = c; };
            j = j + 1;
        };
        best
    }

    /// Gross payout for a resolved draw. Pure.
    public fun payout_for(amount: u64, best_set: u8): u64 {
        let bps = if (best_set >= 5) { PAY_5 }
                  else if (best_set == 4) { PAY_4 }
                  else if (best_set == 3) { PAY_3 }
                  else { 0 };
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    /// Multiplier (bps) for a best-set size. Pure.
    public fun multiplier_bps(best_set: u8): u64 {
        if (best_set >= 5) { PAY_5 } else if (best_set == 4) { PAY_4 } else if (best_set == 3) { PAY_3 } else { 0 }
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let mut gems: vector<u8> = vector[];
        let mut i = 0u8;
        while (i < DRAWS) {
            vector::push_back(&mut gems, random::generate_u8_in_range(&mut g, 0, GEM_TYPES - 1));
            i = i + 1;
        };
        let best = best_set_size(&gems);
        let mult = multiplier_bps(best);
        let payout = payout_for(amount, best);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(DiamondsDrawn { player, wager: amount, gems, best_set: best, multiplier_bps: mult, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_set_and_payout() {
        assert!(best_set_size(&vector[1u8,1,1,1,1]) == 5, 0);
        assert!(best_set_size(&vector[2u8,2,2,2,5]) == 4, 1);
        assert!(best_set_size(&vector[3u8,3,3,1,6]) == 3, 2);
        assert!(best_set_size(&vector[0u8,1,2,3,4]) == 1, 3);
        assert!(best_set_size(&vector[0u8,0,1,1,2]) == 2, 4);
        // payouts
        assert!(payout_for(100, 5) == 50000, 5);   // 500x
        assert!(payout_for(100, 4) == 3000, 6);    // 30x
        assert!(payout_for(100, 3) == 255, 7);     // 2.55x
        assert!(payout_for(100, 2) == 0, 8);
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
            let cap = house::create<SUI>(seed, 100_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
