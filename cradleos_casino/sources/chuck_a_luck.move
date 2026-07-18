/// CradleOS Casino — Chuck-a-Luck (#20, Category A: Dice & Number)
///
/// Classic birdcage game: pick a number 1–6, roll 3 dice, count how many match.
/// Simple mechanic, strong near-miss (two matches visible, one off), tight session loop.
///
/// PSYCHOLOGY: near-miss is superb — two matching dice glow while one stays cold;
/// the birdcage tumble animation adds anticipation. Fastest repeat-bet dice game
/// after coinflip. Zero decisions after target pick → minimal friction.
///
/// BET: player picks target face (1–6).
/// ROLLS: three d6 drawn from one Sui-beacon transaction (provably fair).
/// PAYOUTS (gross bps; 10 000 bps = 1.00× stake returned):
///   0 matches → 0 bps      (lose stake)
///   1 match   → 19 000 bps  (1.9× gross)    net +0.9×
///   2 matches → 37 000 bps  (3.7× gross)    net +2.7×
///   3 matches → 120 000 bps (12.0× gross)   net +11×
///
/// MEASURED HOUSE EDGE (derived — verified in edge computation below):
///   P(0 match) = (5/6)^3       = 125/216
///   P(1 match) = C(3,1)(1/6)(5/6)^2 = 75/216
///   P(2 match) = C(3,2)(1/6)^2(5/6) = 15/216
///   P(3 match) = (1/6)^3       =  1/216
///   EV = −125/216 + 75/216×0.9 + 15/216×2.7 + 1/216×11
///      = (−125 + 67.5 + 40.5 + 11) / 216
///      = −6 / 216 ≈ −0.02778 → **house edge 2.78%** ✓ (within 2–5% mandate)
///
/// MAX_MULT_X = 12 (triple-match gross).
/// Exposure guard: amount × 12 ≤ bank_balance × 3/100.
module cradleos_casino::chuck_a_luck {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    // ── Error codes ──────────────────────────────────────────────────────────
    const EBadTarget:   u64 = 0;   // target must be 1..6
    const EMaxExposure: u64 = 1;   // wager too large for current bank

    // ── Payout constants (gross bps; 10 000 = 1.00× stake returned) ─────────
    const BPS_1MATCH: u64 = 19_000;    // 1.9× gross → net +0.9×
    const BPS_2MATCH: u64 = 37_000;    // 3.7× gross → net +2.7×
    const BPS_3MATCH: u64 = 120_000;   // 12.0× gross → net +11×

    /// Worst-case gross multiplier for the exposure guard.
    const MAX_MULT_X: u64 = 12;

    // ── Event ────────────────────────────────────────────────────────────────
    public struct ChuckALuckRolled has copy, drop {
        player:  address,
        wager:   u64,
        target:  u8,    // 1..6 chosen by player
        d1:      u8,    // die 1 face (1..6)
        d2:      u8,    // die 2 face (1..6)
        d3:      u8,    // die 3 face (1..6)
        matches: u8,    // 0..3 dice showing target
        payout:  u64,   // gross payout (0 = loss)
    }

    // ── Pure math ────────────────────────────────────────────────────────────

    /// Count how many of d1/d2/d3 equal target. Pure.
    public fun count_matches(target: u8, d1: u8, d2: u8, d3: u8): u8 {
        let mut c: u8 = 0;
        if (d1 == target) { c = c + 1; };
        if (d2 == target) { c = c + 1; };
        if (d3 == target) { c = c + 1; };
        c
    }

    /// Gross payout for a resolved Chuck-a-Luck roll. Pure — exhaustively testable.
    public fun payout_for(amount: u64, target: u8, d1: u8, d2: u8, d3: u8): u64 {
        let m = count_matches(target, d1, d2, d3);
        if (m == 0) {
            0
        } else if (m == 1) {
            ((amount as u128) * (BPS_1MATCH as u128) / 10_000) as u64
        } else if (m == 2) {
            ((amount as u128) * (BPS_2MATCH as u128) / 10_000) as u64
        } else {
            // m == 3: triple match
            ((amount as u128) * (BPS_3MATCH as u128) / 10_000) as u64
        }
    }

    // ── Entry ────────────────────────────────────────────────────────────────

    /// Play one round of Chuck-a-Luck. Three d6 rolled in one transaction.
    /// Result published in ChuckALuckRolled event for provably-fair verification.
    entry fun play<T>(
        house:  &mut House<T>,
        r:      &Random,
        character: &Character,
        wager:  Coin<T>,
        target: u8,
        ctx:    &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(target >= 1 && target <= 6, EBadTarget);

        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g   = random::new_generator(r, ctx);
        let d1      = random::generate_u8_in_range(&mut g, 1, 6);
        let d2      = random::generate_u8_in_range(&mut g, 1, 6);
        let d3      = random::generate_u8_in_range(&mut g, 1, 6);
        let matches = count_matches(target, d1, d2, d3);
        let payout  = payout_for(amount, target, d1, d2, d3);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(ChuckALuckRolled { player, wager: amount, target, d1, d2, d3, matches, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    #[test]
    fun test_payout_math() {
        // 0 matches → loss
        assert!(payout_for(100, 3, 1, 2, 4) == 0, 0);   // no 3s
        assert!(payout_for(100, 5, 1, 2, 3) == 0, 1);   // no 5s

        // 1 match → 19000 bps = 190 for amount=100
        assert!(payout_for(100, 3, 3, 1, 2) == 190, 2);
        assert!(payout_for(100, 3, 1, 3, 2) == 190, 3);
        assert!(payout_for(100, 3, 1, 2, 3) == 190, 4);

        // 2 matches → 37000 bps = 370 for amount=100
        assert!(payout_for(100, 3, 3, 3, 1) == 370, 5);
        assert!(payout_for(100, 3, 3, 1, 3) == 370, 6);
        assert!(payout_for(100, 3, 1, 3, 3) == 370, 7);

        // 3 matches → 120000 bps = 1200 for amount=100
        assert!(payout_for(100, 3, 3, 3, 3) == 1200, 8);

        // edge: target=1
        assert!(payout_for(200, 1, 1, 1, 1) == 2400, 9);  // 200 * 12 = 2400
        // edge: target=6
        assert!(payout_for(150, 6, 6, 2, 3) == 285, 10);  // 150 * 1.9 = 285
        assert!(payout_for(150, 6, 6, 6, 3) == 555, 11);  // 150 * 3.7 = 555
        assert!(payout_for(150, 6, 6, 6, 6) == 1800, 12); // 150 * 12  = 1800

        // large amount (exercises u128 path)
        assert!(payout_for(1_000_000_000, 4, 4, 4, 4) == 12_000_000_000, 13);
    }

    #[test]
    fun test_count_matches() {
        assert!(count_matches(3, 1, 2, 4) == 0, 0);
        assert!(count_matches(3, 3, 2, 4) == 1, 1);
        assert!(count_matches(3, 3, 3, 4) == 2, 2);
        assert!(count_matches(3, 3, 3, 3) == 3, 3);
        // boundary targets
        assert!(count_matches(1, 1, 2, 3) == 1, 4);
        assert!(count_matches(6, 6, 6, 1) == 2, 5);
    }
}
