/// CradleOS Voting — Composite Eligibility (AND / OR / NOT).
///
/// Combines multiple already-minted eligibility proofs into a single proof
/// against a boolean predicate. The election creator specifies the predicate
/// tree in eligibility_params:
///
///   eligibility_params layout (BCS-ish):
///     [0] op_kind: 0=AND, 1=OR, 2=NOT
///     [1] child_count: u8
///     [2..]  N child proofs, each as (kind: u8, params_len: u32, params: bytes)
///
/// FULL IMPLEMENTATION DEFERRED to week-2.
module cradleos_voting::eligibility_composite {
    use cradleos_voting::voting::{Self, Election, EligibilityProof};

    const KIND_COMPOSITE: u8 = 4;
    const E_NOT_IMPLEMENTED: u64 = 99;

    public fun mint_and(
        _election: &Election,
        _child_proofs: vector<EligibilityProof>,
        _character_id: u32,
        _ctx: &mut TxContext,
    ): EligibilityProof {
        // TODO(week-2): consume each child proof (verify all eligible), produce composite.
        abort E_NOT_IMPLEMENTED
    }

    public fun mint_or(
        _election: &Election,
        _child_proofs: vector<EligibilityProof>,
        _character_id: u32,
        _ctx: &mut TxContext,
    ): EligibilityProof {
        abort E_NOT_IMPLEMENTED
    }

    public fun mint_not(
        _election: &Election,
        _child_proof: EligibilityProof,
        _character_id: u32,
        _ctx: &mut TxContext,
    ): EligibilityProof {
        abort E_NOT_IMPLEMENTED
    }

    public fun kind(): u8 { KIND_COMPOSITE }
}
