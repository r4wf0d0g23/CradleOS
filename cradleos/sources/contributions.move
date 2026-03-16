/// CradleOS – Contributions
/// Track member contributions to corp operations. Build queues, delivery logs, reward points.
module cradleos::contributions {
    use sui::event;
    use cradleos::corp::{Self, Corp, MemberCap};

    // ── Action type constants ─────────────────────────────────────────────────

    const ACTION_MATERIAL_DELIVERY: u8 = 0;
    const ACTION_BUILD_CONTRIBUTION: u8 = 1;
    const ACTION_COMBAT_SUPPORT: u8 = 2;
    const ACTION_TYPE_MAX: u8 = 2;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotOfficer:       u64 = 0;
    const EInvalidActionType:u64 = 1;
    const EZeroPoints:       u64 = 2;

    // ── Structs ───────────────────────────────────────────────────────────────

    public struct ContribEntry has copy, drop, store {
        member: address,
        action_type: u8,
        points: u64,
        epoch: u64,
        memo: vector<u8>,
    }

    public struct ContribLedger has key {
        id: UID,
        corp_id: ID,
        entries: vector<ContribEntry>,
        total_points: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct ContribLogged has copy, drop {
        corp_id: ID,
        member: address,
        action_type: u8,
        points: u64,
    }

    // ── Public functions ──────────────────────────────────────────────────────

    /// Create a per-corp contribution ledger.
    public fun create_ledger(corp: &Corp, ctx: &mut TxContext): ContribLedger {
        ContribLedger {
            id: object::new(ctx),
            corp_id: object::id(corp),
            entries: vector::empty<ContribEntry>(),
            total_points: 0,
        }
    }

    /// Officer+ logs a contribution on behalf of a member.
    public fun log_contribution(
        ledger: &mut ContribLedger,
        corp: &Corp,
        member: address,
        action_type: u8,
        points: u64,
        memo: vector<u8>,
        cap: &MemberCap,
        ctx: &mut TxContext,
    ) {
        assert!(corp::cap_corp_id(cap) == object::id(corp), ENotOfficer);
        assert!(corp::cap_role(cap) >= corp::role_officer(), ENotOfficer);
        assert!(action_type <= ACTION_TYPE_MAX, EInvalidActionType);
        assert!(points > 0, EZeroPoints);

        let epoch = tx_context::epoch(ctx);
        let entry = ContribEntry { member, action_type, points, epoch, memo };
        vector::push_back(&mut ledger.entries, entry);
        ledger.total_points = ledger.total_points + points;

        event::emit(ContribLogged {
            corp_id: ledger.corp_id,
            member,
            action_type,
            points,
        });
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /// Sum all points logged for a given member address.
    public fun get_member_points(ledger: &ContribLedger, member: address): u64 {
        let mut total = 0u64;
        let len = vector::length(&ledger.entries);
        let mut i = 0u64;
        while (i < len) {
            let entry = vector::borrow(&ledger.entries, i);
            if (entry.member == member) {
                total = total + entry.points;
            };
            i = i + 1;
        };
        total
    }

    public fun get_total_points(ledger: &ContribLedger): u64  { ledger.total_points }
    public fun get_entry_count(ledger: &ContribLedger): u64   { vector::length(&ledger.entries) }

    // ── Tests ─────────────────────────────────────────────────────────────────

    #[test_only]
    use sui::test_scenario;
    #[test_only]
    use cradleos::registry;

    #[test]
    fun test_log_contribution_accumulates_points() {
        let founder = @0xF0;
        let member = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (mut corp, director_cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let _mc = cradleos::corp::add_member(&mut corp, member, cradleos::corp::role_member(), &director_cap, ctx);
            let mut ledger = create_ledger(&corp, ctx);

            log_contribution(&mut ledger, &corp, member, ACTION_MATERIAL_DELIVERY, 100, b"ore run", &director_cap, ctx);
            log_contribution(&mut ledger, &corp, member, ACTION_BUILD_CONTRIBUTION, 250, b"structure", &director_cap, ctx);

            assert!(get_entry_count(&ledger) == 2, 0);
            assert!(get_total_points(&ledger) == 350, 1);
            assert!(get_member_points(&ledger, member) == 350, 2);
            assert!(get_member_points(&ledger, founder) == 0, 3);

            std::unit_test::destroy(ledger);
            std::unit_test::destroy(corp);
            std::unit_test::destroy(director_cap);
            std::unit_test::destroy(_mc);
            std::unit_test::destroy(reg);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotOfficer)]
    fun test_non_officer_cannot_log() {
        let founder = @0xF0;
        let plain = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (mut corp, director_cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let plain_cap = cradleos::corp::add_member(&mut corp, plain, cradleos::corp::role_member(), &director_cap, ctx);
            let mut ledger = create_ledger(&corp, ctx);
            // plain member cap → should abort ENotOfficer
            log_contribution(&mut ledger, &corp, plain, ACTION_MATERIAL_DELIVERY, 50, b"x", &plain_cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EZeroPoints)]
    fun test_zero_points_rejected() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (corp, cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let mut ledger = create_ledger(&corp, ctx);
            log_contribution(&mut ledger, &corp, founder, ACTION_MATERIAL_DELIVERY, 0, b"x", &cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EInvalidActionType)]
    fun test_invalid_action_type_rejected() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (corp, cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let mut ledger = create_ledger(&corp, ctx);
            // action_type = 99 → invalid
            log_contribution(&mut ledger, &corp, founder, 99u8, 100, b"x", &cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_member_points_sum_multiple_entries() {
        let founder = @0xF0;
        let a = @0xAA;
        let b = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (mut corp, cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let _ca = cradleos::corp::add_member(&mut corp, a, cradleos::corp::role_member(), &cap, ctx);
            let _cb = cradleos::corp::add_member(&mut corp, b, cradleos::corp::role_member(), &cap, ctx);
            let mut ledger = create_ledger(&corp, ctx);

            log_contribution(&mut ledger, &corp, a, ACTION_MATERIAL_DELIVERY, 100, b"ore", &cap, ctx);
            log_contribution(&mut ledger, &corp, b, ACTION_BUILD_CONTRIBUTION, 200, b"build", &cap, ctx);
            log_contribution(&mut ledger, &corp, a, ACTION_COMBAT_SUPPORT, 50, b"fleet", &cap, ctx);

            assert!(get_member_points(&ledger, a) == 150, 0);
            assert!(get_member_points(&ledger, b) == 200, 1);
            assert!(get_total_points(&ledger) == 350, 2);

            std::unit_test::destroy(ledger);
            std::unit_test::destroy(corp);
            std::unit_test::destroy(cap);
            std::unit_test::destroy(_ca);
            std::unit_test::destroy(_cb);
            std::unit_test::destroy(reg);
        };
        test_scenario::end(scenario);
    }
}
