/// CradleOS Voting — CradleOS Tribe Membership Eligibility.
///
/// Eligible iff the voter's wallet is:
///   (a) the TribeVault founder, OR
///   (b) holds any role in the TribeRoles object for the target tribe.
///
/// ── Security Model ─────────────────────────────────────────────────────────
///
///   ON-CHAIN VERIFIED:
///   • vault.tribe_id == tribe_id encoded in eligibility_params (4 bytes LE).
///     Prevents presenting a different tribe's vault to pass eligibility.
///   • roles.tribe_id == same tribe_id (ensures roles object is for this tribe).
///   • Voter wallet is vault founder OR holds any role bit in TribeRoles.
///
///   SELF-ATTESTATION:
///   • character_id (u32) is supplied by the voter. It is NOT re-verified
///     against the voter's wallet on-chain by this module. The anti-Sybil
///     guarantee is: each character_id may only submit one ballot per election
///     (enforced as a dynamic field key on the Election object in voting.move).
///
///   OPEN QUESTION (surfaced for Raw):
///   • `tribe_vault::balances` is package-private with no public `has_member`
///     accessor. General coin-holders who are not the founder and hold no role
///     cannot currently be verified on-chain. Once cradleos exports
///     `has_member(vault: &TribeVault, member: address): bool`, replace the
///     founder+role check with the broader membership check.
///     Until then, only the founder + assigned role-holders are eligible.
///
///   eligibility_params layout:
///     bytes [0..3] : tribe_id (u32, little-endian)
///
module cradleos_voting::eligibility_tribe_cradleos {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};
    use cradleos::tribe_vault::{Self, TribeVault};
    use cradleos::tribe_roles::{Self, TribeRoles};

    // ── Constants ─────────────────────────────────────────────────────────────

    const KIND_TRIBE_CRADLEOS: u8 = 2;

    // ── Error codes ───────────────────────────────────────────────────────────

    /// eligibility_params too short (need ≥ 4 bytes for tribe_id).
    const E_BAD_PARAMS:     u64 = 0;
    /// vault.tribe_id or roles.tribe_id does not match encoded tribe_id.
    const E_VAULT_MISMATCH: u64 = 1;

    // ── Proof minting ─────────────────────────────────────────────────────────

    /// Mint an eligibility proof checking founder + any-role membership.
    ///
    /// Call from a programmable transaction alongside `cast_ballot`:
    ///   1. `eligibility_tribe_cradleos::mint(election, vault, roles, char_id)`
    ///   2. `voting::cast_ballot(election, ..., proof, ...)`
    ///
    /// Parameters:
    ///   election   — the Election being voted on (read eligibility_params).
    ///   vault      — TribeVault for the target tribe.
    ///   roles      — TribeRoles for the target tribe.
    ///   character_id — voter's in-game character id (self-attested).
    public fun mint(
        election: &Election,
        vault: &TribeVault,
        roles: &TribeRoles,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();

        // ── Verify vault and roles objects match the election's encoded tribe ─
        let params = voting::eligibility_params(election);
        assert!(vector::length(params) >= 4, E_BAD_PARAMS);
        let expected_tribe_id = decode_u32_at(params, 0);
        assert!(tribe_vault::tribe_id(vault) == expected_tribe_id, E_VAULT_MISMATCH);
        assert!(tribe_roles::tribe_id(roles) == expected_tribe_id, E_VAULT_MISMATCH);

        // ── Membership check: founder OR any role holder ──────────────────────
        let is_founder   = tribe_vault::founder(vault) == voter;
        let has_any_role = tribe_roles::get_role_mask(roles, voter) != 0;
        let eligible     = is_founder || has_any_role;

        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_TRIBE_CRADLEOS,
            @cradleos_voting,
            eligible,
            ctx,
        )
    }

    /// Founder-only variant — does not require the TribeRoles object.
    /// Use when the tribe has not yet created a TribeRoles instance.
    public fun mint_founder_only(
        election: &Election,
        vault: &TribeVault,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();

        let params = voting::eligibility_params(election);
        assert!(vector::length(params) >= 4, E_BAD_PARAMS);
        let expected_tribe_id = decode_u32_at(params, 0);
        assert!(tribe_vault::tribe_id(vault) == expected_tribe_id, E_VAULT_MISMATCH);

        let eligible = tribe_vault::founder(vault) == voter;

        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_TRIBE_CRADLEOS,
            @cradleos_voting,
            eligible,
            ctx,
        )
    }

    // Note: prove_cradleos and prove_cradleos_founder removed. Use mint() / mint_founder_only() in a PTB.

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun decode_u32_at(v: &vector<u8>, off: u64): u32 {
        let b0 = (*vector::borrow(v, off)     as u32);
        let b1 = (*vector::borrow(v, off + 1) as u32);
        let b2 = (*vector::borrow(v, off + 2) as u32);
        let b3 = (*vector::borrow(v, off + 3) as u32);
        b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    }

    public fun kind(): u8 { KIND_TRIBE_CRADLEOS }
}
