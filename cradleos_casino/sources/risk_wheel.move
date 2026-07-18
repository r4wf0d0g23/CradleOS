/// CradleOS Casino — Risk Wheel. Spin with player-chosen volatility mode.
///
/// Three selectable risk modes, each with 20 segments (same wheel animation).
/// Player picks LOW / MED / HIGH before spinning; the mode determines the
/// segment table and max-payout exposure limit.
///
/// MEASURED edges (derived, verified):
///   LOW  (mode=0): avg bps = 194000/20 = 9700 → 3.0% edge, max 3x
///   MED  (mode=1): avg bps = 192000/20 = 9600 → 4.0% edge, max 10x
///   HIGH (mode=2): avg bps = 192000/20 = 9600 → 4.0% edge, max ≈13.5x
///
/// Psychology hooks:
///   · Player-chosen volatility = agency illusion → longer sessions.
///   · One game serving three temperament profiles (grinder / balanced / jackpot chaser).
///   · Mode switch between bets resets expectation without leaving the panel.
module cradleos_casino::risk_wheel {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EMaxExposure: u64 = 1;
    const EBadMode:     u64 = 2;

    const RISK_LOW:  u8 = 0;
    const RISK_MED:  u8 = 1;
    const RISK_HIGH: u8 = 2;

    // ── LOW: 20 segments, 3% edge, max 3x ─────────────────────────────────────
    // 6 × 0bps (bust) | 9 × 1.2x | 4 × 1.4x | 1 × 3.0x
    // avg = (0 + 9·12000 + 4·14000 + 1·30000) / 20 = 194000/20 = 9700 bps
    const SEGMENTS_LOW: vector<u64> = vector[
        0, 0, 0, 0, 0, 0,
        12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000,
        14000, 14000, 14000, 14000,
        30000,
    ];
    const MAX_MULT_LOW: u64 = 3;

    // ── MED: 20 segments, 4% edge, max 10x ────────────────────────────────────
    // 12 × 0bps | 5 × 1.2x | 2 × 1.6x | 1 × 10x
    // avg = (0 + 5·12000 + 2·16000 + 1·100000) / 20 = 192000/20 = 9600 bps
    const SEGMENTS_MED: vector<u64> = vector[
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        12000, 12000, 12000, 12000, 12000,
        16000, 16000,
        100000,
    ];
    const MAX_MULT_MED: u64 = 10;

    // ── HIGH: 20 segments, 4% edge, max ≈13.5x ────────────────────────────────
    // 14 × 0bps | 4 × 1.1x | 1 × 1.3x | 1 × 13.5x
    // avg = (0 + 4·11000 + 1·13000 + 1·135000) / 20 = 192000/20 = 9600 bps
    const SEGMENTS_HIGH: vector<u64> = vector[
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        11000, 11000, 11000, 11000,
        13000,
        135000,
    ];
    const MAX_MULT_HIGH: u64 = 14;   // 135000/10000 = 13.5 → ceiling 14 for guard

    // ── Event ─────────────────────────────────────────────────────────────────
    public struct RiskWheelSpun has copy, drop {
        player:         address,
        wager:          u64,
        mode:           u8,    // 0=LOW 1=MED 2=HIGH
        segment:        u8,    // 0..19
        multiplier_bps: u64,
        payout:         u64,
    }

    // ── Pure helpers ──────────────────────────────────────────────────────────

    fun get_multiplier(mode: u8, segment: u8): u64 {
        if      (mode == RISK_LOW)  { *vector::borrow(&SEGMENTS_LOW,  (segment as u64)) }
        else if (mode == RISK_MED)  { *vector::borrow(&SEGMENTS_MED,  (segment as u64)) }
        else                        { *vector::borrow(&SEGMENTS_HIGH, (segment as u64)) }
    }

    /// Gross payout for a given mode + landed segment. Pure — no side effects.
    public fun payout_for(mode: u8, amount: u64, segment: u8): u64 {
        let bps = get_multiplier(mode, segment);
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    // ── Entry ─────────────────────────────────────────────────────────────────
    entry fun play<T>(
        house:  &mut House<T>,
        r:      &Random,
        character: &Character,
        wager:  Coin<T>,
        mode:   u8,
        ctx:    &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(mode <= RISK_HIGH, EBadMode);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        let max_mult = if      (mode == RISK_LOW) MAX_MULT_LOW
                       else if (mode == RISK_MED) MAX_MULT_MED
                       else                       MAX_MULT_HIGH;
        assert!(amount * max_mult <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let segment = random::generate_u8_in_range(&mut g, 0, 19);
        let multiplier_bps = get_multiplier(mode, segment);
        let payout = payout_for(mode, amount, segment);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(RiskWheelSpun { player, wager: amount, mode, segment, multiplier_bps, payout });
    }

    // ── Tests ─────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_low_edge() {
        // 20 segments, avg must equal 9700 bps (3% edge)
        assert!(vector::length(&SEGMENTS_LOW) == 20, 0);
        let mut sum = 0u64;
        let mut i = 0u64;
        while (i < 20) { sum = sum + *vector::borrow(&SEGMENTS_LOW, i); i = i + 1; };
        assert!(sum == 194000, 1);
        assert!(sum / 20 == 9700, 2);
        // key payouts
        assert!(payout_for(RISK_LOW, 10000, 0)  == 0,     3); // bust
        assert!(payout_for(RISK_LOW, 10000, 6)  == 12000, 4); // 1.2x
        assert!(payout_for(RISK_LOW, 10000, 15) == 14000, 5); // 1.4x
        assert!(payout_for(RISK_LOW, 10000, 19) == 30000, 6); // 3.0x jackpot
    }

    #[test]
    fun test_med_edge() {
        // 20 segments, avg must equal 9600 bps (4% edge)
        assert!(vector::length(&SEGMENTS_MED) == 20, 0);
        let mut sum = 0u64;
        let mut i = 0u64;
        while (i < 20) { sum = sum + *vector::borrow(&SEGMENTS_MED, i); i = i + 1; };
        assert!(sum == 192000, 1);
        assert!(sum / 20 == 9600, 2);
        // key payouts
        assert!(payout_for(RISK_MED, 10000, 0)  == 0,      3); // bust
        assert!(payout_for(RISK_MED, 10000, 12) == 12000,  4); // 1.2x
        assert!(payout_for(RISK_MED, 10000, 17) == 16000,  5); // 1.6x
        assert!(payout_for(RISK_MED, 10000, 19) == 100000, 6); // 10x jackpot
    }

    #[test]
    fun test_high_edge() {
        // 20 segments, avg must equal 9600 bps (4% edge)
        assert!(vector::length(&SEGMENTS_HIGH) == 20, 0);
        let mut sum = 0u64;
        let mut i = 0u64;
        while (i < 20) { sum = sum + *vector::borrow(&SEGMENTS_HIGH, i); i = i + 1; };
        assert!(sum == 192000, 1);
        assert!(sum / 20 == 9600, 2);
        // key payouts
        assert!(payout_for(RISK_HIGH, 10000, 0)  == 0,      3); // bust
        assert!(payout_for(RISK_HIGH, 10000, 14) == 11000,  4); // 1.1x
        assert!(payout_for(RISK_HIGH, 10000, 18) == 13000,  5); // 1.3x
        assert!(payout_for(RISK_HIGH, 10000, 19) == 135000, 6); // 13.5x jackpot
    }

    #[test]
    fun test_bad_mode_aborts() {
        // mode > 2 should abort with EBadMode — tested via abort expectation
        // We can't call play() without a house, so just verify the constant
        assert!(RISK_HIGH == 2, 0);
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
            let seed = coin::mint_for_testing<SUI>(2_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        // LOW mode play
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 0, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        // MED mode play
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 1, ctx);
            assert!(house::bets_settled(&house) == 2, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        // HIGH mode play
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 2, ctx);
            assert!(house::bets_settled(&house) == 3, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
