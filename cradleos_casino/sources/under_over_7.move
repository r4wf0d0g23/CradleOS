/// CradleOS Casino — Under / Over 7 (#21, Category A: Dice & Number)
///
/// Roll two fair d6. Bet whether the sum falls under 7, exactly 7, or over 7.
/// Reuses the double-dice tumble animation. Simplest bet in gambling history —
/// ideal first-bet on-ramp game for new players.
///
/// BET KINDS:
///   0 = UNDER  — sum 2..6.  Pays 2.32× gross.
///   1 = EXACTLY7 — sum == 7. Pays 5.70× gross.
///   2 = OVER   — sum 8..12. Pays 2.32× gross.
///
/// PAYOUT TABLE (gross bps; 10 000 bps = 1.00× stake returned):
///   UNDER wins  (sum 2-6,  P=15/36=41.67%) → 23 200 bps
///   OVER  wins  (sum 8-12, P=15/36=41.67%) → 23 200 bps
///   EXACTLY7    (sum=7,    P= 6/36=16.67%) → 57 000 bps
///   Loss                                   → 0
///
/// MEASURED HOUSE EDGE (derived — verified in edge_sim_batch01.py):
///   UNDER/OVER: EV = 15/36 × 2.32 = 0.9667 → **3.33% edge**
///   EXACTLY7:   EV = 6/36 × 5.70  = 0.9500 → **5.00% edge**
///
/// MAX_MULT_X = 6 (ceil of 5.70×; EXACTLY7 drives the exposure guard).
/// max_bet at 90 000-EVE bank ≈ 450 EVE (UNDER/OVER) or 473 EVE limit.
module cradleos_casino::under_over_7 {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    // ── Error codes ──────────────────────────────────────────────────────────
    const EInvalidKind: u64 = 0;
    const EMaxExposure: u64 = 1;

    // ── Constants ────────────────────────────────────────────────────────────
    const KIND_UNDER:    u8 = 0;
    const KIND_EXACTLY7: u8 = 1;
    const KIND_OVER:     u8 = 2;

    /// UNDER/OVER payout: 2.32× gross → 3.33% edge on P(win) = 15/36.
    const UNDER_OVER_BPS: u64 = 23_200;
    /// EXACTLY7 payout: 5.70× gross → 5.00% edge on P(win) = 6/36.
    const EXACTLY7_BPS: u64 = 57_000;

    /// Worst-case multiplier: EXACTLY7 = 5.70× → ceil = 6.
    const MAX_MULT_X: u64 = 6;

    // ── Event ────────────────────────────────────────────────────────────────
    public struct UnderOver7Rolled has copy, drop {
        player: address,
        wager:  u64,
        kind:   u8,   // 0=UNDER 1=EXACTLY7 2=OVER
        d1:     u8,   // die 1 (1..6)
        d2:     u8,   // die 2 (1..6)
        sum:    u8,   // d1 + d2 (2..12)
        payout: u64,
    }

    // ── Pure math ────────────────────────────────────────────────────────────

    /// Gross payout for a resolved Under/Over 7 bet. Pure — exhaustively testable.
    public fun payout_for(amount: u64, kind: u8, d1: u8, d2: u8): u64 {
        let sum = (d1 as u64) + (d2 as u64);
        if (kind == KIND_UNDER) {
            if (sum >= 2 && sum <= 6) {
                ((amount as u128) * (UNDER_OVER_BPS as u128) / 10_000) as u64
            } else { 0 }
        } else if (kind == KIND_EXACTLY7) {
            if (sum == 7) {
                ((amount as u128) * (EXACTLY7_BPS as u128) / 10_000) as u64
            } else { 0 }
        } else if (kind == KIND_OVER) {
            if (sum >= 8 && sum <= 12) {
                ((amount as u128) * (UNDER_OVER_BPS as u128) / 10_000) as u64
            } else { 0 }
        } else { 0 }
    }

    // ── Entry ────────────────────────────────────────────────────────────────

    /// Play one round of Under/Over 7. Two d6 rolled in one transaction.
    /// Result published in UnderOver7Rolled event for provably-fair verification.
    entry fun play<T>(
        house: &mut House<T>,
        r:     &Random,
        character: &Character,
        wager: Coin<T>,
        kind:  u8,
        ctx:   &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(kind <= KIND_OVER, EInvalidKind);

        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g  = random::new_generator(r, ctx);
        let d1     = random::generate_u8_in_range(&mut g, 1, 6);
        let d2     = random::generate_u8_in_range(&mut g, 1, 6);
        let payout = payout_for(amount, kind, d1, d2);
        house::pay_winnings(house, payout, player, ctx);

        let sum = d1 + d2;
        event::emit(UnderOver7Rolled { player, wager: amount, kind, d1, d2, sum, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // UNDER wins: sum 2..6
        assert!(payout_for(100, KIND_UNDER, 1, 2) == 232, 0);  // sum 3 → 2.32×
        assert!(payout_for(100, KIND_UNDER, 3, 3) == 232, 1);  // sum 6 → 2.32×
        assert!(payout_for(100, KIND_UNDER, 2, 1) == 232, 2);  // sum 3 → 2.32×

        // UNDER loses: sum 7..12
        assert!(payout_for(100, KIND_UNDER, 3, 4) == 0, 3);    // sum 7 → no
        assert!(payout_for(100, KIND_UNDER, 6, 6) == 0, 4);    // sum 12 → no

        // EXACTLY7 wins: sum 7
        assert!(payout_for(100, KIND_EXACTLY7, 3, 4) == 570, 5);  // sum 7 → 5.70×
        assert!(payout_for(100, KIND_EXACTLY7, 1, 6) == 570, 6);  // sum 7 → 5.70×
        assert!(payout_for(100, KIND_EXACTLY7, 6, 1) == 570, 7);  // sum 7 → 5.70×

        // EXACTLY7 loses
        assert!(payout_for(100, KIND_EXACTLY7, 1, 1) == 0, 8);    // sum 2
        assert!(payout_for(100, KIND_EXACTLY7, 6, 6) == 0, 9);    // sum 12

        // OVER wins: sum 8..12
        assert!(payout_for(100, KIND_OVER, 4, 4) == 232, 10);  // sum 8 → 2.32×
        assert!(payout_for(100, KIND_OVER, 6, 6) == 232, 11);  // sum 12 → 2.32×
        assert!(payout_for(100, KIND_OVER, 5, 5) == 232, 12);  // sum 10 → 2.32×

        // OVER loses: sum 2..7
        assert!(payout_for(100, KIND_OVER, 3, 4) == 0, 13);    // sum 7 → no
        assert!(payout_for(100, KIND_OVER, 1, 1) == 0, 14);    // sum 2 → no

        // Boundary: sum = 7 only wins EXACTLY7 (not UNDER, not OVER)
        assert!(payout_for(100, KIND_UNDER, 3, 4) == 0, 15);   // sum 7 → UNDER loses
        assert!(payout_for(100, KIND_OVER,  3, 4) == 0, 16);   // sum 7 → OVER loses

        // Zero wager
        assert!(payout_for(0, KIND_UNDER, 1, 2) == 0, 17);
        assert!(payout_for(0, KIND_EXACTLY7, 3, 4) == 0, 18);
    }

    #[test]
    fun test_play_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, KIND_UNDER, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_play_exactly7_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, KIND_EXACTLY7, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EInvalidKind)]
    fun test_invalid_kind_fails() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(10_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 5, ctx); // invalid kind
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EMaxExposure)]
    fun test_exposure_guard_rejects_oversized_bet() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            // Bank = 10 000, 3% = 300. MAX_MULT_X=6 → max_bet = 300/6 = 50.
            // Bet 51 → exposure guard abort.
            let seed = coin::mint_for_testing<SUI>(10_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(51, ctx); // over limit
            play<SUI>(&mut house, &r, bet, KIND_EXACTLY7, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
