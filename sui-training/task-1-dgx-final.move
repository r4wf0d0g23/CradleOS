module training::coin_counter {
    use sui::tx_context::{TxContext, sender};
    use sui::event::emit;
    use sui::object::{Self, ID};

    // Error constants
    const ENotOwner: u64 = 1;
    const EOverflow: u64 = 2;

    // Events
    struct CounterIncremented has copy, drop {
        counter_id: ID,
        new_value: u64,
        amount_added: u64
    }

    struct CounterReset has copy, drop {
        counter_id: ID,
        old_value: u64
    }

    // Counter object
    struct Counter has key, store {
        id: UID,
        owner: address,
        value: u64
    }

    public fun create(ctx: &mut TxContext): Counter {
        Counter {
            id: object::new(ctx),
            owner: sender(ctx),
            value: 0
        }
    }

    public fun increment(counter: &mut Counter, amount: u64, ctx: &TxContext) {
        assert!(sender(ctx) == counter.owner, ENotOwner);

        // Check for overflow before addition
        assert!(counter.value <= 18446744073709551615u64 - amount, EOverflow);

        counter.value = counter.value + amount;

        emit(CounterIncremented {
            counter_id: object::id(counter),
            new_value: counter.value,
            amount_added: amount
        });
    }

    public fun reset(counter: &mut Counter, ctx: &TxContext) {
        assert!(sender(ctx) == counter.owner, ENotOwner);

        let old_value = counter.value;
        counter.value = 0;

        emit(CounterReset {
            counter_id: object::id(counter),
            old_value: old_value
        });
    }

    public fun value(counter: &Counter): u64 {
        counter.value
    }

    #[test_only]
    public fun set_value_for_testing(counter: &mut Counter, v: u64) {
        counter.value = v;
    }
}

#[test_only]
module training::coin_counter_tests {
    use training::coin_counter;
    use sui::test_scenario::{Self};

    #[test]
    fun test_create_and_value() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let counter = coin_counter::create(ctx);
            assert!(coin_counter::value(&counter) == 0, 0);
            sui::test_utils::destroy(counter);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_increment() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut counter = coin_counter::create(ctx);
            coin_counter::increment(&mut counter, 10, ctx);
            assert!(coin_counter::value(&counter) == 10, 0);
            coin_counter::increment(&mut counter, 5, ctx);
            assert!(coin_counter::value(&counter) == 15, 0);
            sui::test_utils::destroy(counter);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_reset() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut counter = coin_counter::create(ctx);
            coin_counter::increment(&mut counter, 42, ctx);
            assert!(coin_counter::value(&counter) == 42, 0);
            coin_counter::reset(&mut counter, ctx);
            assert!(coin_counter::value(&counter) == 0, 0);
            sui::test_utils::destroy(counter);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::coin_counter::ENotOwner)]
    fun test_not_owner_increment() {
        let mut scenario = test_scenario::begin(@0x1);
        let mut counter;
        {
            let ctx = test_scenario::ctx(&mut scenario);
            counter = coin_counter::create(ctx);
        };
        test_scenario::next_tx(&mut scenario, @0x2);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            coin_counter::increment(&mut counter, 10, ctx);
        };
        sui::test_utils::destroy(counter);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = training::coin_counter::EOverflow)]
    fun test_overflow() {
        let mut scenario = test_scenario::begin(@0x1);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut counter = coin_counter::create(ctx);
            coin_counter::set_value_for_testing(&mut counter, 18446744073709551610);
            coin_counter::increment(&mut counter, 6, ctx);
            sui::test_utils::destroy(counter);
        };
        test_scenario::end(scenario);
    }
}
