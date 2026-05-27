/// CradleOS Voting — Conviction voting tally (time-weighted).
///
/// Encoding: BCS<(u32, u64)> — (option_id, stake_start_ms)
/// Tally: conviction(ballot, now) = ballot.weight * (1 - α^((now - stake_start) / unit))
///   where α defaults to 0.9, expressed as 9000/10000 to avoid fixed-point.
/// method_params layout (little-endian):
///   [0..8]  alpha_num (u64)
///   [8..16] alpha_den (u64)
///   [16..24] time_unit_ms (u64)
///   [24..32] quorum_threshold (u64)
///
/// FULL IMPLEMENTATION DEFERRED to week-3.
module cradleos_voting::conviction {
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
        // TODO(week-3): exponentiation via fixed-point with α scaled by 10000.
        abort E_NOT_IMPLEMENTED
    }
}
