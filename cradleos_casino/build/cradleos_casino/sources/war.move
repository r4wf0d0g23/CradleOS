/// CradleOS Casino — War. Player and dealer each draw one card (rank 0..12,
/// 0=Two … 12=Ace). Highest rank wins.
///   Player higher ... 2x   (win)
///   Dealer higher ... 0x   (loss)
///   Tie ............. 0.5x  (half stake returned — classic casino war edge)
///
/// MEASURED house edge: P(tie)=1/13; among non-ties P(win)=P(lose). Tie returns
/// half. EV = (1−1/13)/2·2 + (1/13)·0.5 = 0.9615 → ~3.85% house edge.
///
/// Provably fair: both cards from one Sui-beacon tx, published in the event.
module cradleos_casino::war {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    const EMaxExposure: u64 = 1;

    /// Max multiplier (x) for the exposure guard: win = 2x.
    const MAX_MULT_X: u64 = 2;

    public struct WarPlayed has copy, drop {
        player: address,
        wager: u64,
        player_card: u8,   // rank 0..12
        dealer_card: u8,
        payout: u64,
    }

    /// Gross payout for a resolved War hand. Pure.
    /// player_card > dealer_card → 2x; tie → half stake; loss → 0.
    public fun payout_for(amount: u64, player_card: u8, dealer_card: u8): u64 {
        if (player_card > dealer_card) { amount * 2 }
        else if (player_card == dealer_card) { amount / 2 }
        else { 0 }
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let player_card = random::generate_u8_in_range(&mut g, 0, 12);
        let dealer_card = random::generate_u8_in_range(&mut g, 0, 12);
        let payout = payout_for(amount, player_card, dealer_card);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(WarPlayed { player, wager: amount, player_card, dealer_card, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        assert!(payout_for(100, 10, 5) == 200, 0);   // player higher → 2x
        assert!(payout_for(100, 3, 9) == 0, 1);        // dealer higher → loss
        assert!(payout_for(100, 7, 7) == 50, 2);       // tie → half back
        assert!(payout_for(100, 12, 11) == 200, 3);    // ace beats king
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
            play<SUI>(&mut house, &r, bet, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
