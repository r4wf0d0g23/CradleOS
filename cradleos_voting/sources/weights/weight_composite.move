/// CradleOS Voting — Composite weight (sum / product / max of child weights).
///
/// weight_params layout:
///   [0] combinator: 0=SUM, 1=MAX, 2=MIN, 3=PRODUCT
///   [1..1+N*1] N child kinds, then concatenated child params lengths + bytes.
///
/// Composite consumes child WeightProofs and produces a derived proof.
///
/// FULL IMPLEMENTATION DEFERRED to week-3.
module cradleos_voting::weight_composite {
    use cradleos_voting::voting::{Election, WeightProof};

    const KIND_COMPOSITE: u8 = 4;
    const E_NOT_IMPLEMENTED: u64 = 99;

    public fun mint_sum(
        _election: &Election,
        _child_proofs: vector<WeightProof>,
        _character_id: u32,
        _ctx: &mut TxContext,
    ): WeightProof {
        abort E_NOT_IMPLEMENTED
    }

    public fun kind(): u8 { KIND_COMPOSITE }
}
