/// CradleOS Voting — Asset-balance-weighted vote.
///
/// Weight = balance(asset, voter) at snapshot time.
/// weight_params layout:
///   [0..32]  coin_type_tag: address (CoinMetadata id)
///   [32..40] multiplier:    u64    (scales balance into weight units)
///   [40..48] cap:           u64    (0 = uncapped)
///
/// Generic over Coin<T>. Voter passes a reference to their owned Coin<T> at
/// proof-mint time; the proof captures the balance at that moment.
///
/// FULL IMPLEMENTATION DEFERRED to week-3.
module cradleos_voting::weight_asset {
    use cradleos_voting::voting::{Election, WeightProof};

    const KIND_ASSET: u8 = 3;
    const E_NOT_IMPLEMENTED: u64 = 99;

    public fun mint(
        _election: &Election,
        _character_id: u32,
        _ctx: &mut TxContext,
    ): WeightProof {
        abort E_NOT_IMPLEMENTED
    }

    public fun kind(): u8 { KIND_ASSET }
}
