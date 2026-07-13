/// CradleOS Casino — Dragon Tiger (#103, Category H: Duels)
///
/// Two cards drawn from a 52-card deck (without replacement, rank comparison only).
/// Player bets on Dragon to win, Tiger to win, or a Tie side bet.
///
/// BET TYPES:
///   0 = DRAGON — win if Dragon rank > Tiger rank; half-stake back on tie
///   1 = TIGER  — win if Tiger rank > Dragon rank; half-stake back on tie
///   2 = TIE    — side bet; wins if Dragon rank == Tiger rank (47% edge, disclose)
///
/// PAYOUT TABLE (gross bps; 10 000 bps = 1.00× stake returned):
///   Dragon/Tiger win → 20 000 bps (2.00× gross, 1.00× net)
///   Dragon/Tiger tie → 5 000 bps (0.50× gross — half stake back)
///   Dragon/Tiger loss → 0
///   Tie side bet win → 90 000 bps (9.00× gross, 8.00× net)
///   Tie side bet loss → 0
///
/// MEASURED HOUSE EDGE (derived from 52-card ordered pairs, 2652 total):
///   P(tie) = 156/2652 = 1/17 ≈ 5.88%
///   P(win) = 1248/2652 = 8/17 ≈ 47.06%
///   Dragon/Tiger main bet EV = 8/17 × 2.00 + 1/17 × 0.50 = 16.5/17 ≈ 0.9706 → **2.94% edge**
///   Tie side bet EV = 1/17 × 9.00 = 9/17 ≈ 0.5294 → **47.06% edge** (industry standard)
///
/// NOTE on Tie side bet: 47% edge is the global Dragon Tiger standard; the Tie bet is
/// offered as a thrill/side wager. House-bank exposure guard still applies (MAX_MULT_X = 9).
///
/// MAX_MULT_X = 9 (Tie side bet = 9× gross; drives the 3%-of-bank exposure guard).
/// max_bet at 90 000-EVE bank ≈ 300 EVE.
module cradleos_casino::dragon_tiger {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    // ── Error codes ──────────────────────────────────────────────────────────
    const EInvalidBet:  u64 = 0;
    const EMaxExposure: u64 = 1;

    // ── Constants ────────────────────────────────────────────────────────────
    const BET_DRAGON: u8 = 0;
    const BET_TIGER:  u8 = 1;
    const BET_TIE:    u8 = 2;

    /// Main bet (Dragon/Tiger) win payout: 2.00× gross.
    const WIN_BPS: u64 = 20_000;
    /// Main bet tie payout: half stake back = 0.50× gross.
    const TIE_BPS: u64 = 5_000;
    /// Tie side-bet win payout: 9.00× gross.
    const TIE_SIDE_BPS: u64 = 90_000;

    /// Worst-case multiplier across all bet types: Tie side bet = 9×.
    const MAX_MULT_X: u64 = 9;

    // ── Event ────────────────────────────────────────────────────────────────
    public struct DragonTigerPlayed has copy, drop {
        player:      address,
        wager:       u64,
        bet_type:    u8,   // 0=Dragon 1=Tiger 2=Tie
        dragon_rank: u8,   // 0=Two … 12=Ace
        tiger_rank:  u8,
        payout:      u64,
    }

    // ── Pure math ────────────────────────────────────────────────────────────

    /// Gross payout for a resolved Dragon Tiger hand. Pure — exhaustively testable.
    ///
    /// Ranks 0..12 (0=Two, 12=Ace). Tie side bet has 47% house edge; disclose.
    public fun payout_for(amount: u64, bet_type: u8, dragon_rank: u8, tiger_rank: u8): u64 {
        let dragon_wins = dragon_rank > tiger_rank;
        let tiger_wins  = tiger_rank > dragon_rank;
        let is_tie      = dragon_rank == tiger_rank;

        if (bet_type == BET_DRAGON) {
            if (dragon_wins) { ((amount as u128) * (WIN_BPS as u128) / 10_000) as u64 }
            else if (is_tie) { ((amount as u128) * (TIE_BPS as u128) / 10_000) as u64 }
            else { 0 }
        } else if (bet_type == BET_TIGER) {
            if (tiger_wins)  { ((amount as u128) * (WIN_BPS as u128) / 10_000) as u64 }
            else if (is_tie) { ((amount as u128) * (TIE_BPS as u128) / 10_000) as u64 }
            else { 0 }
        } else {
            // BET_TIE side bet
            if (is_tie) { ((amount as u128) * (TIE_SIDE_BPS as u128) / 10_000) as u64 }
            else { 0 }
        }
    }

    // ── Entry ────────────────────────────────────────────────────────────────

    /// Play one hand of Dragon Tiger.
    ///
    /// Two cards drawn without replacement from a 52-card deck (rank-only comparison).
    /// Dragon card drawn first; Tiger drawn from the remaining 51 slots.
    /// All randomness consumed in this tx; result emitted in DragonTigerPlayed event.
    entry fun play<T>(
        house:    &mut House<T>,
        r:        &Random,
        wager:    Coin<T>,
        bet_type: u8,
        ctx:      &mut TxContext,
    ) {
        assert!(bet_type <= BET_TIE, EInvalidBet);

        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        assert!(amount * MAX_MULT_X <= house::bank_balance(house) * 3 / 100, EMaxExposure);
        house::deposit_stake(house, coin::into_balance(wager));

        // Draw two distinct cards from a 52-card deck (without replacement).
        // Card index 0..51: rank = card / 4 (0=Two…12=Ace), suit = card % 4.
        let mut g = random::new_generator(r, ctx);
        let dragon_card   = random::generate_u8_in_range(&mut g, 0, 51);
        let tiger_offset  = random::generate_u8_in_range(&mut g, 0, 50);
        // Map tiger_offset (0..50) to a distinct card index (0..51) \ {dragon_card}.
        let tiger_card: u8 = if (tiger_offset < dragon_card) { tiger_offset } else { tiger_offset + 1 };

        let dragon_rank = dragon_card / 4;
        let tiger_rank  = tiger_card  / 4;

        let payout = payout_for(amount, bet_type, dragon_rank, tiger_rank);
        house::pay_winnings(house, payout, player, ctx);

        event::emit(DragonTigerPlayed {
            player, wager: amount, bet_type, dragon_rank, tiger_rank, payout,
        });
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_payout_math() {
        // Dragon wins main bet
        assert!(payout_for(100, BET_DRAGON, 10, 5) == 200, 0);   // rank 10 > 5 → 2×
        assert!(payout_for(100, BET_DRAGON, 12, 11) == 200, 1);  // Ace > King → 2×

        // Dragon loses main bet
        assert!(payout_for(100, BET_DRAGON, 3, 9) == 0, 2);      // 3 < 9 → loss

        // Dragon tie → half stake
        assert!(payout_for(100, BET_DRAGON, 7, 7) == 50, 3);
        assert!(payout_for(100, BET_DRAGON, 0, 0) == 50, 4);

        // Tiger wins main bet
        assert!(payout_for(100, BET_TIGER, 1, 11) == 200, 5);    // 1 < 11 → Tiger wins 2×
        assert!(payout_for(100, BET_TIGER, 12, 3) == 0, 6);      // Tiger loses

        // Tiger tie
        assert!(payout_for(100, BET_TIGER, 5, 5) == 50, 7);

        // Tie side bet wins
        assert!(payout_for(100, BET_TIE, 4, 4) == 900, 8);       // 9×
        assert!(payout_for(100, BET_TIE, 12, 12) == 900, 9);     // 9× on Aces

        // Tie side bet loses
        assert!(payout_for(100, BET_TIE, 6, 7) == 0, 10);
        assert!(payout_for(100, BET_TIE, 11, 0) == 0, 11);

        // Zero wager edge cases
        assert!(payout_for(0, BET_DRAGON, 10, 5) == 0, 12);
        assert!(payout_for(0, BET_TIE, 4, 4) == 0, 13);
    }

    #[test]
    fun test_card_rank_mapping() {
        // Card 0..3 = Two (rank 0), card 4..7 = Three (rank 1), ... card 48..51 = Ace (rank 12)
        assert!(0u8 / 4 == 0, 0);   // Two
        assert!(3u8 / 4 == 0, 1);   // Two (different suit)
        assert!(4u8 / 4 == 1, 2);   // Three
        assert!(48u8 / 4 == 12, 3); // Ace
        assert!(51u8 / 4 == 12, 4); // Ace (different suit)
    }

    #[test]
    fun test_tiger_card_skip() {
        // Verify the tiger_card skip-dragon logic
        let dragon_card: u8 = 10;
        let tiger_offset_below: u8 = 9;  // below dragon → unchanged
        let tiger_offset_at: u8 = 10;    // at dragon → +1 skip
        let tiger_offset_above: u8 = 20; // above dragon → +1 skip

        let tc_below: u8 = if (tiger_offset_below < dragon_card) { tiger_offset_below } else { tiger_offset_below + 1 };
        let tc_at: u8    = if (tiger_offset_at < dragon_card)    { tiger_offset_at }    else { tiger_offset_at + 1 };
        let tc_above: u8 = if (tiger_offset_above < dragon_card) { tiger_offset_above } else { tiger_offset_above + 1 };

        assert!(tc_below == 9, 0);  // unchanged
        assert!(tc_at == 11, 1);    // skipped dragon card at 10 → 11
        assert!(tc_above == 21, 2); // skipped dragon card → +1
        assert!(tc_below != dragon_card, 3);
        assert!(tc_at != dragon_card, 4);
        assert!(tc_above != dragon_card, 5);
    }

    #[test]
    fun test_play_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, BET_DRAGON, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_play_tiger_settles() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, BET_TIGER, ctx);
            assert!(house::bets_settled(&house) == 1, 0);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }

    #[test, expected_failure(abort_code = EInvalidBet)]
    fun test_invalid_bet_type_fails() {
        let admin  = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000_000, ctx);
            let cap  = house::create<SUI>(seed, 10_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r   = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            play<SUI>(&mut house, &r, bet, 5, ctx); // invalid bet type
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
