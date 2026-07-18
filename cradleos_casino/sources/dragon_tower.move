/// CradleOS Casino — Dragon Tower (commit-reveal, climb-and-cashout).
///
/// A 9-row tower. Each row has `tiles` cells; one (or more) hides a dragon. On
/// `start`, the dragon positions for ALL rows are drawn ONCE from the Sui beacon
/// and committed inside a player-owned TowerGame object holding the escrowed
/// stake. The player climbs row-by-row: `pick` a cell on the current row —
/// safe advances (multiplier grows), dragon busts. `cashout` any time (>=1 row
/// climbed) pays wager × current multiplier.
///
/// DIFFICULTY (tiles per row / dragons per row → per-row survival):
///   0 EASY   — 4 tiles, 1 dragon (3/4 safe), per-row 1.293x, row9 ≈ 12.9x
///   1 MEDIUM — 3 tiles, 1 dragon (2/3 safe), per-row 1.455x, row9 ≈ 37.3x
///   2 HARD   — 2 tiles, 1 dragon (1/2 safe), per-row 1.940x, row9 ≈ 496.6x
///
/// Multiplier after k rows = (tiles/(tiles-dragons))^k × 0.97 (3% edge), bps.
///
/// WHY IT STAYS FAIR (same trick as mines/blackjack_live): randomness consumed
/// once in `start`; pick/cashout consume none, so no test-and-abort. The full
/// dragon layout is published on bust/cashout for audit.
module cradleos_casino::dragon_tower {
    use sui::random::{Self, Random};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use cradleos_casino::house::{Self, House};
    use world::character::Character;

    const ENotOwner:     u64 = 0;
    const EGameFinished: u64 = 1;
    const EBadParams:    u64 = 2;
    const ENoRows:       u64 = 3;
    const EWrongHouse:   u64 = 4;
    const EMaxExposure:  u64 = 5;
    /// Game disabled on-chain (v22, 2026-07-12): the pre-drawn dragon layout was
    /// stored in the player-owned TowerGame object, making it readable via
    /// sui_getObject BEFORE picking — a solution leak (RTP observed ~239%). New
    /// games are blocked until a commit-reveal / per-pick-draw redesign ships.
    /// pick/cashout remain open so any in-flight game can still be settled.
    const EGameDisabled: u64 = 6;

    const ROWS: u8 = 9;
    const EDGE_BPS: u128 = 9700;

    // Difficulty
    const DIFF_EASY:   u8 = 0;
    const DIFF_MEDIUM: u8 = 1;
    const DIFF_HARD:   u8 = 2;

    public struct TowerGame<phantom T> has key {
        id: UID,
        house_id: ID,
        player: address,
        difficulty: u8,
        tiles: u8,               // cells per row
        /// Dragon cell index per row (row i dragon at dragon_pos[i]). Hidden.
        dragon_pos: vector<u8>,
        /// Cells the player has picked per climbed row (parallel to rows_climbed).
        picks: vector<u8>,
        rows_climbed: u8,
        stake: Balance<T>,
        wager: u64,
        multiplier_bps: u64,
    }

    public struct TowerStarted has copy, drop {
        game_id: ID, house_id: ID, player: address, wager: u64, difficulty: u8, tiles: u8,
    }
    public struct RowClimbed has copy, drop {
        game_id: ID, player: address, row: u8, cell: u8, hit_dragon: bool,
        rows_climbed: u8, multiplier_bps: u64,
    }
    public struct TowerSettled has copy, drop {
        game_id: ID, house_id: ID, player: address, wager: u64, busted: bool,
        rows_climbed: u8, dragon_pos: vector<u8>, multiplier_bps: u64, payout: u64,
    }

    /// (tiles, dragons_per_row) for a difficulty. Pure.
    public fun params(difficulty: u8): (u8, u8) {
        if (difficulty == DIFF_EASY) { (4, 1) }
        else if (difficulty == DIFF_MEDIUM) { (3, 1) }
        else { (2, 1) } // HARD
    }

    /// Multiplier (bps) after climbing `k` rows at a difficulty. Pure.
    /// (tiles/(tiles-dragons))^k × 0.97.
    public fun multiplier_after(difficulty: u8, k: u8): u64 {
        if (k == 0) { return 10000 };
        let (tiles, dragons) = params(difficulty);
        let num = (tiles as u128);
        let den = ((tiles - dragons) as u128);
        let mut m = 10000u128;
        let mut i = 0u8;
        while (i < k) { m = m * num / den; i = i + 1; };
        ((m * EDGE_BPS / 10000) as u64)
    }

    /// Top multiplier (all 9 rows climbed). Pure.
    public fun top_multiplier(difficulty: u8): u64 { multiplier_after(difficulty, ROWS) }

    entry fun start<T>(
        house: &mut House<T>,
        r: &Random,
        character: &Character,
        wager: Coin<T>,
        difficulty: u8,
        ctx: &mut TxContext,
    ) {
        // v22: dragon_tower start is disabled on-chain (solution-leak exploit).
        // Abort before any state change so no new game can be created and no
        // wager is escrowed. Existing games can still pick/cashout to settle.
        house::assert_character(house, character, ctx);
        assert!(false, EGameDisabled);
        assert!(difficulty <= DIFF_HARD, EBadParams);
        let player = tx_context::sender(ctx);
        let amount = house::take_wager_amount(house, &wager, ctx);
        let top = top_multiplier(difficulty);
        let max_pay = (((amount as u128) * (top as u128) / 10000) as u64);
        assert!(max_pay <= house::bank_balance(house) * 3 / 100, EMaxExposure);

        let (tiles, _dragons) = params(difficulty);
        let mut g = random::new_generator(r, ctx);
        let mut dragon_pos: vector<u8> = vector[];
        let mut i = 0u8;
        while (i < ROWS) {
            vector::push_back(&mut dragon_pos, random::generate_u8_in_range(&mut g, 0, tiles - 1));
            i = i + 1;
        };

        let game = TowerGame<T> {
            id: object::new(ctx),
            house_id: object::id(house),
            player, difficulty, tiles, dragon_pos,
            picks: vector[],
            rows_climbed: 0,
            stake: coin::into_balance(wager),
            wager: amount,
            multiplier_bps: 10000,
        };
        let game_id = object::id(&game);
        event::emit(TowerStarted { game_id, house_id: object::id(house), player, wager: amount, difficulty, tiles });
        transfer::transfer(game, player);
    }

    entry fun pick<T>(
        house: &mut House<T>,
        mut game: TowerGame<T>,
        cell: u8,
        ctx: &mut TxContext,
    ) {
        assert!(game.player == tx_context::sender(ctx), ENotOwner);
        assert!(object::id(house) == game.house_id, EWrongHouse);
        assert!(game.rows_climbed < ROWS, EGameFinished);
        assert!(cell < game.tiles, EBadParams);

        let row = game.rows_climbed;
        let dragon = *vector::borrow(&game.dragon_pos, (row as u64));
        let hit = cell == dragon;
        let game_id = object::id(&game);

        if (hit) {
            let TowerGame {
                id, house_id, player, difficulty: _, tiles: _, dragon_pos,
                picks: _, rows_climbed, stake, wager, multiplier_bps: _,
            } = game;
            house::deposit_stake(house, stake);
            house::pay_winnings(house, 0, player, ctx);
            event::emit(RowClimbed { game_id, player, row, cell, hit_dragon: true, rows_climbed, multiplier_bps: 0 });
            event::emit(TowerSettled { game_id, house_id, player, wager, busted: true, rows_climbed, dragon_pos, multiplier_bps: 0, payout: 0 });
            object::delete(id);
        } else {
            vector::push_back(&mut game.picks, cell);
            game.rows_climbed = game.rows_climbed + 1;
            let mult = multiplier_after(game.difficulty, game.rows_climbed);
            game.multiplier_bps = mult;
            let player = game.player;
            let climbed = game.rows_climbed;
            event::emit(RowClimbed { game_id, player, row, cell, hit_dragon: false, rows_climbed: climbed, multiplier_bps: mult });
            if (climbed == ROWS) {
                let TowerGame {
                    id, house_id, player: p2, difficulty: _, tiles: _, dragon_pos,
                    picks: _, rows_climbed, stake, wager, multiplier_bps,
                } = game;
                settle_win(house, id, house_id, p2, rows_climbed, dragon_pos, stake, wager, multiplier_bps, ctx);
            } else {
                transfer::transfer(game, player);
            }
        }
    }

    entry fun cashout<T>(
        house: &mut House<T>,
        game: TowerGame<T>,
        ctx: &mut TxContext,
    ) {
        assert!(game.player == tx_context::sender(ctx), ENotOwner);
        assert!(object::id(house) == game.house_id, EWrongHouse);
        assert!(game.rows_climbed >= 1, ENoRows);
        let TowerGame {
            id, house_id, player, difficulty: _, tiles: _, dragon_pos,
            picks: _, rows_climbed, stake, wager, multiplier_bps,
        } = game;
        settle_win(house, id, house_id, player, rows_climbed, dragon_pos, stake, wager, multiplier_bps, ctx);
    }

    fun settle_win<T>(
        house: &mut House<T>, id: UID, house_id: ID, player: address,
        rows_climbed: u8, dragon_pos: vector<u8>, stake: Balance<T>, wager: u64,
        multiplier_bps: u64, ctx: &mut TxContext,
    ) {
        house::deposit_stake(house, stake);
        let payout = (((wager as u128) * (multiplier_bps as u128) / 10000) as u64);
        house::pay_winnings(house, payout, player, ctx);
        event::emit(TowerSettled { game_id: object::uid_to_inner(&id), house_id, player, wager, busted: false, rows_climbed, dragon_pos, multiplier_bps, payout });
        object::delete(id);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    public fun game_player<T>(g: &TowerGame<T>): address { g.player }
    public fun game_wager<T>(g: &TowerGame<T>): u64 { g.wager }
    public fun game_difficulty<T>(g: &TowerGame<T>): u8 { g.difficulty }
    public fun game_tiles<T>(g: &TowerGame<T>): u8 { g.tiles }
    public fun game_rows_climbed<T>(g: &TowerGame<T>): u8 { g.rows_climbed }
    public fun game_multiplier<T>(g: &TowerGame<T>): u64 { g.multiplier_bps }
    public fun game_picks<T>(g: &TowerGame<T>): vector<u8> { g.picks }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only] use sui::test_scenario;
    #[test_only] use sui::sui::SUI;

    #[test]
    fun test_multiplier_math() {
        // MEDIUM row1: 3/2 * 0.97 = 1.455x = 14550 bps
        assert!(multiplier_after(DIFF_MEDIUM, 1) == 14550, 0);
        // HARD row1: 2/1 * 0.97 = 1.94x = 19400 bps
        assert!(multiplier_after(DIFF_HARD, 1) == 19400, 1);
        // EASY row1: 4/3 * 0.97 = 1.2933 → 12933 bps
        assert!(multiplier_after(DIFF_EASY, 1) == 12933, 2);
        // 0 rows = 1.0x
        assert!(multiplier_after(DIFF_HARD, 0) == 10000, 3);
        // HARD top (9 rows): 2^9 * 0.97 = 512 * 0.97 = 496.64x = 4966400 bps
        assert!(top_multiplier(DIFF_HARD) == 4966400, 4);
        let (t, d) = params(DIFF_EASY);
        assert!(t == 4 && d == 1, 5);
    }

    /// v22: start is disabled on-chain (solution-leak exploit). Confirm it aborts
    /// with EGameDisabled before escrowing any wager.
    #[test]
    #[expected_failure(abort_code = EGameDisabled)]
    fun test_start_disabled() {
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
            start<SUI>(&mut house, &r, bet, DIFF_EASY, ctx); // aborts EGameDisabled
            test_scenario::return_shared(house);
            test_scenario::return_shared(r);
        };
        test_scenario::end(sc);
    }
}
