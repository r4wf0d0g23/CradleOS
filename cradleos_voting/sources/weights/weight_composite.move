/// CradleOS Voting — Composite weight combinator.
///
/// Combines N already-minted child WeightProofs into a single composite proof
/// using a creator-specified combination function. Each child proof must have been
/// minted in the same transaction (same epoch) for the same voter, character, and
/// election — the composite verifies all three before combining.
///
/// Combination modes (weight_params[0]):
///   0 = SUM:          combined = Σ weights[i]
///   1 = MAX:          combined = max(weights[i])
///   2 = MIN:          combined = min(weights[i])
///   3 = AVG:          combined = floor(Σ weights[i] / N)
///   4 = WEIGHTED_AVG: combined = floor(Σ weights[i] * coeffs[i] / Σ coeffs[i])
///
/// weight_params layout:
///   [0]        combinator:      u8
///   (WEIGHTED_AVG only):
///   [1..9]     n_children:      u64 LE  (must match actual proof count)
///   [9..9+8*N] coeffs[0..N-1]: u64 LE each
///
/// Typical use: combine role weight (hierarchical authority) + char_age weight
///   (loyalty bonus) into a composite that rewards both tenure and rank.
///
/// PTB usage:
///   1. In your PTB, call weight_role::prove_role → get WeightProof A (do NOT transfer yet)
///   2. Call weight_char_age::prove_char_age_... → get WeightProof B
///   3. Construct vector<WeightProof> = [A, B] via makeMoveVec
///   4. Call weight_composite::prove_composite(election, child_proofs, character_id)
///   5. The composite proof is transferred to the voter.
///   Note: child proofs are consumed (deleted) when composite is minted. Do not
///   transfer child proofs to the voter — pass them directly to this module.
///
/// Security model:
///   - Child proofs are consumed (extract_weight_proof deletes their UIDs).
///     No child proof can be used both in a composite AND standalone.
///   - All child proofs must share: election_id, voter address, character_id,
///     and minted_epoch == ctx.epoch(). Any mismatch aborts the tx.
///   - inputs_hash binds: combinator + all child weights + all child inputs_hashes.
///     The full audit chain is preserved: each child inputs_hash encodes its own
///     deterministic inputs (role mask, balance, age, etc.).
///   - WEIGHTED_AVG uses u128 intermediate arithmetic to prevent overflow when
///     weights * coefficients exceed u64::MAX (e.g. large balances × large coeffs).
///   - Cross-cutting change: voting.move requires extract_weight_proof(package) accessor.
///     This is a one-liner added alongside this implementation and documented in the
///     design doc open questions.
module cradleos_voting::weight_composite {
    use sui::hash;
    use cradleos_voting::voting::{Self, Election, WeightProof};

    const KIND_COMPOSITE: u8 = 4;

    // Combinator constants
    const COMB_SUM:          u8 = 0;
    const COMB_MAX:          u8 = 1;
    const COMB_MIN:          u8 = 2;
    const COMB_AVG:          u8 = 3;
    const COMB_WEIGHTED_AVG: u8 = 4;

    // Error codes
    const E_BAD_PARAMS:         u64 = 0;
    const E_NO_CHILDREN:        u64 = 1;
    const E_PROOF_MISMATCH:     u64 = 2;
    const E_PROOF_STALE:        u64 = 3;
    const E_INVALID_COMBINATOR: u64 = 4;
    const E_WRONG_CHILD_COUNT:  u64 = 5;
    const E_ZERO_COEFF_SUM:     u64 = 6;

    // weight_params layout:
    //   [0]        combinator: u8
    //   WEIGHTED_AVG only:
    //   [1..9]     n_children: u64 LE
    //   [9..9+8*N] coeffs:     u64 LE each

    /// Core mint: consume N child WeightProofs and produce one composite proof.
    ///
    /// child_proofs must all share: election_id, voter==ctx.sender(), character_id,
    /// and minted_epoch==ctx.epoch(). The vector is fully consumed (all UIDs deleted).
    public fun mint(
        election: &Election,
        character_id: u32,
        mut child_proofs: vector<WeightProof>,
        ctx: &mut TxContext,
    ): WeightProof {
        let voter = ctx.sender();
        let params = voting::weight_params(election);
        assert!(vector::length(params) >= 1, E_BAD_PARAMS);

        let combinator    = *vector::borrow(params, 0);
        let election_id   = voting::id(election);
        let current_epoch = ctx.epoch();
        let n             = vector::length(&child_proofs);
        assert!(n > 0, E_NO_CHILDREN);

        // For WEIGHTED_AVG: read expected child count and coefficients
        if (combinator == COMB_WEIGHTED_AVG) {
            assert!(vector::length(params) >= 9, E_BAD_PARAMS);
            let n_expected = decode_u64_at(params, 1);
            assert!(n == (n_expected as u64), E_WRONG_CHILD_COUNT);
            let min_params = 9 + n * 8;
            assert!(vector::length(params) >= min_params, E_BAD_PARAMS);
        };

        // Consume all child proofs (pop from back → process in reverse order,
        // then we track index from the end for WEIGHTED_AVG coefficient lookup)
        let mut weights        = vector::empty<u64>();
        let mut child_inputs   = vector::empty<vector<u8>>();

        // Process in index order by reversing first, then popping from back
        vector::reverse(&mut child_proofs);
        let mut idx: u64 = 0;
        while (!vector::is_empty(&child_proofs)) {
            let proof = vector::pop_back(&mut child_proofs);
            let (child_eid, child_voter, child_cid, _kind, _pkg, child_weight, child_ih, child_epoch)
                = voting::extract_weight_proof(proof);

            // Verify all child proofs match this election/voter/character/epoch
            assert!(child_eid == election_id,    E_PROOF_MISMATCH);
            assert!(child_voter == voter,        E_PROOF_MISMATCH);
            assert!(child_cid == character_id,   E_PROOF_MISMATCH);
            assert!(child_epoch == current_epoch, E_PROOF_STALE);

            vector::push_back(&mut weights, child_weight);
            vector::push_back(&mut child_inputs, child_ih);
            idx = idx + 1;
        };
        vector::destroy_empty(child_proofs);

        // Compute combined weight
        let combined = combine_weights(combinator, &weights, params, n);

        // inputs_hash: combinator + child_weights + child_inputs_hashes
        // Full audit chain: each child inputs_hash captures its own deterministic inputs.
        let mut hbuf = vector::empty<u8>();
        vector::push_back(&mut hbuf, KIND_COMPOSITE);
        vector::push_back(&mut hbuf, combinator);
        let mut j: u64 = 0;
        while (j < n) {
            append_u64_le(&mut hbuf, *vector::borrow(&weights, j));
            j = j + 1;
        };
        let mut k: u64 = 0;
        while (k < n) {
            vector::append(&mut hbuf, *vector::borrow(&child_inputs, k));
            k = k + 1;
        };
        let inputs_hash = hash::keccak256(&hbuf);

        voting::mint_weight_proof(
            election_id,
            voter,
            character_id,
            KIND_COMPOSITE,
            @cradleos_voting,
            combined,
            inputs_hash,
            ctx,
        )
    }

    /// Dispatch to the appropriate combination function.
    fun combine_weights(
        combinator: u8,
        weights: &vector<u64>,
        params: &vector<u8>,
        n: u64,
    ): u64 {
        if (combinator == COMB_SUM) {
            combine_sum(weights, n)
        } else if (combinator == COMB_MAX) {
            combine_max(weights, n)
        } else if (combinator == COMB_MIN) {
            combine_min(weights, n)
        } else if (combinator == COMB_AVG) {
            combine_avg(weights, n)
        } else if (combinator == COMB_WEIGHTED_AVG) {
            combine_weighted_avg(weights, params, n)
        } else {
            abort E_INVALID_COMBINATOR
        }
    }

    fun combine_sum(weights: &vector<u64>, n: u64): u64 {
        let mut total: u64 = 0;
        let mut i: u64 = 0;
        while (i < n) {
            total = total + *vector::borrow(weights, i);
            i = i + 1;
        };
        total
    }

    fun combine_max(weights: &vector<u64>, n: u64): u64 {
        let mut best = *vector::borrow(weights, 0);
        let mut i: u64 = 1;
        while (i < n) {
            let w = *vector::borrow(weights, i);
            if (w > best) { best = w; };
            i = i + 1;
        };
        best
    }

    fun combine_min(weights: &vector<u64>, n: u64): u64 {
        let mut least = *vector::borrow(weights, 0);
        let mut i: u64 = 1;
        while (i < n) {
            let w = *vector::borrow(weights, i);
            if (w < least) { least = w; };
            i = i + 1;
        };
        least
    }

    fun combine_avg(weights: &vector<u64>, n: u64): u64 {
        let sum = combine_sum(weights, n);
        sum / n   // floor division; n > 0 guaranteed by E_NO_CHILDREN assertion
    }

    /// Weighted average: Σ(w[i] * coeff[i]) / Σ(coeff[i]).
    ///
    /// Uses u128 for intermediate arithmetic to prevent overflow:
    /// max(w[i]) * max(coeff[i]) ≤ u64::MAX * u64::MAX = ~3.4e38 < u128::MAX (~3.4e38).
    /// Actually u64::MAX^2 ≈ 3.4e38 and u128::MAX ≈ 3.4e38 so they're close.
    /// In practice, weights and coefficients will be far smaller than u64::MAX,
    /// but we use u128 throughout to be safe.
    ///
    /// Precision note: result is floor(weighted_sum / coeff_sum).
    /// For AVG-like behavior, use equal coefficients.
    fun combine_weighted_avg(weights: &vector<u64>, params: &vector<u8>, n: u64): u64 {
        // coefficients start at params[9], 8 bytes each
        let mut weighted_sum: u128 = 0;
        let mut coeff_sum:    u128 = 0;
        let mut i: u64 = 0;
        while (i < n) {
            let coeff = decode_u64_at(params, 9 + i * 8) as u128;
            let w     = (*vector::borrow(weights, i)) as u128;
            weighted_sum = weighted_sum + w * coeff;
            coeff_sum    = coeff_sum + coeff;
            i = i + 1;
        };
        assert!(coeff_sum > 0, E_ZERO_COEFF_SUM);
        (weighted_sum / coeff_sum) as u64
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Entry: combine child proofs and transfer composite proof to voter.
    ///
    /// child_proofs: vector of already-minted WeightProofs for the same
    ///   election/voter/character, all minted in this transaction.
    ///   Build this vector in your PTB using makeMoveVec([proof_a, proof_b, ...]).
    ///   Do NOT transfer child proofs to the voter — they are consumed here.
    public entry fun prove_composite(
        election: &Election,
        character_id: u32,
        child_proofs: vector<WeightProof>,
        ctx: &mut TxContext,
    ) {
        let voter = ctx.sender();
        let proof = mint(election, character_id, child_proofs, ctx);
        transfer::public_transfer(proof, voter);
    }

    // ── Encoding helpers ──────────────────────────────────────────────────────

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

    fun append_u64_le(buf: &mut vector<u8>, v: u64) {
        let mut i: u64 = 0;
        while (i < 8) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xFF) as u8);
            i = i + 1;
        }
    }

    public fun kind(): u8 { KIND_COMPOSITE }
}
