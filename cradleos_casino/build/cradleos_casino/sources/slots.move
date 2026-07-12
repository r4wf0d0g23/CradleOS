/// CradleOS Casino — Slots. Three reels, one shared 16-stop weighted strip.
/// Symbols 0 (common) … 6 (rare). Weights per strip: 0×4, 1×3, 2×3, 3×2,
/// 4×2, 5×1, 6×1.
///
/// MEASURED expected return (exact, from strip weights):
///   P(triple i) = (w_i/16)^3 → Σ w_i^3 = 4³+3³+3³+2³+2³+1³+1³ = 136 / 4096
///   P(exactly two match) = 3·Σ w_i²(16−w_i) / 4096 = 3·568/4096 = 1704/4096
///   Triples EV  = (64·36000 + 27·50000 + 27·60000 + 8·120000 + 8·180000
///                  + 1·360000 + 1·600000) / 4096 = 8,634,000/4096 ≈ 2108 bps
///   Two-match EV = (1704/4096)·18000 ≈ 7488 bps
///   TOTAL ≈ 9596 bps → 95.96% return, ~4.0% house edge. Max payout 60x.
module cradleos_casino::slots {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EMaxExposure: u64 = 1;

    /// Gross multiplier (bps) for triple of symbol s.
    const TRIPLE_BPS: vector<u64> = vector[36000, 50000, 60000, 120000, 180000, 360000, 600000];
    /// Gross multiplier (bps) for exactly two matching symbols.
    const TWO_MATCH_BPS: u64 = 18000;
    /// Max multiplier (x) for the exposure guard: 600000 bps = 60x.
    const MAX_MULT_X: u64 = 60;

    public struct SlotsSpun has copy, drop {
        player: address,
        wager: u64,
        s1: u8,
        s2: u8,
        s3: u8,
        payout: u64,
    }

    /// The reel strip (same for all three reels).
    public fun strip(): vector<u8> { vector[0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6] }

    /// Gross payout for a spin result. Pure.
    public fun payout_for(amount: u64, s1: u8, s2: u8, s3: u8): u64 {
        if (s1 == s2 && s2 == s3) {
            let bps = *vector::borrow(&TRIPLE_BPS, (s1 as u64));
            (((amount as u128) * (bps as u128) / 10000) as u64)
        } else if (s1 == s2 || s2 == s3 || s1 == s3) {
            (((amount as u128) * (TWO_MATCH_BPS as u128) / 10000) as u64)
        } else { 0 }
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

        let reel = strip();
        let mut g = random::new_generator(r, ctx);
        let s1 = *vector::borrow(&reel, (random::generate_u8_in_range(&mut g, 0, 15) as u64));
        let s2 = *vector::borrow(&reel, (random::generate_u8_in_range(&mut g, 0, 15) as u64));
        let s3 = *vector::borrow(&reel, (random::generate_u8_in_range(&mut g, 0, 15) as u64));
        let payout = payout_for(amount, s1, s2, s3);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(SlotsSpun { player, wager: amount, s1, s2, s3, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // triples
        assert!(payout_for(100, 0, 0, 0) == 360, 0);     // 3.6x
        assert!(payout_for(100, 6, 6, 6) == 6000, 1);    // 60x jackpot
        assert!(payout_for(100, 3, 3, 3) == 1200, 2);    // 12x
        // exactly two matching (any position pair)
        assert!(payout_for(100, 2, 2, 5) == 180, 3);
        assert!(payout_for(100, 5, 2, 2) == 180, 4);
        assert!(payout_for(100, 2, 5, 2) == 180, 5);
        // no match
        assert!(payout_for(100, 0, 1, 2) == 0, 6);
        // strip sanity: 16 stops
        assert!(vector::length(&strip()) == 16, 7);
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
            play<SUI>(&mut house, &r, bet, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
