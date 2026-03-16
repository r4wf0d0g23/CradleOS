/// turret_delegation.move
/// Records a tribe member's on-chain intent to delegate a structure to the
/// tribe's defense policy.
///
/// Each delegation is an owned object held by the member.  Passing it to
/// revoke_delegation destroys it.  No global registry required — members
/// manage their own delegation objects.
module cradleos::turret_delegation {
    use sui::clock::{Self, Clock};
    use sui::event;

    // ── Errors ────────────────────────────────────────────────────────────────
    const E_NOT_OWNER: u64 = 1;

    // ── Types ─────────────────────────────────────────────────────────────────

    /// One structure/turret delegated to a tribe defense policy.
    /// Owned by the member; destroy to revoke.
    public struct TurretDelegation has key, store {
        id: UID,
        /// On-chain address of the delegated structure (SmartAssembly object ID)
        structure_id: address,
        /// Wallet address of the member who owns the structure
        owner: address,
        /// Tribe vault object ID whose policy this structure now follows
        tribe_vault_id: address,
        /// Unix ms timestamp when delegation was created/last updated
        delegated_at: u64,
        /// Whether the delegation is currently active
        active: bool,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct DelegationCreated has copy, drop {
        delegation_id: address,
        structure_id: address,
        tribe_vault_id: address,
        owner: address,
        timestamp: u64,
    }

    public struct DelegationRevoked has copy, drop {
        delegation_id: address,
        structure_id: address,
        owner: address,
        timestamp: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Delegate a structure to the tribe defense policy.
    /// Creates a TurretDelegation object owned by the caller.
    public entry fun delegate_to_tribe(
        structure_id: address,
        tribe_vault_id: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let owner = tx_context::sender(ctx);

        let delegation_id_ref = object::new(ctx);
        let delegation_addr = object::uid_to_address(&delegation_id_ref);

        let delegation = TurretDelegation {
            id: delegation_id_ref,
            structure_id,
            owner,
            tribe_vault_id,
            delegated_at: now,
            active: true,
        };

        event::emit(DelegationCreated {
            delegation_id: delegation_addr,
            structure_id,
            tribe_vault_id,
            owner,
            timestamp: now,
        });

        transfer::transfer(delegation, owner);
    }

    /// Revoke a delegation by destroying the delegation object.
    public entry fun revoke_delegation(
        delegation: TurretDelegation,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(delegation.owner == tx_context::sender(ctx), E_NOT_OWNER);

        let now = clock::timestamp_ms(clock);
        let TurretDelegation { id, structure_id, owner, tribe_vault_id: _, delegated_at: _, active: _ } = delegation;
        let delegation_addr = object::uid_to_address(&id);

        event::emit(DelegationRevoked {
            delegation_id: delegation_addr,
            structure_id,
            owner,
            timestamp: now,
        });

        object::delete(id);
    }

    // ── Read helpers ──────────────────────────────────────────────────────────

    public fun structure_id(d: &TurretDelegation): address { d.structure_id }
    public fun tribe_vault_id(d: &TurretDelegation): address { d.tribe_vault_id }
    public fun owner(d: &TurretDelegation): address { d.owner }
    public fun is_active(d: &TurretDelegation): bool { d.active }
}
