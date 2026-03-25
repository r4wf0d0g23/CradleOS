module training::gate_permit {
    use sui::object::{Self, UID, ID};
    use sui::event;
    use sui::tx_context::{Self, TxContext};
    use std::vector;
    use std::string;

    // Error codes
    const ENotAdmin: u64 = 0;
    const EUnregisteredTribe: u64 = 1;
    const ENotHolderOrAdmin: u64 = 2;
    const EPermitExpired: u64 = 3;

    struct GateRegistry has key, store {
        id: UID,
        admin: address,
        registered_tribes: vector<address>,
    }

    struct Permit has key, store {
        id: UID,
        gate_id: u64,
        holder: address,
        tribe: address,
        expires_at: u64,
    }

    struct TribeRegistered has copy, drop {
        registry_id: ID,
        tribe: address,
    }

    struct PermitIssued has copy, drop {
        permit_id: ID,
        gate_id: u64,
        holder: address,
        tribe: address,
        expires_at: u64,
    }

    struct PermitRevoked has copy, drop {
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

    public fun register_tribe(registry: &mut GateRegistry, tribe: address, ctx: &mut TxContext) {
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
        let tribe_registered = false;
        let i = 0;
        while (i < vector::length(&registry.registered_tribes)) {
            if (vector::borrow(&registry.registered_tribes, i) == &tribe) {
                tribe_registered = true;
                break;
            };
            i += 1;
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

    public fun revoke(permit: Permit, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == permit.holder, ENotHolderOrAdmin);

        let permit_id = object::id(&permit);
        let Permit { id, gate_id: _, holder: _, tribe: _, expires_at: _ } = permit;

        let reason = string::utf8(b"Revoked by holder");
        event::emit(PermitRevoked {
            permit_id,
            reason,
        });

        object::delete(id);
    }

    #[test]
    fun test_issue_permit() {
        let ctx = tx_context::dummy();
        let registry = create_registry(&mut ctx);
        register_tribe(&mut registry, @0x123, &mut ctx);
        let permit = issue_permit(&registry, 1, @0x456, @0x123, 1000, &mut ctx);
        assert!(is_valid(&permit, 500), 0);
    }

    #[test]
    fun test_permit_expiry() {
        let ctx = tx_context::dummy();
        let registry = create_registry(&mut ctx);
        register_tribe(&mut registry, @0x123, &mut ctx);
        let permit = issue_permit(&registry, 1, @0x456, @0x123, 100, &mut ctx);
        assert!(!is_valid(&permit, 200), 0);
    }

    #[test]
    fun test_revoke_permit() {
        let ctx = tx_context::dummy();
        let registry = create_registry(&mut ctx);
        register_tribe(&mut registry, @0x123, &mut ctx);
        let permit = issue_permit(&registry, 1, @0x456, @0x123, 1000, &mut ctx);
        tx_context::set_sender_for_testing(@0x456);
        revoke(permit, &mut ctx);
    }

    #[test]
    #[expected_failure(abort_code = EUnregisteredTribe)]
    fun test_unregistered_tribe() {
        let ctx = tx_context::dummy();
        let registry = create_registry(&mut ctx);
        let _ = issue_permit(&registry, 1, @0x456, @0x999, 1000, &mut ctx);
    }
}
