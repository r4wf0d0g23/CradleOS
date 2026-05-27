/// CradleOS Voting — Role-weighted vote.
///
/// Weight derived from the voter's role mask in cradleos::tribe_roles for the
/// election's bound vault. weight_params encoded as:
///   [0..8]   weight_admin:     u64
///   [8..16]  weight_officer:   u64
///   [16..24] weight_treasurer: u64
///   [24..32] weight_recruiter: u64
///   [32..40] weight_member:    u64   (default for unflagged members)
///
/// Final weight = max(applicable role weights).
module cradleos_voting::weight_role {
    use sui::hash;
    use cradleos_voting::voting::{Self, Election, WeightProof};
    use cradleos::tribe_roles::{Self, TribeRoles};

    const KIND_ROLE: u8 = 1;
    const E_BAD_PARAMS: u64 = 0;

    public fun mint(
        election: &Election,
        roles: &TribeRoles,
        character_id: u32,
        voter_for_role_lookup: address,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 40, E_BAD_PARAMS);
        let w_admin     = decode_u64_at(params, 0);
        let w_officer   = decode_u64_at(params, 8);
        let w_treasurer = decode_u64_at(params, 16);
        let w_recruiter = decode_u64_at(params, 24);
        let w_member    = decode_u64_at(params, 32);

        let mut weight = w_member;
        if (tribe_roles::has_role(roles, voter_for_role_lookup, 0) && w_admin > weight)     weight = w_admin;
        if (tribe_roles::has_role(roles, voter_for_role_lookup, 1) && w_officer > weight)   weight = w_officer;
        if (tribe_roles::has_role(roles, voter_for_role_lookup, 2) && w_treasurer > weight) weight = w_treasurer;
        if (tribe_roles::has_role(roles, voter_for_role_lookup, 3) && w_recruiter > weight) weight = w_recruiter;

        let mut hbuf = vector::empty<u8>();
        vector::push_back(&mut hbuf, KIND_ROLE);
        vector::append(&mut hbuf, *params);
        let inputs_hash = hash::keccak256(&hbuf);

        voting::mint_weight_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_ROLE,
            @cradleos_voting,
            weight,
            inputs_hash,
            ctx,
        )
    }

    fun decode_u64_at(v: &vector<u8>, off: u64): u64 {
        let mut out: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8) {
            let b = *vector::borrow(v, off + i) as u64;
            out = out | (b << ((i * 8) as u8));
            i = i + 1;
        };
        out
    }

    public fun kind(): u8 { KIND_ROLE }
}
