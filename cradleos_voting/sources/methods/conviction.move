/// CradleOS Voting — Conviction voting (time-weighted) tally.
///
/// ## Algorithm
///
/// Conviction grows with the time a voter holds a stake on an option, modeled
/// as an exponential approach to a steady-state cap. For ballot with weight
/// `w` staked at `t_start`, conviction at time `t_now` is:
///
///   conviction = w · (1 - α^k)
///
/// where `k = (t_now - t_start) / time_unit_ms` and `α ∈ (0, 1)` is the decay
/// retention factor (e.g. 0.9 means 90% of the prior step's deficit carries
/// over each unit of time, giving a smooth ramp). At `k → ∞`, conviction → w
/// (steady-state cap).
///
/// Per-option total conviction is the sum across all ballots for that option.
/// Winner = the option whose conviction crosses `quorum_threshold`; ties broken
/// by deterministic seed.
///
/// ## Encoding
///
/// `BCS<(u32, u64)>` — `(option_id, stake_start_ms)` per ballot.  On-chain
/// wire format we accept is the 12-byte concatenation:
///
///   [u32 option_id][u64 stake_start_ms]
///
/// ## Parameters layout (little-endian)
///
///   [ 0.. 8]  alpha_num            (u64) — numerator of α (must be < alpha_den)
///   [ 8..16]  alpha_den            (u64) — denominator of α (> 0)
///   [16..24]  time_unit_ms         (u64) — granularity for k (e.g. 86_400_000 for daily)
///   [24..32]  quorum_threshold     (u64) — minimum per-option conviction for quorum_met
///   [32..40]  tally_now_ms         (u64) — the "now" timestamp used for the snapshot.
///                                          Off-chain re-runner must use the same value;
///                                          v1 uses the orchestrator's `now_ms` injected
///                                          via method_params (creator passes it forward
///                                          at compute time via the Closed→Tallied event).
///   [40..48]  max_steps            (u64) — cap on iterations in α^k loop (default 90
///                                          for 90-day half-life cap per Raw decision)
///
/// ## Precision / Approximation
///
/// We compute α^k = (alpha_num / alpha_den)^k entirely in u128 fixed-point.
/// `FP_SCALE = 1_000_000_000_000_000_000` (10¹⁸) gives ~18 decimal digits.
///
/// The iteration:
///   pow_fp = FP_SCALE                                    // α^0 = 1
///   for _ in 0..k_capped:
///       pow_fp = pow_fp * alpha_num / alpha_den           // multiplicative step
///
/// After `k_capped` iterations, `conviction = w * (FP_SCALE - pow_fp) / FP_SCALE`.
///
/// **k_capped policy:** `k_capped = min(k, max_steps)`. Per Raw's locked
/// decision (Q2 in design doc §12): conviction elections cap at 90 days; when
/// `creator_can_extend` is true, the cap repeats. The cap manifests here as a
/// finite `max_steps`. We default to 90 if not specified.
///
/// **Why finite-step pow instead of binary exponentiation:** k is bounded
/// (≤ max_steps ≤ ~365), so naive sequential multiplication costs O(k) and is
/// easy to audit. Binary-exp would save a few iterations but adds branching
/// the off-chain re-runner has to mirror byte-for-byte. Linear is simpler and
/// well within Sui gas budgets.
///
/// **Tradeoff:** each step truncates by ~1 ulp. After 90 multiplications with
/// FP_SCALE = 10¹⁸, accumulated error is < 10⁻¹⁶ in relative terms — far below
/// the resolution that matters for vote counts. Documented.
///
/// ## Edge cases
///
/// - `k = 0` (just-staked ballot): conviction = w · (1 - 1) = 0. Correct.
/// - `t_start > tally_now_ms` (clock skew or future-dated stake): we treat
///   `k = 0` defensively (no negative time).
/// - Per-option conviction never crosses quorum_threshold: `quorum_met = false`;
///   `winners` is still computed (argmax) so the dApp can show a "leader" but
///   the Election finalize step should refuse to advance until quorum met.
/// - Ties broken via deterministic seed.
/// - `alpha_num >= alpha_den`: rejected with E_BAD_PARAMS — α must be < 1.
module cradleos_voting::conviction {
    use cradleos_voting::voting::{Self, Option_, RoundResult};

    const E_BAD_VOTE: u64 = 0;
    const E_BAD_PARAMS: u64 = 1;

    // FP scale = 10^18 (fits comfortably in u128).
    const FP_SCALE: u128 = 1_000_000_000_000_000_000;

    public fun compute(
        method_params: &vector<u8>,
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        assert!(vector::length(method_params) >= 40, E_BAD_PARAMS);
        let alpha_num = decode_u64_at(method_params, 0);
        let alpha_den = decode_u64_at(method_params, 8);
        let time_unit_ms = decode_u64_at(method_params, 16);
        let quorum_threshold = decode_u64_at(method_params, 24);
        let tally_now_ms = decode_u64_at(method_params, 32);
        let max_steps = if (vector::length(method_params) >= 48) {
            decode_u64_at(method_params, 40)
        } else { 90 };

        assert!(alpha_den > 0, E_BAD_PARAMS);
        assert!(alpha_num < alpha_den, E_BAD_PARAMS);
        assert!(time_unit_ms > 0, E_BAD_PARAMS);
        assert!(max_steps > 0, E_BAD_PARAMS);

        let n_options = vector::length(options);
        // Per-option conviction accumulator in raw integer weight-units.
        let mut convictions = vector::empty<u128>();
        let mut i = 0;
        while (i < n_options) {
            vector::push_back(&mut convictions, 0u128);
            i = i + 1;
        };

        let n_ballots = vector::length(encoded_votes);
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let v = vector::borrow(encoded_votes, b);
            let (oid, t_start) = decode_conviction_vote(v);
            let w = *vector::borrow(weights, b);
            total_weight = total_weight + w;

            // k = floor((now - t_start) / time_unit_ms), clamped to [0, max_steps].
            let elapsed_ms = if (tally_now_ms > t_start) { tally_now_ms - t_start } else { 0 };
            let mut k = elapsed_ms / time_unit_ms;
            if (k > max_steps) k = max_steps;

            // pow_fp = α^k in fixed-point
            let mut pow_fp: u128 = FP_SCALE;
            let mut step: u64 = 0;
            while (step < k) {
                // pow_fp = pow_fp * alpha_num / alpha_den
                pow_fp = (pow_fp * (alpha_num as u128)) / (alpha_den as u128);
                step = step + 1;
            };

            // conviction = w * (FP_SCALE - pow_fp) / FP_SCALE
            // pow_fp ≤ FP_SCALE always (since α < 1 → α^k ≤ 1).
            let deficit = FP_SCALE - pow_fp;
            // (w * deficit) fits u128: w ≤ 2^64, deficit ≤ 10^18 < 2^60, so < 2^124.
            let conviction_contribution = ((w as u128) * deficit) / FP_SCALE;

            let idx = option_index(options, oid);
            if (idx < n_options) {
                let c = vector::borrow_mut(&mut convictions, idx);
                *c = *c + conviction_contribution;
            };
            b = b + 1;
        };

        // Find argmax + quorum check.
        let mut max_conv: u128 = 0;
        let mut j = 0;
        while (j < n_options) {
            let c = *vector::borrow(&convictions, j);
            if (c > max_conv) max_conv = c;
            j = j + 1;
        };

        let mut winners = vector::empty<u32>();
        let mut k_idx = 0;
        while (k_idx < n_options) {
            if (*vector::borrow(&convictions, k_idx) == max_conv && max_conv > 0) {
                vector::push_back(&mut winners, voting::option_id(vector::borrow(options, k_idx)));
            };
            k_idx = k_idx + 1;
        };

        if (vector::length(&winners) > 1) {
            let tie_idx = (byte_sum(seed) as u64) % vector::length(&winners);
            let chosen = *vector::borrow(&winners, tie_idx);
            winners = vector::empty<u32>();
            vector::push_back(&mut winners, chosen);
        };

        // quorum_met = top option conviction ≥ threshold
        let quorum_met = max_conv >= (quorum_threshold as u128);

        // Payload: [tally_now_ms:u64][per-option (option_id:u32, conviction:u128)]
        let mut payload = vector::empty<u8>();
        append_u64(&mut payload, tally_now_ms);
        let mut q = 0;
        while (q < n_options) {
            append_u32(&mut payload, voting::option_id(vector::borrow(options, q)));
            append_u128(&mut payload, *vector::borrow(&convictions, q));
            q = q + 1;
        };

        let rounds = vector::empty<RoundResult>();
        (winners, payload, rounds, total_weight, quorum_met)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun decode_conviction_vote(v: &vector<u8>): (u32, u64) {
        assert!(vector::length(v) >= 12, E_BAD_VOTE);
        let oid = decode_u32_at(v, 0);
        let t_start = decode_u64_at(v, 4);
        (oid, t_start)
    }

    fun decode_u32_at(v: &vector<u8>, off: u64): u32 {
        let b0 = (*vector::borrow(v, off) as u32);
        let b1 = (*vector::borrow(v, off + 1) as u32);
        let b2 = (*vector::borrow(v, off + 2) as u32);
        let b3 = (*vector::borrow(v, off + 3) as u32);
        b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    }

    fun decode_u64_at(v: &vector<u8>, off: u64): u64 {
        let mut out: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8) {
            out = out | ((*vector::borrow(v, off + i) as u64) << ((i * 8) as u8));
            i = i + 1;
        };
        out
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
    fun append_u128(buf: &mut vector<u8>, v: u128) {
        let mut i = 0;
        while (i < 16) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xffu128) as u8);
            i = i + 1;
        };
    }
}
