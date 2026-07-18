/// CradleOS Casino — Keno. Pick 1–6 spots from the 40-number pool (1..40); the
/// house draws 10 distinct numbers on-chain. Payout scales with how many of
/// your spots were hit, per a pick-count-specific paytable.
///
/// MEASURED house edge (hypergeometric, pool 40 / draw 10), per pick count:
///   p=1  ~3.75%   paytable(matches→bps): [_,38500]
///   p=2  ~3.85%   [_,5500,130000]
///   p=3  ~4.05%   [_,_,48000,250000]
///   p=4  ~3.70%   [_,_,23000,92000,470000]
///   p=5  ~3.34%   [_,_,_,72000,295000,2950000]
///   p=6  ~4.03%   [_,_,_,32000,130000,970000,9700000]
///   (index = number of matches; "_" = 0x). Max multiplier 970x (p=6, all 6 hit).
///
/// Provably fair: the 10 drawn numbers come from one Sui-beacon shuffle in a
/// single tx and are published in the result event for verification.
module cradleos_casino::keno {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    const POOL: u8 = 40;       // numbers 1..40
    const DRAW: u8 = 10;       // house draws 10
    const MAX_PICKS: u64 = 6;
    /// Max multiplier (x) for the exposure guard (p=6 all-hit = 970x).
    const MAX_MULT_X: u64 = 970;

    public struct KenoDrawn has copy, drop {
        player: address,
        wager: u64,
        picks: vector<u8>,     // player's chosen spots (1..40)
        drawn: vector<u8>,     // 10 numbers the house drew
        matches: u8,
        multiplier_bps: u64,
        payout: u64,
    }

    /// Paytable (bps) for `matches` given `num_picks`. Pure.
    public fun multiplier_bps(num_picks: u64, matches: u8): u64 {
        let m = (matches as u64);
        if (num_picks == 1) {
            if (m == 1) { 38500 } else { 0 }
        } else if (num_picks == 2) {
            if (m == 1) { 5500 } else if (m == 2) { 130000 } else { 0 }
        } else if (num_picks == 3) {
            if (m == 2) { 48000 } else if (m == 3) { 250000 } else { 0 }
        } else if (num_picks == 4) {
            if (m == 2) { 23000 } else if (m == 3) { 92000 } else if (m == 4) { 470000 } else { 0 }
        } else if (num_picks == 5) {
            if (m == 3) { 72000 } else if (m == 4) { 295000 } else if (m == 5) { 2950000 } else { 0 }
        } else if (num_picks == 6) {
            if (m == 3) { 32000 } else if (m == 4) { 130000 } else if (m == 5) { 970000 } else if (m == 6) { 9700000 } else { 0 }
        } else { 0 }
    }

    /// Gross payout for a resolved Keno round. Pure.
    public fun payout_for(amount: u64, num_picks: u64, matches: u8): u64 {
        let bps = multiplier_bps(num_picks, matches);
        (((amount as u128) * (bps as u128) / 10000) as u64)
    }

    /// Highest multiplier (bps) achievable for `num_picks` (all matched). Pure.
    public fun top_multiplier_bps(num_picks: u64): u64 {
        multiplier_bps(num_picks, (num_picks as u8))
    }

    /// True if `picks` are all in 1..40 and pairwise distinct. Pure.
    public fun valid_picks(picks: &vector<u8>): bool {
        let n = vector::length(picks);
        if (n < 1 || n > MAX_PICKS) { return false };
        let mut i = 0;
        while (i < n) {
            let v = *vector::borrow(picks, i);
            if (v < 1 || v > POOL) { return false };
            let mut j = i + 1;
            while (j < n) {
                if (*vector::borrow(picks, j) == v) { return false };
                j = j + 1;
            };
            i = i + 1;
        };
        true
    }

    /// Count how many of `picks` appear in `drawn`. Pure.
    public fun count_matches(picks: &vector<u8>, drawn: &vector<u8>): u8 {
        let mut hits = 0u8;
        let np = vector::length(picks);
        let nd = vector::length(drawn);
        let mut i = 0;
        while (i < np) {
            let v = *vector::borrow(picks, i);
            let mut j = 0;
            while (j < nd) {
                if (*vector::borrow(drawn, j) == v) { hits = hits + 1; break };
                j = j + 1;
            };
            i = i + 1;
        };
        hits
    }

    /// Draw `DRAW` distinct numbers from 1..POOL via partial Fisher-Yates.
    fun draw_numbers(g: &mut random::RandomGenerator): vector<u8> {
        // Build [1..POOL], shuffle first DRAW positions, take them.
        let mut pool: vector<u8> = vector[];
        let mut n = 1u8;
        while (n <= POOL) { vector::push_back(&mut pool, n); n = n + 1; };
        let len = vector::length(&pool);
        let mut out: vector<u8> = vector[];
        let mut k = 0u8;
        while (k < DRAW) {
            // FIX v14: hi is constant (len-1); lo advances (k).
            // The old code shrank hi each step → bias against high-position elements.
            let hi = len - 1;
            let pick_idx = random::generate_u64_in_range(g, k as u64, hi);
            // swap pool[k] <-> pool[pick_idx], then take pool[k]
            vector::swap(&mut pool, k as u64, pick_idx);
            vector::push_back(&mut out, *vector::borrow(&pool, k as u64));
            k = k + 1;
        };
        out
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        picks: vector<u8>,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(valid_picks(&picks), EBadParams);
        let num_picks = vector::length(&picks);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        // Guard against the top multiplier for this pick count.
        let top_bps = top_multiplier_bps(num_picks);
        let max_pay = (((amount as u128) * (top_bps as u128) / 10000) as u64);
        assert!(max_pay <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100 || max_pay <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let drawn = draw_numbers(&mut g);
        let matches = count_matches(&picks, &drawn);
        let mult = multiplier_bps(num_picks, matches);
        let payout = payout_for(amount, num_picks, matches);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(KenoDrawn {
            player, wager: amount, picks, drawn, matches,
            multiplier_bps: mult, payout,
        });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_paytable() {
        // spot checks
        assert!(multiplier_bps(1, 1) == 38500, 0);
        assert!(multiplier_bps(2, 2) == 130000, 1);
        assert!(multiplier_bps(6, 6) == 9700000, 2);
        assert!(multiplier_bps(6, 2) == 0, 3);   // <3 matches on p=6 pays nothing
        assert!(top_multiplier_bps(6) == 9700000, 4);
        assert!(payout_for(100, 6, 6) == 97000, 5);   // 970x
        assert!(payout_for(100, 3, 3) == 2500, 6);    // 25x
        assert!(payout_for(100, 4, 1) == 0, 7);
    }

    #[test]
    fun test_validation_and_matches() {
        let good = vector[3u8, 17, 40];
        assert!(valid_picks(&good), 0);
        let dup = vector[3u8, 3];
        assert!(!valid_picks(&dup), 1);
        let oob = vector[0u8, 5];
        assert!(!valid_picks(&oob), 2);
        let too_many = vector[1u8,2,3,4,5,6,7];
        assert!(!valid_picks(&too_many), 3);
        // matches
        let picks = vector[5u8, 10, 15];
        let drawn = vector[1u8, 5, 9, 15, 22, 30, 31, 32, 33, 34];
        assert!(count_matches(&picks, &drawn) == 2, 4); // 5 and 15 hit
    }

    // ── v14: verify draw_numbers returns 10 distinct values in 1..40 ──────────
    #[test]
    fun test_draw_distinct_in_range() {
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, @0xAD);
        {
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let mut g = random::new_generator(&r, ctx);
            let drawn = draw_numbers(&mut g);
            // Exactly DRAW numbers returned.
            let n = vector::length(&drawn);
            assert!(n == (DRAW as u64), 0);
            // All in range 1..POOL and pairwise distinct.
            let mut i = 0;
            while (i < n) {
                let vi = *vector::borrow(&drawn, i);
                assert!(vi >= 1 && vi <= POOL, 1);
                let mut j = i + 1;
                while (j < n) {
                    assert!(*vector::borrow(&drawn, j) != vi, 2);
                    j = j + 1;
                };
                i = i + 1;
            };
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
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
            let seed = coin::mint_for_testing<SUI>(100_000_000, ctx);
            let cap = house::create<SUI>(seed, 100_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, vector[3u8, 17, 40], ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
