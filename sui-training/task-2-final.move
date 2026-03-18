module corp_treasury::treasury {
    use std::option;
    use std::vector;
    use sui::balance::{Self as balance, Balance};
    use sui::coin::{Self as coin, Coin};
    use sui::event;
    use sui::object::{Self as object, ID, UID};
    use sui::sui::SUI;
    use sui::test_scenario::{Self as ts};
    use sui::transfer;
    use sui::tx_context::{Self as tx_context, TxContext};

    const E_NOT_ADMIN: u64 = 1;
    const E_NOT_MEMBER: u64 = 2;
    const E_MEMBER_ALREADY_EXISTS: u64 = 3;
    const E_INVALID_THRESHOLD: u64 = 4;
    const E_INVALID_AMOUNT: u64 = 5;
    const E_PROPOSAL_NOT_FOUND: u64 = 6;
    const E_ALREADY_APPROVED: u64 = 7;
    const E_ALREADY_EXECUTED: u64 = 8;
    const E_INSUFFICIENT_BALANCE: u64 = 9;
    const E_PROPOSAL_ID_OVERFLOW: u64 = 10;
    const E_ZERO_DEPOSIT: u64 = 11;

    const E_TEST_TREASURY_CREATED: u64 = 1001;
    const E_TEST_MEMBER_ADDED: u64 = 1002;
    const E_TEST_BALANCE_AFTER_DEPOSIT: u64 = 1003;
    const E_TEST_PROPOSAL_CREATED: u64 = 1004;
    const E_TEST_PROPOSAL_PENDING_BEFORE_THRESHOLD: u64 = 1005;
    const E_TEST_BALANCE_AFTER_EXECUTION: u64 = 1006;
    const E_TEST_PROPOSAL_EXECUTED: u64 = 1007;
    const E_TEST_RECIPIENT_RECEIVED_FUNDS: u64 = 1008;

    public struct Treasury has key, store {
        id: UID,
        admin: address,
        members: vector<address>,
        threshold: u64,
        next_proposal_id: u64,
        balance: Balance<SUI>,
        proposals: vector<WithdrawalProposal>,
    }

    public struct WithdrawalProposal has store {
        id: u64,
        amount: u64,
        recipient: address,
        approvals: vector<address>,
        executed: bool,
    }

    public struct DepositEvent has copy, drop, store {
        treasury_id: ID,
        depositor: address,
        amount: u64,
        new_balance: u64,
    }

    public struct WithdrawalProposedEvent has copy, drop, store {
        treasury_id: ID,
        proposal_id: u64,
        proposer: address,
        amount: u64,
        recipient: address,
        threshold: u64,
    }

    public struct WithdrawalExecutedEvent has copy, drop, store {
        treasury_id: ID,
        proposal_id: u64,
        recipient: address,
        amount: u64,
        approvals: u64,
        remaining_balance: u64,
    }

    public entry fun create(threshold: u64, ctx: &mut TxContext) {
        assert!(threshold > 0, E_INVALID_THRESHOLD);

        let sender = tx_context::sender(ctx);
        let mut members = vector::empty<address>();
        vector::push_back(&mut members, sender);

        let treasury = Treasury {
            id: object::new(ctx),
            admin: sender,
            members,
            threshold,
            next_proposal_id: 0,
            balance: balance::zero<SUI>(),
            proposals: vector::empty<WithdrawalProposal>(),
        };

        transfer::public_transfer(treasury, sender);
    }

    public entry fun add_member(treasury: &mut Treasury, member: address, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == treasury.admin, E_NOT_ADMIN);
        assert!(!is_member_address(treasury, member), E_MEMBER_ALREADY_EXISTS);
        vector::push_back(&mut treasury.members, member);
    }

    public entry fun deposit(treasury: &mut Treasury, coin_in: Coin<SUI>, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(is_member_address(treasury, sender), E_NOT_MEMBER);

        let amount = coin::value(&coin_in);
        assert!(amount > 0, E_ZERO_DEPOSIT);

        let incoming_balance = coin::into_balance(coin_in);
        balance::join(&mut treasury.balance, incoming_balance);

        event::emit(DepositEvent {
            treasury_id: object::id(&treasury.id),
            depositor: sender,
            amount,
            new_balance: balance::value(&treasury.balance),
        });
    }

    public entry fun propose_withdrawal(
        treasury: &mut Treasury,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_member_address(treasury, sender), E_NOT_MEMBER);
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(treasury.next_proposal_id < 18446744073709551615, E_PROPOSAL_ID_OVERFLOW);

        let proposal_id = treasury.next_proposal_id;
        treasury.next_proposal_id = treasury.next_proposal_id + 1;

        let mut approvals = vector::empty<address>();
        vector::push_back(&mut approvals, sender);

        let proposal = WithdrawalProposal {
            id: proposal_id,
            amount,
            recipient,
            approvals,
            executed: false,
        };

        vector::push_back(&mut treasury.proposals, proposal);

        event::emit(WithdrawalProposedEvent {
            treasury_id: object::id(&treasury.id),
            proposal_id,
            proposer: sender,
            amount,
            recipient,
            threshold: treasury.threshold,
        });

        try_execute_withdrawal(treasury, proposal_id, ctx);
    }

    public entry fun approve_withdrawal(
        treasury: &mut Treasury,
        proposal_id: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_member_address(treasury, sender), E_NOT_MEMBER);

        let proposal_ref = borrow_proposal_mut(treasury, proposal_id);
        assert!(!proposal_ref.executed, E_ALREADY_EXECUTED);
        assert!(!vector_contains_address(&proposal_ref.approvals, sender), E_ALREADY_APPROVED);

        vector::push_back(&mut proposal_ref.approvals, sender);

        try_execute_withdrawal(treasury, proposal_id, ctx);
    }

    public fun balance_value(treasury: &Treasury): u64 {
        balance::value(&treasury.balance)
    }

    public fun proposal_exists(treasury: &Treasury, proposal_id: u64): bool {
        find_proposal_index(treasury, proposal_id).is_some()
    }

    public fun proposal_executed(treasury: &Treasury, proposal_id: u64): bool {
        let idx = option_extract_index(find_proposal_index(treasury, proposal_id), E_PROPOSAL_NOT_FOUND);
        let proposal_ref = vector::borrow(&treasury.proposals, idx);
        proposal_ref.executed
    }

    public fun proposal_approval_count(treasury: &Treasury, proposal_id: u64): u64 {
        let idx = option_extract_index(find_proposal_index(treasury, proposal_id), E_PROPOSAL_NOT_FOUND);
        let proposal_ref = vector::borrow(&treasury.proposals, idx);
        vector::length(&proposal_ref.approvals)
    }

    fun try_execute_withdrawal(
        treasury: &mut Treasury,
        proposal_id: u64,
        ctx: &mut TxContext
    ) {
        let idx = option_extract_index(find_proposal_index(treasury, proposal_id), E_PROPOSAL_NOT_FOUND);
        let proposal_ref = vector::borrow_mut(&mut treasury.proposals, idx);

        if (proposal_ref.executed) {
            return
        };

        let approvals = vector::length(&proposal_ref.approvals);
        if (approvals < treasury.threshold) {
            return
        };

        assert!(balance::value(&treasury.balance) >= proposal_ref.amount, E_INSUFFICIENT_BALANCE);

        let withdrawn_balance = balance::split(&mut treasury.balance, proposal_ref.amount);
        let payout = coin::from_balance(withdrawn_balance, ctx);
        transfer::public_transfer(payout, proposal_ref.recipient);

        proposal_ref.executed = true;

        event::emit(WithdrawalExecutedEvent {
            treasury_id: object::id(&treasury.id),
            proposal_id: proposal_ref.id,
            recipient: proposal_ref.recipient,
            amount: proposal_ref.amount,
            approvals,
            remaining_balance: balance::value(&treasury.balance),
        });
    }

    fun borrow_proposal_mut(treasury: &mut Treasury, proposal_id: u64): &mut WithdrawalProposal {
        let idx = option_extract_index(find_proposal_index(treasury, proposal_id), E_PROPOSAL_NOT_FOUND);
        vector::borrow_mut(&mut treasury.proposals, idx)
    }

    fun find_proposal_index(treasury: &Treasury, proposal_id: u64): option::Option<u64> {
        let len = vector::length(&treasury.proposals);
        let mut i = 0;
        while (i < len) {
            let proposal_ref = vector::borrow(&treasury.proposals, i);
            if (proposal_ref.id == proposal_id) {
                return option::some(i)
            };
            i = i + 1;
        };
        option::none()
    }

    fun is_member_address(treasury: &Treasury, member: address): bool {
        vector_contains_address(&treasury.members, member)
    }

    fun vector_contains_address(addresses: &vector<address>, candidate: address): bool {
        let len = vector::length(addresses);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(addresses, i) == candidate) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun option_extract_index(opt: option::Option<u64>, err: u64): u64 {
        assert!(option::is_some(&opt), err);
        option::destroy_some(opt)
    }

    #[test]
    fun test_deposit_and_threshold_execution() {
        let admin = @0xA;
        let member = @0xB;
        let recipient = @0xC;

        let mut scenario = ts::begin(admin);

        {
            let ctx = ts::ctx(&mut scenario);
            create(2, ctx);
        };

        ts::next_tx(&mut scenario, admin);

        {
            let mut treasury = ts::take_from_sender<Treasury>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            add_member(&mut treasury, member, ctx);
            assert!(is_member_address(&treasury, member), E_TEST_MEMBER_ADDED);
            ts::return_to_sender(&scenario, treasury);
        };

        ts::next_tx(&mut scenario, admin);

        {
            let mut treasury = ts::take_from_sender<Treasury>(&scenario);
            assert!(balance_value(&treasury) == 0, E_TEST_TREASURY_CREATED);

            let deposit_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let deposit_amount = coin::value(&deposit_coin);
            deposit(&mut treasury, deposit_coin, ts::ctx(&mut scenario));
            assert!(balance_value(&treasury) == deposit_amount, E_TEST_BALANCE_AFTER_DEPOSIT);

            ts::return_to_sender(&scenario, treasury);
        };

        ts::next_tx(&mut scenario, member);

        {
            let mut treasury = ts::take_from_address<Treasury>(&scenario, admin);
            propose_withdrawal(&mut treasury, 1, recipient, ts::ctx(&mut scenario));
            assert!(proposal_exists(&treasury, 0), E_TEST_PROPOSAL_CREATED);
            assert!(proposal_approval_count(&treasury, 0) == 1, E_TEST_PROPOSAL_CREATED);
            assert!(!proposal_executed(&treasury, 0), E_TEST_PROPOSAL_PENDING_BEFORE_THRESHOLD);
            ts::return_to_address(admin, treasury);
        };

        ts::next_tx(&mut scenario, admin);

        {
            let mut treasury = ts::take_from_sender<Treasury>(&scenario);
            approve_withdrawal(&mut treasury, 0, ts::ctx(&mut scenario));
            assert!(proposal_executed(&treasury, 0), E_TEST_PROPOSAL_EXECUTED);
            assert!(balance_value(&treasury) == 0, E_TEST_BALANCE_AFTER_EXECUTION);
            ts::return_to_sender(&scenario, treasury);
        };

        ts::next_tx(&mut scenario, recipient);

        {
            let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&payout) == 1, E_TEST_RECIPIENT_RECEIVED_FUNDS);
            ts::return_to_sender(&scenario, payout);
        };

        ts::end(scenario);
    }

    #[test, expected_failure(abort_code = corp_treasury::treasury::E_MEMBER_ALREADY_EXISTS)]
    fun test_add_member_fails_when_duplicate() {
        let admin = @0xA;
        let member = @0xB;

        let mut scenario = ts::begin(admin);

        {
            let ctx = ts::ctx(&mut scenario);
            create(2, ctx);
        };

        ts::next_tx(&mut scenario, admin);

        {
            let mut treasury = ts::take_from_sender<Treasury>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            add_member(&mut treasury, member, ctx);
            add_member(&mut treasury, member, ctx);
            ts::return_to_sender(&scenario, treasury);
        };

        ts::end(scenario);
    }
}
