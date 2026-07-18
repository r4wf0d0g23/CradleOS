/// CradleOS Casino — European Roulette (single zero, 0–36). One bet per spin.
/// Gross payouts: straight 36x, even-money 2x, dozen/column 3x — the classic
/// 1/37 house edge (~2.7%) on every bet. Single-tx settle.
module cradleos_casino::roulette {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    // Bet kinds
    const KIND_STRAIGHT: u8 = 0; // target 0-36, pays 36x
    const KIND_COLOR:    u8 = 1; // target 0=red 1=black, pays 2x (zero loses)
    const KIND_PARITY:   u8 = 2; // target 0=even 1=odd, pays 2x (zero loses)
    const KIND_RANGE:    u8 = 3; // target 0=1-18 1=19-36, pays 2x (zero loses)
    const KIND_DOZEN:    u8 = 4; // target 0/1/2 → 1-12/13-24/25-36, pays 3x
    const KIND_COLUMN:   u8 = 5; // target 0/1/2 → n%3==1/2/0, pays 3x

    public struct RouletteSpun has copy, drop {
        player: address,
        wager: u64,
        bet_kind: u8,
        bet_target: u8,
        spin: u8,
        payout: u64,
    }

    /// Standard European red set.
    fun is_red(n: u8): bool {
        n == 1 || n == 3 || n == 5 || n == 7 || n == 9 || n == 12 ||
        n == 14 || n == 16 || n == 18 || n == 19 || n == 21 || n == 23 ||
        n == 25 || n == 27 || n == 30 || n == 32 || n == 34 || n == 36
    }

    /// Validate a (kind, target) combo. Pure.
    public fun valid_bet(bet_kind: u8, bet_target: u8): bool {
        if (bet_kind == KIND_STRAIGHT) { bet_target <= 36 }
        else if (bet_kind == KIND_COLOR || bet_kind == KIND_PARITY || bet_kind == KIND_RANGE) { bet_target <= 1 }
        else if (bet_kind == KIND_DOZEN || bet_kind == KIND_COLUMN) { bet_target <= 2 }
        else { false }
    }

    /// Gross multiplier (x) for the bet kind — for the exposure guard. Pure.
    public fun max_multiplier(bet_kind: u8): u64 {
        if (bet_kind == KIND_STRAIGHT) { 36 }
        else if (bet_kind == KIND_DOZEN || bet_kind == KIND_COLUMN) { 3 }
        else { 2 }
    }

    /// Gross payout for a spin against a bet. Pure — unit-tested per kind.
    public fun payout_for(amount: u64, bet_kind: u8, bet_target: u8, spin: u8): u64 {
        let won = if (bet_kind == KIND_STRAIGHT) {
            spin == bet_target
        } else if (spin == 0) {
            false // zero loses every outside bet
        } else if (bet_kind == KIND_COLOR) {
            if (bet_target == 0) { is_red(spin) } else { !is_red(spin) }
        } else if (bet_kind == KIND_PARITY) {
            if (bet_target == 0) { spin % 2 == 0 } else { spin % 2 == 1 }
        } else if (bet_kind == KIND_RANGE) {
            if (bet_target == 0) { spin <= 18 } else { spin >= 19 }
        } else if (bet_kind == KIND_DOZEN) {
            (spin >= 1 + bet_target * 12) && (spin <= 12 + bet_target * 12)
        } else {
            // column: target 0 → n%3==1, 1 → n%3==2, 2 → n%3==0
            let rem = spin % 3;
            (bet_target == 0 && rem == 1) || (bet_target == 1 && rem == 2) || (bet_target == 2 && rem == 0)
        };
        if (won) { amount * max_multiplier(bet_kind) } else { 0 }
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        bet_kind: u8,
        bet_target: u8,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(valid_bet(bet_kind, bet_target), EBadParams);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * max_multiplier(bet_kind) <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        let mut g = random::new_generator(r, ctx);
        let spin = random::generate_u8_in_range(&mut g, 0, 36);
        let payout = payout_for(amount, bet_kind, bet_target, spin);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(RouletteSpun { player, wager: amount, bet_kind, bet_target, spin, payout });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_all_kinds() {
        // straight
        assert!(payout_for(10, KIND_STRAIGHT, 17, 17) == 360, 0);
        assert!(payout_for(10, KIND_STRAIGHT, 17, 16) == 0, 1);
        assert!(payout_for(10, KIND_STRAIGHT, 0, 0) == 360, 2);
        // color: 1 is red, 2 is black; zero loses
        assert!(payout_for(10, KIND_COLOR, 0, 1) == 20, 3);
        assert!(payout_for(10, KIND_COLOR, 1, 2) == 20, 4);
        assert!(payout_for(10, KIND_COLOR, 0, 2) == 0, 5);
        assert!(payout_for(10, KIND_COLOR, 0, 0) == 0, 6);
        // parity; zero loses even bet
        assert!(payout_for(10, KIND_PARITY, 0, 8) == 20, 7);
        assert!(payout_for(10, KIND_PARITY, 1, 9) == 20, 8);
        assert!(payout_for(10, KIND_PARITY, 0, 0) == 0, 9);
        // range
        assert!(payout_for(10, KIND_RANGE, 0, 18) == 20, 10);
        assert!(payout_for(10, KIND_RANGE, 1, 19) == 20, 11);
        assert!(payout_for(10, KIND_RANGE, 0, 19) == 0, 12);
        // dozen
        assert!(payout_for(10, KIND_DOZEN, 0, 12) == 30, 13);
        assert!(payout_for(10, KIND_DOZEN, 1, 13) == 30, 14);
        assert!(payout_for(10, KIND_DOZEN, 2, 36) == 30, 15);
        assert!(payout_for(10, KIND_DOZEN, 2, 24) == 0, 16);
        // column: 1→col0, 2→col1, 3→col2 (n%3: 1,2,0)
        assert!(payout_for(10, KIND_COLUMN, 0, 1) == 30, 17);
        assert!(payout_for(10, KIND_COLUMN, 1, 2) == 30, 18);
        assert!(payout_for(10, KIND_COLUMN, 2, 3) == 30, 19);
        assert!(payout_for(10, KIND_COLUMN, 0, 2) == 0, 20);
        // zero loses columns too
        assert!(payout_for(10, KIND_COLUMN, 2, 0) == 0, 21);
        // validation
        assert!(valid_bet(KIND_STRAIGHT, 36) && !valid_bet(KIND_STRAIGHT, 37), 22);
        assert!(valid_bet(KIND_DOZEN, 2) && !valid_bet(KIND_DOZEN, 3), 23);
        assert!(!valid_bet(6, 0), 24);
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
            play<SUI>(&mut house, &r, bet, KIND_COLOR, 0, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
