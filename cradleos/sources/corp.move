/// CradleOS – Corp
/// Core corporation object: membership management, roles, EVE Frontier corp identity.
module cradleos::corp {
    use sui::event;
    use cradleos::registry::{Self, Registry};

    // ── Role constants ────────────────────────────────────────────────────────

    const ROLE_MEMBER: u8   = 0;
    const ROLE_OFFICER: u8  = 1;
    const ROLE_DIRECTOR: u8 = 2;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:    u64 = 0;
    const ENotOfficer:    u64 = 1;
    const EAlreadyMember: u64 = 2;
    const EMemberNotFound:u64 = 3;
    const EInvalidRole:   u64 = 4;
    const ECorpInactive:  u64 = 5;

    // ── Structs ───────────────────────────────────────────────────────────────

    public struct Corp has key {
        id: UID,
        name: vector<u8>,
        founder: address,
        members: vector<address>,
        member_roles: vector<u8>,   // parallel: 0=member 1=officer 2=director
        active: bool,
    }

    /// Capability issued to every corp member. Proves membership & role.
    public struct MemberCap has key, store {
        id: UID,
        corp_id: ID,
        member: address,
        role: u8,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct CorpFounded  has copy, drop { corp_id: ID, name: vector<u8>, founder: address }
    public struct MemberJoined has copy, drop { corp_id: ID, member: address, role: u8 }
    public struct MemberRemoved has copy, drop { corp_id: ID, member: address }
    public struct RoleChanged  has copy, drop { corp_id: ID, member: address, new_role: u8 }

    // ── Helper ────────────────────────────────────────────────────────────────

    /// Returns (found, index) of `addr` inside `vec`.
    fun find_index(vec: &vector<address>, addr: address): (bool, u64) {
        let len = vector::length(vec);
        let mut i = 0u64;
        while (i < len) {
            if (*vector::borrow(vec, i) == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    // ── Public functions ──────────────────────────────────────────────────────

    /// Found a new corp. Caller becomes director-founder.
    /// Returns (Corp, MemberCap) so the caller can share/transfer as needed.
    public fun found_corp(
        registry: &mut Registry,
        name: vector<u8>,
        ctx: &mut TxContext,
    ): (Corp, MemberCap) {
        let founder = tx_context::sender(ctx);
        let corp_uid = object::new(ctx);
        let corp_id = object::uid_to_inner(&corp_uid);

        let mut members = vector::empty<address>();
        let mut member_roles = vector::empty<u8>();
        vector::push_back(&mut members, founder);
        vector::push_back(&mut member_roles, ROLE_DIRECTOR);

        let corp = Corp {
            id: corp_uid,
            name: copy name,
            founder,
            members,
            member_roles,
            active: true,
        };

        let cap = MemberCap {
            id: object::new(ctx),
            corp_id,
            member: founder,
            role: ROLE_DIRECTOR,
        };

        registry::register_corp(registry, corp_id, copy name, founder);
        event::emit(CorpFounded { corp_id, name, founder });

        (corp, cap)
    }

    /// Officer+ adds a new member. Returns the new member's MemberCap.
    public fun add_member(
        corp: &mut Corp,
        member: address,
        role: u8,
        cap: &MemberCap,
        ctx: &mut TxContext,
    ): MemberCap {
        assert!(corp.active, ECorpInactive);
        assert!(cap.corp_id == object::id(corp), ENotOfficer);
        assert!(cap.role >= ROLE_OFFICER, ENotOfficer);
        assert!(role <= ROLE_DIRECTOR, EInvalidRole);
        let (already, _) = find_index(&corp.members, member);
        assert!(!already, EAlreadyMember);

        vector::push_back(&mut corp.members, member);
        vector::push_back(&mut corp.member_roles, role);

        let corp_id = object::id(corp);
        event::emit(MemberJoined { corp_id, member, role });

        MemberCap { id: object::new(ctx), corp_id, member, role }
    }

    /// Officer+ removes a member.
    public fun remove_member(
        corp: &mut Corp,
        member: address,
        cap: &MemberCap,
        _ctx: &mut TxContext,
    ) {
        assert!(corp.active, ECorpInactive);
        assert!(cap.corp_id == object::id(corp), ENotOfficer);
        assert!(cap.role >= ROLE_OFFICER, ENotOfficer);

        let (found, idx) = find_index(&corp.members, member);
        assert!(found, EMemberNotFound);

        vector::remove(&mut corp.members, idx);
        vector::remove(&mut corp.member_roles, idx);

        event::emit(MemberRemoved { corp_id: object::id(corp), member });
    }

    /// Director only: change a member's role.
    public fun change_role(
        corp: &mut Corp,
        member: address,
        new_role: u8,
        cap: &MemberCap,
        _ctx: &mut TxContext,
    ) {
        assert!(corp.active, ECorpInactive);
        assert!(cap.corp_id == object::id(corp), ENotFounder);
        assert!(cap.role >= ROLE_DIRECTOR, ENotFounder);
        assert!(new_role <= ROLE_DIRECTOR, EInvalidRole);

        let (found, idx) = find_index(&corp.members, member);
        assert!(found, EMemberNotFound);

        let role_ref = vector::borrow_mut(&mut corp.member_roles, idx);
        *role_ref = new_role;

        event::emit(RoleChanged { corp_id: object::id(corp), member, new_role });
    }

    // ── Read-only queries ─────────────────────────────────────────────────────

    public fun is_member(corp: &Corp, addr: address): bool {
        let (found, _) = find_index(&corp.members, addr);
        found
    }

    public fun get_role(corp: &Corp, addr: address): Option<u8> {
        let (found, idx) = find_index(&corp.members, addr);
        if (found) {
            option::some(*vector::borrow(&corp.member_roles, idx))
        } else {
            option::none()
        }
    }

    public fun member_count(corp: &Corp): u64 { vector::length(&corp.members) }

    // ── Corp field accessors ──────────────────────────────────────────────────

    public fun name(corp: &Corp): vector<u8>    { corp.name }
    public fun founder(corp: &Corp): address    { corp.founder }
    public fun active(corp: &Corp): bool        { corp.active }

    // ── MemberCap accessors ───────────────────────────────────────────────────

    public fun cap_corp_id(cap: &MemberCap): ID      { cap.corp_id }
    public fun cap_role(cap: &MemberCap): u8         { cap.role }
    public fun cap_member(cap: &MemberCap): address  { cap.member }

    // ── Role constant accessors (used by other modules) ───────────────────────

    public fun role_member(): u8   { ROLE_MEMBER }
    public fun role_officer(): u8  { ROLE_OFFICER }
    public fun role_director(): u8 { ROLE_DIRECTOR }

    // ── Tests ─────────────────────────────────────────────────────────────────

    #[test_only]
    use sui::test_scenario;

    #[test]
    fun test_found_corp_registers_and_director_cap() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (corp, cap) = found_corp(&mut registry, b"Reapers", ctx);

            assert!(cap.role == ROLE_DIRECTOR, 0);
            assert!(cap.member == founder, 1);
            assert!(member_count(&corp) == 1, 2);
            assert!(cradleos::registry::corp_count(&registry) == 1, 3);
            assert!(is_member(&corp, founder), 4);

            std::unit_test::destroy(corp);
            std::unit_test::destroy(cap);
            std::unit_test::destroy(registry);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_member_by_officer() {
        let founder = @0xF0;
        let new_member = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (mut corp, founder_cap) = found_corp(&mut registry, b"Reapers", ctx);
            let member_cap = add_member(&mut corp, new_member, ROLE_OFFICER, &founder_cap, ctx);

            assert!(is_member(&corp, new_member), 0);
            assert!(member_count(&corp) == 2, 1);
            assert!(member_cap.role == ROLE_OFFICER, 2);

            std::unit_test::destroy(corp);
            std::unit_test::destroy(founder_cap);
            std::unit_test::destroy(member_cap);
            std::unit_test::destroy(registry);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotOfficer)]
    fun test_non_officer_cannot_add_member() {
        let founder = @0xF0;
        let plain_member = @0xBB;
        let target = @0xCC;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (mut corp, founder_cap) = found_corp(&mut registry, b"Reapers", ctx);
            // Add plain member (role=0)
            let plain_cap = add_member(&mut corp, plain_member, ROLE_MEMBER, &founder_cap, ctx);
            // This should abort: plain member cannot add
            let _bad = add_member(&mut corp, target, ROLE_MEMBER, &plain_cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EAlreadyMember)]
    fun test_duplicate_member_rejected() {
        let founder = @0xF0;
        let dup = @0xDD;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (mut corp, cap) = found_corp(&mut registry, b"Reapers", ctx);
            let _c1 = add_member(&mut corp, dup, ROLE_MEMBER, &cap, ctx);
            // Second add of same address aborts
            let _c2 = add_member(&mut corp, dup, ROLE_MEMBER, &cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_change_role_by_director() {
        let founder = @0xF0;
        let m = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (mut corp, director_cap) = found_corp(&mut registry, b"Reapers", ctx);
            let _mc = add_member(&mut corp, m, ROLE_MEMBER, &director_cap, ctx);
            change_role(&mut corp, m, ROLE_OFFICER, &director_cap, ctx);
            let role = get_role(&corp, m);
            assert!(option::is_some(&role), 0);
            assert!(*option::borrow(&role) == ROLE_OFFICER, 1);
            std::unit_test::destroy(corp);
            std::unit_test::destroy(director_cap);
            std::unit_test::destroy(_mc);
            std::unit_test::destroy(registry);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotFounder)]
    fun test_change_role_by_non_director_fails() {
        let founder = @0xF0;
        let m = @0xBB;
        let m2 = @0xCC;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (mut corp, director_cap) = found_corp(&mut registry, b"Reapers", ctx);
            let officer_cap = add_member(&mut corp, m, ROLE_OFFICER, &director_cap, ctx);
            let _mc2 = add_member(&mut corp, m2, ROLE_MEMBER, &director_cap, ctx);
            // Officer cannot change roles
            change_role(&mut corp, m2, ROLE_OFFICER, &officer_cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_member_emits_event() {
        let founder = @0xF0;
        let m = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = cradleos::registry::create_registry(ctx);
            let (mut corp, director_cap) = found_corp(&mut registry, b"Reapers", ctx);
            let mc = add_member(&mut corp, m, ROLE_MEMBER, &director_cap, ctx);
            assert!(member_count(&corp) == 2, 0);
            remove_member(&mut corp, m, &director_cap, ctx);
            assert!(member_count(&corp) == 1, 1);
            assert!(!is_member(&corp, m), 2);
            std::unit_test::destroy(corp);
            std::unit_test::destroy(director_cap);
            std::unit_test::destroy(mc);
            std::unit_test::destroy(registry);
        };
        test_scenario::end(scenario);
    }
}
