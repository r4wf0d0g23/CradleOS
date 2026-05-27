/// CradleOS Voting — Approval voting tally.
///
/// Encoding: BCS<vector<u32>> — list of approved option_ids, sorted ascending,
///   deduplicated; length ≤ method_params[0] (max_approvals, 0 = unlimited)
/// Tally: winner = argmax(Σ weight where option_id ∈ ballot.approved)
module cradleos_voting::approval {
    use cradleos_voting::voting::{Self, Option_, RoundResult};

    const E_BAD_VOTE: u64 = 0;
    const E_TOO_MANY_APPROVALS: u64 = 1;

    public fun compute(
        method_params: &vector<u8>,
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        let max_approvals: u32 = if (vector::length(method_params) >= 4) {
            decode_u32_at(method_params, 0)
        } else { 0 };  // 0 = unlimited

        let n_options = vector::length(options);
        let mut counts = vector::empty<u64>();
        let mut i = 0;
        while (i < n_options) {
            vector::push_back(&mut counts, 0);
            i = i + 1;
        };

        let n_ballots = vector::length(encoded_votes);
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let v = vector::borrow(encoded_votes, b);
            let approved = decode_u32_vec(v);
            if (max_approvals > 0) {
                assert!((vector::length(&approved) as u32) <= max_approvals, E_TOO_MANY_APPROVALS);
            };
            let w = *vector::borrow(weights, b);
            total_weight = total_weight + w;
            let mut a = 0;
            let na = vector::length(&approved);
            while (a < na) {
                let oid = *vector::borrow(&approved, a);
                let idx = option_index(options, oid);
                if (idx < n_options) {
                    let c = vector::borrow_mut(&mut counts, idx);
                    *c = *c + w;
                };
                a = a + 1;
            };
            b = b + 1;
        };

        // Pick top option (with tiebreak by seed)
        let mut max_count: u64 = 0;
        let mut j = 0;
        while (j < n_options) {
            let c = *vector::borrow(&counts, j);
            if (c > max_count) max_count = c;
            j = j + 1;
        };

        let mut winners = vector::empty<u32>();
        let mut k = 0;
        while (k < n_options) {
            if (*vector::borrow(&counts, k) == max_count && max_count > 0) {
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
            append_u64(&mut payload, *vector::borrow(&counts, p));
            p = p + 1;
        };

        let quorum_met = total_weight > 0;
        let rounds = vector::empty<RoundResult>();
        (winners, payload, rounds, total_weight, quorum_met)
    }

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
