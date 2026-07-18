/// CradleOS Casino — Scratch Plex (#74, Category E: Grid / Reveal)
///
/// EVE-themed 3×3 scratch card. Nine ore-type tiles are revealed one-by-one
/// in the UI. The winning outcome tier is determined by the Sui randomness
/// beacon; the grid layout is generated to display that result consistently.
///
/// ── SYMBOLS ─────────────────────────────────────────────────────────────────
///   0 = VELDSPAR   1 = SCORDITE   2 = PYROXERES
///   3 = ARKONOR    4 = BISTOT     5 = ZYDRINE
///
/// ── OUTCOME TIERS (outcome_val = (hi*256+lo) % 10 000) ──────────────────────
///   0   –  6 999  (70.00%)  LOSS          →         0 bps
///   7 000 –  8 999  (20.00%)  WIN 1.5×      →    15 000 bps
///   9 000 –  9 699   (7.00%)  WIN 3×        →    30 000 bps
///   9 700 –  9 949   (2.50%)  WIN 8×        →    80 000 bps
///   9 950 –  9 979   (0.30%)  WIN 20×       →   200 000 bps
///   9 980 –  9 999   (0.20%)  WIN 100×      → 1 000 000 bps
///
/// ── HOUSE EDGE ───────────────────────────────────────────────────────────────
///   RTP = 0.20×1.5 + 0.07×3 + 0.025×8 + 0.003×20 + 0.002×100
///       = 0.300 + 0.210 + 0.200 + 0.060 + 0.200 = 0.970  (97.0%)
///   House edge = 3.0%   Win rate = 30%   Max multiplier = 100×
///
/// ── EXPOSURE GUARD ───────────────────────────────────────────────────────────
///   MAX_MULT_X = 100.  max_bet = bank_balance × 3% ÷ 100 = bank / 3 333.
///   At 90 000 EVE bank → max_bet ≈ 27 EVE.
///   Top up bank before raising bet limits.
///
/// ── GRID LAYOUT ──────────────────────────────────────────────────────────────
///   9-element vector<u8> in row-major order (positions 0–8, row 0 = top).
///   WIN:  exactly 3 tiles bear the winning symbol; 6 bear other ores.
///         Generated from a deterministic template Fisher-Yates-shuffled with
///         random bytes — provably fair and client-verifiable.
///   LOSS: each symbol appears at most 2 times (2+2+2+1+1+1 template shuffled).
///   The grid is cosmetic display data; payout is solely determined by tier.
///
/// ── ABORT CODES ──────────────────────────────────────────────────────────────
///   EMaxExposure (0): wager × MAX_MULT_X > bank_balance × 3%
module cradleos_casino::scratch_cards {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    // ── Error codes ──────────────────────────────────────────────────────────
    const EMaxExposure: u64 = 0;

    // ── Payout tier bps (10 000 = 1.00× gross) ───────────────────────────────
    const TIER_LOSS:  u64 = 0;
    const TIER_1_5X:  u64 = 15_000;     // 1.5× gross
    const TIER_3X:    u64 = 30_000;     // 3× gross
    const TIER_8X:    u64 = 80_000;     // 8× gross
    const TIER_20X:   u64 = 200_000;    // 20× gross
    const TIER_100X:  u64 = 1_000_000;  // 100× gross

    /// Worst-case multiplier for the 3%-of-bank exposure guard.
    const MAX_MULT_X: u64 = 100;

    /// Sentinel: no winning symbol on a loss.
    const NO_SYMBOL: u8 = 255;

    /// Number of distinct ore symbols.
    const NUM_SYMBOLS: u64 = 6;

    // ── Event ────────────────────────────────────────────────────────────────
    public struct ScratchCardPlayed has copy, drop {
        player:         address,
        wager:          u64,
        /// 0 = loss · 1 = 1.5× · 2 = 3× · 3 = 8× · 4 = 20× · 5 = 100×
        outcome_tier:   u8,
        /// Winning ore symbol index (0–5), or 255 on a loss.
        winning_symbol: u8,
        /// 9-element row-major grid of symbol indices (0–5).
        grid:           vector<u8>,
        payout:         u64,
    }

    // ── Pure math ────────────────────────────────────────────────────────────

    /// Gross payout for a given outcome tier. Pure — fully unit-testable.
    /// tier 0 → 0 bps (loss); 1 → 15 000; 2 → 30 000; 3 → 80 000;
    ///      4 → 200 000; 5 → 1 000 000; other → 0.
    public fun payout_for(amount: u64, tier: u8): u64 {
        let bps: u64 =
            if      (tier == 1) { TIER_1_5X  }
            else if (tier == 2) { TIER_3X    }
            else if (tier == 3) { TIER_8X    }
            else if (tier == 4) { TIER_20X   }
            else if (tier == 5) { TIER_100X  }
            else                { TIER_LOSS  };
        ((amount as u128) * (bps as u128) / 10_000) as u64
    }

    /// Map outcome_val (0–9 999) to outcome tier (0–5).
    public fun tier_for_val(val: u64): u8 {
        if      (val < 7_000) { 0 }  // LOSS
        else if (val < 9_000) { 1 }  // 1.5×
        else if (val < 9_700) { 2 }  // 3×
        else if (val < 9_950) { 3 }  // 8×
        else if (val < 9_980) { 4 }  // 20×
        else                  { 5 }  // 100×
    }

    // ── Grid helpers ─────────────────────────────────────────────────────────

    /// Apply an 8-step Fisher-Yates shuffle to `grid` using `sbytes[0..7]`.
    /// sbytes must have length ≥ 8.
    fun fy_shuffle(grid: &mut vector<u8>, sbytes: &vector<u8>) {
        let mut i: u64 = 8;
        while (i > 0) {
            let j = (*sbytes.borrow(i - 1) as u64) % (i + 1);
            grid.swap(i, j);
            i = i - 1;
        };
    }

    /// Build a 9-element WIN grid: exactly 3 tiles show `win_sym`, plus 6 others.
    /// The 6 non-win tiles cycle through the other 5 symbols with one repeat.
    /// Positions are Fisher-Yates-shuffled with sbytes (length ≥ 8).
    fun build_win_grid(win_sym: u8, sbytes: &vector<u8>): vector<u8> {
        let mut grid: vector<u8> = vector::empty();
        // 3 copies of the winning symbol
        grid.push_back(win_sym);
        grid.push_back(win_sym);
        grid.push_back(win_sym);
        // 6 non-win tiles: cycle 0..5 skipping win_sym; repeat first non-win
        let mut s: u8 = 0;
        let mut filled: u64 = 0;
        while (filled < 6) {
            if (s != win_sym) {
                grid.push_back(s);
                filled = filled + 1;
            };
            s = if (s < 5) { s + 1 } else { 0 };
        };
        fy_shuffle(&mut grid, sbytes);
        grid
    }

    /// Build a 9-element LOSS grid with at most 2 tiles of any symbol.
    /// Template [0,0,1,1,2,2,3,4,5] (counts: 2+2+2+1+1+1) is shuffled.
    fun build_loss_grid(sbytes: &vector<u8>): vector<u8> {
        let mut grid: vector<u8> = vector[0, 0, 1, 1, 2, 2, 3, 4, 5];
        fy_shuffle(&mut grid, sbytes);
        grid
    }

    // ── Entry ────────────────────────────────────────────────────────────────

    /// Play one round of Scratch Plex.
    ///
    /// Randomness determines the outcome tier and winning symbol in one tx.
    /// The grid layout is derived from the same random bytes — fully provably fair.
    entry fun play<T>(
        house: &mut House<T>,
        r:     &Random,
        character: &Character,
        wager: Coin<T>,
        ctx:   &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(
            amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100,
            EMaxExposure
        );
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        // 2 bytes → outcome · 1 byte → win sym · 9 bytes → shuffle = 12 total
        let rand_bytes = random::generate_bytes(&mut g, 12);

        // Outcome tier
        let hi  = (*rand_bytes.borrow(0) as u64);
        let lo  = (*rand_bytes.borrow(1) as u64);
        let val = (hi * 256 + lo) % 10_000;
        let tier = tier_for_val(val);

        // Winning ore symbol (chosen regardless of tier; shown on win only)
        let win_sym: u8 = ((*rand_bytes.borrow(2) as u64) % NUM_SYMBOLS) as u8;

        // Shuffle bytes: rand_bytes[3..11]
        let mut sbytes: vector<u8> = vector::empty();
        let mut si = 3u64;
        while (si < 12) {
            sbytes.push_back(*rand_bytes.borrow(si));
            si = si + 1;
        };

        let grid = if (tier == 0) {
            build_loss_grid(&sbytes)
        } else {
            build_win_grid(win_sym, &sbytes)
        };

        let payout = payout_for(amount, tier);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(ScratchCardPlayed {
            player,
            wager: amount,
            outcome_tier: tier,
            winning_symbol: if (tier == 0) { NO_SYMBOL } else { win_sym },
            grid,
            payout,
        });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    // ── payout_for: all tiers ────────────────────────────────────────────────

    #[test] fun test_payout_loss()        { assert!(payout_for(1_000, 0) == 0,         0); }
    #[test] fun test_payout_1_5x()        { assert!(payout_for(1_000, 1) == 1_500,     0); }
    #[test] fun test_payout_3x()          { assert!(payout_for(1_000, 2) == 3_000,     0); }
    #[test] fun test_payout_8x()          { assert!(payout_for(1_000, 3) == 8_000,     0); }
    #[test] fun test_payout_20x()         { assert!(payout_for(1_000, 4) == 20_000,    0); }
    #[test] fun test_payout_100x()        { assert!(payout_for(1_000, 5) == 100_000,   0); }
    #[test] fun test_payout_invalid_tier(){ assert!(payout_for(1_000, 9) == 0,         0); }
    #[test] fun test_payout_zero_wager()  {
        assert!(payout_for(0, 1) == 0, 0);
        assert!(payout_for(0, 5) == 0, 1);
    }
    #[test] fun test_payout_rounding() {
        // 1 × 15_000 / 10_000 = 1 (truncation)
        assert!(payout_for(1, 1) == 1, 0);
        // 3 × 15_000 / 10_000 = 4 (truncation)
        assert!(payout_for(3, 1) == 4, 0);
    }
    #[test] fun test_payout_large_wager() {
        // 1_000_000 × 1_000_000 / 10_000 = 100_000_000
        assert!(payout_for(1_000_000, 5) == 100_000_000, 0);
    }

    // ── tier_for_val: boundary checks ────────────────────────────────────────

    #[test] fun test_tier_boundaries() {
        assert!(tier_for_val(0)    == 0, 0);   // LOSS start
        assert!(tier_for_val(6_999) == 0, 1);  // LOSS end
        assert!(tier_for_val(7_000) == 1, 2);  // 1.5× start
        assert!(tier_for_val(8_999) == 1, 3);  // 1.5× end
        assert!(tier_for_val(9_000) == 2, 4);  // 3× start
        assert!(tier_for_val(9_699) == 2, 5);  // 3× end
        assert!(tier_for_val(9_700) == 3, 6);  // 8× start
        assert!(tier_for_val(9_949) == 3, 7);  // 8× end
        assert!(tier_for_val(9_950) == 4, 8);  // 20× start
        assert!(tier_for_val(9_979) == 4, 9);  // 20× end
        assert!(tier_for_val(9_980) == 5, 10); // 100× start
        assert!(tier_for_val(9_999) == 5, 11); // 100× end
    }

    // ── build_win_grid: winning symbol appears exactly 3 times ───────────────

    #[test]
    fun test_win_grid_has_exactly_3_winning() {
        let sbytes: vector<u8> = vector[0, 1, 2, 3, 4, 5, 6, 7, 0];
        let mut sym: u8 = 0;
        while (sym < 6) {
            let g = build_win_grid(sym, &sbytes);
            assert!(g.length() == 9, (sym as u64) * 100);
            let mut count: u64 = 0;
            let mut i: u64 = 0;
            while (i < 9) {
                if (*g.borrow(i) == sym) { count = count + 1; };
                i = i + 1;
            };
            assert!(count == 3, (sym as u64) * 100 + 1);
            sym = sym + 1;
        };
    }

    // ── build_win_grid: all 9 symbols are in valid range ─────────────────────

    #[test]
    fun test_win_grid_symbols_valid() {
        let sbytes: vector<u8> = vector[9, 8, 7, 6, 5, 4, 3, 2, 1];
        let g = build_win_grid(2, &sbytes);
        let mut i: u64 = 0;
        while (i < 9) {
            assert!(*g.borrow(i) <= 5, i);
            i = i + 1;
        };
    }

    // ── build_loss_grid: max 2 of any symbol, length 9 ───────────────────────

    #[test]
    fun test_loss_grid_max_2_of_any_sym() {
        let sbytes: vector<u8> = vector[5, 3, 7, 11, 2, 255, 0, 8, 1];
        let g = build_loss_grid(&sbytes);
        assert!(g.length() == 9, 0);
        let mut sym: u8 = 0;
        while (sym < 6) {
            let mut count: u64 = 0;
            let mut i: u64 = 0;
            while (i < 9) {
                if (*g.borrow(i) == sym) { count = count + 1; };
                i = i + 1;
            };
            assert!(count <= 2, (sym as u64));
            sym = sym + 1;
        };
    }

    #[test]
    fun test_loss_grid_identity_shuffle() {
        // All-zero shuffle bytes → identity (no swaps with j=0 for each i)
        let sbytes: vector<u8> = vector[0, 0, 0, 0, 0, 0, 0, 0, 0];
        let g = build_loss_grid(&sbytes);
        // With all j=0, the Fisher-Yates swaps grid[i] with grid[0] at each step.
        // The template is [0,0,1,1,2,2,3,4,5]; with all j=0 the shuffle permutes
        // based on the template. Max-2 invariant must still hold.
        let mut sym: u8 = 0;
        while (sym < 6) {
            let mut count: u64 = 0;
            let mut i: u64 = 0;
            while (i < 9) {
                if (*g.borrow(i) == sym) { count = count + 1; };
                i = i + 1;
            };
            assert!(count <= 2, (sym as u64));
            sym = sym + 1;
        };
    }

    // ── Integration: play settles and increments bets_settled ────────────────

    #[test]
    fun test_play_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            // Large bank so any wager × 100 passes the exposure guard
            let seed = coin::mint_for_testing<SUI>(100_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EMaxExposure)]
    fun test_exposure_guard_fires() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            // Tiny bank: 1 000 units. wager × 100 > 1 000 × 3% = 30 → EMaxExposure.
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            // wager=1 → 1 × 100 = 100 > 1000 × 3% = 30 → abort
            let bet = coin::mint_for_testing<SUI>(1, ctx);
            play<SUI>(&mut house, &r, bet, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
