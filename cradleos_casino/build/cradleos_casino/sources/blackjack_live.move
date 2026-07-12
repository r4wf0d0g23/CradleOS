/// CradleOS Casino — Interactive Blackjack (commit-reveal, real hit/stand/double)
///
/// This is the player-facing flagship: real Hit / Stand / Double buttons where
/// the player genuinely reacts to each card, exactly like a physical casino —
/// while remaining provably fair and unexploitable.
///
/// HOW IT STAYS FAIR (the whole trick):
///   Randomness is consumed EXACTLY ONCE, in `deal` (Tx1). `deal` shuffles a full
///   52-card deck with the on-chain randomness beacon and stores the ENTIRE
///   shuffled order inside a player-owned `Hand` object, but the UI only shows
///   the player's two cards + the dealer's upcard. Every later action
///   (hit/stand/double) just advances a cursor over that already-fixed deck — it
///   consumes NO new randomness, so:
///     • Those actions can be normal `public` functions (no Random arg), and
///     • A player cannot "test-and-abort" for a better card: the next card is
///       already committed in the deck order. Aborting a hit tx changes nothing;
///       re-submitting draws the identical next card.
///   The dealer's hole card and draws are likewise pre-committed, so the house
///   cannot cheat either. The full deck is revealed in the settlement event, so
///   anyone can verify the whole hand was played from one honest shuffle.
///
/// PAYOUTS (gross, includes returned stake on a win):
///   Natural blackjack (2-card 21) ... 2.5x   (3:2)
///   Regular win ...................... 2.0x
///   Push ............................. 1.0x
///   Loss / bust ...................... 0.0x
///   Double down: stake is doubled (second equal stake escrowed), then exactly
///   one card is drawn and the player stands; win pays 2.0x the doubled stake.
module cradleos_casino::blackjack_live {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    // ── Errors ─────────────────────────────────────────────────────────────
    const ENotHandOwner:   u64 = 0;
    const EHandFinished:    u64 = 1;
    const EAlreadyActed:    u64 = 2;   // can't double after hitting
    const EWrongHouse:      u64 = 3;
    const EDoubleStakeMismatch: u64 = 4;
    const ENotAPair:        u64 = 5;   // split requires two cards of the same rank
    const ESplitStakeMismatch: u64 = 6;

    // ── Tuning ─────────────────────────────────────────────────────────────
    const DEALER_STANDS_ON: u8 = 17;

    // Outcome codes (mirror blackjack.move + frontend)
    const OUT_LOSS: u8 = 0;
    const OUT_PUSH: u8 = 1;
    const OUT_WIN: u8 = 2;
    const OUT_BLACKJACK: u8 = 3;

    // Hand status
    const STATUS_PLAYER_TURN: u8 = 0;
    const STATUS_SETTLED: u8 = 1;

    // ── Hand (player-owned, holds escrowed stake + committed deck) ────────────
    public struct Hand<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        /// Full shuffled deck, fixed at deal time. Revealed at settlement.
        deck: vector<u8>,
        /// Next card to draw.
        cursor: u64,
        player_cards: vector<u8>,
        dealer_cards: vector<u8>,
        /// Escrowed player stake (base + double). Paid to house or refunded+won.
        stake: Balance<T>,
        base_wager: u64,
        doubled: bool,
        has_hit: bool,
        status: u8,
    }

    // ── SplitHand (added in v3 — NEW struct, upgrade-compatible) ──────────
    // Created by `split` from a 2-card same-rank Hand. Play proceeds hand A
    // then hand B (active: 0 → 1), then the dealer plays once and both hands
    // settle together in a single SplitSettled event.
    public struct SplitHand<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        deck: vector<u8>,
        cursor: u64,
        hand_a: vector<u8>,
        hand_b: vector<u8>,
        dealer_cards: vector<u8>,
        /// Escrow for BOTH hands (2 × base_wager).
        stake: Balance<T>,
        /// Per-hand wager.
        base_wager: u64,
        /// 0 = playing hand A, 1 = playing hand B.
        active: u8,
        status: u8,
    }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct HandDealt has copy, drop {
        hand_id: ID,
        house_id: ID,
        player: address,
        wager: u64,
        player_cards: vector<u8>,   // both player cards (revealed)
        dealer_upcard: u8,          // only the dealer's first card
        player_total: u8,
    }

    public struct HandSplit has copy, drop {
        split_id: ID,
        house_id: ID,
        player: address,
        wager: u64,               // per-hand stake (total escrow = 2x)
        hand_a: vector<u8>,       // both cards of hand A (revealed)
        hand_b: vector<u8>,       // both cards of hand B (revealed)
        dealer_upcard: u8,
    }

    public struct SplitSettled has copy, drop {
        split_id: ID,
        house_id: ID,
        player: address,
        wager: u64,               // total staked (2 × per-hand)
        deck: vector<u8>,         // FULL deck — provably-fair audit
        hand_a: vector<u8>,
        hand_b: vector<u8>,
        dealer_cards: vector<u8>,
        total_a: u8,
        total_b: u8,
        dealer_total: u8,
        outcome_a: u8,
        outcome_b: u8,
        payout: u64,              // combined payout for both hands
    }

    public struct HandSettled has copy, drop {
        hand_id: ID,
        house_id: ID,
        player: address,
        wager: u64,                 // total staked (2x if doubled)
        deck: vector<u8>,           // FULL deck — provably-fair audit
        player_cards: vector<u8>,
        dealer_cards: vector<u8>,
        player_total: u8,
        dealer_total: u8,
        doubled: bool,
        outcome: u8,
        payout: u64,
    }

    // ── Tx1: deal (consumes randomness ONCE) ──────────────────────────────────
    // MUST be `entry` + non-public (consumes &Random).
    entry fun deal<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        // Escrow the stake inside the Hand (NOT yet in the bank — settled later).
        let stake = coin::into_balance(wager);

        let mut generator = random::new_generator(r, ctx);
        let mut deck = build_deck();
        random::shuffle(&mut generator, &mut deck);

        let mut cursor: u64 = 0;
        let mut player_cards = vector::empty<u8>();
        let mut dealer_cards = vector::empty<u8>();
        vector::push_back(&mut player_cards, take(&deck, &mut cursor));
        vector::push_back(&mut dealer_cards, take(&deck, &mut cursor));
        vector::push_back(&mut player_cards, take(&deck, &mut cursor));
        vector::push_back(&mut dealer_cards, take(&deck, &mut cursor)); // hole card (committed, hidden in UI)

        let player_total = hand_total(&player_cards);
        let hand = Hand<T> {
            id: object::new(ctx),
            house_id: object::id(house),
            player,
            deck,
            cursor,
            player_cards,
            dealer_cards,
            stake,
            base_wager: amount,
            doubled: false,
            has_hit: false,
            status: STATUS_PLAYER_TURN,
        };

        event::emit(HandDealt {
            hand_id: object::id(&hand),
            house_id: object::id(house),
            player,
            wager: amount,
            player_cards: hand.player_cards,
            dealer_upcard: *vector::borrow(&hand.dealer_cards, 0),
            player_total,
        });

        // Natural blackjack: auto-resolve immediately for good UX.
        if (player_total == 21) {
            settle(house, hand, ctx);
        } else {
            transfer::transfer(hand, player);
        }
    }

    // ── Tx2 actions (public, no randomness → safe & composable) ───────────────

    /// Draw one card. If it busts or hits 21, the hand auto-settles.
    public fun hit<T>(house: &mut House<T>, mut hand: Hand<T>, ctx: &mut TxContext) {
        assert_active(&hand, ctx);
        hand.has_hit = true;
        let c = take(&hand.deck, &mut hand.cursor);
        vector::push_back(&mut hand.player_cards, c);
        let total = hand_total(&hand.player_cards);
        if (total >= 21) {
            settle(house, hand, ctx); // bust or 21 → resolve
        } else {
            transfer::transfer(hand, tx_context::sender(ctx));
        }
    }

    /// Stand — dealer plays, hand settles.
    public fun stand<T>(house: &mut House<T>, hand: Hand<T>, ctx: &mut TxContext) {
        assert_active(&hand, ctx);
        settle(house, hand, ctx);
    }

    /// Double down — only as the FIRST action (before any hit). Player adds an
    /// equal stake, draws exactly one card, then the dealer plays and it settles.
    public fun double<T>(
        house: &mut House<T>,
        mut hand: Hand<T>,
        extra: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert_active(&hand, ctx);
        assert!(!hand.has_hit, EAlreadyActed);
        assert!(coin::value(&extra) == hand.base_wager, EDoubleStakeMismatch);
        balance::join(&mut hand.stake, coin::into_balance(extra));
        hand.doubled = true;
        let c = take(&hand.deck, &mut hand.cursor);
        vector::push_back(&mut hand.player_cards, c);
        settle(house, hand, ctx);
    }

    // ── Split (added in v3) ────────────────────────────────────────────────

    /// Split a same-rank pair into two hands. First action only (no hit, no
    /// double yet). Player posts an equal extra stake. Each hand immediately
    /// draws its second card from the committed deck — no new randomness.
    /// Split aces follow the standard one-card-each rule and settle at once.
    /// Post-split 21 is NOT a natural (pays 2:1, never 2.5x).
    public fun split<T>(
        house: &mut House<T>,
        hand: Hand<T>,
        extra: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert_active(&hand, ctx);
        assert!(!hand.has_hit && !hand.doubled, EAlreadyActed);
        assert!(coin::value(&extra) == hand.base_wager, ESplitStakeMismatch);
        let c0 = *vector::borrow(&hand.player_cards, 0);
        let c1 = *vector::borrow(&hand.player_cards, 1);
        assert!(c0 % 13 == c1 % 13, ENotAPair);

        let Hand {
            id, house_id, player, deck, mut cursor,
            player_cards: _, dealer_cards, mut stake, base_wager,
            doubled: _, has_hit: _, status: _,
        } = hand;
        object::delete(id);
        balance::join(&mut stake, coin::into_balance(extra));

        let is_aces = c0 % 13 == 0;
        let mut hand_a = vector::empty<u8>();
        let mut hand_b = vector::empty<u8>();
        vector::push_back(&mut hand_a, c0);
        vector::push_back(&mut hand_a, take(&deck, &mut cursor));
        vector::push_back(&mut hand_b, c1);
        vector::push_back(&mut hand_b, take(&deck, &mut cursor));

        let sh = SplitHand<T> {
            id: object::new(ctx),
            house_id,
            player,
            deck,
            cursor,
            hand_a,
            hand_b,
            dealer_cards,
            stake,
            base_wager,
            active: 0,
            status: STATUS_PLAYER_TURN,
        };

        event::emit(HandSplit {
            split_id: object::id(&sh),
            house_id,
            player,
            wager: base_wager,
            hand_a: sh.hand_a,
            hand_b: sh.hand_b,
            dealer_upcard: *vector::borrow(&sh.dealer_cards, 0),
        });

        if (is_aces) {
            // Standard rule: split aces get exactly one card each, then stand.
            settle_split(house, sh, ctx);
        } else {
            advance_or_transfer(house, sh, ctx);
        }
    }

    /// Hit the currently-active split hand. Auto-advances to hand B (or to
    /// settlement) on bust/21.
    public fun split_hit<T>(house: &mut House<T>, mut sh: SplitHand<T>, ctx: &mut TxContext) {
        assert_split_active(&sh, ctx);
        let c = take(&sh.deck, &mut sh.cursor);
        if (sh.active == 0) {
            vector::push_back(&mut sh.hand_a, c);
            if (hand_total(&sh.hand_a) >= 21) { sh.active = 1; advance_or_transfer(house, sh, ctx); }
            else { transfer::transfer(sh, tx_context::sender(ctx)); }
        } else {
            vector::push_back(&mut sh.hand_b, c);
            if (hand_total(&sh.hand_b) >= 21) { settle_split(house, sh, ctx); }
            else { transfer::transfer(sh, tx_context::sender(ctx)); }
        }
    }

    /// Stand on the currently-active split hand.
    public fun split_stand<T>(house: &mut House<T>, mut sh: SplitHand<T>, ctx: &mut TxContext) {
        assert_split_active(&sh, ctx);
        if (sh.active == 0) { sh.active = 1; advance_or_transfer(house, sh, ctx); }
        else { settle_split(house, sh, ctx); }
    }

    /// Advance play: skip past any hand already at 21+, settle when both are
    /// done, otherwise return the object to the player. (No recursion — the
    /// Move verifier rejects recursive functions.)
    fun advance_or_transfer<T>(house: &mut House<T>, mut sh: SplitHand<T>, ctx: &mut TxContext) {
        if (sh.active == 0 && hand_total(&sh.hand_a) >= 21) {
            sh.active = 1;
        };
        if (sh.active == 1 && hand_total(&sh.hand_b) >= 21) {
            settle_split(house, sh, ctx);
        } else {
            transfer::transfer(sh, tx_context::sender(ctx));
        }
    }

    fun settle_split<T>(house: &mut House<T>, sh: SplitHand<T>, ctx: &mut TxContext) {
        let SplitHand {
            id, house_id, player, deck, mut cursor,
            hand_a, hand_b, mut dealer_cards, stake, base_wager,
            active: _, status: _,
        } = sh;
        assert!(house_id == object::id(house), EWrongHouse);

        let staked = balance::value(&stake);
        house::deposit_stake(house, stake);

        let total_a = hand_total(&hand_a);
        let total_b = hand_total(&hand_b);
        let bust_a = total_a > 21;
        let bust_b = total_b > 21;

        // Dealer plays once, only if at least one hand is still standing.
        let mut dealer_total = hand_total(&dealer_cards);
        if (!bust_a || !bust_b) {
            while (dealer_total < DEALER_STANDS_ON) {
                vector::push_back(&mut dealer_cards, take(&deck, &mut cursor));
                dealer_total = hand_total(&dealer_cards);
            };
        };
        let dealer_bust = dealer_total > 21;

        // Post-split hands are never naturals: plain total comparison, win 2x.
        let per_hand = base_wager;
        let (outcome_a, pay_a) = split_outcome(total_a, bust_a, dealer_total, dealer_bust, per_hand);
        let (outcome_b, pay_b) = split_outcome(total_b, bust_b, dealer_total, dealer_bust, per_hand);
        let payout = pay_a + pay_b;

        house::pay_winnings(house, payout, player, ctx);

        event::emit(SplitSettled {
            split_id: id.to_inner(),
            house_id,
            player,
            wager: staked,
            deck,
            hand_a,
            hand_b,
            dealer_cards,
            total_a,
            total_b,
            dealer_total,
            outcome_a,
            outcome_b,
            payout,
        });
        object::delete(id);
    }

    fun split_outcome(total: u8, bust: bool, dealer_total: u8, dealer_bust: bool, per_hand: u64): (u8, u64) {
        if (bust) { (OUT_LOSS, 0) }
        else if (dealer_bust || total > dealer_total) { (OUT_WIN, per_hand * 2) }
        else if (total == dealer_total) { (OUT_PUSH, per_hand) }
        else { (OUT_LOSS, 0) }
    }

    fun assert_split_active<T>(sh: &SplitHand<T>, ctx: &TxContext) {
        assert!(sh.player == tx_context::sender(ctx), ENotHandOwner);
        assert!(sh.status == STATUS_PLAYER_TURN, EHandFinished);
    }

    // ── Settlement ─────────────────────────────────────────────────────────
    fun settle<T>(house: &mut House<T>, hand: Hand<T>, ctx: &mut TxContext) {
        let Hand {
            id, house_id, player, deck, mut cursor,
            player_cards, mut dealer_cards, stake, base_wager, doubled, has_hit: _, status: _,
        } = hand;
        assert!(house_id == object::id(house), EWrongHouse);

        let staked = balance::value(&stake);
        // Move the escrowed stake into the bank first (house takes the wager).
        house::deposit_stake(house, stake);

        let player_total = hand_total(&player_cards);
        let player_bust = player_total > 21;
        let player_natural = vector::length(&player_cards) == 2 && player_total == 21;

        // Dealer draws from the same committed deck (only if player didn't bust).
        let mut dealer_total = hand_total(&dealer_cards);
        if (!player_bust) {
            while (dealer_total < DEALER_STANDS_ON) {
                vector::push_back(&mut dealer_cards, take(&deck, &mut cursor));
                dealer_total = hand_total(&dealer_cards);
            };
        };
        let dealer_bust = dealer_total > 21;
        let dealer_natural = vector::length(&dealer_cards) == 2 && dealer_total == 21;

        let (outcome, payout) = if (player_bust) {
            (OUT_LOSS, 0)
        } else if (player_natural && dealer_natural) {
            (OUT_PUSH, staked)
        } else if (player_natural) {
            (OUT_BLACKJACK, staked + (staked * 3) / 2)   // 2.5x (double can't natural)
        } else if (dealer_natural) {
            (OUT_LOSS, 0)
        } else if (dealer_bust || player_total > dealer_total) {
            (OUT_WIN, staked * 2)
        } else if (player_total == dealer_total) {
            (OUT_PUSH, staked)
        } else {
            (OUT_LOSS, 0)
        };

        house::pay_winnings(house, payout, player, ctx);

        event::emit(HandSettled {
            hand_id: id.to_inner(),
            house_id,
            player,
            wager: staked,
            deck,
            player_cards,
            dealer_cards,
            player_total,
            dealer_total,
            doubled,
            outcome,
            payout,
        });
        let _ = base_wager;
        object::delete(id);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    fun build_deck(): vector<u8> {
        let mut deck = vector::empty<u8>();
        let mut i: u8 = 0;
        while (i < 52) { vector::push_back(&mut deck, i); i = i + 1; };
        deck
    }
    fun take(deck: &vector<u8>, cursor: &mut u64): u8 {
        let c = *vector::borrow(deck, *cursor);
        *cursor = *cursor + 1;
        c
    }
    fun hand_total(cards: &vector<u8>): u8 {
        let mut total: u16 = 0;
        let mut aces: u16 = 0;
        let n = vector::length(cards);
        let mut i = 0;
        while (i < n) {
            let rank = (*vector::borrow(cards, i)) % 13;
            let v: u16 = if (rank == 0) { aces = aces + 1; 11 }
                else if (rank >= 9) { 10 }
                else { (rank as u16) + 1 };
            total = total + v;
            i = i + 1;
        };
        while (total > 21 && aces > 0) { total = total - 10; aces = aces - 1; };
        (total as u8)
    }
    fun assert_active<T>(hand: &Hand<T>, ctx: &TxContext) {
        assert!(hand.player == tx_context::sender(ctx), ENotHandOwner);
        assert!(hand.status == STATUS_PLAYER_TURN, EHandFinished);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    public fun hand_player<T>(h: &Hand<T>): address { h.player }
    public fun hand_wager<T>(h: &Hand<T>): u64 { h.base_wager }
    public fun hand_player_cards<T>(h: &Hand<T>): vector<u8> { h.player_cards }
    public fun split_hand_player<T>(s: &SplitHand<T>): address { s.player }
    public fun split_hand_a<T>(s: &SplitHand<T>): vector<u8> { s.hand_a }
    public fun split_hand_b<T>(s: &SplitHand<T>): vector<u8> { s.hand_b }
    public fun split_hand_active<T>(s: &SplitHand<T>): u8 { s.active }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    /// Test-only Hand with a crafted (unshuffled) deck — deals the first 4
    /// cards exactly like `deal` does, skipping randomness + wager validation.
    #[test_only]
    public fun hand_for_testing<T>(
        house: &House<T>,
        deck: vector<u8>,
        stake: Coin<T>,
        ctx: &mut TxContext,
    ): Hand<T> {
        let mut cursor: u64 = 0;
        let mut player_cards = vector::empty<u8>();
        let mut dealer_cards = vector::empty<u8>();
        vector::push_back(&mut player_cards, take(&deck, &mut cursor));
        vector::push_back(&mut dealer_cards, take(&deck, &mut cursor));
        vector::push_back(&mut player_cards, take(&deck, &mut cursor));
        vector::push_back(&mut dealer_cards, take(&deck, &mut cursor));
        let amount = coin::value(&stake);
        Hand<T> {
            id: object::new(ctx),
            house_id: object::id(house),
            player: tx_context::sender(ctx),
            deck,
            cursor,
            player_cards,
            dealer_cards,
            stake: coin::into_balance(stake),
            base_wager: amount,
            doubled: false,
            has_hit: false,
            status: STATUS_PLAYER_TURN,
        }
    }

    #[test]
    fun test_deal_then_stand() {
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
            deal<SUI>(&mut house, &r, bet, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        // Player either got a natural (already settled) or holds a Hand — if the
        // latter, stand to settle.
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            if (test_scenario::has_most_recent_for_sender<Hand<SUI>>(&sc)) {
                let hand = test_scenario::take_from_sender<Hand<SUI>>(&sc);
                let ctx = test_scenario::ctx(&mut sc);
                stand<SUI>(&mut house, hand, ctx);
            };
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_split_pair_play_both_hands() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        // Crafted deck (rank = c % 13, ace=0):
        //   deal:  player [7, 20]  = pair of 8s;  dealer [9, 22] = 10+10 = 20
        //   split: hand_a draws 5 (6) -> 14;  hand_b draws 18 (6) -> 14
        //   hit A: draws 25 (K=10) -> 24 BUST -> auto-advance to hand B
        //   stand B: dealer already 20, stands. A loss, B 14<20 loss. payout 0.
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let deck = vector[7, 9, 20, 22, 5, 18, 25, 1, 2, 3];
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            let hand = hand_for_testing<SUI>(&house, deck, bet, ctx);
            let extra = coin::mint_for_testing<SUI>(100, ctx);
            split<SUI>(&mut house, hand, extra, ctx);
            test_scenario::return_shared(house);
        };
        // Player holds a SplitHand (A=14 live). Hit hand A -> busts -> advances.
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let sh = test_scenario::take_from_sender<SplitHand<SUI>>(&sc);
            assert!(split_hand_active(&sh) == 0, 100);
            let ctx = test_scenario::ctx(&mut sc);
            split_hit<SUI>(&mut house, sh, ctx);
            test_scenario::return_shared(house);
        };
        // Hand A busted; object returned with hand B active. Stand -> settles.
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let sh = test_scenario::take_from_sender<SplitHand<SUI>>(&sc);
            assert!(split_hand_active(&sh) == 1, 101);
            let ctx = test_scenario::ctx(&mut sc);
            split_stand<SUI>(&mut house, sh, ctx);
            assert!(house::bets_settled(&house) == 1, 102);
            test_scenario::return_shared(house);
        };
        // Both stakes lost -> no SplitHand remains for the player.
        test_scenario::next_tx(&mut sc, player);
        {
            assert!(!test_scenario::has_most_recent_for_sender<SplitHand<SUI>>(&sc), 103);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_split_aces_auto_settles() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        // player [0, 13] = pair of ACES; dealer [9, 22] = 20.
        // split aces: one card each (5 -> A+6=17, 18 -> A+6=17), auto-settle.
        // dealer 20 beats both -> payout 0, single settle event, no object left.
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let deck = vector[0, 9, 13, 22, 5, 18, 1, 2, 3];
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            let hand = hand_for_testing<SUI>(&house, deck, bet, ctx);
            let extra = coin::mint_for_testing<SUI>(100, ctx);
            split<SUI>(&mut house, hand, extra, ctx);
            assert!(house::bets_settled(&house) == 1, 200);
            test_scenario::return_shared(house);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            assert!(!test_scenario::has_most_recent_for_sender<SplitHand<SUI>>(&sc), 201);
        };
        test_scenario::end(sc);
    }
}
