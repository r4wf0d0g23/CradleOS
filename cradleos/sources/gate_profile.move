/// CradleOS – Gate Profile
///
/// Tribes publish gate command profiles as public on-chain declarations.
/// Gate *linking* (physically connecting star systems) is CCP-admin-only.
/// This module is an INTENT + DISPLAY system: founders declare what they want
/// their gates to do; members coordinate manually using this data as policy.
///
/// GateProfile (shared, one per tribe vault):
///   • access_policy: who the tribe intends to allow through
///   • toll_fee: suggested gate fee (0 = free passage)
///   • notes: free-text description of the gate stance
///   • whitelist: tribe IDs explicitly allowed (used when policy = WHITELIST)
///   • version: monotonic counter incremented on every update
module cradleos::gate_profile {
    use sui::event;
    use sui::clock::Clock;
    use std::string::String;
    use cradleos::tribe_vault::TribeVault;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:      u64 = 0;
    const EAlreadyExists:   u64 = 1;
    const EInvalidPolicy:   u64 = 2;

    // ── Access policy constants ───────────────────────────────────────────────

    /// Any pilot may pass through the gate (open transit).
    const ACCESS_OPEN:       u8 = 0;
    /// Only members of this tribe may pass.
    const ACCESS_TRIBE_ONLY: u8 = 1;
    /// Only tribe IDs listed in the whitelist may pass.
    const ACCESS_WHITELIST:  u8 = 2;
    /// Gate is declared locked; nobody passes (hostile posture).
    const ACCESS_CLOSED:     u8 = 3;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One per TribeVault. Encodes this tribe's gate intent.
    public struct GateProfile has key {
        id: UID,
        /// The vault this profile is bound to.
        vault_id: ID,
        /// Access policy: 0=OPEN, 1=TRIBE_ONLY, 2=WHITELIST, 3=CLOSED
        access_policy: u8,
        /// Suggested fee per transit (0 = free). Denomination determined by convention.
        toll_fee: u64,
        /// Human-readable gate policy description.
        notes: String,
        /// Tribe IDs allowed through when access_policy == ACCESS_WHITELIST.
        whitelist: vector<u32>,
        /// Incremented on every mutation. Consumers compare against cached value.
        version: u64,
        /// Timestamp (ms) of the last update.
        updated_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct GateProfileCreated has copy, drop {
        profile_id: ID,
        vault_id:   ID,
        founder:    address,
    }

    public struct GateProfileUpdated has copy, drop {
        profile_id:    ID,
        vault_id:      ID,
        access_policy: u8,
        toll_fee:      u64,
        version:       u64,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create and share a GateProfile for a vault.
    /// Only the vault founder may call this.
    entry fun create_profile_entry(
        vault: &TribeVault,
        notes: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let founder = ctx.sender();
        assert!(founder == cradleos::tribe_vault::founder(vault), ENotFounder);

        let vault_id = object::id(vault);

        let profile_uid = object::new(ctx);
        let profile_id  = object::uid_to_inner(&profile_uid);

        event::emit(GateProfileCreated { profile_id, vault_id, founder });

        transfer::share_object(GateProfile {
            id: profile_uid,
            vault_id,
            access_policy: ACCESS_OPEN,
            toll_fee: 0,
            notes: std::string::utf8(notes),
            whitelist: vector::empty(),
            version: 0,
            updated_ms: clock.timestamp_ms(),
        });
    }

    // ── Founder: policy management ────────────────────────────────────────────

    /// Update access policy, toll, and notes in a single call.
    /// Increments version and emits GateProfileUpdated.
    entry fun set_access_policy_entry(
        profile: &mut GateProfile,
        vault: &TribeVault,
        access_policy: u8,
        toll_fee: u64,
        notes: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == profile.vault_id, ENotFounder);
        assert!(access_policy <= ACCESS_CLOSED, EInvalidPolicy);

        profile.access_policy = access_policy;
        profile.toll_fee = toll_fee;
        profile.notes = std::string::utf8(notes);
        profile.version = profile.version + 1;
        profile.updated_ms = clock.timestamp_ms();

        event::emit(GateProfileUpdated {
            profile_id: object::uid_to_inner(&profile.id),
            vault_id:   profile.vault_id,
            access_policy,
            toll_fee,
            version: profile.version,
        });
    }

    /// Add a tribe ID to the whitelist.
    /// Silently skips duplicates.
    entry fun add_to_whitelist_entry(
        profile: &mut GateProfile,
        vault: &TribeVault,
        tribe_id: u32,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == profile.vault_id, ENotFounder);

        if (!vector::contains(&profile.whitelist, &tribe_id)) {
            vector::push_back(&mut profile.whitelist, tribe_id);
        };
    }

    /// Remove a tribe ID from the whitelist.
    /// Silently skips if not present.
    entry fun remove_from_whitelist_entry(
        profile: &mut GateProfile,
        vault: &TribeVault,
        tribe_id: u32,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == profile.vault_id, ENotFounder);

        let (found, idx) = vector::index_of(&profile.whitelist, &tribe_id);
        if (found) {
            vector::remove(&mut profile.whitelist, idx);
        };
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id(p: &GateProfile): ID            { p.vault_id }
    public fun access_policy(p: &GateProfile): u8       { p.access_policy }
    public fun toll_fee(p: &GateProfile): u64           { p.toll_fee }
    public fun version(p: &GateProfile): u64            { p.version }
    public fun updated_ms(p: &GateProfile): u64         { p.updated_ms }
    public fun whitelist(p: &GateProfile): &vector<u32> { &p.whitelist }

    public fun is_whitelisted(p: &GateProfile, tribe_id: u32): bool {
        vector::contains(&p.whitelist, &tribe_id)
    }
}
