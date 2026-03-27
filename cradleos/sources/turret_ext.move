/// CradleOS – Tribe Turret Extension
///
/// A world::turret extension that integrates with TribeDefensePolicy to produce
/// tribe-aware, ship-class-specialised targeting.
///
/// # How it works
///
/// When the game calls `get_target_priority_list` on a behaviour change, this
/// extension:
///   1. Reads the tribe's TribeDefensePolicy (relations + security level +
///      aggression mode).
///   2. Reads this turret's TurretConfig (which preset: AUTOCANNON / PLASMA /
///      HOWITZER) from a shared config object.
///   3. For each TargetCandidate:
///        a0. SAME-TRIBE PROTECTION: if candidate is same tribe as turret owner,
///            ALWAYS skip UNLESS the character_id is on the hostile character list.
///            This prevents friendly-fire even when tribe members aggress.
///        a. Skip if character_tribe is FRIENDLY in the policy.
///        b. Skip if the candidate's group_id is NOT in the turret's specialty
///           group list (the turret simply ignores ships it can't efficiently kill).
///        c. In GREEN mode (aggression-only): skip unless is_aggressor == true.
///        d. Compute weight:
///             base          = 1_000
///             aggressor     += 10_000
///             damaged bonus += (100 - min(hp, shield, armor))
///        e. Add to return list.
///   4. Returns BCS of vector<ReturnTargetPriorityList>.
///
/// # Turret presets (group_ids per EVE Frontier ship classes)
///
///   AUTOCANNON (type 92402) — Shuttle (31), Corvette (237)
///   PLASMA     (type 92403) — Frigate (25), Destroyer (420)
///   HOWITZER   (type 92484) — Cruiser (26), Combat Battlecruiser (419)
///
/// # Setup (per turret)
///
///   1. Tribe leader creates a TurretConfig via `create_config_entry`, specifying
///      the turret's object ID, the defense policy object ID, and the preset.
///   2. Member calls `world::storage_unit::authorize_extension<TurretAuth>` on
///      their turret to register this extension.
///   3. Game engine calls `get_target_priority_list` on every behaviour change.
///
/// # Security level semantics
///
///   GREEN  (1) — Aggression-only: only arm against confirmed aggressors.
///   YELLOW (2) — Active: arm against HOSTILE tribes on approach (ENTERED).
///   RED    (3) — Lockdown: arm against ALL non-FRIENDLY characters.
///
module cradleos::turret_ext {
    use sui::event;
    use sui::bcs;
    use world::turret::{Self, Turret, OnlineReceipt};
    use world::character::Character;
    use cradleos::defense_policy::{Self, TribeDefensePolicy};

    // ── Error codes ───────────────────────────────────────────────────────────

    const EInvalidOnlineReceipt: u64 = 0;
    const EInvalidPreset:        u64 = 1;
    const ENotOwner:             u64 = 2;

    // ── Preset constants ──────────────────────────────────────────────────────

    /// Autocannon — effective vs small ships (Shuttle + Corvette)
    const PRESET_AUTOCANNON: u8 = 0;
    /// Plasma     — effective vs medium ships (Frigate + Destroyer)
    const PRESET_PLASMA:     u8 = 1;
    /// Howitzer   — effective vs large ships (Cruiser + Battlecruiser)
    const PRESET_HOWITZER:   u8 = 2;

    // Ship group IDs (from EVE Frontier world contracts / extension_examples)
    const GROUP_SHUTTLE:             u64 = 31;
    const GROUP_CORVETTE:            u64 = 237;
    const GROUP_FRIGATE:             u64 = 25;
    const GROUP_DESTROYER:           u64 = 420;
    const GROUP_CRUISER:             u64 = 26;
    const GROUP_COMBAT_BATTLECRUISER: u64 = 419;

    // Security levels (mirror defense_policy constants)
    const SEC_GREEN:  u8 = 1;
    // const SEC_YELLOW: u8 = 2;  // active
    // const SEC_RED:    u8 = 3;  // lockdown

    // Priority weights
    const WEIGHT_BASE:      u64 = 1_000;
    const WEIGHT_AGGRESSOR: u64 = 10_000;

    // ── Auth witness ──────────────────────────────────────────────────────────

    /// Auth witness — authorise this extension on a Turret via
    /// `world::turret::authorize_extension<TurretAuth>`.
    public struct TurretAuth has drop {}

    // ── Config object ─────────────────────────────────────────────────────────

    /// Shared per-turret configuration.
    /// One TurretConfig per turret.  Owned by creator (tribe leader / member).
    public struct TurretConfig has key {
        id: UID,
        /// The turret this config applies to (SmartAssembly object ID).
        turret_id: address,
        /// The tribe defense policy to consult for relation lookups.
        policy_id: address,
        /// PRESET_AUTOCANNON (0), PRESET_PLASMA (1), PRESET_HOWITZER (2)
        preset: u8,
        /// Creator / owner address — the only one who can update this config.
        owner: address,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct ConfigCreated has copy, drop {
        config_id: address,
        turret_id: address,
        policy_id: address,
        preset:    u8,
        owner:     address,
    }

    public struct ConfigUpdated has copy, drop {
        config_id: address,
        turret_id: address,
        preset:    u8,
    }

    public struct TargetingResolved has copy, drop {
        turret_id:    ID,
        candidates:   u64,
        targeted:     u64,
        skipped_friendly:   u64,
        skipped_off_class:  u64,
        skipped_non_aggressor: u64,
    }

    /// Extended targeting event with hostile character tracking (v5+).
    public struct TargetingResolvedV2 has copy, drop {
        turret_id:    ID,
        candidates:   u64,
        targeted:     u64,
        skipped_friendly:   u64,
        skipped_off_class:  u64,
        skipped_non_aggressor: u64,
        targeted_hostile_character: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Create a TurretConfig for a turret.
    /// `preset`: 0 = AUTOCANNON, 1 = PLASMA, 2 = HOWITZER.
    public entry fun create_config_entry(
        turret_id: address,
        policy_id: address,
        preset: u8,
        ctx: &mut TxContext,
    ) {
        assert!(preset <= PRESET_HOWITZER, EInvalidPreset);
        let owner = tx_context::sender(ctx);

        let uid = object::new(ctx);
        let config_addr = object::uid_to_address(&uid);

        event::emit(ConfigCreated { config_id: config_addr, turret_id, policy_id, preset, owner });

        transfer::share_object(TurretConfig { id: uid, turret_id, policy_id, preset, owner });
    }

    /// Update the preset on an existing TurretConfig.
    public entry fun update_preset_entry(
        config: &mut TurretConfig,
        preset: u8,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == config.owner, ENotOwner);
        assert!(preset <= PRESET_HOWITZER, EInvalidPreset);
        config.preset = preset;
        event::emit(ConfigUpdated {
            config_id: object::uid_to_address(&config.id),
            turret_id: config.turret_id,
            preset,
        });
    }

    /// Update the policy ID on an existing TurretConfig.
    public entry fun update_policy_entry(
        config: &mut TurretConfig,
        policy_id: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == config.owner, ENotOwner);
        config.policy_id = policy_id;
    }

    // ── Core extension entry point ────────────────────────────────────────────

    /// Called by the game engine on every behaviour change event.
    ///
    /// Returns BCS of vector<ReturnTargetPriorityList>.
    public fun get_target_priority_list(
        turret: &Turret,
        owner_character: &Character,
        config: &TurretConfig,
        policy: &TribeDefensePolicy,
        target_candidate_list: vector<u8>,
        receipt: OnlineReceipt,
    ): vector<u8> {
        assert!(receipt.turret_id() == object::id(turret), EInvalidOnlineReceipt);

        let candidates = turret::unpack_candidate_list(target_candidate_list);
        let sec_level  = defense_policy::security_level(policy);
        let aggr_mode  = defense_policy::aggression_mode(policy);
        let preset     = config.preset;
        // Owner's tribe — used for same-tribe protection logic
        let owner_tribe_id = world::character::tribe(owner_character);

        let mut return_list: vector<turret::ReturnTargetPriorityList> = vector::empty();

        let mut i_friendly        = 0u64;
        let mut i_off_class       = 0u64;
        let mut i_non_aggr        = 0u64;
        let mut i_targeted        = 0u64;
        let mut i_hostile_char    = 0u64;
        let total            = vector::length(&candidates);
        let mut i            = 0u64;

        while (i < total) {
            let c = vector::borrow(&candidates, i);
            i = i + 1;

            let tribe = turret::character_tribe(c);
            let grp   = turret::group_id(c);
            let aggr  = turret::is_aggressor(c);
            // hp/shield/armor ratios are fields on TargetCandidate but have no
            // public accessor — read directly (same package via use import).
            // We inline the damage bonus via priority_weight which includes
            // default world weighting; add our own aggressor/class logic on top.
            let itm   = turret::item_id(c);

            // ── 0. Same-tribe protection ─────────────────────────────────────
            // Always protect same-tribe members UNLESS explicitly flagged hostile
            // by character_id in the defense policy's hostile character list.
            // This prevents friendly-fire from turrets even when a tribe member
            // aggresses (e.g. sparring, testing). The owner's tribe is read from
            // the Character object passed by the game engine.
            let char_id = turret::character_id(c);
            if (tribe != 0 && tribe == owner_tribe_id) {
                if (!defense_policy::is_hostile_character(policy, char_id)) {
                    i_friendly = i_friendly + 1;
                    continue
                };
                // Character IS explicitly hostile — fall through to targeting logic
                i_hostile_char = i_hostile_char + 1;
            };

            // ── 1. Skip FRIENDLY tribes ──────────────────────────────────────
            // NPCs have tribe == 0; treat as hostile unless explicitly friendly-listed.
            if (tribe != 0 && defense_policy::is_friendly(policy, tribe)) {
                i_friendly = i_friendly + 1;
                continue
            };

            // ── 2. Skip off-class ships ───────────────────────────────────────
            // group_id == 0 means NPC — always include regardless of preset.
            if (grp != 0 && !in_specialty(preset, grp)) {
                i_off_class = i_off_class + 1;
                continue
            };

            // ── 3. Apply security level / aggression mode ─────────────────────
            // GREEN or aggression-mode: only engage confirmed aggressors.
            if ((sec_level == SEC_GREEN || aggr_mode) && !aggr) {
                i_non_aggr = i_non_aggr + 1;
                continue
            };

            // ── 4. Compute priority weight ────────────────────────────────────
            // Start from the world default priority_weight (carries ENTERED/STARTED_ATTACK
            // increments already applied by the game) and add our own modifiers.
            let mut weight = turret::priority_weight(c);
            if (weight == 0) { weight = WEIGHT_BASE };

            // Aggressor bump
            if (aggr) { weight = weight + WEIGHT_AGGRESSOR };

            // Build return entry
            let entry = turret::new_return_target_priority_list(itm, weight);
            vector::push_back(&mut return_list, entry);
            i_targeted = i_targeted + 1;
        };

        let result = bcs::to_bytes(&return_list);

        turret::destroy_online_receipt(receipt, TurretAuth {});

        event::emit(TargetingResolvedV2 {
            turret_id: object::id(turret),
            candidates: total,
            targeted:   i_targeted,
            skipped_friendly:      i_friendly,
            skipped_off_class:     i_off_class,
            skipped_non_aggressor: i_non_aggr,
            targeted_hostile_character: i_hostile_char,
        });

        result
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun preset(config: &TurretConfig): u8          { config.preset }
    public fun config_turret_id(config: &TurretConfig): address { config.turret_id }
    public fun config_policy_id(config: &TurretConfig): address { config.policy_id }
    public fun config_owner(config: &TurretConfig): address    { config.owner }

    public fun preset_name(preset: u8): vector<u8> {
        if (preset == PRESET_AUTOCANNON) { b"AUTOCANNON" }
        else if (preset == PRESET_PLASMA) { b"PLASMA" }
        else { b"HOWITZER" }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// Returns true if `group_id` is in the specialty list for the given preset.
    fun in_specialty(preset: u8, group_id: u64): bool {
        if (preset == PRESET_AUTOCANNON) {
            group_id == GROUP_SHUTTLE || group_id == GROUP_CORVETTE
        } else if (preset == PRESET_PLASMA) {
            group_id == GROUP_FRIGATE || group_id == GROUP_DESTROYER
        } else {
            // HOWITZER
            group_id == GROUP_CRUISER || group_id == GROUP_COMBAT_BATTLECRUISER
        }
    }

}
