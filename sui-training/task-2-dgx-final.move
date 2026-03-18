module training::corp_treasury {
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    // Error constants
    const ENotAdmin: u64 = 1;
    const ENotMember: u64 = 2;
    const EZeroAmount: u64 = 3;
    const EInsufficientBalance: u64 = 4;
    const EOverflow: u64 = 5;
    const EDuplicateMember: u64 = 6;
    const EMemberNotFound: u64 = 7;

    // Treasury struct
    struct Treasury has key, store {
        id: UID,
        admin: address,
        balance: u64,
        members: vector<address>,
    }

    // Events
    struct DepositEvent has copy, drop {
        treasury: ID,
        depositor: address,
        amount: u64,
    }

    struct WithdrawEvent has copy, drop {
        treasury: ID,
        admin: address,
        amount: u64,
    }

    struct AddMemberEvent has copy, drop {
        treasury: ID,
        member: address,
    }

    struct RemoveMemberEvent has copy, drop {
        treasury: ID,
        member: address,
    }

    // Create treasury
    public fun create(admin: address, ctx: &mut TxContext): Treasury {
        Treasury {
            id: object::new(ctx),
            admin,
            balance: 0,
            members: vector::empty<address>(),
        }
    }

    // Deposit — any member can deposit
    public fun deposit(treasury: &mut Treasury, amount: u64, ctx: &TxContext) {
        assert!(amount > 0, EZeroAmount);

        let depositor = tx_context::sender(ctx);
        assert!(is_member(treasury, depositor), ENotMember);

        // Overflow check
        assert!(treasury.balance <= 18446744073709551615u64 - amount, EOverflow);

        treasury.balance = treasury.balance + amount;
        event::emit(DepositEvent {
            treasury: object::id(treasury),
            depositor,
            amount,
        });
    }

    // Withdraw — admin only
    public fun withdraw(treasury: &mut Treasury, amount: u64, ctx: &TxContext) {
        let admin = tx_context::sender(ctx);
        assert!(admin == treasury.admin, ENotAdmin);
        assert!(treasury.balance >= amount, EInsufficientBalance);

        treasury.balance = treasury.balance - amount;
        event::emit(WithdrawEvent {
            treasury: object::id(treasury),
            admin,
            amount,
        });
    }

    // Add member — admin only, rejects duplicates
    public fun add_member(treasury: &mut Treasury, member: address, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == treasury.admin, ENotAdmin);
        assert!(!is_member(treasury, member), EDuplicateMember);

        vector::push_back(&mut treasury.members, member);
        event::emit(AddMemberEvent {
            treasury: object::id(treasury),
            member,
        });
    }

    // Remove member — admin only
    public fun remove_member(treasury: &mut Treasury, member: address, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == treasury.admin, ENotAdmin);
        assert!(is_member(treasury, member), EMemberNotFound);

        let index = find_member_index(treasury, member);
        vector::remove(&mut treasury.members, index);
        event::emit(RemoveMemberEvent {
            treasury: object::id(treasury),
            member,
        });
    }

    // Helper: check if member exists
    fun is_member(treasury: &Treasury, addr: address): bool {
        let members = &treasury.members;
        let i = 0;
        let n = vector::length(members);
        while (i < n) {
            if (*vector::borrow(members, i) == addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // Helper: find member index
    fun find_member_index(treasury: &Treasury, addr: address): u64 {
        let members = &treasury.members;
        let i = 0;
        let n = vector::length(members);
        while (i < n) {
            if (*vector::borrow(members, i) == addr) {
                return i
            };
            i = i + 1;
        };
        0
    }

    // Public view functions
    public fun get_balance(treasury: &Treasury): u64 { treasury.balance }
    public fun get_admin(treasury: &Treasury): address { treasury.admin }
    public fun get_members_count(treasury: &Treasury): u64 { vector::length(&treasury.members) }
}

#[test_only]
module training::corp_treasury_tests {
    use training::corp_treasury;
    use sui::test_scenario::{Self};

    #[test]
    fun test_deposit() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        // Admin adds @0x2 as member
        corp_treasury::add_member(&mut treasury, @0x2, test_scenario::ctx(&mut scenario));
        // Switch to member and deposit
        test_scenario::next_tx(&mut scenario, @0x2);
        corp_treasury::deposit(&mut treasury, 100, test_scenario::ctx(&mut scenario));
        assert!(corp_treasury::get_balance(&treasury) == 100, 0);
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_withdraw() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        // Admin adds self as member so can deposit
        corp_treasury::add_member(&mut treasury, @0x2, test_scenario::ctx(&mut scenario));
        // Switch to member for deposit
        test_scenario::next_tx(&mut scenario, @0x2);
        corp_treasury::deposit(&mut treasury, 100, test_scenario::ctx(&mut scenario));
        // Switch back to admin for withdraw
        test_scenario::next_tx(&mut scenario, @0x1);
        corp_treasury::withdraw(&mut treasury, 50, test_scenario::ctx(&mut scenario));
        assert!(corp_treasury::get_balance(&treasury) == 50, 0);
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_member() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        corp_treasury::add_member(&mut treasury, @0x2, test_scenario::ctx(&mut scenario));
        assert!(corp_treasury::get_members_count(&treasury) == 1, 0);
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::corp_treasury::EDuplicateMember)]
    fun test_duplicate_member_rejection() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        corp_treasury::add_member(&mut treasury, @0x2, test_scenario::ctx(&mut scenario));
        corp_treasury::add_member(&mut treasury, @0x2, test_scenario::ctx(&mut scenario));
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::corp_treasury::ENotAdmin)]
    fun test_non_admin_rejection() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, @0x2);
        corp_treasury::withdraw(&mut treasury, 100, test_scenario::ctx(&mut scenario));
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::corp_treasury::EZeroAmount)]
    fun test_zero_amount_rejection() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        corp_treasury::add_member(&mut treasury, @0x2, test_scenario::ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, @0x2);
        corp_treasury::deposit(&mut treasury, 0, test_scenario::ctx(&mut scenario));
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::corp_treasury::EInsufficientBalance)]
    fun test_insufficient_balance() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        corp_treasury::withdraw(&mut treasury, 100, test_scenario::ctx(&mut scenario));
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::corp_treasury::ENotMember)]
    fun test_non_member_deposit() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut treasury = corp_treasury::create(@0x1, test_scenario::ctx(&mut scenario));
        test_scenario::next_tx(&mut scenario, @0x2);
        corp_treasury::deposit(&mut treasury, 100, test_scenario::ctx(&mut scenario));
        sui::test_utils::destroy(treasury);
        test_scenario::end(scenario);
    }
}
