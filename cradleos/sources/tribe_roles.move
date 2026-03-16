/// tribe_roles.move
/// On-chain role delegation for CradleOS tribes.
/// Roles: ADMIN (0) | OFFICER (1) | TREASURER (2) | RECRUITER (3)
/// Founder (from TribeVault) always has implicit admin — cannot be revoked.
/// Any address with ADMIN role can grant/revoke any role (including other admins).
module cradleos::tribe_roles {
    use sui::table::{Self, Table};
    use sui::event;
    use cradleos::tribe_vault::TribeVault;

    // ── Role constants ────────────────────────────────────────────────────────
    const ROLE_ADMIN:     u8 = 0;
    const ROLE_OFFICER:   u8 = 1;
    const ROLE_TREASURER: u8 = 2;
    const ROLE_RECRUITER: u8 = 3;

    // ── Errors ────────────────────────────────────────────────────────────────
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_ROLE:   u64 = 2;
    const E_ALREADY_HAS_ROLE: u64 = 3;
    const E_DOES_NOT_HAVE_ROLE: u64 = 4;

    // ── Objects ───────────────────────────────────────────────────────────────

    /// Shared object storing all role assignments for a tribe.
    public struct TribeRoles has key {
        id: UID,
        vault_id: ID,
        tribe_id: u32,
        /// address → bitmask of roles (bit N = role N granted)
        roles: Table<address, u8>,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct RoleGranted has copy, drop {
        vault_id: ID,
        tribe_id: u32,
        grantee: address,
        role: u8,
        granted_by: address,
    }

    public struct RoleRevoked has copy, drop {
        vault_id: ID,
        tribe_id: u32,
        revokee: address,
        role: u8,
        revoked_by: address,
    }

    public struct TribeRolesCreated has copy, drop {
        roles_id: ID,
        vault_id: ID,
        tribe_id: u32,
        creator: address,
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun is_valid_role(role: u8): bool {
        role <= ROLE_RECRUITER
    }

    fun has_role_internal(roles: &TribeRoles, addr: address, role: u8): bool {
        if (!table::contains(&roles.roles, addr)) return false;
        let mask = *table::borrow(&roles.roles, addr);
        (mask >> role) & 1 == 1
    }

    fun is_authorized(roles: &TribeRoles, vault: &TribeVault, caller: address): bool {
        caller == cradleos::tribe_vault::founder(vault) || has_role_internal(roles, caller, ROLE_ADMIN)
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Founder creates the TribeRoles object. Must be called once per vault.
    public entry fun create_roles(
        vault: &TribeVault,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::{founder, tribe_id};
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), E_NOT_AUTHORIZED);

        let vid = object::id(vault);
        let tid = tribe_id(vault);
        let roles_id_obj = object::new(ctx);
        let roles_id = object::uid_to_inner(&roles_id_obj);

        event::emit(TribeRolesCreated {
            roles_id,
            vault_id: vid,
            tribe_id: tid,
            creator: caller,
        });

        transfer::share_object(TribeRoles {
            id: roles_id_obj,
            vault_id: vid,
            tribe_id: tid,
            roles: table::new(ctx),
        });
    }

    /// Grant a role to an address. Caller must be founder or ADMIN.
    public entry fun grant_role(
        roles: &mut TribeRoles,
        vault: &TribeVault,
        grantee: address,
        role: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(roles, vault, caller), E_NOT_AUTHORIZED);
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
            vault_id: roles.vault_id,
            tribe_id: roles.tribe_id,
            grantee,
            role,
            granted_by: caller,
        });
    }

    /// Revoke a role from an address. Caller must be founder or ADMIN.
    public entry fun revoke_role(
        roles: &mut TribeRoles,
        vault: &TribeVault,
        revokee: address,
        role: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(roles, vault, caller), E_NOT_AUTHORIZED);
        assert!(is_valid_role(role), E_INVALID_ROLE);
        assert!(table::contains(&roles.roles, revokee), E_DOES_NOT_HAVE_ROLE);

        let mask: u8 = 1 << role;
        let existing = table::borrow_mut(&mut roles.roles, revokee);
        assert!((*existing & mask) != 0, E_DOES_NOT_HAVE_ROLE);
        *existing = *existing & (mask ^ 0xFF);

        event::emit(RoleRevoked {
            vault_id: roles.vault_id,
            tribe_id: roles.tribe_id,
            revokee,
            role,
            revoked_by: caller,
        });
    }

    // ── View helpers (for off-chain reads) ────────────────────────────────────

    public fun has_role(roles: &TribeRoles, addr: address, role: u8): bool {
        has_role_internal(roles, addr, role)
    }

    public fun get_role_mask(roles: &TribeRoles, addr: address): u8 {
        if (!table::contains(&roles.roles, addr)) return 0;
        *table::borrow(&roles.roles, addr)
    }

    public fun vault_id(roles: &TribeRoles): ID { roles.vault_id }
    public fun tribe_id(roles: &TribeRoles): u32 { roles.tribe_id }
}
