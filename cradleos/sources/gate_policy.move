/// gate_policy.move
/// Tribe-level gate access control — mirrors defense_policy pattern.
///
/// TribeGatePolicy (shared): founder/admins set access rules.
/// GateDelegation (owned):   members assign their gate SSU IDs to follow the tribe policy.
///
/// Access levels:
///   0 = OPEN       — anyone may pass
///   1 = TRIBE_ONLY — only tribe members (by tribe_id)
///   2 = ALLIES     — tribe members + friendly tribes/players
///   3 = CLOSED     — no one except explicit allowlist
module cradleos::gate_policy {
    use sui::table::{Self, Table};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::clock::Clock;
    use cradleos::tribe_vault::TribeVault;

    // ── Access level constants ────────────────────────────────────────────────
    const ACCESS_OPEN:       u8 = 0;
    const ACCESS_TRIBE_ONLY: u8 = 1;
    const ACCESS_ALLIES:     u8 = 2;
    const ACCESS_CLOSED:     u8 = 3;

    // ── Errors ────────────────────────────────────────────────────────────────
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_LEVEL:  u64 = 2;
    const E_WRONG_VAULT:    u64 = 3;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One per TribeVault.
    public struct TribeGatePolicy has key {
        id: UID,
        vault_id: ID,
        tribe_id: u32,
        /// Default access level (see constants above).
        access_level: u8,
        /// tribe_id → ALLOW (1) or DENY (0) explicit override
        tribe_overrides: Table<u32, u8>,
        /// Mutation counter for members to detect changes.
        version: u64,
    }

    /// Owned by the member. Links one gate SSU to a tribe policy.
    public struct GateDelegation has key {
        id: UID,
        /// The in-game gate/SSU object ID (as address).
        gate_id: address,
        vault_id: ID,
        tribe_id: u32,
        created_ms: u64,
    }

    // ── Dynamic field keys ────────────────────────────────────────────────────

    /// Per-player override on the gate policy.
    public struct PlayerGateKey has copy, drop, store { player: address }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct GatePolicyCreated has copy, drop {
        policy_id: ID,
        vault_id: ID,
        tribe_id: u32,
        creator: address,
    }

    public struct GateAccessLevelSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        access_level: u8,
        set_by: address,
        version: u64,
    }

    public struct GateTribeOverrideSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        target_tribe_id: u32,
        value: u8,
        set_by: address,
    }

    public struct GatePlayerOverrideSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        player: address,
        value: u8,
        set_by: address,
    }

    public struct GateDelegated has copy, drop {
        delegation_id: ID,
        gate_id: address,
        vault_id: ID,
        tribe_id: u32,
        delegated_by: address,
        created_ms: u64,
    }

    public struct GateDelegationRevoked has copy, drop {
        gate_id: address,
        vault_id: ID,
        revoked_by: address,
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun is_authorized(vault: &TribeVault, caller: address): bool {
        caller == cradleos::tribe_vault::founder(vault)
    }

    // ── Founder / admin entry functions ───────────────────────────────────────

    /// Create gate policy for a vault. Founder only.
    public entry fun create_gate_policy(
        vault: &TribeVault,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::{founder, tribe_id};
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), E_NOT_AUTHORIZED);

        let vid = object::id(vault);
        let tid = tribe_id(vault);
        let policy_uid = object::new(ctx);
        let policy_id = object::uid_to_inner(&policy_uid);

        event::emit(GatePolicyCreated {
            policy_id,
            vault_id: vid,
            tribe_id: tid,
            creator: caller,
        });

        transfer::share_object(TribeGatePolicy {
            id: policy_uid,
            vault_id: vid,
            tribe_id: tid,
            access_level: ACCESS_TRIBE_ONLY, // default: tribe members only
            tribe_overrides: table::new(ctx),
            version: 0,
        });
    }

    /// Set the default access level.
    public entry fun set_access_level(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        level: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        assert!(level <= ACCESS_CLOSED, E_INVALID_LEVEL);

        policy.access_level = level;
        policy.version = policy.version + 1;

        event::emit(GateAccessLevelSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            access_level: level,
            set_by: caller,
            version: policy.version,
        });
    }

    /// Set a tribe-level override (allow or deny a specific tribe).
    public entry fun set_tribe_override(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        target_tribe_id: u32,
        value: u8, // 1=ALLOW 0=DENY
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        assert!(value == 0 || value == 1, E_INVALID_LEVEL);

        if (table::contains(&policy.tribe_overrides, target_tribe_id)) {
            *table::borrow_mut(&mut policy.tribe_overrides, target_tribe_id) = value;
        } else {
            table::add(&mut policy.tribe_overrides, target_tribe_id, value);
        };
        policy.version = policy.version + 1;

        event::emit(GateTribeOverrideSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            target_tribe_id,
            value,
            set_by: caller,
        });
    }

    /// Set a per-player override (allow or deny a specific wallet).
    public entry fun set_player_override(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        player: address,
        value: u8, // 1=ALLOW 0=DENY
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        assert!(value == 0 || value == 1, E_INVALID_LEVEL);

        let key = PlayerGateKey { player };
        if (df::exists_(&policy.id, key)) {
            *df::borrow_mut<PlayerGateKey, u8>(&mut policy.id, key) = value;
        } else {
            df::add(&mut policy.id, key, value);
        };
        policy.version = policy.version + 1;

        event::emit(GatePlayerOverrideSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            player,
            value,
            set_by: caller,
        });
    }

    /// Remove a player override.
    public entry fun remove_player_override(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        player: address,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);

        let key = PlayerGateKey { player };
        if (df::exists_(&policy.id, key)) {
            df::remove<PlayerGateKey, u8>(&mut policy.id, key);
            policy.version = policy.version + 1;
        };
    }

    // ── Member entry functions ────────────────────────────────────────────────

    /// Member delegates their gate to follow the tribe policy.
    /// Returns an owned GateDelegation object.
    public entry fun delegate_gate(
        gate_id: address,
        vault: &TribeVault,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::{tribe_id};
        use sui::clock::timestamp_ms;

        let vid = object::id(vault);
        let tid = tribe_id(vault);
        let now = timestamp_ms(clock);

        let del_uid = object::new(ctx);
        let del_id = object::uid_to_inner(&del_uid);

        event::emit(GateDelegated {
            delegation_id: del_id,
            gate_id,
            vault_id: vid,
            tribe_id: tid,
            delegated_by: tx_context::sender(ctx),
            created_ms: now,
        });

        transfer::transfer(GateDelegation {
            id: del_uid,
            gate_id,
            vault_id: vid,
            tribe_id: tid,
            created_ms: now,
        }, tx_context::sender(ctx));
    }

    /// Member revokes their gate delegation by destroying the object.
    public entry fun revoke_gate_delegation(
        delegation: GateDelegation,
        ctx: &mut TxContext,
    ) {
        let GateDelegation { id, gate_id, vault_id, tribe_id: _, created_ms: _ } = delegation;

        event::emit(GateDelegationRevoked {
            gate_id,
            vault_id,
            revoked_by: tx_context::sender(ctx),
        });

        object::delete(id);
    }

    // ── View functions ────────────────────────────────────────────────────────

    public fun access_level(policy: &TribeGatePolicy): u8 { policy.access_level }
    public fun vault_id(policy: &TribeGatePolicy): ID { policy.vault_id }
    public fun version(policy: &TribeGatePolicy): u64 { policy.version }
    public fun gate_id(del: &GateDelegation): address { del.gate_id }
}
