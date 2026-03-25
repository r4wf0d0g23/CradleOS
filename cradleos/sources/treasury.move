/// CradleOS – Treasury
/// Corp treasury. Holds SUI. Members deposit, directors withdraw.
module cradleos::treasury {
    use sui::event;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use cradleos::corp::{Self, Corp, MemberCap};

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotMember:         u64 = 0;
    const ENotDirector:       u64 = 1;
    const EInsufficientFunds: u64 = 2;
    const EZeroAmount:        u64 = 3;

    // ── Structs ───────────────────────────────────────────────────────────────

    public struct Treasury has key {
        id: UID,
        corp_id: ID,
        balance: Balance<SUI>,
        total_deposited: u64,
        total_withdrawn: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct DepositRecord has copy, drop {
        treasury_id: ID,
        depositor: address,
        amount: u64,
        new_balance: u64,
    }

    public struct WithdrawRecord has copy, drop {
        treasury_id: ID,
        recipient: address,
        amount: u64,
        new_balance: u64,
    }

    // ── Public functions ──────────────────────────────────────────────────────

    /// Create a Treasury linked to the given Corp.
    public fun create_treasury(corp: &Corp, ctx: &mut TxContext): Treasury {
        Treasury {
            id: object::new(ctx),
            corp_id: object::id(corp),
            balance: balance::zero<SUI>(),
            total_deposited: 0,
            total_withdrawn: 0,
        }
    }

    /// Any corp member may deposit SUI into the treasury.
    public fun deposit(
        treasury: &mut Treasury,
        corp: &Corp,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        let depositor = tx_context::sender(ctx);
        assert!(corp::is_member(corp, depositor), ENotMember);
        let amount = coin::value(&payment);
        assert!(amount > 0, EZeroAmount);

        balance::join(&mut treasury.balance, coin::into_balance(payment));
        treasury.total_deposited = treasury.total_deposited + amount;
        let new_balance = balance::value(&treasury.balance);
        event::emit(DepositRecord {
            treasury_id: object::id(treasury),
            depositor,
            amount,
            new_balance,
        });
    }

    /// Director only: withdraw SUI from the treasury.
    public fun withdraw(
        treasury: &mut Treasury,
        corp: &Corp,
        amount: u64,
        cap: &MemberCap,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        assert!(corp::cap_corp_id(cap) == object::id(corp), ENotDirector);
        assert!(corp::cap_role(cap) >= corp::role_director(), ENotDirector);
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&treasury.balance) >= amount, EInsufficientFunds);

        treasury.total_withdrawn = treasury.total_withdrawn + amount;
        let coin = coin::from_balance(balance::split(&mut treasury.balance, amount), ctx);
        let new_balance = balance::value(&treasury.balance);
        let recipient = tx_context::sender(ctx);
        event::emit(WithdrawRecord {
            treasury_id: object::id(treasury),
            recipient,
            amount,
            new_balance,
        });
        coin
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public fun balance(treasury: &Treasury): u64 { balance::value(&treasury.balance) }
    public fun total_deposited(treasury: &Treasury): u64 { treasury.total_deposited }
    public fun total_withdrawn(treasury: &Treasury): u64 { treasury.total_withdrawn }

    // ── Tests ─────────────────────────────────────────────────────────────────

    #[test_only]
    use sui::test_scenario;
    #[test_only]
    use cradleos::registry;

    #[test]
    fun test_member_can_deposit() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (corp, cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let mut treasury = create_treasury(&corp, ctx);
            let payment = coin::mint_for_testing<SUI>(500, ctx);
            deposit(&mut treasury, &corp, payment, ctx);
            assert!(balance(&treasury) == 500, 0);
            assert!(total_deposited(&treasury) == 500, 1);
            std::unit_test::destroy(treasury);
            std::unit_test::destroy(corp);
            std::unit_test::destroy(cap);
            std::unit_test::destroy(reg);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotMember)]
    fun test_non_member_cannot_deposit() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            // found_corp adds founder as director; then remove founder → no members
            let (mut corp, director_cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            cradleos::corp::remove_member(&mut corp, founder, &director_cap, ctx);
            let mut treasury = create_treasury(&corp, ctx);
            // founder is no longer a member; deposit should abort ENotMember
            let payment = coin::mint_for_testing<SUI>(100, ctx);
            deposit(&mut treasury, &corp, payment, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_director_can_withdraw() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (corp, director_cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let mut treasury = create_treasury(&corp, ctx);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            deposit(&mut treasury, &corp, payment, ctx);
            assert!(balance(&treasury) == 1000, 0);
            let withdrawn = withdraw(&mut treasury, &corp, 400, &director_cap, ctx);
            assert!(coin::value(&withdrawn) == 400, 1);
            assert!(balance(&treasury) == 600, 2);
            assert!(total_withdrawn(&treasury) == 400, 3);
            std::unit_test::destroy(withdrawn);
            std::unit_test::destroy(treasury);
            std::unit_test::destroy(corp);
            std::unit_test::destroy(director_cap);
            std::unit_test::destroy(reg);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotDirector)]
    fun test_non_director_cannot_withdraw() {
        let founder = @0xF0;
        let officer_addr = @0xBB;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (mut corp, director_cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let officer_cap = cradleos::corp::add_member(&mut corp, officer_addr, cradleos::corp::role_officer(), &director_cap, ctx);
            let mut treasury = create_treasury(&corp, ctx);
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            deposit(&mut treasury, &corp, payment, ctx);
            // officer cap → should abort ENotDirector
            let _coin = withdraw(&mut treasury, &corp, 100, &officer_cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EInsufficientFunds)]
    fun test_overdraw_rejected() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (corp, director_cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let mut treasury = create_treasury(&corp, ctx);
            let payment = coin::mint_for_testing<SUI>(100, ctx);
            deposit(&mut treasury, &corp, payment, ctx);
            // withdraw more than balance
            let _coin = withdraw(&mut treasury, &corp, 999, &director_cap, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EZeroAmount)]
    fun test_zero_deposit_rejected() {
        let founder = @0xF0;
        let mut scenario = test_scenario::begin(founder);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut reg = registry::create_registry(ctx);
            let (corp, _cap) = cradleos::corp::found_corp(&mut reg, b"Reapers", ctx);
            let mut treasury = create_treasury(&corp, ctx);
            let payment = coin::mint_for_testing<SUI>(0, ctx);
            deposit(&mut treasury, &corp, payment, ctx);
            abort 0
        };
        test_scenario::end(scenario);
    }
}
