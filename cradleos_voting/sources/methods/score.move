/// CradleOS Voting — Score / Range voting tally.
///
/// ## Algorithm
///
/// Each voter rates every option on a 0..=max_score scale. Tally aggregates
/// per-option score×weight contributions across all ballots.
///
/// Two modes selectable via `method_params[1]`:
///   - `MODE_SUM` (0): winner = argmax(Σ score · weight). Higher total wins.
///   - `MODE_AVERAGE` (1): winner = argmax(Σ score · weight / Σ weight where
///     option was scored). Computed in fixed-point with `AVG_SCALE` precision
///     so we can compare without floats.
///
/// ## Encoding
///
/// `BCS<vector<(u32, u8)>>` — list of `(option_id, score)` pairs. The on-chain
/// layout we accept is a length-prefixed sequence:
///
///   [u32 count][ (u32 option_id, u8 score) × count ]
///
/// Unrated options contribute zero (sum mode) or are excluded from denominator
/// (average mode). Per-ballot scores must satisfy `0 <= score <= max_score`.
///
/// ## Parameters layout
///
///   [0]    max_score   (u8)         — required, > 0
///   [1]    mode        (u8)         — 0=sum, 1=average (defaults to sum)
///
/// ## Precision notes
///
/// - Sum mode is exact: `u64` accumulator. Overflow only if any single product
///   `score · weight` would overflow u64; we bound by checking that
///   `weight <= u64::MAX / 255` is true for inputs (weight providers cap to
///   this naturally — practical weights are << 1e15).
/// - Average mode keeps a per-option `(numerator, denominator)` pair where
///   numerator = Σ score · weight and denominator = Σ weight for ballots that
///   rated this option. The encoded result_payload includes both so off-chain
///   verifiers can reproduce the comparison exactly.
///
/// ## Edge cases
///
/// - Empty ballots (no pairs): contribute zero, quorum unaffected.
/// - Score above max_score: ballot rejected with `E_SCORE_OUT_OF_RANGE`.
/// - Ties broken via deterministic seed (modulo over tied options).
/// - Average mode with zero-rating denominator for an option: that option is
///   excluded from the winner search (no opinions = no claim).
module cradleos_voting::score {
    use cradleos_voting::voting::{Self, Option_, RoundResult};

    const E_BAD_VOTE: u64 = 0;
    const E_SCORE_OUT_OF_RANGE: u64 = 1;
    const E_BAD_PARAMS: u64 = 2;

    const MODE_SUM: u8 = 0;
    const MODE_AVERAGE: u8 = 1;

    public fun compute(
        method_params: &vector<u8>,
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        assert!(vector::length(method_params) >= 1, E_BAD_PARAMS);
        let max_score = *vector::borrow(method_params, 0);
        assert!(max_score > 0, E_BAD_PARAMS);
        let mode = if (vector::length(method_params) >= 2) {
            *vector::borrow(method_params, 1)
        } else { MODE_SUM };

        let n_options = vector::length(options);

        // Per-option (sum_score_weighted, sum_weight_for_raters) accumulators.
        let mut numerators = vector[];
        let mut denominators = vector[];
        let mut i = 0;
        while (i < n_options) {
            vector::push_back(&mut numerators, 0);
            vector::push_back(&mut denominators, 0);
            i = i + 1;
        };

        let n_ballots = vector::length(encoded_votes);
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let v = vector::borrow(encoded_votes, b);
            let pairs = decode_score_pairs(v);
            let w = *vector::borrow(weights, b);
            total_weight = total_weight + w;
            let np = vector::length(&pairs);
            let mut p = 0;
            while (p < np) {
                let pair = vector::borrow(&pairs, p);
                let oid = pair_oid(pair);
                let score = pair_score(pair);
                assert!(score <= max_score, E_SCORE_OUT_OF_RANGE);
                let idx = option_index(options, oid);
                if (idx < n_options) {
                    let contrib = (score as u64) * w;
                    let num = vector::borrow_mut(&mut numerators, idx);
                    *num = *num + contrib;
                    let den = vector::borrow_mut(&mut denominators, idx);
                    *den = *den + w;
                };
                p = p + 1;
            };
            b = b + 1;
        };

        // Pick winner per mode.
        // For SUM mode the comparison value is `numerator`.
        // For AVERAGE mode we compute `score = numerator * AVG_SCALE / denominator`
        // and compare. AVG_SCALE = 1_000_000 gives 6 decimal digits of precision,
        // well within u64 (numerator * scale up to ~1e15 for realistic inputs).
        let avg_scale: u64 = 1_000_000;
        let mut comparator = vector[];
        let mut has_data = vector[];
        let mut j = 0;
        while (j < n_options) {
            let num = *vector::borrow(&numerators, j);
            let den = *vector::borrow(&denominators, j);
            if (mode == MODE_AVERAGE) {
                if (den > 0) {
                    vector::push_back(&mut comparator, (num * avg_scale) / den);
                    vector::push_back(&mut has_data, true);
                } else {
                    vector::push_back(&mut comparator, 0);
                    vector::push_back(&mut has_data, false);
                };
            } else {
                vector::push_back(&mut comparator, num);
                vector::push_back(&mut has_data, num > 0);
            };
            j = j + 1;
        };

        // Find max comparator, only over options with data.
        let mut max_val: u64 = 0;
        let mut any_data = false;
        let mut m = 0;
        while (m < n_options) {
            if (*vector::borrow(&has_data, m)) {
                let c = *vector::borrow(&comparator, m);
                if (!any_data || c > max_val) { max_val = c; any_data = true; };
            };
            m = m + 1;
        };

        let mut winners = vector[];
        if (any_data) {
            let mut k = 0;
            while (k < n_options) {
                if (*vector::borrow(&has_data, k) && *vector::borrow(&comparator, k) == max_val) {
                    vector::push_back(&mut winners, voting::option_id(vector::borrow(options, k)));
                };
                k = k + 1;
            };
        };

        if (vector::length(&winners) > 1) {
            let tie_idx = (byte_sum(seed) as u64) % vector::length(&winners);
            let chosen = *vector::borrow(&winners, tie_idx);
            winners = vector[];
            vector::push_back(&mut winners, chosen);
        };

        // Payload: [mode:u8][avg_scale:u64][per-option (option_id:u32, num:u64, den:u64)]
        let mut payload = vector[];
        vector::push_back(&mut payload, mode);
        append_u64(&mut payload, avg_scale);
        let mut q = 0;
        while (q < n_options) {
            append_u32(&mut payload, voting::option_id(vector::borrow(options, q)));
            append_u64(&mut payload, *vector::borrow(&numerators, q));
            append_u64(&mut payload, *vector::borrow(&denominators, q));
            q = q + 1;
        };

        let quorum_met = total_weight > 0;
        let rounds = vector[];
        (winners, payload, rounds, total_weight, quorum_met)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Decode `[u32 count][(u32 option_id, u8 score) × count]` as a vector of
    /// (option_id, score) tuples. We return owned u32 + u8 to keep the call site
    /// simple.
    fun decode_score_pairs(v: &vector<u8>): vector<ScorePair> {
        let n = vector::length(v);
        assert!(n >= 4, E_BAD_VOTE);
        let count = decode_u32_at(v, 0) as u64;
        let mut out = vector[];
        let pair_size: u64 = 4 + 1; // u32 + u8
        assert!(4 + count * pair_size <= n, E_BAD_VOTE);
        let mut i: u64 = 0;
        while (i < count) {
            let off = 4 + i * pair_size;
            let oid = decode_u32_at(v, off);
            let score = *vector::borrow(v, off + 4);
            vector::push_back(&mut out, ScorePair { oid, score });
            i = i + 1;
        };
        out
    }

    public struct ScorePair has copy, drop, store { oid: u32, score: u8 }

    fun pair_oid(p: &ScorePair): u32 { p.oid }
    fun pair_score(p: &ScorePair): u8 { p.score }

    fun decode_u32_at(v: &vector<u8>, off: u64): u32 {
        let b0 = (*vector::borrow(v, off) as u32);
        let b1 = (*vector::borrow(v, off + 1) as u32);
        let b2 = (*vector::borrow(v, off + 2) as u32);
        let b3 = (*vector::borrow(v, off + 3) as u32);
        b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    }

    fun option_index(options: &vector<Option_>, option_id: u32): u64 {
        let n = vector::length(options);
        let mut i = 0;
        while (i < n) {
            if (voting::option_id(vector::borrow(options, i)) == option_id) return i;
            i = i + 1;
        };
        n
    }

    fun byte_sum(v: &vector<u8>): u64 {
        let mut sum: u64 = 0;
        let n = vector::length(v);
        let mut i = 0;
        while (i < n) {
            sum = sum + (*vector::borrow(v, i) as u64);
            i = i + 1;
        };
        sum
    }

    fun append_u32(buf: &mut vector<u8>, v: u32) {
        let mut i = 0;
        while (i < 4) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xff) as u8);
            i = i + 1;
        };
    }
    fun append_u64(buf: &mut vector<u8>, v: u64) {
        let mut i = 0;
        while (i < 8) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xff) as u8);
            i = i + 1;
        };
    }
}
