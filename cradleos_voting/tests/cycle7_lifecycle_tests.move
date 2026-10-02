#[test_only]
module cradleos_voting::cycle7_lifecycle_tests {
    use sui::clock::{Self, Clock};
    use sui::test_scenario::{Self, Scenario};
    use std::option;
    use cradleos_voting::voting::{Self, Election, Tally};
    use cradleos_voting::extension::{Self, ExtensionRegistry, AdminCap};
    use cradleos_voting::tally;
    use cradleos_voting::weight_one;

    fun setup(method: u8, params: vector<u8>): (Scenario, Clock, Election, ExtensionRegistry) {
        let mut s = test_scenario::begin(@0x42);
        let mut clock = clock::create_for_testing(s.ctx());
        extension::create_registry(s.ctx());
        voting::create_election(b"Cycle 7 test", b"", b"", method, params,
            0, vector[], 0, vector[], 0, vector[], 42, false, &clock, s.ctx());
        s.next_tx(@0x42);
        let mut reg = s.take_shared<ExtensionRegistry>();
        let cap = s.take_from_sender<AdminCap>();
        extension::register_eligibility(&cap, &mut reg, 0, @cradleos_voting, b"eligibility_open", b"mint", s.ctx());
        extension::register_weight(&cap, &mut reg, 0, @cradleos_voting, b"weight_one", b"mint", s.ctx());
        test_scenario::return_to_sender(&s, cap);
        let mut e = s.take_shared<Election>();
        voting::add_option(&mut e, b"A", b"", vector[], s.ctx());
        voting::add_option(&mut e, b"B", b"", vector[], s.ctx());
        voting::set_schedule(&mut e, 1, 100, 0, 10, s.ctx());
        voting::publish(&mut e, &clock, s.ctx());
        clock::increment_for_testing(&mut clock, 1);
        voting::advance_to_open(&mut e, &clock, s.ctx());
        (s, clock, e, reg)
    }

    // Package-private proof construction is used only by tests; external callers
    // are separately compile-tested against forging this proof. Live ownership
    // is verified separately with the actual Character-authenticated provider.
    fun cast(s: &mut Scenario, e: &mut Election, reg: &ExtensionRegistry, clock: &Clock, cid: u32, vote: vector<u8>) {
        let proof = voting::mint_eligibility_proof(voting::id(e), @0x42, cid, 0, @cradleos_voting, true, s.ctx());
        let weight = weight_one::mint(e, cid, s.ctx());
        voting::cast_ballot(e, reg, @0x42, vote, proof, weight, option::none(), clock, s.ctx());
    }

    fun cleanup(s: Scenario, clock: Clock, e: Election, reg: ExtensionRegistry) {
        test_scenario::return_shared(e);
        test_scenario::return_shared(reg);
        clock::destroy_for_testing(clock);
        s.end();
    }

    fun run_case(method: u8, case: u8) {
        let (mut s, mut clock, mut e, reg) = setup(method, vector[]);
        let first = if (method == 0) vector[0,0,0,0] else vector[1,0,0,0,0,0,0,0];
        let second = if (method == 0) vector[1,0,0,0] else vector[1,0,0,0,1,0,0,0];
        if (case == 5) clock::increment_for_testing(&mut clock, 100);
        cast(&mut s, &mut e, &reg, &clock, 42, first);
        cast(&mut s, &mut e, &reg, &clock, 43, second);
        if (case == 6) cast(&mut s, &mut e, &reg, &clock, 42, second);
        clock::increment_for_testing(&mut clock, 100);
        voting::advance_to_closed(&mut e, &clock, s.ctx());
        let ids = if (case == 1) vector[42] else if (case == 2) vector[42,42] else if (case == 4) vector[43,42] else vector[42,43];
        let votes = if (case == 1) vector[first] else if (case == 2) vector[first,first] else if (case == 4) vector[second,first] else vector[first,second];
        let weights = if (case == 1) vector[1] else if (case == 3) vector[99,1] else vector[1,1];
        tally::compute_tally(&mut e, ids, votes, weights, &clock, s.ctx());
        test_scenario::return_shared(e);
        s.next_tx(@0x42);
        let mut e = s.take_shared<Election>();
        let t = s.take_shared<Tally>();
        assert!(voting::state(&e) == voting::state_tallied(), 50);
        clock::increment_for_testing(&mut clock, 11);
        tally::finalize(&mut e, &t, &clock, s.ctx());
        assert!(voting::state(&e) == voting::state_finalized(), 51);
        assert!(vector::length(voting::tally_winners(&t)) == 1, 52);
        test_scenario::return_shared(t);
        cleanup(s, clock, e, reg);
    }
    #[test] fun single_choice_complete_lifecycle() { run_case(0,0); }
    #[test] fun approval_complete_lifecycle() { run_case(1,0); }
    #[test, expected_failure(abort_code=4, location=cradleos_voting::tally)]
    fun tally_cannot_omit_a_voter() { run_case(0,1); }
    #[test, expected_failure(abort_code=4, location=cradleos_voting::tally)]
    fun tally_cannot_duplicate_a_voter() { run_case(0,2); }
    #[test, expected_failure(abort_code=4, location=cradleos_voting::tally)]
    fun tally_cannot_invent_weights() { run_case(0,3); }
    #[test, expected_failure(abort_code=4, location=cradleos_voting::tally)]
    fun tally_requires_canonical_order() { run_case(0,4); }
    #[test, expected_failure(abort_code=4, location=cradleos_voting::voting)]
    fun late_cast_rejected_even_before_state_advance() { run_case(0,5); }
    #[test, expected_failure(abort_code=5, location=cradleos_voting::voting)]
    fun duplicate_cast_rejected() { run_case(0,6); }

    fun bad_vote(method: u8, vote: vector<u8>) {
        let (mut s, clock, mut e, reg) = setup(method, vector[]);
        cast(&mut s, &mut e, &reg, &clock, 42, vote);
        cleanup(s, clock, e, reg);
    }
    #[test, expected_failure(abort_code=13, location=cradleos_voting::voting)]
    fun malformed_single_cannot_poison_tally() { bad_vote(0, vector[0]); }
    #[test, expected_failure(abort_code=13, location=cradleos_voting::voting)]
    fun unknown_option_cannot_poison_tally() { bad_vote(0, vector[9,0,0,0]); }
    #[test, expected_failure(abort_code=13, location=cradleos_voting::voting)]
    fun duplicate_approval_cannot_multiply_votes() { bad_vote(1, vector[2,0,0,0,0,0,0,0,0,0,0,0]); }
    #[test, expected_failure(abort_code=13, location=cradleos_voting::voting)]
    fun truncated_approval_cannot_poison_tally() { bad_vote(1, vector[2,0,0,0,0,0,0,0]); }
    #[test, expected_failure(abort_code=13, location=cradleos_voting::voting)]
    fun trailing_approval_bytes_rejected() { bad_vote(1, vector[0,0,0,0,1]); }

    #[test, expected_failure(abort_code=22, location=cradleos_voting::voting)]
    fun unrelated_tally_cannot_finalize_election() {
        let (mut s, mut clock, mut e, reg) = setup(0, vector[]);
        clock::increment_for_testing(&mut clock, 100);
        voting::advance_to_closed(&mut e, &clock, s.ctx());
        tally::compute_tally(&mut e, vector[], vector[], vector[], &clock, s.ctx());
        // Construct a different tally in this test-only module, never exposed
        // through a production constructor.
        let fake = voting::new_tally(voting::id(&e), 0, @0x42, 0, 0, 0, 0, false,
            vector[], vector[], vector[], vector[], vector[], vector[], 0, s.ctx());
        clock::increment_for_testing(&mut clock, 11);
        tally::finalize(&mut e, &fake, &clock, s.ctx());
        voting::share_tally(fake);
        cleanup(s, clock, e, reg);
    }

    fun unsupported(method: u8, privacy: u8, recast: bool) {
        let mut s = test_scenario::begin(@0x42);
        let clock = clock::create_for_testing(s.ctx());
        voting::create_election(b"Test", b"", b"", method, vector[],
            0, vector[], 0, vector[], privacy, vector[], 42, recast, &clock, s.ctx());
        clock::destroy_for_testing(clock);
        s.end();
    }
    #[test, expected_failure(abort_code=26, location=cradleos_voting::voting)]
    fun commit_reveal_cannot_be_enabled() { unsupported(0,1,false); }
    #[test, expected_failure(abort_code=26, location=cradleos_voting::voting)]
    fun recasting_cannot_be_enabled() { unsupported(0,0,true); }
    #[test, expected_failure(abort_code=26, location=cradleos_voting::voting)]
    fun unsupported_method_cannot_be_enabled() { unsupported(2,0,false); }
}
