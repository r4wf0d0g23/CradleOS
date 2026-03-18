module corp_gate_permit::gate_permit {
    use sui::event;
    use sui::object::{Self as object, ID, UID};
    use sui::table_vec_set;
    use sui::transfer;
    use sui::tx_context::{Self as tx_context, TxContext};

    const E_NOT_ADMIN: u64 = 1;
    const E_TRIBE_ALREADY_EXISTS: u64 = 2;
    const E_ZERO_DURATION: u64 = 3;
    const E_EPOCH_OVERFLOW: u64 = 4;
    const E_TRIBE_NOT_REGISTERED: u64 = 5;

    const E_TEST_CORP_ID_MISMATCH: u64 = 1001;
    const E_TEST_TRIBE_NOT_REGISTERED_IN_TEST: u64 = 1002;
    const E_TEST_PERMIT_HOLDER_MISMATCH: u64 = 1003;
    const E_TEST_PERMIT_GATE_MISMATCH: u64 = 1004;
    const E_TEST_VALID_ACCESS_FAILED: u64 = 1005;
    const E_TEST_EXPIRED_ACCESS_SHOULD_FAIL: u64 = 1006;
    const E_TEST_REVOKE_CONSUMED_OBJECT: u64 = 1007;
    const E_TEST_HOLDER_MATCH_FAILED: u64 = 1008;
    const E_TEST_HOLDER_MISMATCH_CHECK_FAILED: u64 = 1009;

    public struct Corp has key, store {
        id: UID,
        corp_id: u32,
        admin: address,
        member_tribe_ids: table_vec_set::VecSet<u32>,
    }

    public struct GatePermit has key, store {
        id: UID,
        holder: address,
        gate_id: u64,
        expiry_epoch: u64,
        tribe_id: u32,
        corp_admin: address,
    }

    public struct PermitIssuedEvent has copy, drop, store {
        corp_id: u32,
        admin: address,
        recipient: address,
        gate_id: u64,
        expiry_epoch: u64,
        tribe_id: u32,
        permit_id: ID,
    }

    public struct PermitRevokedEvent has copy, drop, store {
        admin: address,
        holder: address,
        gate_id: u64,
        permit_id: ID,
        tribe_id: u32,
    }

    public entry fun create_corp(corp_id: u32, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let corp = Corp {
            id: object::new(ctx),
            corp_id,
            admin: sender,
            member_tribe_ids: table_vec_set::empty<u32>(ctx),
        };
        transfer::public_transfer(corp, sender);
    }

    public entry fun add_tribe(corp: &mut Corp, tribe_id: u32, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == corp.admin, E_NOT_ADMIN);
        assert!(!table_vec_set::contains(&corp.member_tribe_ids, &tribe_id), E_TRIBE_ALREADY_EXISTS);
        table_vec_set::insert(&mut corp.member_tribe_ids, tribe_id);
    }

    public entry fun issue_permit(
        corp: &Corp,
        recipient: address,
        gate_id: u64,
        duration_epochs: u64,
        tribe_id: u32,
        current_epoch: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == corp.admin, E_NOT_ADMIN);
        assert!(table_vec_set::contains(&corp.member_tribe_ids, &tribe_id), E_TRIBE_NOT_REGISTERED);
        assert!(duration_epochs > 0, E_ZERO_DURATION);
        assert!(current_epoch <= 18446744073709551615 - duration_epochs, E_EPOCH_OVERFLOW);

        let expiry_epoch = current_epoch + duration_epochs;
        let permit = GatePermit {
            id: object::new(ctx),
            holder: recipient,
            gate_id,
            expiry_epoch,
            tribe_id,
            corp_admin: corp.admin,
        };

        let permit_id = object::id(&permit.id);
        event::emit(PermitIssuedEvent {
            corp_id: corp.corp_id,
            admin: sender,
            recipient,
            gate_id,
            expiry_epoch,
            tribe_id,
            permit_id,
        });

        transfer::public_transfer(permit, recipient);
    }

    public entry fun revoke_permit(permit: GatePermit, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == permit.corp_admin, E_NOT_ADMIN);

        let GatePermit {
            id,
            holder,
            gate_id,
            expiry_epoch: _,
            tribe_id,
            corp_admin: _,
        } = permit;

        event::emit(PermitRevokedEvent {
            admin: sender,
            holder,
            gate_id,
            permit_id: object::id(&id),
            tribe_id,
        });

        object::delete(id);
    }

    public fun check_access(permit: &GatePermit, gate_id: u64, current_epoch: u64): bool {
        permit.gate_id == gate_id && current_epoch <= permit.expiry_epoch
    }

    public fun holder_matches(permit: &GatePermit, holder: address): bool {
        permit.holder == holder
    }

    public fun corp_id(corp: &Corp): u32 {
        corp.corp_id
    }

    public fun has_tribe(corp: &Corp, tribe_id: u32): bool {
        table_vec_set::contains(&corp.member_tribe_ids, &tribe_id)
    }

    public fun permit_holder(permit: &GatePermit): address {
        permit.holder
    }

    public fun permit_gate_id(permit: &GatePermit): u64 {
        permit.gate_id
    }

    public fun permit_expiry_epoch(permit: &GatePermit): u64 {
        permit.expiry_epoch
    }

    public fun permit_tribe_id(permit: &GatePermit): u32 {
        permit.tribe_id
    }

    #[test]
    fun test_issue_and_check_valid_access() {
        let admin = @0xA;
        let recipient = @0xB;
        let corp_id_value = 77;
        let tribe_id_value = 9001;
        let gate_id_value = 42;
        let current_epoch_value = 10;
        let duration_epochs_value = 5;

        let mut scenario = sui::test_scenario::begin(admin);

        {
            let ctx = sui::test_scenario::ctx(&mut scenario);
            create_corp(corp_id_value, ctx);
        };

        sui::test_scenario::next_tx(&mut scenario, admin);

        {
            let mut corp = sui::test_scenario::take_from_sender<Corp>(&scenario);
            assert!(corp_id(&corp) == corp_id_value, E_TEST_CORP_ID_MISMATCH);

            let ctx = sui::test_scenario::ctx(&mut scenario);
            add_tribe(&mut corp, tribe_id_value, ctx);
            assert!(has_tribe(&corp, tribe_id_value), E_TEST_TRIBE_NOT_REGISTERED_IN_TEST);

            issue_permit(
                &corp,
                recipient,
                gate_id_value,
                duration_epochs_value,
                tribe_id_value,
                current_epoch_value,
                ctx
            );

            sui::test_scenario::return_to_sender(&scenario, corp);
        };

        sui::test_scenario::next_tx(&mut scenario, recipient);

        {
            let permit = sui::test_scenario::take_from_sender<GatePermit>(&scenario);
            assert!(permit_holder(&permit) == recipient, E_TEST_PERMIT_HOLDER_MISMATCH);
            assert!(permit_gate_id(&permit) == gate_id_value, E_TEST_PERMIT_GATE_MISMATCH);
            assert!(holder_matches(&permit, recipient), E_TEST_HOLDER_MATCH_FAILED);
            assert!(!holder_matches(&permit, admin), E_TEST_HOLDER_MISMATCH_CHECK_FAILED);
            assert!(check_access(&permit, gate_id_value, current_epoch_value + 1), E_TEST_VALID_ACCESS_FAILED);
            sui::test_scenario::return_to_sender(&scenario, permit);
        };

        sui::test_scenario::end(scenario);
    }

    #[test]
    fun test_check_expired_access() {
        let admin = @0xC;
        let recipient = @0xD;
        let tribe_id_value = 501;
        let gate_id_value = 99;
        let current_epoch_value = 20;
        let duration_epochs_value = 2;

        let mut scenario = sui::test_scenario::begin(admin);

        {
            let ctx = sui::test_scenario::ctx(&mut scenario);
            create_corp(88, ctx);
        };

        sui::test_scenario::next_tx(&mut scenario, admin);

        {
            let mut corp = sui::test_scenario::take_from_sender<Corp>(&scenario);
            let ctx = sui::test_scenario::ctx(&mut scenario);
            add_tribe(&mut corp, tribe_id_value, ctx);
            issue_permit(
                &corp,
                recipient,
                gate_id_value,
                duration_epochs_value,
                tribe_id_value,
                current_epoch_value,
                ctx
            );
            sui::test_scenario::return_to_sender(&scenario, corp);
        };

        sui::test_scenario::next_tx(&mut scenario, recipient);

        {
            let permit = sui::test_scenario::take_from_sender<GatePermit>(&scenario);
            assert!(
                !check_access(&permit, gate_id_value, current_epoch_value + duration_epochs_value + 1),
                E_TEST_EXPIRED_ACCESS_SHOULD_FAIL
            );
            sui::test_scenario::return_to_sender(&scenario, permit);
        };

        sui::test_scenario::end(scenario);
    }

    #[test]
    fun test_revoke_permit() {
        let admin = @0xE;
        let recipient = @0xF;
        let tribe_id_value = 700;
        let gate_id_value = 1234;

        let mut scenario = sui::test_scenario::begin(admin);

        {
            let ctx = sui::test_scenario::ctx(&mut scenario);
            create_corp(101, ctx);
        };

        sui::test_scenario::next_tx(&mut scenario, admin);

        {
            let mut corp = sui::test_scenario::take_from_sender<Corp>(&scenario);
            let ctx = sui::test_scenario::ctx(&mut scenario);
            add_tribe(&mut corp, tribe_id_value, ctx);
            issue_permit(&corp, recipient, gate_id_value, 3, tribe_id_value, 50, ctx);
            sui::test_scenario::return_to_sender(&scenario, corp);
        };

        sui::test_scenario::next_tx(&mut scenario, recipient);

        {
            let permit = sui::test_scenario::take_from_sender<GatePermit>(&scenario);
            sui::test_scenario::return_to_address(admin, permit);
        };

        sui::test_scenario::next_tx(&mut scenario, admin);

        {
            let permit = sui::test_scenario::take_from_sender<GatePermit>(&scenario);
            revoke_permit(permit, sui::test_scenario::ctx(&mut scenario));
        };

        sui::test_scenario::next_tx(&mut scenario, admin);

        {
            let exists = sui::test_scenario::has_most_recent_for_sender<GatePermit>(&scenario);
            assert!(!exists, E_TEST_REVOKE_CONSUMED_OBJECT);
        };

        sui::test_scenario::end(scenario);
    }

    #[test, expected_failure(abort_code = corp_gate_permit::gate_permit::E_NOT_ADMIN)]
    fun test_non_admin_add_tribe_fails() {
        let admin = @0x11;
        let non_admin = @0x12;

        let mut scenario = sui::test_scenario::begin(admin);

        {
            let ctx = sui::test_scenario::ctx(&mut scenario);
            create_corp(202, ctx);
        };

        sui::test_scenario::next_tx(&mut scenario, admin);

        {
            let corp = sui::test_scenario::take_from_sender<Corp>(&scenario);
            sui::test_scenario::return_to_address(admin, corp);
        };

        sui::test_scenario::next_tx(&mut scenario, non_admin);

        {
            let mut corp = sui::test_scenario::take_from_address<Corp>(&scenario, admin);
            add_tribe(&mut corp, 404, sui::test_scenario::ctx(&mut scenario));
            sui::test_scenario::return_to_address(admin, corp);
        };

        sui::test_scenario::end(scenario);
    }
}
