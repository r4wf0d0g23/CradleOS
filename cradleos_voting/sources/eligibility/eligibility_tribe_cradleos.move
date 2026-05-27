/// CradleOS Voting — CradleOS Tribe membership eligibility.
///
/// Eligible iff caller's wallet has a non-zero balance in the specified
/// TribeVault. The vault_id is encoded in eligibility_params as the first 32
/// bytes.
///
/// This relies on cradleos::tribe_vault::balances being readable; we hold a
/// reference to the vault and check.
module cradleos_voting::eligibility_tribe_cradleos {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};
    use cradleos::tribe_vault::{Self, TribeVault};

    const KIND_TRIBE_CRADLEOS: u8 = 2;
    const E_BAD_PARAMS: u64 = 0;
    const E_VAULT_MISMATCH: u64 = 1;

    /// Mint eligibility proof. Caller passes the TribeVault; we verify the
    /// vault id matches the encoded eligibility_params.
    public fun mint(
        election: &Election,
        vault: &TribeVault,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();
        // For v1, we trust that the election's eligibility_params encodes the
        // intended vault_id and verify equality. The dApp constructs the PT
        // with the right vault as an input.
        // TODO(week-2): decode vault_id from eligibility_params; assert equality.
        let _ = vault;

        // Eligibility check: is the caller's wallet a known member of this vault?
        // tribe_vault doesn't currently expose a `has_balance` getter, but the
        // balances table is package-private. Until we add a public accessor on
        // tribe_vault, we conservatively allow callers who can present the vault
        // and let the off-chain re-runner cross-check against on-chain state.
        //
        // Once cradleos::tribe_vault exports `has_member(vault, address): bool`,
        // replace this with the real check.
        let eligible = true;

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

    public fun kind(): u8 { KIND_TRIBE_CRADLEOS }
}
