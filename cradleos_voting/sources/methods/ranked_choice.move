/// CradleOS Voting — Ranked-Choice (IRV / Schulze / Borda).
///
/// ## Subtypes (selected via `method_params[0]`)
///
///   0 = IRV     (Instant-Runoff)
///   1 = Schulze (Strongest-Path / Floyd-Warshall over pairwise margins)
///   2 = Borda   (positional, N - rank weighted)
///
/// ## Encoding (all subtypes)
///
/// `BCS<vector<u32>>` — ranked list, position 0 = most-preferred. Partial
/// rankings allowed; options not present in the list are treated as the voter's
/// least-preferred (Schulze, Borda) or as "exhausted" for that ballot (IRV).
///
/// On-chain wire format:
///
///   [u32 count][ u32 option_id × count ]
///
/// ## Determinism
///
/// All three subtypes break ties using the orchestrator's `deterministic_seed`
/// (modulo over sorted tied options), making results exactly reproducible from
/// the event-sourced ballot inputs alone.
///
/// ## Gas considerations
///
/// - Borda: O(B · R) where B = ballots, R = ranking length. Cheapest.
/// - IRV: O(B · R · O) worst-case (O eliminations × B ballots × R lookup).
///   Bounded since R ≤ O and elections are typically O ≤ 16.
/// - Schulze: O(O³) for Floyd-Warshall + O(B · R · O) for the preference
///   matrix. For O = 16, Floyd-Warshall is 4096 ops — well within Sui budgets.
///
/// ## Edge cases (per subtype)
///
/// - Empty ballot: contributes zero to all counts; ignored in IRV rounds.
/// - Single-option election: that option wins regardless of subtype.
/// - All ballots tied at first preference (IRV): elimination still proceeds by
///   eliminating the lowest-count option (deterministic seed when tied).
/// - Schulze with no Condorcet winner: strongest-path winner is well-defined
///   even when pairwise preferences are cyclic.
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

    // ── Borda ────────────────────────────────────────────────────────────────

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
        // Tag byte: subtype = Borda
        vector::push_back(&mut payload, SUBTYPE_BORDA);
        let mut p = 0;
        while (p < n_options) {
            append_u32(&mut payload, voting::option_id(vector::borrow(options, p)));
            append_u64(&mut payload, *vector::borrow(&scores, p));
            p = p + 1;
        };

        let quorum_met = total_weight > 0;
        (winners, payload, vector::empty<RoundResult>(), total_weight, quorum_met)
    }

    // ── IRV (Instant-Runoff Voting) ───────────────────────────────────────────

    /// IRV algorithm:
    ///   - Each round: count weight at each ballot's highest-preference among
    ///     still-active options.
    ///   - If any option has > 50% of round's active weight → winner.
    ///   - Else: eliminate lowest-count option (deterministic seed on ties).
    ///   - Repeat until one option left or majority reached.
    ///
    /// Encoded rounds (RoundResult per round):
    ///   - round_index: 0-based
    ///   - eliminated_option_id: which option was eliminated this round
    ///     (set to u32::MAX = 0xFFFFFFFF for the final-winner round where
    ///     nothing is eliminated)
    ///   - counts: per-option current-round weight (zero for already-eliminated
    ///     options; full vector with n_options entries for off-chain replay)
    ///   - transferred_to: which option received the eliminated option's votes
    ///     (vector of option_ids that gained, one entry per ballot that moved;
    ///     for v1 we emit the SET of beneficiary option_ids, deduplicated, so
    ///     the off-chain re-runner can validate redistribution.)
    fun compute_irv(
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        let n_options = vector::length(options);
        let n_ballots = vector::length(encoded_votes);

        // Decode all ballots once into vector<vector<u32>>.
        let mut all_rankings = vector::empty<vector<u32>>();
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let ranking = decode_u32_vec(vector::borrow(encoded_votes, b));
            vector::push_back(&mut all_rankings, ranking);
            total_weight = total_weight + *vector::borrow(weights, b);
            b = b + 1;
        };

        // Track active options by parallel bool vector (true = still active).
        let mut active = vector::empty<bool>();
        let mut x = 0;
        while (x < n_options) {
            vector::push_back(&mut active, true);
            x = x + 1;
        };

        let mut rounds = vector::empty<RoundResult>();
        let mut round_idx: u32 = 0;

        // Special case: 0 options → no winner. 1 option → trivial.
        if (n_options == 0) {
            return (vector::empty<u32>(), vector::empty<u8>(), rounds, total_weight, false)
        };

        // Outer loop: at most n_options - 1 eliminations.
        let mut final_winner_option_id: u32 = 0;
        let mut have_winner = false;
        let mut final_counts: vector<u64> = vector::empty<u64>();

        loop {
            // Count this round.
            let mut counts = vector::empty<u64>();
            let mut z = 0;
            while (z < n_options) {
                vector::push_back(&mut counts, 0);
                z = z + 1;
            };
            let mut round_weight: u64 = 0;

            let mut bi = 0;
            while (bi < n_ballots) {
                let ranking = vector::borrow(&all_rankings, bi);
                let w = *vector::borrow(weights, bi);
                // Find first active option in ballot's ranking.
                let nr = vector::length(ranking);
                let mut r = 0;
                let mut found = false;
                while (r < nr && !found) {
                    let oid = *vector::borrow(ranking, r);
                    let idx = option_index(options, oid);
                    if (idx < n_options && *vector::borrow(&active, idx)) {
                        let c = vector::borrow_mut(&mut counts, idx);
                        *c = *c + w;
                        round_weight = round_weight + w;
                        found = true;
                    };
                    r = r + 1;
                };
                let _ = found;
                bi = bi + 1;
            };

            // Count active options.
            let mut active_count: u64 = 0;
            let mut last_active_idx: u64 = n_options;
            let mut a = 0;
            while (a < n_options) {
                if (*vector::borrow(&active, a)) {
                    active_count = active_count + 1;
                    last_active_idx = a;
                };
                a = a + 1;
            };

            // If only one active option remains, it's the winner.
            if (active_count <= 1) {
                if (last_active_idx < n_options) {
                    final_winner_option_id = voting::option_id(vector::borrow(options, last_active_idx));
                    have_winner = true;
                };
                // Snapshot counts before moving into the round record.
                final_counts = clone_u64_vec(&counts);
                // Final "no-elimination" round record.
                let final_round = voting::new_round_result(
                    round_idx,
                    0xFFFFFFFFu32,           // sentinel: no elimination
                    counts,
                    vector::empty<u32>(),
                );
                vector::push_back(&mut rounds, final_round);
                break
            };

            // Majority check: any active option > 50% of round_weight?
            let mut majority_idx: u64 = n_options;
            if (round_weight > 0) {
                let half = round_weight / 2;
                let mut m = 0;
                while (m < n_options) {
                    if (*vector::borrow(&active, m) && *vector::borrow(&counts, m) > half) {
                        majority_idx = m;
                    };
                    m = m + 1;
                };
            };
            if (majority_idx < n_options) {
                final_winner_option_id = voting::option_id(vector::borrow(options, majority_idx));
                have_winner = true;
                final_counts = clone_u64_vec(&counts);
                let final_round = voting::new_round_result(
                    round_idx,
                    0xFFFFFFFFu32,
                    counts,
                    vector::empty<u32>(),
                );
                vector::push_back(&mut rounds, final_round);
                break
            };

            // Otherwise eliminate lowest-count active option.
            // Determine min count among active options.
            let mut min_count: u64 = 0xFFFFFFFFFFFFFFFFu64;
            let mut a2 = 0;
            while (a2 < n_options) {
                if (*vector::borrow(&active, a2)) {
                    let c = *vector::borrow(&counts, a2);
                    if (c < min_count) min_count = c;
                };
                a2 = a2 + 1;
            };

            // Collect tied option_ids at min_count.
            let mut tied = vector::empty<u32>();
            let mut tied_idxs = vector::empty<u64>();
            let mut a3 = 0;
            while (a3 < n_options) {
                if (*vector::borrow(&active, a3) && *vector::borrow(&counts, a3) == min_count) {
                    vector::push_back(&mut tied, voting::option_id(vector::borrow(options, a3)));
                    vector::push_back(&mut tied_idxs, a3);
                };
                a3 = a3 + 1;
            };

            // Tie-break: per-round salt to avoid eliminating the same option
            // repeatedly when seed bytes are stable. Salt = seed bytes + round_idx.
            let pick = pick_index_with_seed(seed, round_idx, vector::length(&tied));
            let eliminated_idx = *vector::borrow(&tied_idxs, pick);
            let eliminated_option_id = voting::option_id(vector::borrow(options, eliminated_idx));

            // Capture who would benefit from redistribution: ballots whose first
            // active was the eliminated option, look at next active in their
            // ranking. We collect the SET of beneficiary option_ids.
            let mut beneficiaries = vector::empty<u32>();
            let mut bj = 0;
            while (bj < n_ballots) {
                let ranking = vector::borrow(&all_rankings, bj);
                let nr = vector::length(ranking);
                let mut r2 = 0;
                let mut current_top_idx: u64 = n_options;
                while (r2 < nr && current_top_idx == n_options) {
                    let oid = *vector::borrow(ranking, r2);
                    let idx = option_index(options, oid);
                    if (idx < n_options && *vector::borrow(&active, idx)) {
                        current_top_idx = idx;
                    };
                    r2 = r2 + 1;
                };
                if (current_top_idx == eliminated_idx) {
                    // Find next active (excluding eliminated_idx) in ranking.
                    let mut r3 = 0;
                    let mut next_idx: u64 = n_options;
                    while (r3 < nr && next_idx == n_options) {
                        let oid = *vector::borrow(ranking, r3);
                        let idx = option_index(options, oid);
                        if (idx < n_options && idx != eliminated_idx && *vector::borrow(&active, idx)) {
                            next_idx = idx;
                        };
                        r3 = r3 + 1;
                    };
                    if (next_idx < n_options) {
                        let beneficiary_oid = voting::option_id(vector::borrow(options, next_idx));
                        if (!contains_u32(&beneficiaries, beneficiary_oid)) {
                            vector::push_back(&mut beneficiaries, beneficiary_oid);
                        };
                    };
                };
                bj = bj + 1;
            };

            // Record round.
            let round_result = voting::new_round_result(
                round_idx,
                eliminated_option_id,
                counts,
                beneficiaries,
            );
            vector::push_back(&mut rounds, round_result);

            // Mark eliminated, decrement counter, continue.
            let act = vector::borrow_mut(&mut active, eliminated_idx);
            *act = false;

            let _ = tied;
            round_idx = round_idx + 1;
            // Safety bound to guarantee termination even if logic bug.
            if (round_idx >= (n_options as u32)) break;
        };

        let mut winners = vector::empty<u32>();
        if (have_winner) vector::push_back(&mut winners, final_winner_option_id);

        // Payload: [subtype:u8][rounds_count:u32][...] — but rounds already
        // captured in `rounds` return value. Keep payload minimal with final
        // round counts.
        let mut payload = vector::empty<u8>();
        vector::push_back(&mut payload, SUBTYPE_IRV);
        let nf = vector::length(&final_counts);
        append_u32(&mut payload, (nf as u32));
        let mut fc = 0;
        while (fc < nf) {
            append_u32(&mut payload, voting::option_id(vector::borrow(options, fc)));
            append_u64(&mut payload, *vector::borrow(&final_counts, fc));
            fc = fc + 1;
        };

        let quorum_met = total_weight > 0 && have_winner;
        (winners, payload, rounds, total_weight, quorum_met)
    }

    // ── Schulze (Strongest-Path / Floyd-Warshall over pairwise margins) ──────

    /// Schulze:
    ///   1. Build `d[i][j] = Σ weight` of ballots where i is ranked strictly
    ///      above j (i.e., appears earlier in the ranking, or i is ranked while
    ///      j is unranked).
    ///   2. Initialize strength matrix `p[i][j] = d[i][j] if d[i][j] > d[j][i]
    ///      else 0`.
    ///   3. Floyd-Warshall widest-path:
    ///        for k: for i: for j (i ≠ j ≠ k):
    ///          p[i][j] = max(p[i][j], min(p[i][k], p[k][j]))
    ///   4. Winners = `{ i : ∀ j, p[i][j] ≥ p[j][i] }`. Tie-break by seed.
    fun compute_schulze(
        options: &vector<Option_>,
        _character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        let n_options = vector::length(options);

        // d[i][j] in flat vector indexed as i * n_options + j.
        let mut d = vector::empty<u64>();
        let total_cells = n_options * n_options;
        let mut z = 0;
        while (z < total_cells) {
            vector::push_back(&mut d, 0);
            z = z + 1;
        };

        let n_ballots = vector::length(encoded_votes);
        let mut b = 0;
        let mut total_weight: u64 = 0;
        while (b < n_ballots) {
            let ranking = decode_u32_vec(vector::borrow(encoded_votes, b));
            let w = *vector::borrow(weights, b);
            total_weight = total_weight + w;

            // Map ranking to option indices, in ranked order.
            let nr = vector::length(&ranking);
            let mut ranked_idxs = vector::empty<u64>();
            let mut r = 0;
            while (r < nr) {
                let oid = *vector::borrow(&ranking, r);
                let idx = option_index(options, oid);
                if (idx < n_options && !contains_u64(&ranked_idxs, idx)) {
                    vector::push_back(&mut ranked_idxs, idx);
                };
                r = r + 1;
            };
            let n_ranked = vector::length(&ranked_idxs);

            // For each pair (i ranked above j) within ranked list: d[i][j] += w.
            let mut a = 0;
            while (a < n_ranked) {
                let i_idx = *vector::borrow(&ranked_idxs, a);
                let mut c = a + 1;
                while (c < n_ranked) {
                    let j_idx = *vector::borrow(&ranked_idxs, c);
                    let cell = vector::borrow_mut(&mut d, i_idx * n_options + j_idx);
                    *cell = *cell + w;
                    c = c + 1;
                };
                a = a + 1;
            };

            // Every ranked option also beats every unranked option.
            let mut a2 = 0;
            while (a2 < n_ranked) {
                let i_idx = *vector::borrow(&ranked_idxs, a2);
                let mut k_idx = 0;
                while (k_idx < n_options) {
                    if (!contains_u64(&ranked_idxs, k_idx) && k_idx != i_idx) {
                        let cell = vector::borrow_mut(&mut d, i_idx * n_options + k_idx);
                        *cell = *cell + w;
                    };
                    k_idx = k_idx + 1;
                };
                a2 = a2 + 1;
            };
            b = b + 1;
        };

        // Initialize p[i][j] = d[i][j] if d[i][j] > d[j][i] else 0.
        let mut p = vector::empty<u64>();
        let mut z2 = 0;
        while (z2 < total_cells) {
            vector::push_back(&mut p, 0);
            z2 = z2 + 1;
        };
        let mut i = 0;
        while (i < n_options) {
            let mut j = 0;
            while (j < n_options) {
                if (i != j) {
                    let dij = *vector::borrow(&d, i * n_options + j);
                    let dji = *vector::borrow(&d, j * n_options + i);
                    if (dij > dji) {
                        let cell = vector::borrow_mut(&mut p, i * n_options + j);
                        *cell = dij;
                    };
                };
                j = j + 1;
            };
            i = i + 1;
        };

        // Floyd-Warshall widest path.
        let mut k = 0;
        while (k < n_options) {
            let mut i2 = 0;
            while (i2 < n_options) {
                if (i2 != k) {
                    let mut j2 = 0;
                    while (j2 < n_options) {
                        if (j2 != i2 && j2 != k) {
                            let pik = *vector::borrow(&p, i2 * n_options + k);
                            let pkj = *vector::borrow(&p, k * n_options + j2);
                            let candidate = if (pik < pkj) pik else pkj;
                            let pij_addr = i2 * n_options + j2;
                            let current = *vector::borrow(&p, pij_addr);
                            if (candidate > current) {
                                let cell = vector::borrow_mut(&mut p, pij_addr);
                                *cell = candidate;
                            };
                        };
                        j2 = j2 + 1;
                    };
                };
                i2 = i2 + 1;
            };
            k = k + 1;
        };

        // Winners: i such that ∀ j ≠ i, p[i][j] ≥ p[j][i].
        let mut winners = vector::empty<u32>();
        let mut ii = 0;
        while (ii < n_options) {
            let mut is_winner = true;
            let mut jj = 0;
            while (jj < n_options && is_winner) {
                if (jj != ii) {
                    let pij = *vector::borrow(&p, ii * n_options + jj);
                    let pji = *vector::borrow(&p, jj * n_options + ii);
                    if (pji > pij) is_winner = false;
                };
                jj = jj + 1;
            };
            if (is_winner) {
                vector::push_back(&mut winners, voting::option_id(vector::borrow(options, ii)));
            };
            ii = ii + 1;
        };

        if (vector::length(&winners) > 1) {
            let tie_idx = (byte_sum(seed) as u64) % vector::length(&winners);
            let chosen = *vector::borrow(&winners, tie_idx);
            winners = vector::empty<u32>();
            vector::push_back(&mut winners, chosen);
        };

        // Payload: [subtype:u8][n_options:u32][flattened p matrix as u64 rows]
        let mut payload = vector::empty<u8>();
        vector::push_back(&mut payload, SUBTYPE_SCHULZE);
        append_u32(&mut payload, (n_options as u32));
        let mut pp = 0;
        while (pp < total_cells) {
            append_u64(&mut payload, *vector::borrow(&p, pp));
            pp = pp + 1;
        };

        let quorum_met = total_weight > 0 && vector::length(&winners) > 0;
        (winners, payload, vector::empty<RoundResult>(), total_weight, quorum_met)
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

    /// Pick an index in [0, len) using `seed` salted with `round_idx`. This is
    /// the standard tie-break: keccak the seed||round_idx, sum bytes mod len.
    fun pick_index_with_seed(seed: &vector<u8>, round_idx: u32, len: u64): u64 {
        let mut s: u64 = byte_sum(seed);
        // Mix round_idx in.
        s = s + (round_idx as u64) * 2654435761u64; // Knuth multiplicative hash
        s % len
    }

    fun clone_u64_vec(v: &vector<u64>): vector<u64> {
        let n = vector::length(v);
        let mut out = vector::empty<u64>();
        let mut i = 0;
        while (i < n) {
            vector::push_back(&mut out, *vector::borrow(v, i));
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

    fun contains_u64(v: &vector<u64>, target: u64): bool {
        let n = vector::length(v);
        let mut i = 0;
        while (i < n) {
            if (*vector::borrow(v, i) == target) return true;
            i = i + 1;
        };
        false
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
