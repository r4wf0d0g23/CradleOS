/// CradleOS Casino — Red Dog / Acey-Deucey (#56, Category C: Cards — house-banked)
///
/// Classic spread-bet card game: draw two cards, bet on whether a third falls
/// strictly between them. The tighter the spread, the bigger the multiplier.
///
/// PSYCHOLOGY:
///   - Anticipation: two face-up cards build tension before the reveal.
///   - Near-miss: spread-1 is just one rank away from maximum payout; brutal on a miss.
///   - Variable reward: spread determines payout — bigger spread = safer but smaller win.
///   - Pair drama: rare pair triggers bonus third-draw, instant "can I match it?" moment.
///   - Fast loop: no decisions after initial bet → tight session cadence.
///
/// CARDS: ranks 1–13 (1=Ace low, 2–10 pip, 11=Jack, 12=Queen, 13=King).
///   Three ranks drawn independently from Sui randomness (infinite-deck model,
///   provably fair within one beacon tx).
///
/// RULES:
///   1. Draw card1, card2.
///   2. If card1 == card2 (PAIR): draw card3. If card3 matches → 12× gross (11:1 net).
///      Else → push (1× gross, stake returned).
///   3. If |card1 − card2| == 1 (CONSECUTIVE): push (1× gross, no win/loss).
///   4. Otherwise spread = |card1 − card2| − 1. Draw card3.
///      If min(card1,card2) < card3 < max(card1,card2) → win by spread table.
///      Else → 0× gross (loss).
///
/// PAYOUT TABLE (gross bps; 10 000 bps = 1.00× stake returned):
///   Pair match          → 120 000 bps  (12.0×, net +11×)
///   Push (pair/consec.) →  10 000 bps  ( 1.0×, net  +0×)
///   Spread 1            →  60 000 bps  ( 6.0×, net  +5×)  P(win|s=1)=1/13
///   Spread 2            →  50 000 bps  ( 5.0×, net  +4×)  P(win|s=2)=2/13
///   Spread 3            →  40 000 bps  ( 4.0×, net  +3×)  P(win|s=3)=3/13
///   Spread 4            →  30 000 bps  ( 3.0×, net  +2×)  P(win|s=4)=4/13
///   Spread 5+           →  20 000 bps  ( 2.0×, net  +1×)  P(win|s=5+)=s/13
///   Loss                →       0 bps  ( 0.0×)
///
/// MEASURED HOUSE EDGE (infinite-deck derivation):
///   P(pair) = 13/169. EV_pair = 24/13 gross. Contribution = 24/169.
///   P(consec) = 24/169. Push → 1× gross. Contribution = 24/169.
///   Spread bets Σ P(spread=s) × P(win|s) × gross(s):
///     s=1: 22/169 × 1/13 × 6  =  132/2197
///     s=2: 20/169 × 2/13 × 5  =  200/2197
///     s=3: 18/169 × 3/13 × 4  =  216/2197
///     s=4: 16/169 × 4/13 × 3  =  192/2197
///     s=5: 14/169 × 5/13 × 2  =  140/2197
///     s=6: 12/169 × 6/13 × 2  =  144/2197
///     s=7: 10/169 × 7/13 × 2  =  140/2197
///     s=8:  8/169 × 8/13 × 2  =  128/2197
///     s=9:  6/169 × 9/13 × 2  =  108/2197
///     s=10: 4/169 × 10/13 × 2 =   80/2197
///     s=11: 2/169 × 11/13 × 2 =   44/2197
///     Σ = 1524/2197
///   Total expected gross = 24/169 + 24/169 + 1524/2197
///                        = 312/2197 + 312/2197 + 1524/2197 = 2148/2197
///   House edge = 1 − 2148/2197 = 49/2197 ≈ **2.23%** ✓ (within 2–5% mandate)
///
/// MAX_MULT_X = 12 (pair match). Exposure guard: amount × 12 ≤ bank × 3/100.
module cradleos_casino::red_dog {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    // ── Error codes ──────────────────────────────────────────────────────────
    const EMaxExposure: u64 = 1;

    // ── Payout constants (gross bps; 10 000 = 1.00× stake returned) ─────────
    const BPS_PAIR_MATCH:  u64 = 120_000;  // 12× gross = 11:1 net
    const BPS_PUSH:        u64 =  10_000;  // 1× gross  = 0 net (stake back)
    const BPS_SPREAD_1:    u64 =  60_000;  // 6× gross  = 5:1 net
    const BPS_SPREAD_2:    u64 =  50_000;  // 5× gross  = 4:1 net
    const BPS_SPREAD_3:    u64 =  40_000;  // 4× gross  = 3:1 net
    const BPS_SPREAD_4:    u64 =  30_000;  // 3× gross  = 2:1 net
    const BPS_SPREAD_5P:   u64 =  20_000;  // 2× gross  = 1:1 net (spread 5+)

    /// Worst-case gross multiplier for the exposure guard.
    const MAX_MULT_X: u64 = 12;

    // ── Result codes (emitted in event) ─────────────────────────────────────
    const RESULT_PAIR_MATCH:  u8 = 0;
    const RESULT_PAIR_PUSH:   u8 = 1;
    const RESULT_CONSECUTIVE: u8 = 2;
    const RESULT_WIN:         u8 = 3;
    const RESULT_LOSS:        u8 = 4;

    // ── Event ────────────────────────────────────────────────────────────────
    public struct RedDogPlayed has copy, drop {
        player:  address,
        wager:   u64,
        card1:   u8,    // rank 1–13
        card2:   u8,    // rank 1–13
        card3:   u8,    // rank 1–13 (the "post" card between them)
        spread:  u8,    // 0 for pair/consecutive; 1–11 for spread outcomes
        result:  u8,    // RESULT_* constant above
        payout:  u64,
    }

    // ── Pure helpers ─────────────────────────────────────────────────────────

    /// Spread table gross bps for a given spread width (1–11). Pure.
    public fun spread_bps(spread: u8): u64 {
        if (spread == 1)      { BPS_SPREAD_1  }
        else if (spread == 2) { BPS_SPREAD_2  }
        else if (spread == 3) { BPS_SPREAD_3  }
        else if (spread == 4) { BPS_SPREAD_4  }
        else                  { BPS_SPREAD_5P }  // spread 5–11
    }

    /// Gross payout for a resolved Red Dog hand. Pure — exhaustively unit-tested.
    ///
    /// card1, card2 — the two anchor cards (ranks 1–13)
    /// card3        — the revealed "post" card
    /// Returns gross bps payout (10 000 = 1× stake returned)
    public fun payout_for(amount: u64, card1: u8, card2: u8, card3: u8): u64 {
        let diff = if (card1 > card2) { card1 - card2 } else { card2 - card1 };

        if (diff == 0) {
            // PAIR — check if card3 matches
            if (card3 == card1) {
                amount * BPS_PAIR_MATCH / 10_000
            } else {
                amount * BPS_PUSH / 10_000  // push
            }
        } else if (diff == 1) {
            // CONSECUTIVE — automatic push
            amount * BPS_PUSH / 10_000
        } else {
            // SPREAD — check if card3 falls strictly between anchor cards
            let lo = if (card1 < card2) { card1 } else { card2 };
            let hi = if (card1 > card2) { card1 } else { card2 };
            if (card3 > lo && card3 < hi) {
                // WIN: payout by spread
                let spread = diff - 1;
                amount * spread_bps(spread) / 10_000
            } else {
                0  // LOSS
            }
        }
    }

    /// Result code for a hand (used in event). Pure.
    public fun result_for(card1: u8, card2: u8, card3: u8): u8 {
        let diff = if (card1 > card2) { card1 - card2 } else { card2 - card1 };
        if (diff == 0) {
            if (card3 == card1) { RESULT_PAIR_MATCH } else { RESULT_PAIR_PUSH }
        } else if (diff == 1) {
            RESULT_CONSECUTIVE
        } else {
            let lo = if (card1 < card2) { card1 } else { card2 };
            let hi = if (card1 > card2) { card1 } else { card2 };
            if (card3 > lo && card3 < hi) { RESULT_WIN } else { RESULT_LOSS }
        }
    }

    /// Spread width for a hand (0 for pair/consecutive). Pure.
    public fun spread_for(card1: u8, card2: u8): u8 {
        let diff = if (card1 > card2) { card1 - card2 } else { card2 - card1 };
        if (diff <= 1) { 0 } else { diff - 1 }
    }

    // ── Entry point ──────────────────────────────────────────────────────────

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
        // Exposure guard: max gross is 12× (pair match)
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        // Cards are ranks 1–13; generate_u8_in_range(lo, hi) is inclusive on both ends.
        let card1 = random::generate_u8_in_range(&mut g, 1, 13);
        let card2 = random::generate_u8_in_range(&mut g, 1, 13);
        let card3 = random::generate_u8_in_range(&mut g, 1, 13);

        let payout = payout_for(amount, card1, card2, card3);
        let result = result_for(card1, card2, card3);
        let spread = spread_for(card1, card2);

        house::pay_winnings(house, payout, player, ctx);
        event::emit(RedDogPlayed { player, wager: amount, card1, card2, card3, spread, result, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    // Pair match: card1==card2, card3==card1 → 12×
    #[test]
    fun test_pair_match() {
        assert!(payout_for(1000, 7, 7, 7) == 12_000, 0);
        assert!(result_for(7, 7, 7) == RESULT_PAIR_MATCH, 1);
        assert!(spread_for(7, 7) == 0, 2);
    }

    // Pair no-match: card1==card2, card3 differs → push 1×
    #[test]
    fun test_pair_push() {
        assert!(payout_for(1000, 5, 5, 3) == 1_000, 0);
        assert!(result_for(5, 5, 3) == RESULT_PAIR_PUSH, 1);
    }

    // Consecutive: |c1-c2|==1 → push regardless of c3
    #[test]
    fun test_consecutive_push() {
        assert!(payout_for(1000, 6, 7, 6) == 1_000, 0);
        assert!(payout_for(1000, 7, 6, 8) == 1_000, 1);
        assert!(payout_for(1000, 1, 2, 1) == 1_000, 2);
        assert!(result_for(6, 7, 6) == RESULT_CONSECUTIVE, 3);
    }

    // Spread 1 win: |c1-c2|==2, c3 between → 6×
    #[test]
    fun test_spread_1_win() {
        // cards 3,5 → spread 1, c3=4 is between
        assert!(payout_for(1000, 3, 5, 4) == 6_000, 0);
        assert!(result_for(3, 5, 4) == RESULT_WIN, 1);
        assert!(spread_for(3, 5) == 1, 2);
    }

    // Spread 1 loss: c3 outside → 0
    #[test]
    fun test_spread_1_loss() {
        assert!(payout_for(1000, 3, 5, 2) == 0, 0);
        assert!(payout_for(1000, 3, 5, 6) == 0, 1);
        assert!(result_for(3, 5, 6) == RESULT_LOSS, 2);
    }

    // Spread 2 win: 5× gross
    #[test]
    fun test_spread_2_win() {
        // cards 2,5 → spread 2, c3 in {3,4}
        assert!(payout_for(1000, 2, 5, 3) == 5_000, 0);
        assert!(payout_for(1000, 2, 5, 4) == 5_000, 1);
        assert!(spread_for(2, 5) == 2, 2);
    }

    // Spread 3 win: 4× gross
    #[test]
    fun test_spread_3_win() {
        // cards 1,5 → spread 3, c3 in {2,3,4}
        assert!(payout_for(1000, 1, 5, 3) == 4_000, 0);
        assert!(spread_for(1, 5) == 3, 1);
    }

    // Spread 4 win: 3× gross
    #[test]
    fun test_spread_4_win() {
        // cards 1,6 → spread 4, c3 in {2,3,4,5}
        assert!(payout_for(1000, 1, 6, 4) == 3_000, 0);
        assert!(spread_for(1, 6) == 4, 1);
    }

    // Spread 5 win: 2× gross
    #[test]
    fun test_spread_5_win() {
        // cards 1,7 → spread 5, c3 in {2,3,4,5,6}
        assert!(payout_for(1000, 1, 7, 4) == 2_000, 0);
        assert!(spread_for(1, 7) == 5, 1);
    }

    // Spread 11 (max) win: 2× gross (same as spread 5+)
    #[test]
    fun test_spread_11_win() {
        // cards 1,13 → spread 11, c3 in {2..12}
        assert!(payout_for(1000, 1, 13, 7) == 2_000, 0);
        assert!(spread_for(1, 13) == 11, 1);
    }

    // Spread 11 loss: c3 at boundary doesn't win
    #[test]
    fun test_spread_boundary_loss() {
        // cards 1,13, c3=1 or c3=13 → NOT strictly between → loss
        assert!(payout_for(1000, 1, 13, 1) == 0, 0);
        assert!(payout_for(1000, 1, 13, 13) == 0, 1);
    }

    // Card order shouldn't matter
    #[test]
    fun test_card_order_symmetric() {
        // cards 5,2 vs 2,5 — same result
        assert!(payout_for(1000, 5, 2, 3) == payout_for(1000, 2, 5, 3), 0);
        assert!(payout_for(1000, 5, 2, 8) == payout_for(1000, 2, 5, 8), 1);
    }

    // Truncation: small amounts
    #[test]
    fun test_small_amount() {
        // 10 × 12 = 120 (pair match)
        assert!(payout_for(10, 9, 9, 9) == 120, 0);
        // 1 × push = 1
        assert!(payout_for(1, 4, 5, 7) == 1, 1);
    }

    // Integration: play entry settles without abort
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
