/// tribe_roles.move — standalone package, no TribeVault dependency.
/// Roles: ADMIN (0) | OFFICER (1) | TREASURER (2) | RECRUITER (3)
/// Founder stored in TribeRoles object — transferable via transfer_founder.
/// Any ADMIN can grant/revoke any role including other admins.
module tribe_roles::tribe_roles {
    use sui::table::{Self, Table};
    use sui::event;

    const ROLE_ADMIN:     u8 = 0;
    const ROLE_OFFICER:   u8 = 1;
    const ROLE_TREASURER: u8 = 2;
    const ROLE_RECRUITER: u8 = 3;

    const E_NOT_AUTHORIZED:   u64 = 1;
    const E_INVALID_ROLE:     u64 = 2;
    const E_ALREADY_HAS_ROLE: u64 = 3;
    const E_DOES_NOT_HAVE_ROLE: u64 = 4;

    /// Shared object — one per tribe vault.
    public struct TribeRoles has key {
        id: UID,
        vault_id: address,
        tribe_id: u32,
        founder: address,
        /// address → bitmask of roles (bit N = role N granted)
        roles: Table<address, u8>,
    }

    public struct TribeRolesCreated has copy, drop {
        roles_id: ID,
        vault_id: address,
        tribe_id: u32,
        creator: address,
    }

    public struct RoleGranted has copy, drop {
        roles_id: ID,
        vault_id: address,
        tribe_id: u32,
        grantee: address,
        role: u8,
        granted_by: address,
    }

    public struct RoleRevoked has copy, drop {
        roles_id: ID,
        vault_id: address,
        tribe_id: u32,
        revokee: address,
        role: u8,
        revoked_by: address,
    }

    fun is_valid_role(role: u8): bool { role <= ROLE_RECRUITER }

    fun has_role_internal(roles: &TribeRoles, addr: address, role: u8): bool {
        if (!table::contains(&roles.roles, addr)) return false;
        let mask = *table::borrow(&roles.roles, addr);
        (mask >> role) & 1 == 1
    }

    fun check_auth(roles: &TribeRoles, caller: address) {
        assert!(
            caller == roles.founder || has_role_internal(roles, caller, ROLE_ADMIN),
            E_NOT_AUTHORIZED
        );
    }

    /// Create TribeRoles object. Caller becomes the founder.
    public entry fun create_roles(
        vault_id: address,
        tribe_id: u32,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        let uid = object::new(ctx);
        let roles_id = object::uid_to_inner(&uid);

        event::emit(TribeRolesCreated { roles_id, vault_id, tribe_id, creator: caller });

        transfer::share_object(TribeRoles {
            id: uid,
            vault_id,
            tribe_id,
            founder: caller,
            roles: table::new(ctx),
        });
    }

    /// Transfer founder role to a new address.
    public entry fun transfer_founder(
        roles: &mut TribeRoles,
        new_founder: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == roles.founder, E_NOT_AUTHORIZED);
        roles.founder = new_founder;
    }

    /// Grant a role. Caller must be founder or ADMIN.
    public entry fun grant_role(
        roles: &mut TribeRoles,
        grantee: address,
        role: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        check_auth(roles, caller);
        assert!(is_valid_role(role), E_INVALID_ROLE);

        let mask: u8 = 1 << role;
        if (table::contains(&roles.roles, grantee)) {
            let existing = table::borrow_mut(&mut roles.roles, grantee);
            assert!((*existing & mask) == 0, E_ALREADY_HAS_ROLE);
            *existing = *existing | mask;
        } else {
            table::add(&mut roles.roles, grantee, mask);
        };

        event::emit(RoleGranted {
            roles_id: object::uid_to_inner(&roles.id),
            vault_id: roles.vault_id,
            tribe_id: roles.tribe_id,
            grantee,
            role,
            granted_by: caller,
        });
    }

    /// Revoke a role. Caller must be founder or ADMIN.
    public entry fun revoke_role(
        roles: &mut TribeRoles,
        revokee: address,
        role: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        check_auth(roles, caller);
        assert!(is_valid_role(role), E_INVALID_ROLE);
        assert!(table::contains(&roles.roles, revokee), E_DOES_NOT_HAVE_ROLE);

        let mask: u8 = 1 << role;
        let existing = table::borrow_mut(&mut roles.roles, revokee);
        assert!((*existing & mask) != 0, E_DOES_NOT_HAVE_ROLE);
        *existing = *existing & ((mask ^ 0xFF) as u8);

        event::emit(RoleRevoked {
            roles_id: object::uid_to_inner(&roles.id),
            vault_id: roles.vault_id,
            tribe_id: roles.tribe_id,
            revokee,
            role,
            revoked_by: caller,
        });
    }

    // ── View ────────────────────────────────────────────────────────────────
    public fun has_role(roles: &TribeRoles, addr: address, role: u8): bool {
        has_role_internal(roles, addr, role)
    }
    public fun get_role_mask(roles: &TribeRoles, addr: address): u8 {
        if (!table::contains(&roles.roles, addr)) return 0;
        *table::borrow(&roles.roles, addr)
    }
    public fun vault_id(roles: &TribeRoles): address { roles.vault_id }
    public fun tribe_id(roles: &TribeRoles): u32 { roles.tribe_id }
    public fun founder(roles: &TribeRoles): address { roles.founder }
}
