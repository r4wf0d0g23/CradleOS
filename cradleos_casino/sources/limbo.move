/// CradleOS Casino — Limbo. Pick a target multiplier; the game rolls a random
/// crash multiplier. If the crash point is >= your target, you win your target
/// multiplier; otherwise you lose.
///
/// FAIR-ODDS MODEL (2% house edge at every target):
///   For a target multiplier m (in bps, 10000 = 1.00x), the fair win chance is
///   1/m. We shave 2% off: win_chance = 0.98 / m. The crash multiplier is drawn
///   so that P(crash >= m) = 0.98 * 10000 / m_bps. Concretely we draw a uniform
///   u in [1, 1_000_000] and define the crash multiplier as:
///       crash_bps = floor(9_800_000_000 / u)   (capped)
///   Then P(crash_bps >= m_bps) = P(u <= 9_800_000_000 / m_bps)
///                              = (9_800_000_000 / m_bps) / 1_000_000
///                              = 9800 / m_bps   → exactly 0.98/m. 2% edge. ✓
///   Payout on a win = wager * m_bps / 10000 (your chosen target multiplier).
///
/// Target range: 1.01x (10_100 bps; 10000 bps = 1.00x) … 1000x (10_000_000 bps).
/// Max payout 1000x. (v21 fix: MIN was 101 = 0.0101x — sub-1x player trap.)
module cradleos_casino::limbo {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    /// Minimum target multiplier in bps (1.01x; 10000 bps = 1.00x).
    const MIN_TARGET_BPS: u64 = 10_100;
    /// Maximum target multiplier in bps (1000x).
    const MAX_TARGET_BPS: u64 = 10_000_000;
    /// Edge-adjusted numerator: 0.98 * 10000(bps) * 1_000_000(roll range).
    const EDGE_NUM: u128 = 9_800_000_000;
    /// Uniform roll range upper bound.
    const ROLL_MAX: u64 = 1_000_000;

    public struct LimboRolled has copy, drop {
        player: address,
        wager: u64,
        target_bps: u64,   // player's chosen target multiplier (bps)
        crash_bps: u64,    // rolled crash multiplier (bps)
        payout: u64,
    }

    /// Crash multiplier (bps) from a uniform roll u in [1, ROLL_MAX]. Pure.
    public fun crash_from_roll(u: u64): u64 {
        // crash_bps = 9_800_000_000 / u, capped at MAX_TARGET_BPS for display.
        let c = (EDGE_NUM / (u as u128)) as u64;
        if (c > MAX_TARGET_BPS) { MAX_TARGET_BPS } else { c }
    }

    /// Gross payout for a target vs a rolled crash multiplier. Pure.
    public fun payout_for(amount: u64, target_bps: u64, crash_bps: u64): u64 {
        if (crash_bps >= target_bps) {
            (((amount as u128) * (target_bps as u128) / 10000) as u64)
        } else { 0 }
    }

    /// Max possible payout for the exposure guard. Pure.
    public fun max_payout(amount: u64, target_bps: u64): u64 {
        (((amount as u128) * (target_bps as u128) / 10000) as u64)
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        target_bps: u64,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(target_bps >= MIN_TARGET_BPS && target_bps <= MAX_TARGET_BPS, EBadParams);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(max_payout(amount, target_bps) <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let u = random::generate_u64_in_range(&mut g, 1, ROLL_MAX);
        let crash_bps = crash_from_roll(u);
        let payout = payout_for(amount, target_bps, crash_bps);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(LimboRolled { player, wager: amount, target_bps, crash_bps, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // 2x target: win pays exactly 2x.
        assert!(payout_for(100, 20000, 25000) == 200, 0);   // crash 2.5x >= 2.0x → win 2x
        assert!(payout_for(100, 20000, 19999) == 0, 1);      // crash 1.9999x < 2.0x → loss
        // 10x target
        assert!(payout_for(100, 100000, 100000) == 1000, 2); // exactly at target → win
        assert!(payout_for(100, 100000, 99999) == 0, 3);
        // crash-from-roll: u=1 → max cap; u at edge boundary for 2x target.
        // For target 2x (20000 bps): win iff u <= 9_800_000_000/20000 = 490000.
        assert!(crash_from_roll(490000) >= 20000, 4);        // boundary win
        assert!(crash_from_roll(490001) < 20000, 5);         // just past → loss
        // u=1 gives the cap
        assert!(crash_from_roll(1) == MAX_TARGET_BPS, 6);
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
            play<SUI>(&mut house, &r, bet, 20000, ctx); // 2x target
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
