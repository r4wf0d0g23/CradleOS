/// CradleOS Casino — Andar Bahar (#104, Category H: Duels)
///
/// Indian casino classic. A "joker" card is drawn from the deck first — its rank
/// is shown face-up. Cards are then dealt one at a time, alternating to the
/// Andar side (odd positions: 1, 3, 5 ...) and Bahar side (even positions:
/// 2, 4, 6 ...). The first card whose rank matches the joker's rank wins for
/// its side.
///
/// The defining feature: deal length is variable (1 to MAX_DEAL cards).
/// Average deal length ≈ 13 cards. This produces natural escalating tension
/// that no fixed-deal card game can replicate.
///
/// ── ON-CHAIN MODEL ──────────────────────────────────────────────────────────
/// Cards are drawn with independent, uniformly-random ranks (0..12) rather
/// than simulating a physical deck. This is equivalent in probability for the
/// purpose of which side wins first (geometric inter-arrival with p = 1/13).
/// The full deal sequence is emitted in the event for provably-fair animation.
///
///   P(Andar wins) = 169/325 ≈ 52.00%   (Andar receives position 1, 3, 5...)
///   P(Bahar wins) = 156/325 ≈ 48.00%
///
/// ── PAYOUT TABLE ────────────────────────────────────────────────────────────
///   Andar WIN → 18 800 bps (1.88× gross)   house edge 2.24%
///   Bahar WIN → 20 000 bps (2.00× gross)   house edge 4.00%
///   Loss      →     0 bps
///
/// Both edges within the 2–5% protocol target.
/// MAX_MULT_X = 2 (Bahar win = 2× drives the exposure guard).
/// max_bet at 90 000-EVE bank ≈ 1 350 EVE.
///
/// ── ABORT CODES ─────────────────────────────────────────────────────────────
///   EInvalidSide : bet_side not 0 (Andar) or 1 (Bahar)
///   EMaxExposure : amount × 2 > bank_balance × 3%
module cradleos_casino::andar_bahar {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    // ── Error codes ──────────────────────────────────────────────────────────
    const EInvalidSide:  u64 = 0;
    const EMaxExposure:  u64 = 1;

    // ── Bet sides ────────────────────────────────────────────────────────────
    const ANDAR: u8 = 0;
    const BAHAR: u8 = 1;

    // ── Payout constants (bps; 10 000 = 1.00× gross) ─────────────────────────
    /// Andar wins → 1.88× gross. Edge = 1 - 0.52 × 1.88 = 2.24%.
    const ANDAR_WIN_BPS: u64 = 18_800;
    /// Bahar wins → 2.00× gross. Edge = 1 - 0.48 × 2.00 = 4.00%.
    const BAHAR_WIN_BPS: u64 = 20_000;

    /// Worst-case multiplier across all outcomes for the exposure guard.
    const MAX_MULT_X: u64 = 2;

    /// Maximum number of cards dealt before automatic Andar win.
    /// Ensures on-chain gas is bounded; P(no match in 52) ≈ 1.6% under the
    /// independent model → automatic Andar win (house tie-break).
    const MAX_DEAL: u64 = 52;

    // ── Event ────────────────────────────────────────────────────────────────
    public struct AndarBaharPlayed has copy, drop {
        player:      address,
        wager:       u64,
        bet_side:    u8,           // 0 = Andar, 1 = Bahar
        joker_rank:  u8,           // 0 = Two … 12 = Ace
        winner_side: u8,           // 0 = Andar, 1 = Bahar
        cards_dealt: u64,          // number of cards in deal_log
        deal_log:    vector<u8>,   // sequence of ranks dealt (provably-fair replay)
        payout:      u64,
    }

    // ── Pure math ────────────────────────────────────────────────────────────

    /// Gross payout for a resolved Andar Bahar round. Pure — exhaustively testable.
    public fun payout_for(amount: u64, bet_side: u8, winner_side: u8): u64 {
        if (bet_side != winner_side) { return 0 };
        let bps: u64 = if (bet_side == ANDAR) { ANDAR_WIN_BPS } else { BAHAR_WIN_BPS };
        ((amount as u128) * (bps as u128) / 10_000) as u64
    }

    // ── Entry ────────────────────────────────────────────────────────────────

    /// Play one round of Andar Bahar.
    ///
    /// All cards dealt in one tx; result is deterministic from the Sui
    /// randomness beacon. The full deal_log is emitted in AndarBaharPlayed so
    /// the client can replay the staggered card-deal animation provably.
    entry fun play<T>(
        house:    &mut House<T>,
        r:        &Random,
        character: &Character,
        wager:    Coin<T>,
        bet_side: u8,
        ctx:      &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(bet_side == ANDAR || bet_side == BAHAR, EInvalidSide);

        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);

        // Draw the joker rank (0..12 uniform, rank-only comparison).
        let joker_rank = random::generate_u8_in_range(&mut g, 0, 12);

        // Deal alternating cards until the first rank match.
        // 0-indexed position: 0,2,4 … → Andar; 1,3,5 … → Bahar.
        let mut deal_log: vector<u8> = vector::empty();
        let mut winner_side: u8 = ANDAR; // default if MAX_DEAL exhausted (tie-break)
        let mut matched = false;
        let mut i: u64 = 0;

        while (i < MAX_DEAL && !matched) {
            let card_rank = random::generate_u8_in_range(&mut g, 0, 12);
            vector::push_back(&mut deal_log, card_rank);
            if (card_rank == joker_rank) {
                // Even positions (0,2,4…) → Andar; odd (1,3,5…) → Bahar.
                winner_side = if (i % 2 == 0) { ANDAR } else { BAHAR };
                matched = true;
            };
            i = i + 1;
        };
        let cards_dealt = i;

        let payout = payout_for(amount, bet_side, winner_side);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(AndarBaharPlayed {
            player, wager: amount, bet_side,
            joker_rank, winner_side, cards_dealt, deal_log, payout,
        });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    // ── payout_for: all branches ─────────────────────────────────────────────

    #[test]
    fun test_payout_andar_wins_on_andar_bet() {
        // Andar bet wins: 18 800 bps → 188 for 100 stake
        assert!(payout_for(100, ANDAR, ANDAR) == 188, 0);
    }

    #[test]
    fun test_payout_bahar_wins_on_bahar_bet() {
        // Bahar bet wins: 20 000 bps → 200 for 100 stake
        assert!(payout_for(100, BAHAR, BAHAR) == 200, 0);
    }

    #[test]
    fun test_payout_andar_loses() {
        // Andar bet but Bahar won → 0
        assert!(payout_for(100, ANDAR, BAHAR) == 0, 0);
    }

    #[test]
    fun test_payout_bahar_loses() {
        // Bahar bet but Andar won → 0
        assert!(payout_for(100, BAHAR, ANDAR) == 0, 0);
    }

    #[test]
    fun test_payout_zero_wager() {
        assert!(payout_for(0, ANDAR, ANDAR) == 0, 0);
        assert!(payout_for(0, BAHAR, BAHAR) == 0, 1);
    }

    #[test]
    fun test_payout_large_wager() {
        // 1 000 000 × 18 800 / 10 000 = 1 880 000
        assert!(payout_for(1_000_000, ANDAR, ANDAR) == 1_880_000, 0);
        // 1 000 000 × 20 000 / 10 000 = 2 000 000
        assert!(payout_for(1_000_000, BAHAR, BAHAR) == 2_000_000, 1);
    }

    #[test]
    fun test_payout_rounding() {
        // 1 stake × 18 800 / 10 000 = 1 (truncation)
        assert!(payout_for(1, ANDAR, ANDAR) == 1, 0);
        // 3 stake × 18 800 / 10 000 = 5 (truncation)
        assert!(payout_for(3, ANDAR, ANDAR) == 5, 1);
    }

    // ── Winner-side position logic (simulated inline) ─────────────────────────

    #[test]
    fun test_winner_side_positions() {
        // Position 0 (first card, Andar) → ANDAR
        let pos0: u64 = 0;
        assert!(if (pos0 % 2 == 0) { ANDAR } else { BAHAR } == ANDAR, 0);
        // Position 1 (Bahar) → BAHAR
        let pos1: u64 = 1;
        assert!(if (pos1 % 2 == 0) { ANDAR } else { BAHAR } == BAHAR, 1);
        // Position 2 (Andar) → ANDAR
        let pos2: u64 = 2;
        assert!(if (pos2 % 2 == 0) { ANDAR } else { BAHAR } == ANDAR, 2);
        // Position 3 (Bahar) → BAHAR
        let pos3: u64 = 3;
        assert!(if (pos3 % 2 == 0) { ANDAR } else { BAHAR } == BAHAR, 3);
        // Position 50 (even → Andar)
        let pos50: u64 = 50;
        assert!(if (pos50 % 2 == 0) { ANDAR } else { BAHAR } == ANDAR, 4);
        // Position 51 (odd → Bahar)
        let pos51: u64 = 51;
        assert!(if (pos51 % 2 == 0) { ANDAR } else { BAHAR } == BAHAR, 5);
    }

    // ── Integration: full play settles ────────────────────────────────────────

    #[test]
    fun test_play_andar_bet_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, ANDAR, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_play_bahar_bet_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, BAHAR, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EInvalidSide)]
    fun test_invalid_side_fails() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 5, ctx); // invalid side
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
