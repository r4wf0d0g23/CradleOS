/// CradleOS Casino — Interactive Blackjack (fresh-randomness, real hit/stand/double/split)
///
/// ── SECURITY REWRITE (v26, 2026-07-13) ─────────────────────────────────────
/// The prior design committed the ENTIRE shuffled deck into a player-owned
/// `Hand` object at deal time and let later `public` actions (hit/double/split)
/// advance a cursor over it with no new randomness. Because the player OWNS the
/// object, they could read the committed deck off-chain — including the dealer's
/// "hidden" hole card and every future draw — and only `double` when they could
/// see a guaranteed win. This drained the house (100% doubled-win rate).
///
/// THE FIX: NO future card is ever committed or knowable at a decision point.
///   • `deal` draws the player's two cards + the dealer's UPCARD ONLY, using the
///     on-chain randomness beacon. The dealer's hole card and every subsequent
///     card DO NOT EXIST YET — they are drawn fresh, from a NEW randomness
///     beacon, in the tx that actually needs them.
///   • Every player action that draws or reveals a card (`hit`, `double`,
///     `stand`, `split`, `split_hit`, `split_stand`) is now an `entry fun` that
///     consumes `&Random`. A fresh card cannot be predicted before the tx runs,
///     so "read state, then act only if it wins" is impossible.
///   • Randomness-consuming fns are `entry` + non-`public` per Sui security
///     guidance, so they cannot be wrapped in a PTB that inspects the result and
///     aborts on a loss ("test-and-abort"). Settlement (which draws the dealer's
///     cards) happens INSIDE the same tx as the player's terminal action, so the
///     player can never see the dealer's outcome before committing to it.
///
/// DECK MODEL: infinite deck (draw-with-replacement). Each card is an independent
///   uniform draw in [0,51]; rank = card % 13 (0=Ace..8=9, 9..12 = 10/J/Q/K),
///   suit is cosmetic. This is standard for provably-fair crypto blackjack, needs
///   no deck-state tracking, and its house edge is within a few hundredths of a
///   percent of a shoe game. No card is ever stored for future use, so nothing is
///   pre-committed — which is the whole point of the fix.
///
/// PAYOUTS (gross, includes returned stake on a win):
///   Natural blackjack (2-card 21) ... 2.5x   (3:2)
///   Regular win ...................... 2.0x
///   Push ............................. 1.0x
///   Loss / bust ...................... 0.0x
///   Double: doubled stake, exactly one card drawn, then stand; win pays 2.0x.
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

    // ── Hand (player-owned; holds escrowed stake + cards drawn SO FAR) ─────────
    // NOTE: this object stores ONLY cards already dealt (player cards + dealer
    // upcard). It contains NO deck and NO future cards — reading it off-chain
    // reveals nothing the player couldn't already see on the table. Every future
    // card is drawn fresh from `&Random` in the action tx that needs it.
    public struct Hand<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        player_cards: vector<u8>,
        /// Dealer's revealed cards so far — exactly ONE (the upcard) until settle.
        dealer_cards: vector<u8>,
        /// Escrowed player stake (base + double). Paid to house or refunded+won.
        stake: Balance<T>,
        base_wager: u64,
        doubled: bool,
        has_hit: bool,
        status: u8,
    }

    // ── SplitHand (two hands played sequentially) ──────────────────────────
    // Same principle: stores only cards dealt so far, never any future card.
    public struct SplitHand<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        hand_a: vector<u8>,
        hand_b: vector<u8>,
        dealer_cards: vector<u8>,   // dealer upcard only, until settle
        /// Escrow for BOTH hands (2 × base_wager).
        stake: Balance<T>,
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
        player_cards: vector<u8>,
        dealer_cards: vector<u8>,
        player_total: u8,
        dealer_total: u8,
        doubled: bool,
        outcome: u8,
        payout: u64,
    }

    // ── Tx1: deal (draws player cards + dealer upcard ONLY) ────────────────────
    // MUST be `entry` + non-public (consumes &Random).
    entry fun deal<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        let stake = coin::into_balance(wager);

        let mut generator = random::new_generator(r, ctx);
        let mut player_cards = vector::empty<u8>();
        let mut dealer_cards = vector::empty<u8>();
        // player card 1, dealer upcard, player card 2. Dealer hole card is NOT
        // drawn here — it does not exist until settlement draws it fresh.
        vector::push_back(&mut player_cards, draw_card(&mut generator));
        vector::push_back(&mut dealer_cards, draw_card(&mut generator)); // upcard
        vector::push_back(&mut player_cards, draw_card(&mut generator));

        let player_total = hand_total(&player_cards);
        let hand = Hand<T> {
            id: object::new(ctx),
            house_id: object::id(house),
            player,
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

        // Natural blackjack: auto-resolve immediately for good UX. Settlement
        // draws the dealer's hole card fresh from the same generator.
        if (player_total == 21) {
            settle(house, hand, &mut generator, ctx);
        } else {
            transfer::transfer(hand, player);
        }
    }

    // ── Tx2 actions (entry + &Random → each draws a FRESH card) ────────────────

    /// Draw one card (fresh randomness). If it busts or hits 21, auto-settles.
    entry fun hit<T>(house: &mut House<T>, r: &Random, mut hand: Hand<T>, ctx: &mut TxContext) {
        assert_active(&hand, ctx);
        hand.has_hit = true;
        let mut generator = random::new_generator(r, ctx);
        let c = draw_card(&mut generator);
        vector::push_back(&mut hand.player_cards, c);
        let total = hand_total(&hand.player_cards);
        if (total >= 21) {
            settle(house, hand, &mut generator, ctx); // bust or 21 → resolve
        } else {
            transfer::transfer(hand, tx_context::sender(ctx));
        }
    }

    /// Stand — dealer plays (fresh randomness), hand settles.
    entry fun stand<T>(house: &mut House<T>, r: &Random, hand: Hand<T>, ctx: &mut TxContext) {
        assert_active(&hand, ctx);
        let mut generator = random::new_generator(r, ctx);
        settle(house, hand, &mut generator, ctx);
    }

    /// Double down — first action only. Player adds an equal stake, draws exactly
    /// one FRESH card, then the dealer plays and it settles — all in this one tx,
    /// so the player commits the double BEFORE any future card is known.
    entry fun double<T>(
        house: &mut House<T>,
        r: &Random,
        mut hand: Hand<T>,
        extra: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert_active(&hand, ctx);
        assert!(!hand.has_hit, EAlreadyActed);
        assert!(coin::value(&extra) == hand.base_wager, EDoubleStakeMismatch);
        balance::join(&mut hand.stake, coin::into_balance(extra));
        hand.doubled = true;
        let mut generator = random::new_generator(r, ctx);
        let c = draw_card(&mut generator);
        vector::push_back(&mut hand.player_cards, c);
        settle(house, hand, &mut generator, ctx);
    }

    // ── Split ──────────────────────────────────────────────────────────────

    /// Split a same-rank pair into two hands. First action only. Each hand draws
    /// its second card FRESH from `&Random` in this tx. Split aces settle at once.
    entry fun split<T>(
        house: &mut House<T>,
        r: &Random,
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
            id, house_id, player,
            player_cards: _, dealer_cards, mut stake, base_wager,
            doubled: _, has_hit: _, status: _,
        } = hand;
        object::delete(id);
        balance::join(&mut stake, coin::into_balance(extra));

        let mut generator = random::new_generator(r, ctx);
        let is_aces = c0 % 13 == 0;
        let mut hand_a = vector::empty<u8>();
        let mut hand_b = vector::empty<u8>();
        vector::push_back(&mut hand_a, c0);
        vector::push_back(&mut hand_a, draw_card(&mut generator));
        vector::push_back(&mut hand_b, c1);
        vector::push_back(&mut hand_b, draw_card(&mut generator));

        let sh = SplitHand<T> {
            id: object::new(ctx),
            house_id,
            player,
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
            settle_split(house, sh, &mut generator, ctx);
        } else {
            advance_or_transfer(house, sh, &mut generator, ctx);
        }
    }

    /// Hit the currently-active split hand (fresh card). Auto-advances on bust/21.
    entry fun split_hit<T>(house: &mut House<T>, r: &Random, mut sh: SplitHand<T>, ctx: &mut TxContext) {
        assert_split_active(&sh, ctx);
        let mut generator = random::new_generator(r, ctx);
        let c = draw_card(&mut generator);
        if (sh.active == 0) {
            vector::push_back(&mut sh.hand_a, c);
            if (hand_total(&sh.hand_a) >= 21) { sh.active = 1; advance_or_transfer(house, sh, &mut generator, ctx); }
            else { transfer::transfer(sh, tx_context::sender(ctx)); }
        } else {
            vector::push_back(&mut sh.hand_b, c);
            if (hand_total(&sh.hand_b) >= 21) { settle_split(house, sh, &mut generator, ctx); }
            else { transfer::transfer(sh, tx_context::sender(ctx)); }
        }
    }

    /// Stand on the currently-active split hand.
    entry fun split_stand<T>(house: &mut House<T>, r: &Random, mut sh: SplitHand<T>, ctx: &mut TxContext) {
        assert_split_active(&sh, ctx);
        let mut generator = random::new_generator(r, ctx);
        if (sh.active == 0) { sh.active = 1; advance_or_transfer(house, sh, &mut generator, ctx); }
        else { settle_split(house, sh, &mut generator, ctx); }
    }

    /// Advance play: skip past any hand already at 21+, settle when both are
    /// done, otherwise return the object to the player. (No recursion.)
    fun advance_or_transfer<T>(
        house: &mut House<T>,
        mut sh: SplitHand<T>,
        generator: &mut random::RandomGenerator,
        ctx: &mut TxContext,
    ) {
        if (sh.active == 0 && hand_total(&sh.hand_a) >= 21) {
            sh.active = 1;
        };
        if (sh.active == 1 && hand_total(&sh.hand_b) >= 21) {
            settle_split(house, sh, generator, ctx);
        } else {
            transfer::transfer(sh, tx_context::sender(ctx));
        }
    }

    fun settle_split<T>(
        house: &mut House<T>,
        sh: SplitHand<T>,
        generator: &mut random::RandomGenerator,
        ctx: &mut TxContext,
    ) {
        let SplitHand {
            id, house_id, player,
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

        // Dealer draws its hole card + hits to 17, fresh randomness, only if at
        // least one hand is still standing.
        let mut dealer_total = hand_total(&dealer_cards);
        if (!bust_a || !bust_b) {
            vector::push_back(&mut dealer_cards, draw_card(generator)); // hole card
            dealer_total = hand_total(&dealer_cards);
            while (dealer_total < DEALER_STANDS_ON) {
                vector::push_back(&mut dealer_cards, draw_card(generator));
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
    // Draws the dealer's hole card + hits fresh from `generator`. Runs in the
    // SAME tx as the player's terminal action, so the player commits before
    // seeing any of it.
    fun settle<T>(
        house: &mut House<T>,
        hand: Hand<T>,
        generator: &mut random::RandomGenerator,
        ctx: &mut TxContext,
    ) {
        let Hand {
            id, house_id, player,
            player_cards, mut dealer_cards, stake, base_wager, doubled, has_hit: _, status: _,
        } = hand;
        assert!(house_id == object::id(house), EWrongHouse);

        let staked = balance::value(&stake);
        // Move the escrowed stake into the bank first (house takes the wager).
        house::deposit_stake(house, stake);

        let player_total = hand_total(&player_cards);
        let player_bust = player_total > 21;
        let player_natural = vector::length(&player_cards) == 2 && player_total == 21;

        // Dealer draws its hole card first (fresh), then hits to 17 — but only if
        // the player didn't bust.
        let mut dealer_total = hand_total(&dealer_cards);
        let mut dealer_natural = false;
        if (!player_bust) {
            vector::push_back(&mut dealer_cards, draw_card(generator)); // hole card
            dealer_total = hand_total(&dealer_cards);
            dealer_natural = vector::length(&dealer_cards) == 2 && dealer_total == 21;
            while (dealer_total < DEALER_STANDS_ON) {
                vector::push_back(&mut dealer_cards, draw_card(generator));
                dealer_total = hand_total(&dealer_cards);
            };
        };
        let dealer_bust = dealer_total > 21;

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
    /// Draw one card, infinite-deck: uniform in [0,51]. rank = card % 13.
    fun draw_card(generator: &mut random::RandomGenerator): u8 {
        random::generate_u8_in_range(generator, 0, 51)
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
            let r = test_scenario::take_shared<Random>(&sc);
            if (test_scenario::has_most_recent_for_sender<Hand<SUI>>(&sc)) {
                let hand = test_scenario::take_from_sender<Hand<SUI>>(&sc);
                let ctx = test_scenario::ctx(&mut sc);
                stand<SUI>(&mut house, &r, hand, ctx);
            };
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_hand_total_soft_ace() {
        // A + 6 = 17 (soft); A + 6 + K = 17 (ace demoted).
        let soft = vector[0u8, 6u8];       // Ace, 7-rank? rank6 = value 7 -> 11+7=18
        let _ = soft;
        // Ace(0)=11, rank5(value6): 11+6 = 17
        assert!(hand_total(&vector[0u8, 5u8]) == 17, 0);
        // Ace + 5(value6) + K(10): 11+6+10=27 -> demote ace -> 1+6+10 = 17
        assert!(hand_total(&vector[0u8, 5u8, 12u8]) == 17, 1);
        // pair of aces: 11+11=22 -> demote one -> 12
        assert!(hand_total(&vector[0u8, 13u8]) == 12, 2);
        // K + Q = 20
        assert!(hand_total(&vector[12u8, 11u8]) == 20, 3);
    }
}
