/// CradleOS – Character Registry
///
/// Proof-based tribe vault ownership. Prevents squatting by requiring vault
/// creators to hold a verified claim for their tribe_id before creating a vault.
///
/// ── Design ───────────────────────────────────────────────────────────────────
///
/// Claim registration (Phase 1 — no off-chain infra required):
///   1. Wallet calls register_claim(tribe_id, character_id)
///      • Stakes their claim at the current epoch.
///      • No on-chain verification of character fields (no world-contracts dep).
///      • First uncontested claim for a tribe_id wins.
///   2. Wallet calls create_vault_with_registry(registry, …)
///      • Gated: caller must be the current claimer for that tribe_id.
///
/// Challenge / takeover (Phase 2 — requires off-chain attestor service):
///   1. Attestor reads CharacterCreatedEvent checkpoint sequences off-chain.
///   2. Attestor calls issue_attestation(beneficiary, tribe_id, char_id, join_epoch).
///   3. Beneficiary calls challenge_and_take_vault(registry, vault, attestation).
///      • Atomic: transfers registry claim AND vault.founder in one tx.
///      • join_epoch must be < current claim_epoch.
///      • Attestation is consumed (deleted) — one-use.
///
/// Claim invalidation:
///   Attestor calls invalidate_claim(tribe_id) if character left tribe / fraud.
///
/// Admin:
///   Admin (deployer initially) can set_attestor to any address.
///   For hackathon: DGX deploy wallet is admin → Raw's wallet is attestor.
///   Post-hackathon: multisig attestor.
///
/// ── Attack surface ────────────────────────────────────────────────────────────
///   • Race condition (two members same epoch): First-to-execute wins.
///     Loser requests attestation and calls challenge_and_take_vault.
///   • Tribe-hop squatter: joins tribe, claims, leaves.
///     Fix: attestor calls invalidate_claim when character.tribe_id no longer matches.
///   • Attestor key compromise: rotate via set_attestor; document risk.
///   • Buy old character for earlier epoch: attestation binds wallet+character+epoch.
///
module cradleos::character_registry {
    use sui::event;
    use sui::table::{Self, Table};
    use cradleos::tribe_vault::{Self, TribeVault};

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotAttestor:    u64 = 0;
    const ENotAdmin:       u64 = 1;
    const ENotBeneficiary: u64 = 2;
    const ENoClaim:        u64 = 3;
    const ENotClaimer:     u64 = 4;
    const EVaultExists:    u64 = 5;
    const ENotEarlier:     u64 = 6;
    const ETribeMismatch:  u64 = 7;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared singleton — one per CradleOS deployment.
    /// Created in init(); admin and trusted_attestor default to deployer.
    public struct CharacterRegistry has key {
        id: UID,
        /// tribe_id → TribeClaim
        claims: Table<u32, TribeClaim>,
        /// Wallet that can mint EpochAttestations and invalidate claims.
        trusted_attestor: address,
        /// Wallet that can update trusted_attestor.
        admin: address,
    }

    /// One per tribe_id. Stored in registry.claims.
    public struct TribeClaim has store {
        /// Wallet holding the claim.
        claimer: address,
        /// Character object ID provided as proof at registration time.
        character_id: address,
        /// Epoch when this claim was registered (tx_context::epoch).
        claim_epoch: u64,
        /// True once create_vault_with_registry has been called for this tribe.
        vault_created: bool,
    }

    /// Owned object minted by trusted_attestor.
    /// Proves a wallet joined a tribe at an earlier epoch than the current claimant.
    /// Consumed (deleted) on use in challenge_and_take_vault.
    public struct EpochAttestation has key, store {
        id: UID,
        /// The wallet this attestation was issued for.
        beneficiary: address,
        tribe_id: u32,
        /// The character object ID that was in the tribe at the attested epoch.
        character_id: address,
        /// Attested join epoch (derived from CharacterCreatedEvent checkpoint off-chain).
        join_epoch: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin: address,
    }

    public struct ClaimRegistered has copy, drop {
        tribe_id: u32,
        claimer: address,
        character_id: address,
        claim_epoch: u64,
    }

    public struct ClaimChallenged has copy, drop {
        tribe_id: u32,
        old_claimer: address,
        new_claimer: address,
        new_epoch: u64,
    }

    public struct ClaimInvalidated has copy, drop {
        tribe_id: u32,
        old_claimer: address,
    }

    public struct AttestationIssued has copy, drop {
        tribe_id: u32,
        beneficiary: address,
        character_id: address,
        join_epoch: u64,
    }

    public struct AttestorUpdated has copy, drop {
        old_attestor: address,
        new_attestor: address,
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    // Note: modules added via upgrade cannot have init() functions.
    // Call create_registry() once after upgrade to instantiate the singleton.

    /// Create and share the CharacterRegistry. Call once after package upgrade.
    /// Caller becomes initial admin and trusted_attestor.
    /// The canonical registry is identified by the RegistryCreated event.
    entry fun create_registry(ctx: &mut TxContext) {
        let uid  = object::new(ctx);
        let registry_id = object::uid_to_inner(&uid);
        let admin = ctx.sender();
        event::emit(RegistryCreated { registry_id, admin });
        transfer::share_object(CharacterRegistry {
            id: uid,
            claims: table::new(ctx),
            trusted_attestor: admin,
            admin,
        });
    }

    // ── Claim registration ────────────────────────────────────────────────────

    /// Register a tribe_id claim at the current epoch.
    ///
    /// Caller provides their character_id (the Character shared-object ID from
    /// EVE Frontier). No on-chain field verification — the trusted_attestor
    /// validates and may call invalidate_claim if the proof is bogus.
    ///
    /// First uncontested claim wins. Subsequent calls for the same tribe_id
    /// are silently ignored — use challenge_and_take_vault to dispute.
    entry fun register_claim(
        registry: &mut CharacterRegistry,
        tribe_id: u32,
        character_id: address,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        if (table::contains(&registry.claims, tribe_id)) {
            return  // no-op — call challenge_and_take_vault to dispute
        };
        let claim_epoch = ctx.epoch();
        table::add(&mut registry.claims, tribe_id, TribeClaim {
            claimer: sender,
            character_id,
            claim_epoch,
            vault_created: false,
        });
        event::emit(ClaimRegistered { tribe_id, claimer: sender, character_id, claim_epoch });
    }

    // ── Registry-gated vault creation ─────────────────────────────────────────

    /// Create a TribeVault, gated by a verified claim in this registry.
    ///
    /// Caller must:
    ///   • Hold the active claim for tribe_id (registered via register_claim)
    ///   • Not have already created a vault for this tribe_id
    ///
    /// Delegates to tribe_vault::create_vault_internal (package-visible).
    entry fun create_vault_with_registry(
        registry: &mut CharacterRegistry,
        tribe_id: u32,
        coin_name: vector<u8>,
        coin_symbol: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(table::contains(&registry.claims, tribe_id), ENoClaim);
        let claim = table::borrow_mut(&mut registry.claims, tribe_id);
        assert!(claim.claimer == sender, ENotClaimer);
        assert!(!claim.vault_created, EVaultExists);
        claim.vault_created = true;
        tribe_vault::create_vault_internal(sender, tribe_id, coin_name, coin_symbol, ctx);
    }

    // ── Attestor: issue attestation ───────────────────────────────────────────

    /// Mint an EpochAttestation and transfer it to the beneficiary wallet.
    ///
    /// join_epoch is the epoch equivalent of the CharacterCreatedEvent checkpoint
    /// sequence for this wallet's character in tribe_id — derived off-chain by
    /// the CradleOS attestor service (initially the deployer key).
    ///
    /// Only trusted_attestor may call this.
    entry fun issue_attestation(
        registry: &CharacterRegistry,
        beneficiary: address,
        tribe_id: u32,
        character_id: address,
        join_epoch: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == registry.trusted_attestor, ENotAttestor);
        event::emit(AttestationIssued { tribe_id, beneficiary, character_id, join_epoch });
        transfer::transfer(EpochAttestation {
            id: object::new(ctx),
            beneficiary,
            tribe_id,
            character_id,
            join_epoch,
        }, beneficiary);
    }

    // ── Challenge: atomic claim + vault takeover ──────────────────────────────

    /// Challenge an existing claim and atomically take vault ownership.
    ///
    /// Requires an EpochAttestation (minted by trusted_attestor) that proves the
    /// challenger joined the tribe at an earlier epoch than the current claimant.
    ///
    /// Atomic in one transaction — no window between claim and vault transfer.
    /// Attestation is consumed (deleted) after use.
    ///
    /// After this call: registry.claims[tribe_id].claimer == sender
    ///                  vault.founder == sender
    entry fun challenge_and_take_vault(
        registry: &mut CharacterRegistry,
        vault: &mut TribeVault,
        attestation: EpochAttestation,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();

        // Unpack and consume attestation
        let EpochAttestation { id, beneficiary, tribe_id, character_id, join_epoch } = attestation;
        object::delete(id);

        // Attestation must be for the caller
        assert!(beneficiary == sender, ENotBeneficiary);

        // Vault must match the tribe
        assert!(tribe_vault::tribe_id(vault) == tribe_id, ETribeMismatch);

        // Claim must exist
        assert!(table::contains(&registry.claims, tribe_id), ENoClaim);
        let claim = table::borrow_mut(&mut registry.claims, tribe_id);

        // Challenger's join epoch must be strictly earlier
        assert!(join_epoch < claim.claim_epoch, ENotEarlier);

        let old_claimer = claim.claimer;

        // Transfer registry claim
        claim.claimer = sender;
        claim.character_id = character_id;
        claim.claim_epoch = join_epoch;

        // Atomically transfer vault founder (package-internal call)
        tribe_vault::set_founder(vault, sender);

        event::emit(ClaimChallenged {
            tribe_id,
            old_claimer,
            new_claimer: sender,
            new_epoch: join_epoch,
        });
    }

    // ── Attestor: invalidate stale claim ─────────────────────────────────────

    /// Remove a stale or fraudulent claim.
    ///
    /// Called by trusted_attestor when off-chain verification shows the claimer's
    /// character is no longer in tribe_id, or the character_id proof was invalid.
    ///
    /// After invalidation, any wallet can re-register a claim for that tribe_id.
    /// vault_created remains in its state — vault persists, just claimable again.
    entry fun invalidate_claim(
        registry: &mut CharacterRegistry,
        tribe_id: u32,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == registry.trusted_attestor, ENotAttestor);
        if (table::contains(&registry.claims, tribe_id)) {
            let TribeClaim { claimer, character_id: _, claim_epoch: _, vault_created: _ } =
                table::remove(&mut registry.claims, tribe_id);
            event::emit(ClaimInvalidated { tribe_id, old_claimer: claimer });
        };
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Update the trusted attestor address.
    /// Only admin may call. For multisig post-hackathon.
    entry fun set_attestor(
        registry: &mut CharacterRegistry,
        new_attestor: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        let old_attestor = registry.trusted_attestor;
        registry.trusted_attestor = new_attestor;
        event::emit(AttestorUpdated { old_attestor, new_attestor });
    }

    /// Transfer admin to a new address.
    entry fun set_admin(
        registry: &mut CharacterRegistry,
        new_admin: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, ENotAdmin);
        registry.admin = new_admin;
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun has_claim(registry: &CharacterRegistry, tribe_id: u32): bool {
        table::contains(&registry.claims, tribe_id)
    }

    public fun claim_claimer(registry: &CharacterRegistry, tribe_id: u32): address {
        table::borrow(&registry.claims, tribe_id).claimer
    }

    public fun claim_epoch(registry: &CharacterRegistry, tribe_id: u32): u64 {
        table::borrow(&registry.claims, tribe_id).claim_epoch
    }

    public fun claim_vault_created(registry: &CharacterRegistry, tribe_id: u32): bool {
        table::borrow(&registry.claims, tribe_id).vault_created
    }

    public fun claim_character_id(registry: &CharacterRegistry, tribe_id: u32): address {
        table::borrow(&registry.claims, tribe_id).character_id
    }

    public fun attestor(registry: &CharacterRegistry): address { registry.trusted_attestor }
    public fun admin(registry: &CharacterRegistry): address    { registry.admin }
}
