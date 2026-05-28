/// CradleOS Voting — Extension Registry
///
/// Witness-based plugin surface for community-provided Eligibility, Weight, and
/// Tally implementations. Sui Move lacks dynamic dispatch on traits; this module
/// provides the closest practical equivalent: a typed proof object pattern where
/// (1) third parties publish modules that mint single-use proofs, (2) the core
/// voting module verifies proofs against a registry of trusted provider packages.
///
/// See memory/projects/voting-infrastructure.md §5 for the full pattern.
module cradleos_voting::extension {
    use sui::table::{Self, Table};
    use sui::event;
    use std::string::{Self, String};

    // ── Error codes ───────────────────────────────────────────────────────────
    const E_NOT_ADMIN:           u64 = 0;
    const E_KIND_ALREADY_USED:   u64 = 1;
    const E_KIND_NOT_REGISTERED: u64 = 2;
    const E_RESERVED_KIND:       u64 = 3;
    const E_KIND_OUT_OF_RANGE:   u64 = 4;

    // ── Kind ranges (documented in §5.4) ──────────────────────────────────────
    /// Kinds 0–63: CradleOS standard library (built-in, on-chain dispatch).
    /// Kinds 64–127: CradleOS reserved for future built-ins.
    /// Kinds 128–191: Community curated (admin-registered).
    /// Kinds 192–255: Community self-registered (first-come-first-served).
    const KIND_BUILTIN_MAX:     u8 = 63;
    const KIND_RESERVED_MAX:    u8 = 127;
    const KIND_CURATED_MIN:     u8 = 128;
    const KIND_CURATED_MAX:     u8 = 191;
    const KIND_SELF_MIN:        u8 = 192;

    // ── AdminCap (Move-book canonical capability pattern) ────────────────────
    //
    // Minted once at registry creation; transferred to the deployer.
    // To transfer admin rights, send this object to the new admin.

    public struct AdminCap has key, store {
        id: UID,
        registry_id: ID,
    }

    // ── Registry entry types ─────────────────────────────────────────────────

    public struct EligibilityCap has store {
        kind: u8,
        provider_package: address,
        provider_module: String,
        evaluator_function: String,
        deprecated: bool,
    }

    public struct WeightCap has store {
        kind: u8,
        provider_package: address,
        provider_module: String,
        evaluator_function: String,
        deprecated: bool,
    }

    public struct TallyCap has store {
        kind: u8,
        provider_package: address,
        provider_module: String,
        compute_function: String,
        verify_function: String,
        deprecated: bool,
    }

    // ── Registry (shared singleton) ───────────────────────────────────────────

    public struct ExtensionRegistry has key {
        id: UID,
        // admin field removed; use AdminCap pattern
        eligibility: Table<u8, EligibilityCap>,
        weights: Table<u8, WeightCap>,
        methods: Table<u8, TallyCap>,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin: address,
    }

    public struct EligibilityRegistered has copy, drop {
        kind: u8,
        provider_package: address,
        provider_module: String,
        evaluator_function: String,
        curated: bool,
    }

    public struct WeightRegistered has copy, drop {
        kind: u8,
        provider_package: address,
        provider_module: String,
        evaluator_function: String,
        curated: bool,
    }

    public struct MethodRegistered has copy, drop {
        kind: u8,
        provider_package: address,
        provider_module: String,
        compute_function: String,
        verify_function: String,
        curated: bool,
    }

    public struct ProviderDeprecated has copy, drop {
        family: u8,           // 0=eligibility 1=weight 2=method
        kind: u8,
        by: address,
    }

    public struct AdminCapMinted has copy, drop {
        registry_id: ID,
        admin_cap_id: ID,
        initial_admin: address,
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    /// Create and share the ExtensionRegistry. Also mints an AdminCap for the deployer.
    public fun create_registry(ctx: &mut TxContext) {
        let uid = object::new(ctx);
        let registry_id = object::uid_to_inner(&uid);
        let admin = ctx.sender();

        let cap_uid = object::new(ctx);
        let admin_cap_id = object::uid_to_inner(&cap_uid);
        transfer::transfer(AdminCap { id: cap_uid, registry_id }, admin);

        event::emit(RegistryCreated { registry_id, admin });
        event::emit(AdminCapMinted { registry_id, admin_cap_id, initial_admin: admin });

        transfer::share_object(ExtensionRegistry {
            id: uid,
            eligibility: table::new(ctx),
            weights: table::new(ctx),
            methods: table::new(ctx),
        });
    }

    // ── Registration entry points ─────────────────────────────────────────────

    /// Register a built-in or curated eligibility provider.
    /// Admin only (pass AdminCap); covers kinds 0–191.
    /// Self-registered providers (kinds 192–255) use `self_register_eligibility`.
    public fun register_eligibility(
        admin_cap: &AdminCap,
        registry: &mut ExtensionRegistry,
        kind: u8,
        provider_package: address,
        provider_module: vector<u8>,
        evaluator_function: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        assert!(admin_cap.registry_id == object::id(registry), E_NOT_ADMIN);
        assert!(kind <= KIND_CURATED_MAX, E_RESERVED_KIND);
        assert!(!table::contains(&registry.eligibility, kind), E_KIND_ALREADY_USED);

        let pmod = string::utf8(provider_module);
        let pfn  = string::utf8(evaluator_function);

        table::add(&mut registry.eligibility, kind, EligibilityCap {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            deprecated: false,
        });

        let curated = kind >= KIND_CURATED_MIN;
        event::emit(EligibilityRegistered {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            curated,
        });
    }

    /// Self-register an eligibility provider in the self-managed range (192–255).
    /// First-come-first-served. Admin can later mark as deprecated if abused.
    public fun self_register_eligibility(
        registry: &mut ExtensionRegistry,
        kind: u8,
        provider_package: address,
        provider_module: vector<u8>,
        evaluator_function: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        assert!(kind >= KIND_SELF_MIN, E_KIND_OUT_OF_RANGE);
        assert!(!table::contains(&registry.eligibility, kind), E_KIND_ALREADY_USED);

        let pmod = string::utf8(provider_module);
        let pfn  = string::utf8(evaluator_function);

        table::add(&mut registry.eligibility, kind, EligibilityCap {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            deprecated: false,
        });
        event::emit(EligibilityRegistered {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            curated: false,
        });
    }

    public fun register_weight(
        admin_cap: &AdminCap,
        registry: &mut ExtensionRegistry,
        kind: u8,
        provider_package: address,
        provider_module: vector<u8>,
        evaluator_function: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        assert!(admin_cap.registry_id == object::id(registry), E_NOT_ADMIN);
        assert!(kind <= KIND_CURATED_MAX, E_RESERVED_KIND);
        assert!(!table::contains(&registry.weights, kind), E_KIND_ALREADY_USED);

        let pmod = string::utf8(provider_module);
        let pfn  = string::utf8(evaluator_function);

        table::add(&mut registry.weights, kind, WeightCap {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            deprecated: false,
        });
        let curated = kind >= KIND_CURATED_MIN;
        event::emit(WeightRegistered {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            curated,
        });
    }

    public fun self_register_weight(
        registry: &mut ExtensionRegistry,
        kind: u8,
        provider_package: address,
        provider_module: vector<u8>,
        evaluator_function: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        assert!(kind >= KIND_SELF_MIN, E_KIND_OUT_OF_RANGE);
        assert!(!table::contains(&registry.weights, kind), E_KIND_ALREADY_USED);
        let pmod = string::utf8(provider_module);
        let pfn  = string::utf8(evaluator_function);
        table::add(&mut registry.weights, kind, WeightCap {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            deprecated: false,
        });
        event::emit(WeightRegistered {
            kind,
            provider_package,
            provider_module: pmod,
            evaluator_function: pfn,
            curated: false,
        });
    }

    public fun register_method(
        admin_cap: &AdminCap,
        registry: &mut ExtensionRegistry,
        kind: u8,
        provider_package: address,
        provider_module: vector<u8>,
        compute_function: vector<u8>,
        verify_function: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        assert!(admin_cap.registry_id == object::id(registry), E_NOT_ADMIN);
        assert!(kind <= KIND_CURATED_MAX, E_RESERVED_KIND);
        assert!(!table::contains(&registry.methods, kind), E_KIND_ALREADY_USED);
        let pmod = string::utf8(provider_module);
        let cfn  = string::utf8(compute_function);
        let vfn  = string::utf8(verify_function);
        table::add(&mut registry.methods, kind, TallyCap {
            kind,
            provider_package,
            provider_module: pmod,
            compute_function: cfn,
            verify_function: vfn,
            deprecated: false,
        });
        let curated = kind >= KIND_CURATED_MIN;
        event::emit(MethodRegistered {
            kind,
            provider_package,
            provider_module: pmod,
            compute_function: cfn,
            verify_function: vfn,
            curated,
        });
    }

    public fun self_register_method(
        registry: &mut ExtensionRegistry,
        kind: u8,
        provider_package: address,
        provider_module: vector<u8>,
        compute_function: vector<u8>,
        verify_function: vector<u8>,
        _ctx: &mut TxContext,
    ) {
        assert!(kind >= KIND_SELF_MIN, E_KIND_OUT_OF_RANGE);
        assert!(!table::contains(&registry.methods, kind), E_KIND_ALREADY_USED);
        let pmod = string::utf8(provider_module);
        let cfn  = string::utf8(compute_function);
        let vfn  = string::utf8(verify_function);
        table::add(&mut registry.methods, kind, TallyCap {
            kind,
            provider_package,
            provider_module: pmod,
            compute_function: cfn,
            verify_function: vfn,
            deprecated: false,
        });
        event::emit(MethodRegistered {
            kind,
            provider_package,
            provider_module: pmod,
            compute_function: cfn,
            verify_function: vfn,
            curated: false,
        });
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public fun deprecate_eligibility(
        admin_cap: &AdminCap,
        registry: &mut ExtensionRegistry,
        kind: u8,
        ctx: &mut TxContext,
    ) {
        assert!(admin_cap.registry_id == object::id(registry), E_NOT_ADMIN);
        assert!(table::contains(&registry.eligibility, kind), E_KIND_NOT_REGISTERED);
        let cap = table::borrow_mut(&mut registry.eligibility, kind);
        cap.deprecated = true;
        event::emit(ProviderDeprecated { family: 0, kind, by: ctx.sender() });
    }

    public fun deprecate_weight(
        admin_cap: &AdminCap,
        registry: &mut ExtensionRegistry,
        kind: u8,
        ctx: &mut TxContext,
    ) {
        assert!(admin_cap.registry_id == object::id(registry), E_NOT_ADMIN);
        assert!(table::contains(&registry.weights, kind), E_KIND_NOT_REGISTERED);
        let cap = table::borrow_mut(&mut registry.weights, kind);
        cap.deprecated = true;
        event::emit(ProviderDeprecated { family: 1, kind, by: ctx.sender() });
    }

    public fun deprecate_method(
        admin_cap: &AdminCap,
        registry: &mut ExtensionRegistry,
        kind: u8,
        ctx: &mut TxContext,
    ) {
        assert!(admin_cap.registry_id == object::id(registry), E_NOT_ADMIN);
        assert!(table::contains(&registry.methods, kind), E_KIND_NOT_REGISTERED);
        let cap = table::borrow_mut(&mut registry.methods, kind);
        cap.deprecated = true;
        event::emit(ProviderDeprecated { family: 2, kind, by: ctx.sender() });
    }
    // Note: set_admin removed. Transfer AdminCap object to the new admin directly.

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun has_eligibility(reg: &ExtensionRegistry, kind: u8): bool {
        table::contains(&reg.eligibility, kind)
    }
    public fun has_weight(reg: &ExtensionRegistry, kind: u8): bool {
        table::contains(&reg.weights, kind)
    }
    public fun has_method(reg: &ExtensionRegistry, kind: u8): bool {
        table::contains(&reg.methods, kind)
    }

    public fun eligibility_provider_package(reg: &ExtensionRegistry, kind: u8): address {
        table::borrow(&reg.eligibility, kind).provider_package
    }
    public fun weight_provider_package(reg: &ExtensionRegistry, kind: u8): address {
        table::borrow(&reg.weights, kind).provider_package
    }
    public fun method_provider_package(reg: &ExtensionRegistry, kind: u8): address {
        table::borrow(&reg.methods, kind).provider_package
    }

    public fun eligibility_is_deprecated(reg: &ExtensionRegistry, kind: u8): bool {
        table::borrow(&reg.eligibility, kind).deprecated
    }
    public fun weight_is_deprecated(reg: &ExtensionRegistry, kind: u8): bool {
        table::borrow(&reg.weights, kind).deprecated
    }
    public fun method_is_deprecated(reg: &ExtensionRegistry, kind: u8): bool {
        table::borrow(&reg.methods, kind).deprecated
    }

    // ── Range helpers (public for plugin authors) ─────────────────────────────

    public fun is_builtin_kind(kind: u8): bool { kind <= KIND_BUILTIN_MAX }
    public fun is_reserved_kind(kind: u8): bool { kind > KIND_BUILTIN_MAX && kind <= KIND_RESERVED_MAX }
    public fun is_curated_kind(kind: u8): bool { kind >= KIND_CURATED_MIN && kind <= KIND_CURATED_MAX }
    public fun is_self_kind(kind: u8): bool { kind >= KIND_SELF_MIN }
}
