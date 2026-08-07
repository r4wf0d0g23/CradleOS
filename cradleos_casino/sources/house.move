/// CradleOS Casino — House / Bankroll
///
/// The House is the shared bankroll object that funds all casino games.
/// It is generic over the wager coin type `T` so the same code works with the
/// play-money faucet chip during PoC and with `$EVE` at launch — only the type
/// argument changes at the call site.
///
/// SECURITY MODEL (Sui on-chain randomness):
///   Functions that consume `&Random` MUST be `entry` and non-`public` so they
///   cannot be composed inside a larger PTB that inspects the result and aborts
///   on a loss ("test-and-abort"). The House module itself never touches
///   randomness — it only holds funds and exposes package-private pay/collect
///   primitives that the per-game modules call from inside their own single-tx
///   `entry` resolvers. See sui docs: on-chain randomness + security best
///   practices.
///
/// HOUSE EDGE:
///   The edge is a property of each game's payout table, NOT of this module.
///   This module only guarantees: the house can never pay out more than it
///   holds, and a single bet can never exceed the configured max-bet cap.
module cradleos_casino::house {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::dynamic_field as df;
    use sui::vec_set::{Self, VecSet};
    use world::character::{Self, Character};

    // ── Errors ─────────────────────────────────────────────────────────────
    const ENotAdmin:          u64 = 0;
    const EZeroAmount:        u64 = 1;
    const EBetTooLarge:       u64 = 2;
    const EBetBelowMin:       u64 = 3;
    const EHouseInsufficient: u64 = 4;
    const EGamePaused:        u64 = 5;
    /// Sender is on the House ban list — barred from placing any wager (v24).
    const EBanned:            u64 = 6;
    /// The supplied Character is not owned by the tx sender (v26 identity gate).
    const ENotCharacterOwner: u64 = 7;
    /// Worst-case payout on this bet exceeds the current tier's exposure budget
    /// (v29). Mirrors each game's legacy local `EMaxExposure`, but centralised so
    /// the budget is tier-derived rather than a hardcoded 3% per module.
    const EMaxExposureExceeded: u64 = 9;

    /// Dynamic-field key for the lazily-created VecSet<address> ban list (v24).
    /// Stored as a dynamic field (NOT a struct field) so this is upgrade-safe —
    /// Sui forbids adding fields to existing structs.
    public struct BanKey has copy, drop, store {}

    // ── Capability ───────────────────────────────────────────────────────────
    /// Held by the casino operator (CradleOS treasury controller).
    /// Authorizes bankroll top-up/withdraw and risk-parameter changes.
    public struct HouseAdminCap has key, store {
        id: UID,
        house_id: ID,
    }

    // ── House (shared bankroll) ──────────────────────────────────────────────
    public struct House<phantom T> has key {
        id: UID,
        /// Bankroll available to pay winners.
        bank: Balance<T>,
        /// Maximum single wager, in T's smallest unit. Caps single-bet variance.
        max_bet: u64,
        /// Minimum single wager. Prevents dust-spam griefing.
        min_bet: u64,
        /// Global kill switch — when true, all games reject new bets.
        paused: bool,
        /// Lifetime accounting (informational; emitted for transparency).
        total_wagered: u64,
        total_paid_out: u64,
        bets_settled: u64,
    }

    // ── Events ─────────────────────────────────────────────────────────────
    public struct HouseCreated has copy, drop {
        house_id: ID,
        admin: address,
        max_bet: u64,
        min_bet: u64,
    }

    public struct BankrollChanged has copy, drop {
        house_id: ID,
        delta: u64,
        deposit: bool, // true = deposit, false = withdraw
        new_balance: u64,
    }

    public struct RiskParamsChanged has copy, drop {
        house_id: ID,
        max_bet: u64,
        min_bet: u64,
        paused: bool,
    }

    // ── Creation ─────────────────────────────────────────────────────────────
    /// Create a new House bankroll seeded with `seed` coins. Caller receives the
    /// admin cap. Shares the House so any player can play against it.
    public fun create<T>(
        seed: Coin<T>,
        max_bet: u64,
        min_bet: u64,
        ctx: &mut TxContext,
    ): HouseAdminCap {
        let house = House<T> {
            id: object::new(ctx),
            bank: coin::into_balance(seed),
            max_bet,
            min_bet,
            paused: false,
            total_wagered: 0,
            total_paid_out: 0,
            bets_settled: 0,
        };
        let house_id = object::id(&house);
        let cap = HouseAdminCap { id: object::new(ctx), house_id };
        event::emit(HouseCreated {
            house_id,
            admin: tx_context::sender(ctx),
            max_bet,
            min_bet,
        });
        transfer::share_object(house);
        cap
    }

    /// Convenience entry: create + transfer the admin cap to the sender.
    public fun create_and_share<T>(
        seed: Coin<T>,
        max_bet: u64,
        min_bet: u64,
        ctx: &mut TxContext,
    ) {
        let cap = create<T>(seed, max_bet, min_bet, ctx);
        transfer::public_transfer(cap, tx_context::sender(ctx));
    }

    // ── Admin: bankroll management ───────────────────────────────────────────
    public fun deposit<T>(
        house: &mut House<T>,
        cap: &HouseAdminCap,
        funds: Coin<T>,
    ) {
        assert_admin(house, cap);
        let amount = coin::value(&funds);
        assert!(amount > 0, EZeroAmount);
        balance::join(&mut house.bank, coin::into_balance(funds));
        event::emit(BankrollChanged {
            house_id: object::id(house),
            delta: amount,
            deposit: true,
            new_balance: balance::value(&house.bank),
        });
    }

    public fun withdraw<T>(
        house: &mut House<T>,
        cap: &HouseAdminCap,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert_admin(house, cap);
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&house.bank) >= amount, EHouseInsufficient);
        let out = coin::from_balance(balance::split(&mut house.bank, amount), ctx);
        event::emit(BankrollChanged {
            house_id: object::id(house),
            delta: amount,
            deposit: false,
            new_balance: balance::value(&house.bank),
        });
        transfer::public_transfer(out, tx_context::sender(ctx));
    }

    public fun set_risk_params<T>(
        house: &mut House<T>,
        cap: &HouseAdminCap,
        max_bet: u64,
        min_bet: u64,
        paused: bool,
    ) {
        assert_admin(house, cap);
        house.max_bet = max_bet;
        house.min_bet = min_bet;
        house.paused = paused;
        event::emit(RiskParamsChanged {
            house_id: object::id(house),
            max_bet,
            min_bet,
            paused,
        });
    }

    // ── Dynamic risk tiers (v29) ───────────────────────────────────────────
    //
    // PROBLEM WITH THE FLAT `max_bet`
    // ────────────────────────────────────────────────────────────────────────
    // `house.max_bet` is a single global constant an admin must hand-tune. Every
    // game ALSO enforces its own per-bet exposure guard:
    //
    //     assert!(amount * MAX_MULT_X <= bank_balance * 3 / 100, EMaxExposure)
    //
    // Because game multipliers span 2x (war) to 970x (keno), one global number
    // cannot be right for all of them. Measured against the live bank of
    // 9,851 EVE with the flat 25 EVE cap (audited 2026-08-07):
    //
    //   * 15 of 19 games were ALREADY capped far below 25 EVE by the 3% guard
    //     (keno's real ceiling is 0.20 EVE, diamonds 0.39, video_poker 0.79).
    //     The global cap was decorative on those games.
    //   * 4 low-multiplier games were needlessly throttled: war/andar_bahar can
    //     safely take 98.5 EVE, under_over_7/three_card_poker 32.8 EVE.
    //
    // FIX: derive the cap from the bank and the GAME'S OWN multiplier, and let a
    // tier band set risk appetite as the bank grows. This makes the limit
    // self-scaling — donations grow the bank, limits rise automatically, with no
    // admin action. Solvency is unchanged in the worst case: a single max bet can
    // still only ever cost `exposure_bps` of the bank (verified: 114 consecutive
    // worst-case max-payout losses to walk 9,851 EVE down to 1,000).
    //
    // WHY THE GAME PASSES ITS MULTIPLIER IN:
    //   `MAX_MULT_X` is a `const` inside each game module — not visible from
    //   here. So the game supplies it. This module cannot verify the value is
    //   truthful, but these are `public(package)` entry points callable only by
    //   sibling casino modules in this same package, so the multiplier is
    //   trusted-by-construction (same trust boundary as the existing
    //   pay_winnings). An external contract can never reach these.

    /// Tier band thresholds, in the coin's smallest unit. EVE has 9 decimals, so
    /// 1 EVE = 1_000_000_000. Bands are chosen so a tiny/seed bank is defended
    /// conservatively and a deep bank can accept meaningful action.
    const TIER_SEED_MAX:   u64 =   1_000_000_000_000; //     1,000 EVE
    const TIER_SMALL_MAX:  u64 =  10_000_000_000_000; //    10,000 EVE
    const TIER_MEDIUM_MAX: u64 =  50_000_000_000_000; //    50,000 EVE
    const TIER_LARGE_MAX:  u64 = 250_000_000_000_000; //   250,000 EVE

    /// Basis points of the bank riskable on ONE bet, per tier. 300 bps reproduces
    /// the 3% the games already hardcode, so MEDIUM is behaviour-neutral.
    const BPS_SEED:   u64 = 100; // 1.0%
    const BPS_SMALL:  u64 = 200; // 2.0%
    const BPS_MEDIUM: u64 = 300; // 3.0%  <- matches existing per-game guard
    const BPS_LARGE:  u64 = 400; // 4.0%
    const BPS_WHALE:  u64 = 500; // 5.0%

    /// Tier ordinal, surfaced for UI display. 0=SEED .. 4=WHALE.
    public fun risk_tier<T>(house: &House<T>): u8 {
        let bank = balance::value(&house.bank);
        if (bank < TIER_SEED_MAX) { 0 }
        else if (bank < TIER_SMALL_MAX) { 1 }
        else if (bank < TIER_MEDIUM_MAX) { 2 }
        else if (bank < TIER_LARGE_MAX) { 3 }
        else { 4 }
    }

    /// Basis points of bank riskable on a single bet at the current bank size.
    public fun exposure_bps<T>(house: &House<T>): u64 {
        let t = risk_tier(house);
        if (t == 0) { BPS_SEED }
        else if (t == 1) { BPS_SMALL }
        else if (t == 2) { BPS_MEDIUM }
        else if (t == 3) { BPS_LARGE }
        else { BPS_WHALE }
    }

    /// Total payout the house is willing to expose on ONE bet right now.
    public fun max_exposure<T>(house: &House<T>): u64 {
        balance::value(&house.bank) * exposure_bps(house) / 10_000
    }

    /// The effective maximum bet for a game whose worst-case gross payout is
    /// `max_mult_x` times the stake.
    ///
    /// Returns the tighter of:
    ///   (a) the tier-derived cap  = max_exposure / max_mult_x, and
    ///   (b) the admin's flat `max_bet`, which is retained as an absolute
    ///       ceiling so an operator can always clamp harder than the formula.
    ///
    /// `max_mult_x == 0` is treated as 1 to avoid division-by-zero.
    public fun effective_max_bet<T>(house: &House<T>, max_mult_x: u64): u64 {
        let m = if (max_mult_x == 0) { 1 } else { max_mult_x };
        let derived = max_exposure(house) / m;
        if (derived < house.max_bet) { derived } else { house.max_bet }
    }

    /// Tier-aware wager validation. Same contract as `take_wager`, but the upper
    /// bound is `effective_max_bet(house, max_mult_x)` instead of the flat
    /// `max_bet`. Games should migrate to this; `take_wager` is retained
    /// unchanged for compatibility.
    public(package) fun take_wager_tiered<T>(
        house: &mut House<T>,
        wager: Coin<T>,
        max_mult_x: u64,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(&wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= effective_max_bet(house, max_mult_x), EBetTooLarge);
        balance::join(&mut house.bank, coin::into_balance(wager));
        house.total_wagered = house.total_wagered + amount;
        amount
    }

    /// Tier-aware, non-absorbing variant (commit-reveal games).
    public(package) fun take_wager_amount_tiered<T>(
        house: &House<T>,
        wager: &Coin<T>,
        max_mult_x: u64,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= effective_max_bet(house, max_mult_x), EBetTooLarge);
        amount
    }

    /// Tier-aware multi-bet variant: validates PER-BET amount.
    public(package) fun take_wager_amount_multi_tiered<T>(
        house: &House<T>,
        wager: &Coin<T>,
        count: u64,
        max_mult_x: u64,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        assert!(count >= 1, EZeroAmount);
        let amount = coin::value(wager);
        let per_bet = amount / count;
        assert!(per_bet >= house.min_bet, EBetBelowMin);
        assert!(per_bet <= effective_max_bet(house, max_mult_x), EBetTooLarge);
        amount
    }

    // ── Payout-ceiling API (v29) ───────────────────────────────────────────
    //
    // WHY A SECOND SHAPE EXISTS
    // ────────────────────────────────────────────────────────────────────────
    // `*_tiered` above assumes ONE fixed worst-case multiplier per game
    // (`MAX_MULT_X`). That holds for 19 of 30 casino modules. The other 11 have a
    // payout ceiling that depends on the player's chosen parameters, not a
    // constant:
    //
    //   crash / limbo  -> f(target_bps)      dice -> f(target, over)
    //   coinflip       -> amount * WIN_BPS   mines / dragon_tower / blackjack_live
    //                                        -> depends on progression
    //
    // Those modules already compute an exact `max_payout` before betting. Forcing
    // them through a multiplier would mean inventing a synthetic worst case and
    // rounding it — losing precision on exactly the games where the ceiling is
    // most dynamic. So this variant accepts the COMPUTED CEILING directly.
    //
    // This is the general form: `take_wager_tiered(h, w, m, ctx)` is equivalent to
    // `take_wager_exposure(h, w, amount * m, ctx)`. Both are kept because passing
    // a constant multiplier is clearer at the ~19 fixed-multiplier call sites.

    /// Wager is rejected when its worst-case gross payout exceeds the tier's
    /// single-bet exposure budget. `max_payout_gross` is the largest amount the
    /// house could owe on this bet (stake included), computed by the game.
    ///
    /// This supersedes the per-game `amount * MULT <= bank * 3 / 100` guard: the
    /// share is now tier-derived rather than a hardcoded 3%.
    public(package) fun assert_exposure<T>(house: &House<T>, max_payout_gross: u64) {
        assert!(max_payout_gross <= max_exposure(house), EMaxExposureExceeded);
    }

    /// Tier-aware validation against a COMPUTED payout ceiling, absorbing the
    /// stake into the bank. Use for variable-payout games.
    public(package) fun take_wager_exposure<T>(
        house: &mut House<T>,
        wager: Coin<T>,
        max_payout_gross: u64,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(&wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        // Absolute admin ceiling still applies.
        assert!(amount <= house.max_bet, EBetTooLarge);
        assert!(max_payout_gross <= max_exposure(house), EMaxExposureExceeded);
        balance::join(&mut house.bank, coin::into_balance(wager));
        house.total_wagered = house.total_wagered + amount;
        amount
    }

    /// Non-absorbing variant of `take_wager_exposure` (commit-reveal / escrow
    /// games that bank the stake only at settlement).
    public(package) fun take_wager_amount_exposure<T>(
        house: &House<T>,
        wager: &Coin<T>,
        max_payout_gross: u64,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= house.max_bet, EBetTooLarge);
        assert!(max_payout_gross <= max_exposure(house), EMaxExposureExceeded);
        amount
    }

    // ── Public donations (v29) ─────────────────────────────────────────────
    //
    // PERMISSIONLESS bankroll gifting. Anyone can strengthen the House bank
    // without holding a HouseAdminCap. Deliberate design notes:
    //
    //   * NO admin cap        — that's the whole point; this is public.
    //   * NO ban-list gate    — a banned *bettor* is barred from wagering, but
    //                           barring them from GIFTING the bank protects
    //                           nobody and creates a pointless griefing surface.
    //   * NO Character gate   — unlike every wager path (v26 identity gate),
    //                           donations carry zero adverse-selection risk, so
    //                           any raw wallet may donate. Requiring a live
    //                           in-game Character would only block goodwill.
    //   * NOT counted in total_wagered — a donation is not a bet. Mixing it in
    //                           would corrupt the house-edge / RTP analytics.
    //   * Separate `Donation` event — the donor leaderboard indexer must never
    //                           confuse a public gift with an admin top-up
    //                           (`BankrollChanged`). Distinct struct = clean feed.
    //
    // Donations are IRREVERSIBLE: funds join the bank and can thereafter only
    // leave via winner payouts or admin withdraw. The UI states this plainly.

    /// Emitted on every public donation. Indexed to build the donor leaderboard.
    public struct Donation has copy, drop {
        house_id: ID,
        donor: address,
        amount: u64,
        /// Free-form donor label (in-game handle, tribe ticker, message).
        /// Empty vector when the donor chose to stay anonymous. Capped at
        /// MAX_LABEL_BYTES to keep event payloads bounded.
        label: vector<u8>,
        /// Bank balance AFTER this donation landed.
        new_balance: u64,
    }

    /// Max bytes accepted for a donor label. Keeps the event payload bounded and
    /// prevents storage-griefing via absurd strings.
    const MAX_LABEL_BYTES: u64 = 64;
    /// Supplied donor label exceeded MAX_LABEL_BYTES.
    const ELabelTooLong: u64 = 8;

    /// Donate `funds` to the House bankroll. Permissionless — no cap needed.
    ///
    /// `label` is an optional UTF-8 donor tag surfaced on the leaderboard; pass
    /// an empty vector to donate anonymously. Aborts on a zero-value coin (so a
    /// no-op tx can't spam the donation feed) or an over-long label.
    ///
    /// `entry` + non-`public`: this touches no randomness, but keeping it
    /// non-composable means no external contract can wrap donations into a
    /// larger PTB, which keeps the leaderboard feed honest (one tx = one
    /// attributable gift from a real sender).
    entry fun donate<T>(
        house: &mut House<T>,
        funds: Coin<T>,
        label: vector<u8>,
        ctx: &TxContext,
    ) {
        let amount = coin::value(&funds);
        assert!(amount > 0, EZeroAmount);
        assert!(vector::length(&label) <= MAX_LABEL_BYTES, ELabelTooLong);
        balance::join(&mut house.bank, coin::into_balance(funds));
        event::emit(Donation {
            house_id: object::id(house),
            donor: tx_context::sender(ctx),
            amount,
            label,
            new_balance: balance::value(&house.bank),
        });
    }

    /// Anonymous convenience wrapper — donate with no label.
    entry fun donate_anon<T>(house: &mut House<T>, funds: Coin<T>, ctx: &TxContext) {
        donate(house, funds, vector[], ctx);
    }

    // ── Ban list admin (v24) ───────────────────────────────────────────────
    public struct AddressBanned has copy, drop { house_id: ID, who: address, banned: bool }

    /// Ban a wallet address from placing any wager against this House. Idempotent.
    public fun set_banned<T>(house: &mut House<T>, cap: &HouseAdminCap, who: address, ctx: &mut TxContext) {
        assert_admin(house, cap);
        if (!df::exists_(&house.id, BanKey {})) {
            df::add(&mut house.id, BanKey {}, vec_set::empty<address>());
        };
        let set: &mut VecSet<address> = df::borrow_mut(&mut house.id, BanKey {});
        if (!vec_set::contains(set, &who)) { vec_set::insert(set, who); };
        let _ = ctx;
        event::emit(AddressBanned { house_id: object::id(house), who, banned: true });
    }

    /// Lift a ban on an address. Idempotent.
    public fun unban<T>(house: &mut House<T>, cap: &HouseAdminCap, who: address, ctx: &mut TxContext) {
        assert_admin(house, cap);
        if (df::exists_(&house.id, BanKey {})) {
            let set: &mut VecSet<address> = df::borrow_mut(&mut house.id, BanKey {});
            if (vec_set::contains(set, &who)) { vec_set::remove(set, &who); };
        };
        let _ = ctx;
        event::emit(AddressBanned { house_id: object::id(house), who, banned: false });
    }

    /// True if `who` is on this House's ban list.
    public fun is_banned<T>(house: &House<T>, who: address): bool {
        if (!df::exists_(&house.id, BanKey {})) { return false };
        let set: &VecSet<address> = df::borrow(&house.id, BanKey {});
        vec_set::contains(set, &who)
    }

    /// Abort if the tx sender is banned. Called by every take_wager* path.
    fun assert_not_banned<T>(house: &House<T>, ctx: &TxContext) {
        assert!(!is_banned(house, tx_context::sender(ctx)), EBanned);
    }

    // ── Package-private betting primitives (called by game modules) ───────────
    //
    // A game module resolves an entire bet inside ONE `entry` function that also
    // consumes `&Random`. Within that function it:
    //   1. calls `take_wager` to move the player's stake into the bank,
    //   2. draws randomness + computes the payout,
    //   3. calls `pay_winnings` for the gross payout (stake already in bank).
    //
    // Because these are `public(package)`, only sibling casino game modules can
    // call them — never an external composing contract.

    /// Validate the wager against risk params, absorb it into the bank, and
    /// return the validated wager amount. Aborts if the house is paused, the bet
    /// is out of [min,max], or the bank could not cover a max theoretical payout
    /// is the game's responsibility — this only guards the stake side.
    public(package) fun take_wager<T>(
        house: &mut House<T>,
        wager: Coin<T>,
        ctx: &TxContext,
    ): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(&wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= house.max_bet, EBetTooLarge);
        balance::join(&mut house.bank, coin::into_balance(wager));
        house.total_wagered = house.total_wagered + amount;
        amount
    }

    /// Validate a wager against risk params WITHOUT absorbing it into the bank.
    /// Used by commit-reveal games (blackjack_live) that escrow the stake inside
    /// a per-hand object and only deposit it into the bank at settlement.
    /// Returns the validated wager amount. Aborts on paused / out-of-range.
    public(package) fun take_wager_amount<T>(house: &House<T>, wager: &Coin<T>, ctx: &TxContext): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        let amount = coin::value(wager);
        assert!(amount >= house.min_bet, EBetBelowMin);
        assert!(amount <= house.max_bet, EBetTooLarge);
        amount
    }

    /// Multi-bet variant: validates PER-BET amount (amount/count) against limits.
    /// Use for games like plinko play_multi where a single coin covers N independent bets.
    public(package) fun take_wager_amount_multi<T>(house: &House<T>, wager: &Coin<T>, count: u64, ctx: &TxContext): u64 {
        assert!(!house.paused, EGamePaused);
        assert_not_banned(house, ctx);
        assert!(count >= 1, EZeroAmount);
        let amount = coin::value(wager);
        let per_bet = amount / count;
        assert!(per_bet >= house.min_bet, EBetBelowMin);
        assert!(per_bet <= house.max_bet, EBetTooLarge);
        amount
    }

    /// PROOF-OF-CHARACTER GATE (v26). Every game entry that takes a wager MUST
    /// call this first with an `&Character` the player passes in. It asserts the
    /// tx sender actually owns that Character (sender == character_address). This
    /// closes the identity bypass where any raw Sui wallet holding EVE could bet
    /// directly against the contract, and it means every wager is tied to a live
    /// in-game identity that can face consequences — throwaway/alt wallets whose
    /// Character has been destroyed can no longer play. Also re-checks the ban
    /// list so a single call covers both gates.
    public(package) fun assert_character<T>(house: &House<T>, character: &Character, ctx: &TxContext) {
        assert_not_banned(house, ctx);
        assert!(
            character::character_address(character) == tx_context::sender(ctx),
            ENotCharacterOwner,
        );
    }

    /// Deposit an escrowed stake Balance into the bank (called at settlement by
    /// commit-reveal games). Advances lifetime wagered accounting.
    public(package) fun deposit_stake<T>(house: &mut House<T>, stake: Balance<T>) {
        let amount = balance::value(&stake);
        house.total_wagered = house.total_wagered + amount;
        balance::join(&mut house.bank, stake);
    }

    /// Pay `amount` from the bank to `recipient`. Called by a game module after
    /// computing a win. `amount` is the GROSS payout (includes returned stake).
    /// Aborts if the bank cannot cover it — this is the hard solvency guarantee.
    public(package) fun pay_winnings<T>(
        house: &mut House<T>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        if (amount == 0) {
            house.bets_settled = house.bets_settled + 1;
            return
        };
        assert!(balance::value(&house.bank) >= amount, EHouseInsufficient);
        let out = coin::from_balance(balance::split(&mut house.bank, amount), ctx);
        house.total_paid_out = house.total_paid_out + amount;
        house.bets_settled = house.bets_settled + 1;
        transfer::public_transfer(out, recipient);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    public fun bank_balance<T>(house: &House<T>): u64 { balance::value(&house.bank) }
    public fun max_bet<T>(house: &House<T>): u64 { house.max_bet }
    public fun min_bet<T>(house: &House<T>): u64 { house.min_bet }
    public fun is_paused<T>(house: &House<T>): bool { house.paused }
    public fun total_wagered<T>(house: &House<T>): u64 { house.total_wagered }
    public fun total_paid_out<T>(house: &House<T>): u64 { house.total_paid_out }
    public fun bets_settled<T>(house: &House<T>): u64 { house.bets_settled }
    public fun cap_house_id(cap: &HouseAdminCap): ID { cap.house_id }

    // ── Internal ─────────────────────────────────────────────────────────────
    fun assert_admin<T>(house: &House<T>, cap: &HouseAdminCap) {
        assert!(cap.house_id == object::id(house), ENotAdmin);
    }

    // ── Tests ────────────────────────────────────────────────────────────────
    #[test_only]
    use sui::test_scenario;
    #[test_only]
    use sui::sui::SUI;

    /// v24: a banned sender is rejected by take_wager; unban restores access;
    /// is_banned reflects state. Uses the SAME sender for admin+player for
    /// simplicity (ban check is on tx sender at wager time).
    #[test]
    #[expected_failure(abort_code = EBanned)]
    fun test_banned_sender_rejected() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            set_banned(&mut house, &cap, admin, ctx);
            assert!(is_banned(&house, admin), 0);
            // banned sender tries to wager -> aborts EBanned
            let bet = coin::mint_for_testing<SUI>(10, ctx);
            let _ = take_wager(&mut house, bet, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_unban_restores_access() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            set_banned(&mut house, &cap, admin, ctx);
            assert!(is_banned(&house, admin), 0);
            unban(&mut house, &cap, admin, ctx);
            assert!(!is_banned(&house, admin), 1);
            // now wager succeeds (not banned, within cap)
            let bet = coin::mint_for_testing<SUI>(10, ctx);
            let amt = take_wager(&mut house, bet, ctx);
            assert!(amt == 10, 2);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    // ── Tier tests (v29) ───────────────────────────────────────────────────
    //
    // EVE has 9 decimals. Tests below use whole-EVE units where readable.
    #[test_only] const EVE: u64 = 1_000_000_000;

    /// Helper: build a House with an explicit bank and a very high flat max_bet
    /// so the TIER formula is the binding constraint, not the admin ceiling.
    #[test_only]
    fun house_with_bank(sc: &mut test_scenario::Scenario, admin: address, bank: u64) {
        let ctx = test_scenario::ctx(sc);
        let seed = coin::mint_for_testing<SUI>(bank, ctx);
        // max_bet deliberately enormous -> tier math governs.
        let cap = create<SUI>(seed, 1_000_000_000 * EVE, 1, ctx);
        transfer::public_transfer(cap, admin);
    }

    /// Tier boundaries map to the intended bps bands.
    #[test]
    fun test_risk_tier_bands() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 500 * EVE); // < 1,000 -> SEED
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            assert!(risk_tier(&house) == 0, 0);
            assert!(exposure_bps(&house) == BPS_SEED, 1);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// 9,851 EVE (the live bank on 2026-08-07) must land in SMALL / 200 bps.
    #[test]
    fun test_live_bank_is_small_tier() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            assert!(risk_tier(&house) == 1, 0);
            assert!(exposure_bps(&house) == BPS_SMALL, 1);
            // 2% of 9,851 EVE = 197.02 EVE of single-bet exposure.
            assert!(max_exposure(&house) == 197_020_000_000, 2);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// The headline fix: a 970x game (keno) and a 2x game (war) get very
    /// different caps off the SAME bank. Values cross-checked against the
    /// independent risk model: keno 0.2031 EVE, war 98.51 EVE at 9,851 bank.
    #[test]
    fun test_effective_max_bet_scales_inversely_with_multiplier() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            let exposure = max_exposure(&house); // 197.02 EVE
            // keno @970x -> 197.02/970 = 0.203113... EVE
            assert!(effective_max_bet(&house, 970) == exposure / 970, 0);
            assert!(effective_max_bet(&house, 970) == 203_113_402, 1);
            // war @2x -> 98.51 EVE
            assert!(effective_max_bet(&house, 2) == 98_510_000_000, 2);
            // A low-multiplier game is allowed FAR more than the old flat 25 EVE.
            assert!(effective_max_bet(&house, 2) > 25 * EVE, 3);
            // A high-multiplier game is capped FAR below the old flat 25 EVE.
            assert!(effective_max_bet(&house, 970) < 25 * EVE, 4);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// The admin's flat `max_bet` still acts as an absolute ceiling: if it is
    /// tighter than the tier formula, it wins. Operator can always clamp harder.
    #[test]
    fun test_admin_max_bet_is_absolute_ceiling() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(9_851 * EVE, ctx);
            // Flat cap of 5 EVE is tighter than war's tier-derived 98.51 EVE.
            let cap = create<SUI>(seed, 5 * EVE, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            assert!(effective_max_bet(&house, 2) == 5 * EVE, 0);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// Donations grow the bank, which RAISES limits with no admin action — the
    /// link between the two v29 features. Crossing 10,000 EVE moves SMALL->MEDIUM.
    #[test]
    fun test_donation_can_promote_tier_and_raise_limits() {
        let admin = @0xAD;
        let donor = @0xD0;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE); // SMALL / 200bps
        test_scenario::next_tx(&mut sc, donor);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            assert!(risk_tier(&house) == 1, 0);
            let before = effective_max_bet(&house, 970);
            let ctx = test_scenario::ctx(&mut sc);
            // Push bank over the 10,000 EVE MEDIUM threshold.
            let gift = coin::mint_for_testing<SUI>(200 * EVE, ctx);
            donate(&mut house, gift, b"bankroll", ctx);
            assert!(risk_tier(&house) == 2, 1);
            assert!(exposure_bps(&house) == BPS_MEDIUM, 2);
            // Same game, strictly higher ceiling, purely from the donation.
            assert!(effective_max_bet(&house, 970) > before, 3);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// A bet above the tier-derived cap is rejected even though it is well under
    /// the admin's flat max_bet.
    #[test]
    #[expected_failure(abort_code = EBetTooLarge)]
    fun test_tiered_wager_rejects_above_derived_cap() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            // keno cap is ~0.203 EVE; 1 EVE must abort.
            let bet = coin::mint_for_testing<SUI>(1 * EVE, ctx);
            let _ = take_wager_tiered(&mut house, bet, 970, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// A bet exactly AT the derived cap is accepted (boundary is inclusive).
    #[test]
    fun test_tiered_wager_accepts_at_derived_cap() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap_amt = effective_max_bet(&house, 970);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(cap_amt, ctx);
            let amt = take_wager_tiered(&mut house, bet, 970, ctx);
            assert!(amt == cap_amt, 0);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// max_mult_x = 0 must not divide-by-zero; treated as 1x.
    #[test]
    fun test_zero_multiplier_treated_as_one() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            assert!(effective_max_bet(&house, 0) == effective_max_bet(&house, 1), 0);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// Solvency invariant: the worst-case payout on a single max bet can never
    /// exceed the tier's stated exposure share of the bank, for ANY multiplier.
    #[test]
    fun test_worst_case_payout_never_exceeds_tier_exposure() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            let exposure = max_exposure(&house);
            // Sweep the real multiplier spread used by live games.
            let mults = vector[2u64, 6, 9, 10, 12, 13, 18, 20, 35, 60, 100, 130, 250, 500, 970];
            let mut i = 0;
            while (i < vector::length(&mults)) {
                let m = *vector::borrow(&mults, i);
                let cap_amt = effective_max_bet(&house, m);
                // Integer division floors, so worst-case gross <= exposure always.
                assert!(cap_amt * m <= exposure, i);
                i = i + 1;
            };
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: the payout-ceiling API is the GENERAL form of the multiplier API.
    /// take_wager_tiered(h,w,m) must be equivalent to
    /// take_wager_exposure(h,w,amount*m) for the same bet.
    #[test]
    fun test_exposure_api_equivalent_to_multiplier_api() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            let exposure = max_exposure(&house);
            // The multiplier cap for 970x, expressed as a payout ceiling, is the
            // largest stake whose stake*970 still fits the exposure budget.
            let cap_mult = effective_max_bet(&house, 970);
            assert!(cap_mult * 970 <= exposure, 0);
            // One unit more must breach it (proves the cap is tight, not loose).
            assert!((cap_mult + 1) * 970 > exposure, 1);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: a variable-payout bet whose computed ceiling fits the budget is
    /// accepted, and the stake lands in the bank.
    #[test]
    fun test_take_wager_exposure_accepts_within_budget() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let budget = max_exposure(&house);
            let bank_before = bank_balance(&house);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(10 * EVE, ctx);
            // Worst case exactly AT the budget -> allowed (inclusive bound).
            let amt = take_wager_exposure(&mut house, bet, budget, ctx);
            assert!(amt == 10 * EVE, 0);
            assert!(bank_balance(&house) == bank_before + 10 * EVE, 1);
            assert!(total_wagered(&house) == 10 * EVE, 2);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: a ceiling one unit over the budget aborts. This is the guard that
    /// replaces each game's hardcoded `bank * 3 / 100` check.
    #[test]
    #[expected_failure(abort_code = EMaxExposureExceeded)]
    fun test_take_wager_exposure_rejects_over_budget() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let budget = max_exposure(&house);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(1 * EVE, ctx);
            let _ = take_wager_exposure(&mut house, bet, budget + 1, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: the non-absorbing variant validates without banking the stake —
    /// escrow games must not see their bank grow at bet time.
    #[test]
    fun test_take_wager_amount_exposure_does_not_bank_stake() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let house = test_scenario::take_shared<House<SUI>>(&sc);
            let budget = max_exposure(&house);
            let bank_before = bank_balance(&house);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(5 * EVE, ctx);
            let amt = take_wager_amount_exposure(&house, &bet, budget, ctx);
            assert!(amt == 5 * EVE, 0);
            assert!(bank_balance(&house) == bank_before, 1); // untouched
            assert!(total_wagered(&house) == 0, 2);          // not yet a wager
            coin::burn_for_testing(bet);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: the admin's flat max_bet still clamps the exposure path, even when
    /// the payout ceiling would otherwise fit the budget.
    #[test]
    #[expected_failure(abort_code = EBetTooLarge)]
    fun test_exposure_path_still_respects_admin_max_bet() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(9_851 * EVE, ctx);
            let cap = create<SUI>(seed, 5 * EVE, 1, ctx); // hard 5 EVE ceiling
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(6 * EVE, ctx); // > 5 EVE
            let _ = take_wager_exposure(&mut house, bet, 1, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: paused house rejects the exposure path too (kill switch is global).
    #[test]
    #[expected_failure(abort_code = EGamePaused)]
    fun test_exposure_path_respects_pause() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        house_with_bank(&mut sc, admin, 9_851 * EVE);
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            set_risk_params(&mut house, &cap, 1_000_000 * EVE, 1, true); // paused
            let ctx = test_scenario::ctx(&mut sc);
            let bet = coin::mint_for_testing<SUI>(1 * EVE, ctx);
            let _ = take_wager_exposure(&mut house, bet, 1, ctx);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    /// v29: a non-admin wallet can donate; bank grows; total_wagered is NOT
    /// touched (a gift is not a bet) and bets_settled stays put.
    #[test]
    fun test_public_donation_grows_bank_without_polluting_wager_stats() {
        let admin = @0xAD;
        let donor = @0xD0;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        // A wallet that holds NO admin cap donates.
        test_scenario::next_tx(&mut sc, donor);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let gift = coin::mint_for_testing<SUI>(750, ctx);
            donate(&mut house, gift, b"REAPERS", ctx);
            assert!(bank_balance(&house) == 1_750, 0);
            // A donation must NOT be counted as a wager — RTP analytics stay clean.
            assert!(total_wagered(&house) == 0, 1);
            assert!(total_paid_out(&house) == 0, 2);
            assert!(bets_settled(&house) == 0, 3);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: anonymous wrapper works and also credits the bank.
    #[test]
    fun test_anonymous_donation() {
        let admin = @0xAD;
        let donor = @0xD0;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(500, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, donor);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let gift = coin::mint_for_testing<SUI>(250, ctx);
            donate_anon(&mut house, gift, ctx);
            assert!(bank_balance(&house) == 750, 0);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: a BANNED wallet may still donate. Banning bars wagering, not gifting.
    #[test]
    fun test_banned_wallet_may_still_donate() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            set_banned(&mut house, &cap, admin, ctx);
            assert!(is_banned(&house, admin), 0);
            // Banned sender donates anyway -> must succeed.
            let gift = coin::mint_for_testing<SUI>(400, ctx);
            donate(&mut house, gift, b"sorry", ctx);
            assert!(bank_balance(&house) == 1_400, 1);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    /// v29: zero-value donation aborts — keeps the donation feed free of no-op spam.
    #[test]
    #[expected_failure(abort_code = EZeroAmount)]
    fun test_zero_donation_rejected() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let empty = coin::mint_for_testing<SUI>(0, ctx);
            donate(&mut house, empty, b"", ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    /// v29: an over-long donor label aborts (bounded event payloads).
    #[test]
    #[expected_failure(abort_code = ELabelTooLong)]
    fun test_overlong_label_rejected() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let gift = coin::mint_for_testing<SUI>(10, ctx);
            // 65 bytes > MAX_LABEL_BYTES (64)
            let long = b"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
            donate(&mut house, gift, long, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }

    #[test]
    fun test_create_and_deposit_withdraw() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let cap = test_scenario::take_from_sender<HouseAdminCap>(&sc);
            assert!(bank_balance(&house) == 1_000, 0);
            let ctx = test_scenario::ctx(&mut sc);
            let more = coin::mint_for_testing<SUI>(500, ctx);
            deposit(&mut house, &cap, more);
            assert!(bank_balance(&house) == 1_500, 1);
            withdraw(&mut house, &cap, 300, ctx);
            assert!(bank_balance(&house) == 1_200, 2);
            test_scenario::return_shared(house);
            test_scenario::return_to_sender(&sc, cap);
        };
        test_scenario::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = EBetTooLarge)]
    fun test_wager_cap_enforced() {
        let admin = @0xAD;
        let mut sc = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut sc);
            let seed = coin::mint_for_testing<SUI>(1_000, ctx);
            let cap = create<SUI>(seed, 100, 1, ctx);
            transfer::public_transfer(cap, admin);
        };
        test_scenario::next_tx(&mut sc, admin);
        {
            let mut house = test_scenario::take_shared<House<SUI>>(&sc);
            let ctx = test_scenario::ctx(&mut sc);
            let oversized = coin::mint_for_testing<SUI>(200, ctx); // > max_bet 100
            let _ = take_wager(&mut house, oversized, ctx);
            test_scenario::return_shared(house);
        };
        test_scenario::end(sc);
    }
}
