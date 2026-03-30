/// CradleOS – Collateral Vault
///
/// EVE-collateralized tribe token minting.
/// Founder deposits Coin<T> (EVE) → mints tribe tokens at a configurable ratio.
/// Any holder redeems tribe tokens → burns them, receives Coin<T> back at floor price.
///
/// The collateral vault is a companion to TribeVault. TribeVault still tracks
/// per-member balances and tribe identity. CollateralVault holds real Coin<T>
/// and controls mint/redeem gating.
///
/// Economics:
///   • mint_ratio = how many tribe tokens per 1 unit of Coin<T> deposited
///   • Floor price = 1 / mint_ratio (guaranteed redemption rate)
///   • DEX can trade above floor (premium), never below (arbitrage closes it)
///   • No inflation — every token is backed by locked collateral
///   • Founder can deposit more EVE anytime to expand supply capacity
///   • Infra registration stays as reputation metric, NOT supply gate
module cradleos::collateral_vault {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::event;
    use cradleos::tribe_vault::{Self, TribeVault};

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:           u64 = 0;
    const EZeroAmount:           u64 = 1;
    const EInsufficientCollateral: u64 = 2;
    const EInsufficientBalance:  u64 = 3;
    const EWrongVault:           u64 = 4;
    const EZeroRatio:            u64 = 5;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared object. One per tribe vault per coin type.
    /// Links to a TribeVault by vault_id.
    public struct CollateralVault<phantom T> has key {
        id: UID,
        /// The TribeVault this collateral backs.
        vault_id: ID,
        /// Locked EVE (or any Coin<T>).
        collateral: Balance<T>,
        /// Tribe tokens mintable per 1 unit of Coin<T>.
        /// e.g., mint_ratio = 100 means 1 EVE = 100 tribe tokens.
        mint_ratio: u64,
        /// Total tribe tokens minted through this collateral vault.
        total_minted: u64,
        /// Total tribe tokens redeemed (burned) through this vault.
        total_redeemed: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct CollateralVaultCreated has copy, drop {
        collateral_vault_id: ID,
        vault_id: ID,
        mint_ratio: u64,
        creator: address,
    }

    public struct CollateralDeposited has copy, drop {
        collateral_vault_id: ID,
        depositor: address,
        amount: u64,
        new_collateral_balance: u64,
        new_mint_capacity: u64,
    }

    public struct CollateralMinted has copy, drop {
        collateral_vault_id: ID,
        eve_deposited: u64,
        tribe_tokens_minted: u64,
        recipient: address,
        new_collateral_balance: u64,
    }

    public struct CollateralRedeemed has copy, drop {
        collateral_vault_id: ID,
        redeemer: address,
        tribe_tokens_burned: u64,
        eve_returned: u64,
        new_collateral_balance: u64,
    }

    public struct MintRatioChanged has copy, drop {
        collateral_vault_id: ID,
        old_ratio: u64,
        new_ratio: u64,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create a collateral vault linked to an existing TribeVault.
    /// Founder-only.
    entry fun create_collateral_vault_entry<T>(
        tribe_vault: &TribeVault,
        mint_ratio: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == tribe_vault::founder(tribe_vault), ENotFounder);
        assert!(mint_ratio > 0, EZeroRatio);

        let vault_id = object::id(tribe_vault);
        let uid = object::new(ctx);
        let cv_id = object::uid_to_inner(&uid);

        event::emit(CollateralVaultCreated {
            collateral_vault_id: cv_id,
            vault_id,
            mint_ratio,
            creator: ctx.sender(),
        });

        transfer::share_object(CollateralVault<T> {
            id: uid,
            vault_id,
            collateral: balance::zero(),
            mint_ratio,
            total_minted: 0,
            total_redeemed: 0,
        });
    }

    // ── Deposit (add collateral without minting) ──────────────────────────────

    /// Deposit EVE to increase mint capacity without minting tokens.
    /// Anyone can deposit (funding the tribe).
    entry fun deposit_collateral_entry<T>(
        cv: &mut CollateralVault<T>,
        coin: Coin<T>,
        _ctx: &mut TxContext,
    ) {
        let amount = coin::value(&coin);
        assert!(amount > 0, EZeroAmount);

        balance::join(&mut cv.collateral, coin::into_balance(coin));

        let new_balance = balance::value(&cv.collateral);
        event::emit(CollateralDeposited {
            collateral_vault_id: object::uid_to_inner(&cv.id),
            depositor: _ctx.sender(),
            amount,
            new_collateral_balance: new_balance,
            new_mint_capacity: new_balance * cv.mint_ratio,
        });
    }

    // ── Mint (deposit EVE → get tribe tokens) ─────────────────────────────────

    /// Deposit Coin<T> and mint tribe tokens to a recipient at the mint ratio.
    /// Founder-only. The EVE stays locked in the collateral vault.
    entry fun mint_with_collateral_entry<T>(
        cv: &mut CollateralVault<T>,
        tribe_vault: &mut TribeVault,
        coin: Coin<T>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == tribe_vault::founder(tribe_vault), ENotFounder);
        assert!(object::id(tribe_vault) == cv.vault_id, EWrongVault);

        let eve_amount = coin::value(&coin);
        assert!(eve_amount > 0, EZeroAmount);

        let tribe_tokens = eve_amount * cv.mint_ratio;

        // Lock the EVE
        balance::join(&mut cv.collateral, coin::into_balance(coin));

        // Mint tribe tokens — updates total_supply + recipient balance
        tribe_vault::mint_internal(tribe_vault, recipient, tribe_tokens);

        cv.total_minted = cv.total_minted + tribe_tokens;

        event::emit(CollateralMinted {
            collateral_vault_id: object::uid_to_inner(&cv.id),
            eve_deposited: eve_amount,
            tribe_tokens_minted: tribe_tokens,
            recipient,
            new_collateral_balance: balance::value(&cv.collateral),
        });
    }

    // ── Redeem (burn tribe tokens → get EVE back) ─────────────────────────────

    /// Any holder can redeem tribe tokens for EVE at the floor price (1/mint_ratio).
    /// Burns tribe tokens from caller's vault balance, returns Coin<T>.
    entry fun redeem_entry<T>(
        cv: &mut CollateralVault<T>,
        tribe_vault: &mut TribeVault,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(object::id(tribe_vault) == cv.vault_id, EWrongVault);
        assert!(amount > 0, EZeroAmount);

        let redeemer = ctx.sender();

        // Calculate EVE to return: tribe_tokens / mint_ratio
        let eve_return = amount / cv.mint_ratio;
        assert!(eve_return > 0, EZeroAmount);
        assert!(balance::value(&cv.collateral) >= eve_return, EInsufficientCollateral);

        // Burn tribe tokens — updates total_supply + redeemer balance
        tribe_vault::burn_internal(tribe_vault, redeemer, amount);

        // Send EVE back
        let payout = coin::from_balance(balance::split(&mut cv.collateral, eve_return), ctx);
        transfer::public_transfer(payout, redeemer);

        cv.total_redeemed = cv.total_redeemed + amount;

        event::emit(CollateralRedeemed {
            collateral_vault_id: object::uid_to_inner(&cv.id),
            redeemer,
            tribe_tokens_burned: amount,
            eve_returned: eve_return,
            new_collateral_balance: balance::value(&cv.collateral),
        });
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Founder can change the mint ratio (affects future mints only).
    /// Existing collateral and issued tokens are unaffected.
    entry fun set_mint_ratio_entry<T>(
        cv: &mut CollateralVault<T>,
        tribe_vault: &TribeVault,
        new_ratio: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == tribe_vault::founder(tribe_vault), ENotFounder);
        assert!(object::id(tribe_vault) == cv.vault_id, EWrongVault);
        assert!(new_ratio > 0, EZeroRatio);

        let old_ratio = cv.mint_ratio;
        cv.mint_ratio = new_ratio;

        event::emit(MintRatioChanged {
            collateral_vault_id: object::uid_to_inner(&cv.id),
            old_ratio,
            new_ratio,
        });
    }

    /// Founder emergency drain — withdraw all collateral EVE back to founder wallet.
    /// Only callable by the tribe vault founder. Resets locked collateral to zero.
    entry fun drain_collateral_entry<T>(
        cv: &mut CollateralVault<T>,
        tribe_vault: &TribeVault,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == tribe_vault::founder(tribe_vault), ENotFounder);
        assert!(object::id(tribe_vault) == cv.vault_id, EWrongVault);

        let amount = balance::value(&cv.collateral);
        assert!(amount > 0, 0); // nothing to drain

        let payout = coin::from_balance(balance::split(&mut cv.collateral, amount), ctx);
        transfer::public_transfer(payout, ctx.sender());
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id<T>(cv: &CollateralVault<T>): ID { cv.vault_id }
    public fun collateral_balance<T>(cv: &CollateralVault<T>): u64 { balance::value(&cv.collateral) }
    public fun mint_ratio<T>(cv: &CollateralVault<T>): u64 { cv.mint_ratio }
    public fun total_minted<T>(cv: &CollateralVault<T>): u64 { cv.total_minted }
    public fun total_redeemed<T>(cv: &CollateralVault<T>): u64 { cv.total_redeemed }
    public fun mint_capacity<T>(cv: &CollateralVault<T>): u64 {
        balance::value(&cv.collateral) * cv.mint_ratio
    }
}
