/// CradleOS Casino — Money Wheel (Big Six-style). 54-segment wheel, spin once.
///
/// A denser wheel than the Fortune Wheel — 54 segments across five payout tiers.
/// The visual spectacle is the differentiator: the rare 18x jackpot segment glows
/// on every spin even when it doesn't land, creating jackpot anticipation.
///
/// MEASURED edge (derived, verified):
///   Segment distribution:
///     24 × 0 bps     (44.4% bust)
///     18 × 11000 bps (33.3%, 1.1x)
///      8 × 12000 bps (14.8%, 1.2x)
///      3 × 16000 bps ( 5.6%, 1.6x)
///      1 × 180000 bps ( 1.9%, 18x)   ← jackpot
///   Total segments = 54; sum of bps = 522000
///   avg = 522000 / 54 ≈ 9666.7 bps → 3.33% house edge
///   Max payout 18x.
///
/// Psychology hooks:
///   · Rare jackpot segment visible on the wheel every spin (near-miss driver).
///   · Long deceleration on a 54-segment disc (anticipation window).
///   · "Big Six" cultural recognition — instantly familiar to casino players.
module cradleos_casino::money_wheel {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EMaxExposure: u64 = 1;

    /// 54-segment wheel. Tiers:
    ///   [0..23]  = 0 bps  (24 bust segments)
    ///   [24..41] = 11000 bps (18 segments, 1.1x)
    ///   [42..49] = 12000 bps ( 8 segments, 1.2x)
    ///   [50..52] = 16000 bps ( 3 segments, 1.6x)
    ///   [53]     = 180000 bps (1 segment, 18x jackpot)
    const SEGMENTS: vector<u64> = vector[
        // 24 × bust
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        // 18 × 1.1x
        11000, 11000, 11000, 11000, 11000, 11000, 11000, 11000, 11000,
        11000, 11000, 11000, 11000, 11000, 11000, 11000, 11000, 11000,
        // 8 × 1.2x
        12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000,
        // 3 × 1.6x
        16000, 16000, 16000,
        // 1 × 18x jackpot
        180000,
    ];
    const MAX_MULT_X: u64 = 18;

    public struct MoneyWheelSpun has copy, drop {
        player:         address,
        wager:          u64,
        segment:        u8,    // 0..53
        multiplier_bps: u64,
        payout:         u64,
    }

    /// Multiplier bps for a landed segment. Pure.
    public fun segment_multiplier(segment: u8): u64 {
        *vector::borrow(&SEGMENTS, (segment as u64))
    }

    /// Gross payout for a landed segment. Pure.
    public fun payout_for(amount: u64, segment: u8): u64 {
        let bps = segment_multiplier(segment);
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    entry fun play<T>(
        house:  &mut House<T>,
        r:      &Random,
        wager:  Coin<T>,
        ctx:    &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let segment = random::generate_u8_in_range(&mut g, 0, 53);
        let multiplier_bps = segment_multiplier(segment);
        let payout = payout_for(amount, segment);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(MoneyWheelSpun { player, wager: amount, segment, multiplier_bps, payout });
    }

    // ── Tests ─────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_segment_count_and_edge() {
        assert!(vector::length(&SEGMENTS) == 54, 0);
        // sum must equal 522000 (avg 9666.7 bps ≈ 3.33% edge)
        let mut sum = 0u64;
        let mut i = 0u64;
        while (i < 54) { sum = sum + *vector::borrow(&SEGMENTS, i); i = i + 1; };
        assert!(sum == 522000, 1);
        // spot-check tiers
        assert!(segment_multiplier(0)  == 0,      2); // bust
        assert!(segment_multiplier(23) == 0,      3); // last bust
        assert!(segment_multiplier(24) == 11000,  4); // first 1.1x
        assert!(segment_multiplier(41) == 11000,  5); // last 1.1x
        assert!(segment_multiplier(42) == 12000,  6); // first 1.2x
        assert!(segment_multiplier(49) == 12000,  7); // last 1.2x
        assert!(segment_multiplier(50) == 16000,  8); // first 1.6x
        assert!(segment_multiplier(52) == 16000,  9); // last 1.6x
        assert!(segment_multiplier(53) == 180000, 10); // jackpot 18x
    }

    #[test]
    fun test_payout_math() {
        let amt = 100_000_000u64; // 0.1 EVE in MIST
        // 1.1x of 100M = 110M; 1.2x = 120M; 1.6x = 160M; 18x = 1800M
        assert!(payout_for(amt, 0)  == 0,             0); // bust → 0
        assert!(payout_for(amt, 24) == 110_000_000,   1); // 1.1x
        assert!(payout_for(amt, 42) == 120_000_000,   2); // 1.2x
        assert!(payout_for(amt, 50) == 160_000_000,   3); // 1.6x
        assert!(payout_for(amt, 53) == 1_800_000_000, 4); // 18x jackpot
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
            let seed = coin::mint_for_testing<SUI>(5_000_000, ctx);
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
