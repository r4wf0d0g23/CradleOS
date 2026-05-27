/// CradleOS Voting — Score / Range voting tally.
///
/// Encoding: BCS<vector<(u32, u8)>> — list of (option_id, score_0_to_max)
/// method_params[0] = max_score (u8)
/// method_params[1] = mode (0=score, 1=STAR — top-2 by score then runoff)
/// Tally: total(opt) = Σ weight * score(opt); winner = argmax.
///
/// FULL IMPLEMENTATION DEFERRED to week-3.
module cradleos_voting::score {
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
        // TODO(week-3): per-option Σ score*weight; STAR runoff mode.
        abort E_NOT_IMPLEMENTED
    }
}
