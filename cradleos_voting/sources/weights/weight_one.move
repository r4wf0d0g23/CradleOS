/// CradleOS Voting — 1-character-1-vote weight.
/// Every eligible voter has weight = 1.
module cradleos_voting::weight_one {
    use sui::hash;
    use cradleos_voting::voting::{Self, Election, WeightProof};

    const KIND_ONE: u8 = 0;

    public fun mint(
        election: &Election,
        character_id: u32,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let inputs_hash = hash::keccak256(&vector::singleton<u8>(KIND_ONE));
        voting::mint_weight_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_ONE,
            @cradleos_voting,
            1,
            inputs_hash,
            ctx,
        )
    }

    // Note: prove_one removed. Use mint() in a PTB and pass result to cast_ballot directly.

    public fun kind(): u8 { KIND_ONE }
}
