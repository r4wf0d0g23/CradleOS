/// CradleOS Voting — Character-age-weighted vote.
///
/// Weight = (current_epoch - character_join_epoch) * coefficient (capped).
/// weight_params layout:
///   [0..8]   coefficient: u64
///   [8..16]  cap:         u64 (max weight; 0 = uncapped)
///   [16..24] min_epochs:  u64 (require at least this many epochs)
///
/// Requires an EpochAttestation from cradleos::character_registry to prove the
/// join_epoch. The attestation is consumed at proof-mint time.
///
/// FULL IMPLEMENTATION DEFERRED to week-2.
module cradleos_voting::weight_char_age {
    use cradleos_voting::voting::{Election, WeightProof};

    const KIND_CHAR_AGE: u8 = 2;
    const E_NOT_IMPLEMENTED: u64 = 99;

    public fun mint(
        _election: &Election,
        _character_id: u32,
        _ctx: &mut TxContext,
    ): WeightProof {
        abort E_NOT_IMPLEMENTED
    }

    public fun kind(): u8 { KIND_CHAR_AGE }
}
