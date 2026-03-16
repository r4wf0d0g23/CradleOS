/// CradleOS – Registry
/// Root on-chain directory of all CradleOS corps.
module cradleos::registry {
    use sui::event;

    // ── Structs ──────────────────────────────────────────────────────────────

    public struct Registry has key {
        id: UID,
        admin: address,
        corp_count: u64,
    }

    // ── Events ───────────────────────────────────────────────────────────────

    public struct CorpRegistered has copy, drop {
        corp_id: ID,
        name: vector<u8>,
        founder: address,
    }

    // ── Public functions ─────────────────────────────────────────────────────

    /// Create the Registry. Caller becomes admin. Returns the Registry object.
    public fun create_registry(ctx: &mut TxContext): Registry {
        Registry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            corp_count: 0,
        }
    }

    /// Package-private — only corp.move (same package) may call.
    /// Records a new corp in the directory and emits CorpRegistered.
    public(package) fun register_corp(
        registry: &mut Registry,
        corp_id: ID,
        name: vector<u8>,
        founder: address,
    ) {
        registry.corp_count = registry.corp_count + 1;
        event::emit(CorpRegistered { corp_id, name, founder });
    }

    // ── Accessors ────────────────────────────────────────────────────────────

    public fun admin(registry: &Registry): address { registry.admin }
    public fun corp_count(registry: &Registry): u64 { registry.corp_count }

    // ── Tests ────────────────────────────────────────────────────────────────

    #[test_only]
    use sui::test_scenario;

    #[test]
    fun test_create_registry() {
        let admin = @0xAD;
        let mut scenario = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let registry = create_registry(ctx);
            assert!(registry.admin == admin, 0);
            assert!(registry.corp_count == 0, 1);
            std::unit_test::destroy(registry);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_register_corp_increments_count() {
        let admin = @0xAD;
        let mut scenario = test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut registry = create_registry(ctx);
            register_corp(&mut registry, object::id_from_address(@0x0001), b"Alpha", @0xAA);
            assert!(registry.corp_count == 1, 0);
            register_corp(&mut registry, object::id_from_address(@0x0002), b"Beta", @0xBB);
            assert!(registry.corp_count == 2, 1);
            std::unit_test::destroy(registry);
        };
        test_scenario::end(scenario);
    }
}
