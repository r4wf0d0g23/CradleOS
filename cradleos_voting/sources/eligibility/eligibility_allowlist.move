/// CradleOS Voting — Explicit character_id allowlist.
///
/// election.eligibility_params = BCS<vector<u32>> sorted ascending.
/// Eligible iff binary-search finds the caller's character_id.
///
/// The allowlist is set by the election creator at create_election time.
/// Composite eligibility can build narrower predicates atop this.
module cradleos_voting::eligibility_allowlist {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};

    const KIND_ALLOWLIST: u8 = 1;
    const E_BAD_PARAMS: u64 = 0;

    public fun mint(
        election: &Election,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();
        let eligible = is_in_allowlist(voting::eligibility_params(election), character_id);
        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_ALLOWLIST,
            @cradleos_voting,
            eligible,
            ctx,
        )
    }

    // Note: prove_allowlist removed. Use mint() in a PTB and pass result to cast_ballot directly.

    /// Decode BCS<vector<u32>> and check membership.
    /// Encoding: first 4 bytes = count (little-endian), then 4 bytes per char_id.
    fun is_in_allowlist(params: &vector<u8>, character_id: u32): bool {
        let n = vector::length(params);
        if (n < 4) return false;
        let count = decode_u32_at(params, 0);
        let mut i: u32 = 0;
        while (i < count) {
            let off = 4 + ((i as u64) * 4);
            if (off + 4 > n) return false;
            if (decode_u32_at(params, off) == character_id) return true;
            i = i + 1;
        };
        false
    }

    fun decode_u32_at(v: &vector<u8>, off: u64): u32 {
        let b0 = (*vector::borrow(v, off) as u32);
        let b1 = (*vector::borrow(v, off + 1) as u32);
        let b2 = (*vector::borrow(v, off + 2) as u32);
        let b3 = (*vector::borrow(v, off + 3) as u32);
        b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    }

    public fun kind(): u8 { KIND_ALLOWLIST }
}
