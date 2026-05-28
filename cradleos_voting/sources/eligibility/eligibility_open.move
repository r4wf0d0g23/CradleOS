/// CradleOS Voting — Open Eligibility.
///
/// Any verified character_id is eligible. "Verified" means the caller produced
/// a character_id u32 and the proof's voter address matches the tx sender.
/// No on-chain character verification (CradleOS already binds characters to
/// wallets through `cradleos::character_registry`); the dApp UI is expected to
/// only allow this provider for elections where character verification doesn't
/// matter (community polls, etc.).
module cradleos_voting::eligibility_open {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};

    const KIND_OPEN: u8 = 0;

    // Note: prove_open removed. Use mint() in a PTB and pass result to cast_ballot directly.

    /// Mint an open-eligibility proof. Caller asserts character_id; proof is
    /// only valid for the same wallet that mints it.
    /// Direct-return variant for programmable transactions: caller passes the
    /// proof as input to cast_ballot in the same tx, avoiding a transfer hop.
    public fun mint(
        election: &Election,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();
        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_OPEN,
            @cradleos_voting,
            true,
            ctx,
        )
    }

    public fun kind(): u8 { KIND_OPEN }
}
