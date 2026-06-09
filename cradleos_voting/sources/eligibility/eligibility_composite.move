/// CradleOS Voting — Composite Eligibility (AND / OR).
///
/// Combines multiple already-minted EligibilityProofs into a single composite
/// proof via AND or OR logic. Election creators specify which operation to use
/// via the eligibility_params byte.
///
/// ── Security Model ─────────────────────────────────────────────────────────
///
///   ON-CHAIN VERIFIED (all checks performed before composite proof is minted):
///   • Each child proof has election_id == this election's ID.
///   • Each child proof has voter == ctx.sender().
///   • Each child proof has character_id == the character_id parameter.
///   • Each child proof has minted_epoch == ctx.epoch() (stale-proof protection).
///   • AND: every child proof must be eligible=true.
///   • OR:  at least one child proof must be eligible=true.
///   • All child proofs are transferred to address(0) after verification.
///     A proof owned by @0x0 can never be re-used (no one can sign for it).
///     The minted_epoch check also makes proofs unusable across epochs.
///
///   MALFORMED INPUT PROTECTION:
///   • child_count must be 1..=MAX_CHILDREN (8). This bounds gas and prevents
///     griefing via exponential composite nesting.
///   • Depth: composite proofs MAY themselves be used as children in a parent
///     composite, bounded by MAX_CHILDREN per level. A depth-3 fully-branched
///     AND tree covers at most 8^3 = 512 leaf proofs. Callers who nest deeper
///     hit tx gas limits before any on-chain guard fires.
///
///   ACCESSOR DEPENDENCY — open question OQ-COMPOSITE:
///   • This module reads EligibilityProof fields via five accessor functions
///     added to voting.move: proof_eligible, proof_election_id, proof_voter,
///     proof_character_id, proof_minted_epoch.
///   • Sui Move 2024 restricts struct field access/destructuring to the
///     defining module. These accessors are the minimal required companion.
///     They are pure read-only helpers and do NOT change voting.move logic.
///   • Raw/Captain must accept the voting.move accessor additions before deploy.
///
///   eligibility_params layout:
///     byte [0] : op_kind  (OP_AND = 0, OP_OR = 1)
///     (remaining bytes reserved for future depth/strategy hints)
///
module cradleos_voting::eligibility_composite {
    use sui::event;
    use cradleos_voting::voting::{Self, Election, EligibilityProof};

    // ── Constants ─────────────────────────────────────────────────────────────

    const KIND_COMPOSITE: u8 = 4;

    const OP_AND: u8 = 0;
    const OP_OR:  u8 = 1;

    /// Hard cap on children per composite call to bound gas / depth.
    const MAX_CHILDREN: u64 = 8;

    // ── Error codes ───────────────────────────────────────────────────────────

    const E_EMPTY_CHILDREN:           u64 = 1;
    const E_TOO_MANY_CHILDREN:        u64 = 2;
    const E_PROOF_ELECTION_MISMATCH:  u64 = 3;
    const E_PROOF_VOTER_MISMATCH:     u64 = 4;
    const E_PROOF_CHARACTER_MISMATCH: u64 = 5;
    const E_PROOF_STALE:              u64 = 6;
    const E_UNKNOWN_OP:               u64 = 7;

    // ── Events ────────────────────────────────────────────────────────────────

    public struct CompositeProofMinted has copy, drop {
        election_id:  ID,
        voter:        address,
        character_id: u32,
        op_kind:      u8,
        child_count:  u64,
        eligible:     bool,
    }

    // ── Proof minting ─────────────────────────────────────────────────────────

    /// Mint a composite eligibility proof combining child proofs with AND logic.
    ///
    /// eligible = true iff ALL child proofs are eligible=true.
    /// All child proofs are burned (transferred to @0x0) after verification.
    ///
    /// Typical PTB flow:
    ///   1. Mint child proofs (allowlist, tribe_cradleos, etc.) in same tx
    ///   2. Call mint_and(election, [proof_a, proof_b], character_id, ctx)
    ///   3. Pass composite proof to cast_ballot in same tx
    public fun mint_and(
        election: &Election,
        mut child_proofs: vector<EligibilityProof>,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let proof = do_composite(election, &mut child_proofs, character_id, OP_AND, ctx);
        vector::destroy_empty(child_proofs);  // all elements removed in do_composite
        proof
    }

    /// Mint a composite eligibility proof with OR logic.
    ///
    /// eligible = true iff AT LEAST ONE child proof is eligible=true.
    /// All child proofs are burned regardless of individual eligible values.
    public fun mint_or(
        election: &Election,
        mut child_proofs: vector<EligibilityProof>,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let proof = do_composite(election, &mut child_proofs, character_id, OP_OR, ctx);
        vector::destroy_empty(child_proofs);
        proof
    }

    // Note: prove_composite_and and prove_composite_or removed.
    // Hot-potato EligibilityProofs cannot be transferred. Use mint_and / mint_or
    // in a PTB and pass the result directly to cast_ballot in the same tx.

    // ── Core implementation ───────────────────────────────────────────────────

    fun do_composite(
        election:     &Election,
        child_proofs: &mut vector<EligibilityProof>,
        character_id: u32,
        op_kind:      u8,
        ctx:          &mut TxContext,
    ): EligibilityProof {
        let voter         = ctx.sender();
        let election_id   = voting::id(election);
        let current_epoch = ctx.epoch();
        let child_count   = vector::length(child_proofs);

        assert!(op_kind == OP_AND || op_kind == OP_OR, E_UNKNOWN_OP);
        assert!(child_count > 0,             E_EMPTY_CHILDREN);
        assert!(child_count <= MAX_CHILDREN, E_TOO_MANY_CHILDREN);

        // Consume each child hot potato, verify it, accumulate eligibility.
        // consume_eligibility_proof destructures the proof - no explicit burn needed.
        let mut eligible: bool = if (op_kind == OP_AND) { true } else { false };
        let mut i: u64 = 0;

        while (i < child_count) {
            let proof = vector::remove(child_proofs, 0);

            let (child_election, child_voter, child_char, _kind, _pkg, child_eligible, child_epoch)
                = voting::consume_eligibility_proof(proof);

            assert!(child_election == election_id,  E_PROOF_ELECTION_MISMATCH);
            assert!(child_voter    == voter,         E_PROOF_VOTER_MISMATCH);
            assert!(child_char     == character_id,  E_PROOF_CHARACTER_MISMATCH);
            assert!(child_epoch    == current_epoch, E_PROOF_STALE);

            if (op_kind == OP_AND) {
                eligible = eligible && child_eligible;
            } else {
                eligible = eligible || child_eligible;
            };

            // Proof consumed by destructuring above - no transfer or burn needed.
            i = i + 1;
        };

        event::emit(CompositeProofMinted {
            election_id,
            voter,
            character_id,
            op_kind,
            child_count,
            eligible,
        });

        voting::mint_eligibility_proof(
            election_id,
            voter,
            character_id,
            KIND_COMPOSITE,
            @cradleos_voting,
            eligible,
            ctx,
        )
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public fun kind():   u8 { KIND_COMPOSITE }
    public fun op_and(): u8 { OP_AND }
    public fun op_or():  u8 { OP_OR }
}
