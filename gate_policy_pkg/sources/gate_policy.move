/// gate_policy.move — standalone package, no TribeVault dependency
/// Takes vault_id (address) and tribe_id (u32) as raw inputs — same pattern as turret_delegation.
module gate_policy::gate_policy {
    use sui::table::{Self, Table};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::clock::Clock;

    const ACCESS_OPEN:       u8 = 0;
    const ACCESS_TRIBE_ONLY: u8 = 1;
    const ACCESS_CLOSED:     u8 = 3;

    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_LEVEL:  u64 = 2;
    const E_WRONG_VAULT:    u64 = 3;

    public struct TribeGatePolicy has key {
        id: UID,
        vault_id: address,
        tribe_id: u32,
        founder: address,
        access_level: u8,
        tribe_overrides: Table<u32, u8>,
        version: u64,
    }

    public struct GateDelegation has key {
        id: UID,
        gate_id: address,
        vault_id: address,
        tribe_id: u32,
        created_ms: u64,
    }

    public struct PlayerGateKey has copy, drop, store { player: address }

    public struct GatePolicyCreated has copy, drop {
        policy_id: ID,
        vault_id: address,
        tribe_id: u32,
        creator: address,
    }

    public struct GateAccessLevelSet has copy, drop {
        policy_id: ID,
        vault_id: address,
        access_level: u8,
        set_by: address,
        version: u64,
    }

    public struct GateTribeOverrideSet has copy, drop {
        policy_id: ID,
        vault_id: address,
        target_tribe_id: u32,
        value: u8,
        set_by: address,
    }

    public struct GatePlayerOverrideSet has copy, drop {
        policy_id: ID,
        vault_id: address,
        player: address,
        value: u8,
        set_by: address,
    }

    public struct GateDelegated has copy, drop {
        delegation_id: ID,
        gate_id: address,
        vault_id: address,
        tribe_id: u32,
        delegated_by: address,
    }

    public struct GateDelegationRevoked has copy, drop {
        gate_id: address,
        vault_id: address,
        revoked_by: address,
    }

    fun check_auth(policy: &TribeGatePolicy, caller: address) {
        assert!(caller == policy.founder, E_NOT_AUTHORIZED);
    }

    public entry fun create_gate_policy(
        vault_id: address,
        tribe_id: u32,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        let policy_uid = object::new(ctx);
        let policy_id = object::uid_to_inner(&policy_uid);

        event::emit(GatePolicyCreated { policy_id, vault_id, tribe_id, creator: caller });

        transfer::share_object(TribeGatePolicy {
            id: policy_uid,
            vault_id,
            tribe_id,
            founder: caller,
            access_level: ACCESS_TRIBE_ONLY,
            tribe_overrides: table::new(ctx),
            version: 0,
        });
    }

    public entry fun set_access_level(
        policy: &mut TribeGatePolicy,
        level: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        check_auth(policy, caller);
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

    public entry fun transfer_founder(
        policy: &mut TribeGatePolicy,
        new_founder: address,
        ctx: &mut TxContext,
    ) {
        check_auth(policy, tx_context::sender(ctx));
        policy.founder = new_founder;
        policy.version = policy.version + 1;
    }

    public entry fun set_tribe_override(
        policy: &mut TribeGatePolicy,
        target_tribe_id: u32,
        value: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        check_auth(policy, caller);
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
            target_tribe_id, value, set_by: caller,
        });
    }

    public entry fun set_player_override(
        policy: &mut TribeGatePolicy,
        player: address,
        value: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        check_auth(policy, caller);
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
            player, value, set_by: caller,
        });
    }

    public entry fun remove_player_override(
        policy: &mut TribeGatePolicy,
        player: address,
        ctx: &mut TxContext,
    ) {
        check_auth(policy, tx_context::sender(ctx));
        let key = PlayerGateKey { player };
        if (df::exists_(&policy.id, key)) {
            df::remove<PlayerGateKey, u8>(&mut policy.id, key);
            policy.version = policy.version + 1;
        };
    }

    public entry fun delegate_gate(
        gate_id: address,
        vault_id: address,
        tribe_id: u32,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        use sui::clock::timestamp_ms;
        let del_uid = object::new(ctx);
        let del_id = object::uid_to_inner(&del_uid);
        event::emit(GateDelegated {
            delegation_id: del_id, gate_id, vault_id, tribe_id,
            delegated_by: tx_context::sender(ctx),
        });
        transfer::transfer(GateDelegation {
            id: del_uid, gate_id, vault_id, tribe_id,
            created_ms: timestamp_ms(clock),
        }, tx_context::sender(ctx));
    }

    public entry fun revoke_gate_delegation(
        delegation: GateDelegation,
        ctx: &mut TxContext,
    ) {
        let GateDelegation { id, gate_id, vault_id, tribe_id: _, created_ms: _ } = delegation;
        event::emit(GateDelegationRevoked { gate_id, vault_id, revoked_by: tx_context::sender(ctx) });
        object::delete(id);
    }

    public fun access_level(policy: &TribeGatePolicy): u8 { policy.access_level }
    public fun vault_id(policy: &TribeGatePolicy): address { policy.vault_id }
    public fun founder(policy: &TribeGatePolicy): address { policy.founder }
    public fun version(policy: &TribeGatePolicy): u64 { policy.version }
}
