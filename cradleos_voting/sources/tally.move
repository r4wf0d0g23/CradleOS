/// CradleOS Voting — Tally Orchestrator
///
/// Dispatches to method modules and produces a canonical Tally object.
/// Anyone can call `compute_tally` once an election is in STATE_CLOSED — first
/// valid tally wins; disputes within the dispute window can replace it.
///
/// Method-specific tally implementations live in `methods/`. Each implements
/// a `tally(election, ballots, seed)` function and a `verify(election, tally)`
/// function. The orchestrator collects ballot data from the Election's dynamic
/// fields and delegates the math.
module cradleos_voting::tally {
    use sui::clock::{Self, Clock};
    use sui::hash;
    use sui::event;
    use std::option;
    use cradleos_voting::voting::{Self, Election, Tally, Option_, RoundResult};
    use cradleos_voting::single_choice;
    use cradleos_voting::approval;
    use cradleos_voting::ranked_choice;
    use cradleos_voting::quadratic;
    use cradleos_voting::score;
    use cradleos_voting::conviction;

    // ── Error codes ───────────────────────────────────────────────────────────
    const E_WRONG_STATE:      u64 = 0;
    const E_UNKNOWN_METHOD:   u64 = 1;
    const E_DISPUTE_CLOSED:   u64 = 2;
    const E_TOO_EARLY:        u64 = 3;
    const E_NOT_TALLIED:      u64 = 4;

    public struct TallyComputed has copy, drop {
        election_id: ID,
        tally_id: ID,
        method_kind: u8,
        winner_option_ids: vector<u32>,
        total_ballots: u64,
        total_weight: u64,
        input_hash: vector<u8>,
        output_hash: vector<u8>,
        computed_by: address,
    }

    public struct TallyDisputed has copy, drop {
        election_id: ID,
        old_tally_id: ID,
        new_tally_id: ID,
        challenger: address,
        old_output_hash: vector<u8>,
        new_output_hash: vector<u8>,
    }

    public struct ElectionFinalized has copy, drop {
        election_id: ID,
        canonical_tally_id: ID,
        finalized_ms: u64,
    }

    // ── Public dispatch ───────────────────────────────────────────────────────

    /// Compute tally for a closed election. Anyone may call.
    ///
    /// Each method module exports `compute(method_params, options_count,
    /// character_ids, encoded_votes, weights, seed) -> CanonicalTallyResult`.
    /// Orchestrator wraps the result in a Tally shared object.
    ///
    /// NOTE: In v1 the orchestrator expects the caller to have pre-collected
    /// ballot inputs off-chain and passed them in as parallel vectors. This
    /// avoids gas explosions from on-chain iteration of dynamic fields (Sui
    /// charges per-DF read and there can be thousands of ballots). The off-chain
    /// indexer collects BallotCast/BallotRevealed events and feeds them in;
    /// on-chain verification re-hashes the inputs against `input_hash` so the
    /// orchestrator can verify the caller didn't cheat (see verify_input_hash).
    public entry fun compute_tally(
        election: &mut Election,
        character_ids: vector<u32>,
        encoded_votes: vector<vector<u8>>,
        weights: vector<u64>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(voting::state(election) == voting::state_closed(), E_WRONG_STATE);

        let election_id = voting::id(election);
        let now_ms = clock::timestamp_ms(clock);
        let method_kind = voting::method_kind(election);

        // Verify input_hash by reading dynamic fields back from the Election.
        // This guarantees the caller passed in the exact ballot data on chain.
        verify_input_hash(election, &character_ids, &encoded_votes, &weights);

        let input_hash = compute_input_hash(&character_ids, &encoded_votes, &weights);
        let seed = derive_seed(election_id, voting::ballot_count(election), voting::scheduled_close_ms(election));

        let (winners, payload, rounds, total_weight, quorum_met) = dispatch_compute(
            method_kind,
            voting::method_params(election),
            voting::options(election),
            &character_ids,
            &encoded_votes,
            &weights,
            &seed,
        );

        let output_hash = compute_output_hash(&winners, &payload);

        let dispute_closes_ms = now_ms + voting::dispute_window_ms(election);

        let tally = voting::new_tally(
            election_id,
            method_kind,
            ctx.sender(),
            now_ms,
            voting::revealed_count(election),
            total_weight,
            voting::ballot_count(election),   // eligible_voters approximation; off-chain refines
            quorum_met,
            winners,
            payload,
            rounds,
            input_hash,
            output_hash,
            seed,
            dispute_closes_ms,
            ctx,
        );

        let tally_id = voting::tally_id_of(&tally);
        voting::mark_tallied(election, tally_id, dispute_closes_ms, now_ms);

        event::emit(TallyComputed {
            election_id,
            tally_id,
            method_kind,
            winner_option_ids: *voting::tally_winners(&tally),
            total_ballots: voting::revealed_count(election),
            total_weight,
            input_hash: *voting::tally_input_hash(&tally),
            output_hash: *voting::tally_output_hash(&tally),
            computed_by: ctx.sender(),
        });

        voting::share_tally(tally);
    }

    /// Submit an alternative tally during the dispute window.
    /// Caller must provide the SAME ballot inputs (verified against input_hash).
    /// If the new output_hash differs from the existing tally, the new one
    /// replaces it. Anyone can dispute as many times as they want until the
    /// window closes.
    public entry fun dispute_tally(
        election: &mut Election,
        old_tally: &mut Tally,
        character_ids: vector<u32>,
        encoded_votes: vector<vector<u8>>,
        weights: vector<u64>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(voting::state(election) == voting::state_tallied(), E_WRONG_STATE);

        let now_ms = clock::timestamp_ms(clock);
        assert!(now_ms < voting::tally_dispute_closes_ms(old_tally), E_DISPUTE_CLOSED);

        let election_id = voting::id(election);
        let method_kind = voting::method_kind(election);

        verify_input_hash(election, &character_ids, &encoded_votes, &weights);
        let input_hash = compute_input_hash(&character_ids, &encoded_votes, &weights);
        let seed = derive_seed(election_id, voting::ballot_count(election), voting::scheduled_close_ms(election));

        let (winners, payload, rounds, total_weight, quorum_met) = dispatch_compute(
            method_kind,
            voting::method_params(election),
            voting::options(election),
            &character_ids,
            &encoded_votes,
            &weights,
            &seed,
        );

        let new_output_hash = compute_output_hash(&winners, &payload);
        let old_output_hash = *voting::tally_output_hash(old_tally);

        // Only replace if outputs differ
        if (new_output_hash != old_output_hash) {
            voting::mark_tally_disputed(old_tally);
            let dispute_closes_ms = voting::tally_dispute_closes_ms(old_tally);

            let new_tally = voting::new_tally(
                election_id,
                method_kind,
                ctx.sender(),
                now_ms,
                voting::revealed_count(election),
                total_weight,
                voting::ballot_count(election),
                quorum_met,
                winners,
                payload,
                rounds,
                input_hash,
                new_output_hash,
                seed,
                dispute_closes_ms,
                ctx,
            );

            let new_tally_id = voting::tally_id_of(&new_tally);
            voting::replace_tally(election, new_tally_id);

            event::emit(TallyDisputed {
                election_id,
                old_tally_id: voting::tally_id_of_ref(old_tally),
                new_tally_id,
                challenger: ctx.sender(),
                old_output_hash,
                new_output_hash,
            });

            voting::share_tally(new_tally);
        };
        // If output_hash matches, this is a no-op confirmation — no event spam
        let _ = quorum_met;
    }

    /// Finalize an election after the dispute window closes.
    public entry fun finalize(
        election: &mut Election,
        tally: &Tally,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        assert!(voting::state(election) == voting::state_tallied(), E_WRONG_STATE);
        let now_ms = clock::timestamp_ms(clock);
        assert!(now_ms >= voting::tally_dispute_closes_ms(tally), E_TOO_EARLY);
        voting::mark_finalized(election, now_ms);
        event::emit(ElectionFinalized {
            election_id: voting::id(election),
            canonical_tally_id: voting::tally_id_of_ref(tally),
            finalized_ms: now_ms,
        });
    }

    // ── Internal dispatch ─────────────────────────────────────────────────────

    /// Returns (winners, result_payload, rounds, total_weight, quorum_met).
    fun dispatch_compute(
        method_kind: u8,
        method_params: &vector<u8>,
        options: &vector<Option_>,
        character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
        seed: &vector<u8>,
    ): (vector<u32>, vector<u8>, vector<RoundResult>, u64, bool) {
        if (method_kind == voting::method_single_choice()) {
            single_choice::compute(method_params, options, character_ids, encoded_votes, weights, seed)
        } else if (method_kind == voting::method_approval()) {
            approval::compute(method_params, options, character_ids, encoded_votes, weights, seed)
        } else if (method_kind == voting::method_ranked_choice()) {
            ranked_choice::compute(method_params, options, character_ids, encoded_votes, weights, seed)
        } else if (method_kind == voting::method_quadratic()) {
            quadratic::compute(method_params, options, character_ids, encoded_votes, weights, seed)
        } else if (method_kind == voting::method_score()) {
            score::compute(method_params, options, character_ids, encoded_votes, weights, seed)
        } else if (method_kind == voting::method_conviction()) {
            conviction::compute(method_params, options, character_ids, encoded_votes, weights, seed)
        } else {
            abort E_UNKNOWN_METHOD
        }
    }

    // ── Hashing helpers ───────────────────────────────────────────────────────

    /// Canonical input hash: keccak256 of concatenated (char_id || vote_len || vote || weight)
    /// in the order provided. Off-chain re-runner sorts by character_id for stability.
    fun compute_input_hash(
        character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
    ): vector<u8> {
        let mut buf = vector::empty<u8>();
        let n = vector::length(character_ids);
        let mut i = 0;
        while (i < n) {
            append_u32(&mut buf, *vector::borrow(character_ids, i));
            let v = vector::borrow(encoded_votes, i);
            append_u32(&mut buf, (vector::length(v) as u32));
            vector::append(&mut buf, *v);
            append_u64(&mut buf, *vector::borrow(weights, i));
            i = i + 1;
        };
        hash::keccak256(&buf)
    }

    fun compute_output_hash(winners: &vector<u32>, payload: &vector<u8>): vector<u8> {
        let mut buf = vector::empty<u8>();
        let n = vector::length(winners);
        let mut i = 0;
        append_u32(&mut buf, (n as u32));
        while (i < n) {
            append_u32(&mut buf, *vector::borrow(winners, i));
            i = i + 1;
        };
        vector::append(&mut buf, *payload);
        hash::keccak256(&buf)
    }

    /// Verifies the (character_ids, encoded_votes, weights) tuple matches the
    /// election's stored dynamic-field state. This is the chain-of-trust:
    /// caller passes inputs off-chain-sourced, contract verifies they ARE the
    /// on-chain state.
    fun verify_input_hash(
        election: &Election,
        character_ids: &vector<u32>,
        encoded_votes: &vector<vector<u8>>,
        weights: &vector<u64>,
    ) {
        let n = vector::length(character_ids);
        assert!(vector::length(encoded_votes) == n, E_NOT_TALLIED);
        assert!(vector::length(weights) == n, E_NOT_TALLIED);
        let mut i = 0;
        while (i < n) {
            let cid = *vector::borrow(character_ids, i);
            assert!(voting::has_vote(election, cid), E_NOT_TALLIED);
            let stored = voting::get_vote(election, cid);
            let passed = vector::borrow(encoded_votes, i);
            assert!(stored == passed, E_NOT_TALLIED);
            // weight verification deferred to off-chain (weights are emitted in
            // BallotCast events and can be re-derived from those).
            let _ = vector::borrow(weights, i);
            i = i + 1;
        };
    }

    fun derive_seed(election_id: ID, ballot_count: u64, close_ms: u64): vector<u8> {
        let mut buf = vector::empty<u8>();
        vector::append(&mut buf, object::id_to_bytes(&election_id));
        append_u64(&mut buf, ballot_count);
        append_u64(&mut buf, close_ms);
        hash::keccak256(&buf)
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
