/// CradleOS Casino — Sic Bo. Three dice rolled on-chain; bet on the outcome.
///
/// BET KINDS (kind → target semantics):
///   0 SMALL     — total 4..10, loses on any triple. Pays 2x  (edge 2.78%)
///   1 BIG       — total 11..17, loses on any triple. Pays 2x (edge 2.78%)
///   2 SINGLE    — target 1..6: pays (1 + count) x where count = # dice showing
///                 the target (1→2x, 2→3x, 3→4x gross). (edge 7.87%)
///   3 SPEC_TRIP — target 1..6: all three dice = target. Pays 180x (edge 16.7%)
///   4 ANY_TRIP  — any triple. Pays 30x (edge 16.7%)
///
/// All payouts are GROSS (include the returned stake on a win). Provably fair:
/// the three dice are drawn from one Sui-beacon tx and published in the event.
module cradleos_casino::sicbo {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    // Bet kinds
    const KIND_SMALL:     u8 = 0;
    const KIND_BIG:       u8 = 1;
    const KIND_SINGLE:    u8 = 2;
    const KIND_SPEC_TRIP: u8 = 3;
    const KIND_ANY_TRIP:  u8 = 4;

    public struct SicBoRolled has copy, drop {
        player: address,
        wager: u64,
        kind: u8,
        target: u8,     // meaningful for SINGLE / SPEC_TRIP; 0 otherwise
        d1: u8,
        d2: u8,
        d3: u8,
        payout: u64,
    }

    public fun is_triple(d1: u8, d2: u8, d3: u8): bool { d1 == d2 && d2 == d3 }

    /// Gross payout for a resolved Sic Bo bet. Pure.
    public fun payout_for(amount: u64, kind: u8, target: u8, d1: u8, d2: u8, d3: u8): u64 {
        let total = (d1 as u64) + (d2 as u64) + (d3 as u64);
        let trip = is_triple(d1, d2, d3);
        if (kind == KIND_SMALL) {
            if (!trip && total >= 4 && total <= 10) { amount * 2 } else { 0 }
        } else if (kind == KIND_BIG) {
            if (!trip && total >= 11 && total <= 17) { amount * 2 } else { 0 }
        } else if (kind == KIND_SINGLE) {
            let mut c = 0u64;
            if (d1 == target) { c = c + 1; };
            if (d2 == target) { c = c + 1; };
            if (d3 == target) { c = c + 1; };
            if (c == 0) { 0 } else { amount * (1 + c) }
        } else if (kind == KIND_SPEC_TRIP) {
            if (trip && d1 == target) { amount * 180 } else { 0 }
        } else if (kind == KIND_ANY_TRIP) {
            if (trip) { amount * 30 } else { 0 }
        } else { 0 }
    }

    /// Max gross multiplier (x) for a bet kind — used for the exposure guard. Pure.
    public fun kind_max_mult(kind: u8): u64 {
        if (kind == KIND_SMALL || kind == KIND_BIG) { 2 }
        else if (kind == KIND_SINGLE) { 4 }
        else if (kind == KIND_SPEC_TRIP) { 180 }
        else if (kind == KIND_ANY_TRIP) { 30 }
        else { 0 }
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
        assert!(kind <= KIND_ANY_TRIP, EBadParams);
        if (kind == KIND_SINGLE || kind == KIND_SPEC_TRIP) {
            assert!(target >= 1 && target <= 6, EBadParams);
        };
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        let mm = kind_max_mult(kind);
        assert!(amount * mm <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let d1 = random::generate_u8_in_range(&mut g, 1, 6);
        let d2 = random::generate_u8_in_range(&mut g, 1, 6);
        let d3 = random::generate_u8_in_range(&mut g, 1, 6);
        let payout = payout_for(amount, kind, target, d1, d2, d3);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(SicBoRolled { player, wager: amount, kind, target, d1, d2, d3, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // SMALL wins on total 4..10 non-triple
        assert!(payout_for(100, KIND_SMALL, 0, 1, 2, 4) == 200, 0);  // total 7 → 2x
        assert!(payout_for(100, KIND_SMALL, 0, 5, 6, 6) == 0, 1);    // total 17 → loss
        assert!(payout_for(100, KIND_SMALL, 0, 2, 2, 2) == 0, 2);    // triple → loss even though total 6
        // BIG
        assert!(payout_for(100, KIND_BIG, 0, 5, 5, 4) == 200, 3);    // total 14 → 2x
        assert!(payout_for(100, KIND_BIG, 0, 6, 6, 6) == 0, 4);      // triple → loss
        // SINGLE on 3: one match=2x, two=3x, three=4x
        assert!(payout_for(100, KIND_SINGLE, 3, 3, 1, 2) == 200, 5);
        assert!(payout_for(100, KIND_SINGLE, 3, 3, 3, 2) == 300, 6);
        assert!(payout_for(100, KIND_SINGLE, 3, 3, 3, 3) == 400, 7);
        assert!(payout_for(100, KIND_SINGLE, 3, 1, 2, 4) == 0, 8);
        // SPEC_TRIP on 5
        assert!(payout_for(100, KIND_SPEC_TRIP, 5, 5, 5, 5) == 18000, 9);   // 180x
        assert!(payout_for(100, KIND_SPEC_TRIP, 5, 5, 5, 4) == 0, 10);
        assert!(payout_for(100, KIND_SPEC_TRIP, 5, 6, 6, 6) == 0, 11);      // wrong triple
        // ANY_TRIP
        assert!(payout_for(100, KIND_ANY_TRIP, 0, 4, 4, 4) == 3000, 12);    // 30x
        assert!(payout_for(100, KIND_ANY_TRIP, 0, 4, 4, 2) == 0, 13);
        // max mult table
        assert!(kind_max_mult(KIND_SPEC_TRIP) == 180, 14);
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
            play<SUI>(&mut house, &r, bet, KIND_SMALL, 0, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
