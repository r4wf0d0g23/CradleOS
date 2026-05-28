/// CradleOS Voting — Quadratic voting tally.
///
/// ## Algorithm
///
/// Voters allocate `credits` across options; the cost of allocating `n` votes
/// to a single option is `n²` credits. Equivalently, votes per option =
/// `sqrt(credits)`. Per-option score is `Σ ballot.weight · sqrt(credits)`
/// across all voters. Winner = argmax(score).
///
/// To keep determinism + on-chain reproducibility we work entirely in u64/u128
/// integer fixed-point — no floats. Square-root is computed via Newton's method.
///
/// ## Encoding
///
/// `BCS<vector<(u32, u64)>>` — list of `(option_id, credits_assigned)`.
/// On-chain wire format we accept:
///
///   [u32 count][ (u32 option_id, u64 credits) × count ]
///
/// Constraints:
///   - `Σ credits ≤ max_credits` from method_params[0..8] (u64 little-endian)
///   - all option_ids must be unique within a ballot (off-chain enforced;
///     duplicates would just double-count which is allowed in the loose form,
///     but we reject for canonicality).
///
/// ## Parameters layout
///
///   [0..8]   max_credits        (u64, little-endian) — required, > 0
///   [8..9]   credit_scale_log2  (u8)                  — optional; default 0
///
/// ## Precision
///
/// Naive `isqrt(credits)` truncates to integer. With small credit budgets that
/// loses signal (sqrt(2)=1, sqrt(3)=1). We mitigate by scaling: the actual
/// quantity contributed is `isqrt(credits << credit_scale_log2)`. With
/// `credit_scale_log2 = 16`, sqrt(2 << 16) ≈ 362 vs sqrt(3 << 16) ≈ 443, giving
/// ~9 bits of sub-integer resolution. We store the scale factor in the result
/// payload so off-chain re-runners reproduce identical comparisons.
///
/// **Tradeoff documented:** higher scale → more precision but tighter overflow
/// margin. With `credit_scale_log2 = 16` and `weight ≤ 2³²`, intermediate
/// products fit u128 comfortably (max ~2³² · 2³² · 2¹⁶ = 2⁸⁰).
///
/// ## Edge cases
///
/// - Zero credits to an option: contributes zero (sqrt(0)=0). OK.
/// - Negative votes (against): NOT supported in this implementation. Quadratic
///   voting in the standard form has only positive allocations. Extension for
///   signed votes deferred (would require encoded sign bit per pair).
/// - Empty ballot (no pairs): contributes nothing but counts toward total_weight
///   for quorum.
/// - Ties broken via deterministic seed.
/// - Single-option election: that option wins trivially.
module cradleos_voting::quadratic {
    use cradleos_voting::voting::{Self, Option_, RoundResult};

    const E_BAD_VOTE: u64 = 0;
    const E_BAD_PARAMS: u64 = 1;
    const E_OVER_BUDGET: u64 = 2;
    const E_DUPLICATE_OPTION_IN_BALLOT: u64 = 3;

    public fun compute(
        method_params: &vector<u8>,
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        assert!(vector::length(method_params) >= 8, E_BAD_PARAMS);
        let max_credits = decode_u64_at(method_params, 0);
        assert!(max_credits > 0, E_BAD_PARAMS);
        let credit_scale_log2: u8 = if (vector::length(method_params) >= 9) {
            *vector::borrow(method_params, 8)
        } else { 16 };
        // Cap scale to keep intermediate (credits<<scale) within u128.
        // credits ≤ max_credits ≤ u64::MAX; we need scale ≤ 64.
        assert!((credit_scale_log2 as u64) <= 32, E_BAD_PARAMS);

        let n_options = vector::length(options);
        // Per-option score accumulator (Σ weight · sqrt(credits_scaled)).
        // We use u128 to avoid overflow on large elections.
        let mut scores = vector[];
        let mut i = 0;
        while (i < n_options) {
            vector::push_back(&mut scores, 0u128);
            i = i + 1;
        };

        let n_ballots = vector::length(encoded_votes);
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let v = vector::borrow(encoded_votes, b);
            let pairs = decode_credit_pairs(v);
            let w = *vector::borrow(weights, b);
            total_weight = total_weight + w;

            // Enforce budget + dedupe per ballot.
            let mut spent: u128 = 0;
            let np = vector::length(&pairs);
            let mut p = 0;
            // Track seen option_ids by linear scan; ballots are small (≤ n_options).
            let mut seen = vector[];
            while (p < np) {
                let pair = vector::borrow(&pairs, p);
                let oid = pair_oid(pair);
                let credits = pair_credits(pair);
                assert!(!contains_u32(&seen, oid), E_DUPLICATE_OPTION_IN_BALLOT);
                vector::push_back(&mut seen, oid);
                spent = spent + (credits as u128);
                let idx = option_index(options, oid);
                if (idx < n_options && credits > 0) {
                    let scaled = (credits as u128) << (credit_scale_log2 as u8);
                    let root = isqrt_u128(scaled);
                    let contribution = root * (w as u128);
                    let s = vector::borrow_mut(&mut scores, idx);
                    *s = *s + contribution;
                };
                p = p + 1;
            };
            assert!(spent <= (max_credits as u128), E_OVER_BUDGET);
            b = b + 1;
        };

        // Find winner. Reduce u128 → comparison via direct compare.
        let mut max_score: u128 = 0;
        let mut j = 0;
        while (j < n_options) {
            let c = *vector::borrow(&scores, j);
            if (c > max_score) max_score = c;
            j = j + 1;
        };
        let mut winners = vector[];
        let mut k = 0;
        while (k < n_options) {
            if (*vector::borrow(&scores, k) == max_score && max_score > 0) {
                vector::push_back(&mut winners, voting::option_id(vector::borrow(options, k)));
            };
            k = k + 1;
        };

        if (vector::length(&winners) > 1) {
            let tie_idx = (byte_sum(seed) as u64) % vector::length(&winners);
            let chosen = *vector::borrow(&winners, tie_idx);
            winners = vector[];
            vector::push_back(&mut winners, chosen);
        };

        // Payload: [scale:u8][per-option (option_id:u32, score:u128 as two u64 little-endian)]
        let mut payload = vector[];
        vector::push_back(&mut payload, credit_scale_log2);
        let mut q = 0;
        while (q < n_options) {
            append_u32(&mut payload, voting::option_id(vector::borrow(options, q)));
            let s = *vector::borrow(&scores, q);
            append_u128(&mut payload, s);
            q = q + 1;
        };

        let quorum_met = total_weight > 0;
        let rounds = vector[];
        (winners, payload, rounds, total_weight, quorum_met)
    }

    // ── Newton's-method integer sqrt for u128 ────────────────────────────────
    //
    // Returns floor(sqrt(n)).  Convergence: each iteration roughly doubles the
    // number of correct bits; for u128 we need ≤ 7 iterations from a good seed.
    // We use Hacker's-Delight-style seeding: pick a power-of-two start above
    // sqrt(n).
    fun isqrt_u128(n: u128): u128 {
        if (n == 0) return 0;
        if (n < 4) return 1;
        // Seed: smallest x such that x² ≥ n. Use bit_length / 2.
        let mut bits: u8 = 0;
        let mut m = n;
        while (m > 0) {
            bits = bits + 1;
            m = m >> 1;
        };
        // x0 ≈ 2^((bits+1)/2)
        let shift = (bits + 1) / 2;
        let mut x: u128 = 1u128 << shift;
        // Newton iterate: x = (x + n/x) / 2 until x stops decreasing.
        loop {
            let next = (x + n / x) / 2;
            if (next >= x) break;
            x = next;
        };
        x
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public struct CreditPair has copy, drop, store { oid: u32, credits: u64 }
    fun pair_oid(p: &CreditPair): u32 { p.oid }
    fun pair_credits(p: &CreditPair): u64 { p.credits }

    fun decode_credit_pairs(v: &vector<u8>): vector<CreditPair> {
        let n = vector::length(v);
        assert!(n >= 4, E_BAD_VOTE);
        let count = decode_u32_at(v, 0) as u64;
        let pair_size: u64 = 4 + 8; // u32 + u64
        assert!(4 + count * pair_size <= n, E_BAD_VOTE);
        let mut out = vector[];
        let mut i: u64 = 0;
        while (i < count) {
            let off = 4 + i * pair_size;
            let oid = decode_u32_at(v, off);
            let credits = decode_u64_at(v, off + 4);
            vector::push_back(&mut out, CreditPair { oid, credits });
            i = i + 1;
        };
        out
    }

    fun contains_u32(v: &vector<u32>, target: u32): bool {
        let n = vector::length(v);
        let mut i = 0;
        while (i < n) {
            if (*vector::borrow(v, i) == target) return true;
            i = i + 1;
        };
        false
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
    fun append_u128(buf: &mut vector<u8>, v: u128) {
        let mut i = 0;
        while (i < 16) {
            vector::push_back(buf, ((v >> ((i * 8) as u8)) & 0xffu128) as u8);
            i = i + 1;
        };
    }
}
