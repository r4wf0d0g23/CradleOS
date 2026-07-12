/// CradleOS Casino — Three Card Poker (single-tx, ante only).
///
/// FLOW (single transaction):
///   `play` — validates+escrows ante, shuffles a 52-card deck, deals 3 cards to
///   player and 3 to dealer, evaluates both hands, checks dealer qualification,
///   settles, emits event, all in one tx.
///
/// THREE-CARD HAND RANKS (high → low):
///   5 STRAIGHT_FLUSH  — 3 consecutive same-suit
///   4 THREE_KIND      — 3 of a rank
///   3 STRAIGHT        — 3 consecutive mixed suits (NOTE: beats FLUSH in 3-card)
///   2 FLUSH           — 3 same suit, not straight
///   1 PAIR            — 2 of a rank
///   0 HIGH_CARD       — none of the above
///
/// DEALER QUALIFICATION: dealer holds Queen-high or better (high card rank >= 11(Q),
/// or any pair+).
///
/// SETTLEMENT (ante only):
///   player loses (dealer strictly higher) → 0
///   tie                                   → ante returned (1x)
///   player wins, dealer doesn't qualify   → 2x (even money)
///   player wins, dealer qualifies:
///     HIGH_CARD or PAIR or FLUSH          → 2x
///     STRAIGHT                            → 3x
///     THREE_KIND                          → 5x
///     STRAIGHT_FLUSH                      → 6x
///
/// RESULT codes: 0=LOSE, 1=PUSH, 2=WIN.
/// MAX_MULT_X = 6 for exposure guard.
///
/// Card encoding: index 0..51; rank = index % 13 (0=Ace..12=King); suit = index/13.
module cradleos_casino::three_card_poker {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    // ── Errors ────────────────────────────────────────────────────────────────
    const EMaxExposure: u64 = 1;

    // ── Tuning ────────────────────────────────────────────────────────────────
    /// Max gross multiplier (x) for exposure guard: straight flush = 6x.
    const MAX_MULT_X: u64 = 6;

    // ── Hand rank constants ──────────────────────────────────────────────────
    const RANK_HIGH_CARD:      u8 = 0;
    const RANK_PAIR:           u8 = 1;
    const RANK_FLUSH:          u8 = 2;
    const RANK_STRAIGHT:       u8 = 3;
    const RANK_THREE_KIND:     u8 = 4;
    const RANK_STRAIGHT_FLUSH: u8 = 5;

    // Result codes
    const RESULT_LOSE: u8 = 0;
    const RESULT_PUSH: u8 = 1;
    const RESULT_WIN:  u8 = 2;

    // ── Event ─────────────────────────────────────────────────────────────────
    public struct ThreeCardPlayed has copy, drop {
        player: address,
        wager: u64,
        player_cards: vector<u8>,
        dealer_cards: vector<u8>,
        player_rank: u8,
        dealer_rank: u8,
        dealer_qualified: bool,
        result: u8,
        payout: u64,
    }

    // ── Play (single tx, consumes &Random) ───────────────────────────────────
    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        ante: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &ante);
        // Exposure guard: max 6x gross payout.
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        // Absorb ante into the bank.
        house::deposit_stake(house, coin::into_balance(ante));

        // Build and shuffle a 52-card deck.
        let mut deck: vector<u8> = vector[];
        let mut c = 0u8;
        while (c < 52) { vector::push_back(&mut deck, c); c = c + 1; };
        let mut g = random::new_generator(r, ctx);
        random::shuffle(&mut g, &mut deck);

        // Deal: P1, D1, P2, D2, P3, D3.
        let mut player_cards: vector<u8> = vector[];
        let mut dealer_cards: vector<u8> = vector[];
        vector::push_back(&mut player_cards, *vector::borrow(&deck, 0));
        vector::push_back(&mut dealer_cards, *vector::borrow(&deck, 1));
        vector::push_back(&mut player_cards, *vector::borrow(&deck, 2));
        vector::push_back(&mut dealer_cards, *vector::borrow(&deck, 3));
        vector::push_back(&mut player_cards, *vector::borrow(&deck, 4));
        vector::push_back(&mut dealer_cards, *vector::borrow(&deck, 5));

        let player_rank = evaluate_three(&player_cards);
        let dealer_rank = evaluate_three(&dealer_cards);

        // Dealer qualification: pair+ always qualifies; high card qualifies if
        // highest rank >= Queen (rank 11). For straight/flush/straight_flush the
        // lowest card is at least some rank, but any pair+ auto-qualifies too.
        let dq = dealer_qualifies(dealer_rank, high_card_rank(&dealer_cards));

        // Comparison: compare by rank first, then tiebreak on high card.
        let result = compare_result(player_rank, &player_cards, dealer_rank, &dealer_cards);
        let payout = payout_for(amount, player_rank, result, dq);

        house::pay_winnings(house, payout, player, ctx);

        event::emit(ThreeCardPlayed {
            player,
            wager: amount,
            player_cards,
            dealer_cards,
            player_rank,
            dealer_rank,
            dealer_qualified: dq,
            result,
            payout,
        });
    }

    // ── Pure helpers ─────────────────────────────────────────────────────────

    /// Evaluate a 3-card hand. Returns rank 0..5.
    public fun evaluate_three(cards: &vector<u8>): u8 {
        let r0 = (*vector::borrow(cards, 0)) % 13;
        let r1 = (*vector::borrow(cards, 1)) % 13;
        let r2 = (*vector::borrow(cards, 2)) % 13;

        let s0 = (*vector::borrow(cards, 0)) / 13;
        let s1 = (*vector::borrow(cards, 1)) / 13;
        let s2 = (*vector::borrow(cards, 2)) / 13;

        let is_flush = s0 == s1 && s1 == s2;
        let is_straight = is_three_straight(r0, r1, r2);

        // Three of a kind.
        let three_kind = r0 == r1 && r1 == r2;
        // Pair.
        let pair = r0 == r1 || r1 == r2 || r0 == r2;

        if (is_flush && is_straight) { return RANK_STRAIGHT_FLUSH };
        if (three_kind) { return RANK_THREE_KIND };
        // NOTE: In 3-card poker, straight beats flush.
        if (is_straight) { return RANK_STRAIGHT };
        if (is_flush) { return RANK_FLUSH };
        if (pair) { return RANK_PAIR };
        RANK_HIGH_CARD
    }

    /// Check if 3 ranks form a straight (3 consecutive, with Ace high or low).
    fun is_three_straight(r0: u8, r1: u8, r2: u8): bool {
        // Sort 3 values.
        let mut a = r0;
        let mut b = r1;
        let mut c = r2;
        if (a > b) { let t = a; a = b; b = t; };
        if (b > c) { let t = b; b = c; c = t; };
        if (a > b) { let t = a; a = b; b = t; };
        // Normal: consecutive.
        let normal = b == a + 1 && c == b + 1;
        // Wheel: A-2-3 → sorted [0,1,2] — actually that's already normal.
        // broadway: Q-K-A → sorted [0,11,12] (Ace=0, Q=11, K=12).
        let broadway = a == 0 && b == 11 && c == 12;
        normal || broadway
    }

    /// Return the highest card rank in a 3-card hand.
    public fun high_card_rank(cards: &vector<u8>): u8 {
        let r0 = (*vector::borrow(cards, 0)) % 13;
        let r1 = (*vector::borrow(cards, 1)) % 13;
        let r2 = (*vector::borrow(cards, 2)) % 13;
        // Ace (rank 0) is high in 3-card poker. Treat it as 13 for comparison.
        let v0 = if (r0 == 0) { 13u8 } else { r0 };
        let v1 = if (r1 == 0) { 13u8 } else { r1 };
        let v2 = if (r2 == 0) { 13u8 } else { r2 };
        let mut m = v0;
        if (v1 > m) { m = v1; };
        if (v2 > m) { m = v2; };
        m
    }

    /// Dealer qualifies if rank >= PAIR, OR high card is Queen-high (>=12 in
    /// our 1-indexed high scale, i.e. high_card_rank ≥ 12 where Queen=11 stored
    /// rank but maps to high_card_rank 11, and Ace maps to 13).
    /// Queen rank stored as 11. high_card_rank returns: A→13, K→12, Q→11, ...
    /// So dealer qualifies with HIGH_CARD if high_card_rank >= 11 (Queen or better).
    public fun dealer_qualifies(rank: u8, high: u8): bool {
        if (rank >= RANK_PAIR) { true }
        else { high >= 11 } // Queen (11) or better → qualifies with high card
    }

    /// Compare two 3-card hands. Returns RESULT_WIN/PUSH/LOSE from player perspective.
    fun compare_result(
        player_rank: u8,
        player_cards: &vector<u8>,
        dealer_rank: u8,
        dealer_cards: &vector<u8>,
    ): u8 {
        if (player_rank > dealer_rank) { return RESULT_WIN };
        if (player_rank < dealer_rank) { return RESULT_LOSE };
        // Same rank: tiebreak on high card.
        let ph = high_card_rank(player_cards);
        let dh = high_card_rank(dealer_cards);
        if (ph > dh) { RESULT_WIN }
        else if (ph < dh) { RESULT_LOSE }
        else { RESULT_PUSH }
    }

    /// Gross payout calculation.
    public fun payout_for(amount: u64, player_rank: u8, result: u8, dealer_qualified: bool): u64 {
        if (result == RESULT_LOSE) { return 0 };
        if (result == RESULT_PUSH) { return amount }; // tie → return ante
        // Player wins.
        if (!dealer_qualified) {
            // Dealer doesn't qualify → even money (2x).
            return amount * 2
        };
        // Dealer qualifies + player wins → even money + ante bonus by rank.
        if (player_rank == RANK_STRAIGHT_FLUSH) { amount * 6 }
        else if (player_rank == RANK_THREE_KIND) { amount * 5 }
        else if (player_rank == RANK_STRAIGHT)   { amount * 3 }
        else { amount * 2 } // HIGH_CARD, PAIR, FLUSH → even money (2x)
    }

    // ── Views ────────────────────────────────────────────────────────────────
    // (No persistent object; all results come from the event.)

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test_only]
    fun c3(a: u8, b: u8, c: u8): vector<u8> { vector[a, b, c] }

    #[test]
    fun test_evaluate_straight_flush_3() {
        // 2-3-4 all spades (suit 0): indices 1,2,3
        assert!(evaluate_three(&c3(1, 2, 3)) == RANK_STRAIGHT_FLUSH, 0);
    }

    #[test]
    fun test_evaluate_three_kind_3() {
        // Three Aces: rank 0 across suits: 0, 13, 26
        assert!(evaluate_three(&c3(0, 13, 26)) == RANK_THREE_KIND, 0);
    }

    #[test]
    fun test_evaluate_straight_3() {
        // 7-8-9 mixed suits: 6(spades), 21(hearts=8), 9(spades) — ranks 6,8,9? Let me check:
        // 6%13=6(7), 21%13=8(9), 9%13=9(10) — that's 7,9,10 not consecutive.
        // Use: rank 5,6,7 → indices 5(suit0,r5), 19(suit1,r6), 7(suit0,r7)
        // suits: 5/13=0, 19/13=1, 7/13=0 — not all same → straight not flush
        assert!(evaluate_three(&c3(5, 19, 7)) == RANK_STRAIGHT, 0);
    }

    #[test]
    fun test_evaluate_broadway_straight() {
        // Q-K-A mixed suits: Q=11(suit0), K=25(suit1 → 25%13=12), A=26(suit2 → 26%13=0)
        // sorted ranks: 0,11,12 → broadway straight
        // suits: 11/13=0, 25/13=1, 26/13=2 — not all same
        assert!(evaluate_three(&c3(11, 25, 26)) == RANK_STRAIGHT, 0);
    }

    #[test]
    fun test_evaluate_flush_3() {
        // A-3-7 all hearts (suit 1): 13(A),15(3),19(7) → ranks 0,2,6 — not consecutive
        assert!(evaluate_three(&c3(13, 15, 19)) == RANK_FLUSH, 0);
    }

    #[test]
    fun test_evaluate_pair_3() {
        // Pair of Kings (12, 25) + 3 (2)
        assert!(evaluate_three(&c3(12, 25, 2)) == RANK_PAIR, 0);
    }

    #[test]
    fun test_evaluate_high_card_3() {
        // 2-5-9 mixed suits, not straight, not flush: 1(suit0,r1), 4(suit0,r4), 22(suit1,r9)
        // Wait, 1/13=0 and 4/13=0 and 22/13=1 — only two same suit so not flush
        // ranks: 1,4,9 → not consecutive → high card
        assert!(evaluate_three(&c3(1, 4, 22)) == RANK_HIGH_CARD, 0);
    }

    #[test]
    fun test_dealer_qualifies_logic() {
        // Pair or better → always qualifies
        assert!(dealer_qualifies(RANK_PAIR, 5) == true, 0);
        assert!(dealer_qualifies(RANK_FLUSH, 7) == true, 1);
        assert!(dealer_qualifies(RANK_STRAIGHT_FLUSH, 0) == true, 2);
        // High card with Queen (high=11) → qualifies
        assert!(dealer_qualifies(RANK_HIGH_CARD, 11) == true, 3);
        // High card with King (high=12) → qualifies
        assert!(dealer_qualifies(RANK_HIGH_CARD, 12) == true, 4);
        // High card with Ace (high=13) → qualifies
        assert!(dealer_qualifies(RANK_HIGH_CARD, 13) == true, 5);
        // High card with Jack (high=10) → does NOT qualify
        assert!(dealer_qualifies(RANK_HIGH_CARD, 10) == false, 6);
        // High card with 2 → does NOT qualify
        assert!(dealer_qualifies(RANK_HIGH_CARD, 2) == false, 7);
    }

    #[test]
    fun test_payout_scenarios() {
        // Lose → 0
        assert!(payout_for(100, RANK_HIGH_CARD, RESULT_LOSE, true) == 0, 0);
        assert!(payout_for(100, RANK_STRAIGHT_FLUSH, RESULT_LOSE, false) == 0, 1);
        // Push → return ante
        assert!(payout_for(100, RANK_PAIR, RESULT_PUSH, true) == 100, 2);
        // Win, dealer doesn't qualify → 2x regardless of player rank
        assert!(payout_for(100, RANK_STRAIGHT_FLUSH, RESULT_WIN, false) == 200, 3);
        assert!(payout_for(100, RANK_HIGH_CARD, RESULT_WIN, false) == 200, 4);
        // Win, dealer qualifies, by rank:
        assert!(payout_for(100, RANK_HIGH_CARD, RESULT_WIN, true) == 200, 5);      // 2x
        assert!(payout_for(100, RANK_PAIR, RESULT_WIN, true) == 200, 6);           // 2x
        assert!(payout_for(100, RANK_FLUSH, RESULT_WIN, true) == 200, 7);          // 2x
        assert!(payout_for(100, RANK_STRAIGHT, RESULT_WIN, true) == 300, 8);       // 3x
        assert!(payout_for(100, RANK_THREE_KIND, RESULT_WIN, true) == 500, 9);     // 5x
        assert!(payout_for(100, RANK_STRAIGHT_FLUSH, RESULT_WIN, true) == 600, 10); // 6x
    }

    #[test]
    fun test_play_full_flow() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(100_000_000, ctx);
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

    #[test]
    fun test_high_card_rank_fn() {
        // Ace (rank 0) maps to 13
        let h = c3(0, 1, 2);
        assert!(high_card_rank(&h) == 13, 0);
        // King (rank 12) maps to 12
        let h2 = c3(12, 1, 2);
        assert!(high_card_rank(&h2) == 12, 1);
        // Jack (rank 10) maps to 10
        let h3 = c3(10, 1, 2);
        assert!(high_card_rank(&h3) == 10, 2);
    }
}
