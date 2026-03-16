/// CradleOS – Gate Control
/// EVE Frontier Smart Gate access control, wired into the world::gate extension API.
///
/// Gate owners authorize CradleOS as the extension type via `authorize_on_gate`.
/// Thereafter, pilots must obtain a world::gate::JumpPermit via `issue_jump_permit`
/// before calling world::gate::jump_with_permit on-chain.
///
/// Membership is verified directly against the EVE Frontier native `tribe_id` field
/// on the world::character::Character object — no separate membership registry needed.
///
/// Extension pattern follows the typed-witness design from world::gate:
///   https://github.com/evefrontier/world-contracts/blob/main/docs/architechture.md
module cradleos::gate_control {
    use sui::event;
    use world::gate::{Self, Gate};
    use world::character::Character;
    use world::access::OwnerCap;

    // ── Auth witness (typed-witness extension pattern) ────────────────────────

    /// Witness type that identifies CradleOS as the gate extension authority.
    /// Only this package can construct it, preventing spoofing.
    public struct CradleOSAuth has drop {}

    /// Package-internal auth minter — restricts permit issuance to this module.
    public(package) fun cradleos_auth(): CradleOSAuth { CradleOSAuth {} }

    // ── Pass-log reason codes ─────────────────────────────────────────────────

    const REASON_MEMBER:  u8 = 0;
    const REASON_BLOCKED: u8 = 1;
    const REASON_DENIED:  u8 = 2;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotOwner:      u64 = 0;
    const EGateNotOwned:  u64 = 1;
    const EPilotBlocked:  u64 = 2;
    const ENotCorpMember: u64 = 3;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Per-gate access policy. `corp_tribe_id` is the EVE Frontier native tribe ID
    /// (corp ID) read from `world::character::Character.tribe_id`. Access is granted
    /// when a pilot's on-chain tribe matches this value.
    public struct GatePolicy has key, store {
        id: UID,
        gate_id: ID,            // On-chain object ID of the target Gate
        corp_tribe_id: u32,     // EVE Frontier corp ID (tribe_id on Character)
        blocked_addresses: vector<address>,
        owner: address,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    /// Emitted on every access decision (permit issued or denied).
    public struct PassLog has copy, drop {
        gate_id: ID,
        pilot: address,
        allowed: bool,
        reason: u8,
    }

    /// Emitted whenever a policy is created or modified.
    public struct PolicyUpdated has copy, drop {
        gate_id: ID,
        corp_tribe_id: u32,
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun contains_addr(vec: &vector<address>, addr: address): bool {
        let len = vector::length(vec);
        let mut i = 0u64;
        while (i < len) {
            if (*vector::borrow(vec, i) == addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // ── Policy management ─────────────────────────────────────────────────────

    /// Creates a gate policy. `ctx.sender()` becomes the policy owner.
    /// `gate_id` is the on-chain object ID of the Gate being controlled.
    /// `corp_tribe_id` is the EVE Frontier tribe ID (corp ID) whose members are granted access.
    public fun create_policy(
        gate_id: ID,
        corp_tribe_id: u32,
        ctx: &mut TxContext,
    ): GatePolicy {
        event::emit(PolicyUpdated { gate_id, corp_tribe_id });
        GatePolicy {
            id: object::new(ctx),
            gate_id,
            corp_tribe_id,
            blocked_addresses: vector::empty<address>(),
            owner: ctx.sender(),
        }
    }

    /// Policy owner adds an address to the blocked list.
    public fun block_address(
        policy: &mut GatePolicy,
        addr: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == policy.owner, ENotOwner);
        if (!contains_addr(&policy.blocked_addresses, addr)) {
            vector::push_back(&mut policy.blocked_addresses, addr);
        };
        event::emit(PolicyUpdated { gate_id: policy.gate_id, corp_tribe_id: policy.corp_tribe_id });
    }

    // ── World integration ─────────────────────────────────────────────────────

    /// Gate owner registers CradleOS as the extension type on their gate.
    /// After this call the gate requires a JumpPermit issued by this module.
    /// `owner_cap` must be the OwnerCap<Gate> for the specific gate being configured.
    public fun authorize_on_gate(
        gate: &mut Gate,
        owner_cap: &OwnerCap<Gate>,
    ) {
        gate::authorize_extension<CradleOSAuth>(gate, owner_cap);
    }

    /// Issue a world::gate::JumpPermit to a pilot who satisfies CradleOS policy.
    ///
    /// Access logic (in order):
    ///   1. Pilot in blocked_addresses → abort EPilotBlocked
    ///   2. character.tribe() == policy.corp_tribe_id → allow (REASON_MEMBER)
    ///   3. Otherwise → abort ENotCorpMember
    ///
    /// On success, calls `world::gate::issue_jump_permit<CradleOSAuth>` which
    /// mints a single-use JumpPermit and transfers it to the character's address.
    /// The character can then call `world::gate::jump_with_permit` to jump.
    public fun issue_jump_permit(
        policy: &GatePolicy,
        source_gate: &Gate,
        destination_gate: &Gate,
        character: &Character,
        expires_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        let pilot = character.character_address();

        // 1. Blocked check
        assert!(!contains_addr(&policy.blocked_addresses, pilot), EPilotBlocked);

        // 2. Corp membership via EVE Frontier native tribe_id
        assert!(character.tribe() == policy.corp_tribe_id, ENotCorpMember);

        // Call world gate extension API — mints JumpPermit and transfers to character
        gate::issue_jump_permit<CradleOSAuth>(
            source_gate,
            destination_gate,
            character,
            cradleos_auth(),
            expires_at_ms,
            ctx,
        );

        event::emit(PassLog { gate_id: policy.gate_id, pilot, allowed: true, reason: REASON_MEMBER });
    }

    // ── Read-only access check (no world gate objects required) ───────────────

    /// Pure policy check without world gate interaction. Emits PassLog.
    /// Caller supplies the pilot's address and their EVE tribe_id for comparison.
    /// Useful for pre-flight validation or off-chain simulation.
    public fun check_access(
        policy: &GatePolicy,
        pilot: address,
        pilot_tribe_id: u32,
    ): bool {
        if (contains_addr(&policy.blocked_addresses, pilot)) {
            event::emit(PassLog { gate_id: policy.gate_id, pilot, allowed: false, reason: REASON_BLOCKED });
            return false
        };

        if (pilot_tribe_id == policy.corp_tribe_id) {
            event::emit(PassLog { gate_id: policy.gate_id, pilot, allowed: true, reason: REASON_MEMBER });
            return true
        };

        event::emit(PassLog { gate_id: policy.gate_id, pilot, allowed: false, reason: REASON_DENIED });
        false
    }

    /// Returns true if the pilot address is on the policy blocked list.
    public fun is_blocked(policy: &GatePolicy, pilot: address): bool {
        contains_addr(&policy.blocked_addresses, pilot)
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public fun gate_id(policy: &GatePolicy): ID        { policy.gate_id }
    public fun corp_tribe_id(policy: &GatePolicy): u32 { policy.corp_tribe_id }
    public fun owner(policy: &GatePolicy): address     { policy.owner }

    // ── Tests ─────────────────────────────────────────────────────────────────
    //
    // Note: world-dependent functions (authorize_on_gate, issue_jump_permit)
    // require Gate / Character objects that can only be created by world admin
    // functions and require on-chain infrastructure. Those paths are tested via
    // integration tests on testnet. The unit tests below cover all CradleOS-
    // specific policy logic independently of the world package.

    #[test_only]
    use sui::test_scenario;

    #[test]
    fun test_create_policy_fields() {
        let owner_addr = @0xF0;
        let gate_id = object::id_from_address(@0xA1);
        let tribe_id = 98000001u32;
        let mut scenario = test_scenario::begin(owner_addr);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let policy = create_policy(gate_id, tribe_id, ctx);
            assert!(policy.gate_id == gate_id, 0);
            assert!(policy.corp_tribe_id == tribe_id, 1);
            assert!(policy.owner == owner_addr, 2);
            std::unit_test::destroy(policy);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_block_address_blocks_pilot() {
        let owner_addr = @0xF0;
        let enemy = @0xEE;
        let gate_id = object::id_from_address(@0xA2);
        let mut scenario = test_scenario::begin(owner_addr);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut policy = create_policy(gate_id, 98000001u32, ctx);
            block_address(&mut policy, enemy, ctx);
            assert!(is_blocked(&policy, enemy) == true, 0);
            assert!(is_blocked(&policy, owner_addr) == false, 1);
            std::unit_test::destroy(policy);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_check_access_tribe_match_passes() {
        let owner_addr = @0xF0;
        let pilot = @0x55;
        let gate_id = object::id_from_address(@0xA3);
        let mut scenario = test_scenario::begin(owner_addr);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let policy = create_policy(gate_id, 98000001u32, ctx);
            // matching tribe → allowed
            assert!(check_access(&policy, pilot, 98000001u32) == true, 0);
            // wrong tribe → denied
            assert!(check_access(&policy, pilot, 12345678u32) == false, 1);
            std::unit_test::destroy(policy);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_check_access_blocked_overrides_tribe_match() {
        let owner_addr = @0xF0;
        let pilot = @0x55;
        let gate_id = object::id_from_address(@0xA4);
        let mut scenario = test_scenario::begin(owner_addr);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let mut policy = create_policy(gate_id, 98000001u32, ctx);
            block_address(&mut policy, pilot, ctx);
            // blocked even if tribe matches
            assert!(check_access(&policy, pilot, 98000001u32) == false, 0);
            std::unit_test::destroy(policy);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotOwner)]
    fun test_non_owner_cannot_block_address() {
        let owner_addr = @0xF0;
        let attacker = @0xBB;
        let enemy = @0xEE;
        let gate_id = object::id_from_address(@0xA5);
        let mut scenario = test_scenario::begin(owner_addr);
        let policy_id;
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let policy = create_policy(gate_id, 98000001u32, ctx);
            policy_id = object::id(&policy);
            transfer::public_share_object(policy);
        };
        test_scenario::next_tx(&mut scenario, attacker);
        {
            let mut policy = test_scenario::take_shared_by_id<GatePolicy>(&scenario, policy_id);
            let ctx = test_scenario::ctx(&mut scenario);
            // attacker is not owner → should abort ENotOwner
            block_address(&mut policy, enemy, ctx);
            test_scenario::return_shared(policy);
        };
        test_scenario::end(scenario);
    }
}
