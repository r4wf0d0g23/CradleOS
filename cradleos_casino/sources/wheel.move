/// CradleOS Casino — Wheel of Fortune. Twenty segments, spin once.
///
/// Segments (gross multiplier bps): twelve 0x, five 1.2x, two 1.6x, one 10x.
/// MEASURED expected return = (12·0 + 5·12000 + 2·16000 + 1·100000) / 20
///                          = 192,000 / 20 = 9600 bps → 96% return, 4% edge.
/// Max payout 10x.
module cradleos_casino::wheel {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EMaxExposure: u64 = 1;

    /// Segment multipliers in bps (10000 = 1x). 20 segments.
    const SEGMENTS: vector<u64> = vector[
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        12000, 12000, 12000, 12000, 12000,
        16000, 16000,
        100000,
    ];
    const MAX_MULT_X: u64 = 10;

    public struct WheelSpun has copy, drop {
        player: address,
        wager: u64,
        segment: u8,
        multiplier_bps: u64,
        payout: u64,
    }

    /// Multiplier for a segment index. Pure.
    public fun segment_multiplier(segment: u8): u64 {
        *vector::borrow(&SEGMENTS, (segment as u64))
    }

    /// Gross payout for a landed segment. Pure.
    public fun payout_for(amount: u64, segment: u8): u64 {
        let bps = segment_multiplier(segment);
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let segment = random::generate_u8_in_range(&mut g, 0, 19);
        let multiplier_bps = segment_multiplier(segment);
        let payout = payout_for(amount, segment);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(WheelSpun { player, wager: amount, segment, multiplier_bps, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // 20 segments, expected return exactly 9600 bps
        assert!(vector::length(&SEGMENTS) == 20, 0);
        let mut sum = 0u64;
        let mut i = 0u64;
        while (i < 20) { sum = sum + *vector::borrow(&SEGMENTS, i); i = i + 1; };
        assert!(sum / 20 == 9600, 1);
        // payouts
        assert!(payout_for(100, 0) == 0, 2);
        assert!(payout_for(100, 12) == 120, 3);   // 1.2x
        assert!(payout_for(100, 17) == 160, 4);   // 1.6x
        assert!(payout_for(100, 19) == 1000, 5);  // 10x
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
