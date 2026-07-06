/// CradleOS Casino — Dice (over/under). Roll 1–100 against your chosen line;
/// payout scales with the odds: gross multiplier = 98 / win_chance (2% edge
/// at every line). Single-tx settle, provably-fair result event.
module cradleos_casino::dice {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    public struct DiceRolled has copy, drop {
        player: address,
        wager: u64,
        target: u8,
        over: bool,
        roll: u8,
        payout: u64,
    }

    /// Win chance in percent for a line. Pure.
    public fun win_chance(target: u8, over: bool): u64 {
        if (over) { (100 - (target as u64)) } else { ((target as u64) - 1) }
    }

    /// Gross payout if `roll` wins against the line, else 0. Pure.
    /// Winner multiplier = 9800 / (chance * 100) in bps → 98/chance x.
    public fun payout_for(amount: u64, target: u8, over: bool, roll: u8): u64 {
        let won = if (over) { roll > target } else { roll < target };
        if (!won) return 0;
        let chance = win_chance(target, over);
        ((((amount as u128) * 9800) / (chance as u128) / 100) as u64)
    }

    /// Max possible payout for the exposure guard. Pure.
    public fun max_payout(amount: u64, target: u8, over: bool): u64 {
        let chance = win_chance(target, over);
        ((((amount as u128) * 9800) / (chance as u128) / 100) as u64)
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        target: u8,
        over: bool,
        ctx: &mut TxContext,
    ) {
        let chance = win_chance(target, over);
        assert!(chance >= 2 && chance <= 96, EBadParams);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(max_payout(amount, target, over) <= house::bank_balance(house) / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let roll = random::generate_u8_in_range(&mut g, 1, 100);
        let payout = payout_for(amount, target, over, roll);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(DiceRolled { player, wager: amount, target, over, roll, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // 50/50 line: over 50 → chance 50 → 1.96x.
        assert!(payout_for(100, 50, true, 51) == 196, 0);
        assert!(payout_for(100, 50, true, 50) == 0, 1);
        // under 50 → chance 49% → 98/49 = exactly 2.0x
        assert!(payout_for(100, 50, false, 49) == 200, 2);
        // Long shot: over 98 → chance 2 → 49x.
        assert!(payout_for(100, 98, true, 99) == 4900, 3);
        // Near-lock: under 97 → chance 96 → ~1.0208x.
        assert!(payout_for(10000, 97, false, 5) == 10208, 4);
        assert!(win_chance(98, true) == 2, 5);
        assert!(win_chance(97, false) == 96, 6);
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
            play<SUI>(&mut house, &r, bet, 50, true, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
