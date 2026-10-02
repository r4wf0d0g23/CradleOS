#[test_only]
module cradleos_voting::cycle7_tests {
    use sui::clock;
    use sui::test_scenario;
    use cradleos_voting::voting::{Self, Election};

    fun create(eligibility: u8, weight: u8) {
        let mut scenario = test_scenario::begin(@0x42);
        let clock = clock::create_for_testing(scenario.ctx());
        voting::create_election(b"Cycle 7", b"", b"", 0, vector[],
            eligibility, vector[], weight, vector[], 0, vector[], 42, false,
            &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        scenario.next_tx(@0x42);
        let election = scenario.take_shared<Election>();
        assert!(voting::eligibility_kind(&election) == 0, 0);
        assert!(voting::weight_kind(&election) == 0, 1);
        test_scenario::return_shared(election);
        scenario.end();
    }

    #[test]
    fun authenticated_open_one_is_supported() { create(0, 0); }

    #[test]
    #[expected_failure(abort_code = 25, location = cradleos_voting::voting)]
    fun arbitrary_numeric_allowlist_identity_cannot_be_enabled() { create(1, 0); }

    #[test]
    #[expected_failure(abort_code = 25, location = cradleos_voting::voting)]
    fun unverified_age_weight_cannot_be_enabled() { create(0, 2); }
}
