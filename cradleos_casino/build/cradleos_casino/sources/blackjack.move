/// CradleOS Casino — Blackjack (single-transaction, provably fair)
///
/// Blackjack is normally interactive (hit/stand across turns). On Sui, any
/// function consuming `&Random` must resolve in ONE transaction and cannot be
/// composed/aborted, otherwise a player could "test-and-abort" for free retries.
///
/// SOLUTION — committed strategy:
///   The player commits their playing strategy up front as a `stand_on`
///   threshold: "keep hitting until my hard/soft total is >= stand_on, then
///   stand." The contract shuffles a full 52-card shoe with `random::shuffle`,
///   deals, plays the player's hand by their committed threshold, then plays the
///   dealer by fixed house rules (hit while total < 17, including soft-17 stand),
///   settles, and pays out — all atomically in one `entry` call.
///
///   This is strategically faithful (threshold play is the dominant axis of
///   basic strategy) while being immune to abort attacks. A future
///   `blackjack_live` module can add true interactive play via a two-tx
///   commit-reveal if desired.
///
/// PAYOUTS (gross, i.e. includes returned stake on a win):
///   Natural blackjack (2-card 21) ....... 2.5x stake  (classic 3:2)
///   Regular win .......................... 2.0x stake  (even money)
///   Push (tie) ........................... 1.0x stake  (stake returned)
///   Loss / player bust ................... 0.0x stake  (stake kept by house)
///
/// HOUSE EDGE: emerges from dealer-plays-last + player-busts-lose-immediately.
/// With a fixed player threshold the edge is higher than optimal basic strategy;
/// exact edge per threshold is characterized in the off-chain test harness
/// (scripts/edge_sim.ts) and surfaced in the UI — no invented numbers.
module cradleos_casino::blackjack {
    use sui::random::{Self, Random};
    use sui::coin::Coin;
    use sui::event;
    use cradleos_casino::house::{Self, House};

    // ── Errors ─────────────────────────────────────────────────────────────
    const EBadThreshold: u64 = 0;

    // ── Tuning ─────────────────────────────────────────────────────────────
    /// Dealer stands on 17 or higher (stands on soft 17 — player-friendly).
    const DEALER_STANDS_ON: u8 = 17;
    /// Player threshold must be in [12, 21]. Below 12 you can never bust, and
    /// the UI should not offer a nonsensical value.
    const MIN_THRESHOLD: u8 = 12;
    const MAX_THRESHOLD: u8 = 21;

    // Outcome codes (mirrored in the frontend).
    const OUT_LOSS: u8 = 0;
    const OUT_PUSH: u8 = 1;
    const OUT_WIN: u8 = 2;
    const OUT_BLACKJACK: u8 = 3;

    // ── Event: full provably-fair record ─────────────────────────────────────
    public struct HandPlayed has copy, drop {
        house_id: ID,
        player: address,
        wager: u64,
        stand_on: u8,
        player_cards: vector<u8>,   // card indices 0..51 in deal order
        dealer_cards: vector<u8>,
        player_total: u8,
        dealer_total: u8,
        outcome: u8,                // OUT_* constant
        payout: u64,                // gross payout to player (0 on loss)
    }

    // ── Entry: play a full hand ──────────────────────────────────────────────
    //
    // MUST be `entry` and non-public because it consumes `&Random`. `r` is the
    // shared Random object at 0x8.
    entry fun play<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        stand_on: u8,
        ctx: &mut TxContext,
    ) {
        assert!(stand_on >= MIN_THRESHOLD && stand_on <= MAX_THRESHOLD, EBadThreshold);

        let player = tx_context::sender(ctx);
        // Absorb + validate stake (checks pause, min/max). Returns amount.
        let amount = house::take_wager(house, wager);

        // Build a 52-card shoe [0..51] and shuffle with on-chain randomness.
        let mut generator = random::new_generator(r, ctx);
        let mut deck = build_deck();
        random::shuffle(&mut generator, &mut deck);

        // Deal: player two, dealer two (dealer's second is the "hole" card, but
        // since everything resolves atomically we simply reveal all).
        let mut cursor: u64 = 0;
        let mut player_cards = vector::empty<u8>();
        let mut dealer_cards = vector::empty<u8>();

        vector::push_back(&mut player_cards, next_card(&deck, &mut cursor));
        vector::push_back(&mut dealer_cards, next_card(&deck, &mut cursor));
        vector::push_back(&mut player_cards, next_card(&deck, &mut cursor));
        vector::push_back(&mut dealer_cards, next_card(&deck, &mut cursor));

        // Player plays by committed threshold.
        let mut player_total = hand_total(&player_cards);
        while (player_total < stand_on && player_total < 21) {
            vector::push_back(&mut player_cards, next_card(&deck, &mut cursor));
            player_total = hand_total(&player_cards);
        };

        let player_natural = vector::length(&player_cards) == 2 && player_total == 21;
        let player_bust = player_total > 21;

        // Dealer plays only if player hasn't busted.
        let mut dealer_total = hand_total(&dealer_cards);
        if (!player_bust) {
            while (dealer_total < (DEALER_STANDS_ON as u8)) {
                vector::push_back(&mut dealer_cards, next_card(&deck, &mut cursor));
                dealer_total = hand_total(&dealer_cards);
            };
        };
        let dealer_natural = vector::length(&dealer_cards) == 2 && dealer_total == 21;
        let dealer_bust = dealer_total > 21;

        // Determine outcome + gross payout multiplier (in halves of stake to
        // support the 2.5x blackjack payout without floats).
        // payout_halves: 0 = loss, 2 = push (1.0x), 4 = win (2.0x), 5 = bj (2.5x)
        let (outcome, payout) = if (player_bust) {
            (OUT_LOSS, 0)
        } else if (player_natural && dealer_natural) {
            (OUT_PUSH, amount) // both blackjack → push
        } else if (player_natural) {
            (OUT_BLACKJACK, amount + (amount * 3) / 2) // 2.5x
        } else if (dealer_natural) {
            (OUT_LOSS, 0)
        } else if (dealer_bust) {
            (OUT_WIN, amount * 2)
        } else if (player_total > dealer_total) {
            (OUT_WIN, amount * 2)
        } else if (player_total == dealer_total) {
            (OUT_PUSH, amount)
        } else {
            (OUT_LOSS, 0)
        };

        house::pay_winnings(house, payout, player, ctx);

        event::emit(HandPlayed {
            house_id: object::id(house),
            player,
            wager: amount,
            stand_on,
            player_cards,
            dealer_cards,
            player_total,
            dealer_total,
            outcome,
            payout,
        });
    }

    // ── Card helpers ─────────────────────────────────────────────────────────
    // Cards are indices 0..51. rank = index % 13 (0=Ace,1=2,...,9=10,10=J,11=Q,
    // 12=K). suit = index / 13 (0..3). This layout is shared with the frontend.

    fun build_deck(): vector<u8> {
        let mut deck = vector::empty<u8>();
        let mut i: u8 = 0;
        while (i < 52) {
            vector::push_back(&mut deck, i);
            i = i + 1;
        };
        deck
    }

    fun next_card(deck: &vector<u8>, cursor: &mut u64): u8 {
        let c = *vector::borrow(deck, *cursor);
        *cursor = *cursor + 1;
        c
    }

    /// Best blackjack total for a hand, counting Aces as 11 when it doesn't bust.
    fun hand_total(cards: &vector<u8>): u8 {
        let mut total: u16 = 0;
        let mut aces: u16 = 0;
        let n = vector::length(cards);
        let mut i = 0;
        while (i < n) {
            let rank = (*vector::borrow(cards, i)) % 13; // 0..12
            let v: u16 = if (rank == 0) {
                aces = aces + 1;
                11
            } else if (rank >= 9) {
                10 // 10, J, Q, K
            } else {
                ((rank as u16) + 1)
            };
            total = total + v;
            i = i + 1;
        };
        // Demote aces from 11 to 1 while busting.
        while (total > 21 && aces > 0) {
            total = total - 10;
            aces = aces - 1;
        };
        (total as u8)
    }

    // ── Views (for tests / off-chain parity) ─────────────────────────────────
    public fun min_threshold(): u8 { MIN_THRESHOLD }
    public fun max_threshold(): u8 { MAX_THRESHOLD }
    public fun dealer_stands_on(): u8 { DEALER_STANDS_ON }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;
    #[test_only] use sui::coin;

    #[test]
    fun test_hand_total_ace_logic() {
        // Ace + King = 21 (blackjack)
        let mut h = vector::empty<u8>();
        vector::push_back(&mut h, 0);   // Ace of suit 0
        vector::push_back(&mut h, 12);  // King of suit 0
        assert!(hand_total(&h) == 21, 0);

        // Ace + Ace + 9 => 11+1+9 = 21 (one ace demoted)
        let mut h2 = vector::empty<u8>();
        vector::push_back(&mut h2, 0);   // Ace
        vector::push_back(&mut h2, 13);  // Ace (suit 1)
        vector::push_back(&mut h2, 8);   // rank 8 => value 9
        assert!(hand_total(&h2) == 21, 1);

        // 10 + 7 + 8 = 25 -> bust
        let mut h3 = vector::empty<u8>();
        vector::push_back(&mut h3, 9);   // rank 9 => 10
        vector::push_back(&mut h3, 6);   // rank 6 => 7
        vector::push_back(&mut h3, 7);   // rank 7 => 8
        assert!(hand_total(&h3) == 25, 2);
    }

    #[test]
    fun test_deck_is_52_unique() {
        let deck = build_deck();
        assert!(vector::length(&deck) == 52, 0);
        // spot check endpoints
        assert!(*vector::borrow(&deck, 0) == 0, 1);
        assert!(*vector::borrow(&deck, 51) == 51, 2);
    }

    // Full end-to-end play with the test Random object.
    #[test]
    fun test_play_hand_settles() {
        let admin = @0xAD;
        let player = @0xBE;
        // Random::create_for_testing requires the system address @0x0.
        let mut sc = test_scenario::begin(@0x0);
        {
            let ctx = test_scenario::ctx(&mut sc);
            random::create_for_testing(ctx);
        };
        // Create house.
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        // Player plays a hand.
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 17, ctx);
            // House total wagered advanced by the bet.
            assert!(house::total_wagered(&house) == 100, 0);
            assert!(house::bets_settled(&house) == 1, 1);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
