/// CradleOS Voting — Quadratic voting tally.
///
/// Encoding: BCS<vector<(u32, u64)>> — list of (option_id, credits_assigned)
/// Validation: Σ credits ≤ max_credits (method_params[0..8] as u64)
/// Tally: score(opt) = Σ isqrt(credits_scaled) per ballot, weight applied.
///
/// FULL IMPLEMENTATION DEFERRED to week-3. Skeleton stub returns empty result.
module cradleos_voting::quadratic {
    use cradleos_voting::voting::{Option_, RoundResult};

    const E_NOT_IMPLEMENTED: u64 = 99;

    public fun compute(
        _method_params: &vector<u8>,
        _options: &vector<Option_>,
        _character_ids: &vector<u32>,
        _encoded_votes: &vector<vector<u8>>,
        _weights: &vector<u64>,
        _seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        // TODO(week-3): integer sqrt via Newton's method; per-option Σ isqrt(credits).
        abort E_NOT_IMPLEMENTED
    }
}
