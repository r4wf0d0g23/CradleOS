/// CradleOS Casino — Coinflip. Call heads or tails; win pays 1.96x gross
/// (2% house edge). Single-tx settle: randomness consumed once, outcome and
/// payout emitted in the result event for provably-fair audit.
module cradleos_casino::coinflip {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    /// Gross win multiplier in basis points (10000 = 1x). 19600 = 1.96x → 2% edge.
    const WIN_BPS: u64 = 19600;

    public struct FlipResult has copy, drop {
        player: address,
        wager: u64,
        choice: u8,   // 0 = heads, 1 = tails
        result: u8,
        payout: u64,
    }

    /// Gross payout for a flip. Pure — deterministic unit tests.
    public fun payout_for(amount: u64, choice: u8, result: u8): u64 {
        if (choice == result) {
            (((amount as u128) * (WIN_BPS as u128) / 10000) as u64)
        } else { 0 }
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        choice: u8,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(choice <= 1, EBadParams);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        // 3%-bankroll exposure rule: max possible payout must fit the budget.
        let max_payout = (((amount as u128) * (WIN_BPS as u128) / 10000) as u64);
        assert!(max_payout <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let result = random::generate_u8_in_range(&mut g, 0, 1);
        let payout = payout_for(amount, choice, result);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(FlipResult { player, wager: amount, choice, result, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        assert!(payout_for(100, 0, 0) == 196, 0);
        assert!(payout_for(100, 1, 1) == 196, 1);
        assert!(payout_for(100, 0, 1) == 0, 2);
        assert!(payout_for(1_000_000_000, 1, 1) == 1_960_000_000, 3);
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
            play<SUI>(&mut house, &r, bet, 0, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
