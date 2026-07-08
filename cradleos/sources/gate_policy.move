/// gate_policy.move
/// Tribe-level gate access control — mirrors defense_policy pattern.
///
/// TribeGatePolicy (shared): founder/admins set access rules.
/// GateDelegation (owned):   members assign their gate SSU IDs to follow the tribe policy.
///
/// Access levels:
///   0 = OPEN       — anyone may pass
///   1 = TRIBE_ONLY — only tribe members (by tribe_id)
///   2 = ALLIES     — tribe members + friendly tribes/players
///   3 = CLOSED     — no one except explicit allowlist
module cradleos::gate_policy {
    use sui::table::{Self, Table};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::clock::Clock;
    use cradleos::tribe_vault::TribeVault;
    // v14: enforcement integration with world::gate. The CradleOSAuth witness
    // is minted via package-internal `cradleos_auth()` from the gate_control
    // module; reused here so a single shared witness covers all gate-side
    // CradleOS enforcement (tribe-policy permits + any future personal-policy
    // permits use the same on-chain extension type, so a gate authorized once
    // works for all CradleOS rule sources).
    use world::gate::{Self, Gate};
    use world::character::Character;

    // ── Access level constants ────────────────────────────────────────────────
    const ACCESS_OPEN:       u8 = 0;
    const ACCESS_TRIBE_ONLY: u8 = 1;
    const ACCESS_ALLIES:     u8 = 2;
    const ACCESS_CLOSED:     u8 = 3;

    // ── Errors ────────────────────────────────────────────────────────────────
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_LEVEL:  u64 = 2;
    const E_WRONG_VAULT:    u64 = 3;
    const E_INVALID_TTL:    u64 = 4;
    /// The source gate is not bound to the policy passed to the permit call.
    /// v3 security fix: without binding, ANY tribe's policy (e.g. one created
    /// with ACCESS_OPEN) could mint permits for ANY enforced gate.
    const E_GATE_NOT_BOUND: u64 = 5;
    /// The OwnerCap presented does not authorize the gate being (un)bound.
    const E_CAP_MISMATCH:   u64 = 6;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One per TribeVault.
    public struct TribeGatePolicy has key {
        id: UID,
        vault_id: ID,
        tribe_id: u32,
        /// Default access level (see constants above).
        access_level: u8,
        /// tribe_id → ALLOW (1) or DENY (0) explicit override
        tribe_overrides: Table<u32, u8>,
        /// Mutation counter for members to detect changes.
        version: u64,
    }

    /// Owned by the member. Links one gate SSU to a tribe policy.
    public struct GateDelegation has key {
        id: UID,
        /// The in-game gate/SSU object ID (as address).
        gate_id: address,
        vault_id: ID,
        tribe_id: u32,
        created_ms: u64,
    }

    // ── Dynamic field keys ────────────────────────────────────────────────────

    /// Per-player override on the gate policy.
    public struct PlayerGateKey has copy, drop, store { player: address }

    /// Dynamic-field key for the policy's configurable permit lifetime (ms).
    /// Stored as a DF because TribeGatePolicy is an existing public struct —
    /// Sui upgrades cannot add fields to it. Absent ⇒ DEFAULT_PERMIT_VALIDITY_MS.
    public struct PermitTtlKey has copy, drop, store {}

    /// v3: Dynamic-field key marking that a specific gate is governed by this
    /// policy. Written only by a holder of the gate's OwnerCap (ownership
    /// proof), consulted by `request_jump_permit_entry` (fail-closed).
    public struct GateBindingKey has copy, drop, store { gate_id: ID }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct GatePolicyCreated has copy, drop {
        policy_id: ID,
        vault_id: ID,
        tribe_id: u32,
        creator: address,
    }

    public struct GateAccessLevelSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        access_level: u8,
        set_by: address,
        version: u64,
    }

    public struct GateTribeOverrideSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        target_tribe_id: u32,
        value: u8,
        set_by: address,
    }

    public struct GatePlayerOverrideSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        player: address,
        value: u8,
        set_by: address,
    }

    public struct GateDelegated has copy, drop {
        delegation_id: ID,
        gate_id: address,
        vault_id: ID,
        tribe_id: u32,
        delegated_by: address,
        created_ms: u64,
    }

    public struct GateDelegationRevoked has copy, drop {
        gate_id: address,
        vault_id: ID,
        revoked_by: address,
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun is_authorized(vault: &TribeVault, caller: address): bool {
        caller == cradleos::tribe_vault::founder(vault)
    }

    // ── Founder / admin entry functions ───────────────────────────────────────

    /// Create gate policy for a vault. Founder only.
    public entry fun create_gate_policy(
        vault: &TribeVault,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::{founder, tribe_id};
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), E_NOT_AUTHORIZED);

        let vid = object::id(vault);
        let tid = tribe_id(vault);
        let policy_uid = object::new(ctx);
        let policy_id = object::uid_to_inner(&policy_uid);

        event::emit(GatePolicyCreated {
            policy_id,
            vault_id: vid,
            tribe_id: tid,
            creator: caller,
        });

        transfer::share_object(TribeGatePolicy {
            id: policy_uid,
            vault_id: vid,
            tribe_id: tid,
            access_level: ACCESS_TRIBE_ONLY, // default: tribe members only
            tribe_overrides: table::new(ctx),
            version: 0,
        });
    }

    /// Set the default access level.
    public entry fun set_access_level(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        level: u8,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        assert!(level <= ACCESS_CLOSED, E_INVALID_LEVEL);

        policy.access_level = level;
        policy.version = policy.version + 1;

        event::emit(GateAccessLevelSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            access_level: level,
            set_by: caller,
            version: policy.version,
        });
    }

    /// Set a tribe-level override (allow or deny a specific tribe).
    public entry fun set_tribe_override(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        target_tribe_id: u32,
        value: u8, // 1=ALLOW 0=DENY
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        assert!(value == 0 || value == 1, E_INVALID_LEVEL);

        if (table::contains(&policy.tribe_overrides, target_tribe_id)) {
            *table::borrow_mut(&mut policy.tribe_overrides, target_tribe_id) = value;
        } else {
            table::add(&mut policy.tribe_overrides, target_tribe_id, value);
        };
        policy.version = policy.version + 1;

        event::emit(GateTribeOverrideSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            target_tribe_id,
            value,
            set_by: caller,
        });
    }

    /// Set a per-player override (allow or deny a specific wallet).
    public entry fun set_player_override(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        player: address,
        value: u8, // 1=ALLOW 0=DENY
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        assert!(value == 0 || value == 1, E_INVALID_LEVEL);

        let key = PlayerGateKey { player };
        if (df::exists_(&policy.id, key)) {
            *df::borrow_mut<PlayerGateKey, u8>(&mut policy.id, key) = value;
        } else {
            df::add(&mut policy.id, key, value);
        };
        policy.version = policy.version + 1;

        event::emit(GatePlayerOverrideSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            player,
            value,
            set_by: caller,
        });
    }

    /// Remove a player override.
    public entry fun remove_player_override(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        player: address,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);

        let key = PlayerGateKey { player };
        if (df::exists_(&policy.id, key)) {
            df::remove<PlayerGateKey, u8>(&mut policy.id, key);
            policy.version = policy.version + 1;
        };
    }

    // ── Member entry functions ────────────────────────────────────────────────

    /// Member delegates their gate to follow the tribe policy.
    /// Returns an owned GateDelegation object.
    public entry fun delegate_gate(
        gate_id: address,
        vault: &TribeVault,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::{tribe_id};
        use sui::clock::timestamp_ms;

        let vid = object::id(vault);
        let tid = tribe_id(vault);
        let now = timestamp_ms(clock);

        let del_uid = object::new(ctx);
        let del_id = object::uid_to_inner(&del_uid);

        event::emit(GateDelegated {
            delegation_id: del_id,
            gate_id,
            vault_id: vid,
            tribe_id: tid,
            delegated_by: tx_context::sender(ctx),
            created_ms: now,
        });

        transfer::transfer(GateDelegation {
            id: del_uid,
            gate_id,
            vault_id: vid,
            tribe_id: tid,
            created_ms: now,
        }, tx_context::sender(ctx));
    }

    /// Member revokes their gate delegation by destroying the object.
    public entry fun revoke_gate_delegation(
        delegation: GateDelegation,
        ctx: &mut TxContext,
    ) {
        let GateDelegation { id, gate_id, vault_id, tribe_id: _, created_ms: _ } = delegation;

        event::emit(GateDelegationRevoked {
            gate_id,
            vault_id,
            revoked_by: tx_context::sender(ctx),
        });

        object::delete(id);
    }

    // ── View functions ────────────────────────────────────────────────────────

    public fun access_level(policy: &TribeGatePolicy): u8 { policy.access_level }
    public fun vault_id(policy: &TribeGatePolicy): ID { policy.vault_id }
    public fun version(policy: &TribeGatePolicy): u64 { policy.version }
    public fun gate_id(del: &GateDelegation): address { del.gate_id }

    // ── v14: character-keyed friendly/hostile overrides (mirrors defense_policy) ──
    //
    // The original gate_policy used wallet-keyed PlayerGateKey<address> for
    // per-player overrides. v13 of defense_policy proved that pattern is
    // structurally unusable for any code path that consults Character objects
    // (Character exposes character_id u32 and tribe u32; wallet address is
    // not directly recoverable on-chain in the world::gate flow). v14
    // mirrors the v13 defense_policy fix here: per-character u32-keyed
    // friendly + hostile overrides, plus an `is_allowed` accessor that
    // composes access_level + tribe_overrides + friendly + hostile into one
    // boolean answer. Enforcement happens via a new entry function
    // `request_jump_permit_entry` that pilots call through the dApp.

    /// Per-character FRIENDLY override key. When set, the character is allowed
    /// regardless of their tribe or the policy's access_level (short of
    /// CLOSED-with-no-explicit-allow). Use this for cross-tribe allies.
    public struct GateFriendlyCharacterKey has copy, drop, store { character_id: u32 }

    /// Per-character HOSTILE override key. When set, the character is BLOCKED
    /// regardless of their tribe or the policy's access_level. Use this for
    /// KOS targets that must never be allowed to transit, even if they're
    /// in an allied tribe or are tribe members themselves.
    public struct GateHostileCharacterKey has copy, drop, store { character_id: u32 }

    public struct GateFriendlyCharacterSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        character_id: u32,
        friendly: bool,
        set_by: address,
    }

    public struct GateHostileCharacterSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        character_id: u32,
        hostile: bool,
        set_by: address,
    }

    /// v3: emitted when a gate owner binds/unbinds their gate to a policy.
    public struct GateBound has copy, drop {
        policy_id: ID,
        gate_id: ID,
        bound_by: address,
        version: u64,
    }

    public struct GateUnbound has copy, drop {
        policy_id: ID,
        gate_id: ID,
        unbound_by: address,
        version: u64,
    }

    /// Emitted whenever a CradleOS-policy permit is issued through this module.
    public struct GatePermitIssued has copy, drop {
        policy_id: ID,
        source_gate_id: ID,
        destination_gate_id: ID,
        character_id: u32,
        character_tribe_id: u32,
        issued_to: address,
    }

    // ── Errors (additive) ─────────────────────────────────────────────────────

    const E_ACCESS_DENIED: u64 = 10;

    // ── Founder: friendly/hostile character overrides ───────────────────────────

    public entry fun set_friendly_character_entry(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        character_id: u32,
        friendly: bool,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);

        let key = GateFriendlyCharacterKey { character_id };
        if (friendly) {
            if (df::exists_(&policy.id, key)) {
                *df::borrow_mut<GateFriendlyCharacterKey, bool>(&mut policy.id, key) = true;
            } else {
                df::add(&mut policy.id, key, true);
            };
        } else if (df::exists_(&policy.id, key)) {
            df::remove<GateFriendlyCharacterKey, bool>(&mut policy.id, key);
        };
        policy.version = policy.version + 1;

        event::emit(GateFriendlyCharacterSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            character_id,
            friendly,
            set_by: caller,
        });
    }

    public entry fun set_friendly_characters_batch_entry(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        character_ids: vector<u32>,
        friendly_flags: vector<bool>,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        let len = character_ids.length();
        assert!(friendly_flags.length() == len, E_INVALID_LEVEL);

        let mut i = 0;
        while (i < len) {
            let cid = *character_ids.borrow(i);
            let f = *friendly_flags.borrow(i);
            let key = GateFriendlyCharacterKey { character_id: cid };
            if (f) {
                if (df::exists_(&policy.id, key)) {
                    *df::borrow_mut<GateFriendlyCharacterKey, bool>(&mut policy.id, key) = true;
                } else {
                    df::add(&mut policy.id, key, true);
                };
            } else if (df::exists_(&policy.id, key)) {
                df::remove<GateFriendlyCharacterKey, bool>(&mut policy.id, key);
            };
            event::emit(GateFriendlyCharacterSet {
                policy_id: object::uid_to_inner(&policy.id),
                vault_id: policy.vault_id,
                character_id: cid,
                friendly: f,
                set_by: caller,
            });
            i = i + 1;
        };
        policy.version = policy.version + (len as u64);
    }

    public entry fun set_hostile_character_entry(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        character_id: u32,
        hostile: bool,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);

        let key = GateHostileCharacterKey { character_id };
        if (hostile) {
            if (df::exists_(&policy.id, key)) {
                *df::borrow_mut<GateHostileCharacterKey, bool>(&mut policy.id, key) = true;
            } else {
                df::add(&mut policy.id, key, true);
            };
        } else if (df::exists_(&policy.id, key)) {
            df::remove<GateHostileCharacterKey, bool>(&mut policy.id, key);
        };
        policy.version = policy.version + 1;

        event::emit(GateHostileCharacterSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            character_id,
            hostile,
            set_by: caller,
        });
    }

    public entry fun set_hostile_characters_batch_entry(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        character_ids: vector<u32>,
        hostile_flags: vector<bool>,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);
        let len = character_ids.length();
        assert!(hostile_flags.length() == len, E_INVALID_LEVEL);

        let mut i = 0;
        while (i < len) {
            let cid = *character_ids.borrow(i);
            let h = *hostile_flags.borrow(i);
            let key = GateHostileCharacterKey { character_id: cid };
            if (h) {
                if (df::exists_(&policy.id, key)) {
                    *df::borrow_mut<GateHostileCharacterKey, bool>(&mut policy.id, key) = true;
                } else {
                    df::add(&mut policy.id, key, true);
                };
            } else if (df::exists_(&policy.id, key)) {
                df::remove<GateHostileCharacterKey, bool>(&mut policy.id, key);
            };
            event::emit(GateHostileCharacterSet {
                policy_id: object::uid_to_inner(&policy.id),
                vault_id: policy.vault_id,
                character_id: cid,
                hostile: h,
                set_by: caller,
            });
            i = i + 1;
        };
        policy.version = policy.version + (len as u64);
    }

    // ── View accessors (used by enforcement + dApp) ───────────────────────────────

    public fun is_friendly_character(p: &TribeGatePolicy, character_id: u32): bool {
        let key = GateFriendlyCharacterKey { character_id };
        if (df::exists_(&p.id, key)) { *df::borrow(&p.id, key) } else { false }
    }

    public fun is_hostile_character(p: &TribeGatePolicy, character_id: u32): bool {
        let key = GateHostileCharacterKey { character_id };
        if (df::exists_(&p.id, key)) { *df::borrow(&p.id, key) } else { false }
    }

    public fun policy_tribe_id(p: &TribeGatePolicy): u32 { p.tribe_id }

    /// Pure access decision combining all rule sources. Returns true if the
    /// given character_id (with tribe character_tribe_id) is allowed to
    /// transit a gate enforced by this policy. Order of precedence:
    ///   1. Hostile character override → always DENY (overrides everything,
    ///      including same-tribe membership).
    ///   2. Friendly character override → always ALLOW (overrides tribe-level
    ///      restrictions short of explicit hostile).
    ///   3. Same tribe as policy owner → ALLOW unless access_level == CLOSED.
    ///   4. Tribe-level override (allow/deny) for character_tribe_id, if set.
    ///   5. access_level fallback: OPEN allows, TRIBE_ONLY/CLOSED/ALLIES deny.
    public fun is_allowed(
        policy: &TribeGatePolicy,
        character_id: u32,
        character_tribe_id: u32,
    ): bool {
        // 1. Hostile character override beats everything.
        if (is_hostile_character(policy, character_id)) return false;
        // 2. Friendly character override beats tribe-level rules.
        if (is_friendly_character(policy, character_id)) return true;
        // 3. Same-tribe membership.
        if (character_tribe_id != 0 && character_tribe_id == policy.tribe_id) {
            return policy.access_level != ACCESS_CLOSED;
        };
        // 4. Tribe-level override.
        if (character_tribe_id != 0 && table::contains(&policy.tribe_overrides, character_tribe_id)) {
            let v = *table::borrow(&policy.tribe_overrides, character_tribe_id);
            return v == 1;
        };
        // 5. Default access_level fallback.
        if (policy.access_level == ACCESS_OPEN) return true;
        // TRIBE_ONLY, ALLIES (without explicit override), and CLOSED all deny
        // here. ALLIES requires the friendly tribe to be in tribe_overrides; if
        // it isn't, default-deny is correct.
        false
    }

    // ── Pilot: request a jump permit through CradleOS policy ──────────────────────
    //
    // Pilots call this to request transit. The contract runs `is_allowed` and
    // either mints a `world::gate::JumpPermit` (transferred to the pilot's
    // character_address by world::gate) or aborts with E_ACCESS_DENIED.
    //
    // The permit is bound to the (source, destination) gate pair and to the
    // pilot's character. It is short-lived under the hood (24h hardcoded
    // window) but the dApp does NOT surface time — from the user perspective
    // either you are allowed or you are not. If a permit expires, the pilot
    // simply re-requests; the access state on chain is what matters, the
    // permit is a cheap implementation detail.
    //
    // Gate must already have CradleOSAuth authorized as its extension type
    // via `cradleos::gate_control::authorize_on_gate` for this to succeed;
    // otherwise `world::gate::issue_jump_permit` aborts EExtensionNotAuthorized.

    /// Default permit lifetime: 24 hours in milliseconds. Gate-policy admins
    /// can override per-policy via `set_permit_ttl` (stored as a dynamic field).
    const PERMIT_VALIDITY_MS: u64 = 86_400_000;
    /// Bounds for the configurable permit lifetime.
    const MIN_PERMIT_TTL_MS: u64 = 300_000;        // 5 minutes
    const MAX_PERMIT_TTL_MS: u64 = 2_592_000_000;  // 30 days

    /// Effective permit lifetime for a policy: the admin-configured override
    /// if present, otherwise the 24h default.
    public fun permit_ttl_ms(policy: &TribeGatePolicy): u64 {
        let key = PermitTtlKey {};
        if (df::exists_(&policy.id, key)) {
            *df::borrow<PermitTtlKey, u64>(&policy.id, key)
        } else {
            PERMIT_VALIDITY_MS
        }
    }

    /// Emitted when an admin sets or clears the permit lifetime override.
    /// ttl_ms is the new EFFECTIVE lifetime (default when cleared).
    public struct GatePermitTtlSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        ttl_ms: u64,
        is_override: bool,
        set_by: address,
        version: u64,
    }

    /// Founder/admin: set how long issued JumpPermits remain valid, in ms.
    /// `ttl_ms = 0` clears the override and reverts to the 24h default.
    /// Otherwise must be within [5 minutes, 30 days].
    public entry fun set_permit_ttl(
        policy: &mut TribeGatePolicy,
        vault: &TribeVault,
        ttl_ms: u64,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(is_authorized(vault, caller), E_NOT_AUTHORIZED);
        assert!(object::id(vault) == policy.vault_id, E_WRONG_VAULT);

        let key = PermitTtlKey {};
        if (ttl_ms == 0) {
            if (df::exists_(&policy.id, key)) {
                df::remove<PermitTtlKey, u64>(&mut policy.id, key);
            };
        } else {
            assert!(ttl_ms >= MIN_PERMIT_TTL_MS && ttl_ms <= MAX_PERMIT_TTL_MS, E_INVALID_TTL);
            if (df::exists_(&policy.id, key)) {
                *df::borrow_mut<PermitTtlKey, u64>(&mut policy.id, key) = ttl_ms;
            } else {
                df::add(&mut policy.id, key, ttl_ms);
            };
        };
        policy.version = policy.version + 1;

        event::emit(GatePermitTtlSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            ttl_ms: permit_ttl_ms(policy),
            is_override: ttl_ms != 0,
            set_by: caller,
            version: policy.version,
        });
    }

    /// v3: is `gate_id` bound to this policy? Public so UIs / other modules
    /// can pre-check transit availability.
    public fun is_gate_bound(policy: &TribeGatePolicy, gate_id: ID): bool {
        df::exists_(&policy.id, GateBindingKey { gate_id })
    }

    /// v3: gate owner binds their gate to this policy. Requires the gate's
    /// OwnerCap as proof of ownership (obtained in-PTB via the standard
    /// Character borrow_owner_cap / return_owner_cap pattern). After binding,
    /// `request_jump_permit_entry` will only mint permits for this gate when
    /// called with THIS policy. Idempotent.
    public entry fun bind_gate(
        policy: &mut TribeGatePolicy,
        gate: &Gate,
        cap: &world::access::OwnerCap<Gate>,
        ctx: &TxContext,
    ) {
        let gate_id = object::id(gate);
        assert!(world::access::is_authorized(cap, gate_id), E_CAP_MISMATCH);
        let key = GateBindingKey { gate_id };
        if (!df::exists_(&policy.id, key)) {
            df::add(&mut policy.id, key, true);
        };
        policy.version = policy.version + 1;
        event::emit(GateBound {
            policy_id: object::uid_to_inner(&policy.id),
            gate_id,
            bound_by: tx_context::sender(ctx),
            version: policy.version,
        });
    }

    /// v3: gate owner unbinds their gate (e.g. moving it under a different
    /// policy). Same OwnerCap proof as bind_gate.
    public entry fun unbind_gate(
        policy: &mut TribeGatePolicy,
        gate: &Gate,
        cap: &world::access::OwnerCap<Gate>,
        ctx: &TxContext,
    ) {
        let gate_id = object::id(gate);
        assert!(world::access::is_authorized(cap, gate_id), E_CAP_MISMATCH);
        let key = GateBindingKey { gate_id };
        if (df::exists_(&policy.id, key)) {
            df::remove<GateBindingKey, bool>(&mut policy.id, key);
        };
        policy.version = policy.version + 1;
        event::emit(GateUnbound {
            policy_id: object::uid_to_inner(&policy.id),
            gate_id,
            unbound_by: tx_context::sender(ctx),
            version: policy.version,
        });
    }

    public entry fun request_jump_permit_entry(
        policy: &TribeGatePolicy,
        source_gate: &Gate,
        destination_gate: &Gate,
        character: &Character,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        use world::character;
        use world::in_game_id;
        use sui::clock::timestamp_ms;

        // v3 SECURITY: the policy must be the one the gate's owner bound to
        // this gate. Without this, any tribe's policy (e.g. self-created with
        // ACCESS_OPEN) could mint permits for any enforced gate. Fail-closed:
        // an enforced gate with no binding cannot mint permits at all until
        // its owner runs bind_gate.
        assert!(is_gate_bound(policy, object::id(source_gate)), E_GATE_NOT_BOUND);

        // Character.key is a TenantItemId; item_id is the u64 in-game id.
        // TargetCandidate.character_id is the u32 downcast in turret-targeting;
        // gate enforcement uses the same u32 width for parity with defense_policy.
        let char_id_u32 = (in_game_id::item_id(&character::key(character)) as u32);
        let tribe = character::tribe(character);

        assert!(is_allowed(policy, char_id_u32, tribe), E_ACCESS_DENIED);

        let expires_at = timestamp_ms(clock) + permit_ttl_ms(policy);
        gate::issue_jump_permit<cradleos::gate_control::CradleOSAuth>(
            source_gate,
            destination_gate,
            character,
            cradleos::gate_control::cradleos_auth(),
            expires_at,
            ctx,
        );

        event::emit(GatePermitIssued {
            policy_id: object::uid_to_inner(&policy.id),
            source_gate_id: object::id(source_gate),
            destination_gate_id: object::id(destination_gate),
            character_id: char_id_u32,
            character_tribe_id: tribe,
            issued_to: character::character_address(character),
        });
    }
}
