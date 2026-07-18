/// CradleOS Casino — Crash. Set an auto-cashout target multiplier; a rocket
/// climbs and "crashes" at a random multiplier. If the crash point is >= your
/// target you win (target multiplier); otherwise you lose.
///
/// This is a single-tx auto-bet Crash (the classic multiplayer Crash without
/// the shared round — each play rolls its own crash point). Same fair-odds
/// engine as Limbo (2% edge at every target) but a distinct module/event so the
/// UI can render the climbing-rocket animation and its own feed.
///
/// FAIR ODDS (2% edge): draw u in [1, 1_000_000]; crash_bps = 9_800_000_000 / u
/// (capped). P(crash_bps >= target_bps) = 9800 / target_bps = 0.98 / m. ✓
/// Target range 1.01x (10_100 bps; 10000 bps = 1.00x) … 1000x (10_000_000 bps).
/// Max payout 1000x. (v21 fix: MIN was 101 = 0.0101x — sub-1x targets were
/// guaranteed "wins" paying back less than the stake. Never player-exploitable
/// — EV ≤ 0.98 at every target — but a player trap. Now blocked on-chain.)
module cradleos_casino::crash {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    const MIN_TARGET_BPS: u64 = 10_100;
    const MAX_TARGET_BPS: u64 = 10_000_000;
    const EDGE_NUM: u128 = 9_800_000_000;
    const ROLL_MAX: u64 = 1_000_000;

    public struct CrashRoundPlayed has copy, drop {
        player: address,
        wager: u64,
        target_bps: u64,   // auto-cashout target multiplier (bps)
        crash_bps: u64,    // rolled crash multiplier (bps)
        payout: u64,
    }

    /// Crash multiplier (bps) from a uniform roll u in [1, ROLL_MAX]. Pure.
    public fun crash_from_roll(u: u64): u64 {
        let c = (EDGE_NUM / (u as u128)) as u64;
        if (c > MAX_TARGET_BPS) { MAX_TARGET_BPS } else { c }
    }

    /// Gross payout for a target vs a rolled crash multiplier. Pure.
    public fun payout_for(amount: u64, target_bps: u64, crash_bps: u64): u64 {
        if (crash_bps >= target_bps) {
            (((amount as u128) * (target_bps as u128) / 10000) as u64)
        } else { 0 }
    }

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

        event::emit(CrashRoundPlayed { player, wager: amount, target_bps, crash_bps, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        assert!(payout_for(100, 20000, 25000) == 200, 0);
        assert!(payout_for(100, 20000, 19999) == 0, 1);
        assert!(crash_from_roll(490000) >= 20000, 2);
        assert!(crash_from_roll(490001) < 20000, 3);
        assert!(crash_from_roll(1) == MAX_TARGET_BPS, 4);
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
            play<SUI>(&mut house, &r, bet, 20000, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
