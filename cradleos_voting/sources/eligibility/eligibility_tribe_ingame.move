/// CradleOS Voting — In-game Tribe membership eligibility.
///
/// Eligible iff the caller's character_id is flagged friendly in the bound
/// TribeDefensePolicy's FriendlyCharacterSet, OR (preferred path) matches the
/// in-game tribe via cradleos::character_registry attestations.
///
/// FULL IMPLEMENTATION DEFERRED to week-2.
module cradleos_voting::eligibility_tribe_ingame {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};
    use cradleos::defense_policy::{Self, TribeDefensePolicy};

    const KIND_TRIBE_INGAME: u8 = 3;

    /// Mint eligibility proof — eligible if the FriendlyCharacterSet contains
    /// character_id, OR if the in-game tribe (via attestation) matches the
    /// encoded tribe_id in eligibility_params.
    public fun mint(
        election: &Election,
        policy: &TribeDefensePolicy,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();
        // Path 1: friendly character flag
        let eligible = defense_policy::is_friendly_character(policy, character_id);
        // TODO(week-2): Path 2 — verify attestation that character is in tribe_id.

        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_TRIBE_INGAME,
            @cradleos_voting,
            eligible,
            ctx,
        )
    }

    public fun kind(): u8 { KIND_TRIBE_INGAME }
}
