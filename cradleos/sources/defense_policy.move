/// CradleOS – Defense Policy
///
/// Each tribe vault can have one TribeDefensePolicy that encodes:
///   • Per-tribe diplomatic relations (friendly / hostile) keyed by tribe_id (u32).
///   • An `enforce` flag: when true, members are expected to apply the policy to
///     their turrets; when false, it is advisory.
///   • A monotonic `version` counter so member dApps can detect stale configs.
///
/// PassageLog (one per vault) records turret proximity events reported by members.
/// Entries are stored as dynamic fields indexed by u64 counter (no vector cap).
/// The intel feed is driven by PassageLogged events readable off-chain.
module cradleos::defense_policy {
    use sui::event;
    use sui::table::{Self, Table};
    use sui::dynamic_field as df;
    use std::string::{Self, String};
    use cradleos::tribe_vault::TribeVault;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:        u64 = 0;
    const ENotMember:         u64 = 1;
    const EAlreadyExists:     u64 = 2;

    // ── Relation constants ────────────────────────────────────────────────────

    const HOSTILE:  u8 = 0;
    const FRIENDLY: u8 = 1;

    // ── Security level constants ──────────────────────────────────────────────
    /// GREEN  (1): Reactive — weapons arm only against detected aggressors.
    /// YELLOW (2): Active   — weapons arm against blacklisted tribes on approach.
    /// RED    (3): Lockdown — weapons arm against all non-tribe personnel.
    const SEC_GREEN:  u8 = 1;
    const SEC_YELLOW: u8 = 2;
    const SEC_RED:    u8 = 3;

    // ── Dynamic field key types ───────────────────────────────────────────────
    /// Stored on TribeDefensePolicy via dynamic field.
    public struct SecurityLevelKey  has copy, drop, store {}
    /// Stored on TribeDefensePolicy via dynamic field.
    /// When true, turrets only arm after observing a confirmed aggression event.
    public struct AggressionModeKey has copy, drop, store {}

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One per TribeVault. Encodes diplomatic relations + enforcement flag.
    public struct TribeDefensePolicy has key {
        id: UID,
        /// The vault this policy is bound to.
        vault_id: ID,
        /// When true, members should apply this policy to their turrets.
        enforce: bool,
        /// tribe_id → FRIENDLY (1) or HOSTILE (0).
        relations: Table<u32, u8>,
        /// Incremented on every mutation. Members compare against cached value.
        version: u64,
    }

    /// Shared. Append-only passage/proximity intel log for one tribe.
    public struct PassageLog has key {
        id: UID,
        vault_id: ID,
        entry_count: u64,
    }

    /// Stored as a dynamic field on PassageLog keyed by entry index (u64).
    public struct PassageEntry has store, drop, copy {
        turret_id: address,
        reporter: address,
        /// The entity (character/structure) that was observed nearby.
        entity_id: address,
        /// Note or tag left by the reporter (e.g. "hostile capital ship").
        note: String,
        timestamp_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct PolicyCreated has copy, drop {
        policy_id: ID,
        vault_id: ID,
        founder: address,
    }

    public struct PlayerRelationSet has copy, drop {
        vault_id: ID,
        player: address,
        value: u8,   // 0=hostile 1=friendly
        set_by: address,
    }

    public struct RelationChanged has copy, drop {
        policy_id: ID,
        tribe_id: u32,
        relation: u8,   // 0=hostile 1=friendly
        changed_by: address,
        version: u64,
    }

    public struct EnforceToggled has copy, drop {
        policy_id: ID,
        enforce: bool,
        changed_by: address,
    }

    public struct SecurityLevelSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        level: u8,          // 1=GREEN 2=YELLOW 3=RED
        changed_by: address,
        version: u64,
    }

    public struct AggressionModeSet has copy, drop {
        policy_id: ID,
        vault_id: ID,
        enabled: bool,
        changed_by: address,
        version: u64,
    }

    public struct PassageLogged has copy, drop {
        log_id: ID,
        vault_id: ID,
        entry_index: u64,
        turret_id: address,
        reporter: address,
        entity_id: address,
        note: String,
        timestamp_ms: u64,
    }

    // ── Policy lifecycle ──────────────────────────────────────────────────────

    /// Create and share a TribeDefensePolicy + PassageLog for a vault.
    /// Only the vault founder may call this.
    entry fun create_policy_entry(
        vault: &TribeVault,
        ctx: &mut TxContext,
    ) {
        let founder = ctx.sender();
        assert!(founder == cradleos::tribe_vault::founder(vault), ENotFounder);

        let vault_id = object::id(vault);

        let policy_uid = object::new(ctx);
        let policy_id  = object::uid_to_inner(&policy_uid);
        event::emit(PolicyCreated { policy_id, vault_id, founder });

        transfer::share_object(TribeDefensePolicy {
            id: policy_uid,
            vault_id,
            enforce: false,
            relations: table::new(ctx),
            version: 0,
        });

        // Create the companion PassageLog
        transfer::share_object(PassageLog {
            id: object::new(ctx),
            vault_id,
            entry_count: 0,
        });
    }

    // ── Leadership: relation management ──────────────────────────────────────

    /// Set a tribe's diplomatic stance. Overwrites existing entry if present.
    /// Only the vault founder may call.
    entry fun set_relation_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        tribe_id: u32,
        friendly: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == policy.vault_id, ENotFounder);

        let rel = if (friendly) { FRIENDLY } else { HOSTILE };
        if (table::contains(&policy.relations, tribe_id)) {
            *table::borrow_mut(&mut policy.relations, tribe_id) = rel;
        } else {
            table::add(&mut policy.relations, tribe_id, rel);
        };
        policy.version = policy.version + 1;

        event::emit(RelationChanged {
            policy_id: object::uid_to_inner(&policy.id),
            tribe_id,
            relation: rel,
            changed_by: ctx.sender(),
            version: policy.version,
        });
    }

    /// Batch-set multiple tribe relations in one transaction.
    /// tribe_ids and friendlies must be the same length.
    entry fun set_relations_batch_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        tribe_ids: vector<u32>,
        friendlies: vector<bool>,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == policy.vault_id, ENotFounder);
        let len = tribe_ids.length();
        assert!(friendlies.length() == len, ENotFounder);
        let mut i = 0;
        while (i < len) {
            let tribe_id = *tribe_ids.borrow(i);
            let friendly = *friendlies.borrow(i);
            let rel = if (friendly) { FRIENDLY } else { HOSTILE };
            if (table::contains(&policy.relations, tribe_id)) {
                *table::borrow_mut(&mut policy.relations, tribe_id) = rel;
            } else {
                table::add(&mut policy.relations, tribe_id, rel);
            };
            event::emit(RelationChanged {
                policy_id: object::uid_to_inner(&policy.id),
                tribe_id,
                relation: rel,
                changed_by: ctx.sender(),
                version: policy.version + (i as u64) + 1,
            });
            i = i + 1;
        };
        policy.version = policy.version + (len as u64);
    }

    /// Toggle the enforcement flag.
    entry fun set_enforce_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        enforce: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == policy.vault_id, ENotFounder);
        policy.enforce = enforce;
        event::emit(EnforceToggled {
            policy_id: object::uid_to_inner(&policy.id),
            enforce,
            changed_by: ctx.sender(),
        });
    }

    // ── Members: passage / proximity logging ─────────────────────────────────

    /// Any wallet may log a passage event (turret proximity report).
    /// Used by tribe members to feed the intel log.
    entry fun log_passage_entry(
        log: &mut PassageLog,
        turret_id: address,
        entity_id: address,
        note: vector<u8>,
        timestamp_ms: u64,
        ctx: &mut TxContext,
    ) {
        let reporter = ctx.sender();
        let entry_index = log.entry_count;
        let entry = PassageEntry {
            turret_id,
            reporter,
            entity_id,
            note: string::utf8(note),
            timestamp_ms,
        };
        df::add(&mut log.id, entry_index, entry);
        log.entry_count = entry_index + 1;

        event::emit(PassageLogged {
            log_id: object::uid_to_inner(&log.id),
            vault_id: log.vault_id,
            entry_index,
            turret_id,
            reporter,
            entity_id,
            note: string::utf8(note),
            timestamp_ms,
        });
    }

    // ── Leadership: security protocol ────────────────────────────────────────

    /// Set the turret security protocol level.
    ///   1 = GREEN  — reactive, arm only against confirmed aggressors
    ///   2 = YELLOW — active, arm against blacklisted (HOSTILE) tribes on approach
    ///   3 = RED    — lockdown, arm against all non-tribe personnel
    /// Only the vault founder may call.
    entry fun set_security_level_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        level: u8,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == policy.vault_id, ENotFounder);
        assert!(level >= SEC_GREEN && level <= SEC_RED, ENotFounder);
        if (df::exists_(&policy.id, SecurityLevelKey {})) {
            *df::borrow_mut(&mut policy.id, SecurityLevelKey {}) = level;
        } else {
            df::add(&mut policy.id, SecurityLevelKey {}, level);
        };
        policy.version = policy.version + 1;
        event::emit(SecurityLevelSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            level,
            changed_by: ctx.sender(),
            version: policy.version,
        });
    }

    /// Toggle aggression-only mode.
    /// When enabled, turrets do not act until a PassageLogged event records
    /// hostile contact — they observe first, then arm according to the security level.
    /// Only the vault founder may call.
    entry fun set_aggression_mode_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        enabled: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == policy.vault_id, ENotFounder);
        if (df::exists_(&policy.id, AggressionModeKey {})) {
            *df::borrow_mut(&mut policy.id, AggressionModeKey {}) = enabled;
        } else {
            df::add(&mut policy.id, AggressionModeKey {}, enabled);
        };
        policy.version = policy.version + 1;
        event::emit(AggressionModeSet {
            policy_id: object::uid_to_inner(&policy.id),
            vault_id: policy.vault_id,
            enabled,
            changed_by: ctx.sender(),
            version: policy.version,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id(p: &TribeDefensePolicy): ID      { p.vault_id }
    public fun enforce(p: &TribeDefensePolicy): bool     { p.enforce }
    public fun version(p: &TribeDefensePolicy): u64      { p.version }
    public fun entry_count(l: &PassageLog): u64          { l.entry_count }

    public fun get_relation(p: &TribeDefensePolicy, tribe_id: u32): u8 {
        if (table::contains(&p.relations, tribe_id)) {
            *table::borrow(&p.relations, tribe_id)
        } else {
            HOSTILE // default: treat unknown tribes as hostile
        }
    }

    public fun is_friendly(p: &TribeDefensePolicy, tribe_id: u32): bool {
        get_relation(p, tribe_id) == FRIENDLY
    }

    /// Returns current security level (1=GREEN, 2=YELLOW, 3=RED). Defaults to GREEN.
    public fun security_level(p: &TribeDefensePolicy): u8 {
        if (df::exists_(&p.id, SecurityLevelKey {})) {
            *df::borrow(&p.id, SecurityLevelKey {})
        } else { SEC_GREEN }
    }

    /// Returns whether aggression-detection mode is active. Defaults to false.
    public fun aggression_mode(p: &TribeDefensePolicy): bool {
        if (df::exists_(&p.id, AggressionModeKey {})) {
            *df::borrow(&p.id, AggressionModeKey {})
        } else { false }
    }

    // ── Player-level relations (added v13 via dynamic fields) ─────────────────

    /// Key for per-player relation dynamic field (by wallet address).
    public struct PlayerRelationKey has copy, drop, store { player: address }

    /// Key for per-character hostile flag (by in-game character_id u32).
    /// Used by turret extension to override same-tribe protection for specific characters.
    public struct HostileCharacterKey has copy, drop, store { character_id: u32 }

    /// Set a per-player relation on an existing TribeDefensePolicy.
    /// value: 1 = FRIENDLY, 0 = HOSTILE
    public entry fun set_player_relation_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        player: address,
        value: u8,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::founder;
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), 1);
        assert!(object::id(vault) == policy.vault_id, 2);
        assert!(value == 0 || value == 1, 3);

        let key = PlayerRelationKey { player };
        if (df::exists_(&policy.id, key)) {
            *df::borrow_mut<PlayerRelationKey, u8>(&mut policy.id, key) = value;
        } else {
            df::add(&mut policy.id, key, value);
        };
        policy.version = policy.version + 1;

        event::emit(PlayerRelationSet {
            vault_id: policy.vault_id,
            player,
            value,
            set_by: caller,
        });
    }

    // ── Character-level hostile flags (for turret same-tribe override) ─────

    public struct HostileCharacterSet has copy, drop {
        vault_id: ID,
        character_id: u32,
        hostile: bool,
        set_by: address,
    }

    /// Mark an in-game character_id as hostile (true) or clear the flag (false).
    /// When hostile, turrets will fire on this character even if same-tribe.
    public entry fun set_hostile_character_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        character_id: u32,
        hostile: bool,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::founder;
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), 1);
        assert!(object::id(vault) == policy.vault_id, 2);

        let key = HostileCharacterKey { character_id };
        if (hostile) {
            if (df::exists_(&policy.id, key)) {
                *df::borrow_mut<HostileCharacterKey, bool>(&mut policy.id, key) = true;
            } else {
                df::add(&mut policy.id, key, true);
            };
        } else {
            // Clear the flag
            if (df::exists_(&policy.id, key)) {
                df::remove<HostileCharacterKey, bool>(&mut policy.id, key);
            };
        };
        policy.version = policy.version + 1;

        event::emit(HostileCharacterSet {
            vault_id: policy.vault_id,
            character_id,
            hostile,
            set_by: caller,
        });
    }

    /// Batch-set multiple character hostile flags in one transaction.
    public entry fun set_hostile_characters_batch_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        character_ids: vector<u32>,
        hostile_flags: vector<bool>,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::founder;
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), 1);
        assert!(object::id(vault) == policy.vault_id, 2);
        let len = character_ids.length();
        assert!(hostile_flags.length() == len, 3);

        let mut i = 0;
        while (i < len) {
            let character_id = *character_ids.borrow(i);
            let hostile = *hostile_flags.borrow(i);
            let key = HostileCharacterKey { character_id };
            if (hostile) {
                if (df::exists_(&policy.id, key)) {
                    *df::borrow_mut<HostileCharacterKey, bool>(&mut policy.id, key) = true;
                } else {
                    df::add(&mut policy.id, key, true);
                };
            } else {
                if (df::exists_(&policy.id, key)) {
                    df::remove<HostileCharacterKey, bool>(&mut policy.id, key);
                };
            };

            event::emit(HostileCharacterSet {
                vault_id: policy.vault_id,
                character_id,
                hostile,
                set_by: caller,
            });
            i = i + 1;
        };
        policy.version = policy.version + (len as u64);
    }

    /// Check if a character_id is flagged as hostile in this policy.
    public fun is_hostile_character(p: &TribeDefensePolicy, character_id: u32): bool {
        let key = HostileCharacterKey { character_id };
        if (df::exists_(&p.id, key)) {
            *df::borrow(&p.id, key)
        } else {
            false
        }
    }

    /// Remove a per-player relation (resets to default/tribe-based behavior).
    public entry fun remove_player_relation_entry(
        policy: &mut TribeDefensePolicy,
        vault: &TribeVault,
        player: address,
        ctx: &mut TxContext,
    ) {
        use cradleos::tribe_vault::founder;
        let caller = tx_context::sender(ctx);
        assert!(caller == founder(vault), 1);
        assert!(object::id(vault) == policy.vault_id, 2);

        let key = PlayerRelationKey { player };
        if (df::exists_(&policy.id, key)) {
            df::remove<PlayerRelationKey, u8>(&mut policy.id, key);
            policy.version = policy.version + 1;
        };
    }

}