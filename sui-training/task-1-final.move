module counter::counter {
    use sui::object::{Self, UID};
    use sui::test_scenario::{Self as ts};
    use sui::transfer;
    use sui::tx_context::{Self as tx_context, TxContext};

    const E_NOT_OWNER: u64 = 1;
    const E_OVERFLOW: u64 = 2;

    const E_TEST_CREATE_VALUE_ZERO: u64 = 1001;
    const E_TEST_INCREMENT_VALUE_TWO: u64 = 1002;
    const E_TEST_DECREMENT_MIN_ZERO: u64 = 1003;
    const E_TEST_INCREMENT_VALUE_TWO_BEFORE_DECREMENT: u64 = 1004;
    const E_TEST_DECREMENT_VALUE_ONE: u64 = 1005;
    const E_TEST_RESET_VALUE_ZERO: u64 = 1006;

    public struct Counter has key, store {
        id: UID,
        value: u64,
        owner: address,
    }

    public entry fun create(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let counter = Counter {
            id: object::new(ctx),
            value: 0,
            owner: sender,
        };
        transfer::public_transfer(counter, sender);
    }

    public entry fun increment(counter: &mut Counter) {
        assert!(counter.value < 18446744073709551615, E_OVERFLOW);
        counter.value = counter.value + 1;
    }

    public entry fun decrement(counter: &mut Counter) {
        if (counter.value > 0) {
            counter.value = counter.value - 1;
        };
    }

    public entry fun reset(counter: &mut Counter, ctx: &TxContext) {
        assert!(counter.owner == tx_context::sender(ctx), E_NOT_OWNER);
        counter.value = 0;
    }

    public fun value(counter: &Counter): u64 {
        counter.value
    }

    #[test]
    fun test_create_and_increment() {
        let owner = @0xA;
        let mut scenario = ts::begin(owner);

        {
            let ctx = ts::ctx(&mut scenario);
            create(ctx);
        };

        ts::next_tx(&mut scenario, owner);

        {
            let counter = ts::take_from_sender<Counter>(&scenario);
            assert!(value(&counter) == 0, E_TEST_CREATE_VALUE_ZERO);

            let mut counter = counter;
            increment(&mut counter);
            increment(&mut counter);
            assert!(value(&counter) == 2, E_TEST_INCREMENT_VALUE_TWO);

            ts::return_to_sender(&scenario, counter);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_decrement_and_owner_reset() {
        let owner = @0xB;
        let mut scenario = ts::begin(owner);

        {
            let ctx = ts::ctx(&mut scenario);
            create(ctx);
        };

        ts::next_tx(&mut scenario, owner);

        {
            let counter = ts::take_from_sender<Counter>(&scenario);
            let mut counter = counter;

            decrement(&mut counter);
            assert!(value(&counter) == 0, E_TEST_DECREMENT_MIN_ZERO);

            increment(&mut counter);
            increment(&mut counter);
            assert!(value(&counter) == 2, E_TEST_INCREMENT_VALUE_TWO_BEFORE_DECREMENT);

            decrement(&mut counter);
            assert!(value(&counter) == 1, E_TEST_DECREMENT_VALUE_ONE);

            let ctx = ts::ctx(&mut scenario);
            reset(&mut counter, ctx);
            assert!(value(&counter) == 0, E_TEST_RESET_VALUE_ZERO);

            ts::return_to_sender(&scenario, counter);
        };

        ts::end(scenario);
    }

    #[test, expected_failure(abort_code = counter::counter::E_NOT_OWNER)]
    fun test_reset_fails_for_non_owner() {
        let owner = @0xC;
        let non_owner = @0xD;
        let mut scenario = ts::begin(owner);

        {
            let ctx = ts::ctx(&mut scenario);
            create(ctx);
        };

        ts::next_tx(&mut scenario, owner);

        {
            let counter = ts::take_from_sender<Counter>(&scenario);
            ts::return_to_sender(&scenario, counter);
        };

        ts::next_tx(&mut scenario, non_owner);

        {
            let mut counter = ts::take_from_address<Counter>(&scenario, owner);
            let ctx = ts::ctx(&mut scenario);
            reset(&mut counter, ctx);
            ts::return_to_address(owner, counter);
        };

        ts::end(scenario);
    }
}
