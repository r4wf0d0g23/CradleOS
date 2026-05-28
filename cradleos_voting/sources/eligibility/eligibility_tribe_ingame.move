/// CradleOS Voting — In-Game Tribe Membership Eligibility.
///
/// Eligible iff character_id has an active attestation in InGameTribeRegistry
/// asserting membership in the tribe_id encoded in eligibility_params.
///
/// ── Why An Attestation Model? ──────────────────────────────────────────────
///
///   In-game tribe membership is expressed via two on-chain primitives:
///
///   1. `cradleos::defense_policy::FriendlyCharacterSet` events — emitted when
///      a tribe founder marks a character as friendly. These events live under
///      the cradleos package address. HOWEVER, FriendlyCharacterSet was
///      introduced at CradleOS v13 (NOT v1). An off-chain indexer MUST query
///      event types under all cradleos package versions using the
///      `fetchEventAcrossPackages` pattern. This is a standing rule documented
///      in MEMORY.md.
///
///   2. EVE Frontier world-contracts on-chain: in-game tribe_id is recorded
///      per character, but Move modules in cradleos_voting CANNOT call
///      world-contract entry functions or query their state directly.
///
///   Both sources are off-chain-observable but not queryable in a Move tx.
///   Solution: a trusted off-chain attestor reads these events, cross-checks
///   in-game state, then calls `issue_attestation` to record the mapping
///   `character_id → tribe_id` on-chain in an `InGameTribeRegistry`.
///
/// ── Security / Trust Model ─────────────────────────────────────────────────
///
///   ON-CHAIN VERIFIED (zero trust assumptions):
///   • character_id has an attestation entry in InGameTribeRegistry.
///   • entry.tribe_id == tribe_id from eligibility_params.
///   • entry.valid == true (attestor may revoke when character leaves tribe).
///
///   TRUST ASSUMPTION — the trusted_attestor:
///   • Is a single address controlled by the CradleOS team (or a multisig).
///   • Reads FriendlyCharacterSet events across ALL cradleos package versions
///     (v1 through current) using the fetchEventAcrossPackages indexer.
///   • Cross-references in-game tribe_id from EVE Frontier world contracts.
///   • Calls issue_attestation before election start and revoke_attestation
///     when a character's tribe changes.
///   • Admin can rotate the attestor at any time via set_attestor.
///   • Post-hackathon target: replace with a multisig attestor threshold.
///
///   SYBIL RESISTANCE:
///   • Proof is bound to character_id u32; each character votes at most once
///     per election (enforced by VoteKey dynamic field in voting.move).
///   • An attacker who controls multiple characters in the same tribe can
///     submit one ballot per character — this is intentional and matches the
///     "one character one vote" model.
///
///   eligibility_params layout:
///     bytes [0..3] : tribe_id (u32, little-endian)
///
module cradleos_voting::eligibility_tribe_ingame {
    use sui::table::{Self, Table};
    use sui::event;
    use cradleos_voting::voting::{Self, Election, EligibilityProof};

    // ── Constants ─────────────────────────────────────────────────────────────

    const KIND_TRIBE_INGAME: u8 = 3;

    // ── Error codes ───────────────────────────────────────────────────────────

    const E_NOT_ADMIN:    u64 = 0;
    const E_NOT_ATTESTOR: u64 = 1;
    const E_BAD_PARAMS:   u64 = 2;
    /// character_ids and tribe_ids vectors have different lengths in batch call.
    const E_LENGTH_MISMATCH: u64 = 3;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared singleton. Created once via create_registry(); typically deployed
    /// once per CradleOS instance by the team.
    ///
    /// Stores in-game tribe membership attestations keyed by character_id u32.
    /// Attestations are issued/revoked by the trusted off-chain oracle.
    public struct InGameTribeRegistry has key {
        id: UID,
        /// character_id (u32) → InGameAttestation
        attestations: Table<u32, InGameAttestation>,
        /// Wallet authorized to issue and revoke attestations.
        trusted_attestor: address,
        /// Wallet authorized to rotate trusted_attestor.
        admin: address,
    }

    /// One per character_id. Stored as a value in InGameTribeRegistry.attestations.
    public struct InGameAttestation has store {
        /// In-game tribe_id the character belongs to at attestation time.
        tribe_id: u32,
        /// Epoch (sui epoch number) when this attestation was last updated.
        attested_epoch: u64,
        /// false when revoked (e.g. character left the tribe).
        valid: bool,
        /// Address that issued this attestation; useful for audit.
        issued_by: address,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin: address,
        trusted_attestor: address,
    }

    public struct AttestorChanged has copy, drop {
        registry_id: ID,
        old_attestor: address,
        new_attestor: address,
        changed_by: address,
    }

    public struct AttestationIssued has copy, drop {
        registry_id: ID,
        character_id: u32,
        tribe_id: u32,
        attested_epoch: u64,
        issued_by: address,
    }

    public struct AttestationRevoked has copy, drop {
        registry_id: ID,
        character_id: u32,
        revoked_by: address,
    }

    // ── Registry lifecycle ────────────────────────────────────────────────────

    /// Create and share the InGameTribeRegistry.
    /// Caller becomes both admin and initial trusted_attestor.
    /// Typically called once at voting package deploy time.
    public fun create_registry(ctx: &mut TxContext) {
        let sender = ctx.sender();
        let uid = object::new(ctx);
        let registry_id = object::uid_to_inner(&uid);
        event::emit(RegistryCreated {
            registry_id,
            admin: sender,
            trusted_attestor: sender,
        });
        transfer::share_object(InGameTribeRegistry {
            id: uid,
            attestations: table::new(ctx),
            trusted_attestor: sender,
            admin: sender,
        });
    }

    // ── Admin: attestor rotation ──────────────────────────────────────────────

    /// Admin-only: replace the trusted attestor address.
    /// Use when rotating keys or upgrading to a multisig attestor.
    public fun set_attestor(
        registry: &mut InGameTribeRegistry,
        new_attestor: address,
        ctx: &mut TxContext,
    ) {
        let caller = ctx.sender();
        assert!(caller == registry.admin, E_NOT_ADMIN);
        let old_attestor = registry.trusted_attestor;
        registry.trusted_attestor = new_attestor;
        event::emit(AttestorChanged {
            registry_id: object::uid_to_inner(&registry.id),
            old_attestor,
            new_attestor,
            changed_by: caller,
        });
    }

    /// Admin-only: transfer the admin role to a new address.
    public fun set_admin(
        registry: &mut InGameTribeRegistry,
        new_admin: address,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == registry.admin, E_NOT_ADMIN);
        registry.admin = new_admin;
    }

    // ── Attestor: issue / batch-issue / revoke ────────────────────────────────

    /// Record that character_id belongs to tribe_id.
    /// Overwrites any existing entry for this character_id (e.g. tribe change).
    /// Only trusted_attestor may call.
    public fun issue_attestation(
        registry: &mut InGameTribeRegistry,
        character_id: u32,
        tribe_id: u32,
        ctx: &mut TxContext,
    ) {
        let caller = ctx.sender();
        assert!(caller == registry.trusted_attestor, E_NOT_ATTESTOR);
        let current_epoch = ctx.epoch();

        if (table::contains(&registry.attestations, character_id)) {
            let entry = table::borrow_mut(&mut registry.attestations, character_id);
            entry.tribe_id      = tribe_id;
            entry.attested_epoch = current_epoch;
            entry.valid         = true;
            entry.issued_by     = caller;
        } else {
            table::add(&mut registry.attestations, character_id, InGameAttestation {
                tribe_id,
                attested_epoch: current_epoch,
                valid: true,
                issued_by: caller,
            });
        };

        event::emit(AttestationIssued {
            registry_id: object::uid_to_inner(&registry.id),
            character_id,
            tribe_id,
            attested_epoch: current_epoch,
            issued_by: caller,
        });
    }

    /// Batch-issue attestations in one transaction (gas-efficient for initial
    /// tribe snapshot uploads). character_ids and tribe_ids must be same length.
    public fun issue_attestations_batch(
        registry: &mut InGameTribeRegistry,
        character_ids: vector<u32>,
        tribe_ids: vector<u32>,
        ctx: &mut TxContext,
    ) {
        let caller = ctx.sender();
        assert!(caller == registry.trusted_attestor, E_NOT_ATTESTOR);
        let len = character_ids.length();
        assert!(tribe_ids.length() == len, E_LENGTH_MISMATCH);

        let current_epoch = ctx.epoch();
        let registry_id   = object::uid_to_inner(&registry.id);
        let mut i: u64    = 0;

        while (i < len) {
            let character_id = *character_ids.borrow(i);
            let tribe_id     = *tribe_ids.borrow(i);

            if (table::contains(&registry.attestations, character_id)) {
                let entry = table::borrow_mut(&mut registry.attestations, character_id);
                entry.tribe_id       = tribe_id;
                entry.attested_epoch = current_epoch;
                entry.valid          = true;
                entry.issued_by      = caller;
            } else {
                table::add(&mut registry.attestations, character_id, InGameAttestation {
                    tribe_id,
                    attested_epoch: current_epoch,
                    valid: true,
                    issued_by: caller,
                });
            };

            event::emit(AttestationIssued {
                registry_id,
                character_id,
                tribe_id,
                attested_epoch: current_epoch,
                issued_by: caller,
            });
            i = i + 1;
        };
    }

    /// Invalidate an attestation (character left their tribe, fraud detected, etc.).
    /// Either trusted_attestor or admin may revoke.
    public fun revoke_attestation(
        registry: &mut InGameTribeRegistry,
        character_id: u32,
        ctx: &mut TxContext,
    ) {
        let caller = ctx.sender();
        assert!(
            caller == registry.trusted_attestor || caller == registry.admin,
            E_NOT_ATTESTOR,
        );
        if (table::contains(&registry.attestations, character_id)) {
            let entry = table::borrow_mut(&mut registry.attestations, character_id);
            entry.valid = false;
        };
        event::emit(AttestationRevoked {
            registry_id: object::uid_to_inner(&registry.id),
            character_id,
            revoked_by: caller,
        });
    }

    // ── Eligibility minting ───────────────────────────────────────────────────

    /// Mint an in-game tribe eligibility proof.
    ///
    /// eligible = true iff:
    ///   • character_id has an entry in registry
    ///   • entry.valid == true
    ///   • entry.tribe_id == tribe_id from eligibility_params
    ///
    /// For use in a programmable transaction alongside cast_ballot.
    public fun mint(
        election: &Election,
        registry: &InGameTribeRegistry,
        character_id: u32,
        ctx: &mut TxContext,
    ): EligibilityProof {
        let voter = ctx.sender();

        let params = voting::eligibility_params(election);
        assert!(vector::length(params) >= 4, E_BAD_PARAMS);
        let expected_tribe_id = decode_u32_at(params, 0);

        let eligible = is_attested_for_tribe(registry, character_id, expected_tribe_id);

        voting::mint_eligibility_proof(
            voting::id(election),
            voter,
            character_id,
            KIND_TRIBE_INGAME,
            @cradleos_voting,
            eligible,
            ctx,
        )
    }

    // Note: prove_ingame removed. Use mint() in a PTB and pass result to cast_ballot directly.

    // ── Public reads ──────────────────────────────────────────────────────────

    /// Check whether character_id has a valid attestation for the given tribe_id.
    public fun is_attested_for_tribe(
        registry: &InGameTribeRegistry,
        character_id: u32,
        tribe_id: u32,
    ): bool {
        if (!table::contains(&registry.attestations, character_id)) return false;
        let entry = table::borrow(&registry.attestations, character_id);
        entry.valid && entry.tribe_id == tribe_id
    }

    /// Returns the tribe_id attested for character_id, or 0 if absent / revoked.
    public fun attested_tribe_id(
        registry: &InGameTribeRegistry,
        character_id: u32,
    ): u32 {
        if (!table::contains(&registry.attestations, character_id)) return 0;
        let entry = table::borrow(&registry.attestations, character_id);
        if (!entry.valid) return 0;
        entry.tribe_id
    }

    public fun trusted_attestor(registry: &InGameTribeRegistry): address {
        registry.trusted_attestor
    }

    public fun admin(registry: &InGameTribeRegistry): address {
        registry.admin
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun decode_u32_at(v: &vector<u8>, off: u64): u32 {
        let b0 = (*vector::borrow(v, off)     as u32);
        let b1 = (*vector::borrow(v, off + 1) as u32);
        let b2 = (*vector::borrow(v, off + 2) as u32);
        let b3 = (*vector::borrow(v, off + 3) as u32);
        b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    }

    public fun kind(): u8 { KIND_TRIBE_INGAME }
}
