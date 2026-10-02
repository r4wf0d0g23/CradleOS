/// Open voting requires a real current-world Character owned by the sender.
/// A caller-supplied numeric character ID alone is not identity proof.
module cradleos_voting::eligibility_open {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};

    use world::character::{Self, Character};
    use world::in_game_id;
    const E_NOT_CHARACTER_OWNER: u64 = 1;

    const KIND_OPEN: u8 = 0;

    // Note: prove_open removed. Use mint() in a PTB and pass result to cast_ballot directly.

    /// Mint an open-eligibility proof. Character ownership is checked on-chain; proof is
    /// only valid for the same wallet that mints it.
    /// Direct-return variant for programmable transactions: caller passes the
    /// proof as input to cast_ballot in the same tx, avoiding a transfer hop.
    public fun mint(
        election: &Election,
        character: &Character,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();
        assert!(character::character_address(character) == voter, E_NOT_CHARACTER_OWNER);
        let character_id = in_game_id::item_id(&character::key(character)) as u32;
        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_OPEN,
            voting::provider_package(),
            true,
            ctx,
        )
    }

    public fun kind(): u8 { KIND_OPEN }
}
