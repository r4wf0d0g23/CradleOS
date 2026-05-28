/// CradleOS Voting — Role-weighted vote.
///
/// Weight derived from the voter's role mask in cradleos::tribe_roles for the
/// election's bound vault. weight_params encoded as (all u64 little-endian):
///   [0..8]   weight_admin:     u64
///   [8..16]  weight_officer:   u64
///   [16..24] weight_treasurer: u64
///   [24..32] weight_recruiter: u64
///   [32..40] weight_member:    u64   (default for unflagged members)
///
/// Final weight = max(applicable role weights). If the voter holds multiple
/// roles, only the highest-weight role applies — not additive.
///
/// Security model:
///   - TribeRoles is a shared object owned and maintained by the tribe vault system.
///   - Role grants/revokes are admin-controlled on-chain. No external trust needed.
///   - inputs_hash binds: KIND + all five weight params + the voter's live role mask.
///   - Off-chain reproducibility: replay against TribeRoles state at ballot cast time
///     (block height) to verify the role mask used.
///   - The voter_for_role_lookup address must match ctx.sender(). In sponsored-tx mode
///     where the tx sender ≠ voter, pass the actual voter address explicitly.
module cradleos_voting::weight_role {
    use sui::hash;
    use cradleos_voting::voting::{Self, Election, WeightProof};
    use cradleos::tribe_roles::{Self, TribeRoles};

    const KIND_ROLE: u8 = 1;

    // Error codes
    const E_BAD_PARAMS: u64 = 0;

    // Role index constants (match tribe_roles bit positions)
    const ROLE_ADMIN:     u8 = 0;
    const ROLE_OFFICER:   u8 = 1;
    const ROLE_TREASURER: u8 = 2;
    const ROLE_RECRUITER: u8 = 3;

    // weight_params layout:
    //   [0..8]   weight_admin:     u64 LE
    //   [8..16]  weight_officer:   u64 LE
    //   [16..24] weight_treasurer: u64 LE
    //   [24..32] weight_recruiter: u64 LE
    //   [32..40] weight_member:    u64 LE (floor weight for any eligible voter)

    /// Core mint: reads TribeRoles for the voter's address and computes the
    /// highest applicable weight.
    ///
    /// voter_for_role_lookup: the wallet address to check roles against.
    /// In normal (non-sponsored) txs, pass ctx.sender(). In sponsored txs,
    /// pass the actual voter's wallet address.
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

        // Read the voter's role mask (on-chain, live)
        let role_mask = tribe_roles::get_role_mask(roles, voter_for_role_lookup);

        // weight = max(applicable role weights)
        let mut weight = w_member;
        if (tribe_roles::has_role(roles, voter_for_role_lookup, ROLE_ADMIN) && w_admin > weight) {
            weight = w_admin;
        };
        if (tribe_roles::has_role(roles, voter_for_role_lookup, ROLE_OFFICER) && w_officer > weight) {
            weight = w_officer;
        };
        if (tribe_roles::has_role(roles, voter_for_role_lookup, ROLE_TREASURER) && w_treasurer > weight) {
            weight = w_treasurer;
        };
        if (tribe_roles::has_role(roles, voter_for_role_lookup, ROLE_RECRUITER) && w_recruiter > weight) {
            weight = w_recruiter;
        };

        // inputs_hash binds: KIND + all weight params + voter's role mask at proof time.
        // The role_mask is critical for reproducibility: off-chain verifiers must replay
        // TribeRoles state at the ballot's block height to confirm the same mask.
        let mut hbuf = vector::empty<u8>();
        vector::push_back(&mut hbuf, KIND_ROLE);
        vector::append(&mut hbuf, *params);
        vector::push_back(&mut hbuf, role_mask);
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

    /// Entry: prove role weight and transfer proof to voter.
    /// voter_for_role_lookup = ctx.sender() in non-sponsored mode.
    public entry fun prove_role(
        election: &Election,
        roles: &TribeRoles,
        character_id: u32,
        ctx: &mut TxContext,
    ) {
        let voter = ctx.sender();
        let proof = mint(election, roles, character_id, voter, ctx);
        transfer::public_transfer(proof, voter);
    }

    // ── Little-endian u64 decode ──────────────────────────────────────────────

    fun decode_u64_at(v: &vector<u8>, off: u64): u64 {
        let mut out: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8) {
            let b = (*vector::borrow(v, off + i)) as u64;
            out = out | (b << ((i * 8) as u8));
            i = i + 1;
        };
        out
    }

    public fun kind(): u8 { KIND_ROLE }
}
