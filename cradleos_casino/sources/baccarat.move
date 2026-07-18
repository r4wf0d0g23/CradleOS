/// CradleOS Casino — Baccarat (Punto Banco). Bet Player, Banker, or Tie. The
/// contract deals from a freshly shuffled single deck following the standard
/// third-card drawing rules, scores both hands (mod 10), and settles.
///
/// BETS (kind):
///   0 PLAYER — pays 2x   if Player wins (edge ~1.24%)
///   1 BANKER — pays 1.95x if Banker wins (5% commission; edge ~1.06%)
///   2 TIE    — pays 9x   if it's a tie (edge ~4.85%)
///   On a TIE, Player/Banker bets PUSH (stake returned, 1x).
///
/// Card values: rank 0..12 → A=1, 2..9 = face, 10/J/Q/K = 0. Score = sum mod 10.
/// Third-card rules are the canonical Punto Banco tableau.
///
/// Provably fair: the deck is shuffled once from the Sui beacon in a single tx;
/// all dealt cards are published in the event for verification.
module cradleos_casino::baccarat {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const EBadParams:   u64 = 0;
    const EMaxExposure: u64 = 1;

    const KIND_PLAYER: u8 = 0;
    const KIND_BANKER: u8 = 1;
    const KIND_TIE:    u8 = 2;

    /// Max multiplier (x) for the exposure guard: TIE pays 9x.
    const MAX_MULT_X: u64 = 9;

    public struct BaccaratPlayed has copy, drop {
        player: address,
        wager: u64,
        kind: u8,
        player_cards: vector<u8>,   // 2 or 3 ranks
        banker_cards: vector<u8>,   // 2 or 3 ranks
        player_score: u8,
        banker_score: u8,
        result: u8,                 // 0=player win, 1=banker win, 2=tie
        payout: u64,
    }

    /// Baccarat card value for a rank 0..12 (A=1,2..9,0 for 10/J/Q/K). Pure.
    public fun card_value(rank: u8): u8 {
        let r = rank + 1;             // rank 0 = Ace = 1
        if (r >= 10) { 0 } else { r }
    }

    /// Score of a card list (sum of values mod 10). Pure.
    public fun score(cards: &vector<u8>): u8 {
        let mut s = 0u64;
        let n = vector::length(cards);
        let mut i = 0;
        while (i < n) { s = s + (card_value(*vector::borrow(cards, i)) as u64); i = i + 1; };
        ((s % 10) as u8)
    }

    /// Banker draws a third card? Given banker 2-card score and the player's
    /// third card value (255 = player did not draw). Standard tableau. Pure.
    public fun banker_draws(banker_score: u8, player_third_val: u8): bool {
        if (banker_score <= 2) { true }
        else if (banker_score == 3) { player_third_val != 8 }
        else if (banker_score == 4) { player_third_val >= 2 && player_third_val <= 7 }
        else if (banker_score == 5) { player_third_val >= 4 && player_third_val <= 7 }
        else if (banker_score == 6) { player_third_val == 6 || player_third_val == 7 }
        else { false } // 7 stands
    }

    /// Gross payout for a resolved bet. Pure.
    public fun payout_for(amount: u64, kind: u8, result: u8): u64 {
        if (kind == KIND_PLAYER) {
            if (result == 0) { amount * 2 } else if (result == 2) { amount } else { 0 }
        } else if (kind == KIND_BANKER) {
            if (result == 1) { ((amount as u128) * 19500 / 10000) as u64 } // 1.95x
            else if (result == 2) { amount } else { 0 }
        } else if (kind == KIND_TIE) {
            if (result == 2) { amount * 9 } else { 0 }
        } else { 0 }
    }

    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        kind: u8,
        ctx: &mut TxContext,
    ) {
        house::assert_character(house, character, ctx);
        assert!(kind <= KIND_TIE, EBadParams);
        let player_addr = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        // Build + shuffle a 52-card deck (rank = index % 13).
        let mut deck: vector<u8> = vector[];
        let mut c = 0u8;
        while (c < 52) { vector::push_back(&mut deck, c % 13); c = c + 1; };
        let mut g = random::new_generator(r, ctx);
        random::shuffle(&mut g, &mut deck);

        // Deal: P, B, P, B.
        let mut cursor = 0u64;
        let mut pcards: vector<u8> = vector[];
        let mut bcards: vector<u8> = vector[];
        vector::push_back(&mut pcards, *vector::borrow(&deck, cursor)); cursor = cursor + 1;
        vector::push_back(&mut bcards, *vector::borrow(&deck, cursor)); cursor = cursor + 1;
        vector::push_back(&mut pcards, *vector::borrow(&deck, cursor)); cursor = cursor + 1;
        vector::push_back(&mut bcards, *vector::borrow(&deck, cursor)); cursor = cursor + 1;

        let pscore0 = score(&pcards);
        let bscore0 = score(&bcards);
        let natural = pscore0 >= 8 || bscore0 >= 8;

        let mut player_third_val = 255u8; // sentinel: no third card
        if (!natural) {
            // Player rule: draws on 0..5, stands 6..7.
            if (pscore0 <= 5) {
                let tc = *vector::borrow(&deck, cursor); cursor = cursor + 1;
                vector::push_back(&mut pcards, tc);
                player_third_val = card_value(tc);
            };
            // Banker rule.
            let bscore_now = score(&bcards);
            if (banker_draws(bscore_now, player_third_val)) {
                let tc = *vector::borrow(&deck, cursor); cursor = cursor + 1;
                vector::push_back(&mut bcards, tc);
            };
        };

        let pscore = score(&pcards);
        let bscore = score(&bcards);
        let result = if (pscore > bscore) { 0u8 } else if (bscore > pscore) { 1u8 } else { 2u8 };
        let payout = payout_for(amount, kind, result);
        house::pay_winnings(house, payout, player_addr, ctx);

        event::emit(BaccaratPlayed {
            player: player_addr, wager: amount, kind,
            player_cards: pcards, banker_cards: bcards,
            player_score: pscore, banker_score: bscore, result, payout,
        });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_scoring_and_rules() {
        // card values
        assert!(card_value(0) == 1, 0);   // Ace
        assert!(card_value(8) == 9, 1);    // Nine
        assert!(card_value(9) == 0, 2);    // Ten
        assert!(card_value(12) == 0, 3);   // King
        // score mod 10: 7+8 = 15 → 5
        assert!(score(&vector[6u8, 7]) == 5, 4);  // 7 + 8 = 15 → 5
        // banker tableau spot checks
        assert!(banker_draws(2, 255) == true, 5);
        assert!(banker_draws(7, 5) == false, 6);
        assert!(banker_draws(3, 8) == false, 7);
        assert!(banker_draws(6, 6) == true, 8);
        assert!(banker_draws(6, 5) == false, 9);
        // payouts
        assert!(payout_for(100, KIND_PLAYER, 0) == 200, 10);
        assert!(payout_for(100, KIND_BANKER, 1) == 195, 11);  // 1.95x
        assert!(payout_for(100, KIND_TIE, 2) == 900, 12);     // 9x
        assert!(payout_for(100, KIND_PLAYER, 2) == 100, 13);  // tie → push on player bet
        assert!(payout_for(100, KIND_BANKER, 2) == 100, 14);  // tie → push on banker bet
        assert!(payout_for(100, KIND_TIE, 0) == 0, 15);
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
            play<SUI>(&mut house, &r, bet, KIND_BANKER, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
