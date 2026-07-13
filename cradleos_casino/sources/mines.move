/// CradleOS Casino — Mines (commit-reveal, real pick-a-tile / cash-out).
///
/// A 5x5 grid (25 tiles) hides `mines` bombs. On `start`, randomness places the
/// mines ONCE and commits the full mine layout inside a player-owned MinesGame
/// object holding the escrowed stake — the UI shows nothing but a blank grid.
/// Each `reveal` opens one tile:
///   • safe  → the running multiplier grows; the player may keep going or cash out.
///   • mine  → BUST: stake goes to the house, layout revealed in the event.
/// `cashout` at any time (>=1 safe reveal) pays wager × current multiplier.
///
/// WHY IT STAYS FAIR (same trick as blackjack_live):
///   Randomness is consumed EXACTLY ONCE in `start`. Reveal/cashout consume no
///   randomness (normal public fns, no Random arg), so a player cannot
///   test-and-abort for a safe tile — the layout is already committed. The full
///   mine bitmap is published on bust/cashout for provably-fair audit.
///
/// MULTIPLIER (3% house edge): after revealing k safe tiles with m mines on a
/// T=25 grid (safe S=T−m), the fair multiplier is Π_{i=0}^{k−1} (T−i)/(S−i);
/// we apply a 0.97 factor. Computed on-chain in bps fixed-point.
module cradleos_casino::mines {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use cradleos_casino::house::{Self, House};

    // ── Errors ─────────────────────────────────────────────────────────────
    const ENotOwner:        u64 = 0;
    const EGameFinished:    u64 = 1;
    const EBadParams:       u64 = 2;
    const ETileTaken:       u64 = 3;
    const ENoReveals:       u64 = 4;   // can't cash out before revealing a tile
    const EWrongHouse:      u64 = 5;
    const EMaxExposure:     u64 = 6;
    /// Game disabled on-chain (v23, 2026-07-12): the committed mine_map lives in
    /// the player-owned MinesGame object, so it is readable via sui_getObject
    /// BEFORE revealing tiles — a solution leak (RTP observed >11,000%). New games
    /// blocked until a commit-reveal redesign ships. reveal/cashout stay open so
    /// in-flight games can still settle.
    const EGameDisabled:    u64 = 7;

    const TILES: u8 = 25;              // 5x5 grid
    const EDGE_BPS: u128 = 9700;       // 0.97 → 3% edge, in /10000
    /// Payout multiplier ceiling (bps). Mines can grow astronomically as the
    /// player clears the board, but we cap the effective multiplier so the
    /// house exposure guard only needs to cover a bounded max (1000x here).
    /// Once the running multiplier reaches this cap it stops growing; the
    /// player should cash out. This keeps deep boards playable at real bets
    /// (exposure guard = 3% of bank, so a 1000x cap allows a bet up to
    /// bank*0.03/1000 — e.g. ~2.7 EVE on a 90k bank).
    const MAX_MULT_BPS: u64 = 10_000_000;  // 1000x ceiling
    // Status
    const STATUS_PLAYING: u8 = 0;

    // ── MinesGame (player-owned; holds escrow + committed layout) ─────────────
    public struct MinesGame<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        /// Mine layout: 25-bit bitmap, bit i set = tile i is a mine. Hidden
        /// from the client until bust/cashout (only stored, never read by UI).
        mine_map: u32,
        mines: u8,
        /// Tiles the player has revealed: 25-bit bitmap.
        revealed_map: u32,
        safe_revealed: u8,
        /// Escrowed stake.
        stake: Balance<T>,
        wager: u64,
        /// Current multiplier (bps) after `safe_revealed` safe tiles.
        multiplier_bps: u64,
        status: u8,
    }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct MinesStarted has copy, drop {
        game_id: ID,
        house_id: ID,
        player: address,
        wager: u64,
        mines: u8,
    }

    public struct TileRevealed has copy, drop {
        game_id: ID,
        player: address,
        tile: u8,
        hit_mine: bool,
        safe_revealed: u8,
        multiplier_bps: u64,
    }

    public struct MinesSettled has copy, drop {
        game_id: ID,
        house_id: ID,
        player: address,
        wager: u64,
        busted: bool,          // true = hit a mine, false = cashed out
        safe_revealed: u8,
        mine_map: u32,         // full layout revealed for audit
        multiplier_bps: u64,
        payout: u64,
    }

    // ── Multiplier math (pure) ───────────────────────────────────────────────
    /// Fair-adjusted multiplier (bps) after `k` safe reveals with `mines` mines
    /// on a TILES-tile grid. Π_{i=0}^{k-1} (T-i)/(S-i) × 0.97. Pure.
    public fun multiplier_after(mines: u8, k: u8): u64 {
        if (k == 0) { return 10000 };  // no reveals yet = 1.0x (won't be paid)
        let t = (TILES as u128);
        let s = ((TILES - mines) as u128);
        let mut num = 10000u128;       // running value in bps (start 1.0000x)
        let mut i = 0u128;
        while (i < (k as u128)) {
            // multiply by (T-i)/(S-i)
            num = num * (t - i) / (s - i);
            i = i + 1;
        };
        let adj = (num * EDGE_BPS / 10000) as u64;
        if (adj > MAX_MULT_BPS) { MAX_MULT_BPS } else { adj }
    }

    /// Multiplier if the player clears every safe tile (max for this mine count).
    public fun clear_all_multiplier(mines: u8): u64 {
        multiplier_after(mines, TILES - mines)
    }

    fun bit_set(map: u32, i: u8): bool { (map >> i) & 1 == 1 }

    // ── Start a game ───────────────────────────────────────────────────────
    entry fun start<T>(
        house: &mut House<T>,
        r: &Random,
        wager: Coin<T>,
        mines: u8,
        ctx: &mut TxContext,
    ) {
        // v23: mines start is disabled on-chain (solution-leak exploit). Abort
        // before any state change so no new game is created and no wager is
        // escrowed. Existing games can still reveal/cashout to settle.
        assert!(false, EGameDisabled);
        // 1..24 mines (need at least one safe tile and at least one mine).
        assert!(mines >= 1 && mines <= 24, EBadParams);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager);
        // Exposure: the house must be able to pay a full clear at max multiplier.
        let top = clear_all_multiplier(mines);
        let max_pay = (((amount as u128) * (top as u128) / 10000) as u64);
        assert!(max_pay <= house::bank_balance(house) * 3 / 100, EMaxExposure);

        // Place `mines` distinct mines via partial Fisher-Yates over tile indices.
        let mut g = random::new_generator(r, ctx);
        let mut idx: vector<u8> = vector[];
        let mut n = 0u8;
        while (n < TILES) { vector::push_back(&mut idx, n); n = n + 1; };
        let mut mine_map = 0u32;
        let mut placed = 0u8;
        while (placed < mines) {
            // FIX v14: hi is constant (TILES-1); lo advances (placed).
            // The old code shrank hi each step → [placed, TILES-1-placed] which
            // inverts at placed=13 (range [13,11]) causing EInvalidRange aborts
            // for 14–24 mines, and biases high-index tiles for fewer mines.
            let hi = (TILES - 1) as u64;
            let pick = random::generate_u64_in_range(&mut g, placed as u64, hi);
            vector::swap(&mut idx, placed as u64, pick);
            let tile = *vector::borrow(&idx, placed as u64);
            mine_map = mine_map | (1u32 << tile);
            placed = placed + 1;
        };

        let game = MinesGame<T> {
            id: object::new(ctx),
            house_id: object::id(house),
            player,
            mine_map,
            mines,
            revealed_map: 0,
            safe_revealed: 0,
            stake: coin::into_balance(wager),
            wager: amount,
            multiplier_bps: 10000,
            status: STATUS_PLAYING,
        };
        let game_id = object::id(&game);
        event::emit(MinesStarted { game_id, house_id: object::id(house), player, wager: amount, mines });
        transfer::transfer(game, player);
    }

    // ── Reveal a tile ──────────────────────────────────────────────────────
    // If it's a mine, the game busts: stake → house, object consumed, event.
    // If safe, multiplier advances; the object is kept for the next action.
    entry fun reveal<T>(
        house: &mut House<T>,
        mut game: MinesGame<T>,
        tile: u8,
        ctx: &mut TxContext,
    ) {
        assert!(game.player == tx_context::sender(ctx), ENotOwner);
        assert!(game.status == STATUS_PLAYING, EGameFinished);
        assert!(object::id(house) == game.house_id, EWrongHouse);
        assert!(tile < TILES, EBadParams);
        assert!(!bit_set(game.revealed_map, tile), ETileTaken);

        game.revealed_map = game.revealed_map | (1u32 << tile);
        let hit = bit_set(game.mine_map, tile);
        let game_id = object::id(&game);

        if (hit) {
            // BUST — absorb stake into the bank, settle at 0.
            let MinesGame {
                id, house_id, player, mine_map, mines: _, revealed_map: _,
                safe_revealed, stake, wager, multiplier_bps: _, status: _,
            } = game;
            house::deposit_stake(house, stake);
            house::pay_winnings(house, 0, player, ctx);
            event::emit(TileRevealed { game_id, player, tile, hit_mine: true, safe_revealed, multiplier_bps: 0 });
            event::emit(MinesSettled { game_id, house_id, player, wager, busted: true, safe_revealed, mine_map, multiplier_bps: 0, payout: 0 });
            object::delete(id);
        } else {
            game.safe_revealed = game.safe_revealed + 1;
            let mult = multiplier_after(game.mines, game.safe_revealed);
            game.multiplier_bps = mult;
            let player = game.player;
            let safe_count = game.safe_revealed;
            let tiles_left = TILES - game.mines;
            event::emit(TileRevealed { game_id, player, tile, hit_mine: false, safe_revealed: safe_count, multiplier_bps: mult });
            // If the player cleared every safe tile, auto-cash-out at the top mult.
            if (safe_count == tiles_left) {
                let MinesGame {
                    id, house_id, player: p2, mine_map, mines: _, revealed_map: _,
                    safe_revealed: sr2, stake, wager, multiplier_bps: mb2, status: _,
                } = game;
                settle_win(house, id, house_id, p2, sr2, stake, wager, mine_map, mb2, ctx);
            } else {
                transfer::transfer(game, player);
            }
        }
    }

    // ── Cash out ─────────────────────────────────────────────────────────────
    entry fun cashout<T>(
        house: &mut House<T>,
        game: MinesGame<T>,
        ctx: &mut TxContext,
    ) {
        assert!(game.player == tx_context::sender(ctx), ENotOwner);
        assert!(game.status == STATUS_PLAYING, EGameFinished);
        assert!(object::id(house) == game.house_id, EWrongHouse);
        assert!(game.safe_revealed >= 1, ENoReveals);

        let MinesGame {
            id, house_id, player, mine_map, mines: _, revealed_map: _,
            safe_revealed, stake, wager, multiplier_bps, status: _,
        } = game;
        settle_win(house, id, house_id, player, safe_revealed, stake, wager, mine_map, multiplier_bps, ctx);
    }

    /// Deposit escrow into bank, pay wager × multiplier, consume the game object.
    fun settle_win<T>(
        house: &mut House<T>,
        id: UID,
        house_id: ID,
        player: address,
        safe_revealed: u8,
        stake: Balance<T>,
        wager: u64,
        mine_map: u32,
        multiplier_bps: u64,
        ctx: &mut TxContext,
    ) {
        house::deposit_stake(house, stake);
        let payout = (((wager as u128) * (multiplier_bps as u128) / 10000) as u64);
        house::pay_winnings(house, payout, player, ctx);
        event::emit(MinesSettled {
            game_id: object::uid_to_inner(&id), house_id, player, wager,
            busted: false, safe_revealed, mine_map, multiplier_bps, payout,
        });
        object::delete(id);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    public fun game_player<T>(g: &MinesGame<T>): address { g.player }
    public fun game_wager<T>(g: &MinesGame<T>): u64 { g.wager }
    public fun game_mines<T>(g: &MinesGame<T>): u8 { g.mines }
    public fun game_revealed<T>(g: &MinesGame<T>): u32 { g.revealed_map }
    public fun game_safe_revealed<T>(g: &MinesGame<T>): u8 { g.safe_revealed }
    public fun game_multiplier<T>(g: &MinesGame<T>): u64 { g.multiplier_bps }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_multiplier_math() {
        // 3 mines, 1 reveal: (25/22)*0.97 = 1.1023x → 11022 bps (floor)
        assert!(multiplier_after(3, 1) == 11022, 0);
        // 3 mines, 3 reveals (exact truncated integer): 14485 bps
        assert!(multiplier_after(3, 3) == 14485, 1);
        // 1 mine, 1 reveal: 10103 bps
        assert!(multiplier_after(1, 1) == 10103, 2);
        // 0 reveals = 1.0x (early return before edge factor)
        assert!(multiplier_after(5, 0) == 10000, 3);
        // clear-all for 24 mines (1 safe tile): (25/1)*0.97 = 24.25x = 242500 bps
        assert!(clear_all_multiplier(24) == 242500, 4);
    }

    #[test_only]
    fun popcount32(mut v: u32): u8 {
        let mut count = 0u8;
        while (v != 0) { count = count + ((v & 1) as u8); v = v >> 1; };
        count
    }

    // ── v14 edge-case tests: Fisher-Yates fix ────────────────────────────────
    // v23: start is disabled on-chain (solution-leak). These formerly verified
    // mine placement; they now confirm start aborts EGameDisabled before any
    // state change. Placement RNG will be re-verified when the commit-reveal
    // redesign re-enables the game.
    #[test]
    #[expected_failure(abort_code = EGameDisabled)]
    fun test_mines_24_places_exactly_24() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(100_000_000, ctx);
            let cap = house::create<SUI>(seed, 100_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            start<SUI>(&mut house, &r, bet, 24, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let game = test_scenario::take_from_sender<MinesGame<SUI>>(&sc);
            assert!(game.mines == 24, 0);
            assert!(popcount32(game.mine_map) == 24, 1);
            // Only tile-indices 0..24 are valid; no bit above bit-24 should be set.
            assert!(game.mine_map < (1u32 << 25), 2);
            test_scenario::return_to_sender(&sc, game);
        };
        test_scenario::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = EGameDisabled)]
    fun test_mines_1_places_exactly_1() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(100_000_000, ctx);
            let cap = house::create<SUI>(seed, 100_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            start<SUI>(&mut house, &r, bet, 1, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::next_tx(&mut sc, player);
        {
            let game = test_scenario::take_from_sender<MinesGame<SUI>>(&sc);
            assert!(game.mines == 1, 0);
            assert!(popcount32(game.mine_map) == 1, 1);
            assert!(game.mine_map < (1u32 << 25), 2);
            test_scenario::return_to_sender(&sc, game);
        };
        test_scenario::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = EGameDisabled)]
    fun test_start_and_reveal_flow() {
        let admin = @0xAD;
        let player = @0xBE;
        let mut sc = test_scenario::begin(@0x0);
        { random::create_for_testing(test_scenario::ctx(&mut sc)); };
        test_scenario::next_tx(&mut sc, admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(100_000_000, ctx);
            let cap = house::create<SUI>(seed, 100_000, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        // start (aborts EGameDisabled)
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let r = test_scenario::take_shared<Random>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(100, ctx);
            start<SUI>(&mut house, &r, bet, 3, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        // player now owns a MinesGame; reveal one tile then cash out (or bust).
        test_scenario::next_tx(&mut sc, player);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let game = test_scenario::take_from_sender<MinesGame<SUI>>(&sc);
            assert!(game_mines(&game) == 3, 0);
            assert!(game_safe_revealed(&game) == 0, 1);
            let ctx = test_scenario::ctx(&mut sc);
            // Reveal tile 0. It may be safe or a mine depending on layout; either
            // way it must not abort. If safe the object is re-transferred; if
            // mine it's consumed. We can't assert which without reading mine_map,
            // so just ensure the call succeeds and the house counted a settle
            // only on bust — checked via the follow-up tx.
            reveal<SUI>(&mut house, game, 0, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }
}
