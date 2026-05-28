/// CradleOS Voting — Core Module
///
/// Election lifecycle, ballot casting, commit-reveal, sponsored-tx, and the
/// proof verification surface for community-provided extensions.
///
/// See memory/projects/voting-infrastructure.md for full design rationale.
module cradleos_voting::voting {
    use sui::table::{Self, Table};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::hash;
    use std::string::{Self, String};
    use std::option::{Self, Option};

    use cradleos_voting::extension::{Self, ExtensionRegistry};

    // ── Method kind constants (kinds 0–63 = built-in) ────────────────────────
    public struct MethodKindMarker has drop {}  // suppress unused-use lints in pure consumers
    const METHOD_SINGLE_CHOICE: u8 = 0;
    const METHOD_APPROVAL:      u8 = 1;
    const METHOD_RANKED_CHOICE: u8 = 2;     // subtype encoded in method_params[0]
    const METHOD_QUADRATIC:     u8 = 3;
    const METHOD_SCORE:         u8 = 4;
    const METHOD_CONVICTION:    u8 = 5;

    // ── Eligibility kind constants ────────────────────────────────────────────
    const ELIG_OPEN:            u8 = 0;
    const ELIG_ALLOWLIST:       u8 = 1;
    const ELIG_TRIBE_CRADLEOS:  u8 = 2;
    const ELIG_TRIBE_INGAME:    u8 = 3;
    const ELIG_COMPOSITE:       u8 = 4;

    // ── Weight kind constants ─────────────────────────────────────────────────
    const WEIGHT_ONE:           u8 = 0;
    const WEIGHT_ROLE:          u8 = 1;
    const WEIGHT_CHAR_AGE:      u8 = 2;
    const WEIGHT_ASSET:         u8 = 3;
    const WEIGHT_COMPOSITE:     u8 = 4;

    // ── Privacy kind constants ────────────────────────────────────────────────
    const PRIVACY_PUBLIC:        u8 = 0;
    const PRIVACY_COMMIT_REVEAL: u8 = 1;
    const PRIVACY_ZK:            u8 = 2;     // designed-for; entry aborts in v1

    // ── State constants ───────────────────────────────────────────────────────
    const STATE_DRAFT:     u8 = 0;
    const STATE_SCHEDULED: u8 = 1;
    const STATE_OPEN:      u8 = 2;
    const STATE_REVEAL:    u8 = 3;
    const STATE_CLOSED:    u8 = 4;
    const STATE_TALLIED:   u8 = 5;
    const STATE_FINALIZED: u8 = 6;
    const STATE_CANCELED:  u8 = 7;

    // ── Error codes ───────────────────────────────────────────────────────────
    const E_NOT_CREATOR:           u64 = 0;
    const E_WRONG_STATE:           u64 = 1;
    const E_OPTION_NOT_FOUND:      u64 = 2;
    const E_DUPLICATE_OPTION:      u64 = 3;
    const E_BAD_SCHEDULE:          u64 = 4;
    const E_ALREADY_VOTED:         u64 = 5;
    const E_NOT_OPEN:              u64 = 6;
    const E_BAD_PROOF:             u64 = 7;
    const E_PROOF_STALE:           u64 = 8;
    const E_PROOF_MISMATCH:        u64 = 9;
    const E_NOT_ELIGIBLE:          u64 = 10;
    const E_UNKNOWN_KIND:          u64 = 11;
    const E_DEPRECATED_PROVIDER:   u64 = 12;
    const E_BAD_VOTE_ENCODING:     u64 = 13;
    const E_NOT_COMMIT_REVEAL:     u64 = 14;
    const E_COMMITMENT_MISMATCH:   u64 = 15;
    const E_REVEAL_TOO_EARLY:      u64 = 16;
    const E_REVEAL_TOO_LATE:       u64 = 17;
    const E_NO_SPONSOR_CAP:        u64 = 18;
    const E_SPONSOR_EXHAUSTED:     u64 = 19;
    const E_SPONSOR_EXPIRED:       u64 = 20;
    const E_DISPUTE_CLOSED:        u64 = 21;
    const E_NOT_TALLIED:           u64 = 22;
    const E_TALLY_EXISTS:          u64 = 23;
    const E_ZK_NOT_IMPLEMENTED:    u64 = 24;

    // ── Sub-structs ───────────────────────────────────────────────────────────

    public struct Option_ has store, copy, drop {
        id: u32,
        label: String,
        metadata_uri: String,
        payload: vector<u8>,
    }

    public struct RoundResult has store, copy, drop {
        round_index: u32,
        eliminated_option_id: u32,
        counts: vector<u64>,
        transferred_to: vector<u32>,
    }

    // ── Core objects ──────────────────────────────────────────────────────────

    public struct Election has key {
        id: UID,
        creator: address,
        creator_character_id: u32,
        title: String,
        description: String,
        metadata_uri: String,

        // Lifecycle
        state: u8,
        created_ms: u64,
        scheduled_open_ms: u64,
        scheduled_close_ms: u64,
        reveal_deadline_ms: u64,
        dispute_window_ms: u64,
        finalized_ms: u64,

        // Method config
        method_kind: u8,
        method_params: vector<u8>,
        options: vector<Option_>,
        next_option_id: u32,

        // Eligibility config
        eligibility_kind: u8,
        eligibility_params: vector<u8>,
        eligibility_snapshot_ms: u64,

        // Weight config
        weight_kind: u8,
        weight_params: vector<u8>,

        // Privacy config
        privacy_kind: u8,
        privacy_params: vector<u8>,

        // Gas / sponsorship
        sponsored: bool,
        sponsor_cap_id: Option<ID>,
        sponsor_address: Option<address>,
        max_ballots_funded: u64,
        funded_so_far: u64,

        // Behavioral flags
        allow_recast: bool,

        // Vote accounting
        ballot_count: u64,
        revealed_count: u64,
        total_weight_cast: u64,

        // Tally outcome
        tally_id: Option<ID>,
        tally_finalized: bool,
    }

    /// Soulbound voter receipt. Voter-owned. `key` only (no `store`).
    public struct Ballot has key {
        id: UID,
        election_id: ID,
        voter_address: address,
        character_id: u32,
        method_kind: u8,
        privacy_kind: u8,
        cast_ms: u64,
        weight: u64,
        weight_kind: u8,
        weight_proof_bytes: vector<u8>,
        encoded_vote: vector<u8>,       // empty for committed but not-yet-revealed
        commitment: vector<u8>,         // hash for commit-reveal; empty for public
        revealed: bool,
        revealed_ms: u64,
    }

    /// Shared tally object. Computed by `tally::compute_tally`. One per election
    /// at a time; disputes replace it after the dispute window.
    public struct Tally has key {
        id: UID,
        election_id: ID,
        method_kind: u8,
        computed_by: address,
        computed_ms: u64,
        total_ballots: u64,
        total_weight: u64,
        eligible_voters: u64,
        quorum_met: bool,
        winner_option_ids: vector<u32>,
        result_payload: vector<u8>,
        rounds: vector<RoundResult>,
        input_hash: vector<u8>,
        output_hash: vector<u8>,
        deterministic_seed: vector<u8>,
        disputed: bool,
        dispute_window_closes_ms: u64,
    }

    public struct SponsorCap has key, store {
        id: UID,
        sponsor: address,
        election_id: ID,
        max_ballots_funded: u64,
        funded_so_far: u64,
        expiry_ms: u64,
    }

    // ── Proof objects (single-use, in-tx witnesses) ───────────────────────────

    public struct EligibilityProof has key, store {
        id: UID,
        election_id: ID,
        voter: address,
        character_id: u32,
        kind: u8,
        provider_package: address,
        eligible: bool,
        minted_epoch: u64,
    }

    public struct WeightProof has key, store {
        id: UID,
        election_id: ID,
        voter: address,
        character_id: u32,
        kind: u8,
        provider_package: address,
        weight: u64,
        inputs_hash: vector<u8>,
        minted_epoch: u64,
    }

    // ── Dynamic field keys ────────────────────────────────────────────────────

    public struct VoteKey         has copy, drop, store { character_id: u32 }
    public struct CommitKey       has copy, drop, store { character_id: u32 }
    public struct OptionExistsKey has copy, drop, store { option_id: u32 }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct ElectionCreated has copy, drop {
        election_id: ID,
        creator: address,
        creator_character_id: u32,
        title: String,
        method_kind: u8,
        eligibility_kind: u8,
        weight_kind: u8,
        privacy_kind: u8,
    }

    public struct ElectionPublished has copy, drop {
        election_id: ID,
        options_count: u32,
        scheduled_open_ms: u64,
        scheduled_close_ms: u64,
        reveal_deadline_ms: u64,
    }

    public struct ElectionStateChanged has copy, drop {
        election_id: ID,
        old_state: u8,
        new_state: u8,
        at_ms: u64,
    }

    public struct OptionAdded has copy, drop {
        election_id: ID,
        option_id: u32,
        label: String,
        metadata_uri: String,
    }

    public struct OptionRemoved has copy, drop {
        election_id: ID,
        option_id: u32,
    }

    public struct BallotCommitted has copy, drop {
        election_id: ID,
        character_id: u32,
        voter_address: address,
        commitment: vector<u8>,
        weight: u64,
        cast_ms: u64,
    }

    public struct BallotCast has copy, drop {
        election_id: ID,
        character_id: u32,
        voter_address: address,
        encoded_vote: vector<u8>,
        weight: u64,
        cast_ms: u64,
    }

    public struct BallotRevealed has copy, drop {
        election_id: ID,
        character_id: u32,
        encoded_vote: vector<u8>,
        revealed_ms: u64,
    }

    public struct SponsoredBallotCast has copy, drop {
        election_id: ID,
        sponsor_cap_id: ID,
        character_id: u32,
        cast_ms: u64,
    }

    public struct EligibilityEvaluated has copy, drop {
        election_id: ID,
        character_id: u32,
        eligible: bool,
        kind: u8,
        params_hash: vector<u8>,
    }

    public struct WeightComputed has copy, drop {
        election_id: ID,
        character_id: u32,
        weight: u64,
        kind: u8,
        inputs_hash: vector<u8>,
    }

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
        challenger: address,
        alt_output_hash: vector<u8>,
    }

    public struct ElectionFinalized has copy, drop {
        election_id: ID,
        canonical_tally_id: ID,
        finalized_ms: u64,
    }

    public struct SponsorCapCreated has copy, drop {
        sponsor_cap_id: ID,
        election_id: ID,
        sponsor: address,
        max_ballots_funded: u64,
        expiry_ms: u64,
    }

    // ── DRAFT: create + configure ─────────────────────────────────────────────

    public entry fun create_election(
        title: vector<u8>,
        description: vector<u8>,
        metadata_uri: vector<u8>,
        method_kind: u8,
        method_params: vector<u8>,
        eligibility_kind: u8,
        eligibility_params: vector<u8>,
        weight_kind: u8,
        weight_params: vector<u8>,
        privacy_kind: u8,
        privacy_params: vector<u8>,
        creator_character_id: u32,
        allow_recast: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(privacy_kind != PRIVACY_ZK, E_ZK_NOT_IMPLEMENTED);

        let now_ms = clock::timestamp_ms(clock);
        let creator = ctx.sender();
        let uid = object::new(ctx);
        let election_id = object::uid_to_inner(&uid);
        let title_s = string::utf8(title);

        event::emit(ElectionCreated {
            election_id,
            creator,
            creator_character_id,
            title: title_s,
            method_kind,
            eligibility_kind,
            weight_kind,
            privacy_kind,
        });

        transfer::share_object(Election {
            id: uid,
            creator,
            creator_character_id,
            title: title_s,
            description: string::utf8(description),
            metadata_uri: string::utf8(metadata_uri),
            state: STATE_DRAFT,
            created_ms: now_ms,
            scheduled_open_ms: 0,
            scheduled_close_ms: 0,
            reveal_deadline_ms: 0,
            dispute_window_ms: 0,
            finalized_ms: 0,
            method_kind,
            method_params,
            options: vector::empty<Option_>(),
            next_option_id: 0,
            eligibility_kind,
            eligibility_params,
            eligibility_snapshot_ms: 0,
            weight_kind,
            weight_params,
            privacy_kind,
            privacy_params,
            sponsored: false,
            sponsor_cap_id: option::none(),
            sponsor_address: option::none(),
            max_ballots_funded: 0,
            funded_so_far: 0,
            allow_recast,
            ballot_count: 0,
            revealed_count: 0,
            total_weight_cast: 0,
            tally_id: option::none(),
            tally_finalized: false,
        });
    }

    public entry fun add_option(
        election: &mut Election,
        label: vector<u8>,
        metadata_uri: vector<u8>,
        payload: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == election.creator, E_NOT_CREATOR);
        assert!(election.state == STATE_DRAFT, E_WRONG_STATE);

        let option_id = election.next_option_id;
        election.next_option_id = option_id + 1;
        let label_s = string::utf8(label);
        let meta_s  = string::utf8(metadata_uri);
        let opt = Option_ {
            id: option_id,
            label: label_s,
            metadata_uri: meta_s,
            payload,
        };
        vector::push_back(&mut election.options, opt);
        df::add(&mut election.id, OptionExistsKey { option_id }, true);
        event::emit(OptionAdded {
            election_id: object::uid_to_inner(&election.id),
            option_id,
            label: label_s,
            metadata_uri: meta_s,
        });
    }

    public entry fun remove_option(
        election: &mut Election,
        option_id: u32,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == election.creator, E_NOT_CREATOR);
        assert!(election.state == STATE_DRAFT, E_WRONG_STATE);
        let key = OptionExistsKey { option_id };
        assert!(df::exists_(&election.id, key), E_OPTION_NOT_FOUND);
        df::remove<OptionExistsKey, bool>(&mut election.id, key);
        // Find and remove from options vector
        let mut i = 0;
        let len = vector::length(&election.options);
        while (i < len) {
            if (vector::borrow(&election.options, i).id == option_id) {
                vector::remove(&mut election.options, i);
                break
            };
            i = i + 1;
        };
        event::emit(OptionRemoved {
            election_id: object::uid_to_inner(&election.id),
            option_id,
        });
    }

    public entry fun set_schedule(
        election: &mut Election,
        open_ms: u64,
        close_ms: u64,
        reveal_deadline_ms: u64,
        dispute_window_ms: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == election.creator, E_NOT_CREATOR);
        assert!(election.state == STATE_DRAFT, E_WRONG_STATE);
        assert!(close_ms > open_ms, E_BAD_SCHEDULE);
        if (election.privacy_kind == PRIVACY_COMMIT_REVEAL) {
            assert!(reveal_deadline_ms > close_ms, E_BAD_SCHEDULE);
        };
        election.scheduled_open_ms = open_ms;
        election.scheduled_close_ms = close_ms;
        election.reveal_deadline_ms = reveal_deadline_ms;
        election.dispute_window_ms = dispute_window_ms;
        election.eligibility_snapshot_ms = open_ms;
    }

    public entry fun set_sponsored(
        election: &mut Election,
        sponsor: address,
        max_ballots_funded: u64,
        expiry_ms: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == election.creator, E_NOT_CREATOR);
        assert!(election.state == STATE_DRAFT, E_WRONG_STATE);

        let cap_uid = object::new(ctx);
        let cap_id = object::uid_to_inner(&cap_uid);
        election.sponsored = true;
        election.sponsor_cap_id = option::some(cap_id);
        election.sponsor_address = option::some(sponsor);
        election.max_ballots_funded = max_ballots_funded;

        let election_id = object::uid_to_inner(&election.id);
        event::emit(SponsorCapCreated {
            sponsor_cap_id: cap_id,
            election_id,
            sponsor,
            max_ballots_funded,
            expiry_ms,
        });

        transfer::transfer(SponsorCap {
            id: cap_uid,
            sponsor,
            election_id,
            max_ballots_funded,
            funded_so_far: 0,
            expiry_ms,
        }, sponsor);
    }

    // ── DRAFT → SCHEDULED / CANCELED ──────────────────────────────────────────

    public entry fun publish(
        election: &mut Election,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == election.creator, E_NOT_CREATOR);
        assert!(election.state == STATE_DRAFT, E_WRONG_STATE);
        assert!(election.scheduled_open_ms > 0, E_BAD_SCHEDULE);
        assert!(vector::length(&election.options) >= 1, E_BAD_SCHEDULE);

        change_state(election, STATE_SCHEDULED, clock::timestamp_ms(clock));

        event::emit(ElectionPublished {
            election_id: object::uid_to_inner(&election.id),
            options_count: (vector::length(&election.options) as u32),
            scheduled_open_ms: election.scheduled_open_ms,
            scheduled_close_ms: election.scheduled_close_ms,
            reveal_deadline_ms: election.reveal_deadline_ms,
        });
    }

    public entry fun cancel(
        election: &mut Election,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == election.creator, E_NOT_CREATOR);
        assert!(
            election.state == STATE_DRAFT || election.state == STATE_SCHEDULED,
            E_WRONG_STATE
        );
        change_state(election, STATE_CANCELED, clock::timestamp_ms(clock));
    }

    // ── SCHEDULED → OPEN / OPEN → REVEAL or CLOSED ────────────────────────────

    public entry fun advance_to_open(
        election: &mut Election,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        assert!(election.state == STATE_SCHEDULED, E_WRONG_STATE);
        let now_ms = clock::timestamp_ms(clock);
        assert!(now_ms >= election.scheduled_open_ms, E_BAD_SCHEDULE);
        change_state(election, STATE_OPEN, now_ms);
    }

    public entry fun advance_to_reveal(
        election: &mut Election,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        assert!(election.state == STATE_OPEN, E_WRONG_STATE);
        assert!(election.privacy_kind == PRIVACY_COMMIT_REVEAL, E_NOT_COMMIT_REVEAL);
        let now_ms = clock::timestamp_ms(clock);
        assert!(now_ms >= election.scheduled_close_ms, E_BAD_SCHEDULE);
        change_state(election, STATE_REVEAL, now_ms);
    }

    public entry fun advance_to_closed(
        election: &mut Election,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        let now_ms = clock::timestamp_ms(clock);
        if (election.privacy_kind == PRIVACY_COMMIT_REVEAL) {
            assert!(election.state == STATE_REVEAL, E_WRONG_STATE);
            assert!(now_ms >= election.reveal_deadline_ms, E_BAD_SCHEDULE);
        } else {
            assert!(election.state == STATE_OPEN, E_WRONG_STATE);
            assert!(now_ms >= election.scheduled_close_ms, E_BAD_SCHEDULE);
        };
        change_state(election, STATE_CLOSED, now_ms);
    }

    // ── OPEN: cast / commit / reveal ──────────────────────────────────────────

    /// Public-privacy ballot. Sponsored if `sponsor_cap` is some.
    public entry fun cast_ballot(
        election: &mut Election,
        registry: &ExtensionRegistry,
        voter_address: address,
        encoded_vote: vector<u8>,
        eligibility_proof: EligibilityProof,
        weight_proof: WeightProof,
        mut sponsor_cap: Option<SponsorCap>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(election.state == STATE_OPEN, E_NOT_OPEN);
        assert!(election.privacy_kind == PRIVACY_PUBLIC, E_WRONG_STATE);

        let now_ms = clock::timestamp_ms(clock);
        let election_id = object::uid_to_inner(&election.id);

        // Verify and consume eligibility proof
        let character_id = verify_eligibility(eligibility_proof, election_id, election, registry, voter_address, ctx);

        // Verify weight proof for SAME character_id
        let weight = verify_weight(weight_proof, election_id, election, registry, voter_address, character_id, ctx);

        // Prevent double-vote (unless allow_recast)
        let vote_key = VoteKey { character_id };
        if (df::exists_(&election.id, vote_key)) {
            assert!(election.allow_recast, E_ALREADY_VOTED);
            df::remove<VoteKey, vector<u8>>(&mut election.id, vote_key);
        };
        df::add(&mut election.id, vote_key, encoded_vote);

        election.ballot_count = election.ballot_count + 1;
        election.revealed_count = election.revealed_count + 1;
        election.total_weight_cast = election.total_weight_cast + weight;

        // Handle sponsorship
        if (option::is_some(&sponsor_cap)) {
            let mut cap = option::extract(&mut sponsor_cap);
            assert!(cap.election_id == election_id, E_NO_SPONSOR_CAP);
            assert!(now_ms <= cap.expiry_ms, E_SPONSOR_EXPIRED);
            assert!(cap.funded_so_far < cap.max_ballots_funded, E_SPONSOR_EXHAUSTED);
            cap.funded_so_far = cap.funded_so_far + 1;
            election.funded_so_far = election.funded_so_far + 1;
            let cap_id = object::uid_to_inner(&cap.id);
            event::emit(SponsoredBallotCast {
                election_id,
                sponsor_cap_id: cap_id,
                character_id,
                cast_ms: now_ms,
            });
            // Return SponsorCap to sponsor (it's reusable until exhausted)
            let sponsor_addr = cap.sponsor;
            transfer::public_transfer(cap, sponsor_addr);
        };
        option::destroy_none(sponsor_cap);

        event::emit(BallotCast {
            election_id,
            character_id,
            voter_address,
            encoded_vote,
            weight,
            cast_ms: now_ms,
        });

        // Mint receipt
        transfer::transfer(Ballot {
            id: object::new(ctx),
            election_id,
            voter_address,
            character_id,
            method_kind: election.method_kind,
            privacy_kind: election.privacy_kind,
            cast_ms: now_ms,
            weight,
            weight_kind: election.weight_kind,
            weight_proof_bytes: vector::empty<u8>(),
            encoded_vote,
            commitment: vector::empty<u8>(),
            revealed: true,
            revealed_ms: now_ms,
        }, voter_address);
    }

    /// Commit-reveal commit phase. Voter holds (salt, vote) off-chain.
    public entry fun commit_ballot(
        election: &mut Election,
        registry: &ExtensionRegistry,
        voter_address: address,
        commitment: vector<u8>,
        eligibility_proof: EligibilityProof,
        weight_proof: WeightProof,
        mut sponsor_cap: Option<SponsorCap>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(election.state == STATE_OPEN, E_NOT_OPEN);
        assert!(election.privacy_kind == PRIVACY_COMMIT_REVEAL, E_NOT_COMMIT_REVEAL);

        let now_ms = clock::timestamp_ms(clock);
        let election_id = object::uid_to_inner(&election.id);
        let character_id = verify_eligibility(eligibility_proof, election_id, election, registry, voter_address, ctx);
        let weight = verify_weight(weight_proof, election_id, election, registry, voter_address, character_id, ctx);

        let commit_key = CommitKey { character_id };
        if (df::exists_(&election.id, commit_key)) {
            assert!(election.allow_recast, E_ALREADY_VOTED);
            df::remove<CommitKey, vector<u8>>(&mut election.id, commit_key);
        };
        df::add(&mut election.id, commit_key, commitment);

        election.ballot_count = election.ballot_count + 1;
        election.total_weight_cast = election.total_weight_cast + weight;

        if (option::is_some(&sponsor_cap)) {
            let mut cap = option::extract(&mut sponsor_cap);
            assert!(cap.election_id == election_id, E_NO_SPONSOR_CAP);
            assert!(now_ms <= cap.expiry_ms, E_SPONSOR_EXPIRED);
            assert!(cap.funded_so_far < cap.max_ballots_funded, E_SPONSOR_EXHAUSTED);
            cap.funded_so_far = cap.funded_so_far + 1;
            election.funded_so_far = election.funded_so_far + 1;
            let cap_id = object::uid_to_inner(&cap.id);
            event::emit(SponsoredBallotCast {
                election_id,
                sponsor_cap_id: cap_id,
                character_id,
                cast_ms: now_ms,
            });
            let sponsor_addr = cap.sponsor;
            transfer::public_transfer(cap, sponsor_addr);
        };
        option::destroy_none(sponsor_cap);

        event::emit(BallotCommitted {
            election_id,
            character_id,
            voter_address,
            commitment,
            weight,
            cast_ms: now_ms,
        });

        transfer::transfer(Ballot {
            id: object::new(ctx),
            election_id,
            voter_address,
            character_id,
            method_kind: election.method_kind,
            privacy_kind: election.privacy_kind,
            cast_ms: now_ms,
            weight,
            weight_kind: election.weight_kind,
            weight_proof_bytes: vector::empty<u8>(),
            encoded_vote: vector::empty<u8>(),
            commitment,
            revealed: false,
            revealed_ms: 0,
        }, voter_address);
    }

    /// Reveal a previously committed ballot. Must be in REVEAL state.
    public entry fun reveal_ballot(
        election: &mut Election,
        ballot: &mut Ballot,
        salt: vector<u8>,
        encoded_vote: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(election.state == STATE_REVEAL, E_WRONG_STATE);
        assert!(ballot.voter_address == ctx.sender(), E_NOT_CREATOR);
        assert!(!ballot.revealed, E_ALREADY_VOTED);

        let now_ms = clock::timestamp_ms(clock);
        assert!(now_ms >= election.scheduled_close_ms, E_REVEAL_TOO_EARLY);
        assert!(now_ms <= election.reveal_deadline_ms, E_REVEAL_TOO_LATE);

        // Verify commitment: H(salt || encoded_vote) == ballot.commitment
        let mut buf = vector::empty<u8>();
        vector::append(&mut buf, salt);
        vector::append(&mut buf, encoded_vote);
        let computed = hash::keccak256(&buf);
        assert!(computed == ballot.commitment, E_COMMITMENT_MISMATCH);

        // Persist revealed vote on the Election for tally
        let vote_key = VoteKey { character_id: ballot.character_id };
        if (df::exists_(&election.id, vote_key)) {
            df::remove<VoteKey, vector<u8>>(&mut election.id, vote_key);
        };
        df::add(&mut election.id, vote_key, encoded_vote);

        ballot.encoded_vote = encoded_vote;
        ballot.revealed = true;
        ballot.revealed_ms = now_ms;
        election.revealed_count = election.revealed_count + 1;

        event::emit(BallotRevealed {
            election_id: object::uid_to_inner(&election.id),
            character_id: ballot.character_id,
            encoded_vote,
            revealed_ms: now_ms,
        });
    }

    // ── Proof verification (consume single-use proofs) ────────────────────────

    /// Verifies + consumes an EligibilityProof. Returns the character_id.
    public(package) fun verify_eligibility(
        proof: EligibilityProof,
        election_id: ID,
        election: &Election,
        registry: &ExtensionRegistry,
        voter_address: address,
        ctx: &TxContext,
    ): u32 {
        let EligibilityProof {
            id,
            election_id: pe,
            voter,
            character_id,
            kind,
            provider_package,
            eligible,
            minted_epoch,
        } = proof;
        object::delete(id);

        assert!(pe == election_id, E_PROOF_MISMATCH);
        assert!(voter == voter_address, E_PROOF_MISMATCH);
        assert!(kind == election.eligibility_kind, E_PROOF_MISMATCH);
        assert!(eligible, E_NOT_ELIGIBLE);
        assert!(minted_epoch == ctx.epoch(), E_PROOF_STALE);
        assert!(extension::has_eligibility(registry, kind), E_UNKNOWN_KIND);
        assert!(!extension::eligibility_is_deprecated(registry, kind), E_DEPRECATED_PROVIDER);
        assert!(
            extension::eligibility_provider_package(registry, kind) == provider_package,
            E_PROOF_MISMATCH,
        );

        let params_hash = hash::keccak256(&election.eligibility_params);
        event::emit(EligibilityEvaluated {
            election_id,
            character_id,
            eligible,
            kind,
            params_hash,
        });
        character_id
    }

    /// Verifies + consumes a WeightProof. Returns the computed weight.
    public(package) fun verify_weight(
        proof: WeightProof,
        election_id: ID,
        election: &Election,
        registry: &ExtensionRegistry,
        voter_address: address,
        expected_character_id: u32,
        ctx: &TxContext,
    ): u64 {
        let WeightProof {
            id,
            election_id: pe,
            voter,
            character_id,
            kind,
            provider_package,
            weight,
            inputs_hash,
            minted_epoch,
        } = proof;
        object::delete(id);

        assert!(pe == election_id, E_PROOF_MISMATCH);
        assert!(voter == voter_address, E_PROOF_MISMATCH);
        assert!(character_id == expected_character_id, E_PROOF_MISMATCH);
        assert!(kind == election.weight_kind, E_PROOF_MISMATCH);
        assert!(minted_epoch == ctx.epoch(), E_PROOF_STALE);
        assert!(extension::has_weight(registry, kind), E_UNKNOWN_KIND);
        assert!(!extension::weight_is_deprecated(registry, kind), E_DEPRECATED_PROVIDER);
        assert!(
            extension::weight_provider_package(registry, kind) == provider_package,
            E_PROOF_MISMATCH,
        );

        event::emit(WeightComputed {
            election_id,
            character_id,
            weight,
            kind,
            inputs_hash,
        });
        weight
    }

    // ── Proof minting helpers (called by extension modules) ───────────────────
    //
    // Built-in eligibility/weight modules call these via friend access. Third
    // parties create their own proof-mint entry functions that wrap these.
    // Proof minting is purposely public — the *verification* checks the registry
    // for provider_package matching, so a forged proof from a non-registered
    // package fails verification.

    public fun mint_eligibility_proof(
        election_id: ID,
        voter: address,
        character_id: u32,
        kind: u8,
        provider_package: address,
        eligible: bool,
        ctx: &mut TxContext,
    ): EligibilityProof {
        EligibilityProof {
            id: object::new(ctx),
            election_id,
            voter,
            character_id,
            kind,
            provider_package,
            eligible,
            minted_epoch: ctx.epoch(),
        }
    }

    public fun mint_weight_proof(
        election_id: ID,
        voter: address,
        character_id: u32,
        kind: u8,
        provider_package: address,
        weight: u64,
        inputs_hash: vector<u8>,
        ctx: &mut TxContext,
    ): WeightProof {
        WeightProof {
            id: object::new(ctx),
            election_id,
            voter,
            character_id,
            kind,
            provider_package,
            weight,
            inputs_hash,
            minted_epoch: ctx.epoch(),
        }
    }

    // ── State change helper ───────────────────────────────────────────────────

    fun change_state(election: &mut Election, new_state: u8, now_ms: u64) {
        let old_state = election.state;
        election.state = new_state;
        if (new_state == STATE_FINALIZED) {
            election.finalized_ms = now_ms;
        };
        event::emit(ElectionStateChanged {
            election_id: object::uid_to_inner(&election.id),
            old_state,
            new_state,
            at_ms: now_ms,
        });
    }

    // ── Public-only mutators used by tally module (package access) ────────────

    public(package) fun mark_tallied(
        election: &mut Election,
        tally_id: ID,
        dispute_window_closes_ms: u64,
        now_ms: u64,
    ) {
        assert!(election.state == STATE_CLOSED, E_WRONG_STATE);
        assert!(option::is_none(&election.tally_id), E_TALLY_EXISTS);
        election.tally_id = option::some(tally_id);
        change_state(election, STATE_TALLIED, now_ms);
        // dispute_window_ms already on election; closes_ms persisted in Tally
        let _ = dispute_window_closes_ms;
    }

    public(package) fun replace_tally(
        election: &mut Election,
        new_tally_id: ID,
    ) {
        election.tally_id = option::some(new_tally_id);
    }

    /// Share a Tally object. Called by the tally module after constructing one.
    public(package) fun share_tally(t: Tally) {
        transfer::share_object(t);
    }

    public(package) fun mark_finalized(election: &mut Election, now_ms: u64) {
        assert!(election.state == STATE_TALLIED, E_WRONG_STATE);
        election.tally_finalized = true;
        change_state(election, STATE_FINALIZED, now_ms);
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun id(e: &Election): ID                   { object::uid_to_inner(&e.id) }
    public fun creator(e: &Election): address         { e.creator }
    public fun state(e: &Election): u8                { e.state }
    public fun method_kind(e: &Election): u8          { e.method_kind }
    public fun method_params(e: &Election): &vector<u8> { &e.method_params }
    public fun eligibility_kind(e: &Election): u8     { e.eligibility_kind }
    public fun eligibility_params(e: &Election): &vector<u8> { &e.eligibility_params }
    public fun weight_kind(e: &Election): u8          { e.weight_kind }
    public fun weight_params(e: &Election): &vector<u8> { &e.weight_params }
    public fun privacy_kind(e: &Election): u8         { e.privacy_kind }
    public fun ballot_count(e: &Election): u64        { e.ballot_count }
    public fun revealed_count(e: &Election): u64      { e.revealed_count }
    public fun total_weight_cast(e: &Election): u64   { e.total_weight_cast }
    public fun options(e: &Election): &vector<Option_> { &e.options }
    public fun option_id(o: &Option_): u32            { o.id }
    public fun scheduled_open_ms(e: &Election): u64   { e.scheduled_open_ms }
    public fun scheduled_close_ms(e: &Election): u64  { e.scheduled_close_ms }
    public fun reveal_deadline_ms(e: &Election): u64  { e.reveal_deadline_ms }
    public fun dispute_window_ms(e: &Election): u64   { e.dispute_window_ms }
    public fun eligibility_snapshot_ms(e: &Election): u64 { e.eligibility_snapshot_ms }
    public fun creator_character_id(e: &Election): u32 { e.creator_character_id }
    public fun has_vote(e: &Election, character_id: u32): bool {
        df::exists_(&e.id, VoteKey { character_id })
    }
    public fun get_vote(e: &Election, character_id: u32): &vector<u8> {
        df::borrow<VoteKey, vector<u8>>(&e.id, VoteKey { character_id })
    }
    public fun has_commit(e: &Election, character_id: u32): bool {
        df::exists_(&e.id, CommitKey { character_id })
    }

    // ── EligibilityProof accessors (used by eligibility_composite) ────────────
    // NOTE (cross-cutting): these were added as a required companion to the
    // eligibility_composite module implementation. Sui Move 2024 restricts
    // struct field access/destructuring to the defining module; composite
    // cannot read proof fields without these helpers. They are pure read-only
    // and non-breaking. See open question in the voting-infrastructure design doc.
    public fun proof_eligible(p: &EligibilityProof): bool           { p.eligible }
    public fun proof_election_id(p: &EligibilityProof): ID          { p.election_id }
    public fun proof_voter(p: &EligibilityProof): address           { p.voter }
    public fun proof_character_id(p: &EligibilityProof): u32        { p.character_id }
    public fun proof_minted_epoch(p: &EligibilityProof): u64        { p.minted_epoch }

    public fun ballot_election_id(b: &Ballot): ID     { b.election_id }
    public fun ballot_character_id(b: &Ballot): u32   { b.character_id }
    public fun ballot_weight(b: &Ballot): u64         { b.weight }
    public fun ballot_revealed(b: &Ballot): bool      { b.revealed }
    public fun ballot_encoded_vote(b: &Ballot): &vector<u8> { &b.encoded_vote }
    public fun ballot_commitment(b: &Ballot): &vector<u8> { &b.commitment }

    // ── Constructors for Tally module ─────────────────────────────────────────

    public(package) fun new_round_result(
        round_index: u32,
        eliminated_option_id: u32,
        counts: vector<u64>,
        transferred_to: vector<u32>,
    ): RoundResult {
        RoundResult { round_index, eliminated_option_id, counts, transferred_to }
    }

    public(package) fun new_tally(
        election_id: ID,
        method_kind: u8,
        computed_by: address,
        computed_ms: u64,
        total_ballots: u64,
        total_weight: u64,
        eligible_voters: u64,
        quorum_met: bool,
        winner_option_ids: vector<u32>,
        result_payload: vector<u8>,
        rounds: vector<RoundResult>,
        input_hash: vector<u8>,
        output_hash: vector<u8>,
        deterministic_seed: vector<u8>,
        dispute_window_closes_ms: u64,
        ctx: &mut TxContext,
    ): Tally {
        Tally {
            id: object::new(ctx),
            election_id,
            method_kind,
            computed_by,
            computed_ms,
            total_ballots,
            total_weight,
            eligible_voters,
            quorum_met,
            winner_option_ids,
            result_payload,
            rounds,
            input_hash,
            output_hash,
            deterministic_seed,
            disputed: false,
            dispute_window_closes_ms,
        }
    }

    public fun tally_election_id(t: &Tally): ID         { t.election_id }
    public fun tally_winners(t: &Tally): &vector<u32>   { &t.winner_option_ids }
    public fun tally_output_hash(t: &Tally): &vector<u8> { &t.output_hash }
    public fun tally_input_hash(t: &Tally): &vector<u8>  { &t.input_hash }
    public fun tally_dispute_closes_ms(t: &Tally): u64   { t.dispute_window_closes_ms }
    public fun tally_disputed(t: &Tally): bool           { t.disputed }
    public fun tally_method_kind(t: &Tally): u8          { t.method_kind }
    public fun tally_id_of(t: &Tally): ID                { object::uid_to_inner(&t.id) }
    public fun tally_id_of_ref(t: &Tally): ID            { object::uid_to_inner(&t.id) }

    public(package) fun mark_tally_disputed(t: &mut Tally) {
        t.disputed = true;
    }

    // ── Method-kind accessors (for tally dispatch) ────────────────────────────
    public fun method_single_choice(): u8 { METHOD_SINGLE_CHOICE }
    public fun method_approval(): u8      { METHOD_APPROVAL }
    public fun method_ranked_choice(): u8 { METHOD_RANKED_CHOICE }
    public fun method_quadratic(): u8     { METHOD_QUADRATIC }
    public fun method_score(): u8         { METHOD_SCORE }
    public fun method_conviction(): u8    { METHOD_CONVICTION }
    public fun state_closed(): u8         { STATE_CLOSED }
    public fun state_tallied(): u8        { STATE_TALLIED }
    public fun state_finalized(): u8      { STATE_FINALIZED }
    public fun privacy_public(): u8       { PRIVACY_PUBLIC }
    public fun privacy_commit_reveal(): u8 { PRIVACY_COMMIT_REVEAL }

    // ── WeightProof destructuring (package-visible, for weight_composite) ────
    //
    // Cross-cutting requirement surfaced by weight_composite: combining child
    // WeightProofs requires reading their fields, which are private to this module.
    // This extractor is package-visible (same package only) and consumes the proof
    // (deletes UID), preventing any reuse. weight_composite verifies election_id,
    // voter, character_id, and minted_epoch before trusting the returned weight.
    //
    // Returns: (election_id, voter, character_id, kind, provider_package,
    //           weight, inputs_hash, minted_epoch)
    public(package) fun extract_weight_proof(
        p: WeightProof,
    ): (ID, address, u32, u8, address, u64, vector<u8>, u64) {
        let WeightProof {
            id,
            election_id,
            voter,
            character_id,
            kind,
            provider_package,
            weight,
            inputs_hash,
            minted_epoch,
        } = p;
        object::delete(id);
        (election_id, voter, character_id, kind, provider_package, weight, inputs_hash, minted_epoch)
    }

    // ── Helpers for off-chain re-runner (read full event payload via events;
    //     these helpers expose final state for spot-checks).
}
