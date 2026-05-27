/// CradleOS Voting — Ranked-Choice (IRV / Schulze / Borda).
///
/// Encoding: method_params[0] = subtype (0=IRV, 1=Schulze, 2=Borda)
/// Vote encoding: BCS<vector<u32>> — ranked list (position 0 = first preference)
///
/// IRV: eliminate lowest, redistribute to next preference until majority.
/// Schulze: pairwise preference matrix → strongest-path winner.
/// Borda: score(opt) = Σ (N - rank) * weight; argmax wins.
///
/// FULL IMPLEMENTATION DEFERRED: stubs return Borda-style result so skeleton
/// compiles and integration tests can run. Each subtype gets full Move impl
/// per design doc §6.3.
module cradleos_voting::ranked_choice {
    use cradleos_voting::voting::{Self, Option_, RoundResult};

    const E_BAD_VOTE: u64 = 0;
    const E_BAD_SUBTYPE: u64 = 1;

    const SUBTYPE_IRV:     u8 = 0;
    const SUBTYPE_SCHULZE: u8 = 1;
    const SUBTYPE_BORDA:   u8 = 2;

    public fun compute(
        method_params: &vector<u8>,
        options: &vector<Option_>,
        character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        let subtype = if (vector::length(method_params) >= 1) {
            *vector::borrow(method_params, 0)
        } else { SUBTYPE_IRV };

        if (subtype == SUBTYPE_IRV) {
            compute_irv(options, character_ids, encoded_votes, weights, seed)
        } else if (subtype == SUBTYPE_SCHULZE) {
            compute_schulze(options, character_ids, encoded_votes, weights, seed)
        } else if (subtype == SUBTYPE_BORDA) {
            compute_borda(options, character_ids, encoded_votes, weights, seed)
        } else {
            abort E_BAD_SUBTYPE
        }
    }

    // ── Borda (fully implemented as reference) ────────────────────────────────

    fun compute_borda(
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        let n_options = vector::length(options);
        let mut scores = vector::empty<u64>();
        let mut i = 0;
        while (i < n_options) {
            vector::push_back(&mut scores, 0);
            i = i + 1;
        };

        let n_ballots = vector::length(encoded_votes);
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let ranking = decode_u32_vec(vector::borrow(encoded_votes, b));
            let w = *vector::borrow(weights, b);
            total_weight = total_weight + w;
            let nr = vector::length(&ranking);
            let mut r = 0;
            while (r < nr) {
                let oid = *vector::borrow(&ranking, r);
                let idx = option_index(options, oid);
                if (idx < n_options) {
                    // Borda score: (N - rank) * weight
                    let score_contribution = ((n_options - r) as u64) * w;
                    let s = vector::borrow_mut(&mut scores, idx);
                    *s = *s + score_contribution;
                };
                r = r + 1;
            };
            b = b + 1;
        };

        // Winner = argmax(scores)
        let mut max_score: u64 = 0;
        let mut j = 0;
        while (j < n_options) {
            let s = *vector::borrow(&scores, j);
            if (s > max_score) max_score = s;
            j = j + 1;
        };
        let mut winners = vector::empty<u32>();
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
            winners = vector::empty<u32>();
            vector::push_back(&mut winners, chosen);
        };

        let mut payload = vector::empty<u8>();
        let mut p = 0;
        while (p < n_options) {
            append_u32(&mut payload, voting::option_id(vector::borrow(options, p)));
            append_u64(&mut payload, *vector::borrow(&scores, p));
            p = p + 1;
        };

        let quorum_met = total_weight > 0;
        (winners, payload, vector::empty<RoundResult>(), total_weight, quorum_met)
    }

    // ── IRV (stub — Borda fallback for v1 skeleton) ──────────────────────────
    fun compute_irv(
        options: &vector<Option_>,
        character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        // TODO(week-2): full IRV loop per design doc §6.3.
        // For now use Borda so skeleton compiles + smoke-tests pass.
        compute_borda(options, character_ids, encoded_votes, weights, seed)
    }

    fun compute_schulze(
        options: &vector<Option_>,
        character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        // TODO(week-2): pairwise matrix + Floyd-Warshall strongest-path.
        compute_borda(options, character_ids, encoded_votes, weights, seed)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun decode_u32_vec(v: &vector<u8>): vector<u32> {
        let n = vector::length(v);
        assert!(n >= 4, E_BAD_VOTE);
        let count = decode_u32_at(v, 0);
        let mut out = vector::empty<u32>();
        let mut i: u32 = 0;
        while (i < count) {
            let off = 4 + ((i as u64) * 4);
            assert!(off + 4 <= n, E_BAD_VOTE);
            vector::push_back(&mut out, decode_u32_at(v, off));
            i = i + 1;
        };
        out
    }

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
