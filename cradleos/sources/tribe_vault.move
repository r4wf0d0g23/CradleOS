/// CradleOS – Tribe Vault v4
/// Infra-backed tribe accounting. Registering EVE structures mints real
/// Coin<CRADLE_COIN> (CRDL) to the founder. Tribe coins remain as on-chain
/// accounting (Table<address, u64>) — they represent influence/reputation
/// within the tribe and are traded against CRDL on TribeDex.
module cradleos::tribe_vault {
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::Coin;
    use std::string::{Self, String};
    use cradleos::cradle_coin::{Self, CRADLE_COIN, CradleMintController};

    // ── Constants ─────────────────────────────────────────────────────────────

    const ENERGY_MULTIPLIER: u64 = 1000;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:             u64 = 0;
    const EZeroAmount:             u64 = 2;
    const ESupplyCapExceeded:      u64 = 4;
    const EInfraAlreadyRegistered: u64 = 5;
    const EInfraNotFound:          u64 = 6;
    const EInsufficientBalance:    u64 = 7;

    // ── Structs ───────────────────────────────────────────────────────────────

    public struct TribeVault has key {
        id: UID,
        tribe_id: u32,
        founder: address,
        coin_name: String,
        coin_symbol: String,
        /// Total tribe coins in circulation (issued by this vault).
        total_supply: u64,
        /// Per-member balances: member address → tribe coin balance.
        balances: Table<address, u64>,
        /// Registered infra: structure ID → energy_cost.
        registered_infra: Table<address, u64>,
        /// Total CRDL-denominated infra cap (Σ energy_cost × ENERGY_MULTIPLIER).
        infra_credits: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct CoinLaunched has copy, drop {
        vault_id: ID,
        tribe_id: u32,
        founder: address,
        coin_name: String,
        coin_symbol: String,
    }

    public struct InfraRegistered has copy, drop {
        vault_id: ID,
        structure_id: address,
        energy_cost: u64,
        crdl_minted: u64,
        new_infra_credits: u64,
    }

    public struct InfraDeregistered has copy, drop {
        vault_id: ID,
        structure_id: address,
        energy_cost: u64,
        new_infra_credits: u64,
    }

    public struct CoinIssued has copy, drop {
        vault_id: ID,
        recipient: address,
        amount: u64,
        reason: String,
        new_total_supply: u64,
    }

    public struct CoinBurned has copy, drop {
        vault_id: ID,
        from: address,
        amount: u64,
        new_total_supply: u64,
    }

    public struct CoinsTransferred has copy, drop {
        vault_id: ID,
        from: address,
        to: address,
        amount: u64,
    }

    public struct FounderTransferred has copy, drop {
        vault_id: ID,
        new_founder: address,
    }

    // ── Vault lifecycle ───────────────────────────────────────────────────────

    entry fun create_vault(
        tribe_id: u32,
        coin_name: vector<u8>,
        coin_symbol: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let founder = ctx.sender();
        let vault_uid = object::new(ctx);
        let vault_id = object::uid_to_inner(&vault_uid);
        let name   = string::utf8(coin_name);
        let symbol = string::utf8(coin_symbol);
        event::emit(CoinLaunched { vault_id, tribe_id, founder, coin_name: name, coin_symbol: symbol });
        transfer::share_object(TribeVault {
            id: vault_uid,
            tribe_id,
            founder,
            coin_name: name,
            coin_symbol: symbol,
            total_supply: 0,
            balances: table::new(ctx),
            registered_infra: table::new(ctx),
            infra_credits: 0,
        });
    }

    // ── Infra registration — mints CRDL ──────────────────────────────────────

    /// Register an EVE structure. Mints CRDL to the founder proportional to
    /// the structure's energy cost. This is the primary CRDL issuance path.
    entry fun register_structure_entry(
        vault: &mut TribeVault,
        ctrl: &mut CradleMintController,
        structure_id: address,
        energy_cost: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == vault.founder, ENotFounder);
        assert!(!table::contains(&vault.registered_infra, structure_id), EInfraAlreadyRegistered);
        table::add(&mut vault.registered_infra, structure_id, energy_cost);
        let crdl_amount = energy_cost * ENERGY_MULTIPLIER;
        vault.infra_credits = vault.infra_credits + crdl_amount;
        // Mint real CRDL to the founder's wallet
        let crdl = cradle_coin::mint(ctrl, crdl_amount, ctx);
        transfer::public_transfer(crdl, ctx.sender());
        event::emit(InfraRegistered {
            vault_id: object::uid_to_inner(&vault.id),
            structure_id,
            energy_cost,
            crdl_minted: crdl_amount,
            new_infra_credits: vault.infra_credits,
        });
    }

    /// Deregister a structure. Caller must burn their own CRDL to balance supply.
    entry fun deregister_structure_entry(
        vault: &mut TribeVault,
        ctrl: &mut CradleMintController,
        structure_id: address,
        crdl_burn: Coin<CRADLE_COIN>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == vault.founder, ENotFounder);
        assert!(table::contains(&vault.registered_infra, structure_id), EInfraNotFound);
        let energy_cost = table::remove(&mut vault.registered_infra, structure_id);
        let crdl_amount = energy_cost * ENERGY_MULTIPLIER;
        vault.infra_credits = if (vault.infra_credits >= crdl_amount) {
            vault.infra_credits - crdl_amount
        } else { 0 };
        // Burn the returned CRDL
        cradle_coin::burn(ctrl, crdl_burn);
        event::emit(InfraDeregistered {
            vault_id: object::uid_to_inner(&vault.id),
            structure_id,
            energy_cost,
            new_infra_credits: vault.infra_credits,
        });
    }

    // ── Tribe coin operations (accounting) ────────────────────────────────────

    /// Issue tribe coins to a member. Cap enforced by infra_credits.
    entry fun issue_coin_entry(
        vault: &mut TribeVault,
        recipient: address,
        amount: u64,
        reason: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == vault.founder, ENotFounder);
        assert!(amount > 0, EZeroAmount);
        assert!(vault.total_supply + amount <= vault.infra_credits, ESupplyCapExceeded);
        vault.total_supply = vault.total_supply + amount;
        if (!table::contains(&vault.balances, recipient)) {
            table::add(&mut vault.balances, recipient, 0);
        };
        let bal = table::borrow_mut(&mut vault.balances, recipient);
        *bal = *bal + amount;
        event::emit(CoinIssued {
            vault_id: object::uid_to_inner(&vault.id),
            recipient,
            amount,
            reason: string::utf8(reason),
            new_total_supply: vault.total_supply,
        });
    }

    /// Burn tribe coins from a member's balance.
    entry fun burn_coin_entry(
        vault: &mut TribeVault,
        member: address,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == vault.founder, ENotFounder);
        assert!(table::contains(&vault.balances, member), EInsufficientBalance);
        let bal = table::borrow_mut(&mut vault.balances, member);
        assert!(*bal >= amount, EInsufficientBalance);
        *bal = *bal - amount;
        vault.total_supply = if (vault.total_supply >= amount) { vault.total_supply - amount } else { 0 };
        event::emit(CoinBurned {
            vault_id: object::uid_to_inner(&vault.id),
            from: member,
            amount,
            new_total_supply: vault.total_supply,
        });
    }

    /// Transfer tribe coins between members.
    entry fun transfer_coins_entry(
        vault: &mut TribeVault,
        to: address,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        let from = ctx.sender();
        assert!(table::contains(&vault.balances, from), EInsufficientBalance);
        let bal = table::borrow_mut(&mut vault.balances, from);
        assert!(*bal >= amount, EInsufficientBalance);
        *bal = *bal - amount;
        if (!table::contains(&vault.balances, to)) {
            table::add(&mut vault.balances, to, 0);
        };
        let to_bal = table::borrow_mut(&mut vault.balances, to);
        *to_bal = *to_bal + amount;
        event::emit(CoinsTransferred {
            vault_id: object::uid_to_inner(&vault.id),
            from,
            to,
            amount,
        });
    }

    // ── Package-internal helpers for TribeDex ─────────────────────────────────

    public(package) fun debit_balance_internal(
        vault: &mut TribeVault,
        member: address,
        amount: u64,
    ) {
        assert!(table::contains(&vault.balances, member), EInsufficientBalance);
        let bal = table::borrow_mut(&mut vault.balances, member);
        assert!(*bal >= amount, EInsufficientBalance);
        *bal = *bal - amount;
    }

    public(package) fun credit_balance_internal(
        vault: &mut TribeVault,
        member: address,
        amount: u64,
    ) {
        if (!table::contains(&vault.balances, member)) {
            table::add(&mut vault.balances, member, 0);
        };
        let bal = table::borrow_mut(&mut vault.balances, member);
        *bal = *bal + amount;
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun tribe_id(vault: &TribeVault): u32       { vault.tribe_id }
    public fun founder(vault: &TribeVault): address    { vault.founder }
    public fun coin_name(vault: &TribeVault): String   { vault.coin_name }
    public fun coin_symbol(vault: &TribeVault): String { vault.coin_symbol }
    public fun total_supply(vault: &TribeVault): u64   { vault.total_supply }
    public fun infra_credits(vault: &TribeVault): u64  { vault.infra_credits }

    // ── Package-internal: used by character_registry ──────────────────────────

    /// Transfer vault founder to a new address.
    /// Called atomically by character_registry::challenge_and_take_vault.
    public(package) fun set_founder(vault: &mut TribeVault, new_founder: address) {
        vault.founder = new_founder;
        event::emit(FounderTransferred {
            vault_id: object::uid_to_inner(&vault.id),
            new_founder,
        });
    }

    /// Create a vault without re-checking caller auth — auth is enforced by
    /// character_registry::create_vault_with_registry before calling this.
    public(package) fun create_vault_internal(
        founder: address,
        tribe_id: u32,
        coin_name: vector<u8>,
        coin_symbol: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let vault_uid = object::new(ctx);
        let vault_id  = object::uid_to_inner(&vault_uid);
        let name   = string::utf8(coin_name);
        let symbol = string::utf8(coin_symbol);
        event::emit(CoinLaunched { vault_id, tribe_id, founder, coin_name: name, coin_symbol: symbol });
        transfer::share_object(TribeVault {
            id: vault_uid,
            tribe_id,
            founder,
            coin_name: name,
            coin_symbol: symbol,
            total_supply: 0,
            balances: table::new(ctx),
            registered_infra: table::new(ctx),
            infra_credits: 0,
        });
    }
}
