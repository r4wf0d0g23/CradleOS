module training::gate_permit {
    use sui::object::{Self, UID, ID};
    use sui::event;
    use sui::tx_context::{Self, TxContext};
    use std::string;

    const ENotAdmin: u64 = 0;
    const EUnregisteredTribe: u64 = 1;
    const ENotHolder: u64 = 2;

    public struct GateRegistry has key, store {
        id: UID,
        admin: address,
        registered_tribes: vector<address>,
    }

    public struct Permit has key, store {
        id: UID,
        gate_id: u64,
        holder: address,
        tribe: address,
        expires_at: u64,
    }

    public struct TribeRegistered has copy, drop {
        registry_id: ID,
        tribe: address,
    }

    public struct PermitIssued has copy, drop {
        permit_id: ID,
        gate_id: u64,
        holder: address,
        tribe: address,
        expires_at: u64,
    }

    public struct PermitRevoked has copy, drop {
        permit_id: ID,
        reason: string::String,
    }

    public fun create_registry(ctx: &mut TxContext): GateRegistry {
        GateRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            registered_tribes: vector[],
        }
    }

    public fun register_tribe(registry: &mut GateRegistry, tribe: address, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == registry.admin, ENotAdmin);
        vector::push_back(&mut registry.registered_tribes, tribe);
        event::emit(TribeRegistered {
            registry_id: object::id(registry),
            tribe,
        });
    }

    public fun issue_permit(
        registry: &GateRegistry,
        gate_id: u64,
        holder: address,
        tribe: address,
        expires_at: u64,
        ctx: &mut TxContext,
    ): Permit {
        let mut tribe_registered = false;
        let mut i = 0;
        while (i < vector::length(&registry.registered_tribes)) {
            if (*vector::borrow(&registry.registered_tribes, i) == tribe) {
                tribe_registered = true;
                break;
            };
            i = i + 1;
        };
        assert!(tribe_registered, EUnregisteredTribe);

        let permit = Permit {
            id: object::new(ctx),
            gate_id,
            holder,
            tribe,
            expires_at,
        };

        event::emit(PermitIssued {
            permit_id: object::id(&permit),
            gate_id,
            holder,
            tribe,
            expires_at,
        });

        permit
    }

    public fun is_valid(permit: &Permit, current_time: u64): bool {
        current_time <= permit.expires_at
    }

    public fun revoke(permit: Permit, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == permit.holder, ENotHolder);
        let permit_id = object::id(&permit);
        let Permit { id, gate_id: _, holder: _, tribe: _, expires_at: _ } = permit;
        event::emit(PermitRevoked {
            permit_id,
            reason: string::utf8(b"Revoked by holder"),
        });
        object::delete(id);
    }
}

#[test_only]
module training::gate_permit_tests {
    use training::gate_permit;
    use sui::test_scenario;

    #[test]
    fun test_issue_permit() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = gate_permit::create_registry(ctx);
            gate_permit::register_tribe(&mut registry, @0x123, ctx);
            let permit = gate_permit::issue_permit(&registry, 1, @0x456, @0x123, 1000, ctx);
            assert!(gate_permit::is_valid(&permit, 500), 0);
            sui::test_utils::destroy(registry);
            sui::test_utils::destroy(permit);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_permit_expiry() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = gate_permit::create_registry(ctx);
            gate_permit::register_tribe(&mut registry, @0x123, ctx);
            let permit = gate_permit::issue_permit(&registry, 1, @0x456, @0x123, 100, ctx);
            assert!(!gate_permit::is_valid(&permit, 200), 0);
            sui::test_utils::destroy(registry);
            sui::test_utils::destroy(permit);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_revoke_permit() {
        // holder is @0x456 — begin scenario as holder so sender matches permit.holder
        let mut scenario = test_scenario::begin(@0x1);
        let permit;
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = gate_permit::create_registry(ctx);
            gate_permit::register_tribe(&mut registry, @0x123, ctx);
            // issue permit to @0x456
            permit = gate_permit::issue_permit(&registry, 1, @0x456, @0x123, 1000, ctx);
            sui::test_utils::destroy(registry);
        };
        // switch sender to @0x456 (the holder) and revoke
        test_scenario::next_tx(&mut scenario, @0x456);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            gate_permit::revoke(permit, ctx);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::gate_permit::EUnregisteredTribe)]
    fun test_unregistered_tribe() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let registry = gate_permit::create_registry(ctx);
            // @0x999 not registered
            let permit = gate_permit::issue_permit(&registry, 1, @0x456, @0x999, 1000, ctx);
            sui::test_utils::destroy(registry);
            sui::test_utils::destroy(permit);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::gate_permit::ENotHolder)]
    fun test_non_holder_revoke() {
        let mut scenario = test_scenario::begin(@0x1);
        let permit;
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = gate_permit::create_registry(ctx);
            gate_permit::register_tribe(&mut registry, @0x123, ctx);
            permit = gate_permit::issue_permit(&registry, 1, @0x456, @0x123, 1000, ctx);
            sui::test_utils::destroy(registry);
        };
        // @0x999 is not the holder
        test_scenario::next_tx(&mut scenario, @0x999);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            gate_permit::revoke(permit, ctx);
        };
        test_scenario::end(scenario);
    }
}
