/// CradleOS Casino — Video Poker (Jacks-or-Better, commit-reveal)
///
/// FLOW:
///   Tx1: `deal` — consumes &Random ONCE, shuffles a 52-card deck, deals 5 cards,
///        stores the full deck + cursor=5 in a player-owned VideoPokerHand<T>.
///   Tx2: `draw` — player passes a hold_mask (bit i set = keep card i).
///        Replaces non-held cards from the committed deck, evaluates the final
///        5-card hand, settles, deletes the hand object.
///
/// WHY IT STAYS FAIR (same commit-reveal trick as blackjack_live / mines):
///   All randomness is consumed in `deal`. `draw` is a normal public entry fn
///   with no Random arg — the replacement cards are already committed, so
///   aborting and retrying gives the same result.
///
/// PAYOUTS (GROSS multiplier bps, 10000 = 1x return of stake):
///   RANK 0  HIGH_CARD / pair below Jacks  →    0 (loss)
///   RANK 1  JACKS_OR_BETTER               → 10000 (1x, return stake)
///   RANK 2  TWO_PAIR                      → 20000 (2x)
///   RANK 3  THREE_KIND                    → 30000 (3x)
///   RANK 4  STRAIGHT                      → 40000 (4x)
///   RANK 5  FLUSH                         → 50000 (5x)
///   RANK 6  FULL_HOUSE                    → 70000 (7x)
///   RANK 7  FOUR_KIND                     → 200000 (20x)
///   RANK 8  STRAIGHT_FLUSH               → 500000 (50x)
///   RANK 9  ROYAL_FLUSH                  → 2500000 (250x)
///
/// Card encoding: index 0..51; rank = index % 13 (0=Ace..12=King); suit = index / 13.
/// "Jacks or Better" pair: ranks {0(Ace), 10(Jack), 11(Queen), 12(King)}.
module cradleos_casino::video_poker {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    // ── Errors ────────────────────────────────────────────────────────────────
    const ENotHandOwner: u64 = 0;
    const EMaxExposure:  u64 = 1;
    const EWrongHouse:   u64 = 2;
    /// Game disabled on-chain (v23, 2026-07-12): the full 52-card deck committed
    /// at deal time lives in the player-owned VideoPokerHand object, readable via
    /// sui_getObject BEFORE the draw — the player can see which cards will replace
    /// non-held cards and hold optimally every time (near-100% RTP). New deals
    /// blocked until a commit-reveal redesign ships. draw stays open so an
    /// in-flight hand can still settle.
    const EGameDisabled: u64 = 3;

    // ── Tuning ────────────────────────────────────────────────────────────────
    /// Max gross multiplier (x) for exposure guard: royal flush = 250x.
    const MAX_MULT_X: u64 = 250;

    // ── Hand rank constants ──────────────────────────────────────────────────
    const RANK_LOSS:           u8 = 0;
    const RANK_JACKS_OR_BETTER: u8 = 1;
    const RANK_TWO_PAIR:       u8 = 2;
    const RANK_THREE_KIND:     u8 = 3;
    const RANK_STRAIGHT:       u8 = 4;
    const RANK_FLUSH:          u8 = 5;
    const RANK_FULL_HOUSE:     u8 = 6;
    const RANK_FOUR_KIND:      u8 = 7;
    const RANK_STRAIGHT_FLUSH: u8 = 8;
    const RANK_ROYAL_FLUSH:    u8 = 9;

    // ── Player-owned hand object ─────────────────────────────────────────────
    public struct VideoPokerHand<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        /// Full 52-card shuffled deck committed at deal time.
        deck: vector<u8>,
        /// Next card index to draw (starts at 5 after the initial deal).
        cursor: u64,
        /// The 5 currently-held card indices (0..51).
        cards: vector<u8>,
        /// Escrowed stake — moved into bank at settlement.
        stake: Balance<T>,
        wager: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────
    public struct VideoPokerDealt has copy, drop {
        hand_id: ID,
        house_id: ID,
        player: address,
        wager: u64,
        /// Card indices 0..51 for the initial 5 dealt cards.
        cards: vector<u8>,
    }

    public struct VideoPokerSettled has copy, drop {
        hand_id: ID,
        house_id: ID,
        player: address,
        wager: u64,
        final_cards: vector<u8>,
        hand_rank: u8,
        multiplier_bps: u64,
        payout: u64,
    }

    // ── Tx1: deal (consumes &Random ONCE) ────────────────────────────────────
    entry fun deal<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        // v23: video_poker deal is disabled on-chain (solution-leak exploit).
        // Abort before escrowing so no new hand is created. In-flight hands can
        // still draw to settle.
        assert!(false, EGameDisabled);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        // Exposure guard: royal flush = 250x gross payout.
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);

        // Escrow wager inside the hand object (NOT yet in the bank).
        let stake = coin::into_balance(wager);

        // Build and shuffle a 52-card deck.
        let mut deck: vector<u8> = vector[];
        let mut c = 0u8;
        while (c < 52) { vector::push_back(&mut deck, c); c = c + 1; };
        let mut g = random::new_generator(r, ctx);
        random::shuffle(&mut g, &mut deck);

        // Deal 5 cards.
        let mut cards: vector<u8> = vector[];
        let mut i = 0u64;
        while (i < 5) {
            vector::push_back(&mut cards, *vector::borrow(&deck, i));
            i = i + 1;
        };
        let cursor = 5u64;

        let hand = VideoPokerHand<T> {
            id: object::new(ctx),
            house_id: object::id(house),
            player,
            deck,
            cursor,
            cards,
            stake,
            wager: amount,
        };

        event::emit(VideoPokerDealt {
            hand_id: object::id(&hand),
            house_id: object::id(house),
            player,
            wager: amount,
            cards: hand.cards,
        });

        transfer::transfer(hand, player);
    }

    // ── Tx2: draw (public entry, no Random arg) ───────────────────────────────
    /// hold_mask: bit i (0..4) set means keep card i. Replace all others from
    /// the committed deck, then evaluate and settle.
    public entry fun draw<T>(
        house: &mut House<T>,
        hand: VideoPokerHand<T>,
        hold_mask: u8,
        ctx: &mut TxContext,
    ) {
        assert!(hand.player == tx_context::sender(ctx), ENotHandOwner);
        assert!(object::id(house) == hand.house_id, EWrongHouse);

        let VideoPokerHand { id, house_id, player, deck, mut cursor, mut cards, stake, wager } = hand;

        // Replace non-held cards.
        let mut i = 0u8;
        while (i < 5) {
            let keep = (hold_mask >> i) & 1 == 1;
            if (!keep) {
                let replacement = *vector::borrow(&deck, cursor);
                cursor = cursor + 1;
                *vector::borrow_mut(&mut cards, i as u64) = replacement;
            };
            i = i + 1;
        };

        // Evaluate final hand.
        let hand_rank = evaluate_hand(&cards);
        let multiplier_bps = multiplier_for(hand_rank);
        let payout = ((wager as u128) * (multiplier_bps as u128) / 10000) as u64;

        // Settle: deposit stake into bank, pay winnings.
        house::deposit_stake(house, stake);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(VideoPokerSettled {
            hand_id: object::uid_to_inner(&id),
            house_id,
            player,
            wager,
            final_cards: cards,
            hand_rank,
            multiplier_bps,
            payout,
        });

        object::delete(id);
    }

    // ── Pure helpers ─────────────────────────────────────────────────────────

    /// Evaluate a 5-card hand (card indices 0..51). Returns hand rank u8.
    public fun evaluate_hand(cards: &vector<u8>): u8 {
        // Extract ranks (0..12) and suits (0..3).
        let r0 = (*vector::borrow(cards, 0)) % 13;
        let r1 = (*vector::borrow(cards, 1)) % 13;
        let r2 = (*vector::borrow(cards, 2)) % 13;
        let r3 = (*vector::borrow(cards, 3)) % 13;
        let r4 = (*vector::borrow(cards, 4)) % 13;

        let s0 = (*vector::borrow(cards, 0)) / 13;
        let s1 = (*vector::borrow(cards, 1)) / 13;
        let s2 = (*vector::borrow(cards, 2)) / 13;
        let s3 = (*vector::borrow(cards, 3)) / 13;
        let s4 = (*vector::borrow(cards, 4)) / 13;

        let is_flush = s0 == s1 && s1 == s2 && s2 == s3 && s3 == s4;

        // Count occurrences of each rank (0..12).
        let mut rank_counts: vector<u8> = vector[0,0,0,0,0,0,0,0,0,0,0,0,0];
        *vector::borrow_mut(&mut rank_counts, r0 as u64) = *vector::borrow(&rank_counts, r0 as u64) + 1;
        *vector::borrow_mut(&mut rank_counts, r1 as u64) = *vector::borrow(&rank_counts, r1 as u64) + 1;
        *vector::borrow_mut(&mut rank_counts, r2 as u64) = *vector::borrow(&rank_counts, r2 as u64) + 1;
        *vector::borrow_mut(&mut rank_counts, r3 as u64) = *vector::borrow(&rank_counts, r3 as u64) + 1;
        *vector::borrow_mut(&mut rank_counts, r4 as u64) = *vector::borrow(&rank_counts, r4 as u64) + 1;

        // Count pairs, trips, quads.
        let mut pairs = 0u8;
        let mut trips = 0u8;
        let mut quads = 0u8;
        let mut pair_rank = 0u8; // track rank of the first pair found
        let mut k = 0u64;
        while (k < 13) {
            let cnt = *vector::borrow(&rank_counts, k);
            if (cnt == 4) { quads = quads + 1; }
            else if (cnt == 3) { trips = trips + 1; }
            else if (cnt == 2) {
                if (pairs == 0) { pair_rank = k as u8; };
                pairs = pairs + 1;
            };
            k = k + 1;
        };

        // Check straight: sort ranks and look for 5 consecutive.
        // Also handle wheel straight: A-2-3-4-5 (ranks 0,1,2,3,4) and
        // broadway: 10-J-Q-K-A (ranks 0,9,10,11,12 since Ace=0).
        let is_straight = is_straight_check(r0, r1, r2, r3, r4);

        // Royal flush: straight flush with T-J-Q-K-A (ace=0, 9,10,11,12).
        // broadway straight: has ace(0) and king(12) and queen(11) and jack(10) and ten(9).
        let is_broadway = *vector::borrow(&rank_counts, 0) == 1 &&
                          *vector::borrow(&rank_counts, 9) == 1 &&
                          *vector::borrow(&rank_counts, 10) == 1 &&
                          *vector::borrow(&rank_counts, 11) == 1 &&
                          *vector::borrow(&rank_counts, 12) == 1;

        if (is_flush && is_straight) {
            if (is_broadway) { return RANK_ROYAL_FLUSH };
            return RANK_STRAIGHT_FLUSH
        };
        if (quads == 1) { return RANK_FOUR_KIND };
        if (trips == 1 && pairs == 1) { return RANK_FULL_HOUSE };
        if (is_flush) { return RANK_FLUSH };
        if (is_straight) { return RANK_STRAIGHT };
        if (trips == 1) { return RANK_THREE_KIND };
        if (pairs == 2) { return RANK_TWO_PAIR };
        if (pairs == 1) {
            // Jacks or better: pair of J(10), Q(11), K(12), or A(0).
            let pr = pair_rank;
            if (pr == 0 || pr == 10 || pr == 11 || pr == 12) {
                return RANK_JACKS_OR_BETTER
            };
        };
        RANK_LOSS
    }

    /// Check if 5 ranks form a straight (5 consecutive, with Ace high or low).
    fun is_straight_check(r0: u8, r1: u8, r2: u8, r3: u8, r4: u8): bool {
        // Sort via bubble sort on 5 values.
        let mut a = r0;
        let mut b = r1;
        let mut c = r2;
        let mut d = r3;
        let mut e = r4;

        // Simple sort network for 5 elements.
        if (a > b) { let tmp = a; a = b; b = tmp; };
        if (c > d) { let tmp = c; c = d; d = tmp; };
        if (a > c) { let tmp = a; a = c; c = tmp; };
        if (b > d) { let tmp = b; b = d; d = tmp; };
        if (a > b) { let tmp = a; a = b; b = tmp; };
        if (c > e) { let tmp = c; c = e; e = tmp; };
        if (b > c) { let tmp = b; b = c; c = tmp; };
        if (d > e) { let tmp = d; d = e; e = tmp; };
        if (c > d) { let tmp = c; c = d; d = tmp; };
        if (b > c) { let tmp = b; b = c; c = tmp; };
        if (d > e) { let tmp = d; d = e; e = tmp; };

        // Normal straight: each consecutive pair differs by 1.
        let normal = b == a + 1 && c == b + 1 && d == c + 1 && e == d + 1;
        // Wheel (A-2-3-4-5): sorted = [0,1,2,3,4].
        let wheel = a == 0 && b == 1 && c == 2 && d == 3 && e == 4;
        // Broadway (T-J-Q-K-A): sorted = [0,9,10,11,12] → normal won't match (9>1 gap).
        let broadway = a == 0 && b == 9 && c == 10 && d == 11 && e == 12;

        normal || wheel || broadway
    }

    /// Return the gross multiplier in bps (10000 = 1x) for a hand rank.
    public fun multiplier_for(rank: u8): u64 {
        if (rank == RANK_ROYAL_FLUSH)    { 2500000 }
        else if (rank == RANK_STRAIGHT_FLUSH) { 500000 }
        else if (rank == RANK_FOUR_KIND) { 200000 }
        else if (rank == RANK_FULL_HOUSE){ 70000 }
        else if (rank == RANK_FLUSH)     { 50000 }
        else if (rank == RANK_STRAIGHT)  { 40000 }
        else if (rank == RANK_THREE_KIND){ 30000 }
        else if (rank == RANK_TWO_PAIR)  { 20000 }
        else if (rank == RANK_JACKS_OR_BETTER) { 10000 }
        else { 0 }
    }

    // ── Views ────────────────────────────────────────────────────────────────
    public fun hand_player<T>(h: &VideoPokerHand<T>): address { h.player }
    public fun hand_wager<T>(h: &VideoPokerHand<T>): u64 { h.wager }
    public fun hand_cards<T>(h: &VideoPokerHand<T>): vector<u8> { h.cards }
    public fun hand_id_inner<T>(h: &VideoPokerHand<T>): ID { object::uid_to_inner(&h.id) }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    // Helper: build a 5-card hand from raw card indices.
    #[test_only]
    fun cards(a: u8, b: u8, c: u8, d: u8, e: u8): vector<u8> {
        vector[a, b, c, d, e]
    }

    #[test]
    fun test_evaluate_royal_flush() {
        // Ace of spades(0+39=39), 10s(9+39=48 → suit3), J(10+39=49), Q(11+39=50), K(12+39=51) all suit 3
        // suit = index/13: 39/13=3, 48/13=3, 49/13=3, 50/13=3, 51/13=3
        // rank: 39%13=0(A), 48%13=9(T), 49%13=10(J), 50%13=11(Q), 51%13=12(K)
        let h = cards(39, 48, 49, 50, 51);
        assert!(evaluate_hand(&h) == RANK_ROYAL_FLUSH, 0);
        assert!(multiplier_for(RANK_ROYAL_FLUSH) == 2500000, 1);
    }

    #[test]
    fun test_evaluate_straight_flush() {
        // 2-3-4-5-6 all clubs (suit 0): indices 1,2,3,4,5
        let h = cards(1, 2, 3, 4, 5);
        assert!(evaluate_hand(&h) == RANK_STRAIGHT_FLUSH, 0);
        assert!(multiplier_for(RANK_STRAIGHT_FLUSH) == 500000, 1);
    }

    #[test]
    fun test_evaluate_four_kind() {
        // Four Aces: ranks 0,13,26,39 (all suit 0-3, rank 0=Ace) + K of spades(51)
        let h = cards(0, 13, 26, 39, 51);
        assert!(evaluate_hand(&h) == RANK_FOUR_KIND, 0);
        assert!(multiplier_for(RANK_FOUR_KIND) == 200000, 1);
    }

    #[test]
    fun test_evaluate_full_house() {
        // Three Aces (0,13,26) + two Kings (12,25) → rank 0 x3, rank 12 x2
        let h = cards(0, 13, 26, 12, 25);
        assert!(evaluate_hand(&h) == RANK_FULL_HOUSE, 0);
        assert!(multiplier_for(RANK_FULL_HOUSE) == 70000, 1);
    }

    #[test]
    fun test_evaluate_flush() {
        // 5 hearts (suit 1, indices 13..25): A(13),3(15),5(17),7(19),9(21) — not a straight
        let h = cards(13, 15, 17, 19, 21);
        assert!(evaluate_hand(&h) == RANK_FLUSH, 0);
        assert!(multiplier_for(RANK_FLUSH) == 50000, 1);
    }

    #[test]
    fun test_evaluate_straight() {
        // 5-6-7-8-9 mixed suits: 4(spades),5(hearts=18),6(diamonds=32),7(clubs=7+13+13=33 → 6+13+13=32? let me use: 4,18,32,7,21)
        // Actually: rank = index % 13. index 4 → rank 4(5); 18 → 18%13=5(6); 32 → 32%13=6(7); 7 → 7%13=7(8); 21 → 21%13=8(9)
        // suits: 4/13=0, 18/13=1, 32/13=2, 7/13=0, 21/13=1 — not all same → straight not flush
        let h = cards(4, 18, 32, 7, 21);
        assert!(evaluate_hand(&h) == RANK_STRAIGHT, 0);
        assert!(multiplier_for(RANK_STRAIGHT) == 40000, 1);
    }

    #[test]
    fun test_evaluate_wheel_straight() {
        // A-2-3-4-5: ranks 0,1,2,3,4 mixed suits: 0(spades A), 14(hearts 2), 28(diamonds 3), 3(spades 4), 17(hearts 5)
        // ranks: 0%13=0, 14%13=1, 28%13=2, 3%13=3, 17%13=4 — suits: 0,1,2,0,1 not flush
        let h = cards(0, 14, 28, 3, 17);
        assert!(evaluate_hand(&h) == RANK_STRAIGHT, 0);
    }

    #[test]
    fun test_evaluate_three_kind() {
        // Three Kings (12, 25, 38) + 2 (1) + 5 (4)
        let h = cards(12, 25, 38, 1, 4);
        assert!(evaluate_hand(&h) == RANK_THREE_KIND, 0);
        assert!(multiplier_for(RANK_THREE_KIND) == 30000, 1);
    }

    #[test]
    fun test_evaluate_two_pair() {
        // Pair of Aces (0, 13) + Pair of Kings (12, 25) + 5 (4)
        let h = cards(0, 13, 12, 25, 4);
        assert!(evaluate_hand(&h) == RANK_TWO_PAIR, 0);
        assert!(multiplier_for(RANK_TWO_PAIR) == 20000, 1);
    }

    #[test]
    fun test_evaluate_jacks_or_better_jack() {
        // Pair of Jacks (10, 23) + 2,3,5 kickers
        let h = cards(10, 23, 1, 2, 4);
        assert!(evaluate_hand(&h) == RANK_JACKS_OR_BETTER, 0);
        assert!(multiplier_for(RANK_JACKS_OR_BETTER) == 10000, 1);
    }

    #[test]
    fun test_evaluate_jacks_or_better_queen() {
        // Pair of Queens (11, 24)
        let h = cards(11, 24, 1, 3, 5);
        assert!(evaluate_hand(&h) == RANK_JACKS_OR_BETTER, 0);
    }

    #[test]
    fun test_evaluate_jacks_or_better_king() {
        // Pair of Kings (12, 25)
        let h = cards(12, 25, 1, 3, 5);
        assert!(evaluate_hand(&h) == RANK_JACKS_OR_BETTER, 0);
    }

    #[test]
    fun test_evaluate_jacks_or_better_ace() {
        // Pair of Aces (0, 13) — Ace rank = 0, which is in the JOB set
        let h = cards(0, 13, 1, 3, 5);
        assert!(evaluate_hand(&h) == RANK_JACKS_OR_BETTER, 0);
    }

    #[test]
    fun test_evaluate_low_pair_loss() {
        // Pair of 2s (rank 1): indices 1, 14 — below jacks → LOSS
        let h = cards(1, 14, 2, 4, 6);
        assert!(evaluate_hand(&h) == RANK_LOSS, 0);
        assert!(multiplier_for(RANK_LOSS) == 0, 1);
    }

    #[test]
    fun test_evaluate_high_card_loss() {
        // No pair, no straight, no flush: ranks 0,2,4,6,8 mixed suits (but NOT straight 0,1,2,3,4)
        // index 0→rank0, 2→rank2, 4→rank4, 6→rank6, 8→rank8 all suit 0 — but all same suit → flush!
        // Use mixed suits: 0(suit0,r0), 15(suit1,r2), 30(suit2,r4), 6(suit0,r6), 21(suit1,r8)
        let h = cards(0, 15, 30, 6, 21);
        assert!(evaluate_hand(&h) == RANK_LOSS, 0);
    }

    #[test]
    fun test_multiplier_spot_checks() {
        assert!(multiplier_for(0) == 0, 0);
        assert!(multiplier_for(1) == 10000, 1);
        assert!(multiplier_for(9) == 2500000, 2);
    }

    // v23: deal is disabled on-chain (solution-leak). Confirms deal aborts
    // EGameDisabled before escrowing. Card-eval tests above (pure) still run.
    #[test]
    #[expected_failure(abort_code = EGameDisabled)]
    fun test_deal_draw_settle() {
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
        // Deal (aborts EGameDisabled)
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            deal<SUI>(&mut house, &r, bet, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        // Draw — hold all 5 cards (mask = 0b11111 = 31)
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let hand = test_scenario::take_from_sender<VideoPokerHand<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            // Hold all cards, evaluate whatever was dealt.
            draw<SUI>(&mut house, hand, 31u8, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }
}
