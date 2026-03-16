/// CradleOS – Inheritance / Succession Deed
///
/// A WillDeed is a shared object (one per vault) that records a founder's
/// designated heir and an inactivity timeout.  It acts as immutable on-chain
/// evidence of succession intent.
///
/// Design: trustless record, social-layer execution.
///   • Founder creates a deed naming an heir and a timeout window.
///   • Founder keeps it alive by calling check_in_entry periodically.
///   • If the founder goes silent longer than timeout_ms, the heir may call
///     execute_succession_entry, which marks the deed as executed and emits
///     SuccessionExecuted as a permanent on-chain record.
///   • Actual vault founder transfer still requires tribe coordination
///     (using tribe_vault::transfer_founder), but the deed provides
///     incontrovertible proof of the founder's declared intent.
///
/// One vault → at most one active WillDeed (enforced by the caller creating
/// and sharing only one deed per vault; duplicate prevention is social).
module cradleos::inheritance {
    use sui::event;
    use sui::clock::Clock;
    use std::string::{Self, String};
    use cradleos::tribe_vault::TribeVault;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:       u64 = 0;
    const ENotHeir:          u64 = 1;
    const EAlreadyExecuted:  u64 = 2;
    const ETimeoutNotElapsed: u64 = 3;
    const EVaultMismatch:    u64 = 4;

    // ── Constants ─────────────────────────────────────────────────────────────

    /// Milliseconds per day
    const MS_PER_DAY: u64 = 86_400_000;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared object. One per vault. Records succession intent.
    public struct WillDeed has key {
        id: UID,
        /// The vault this deed is bound to.
        vault_id: ID,
        /// Address that created this deed (must equal vault.founder at creation time).
        founder: address,
        /// Designated heir — who may execute succession after timeout.
        heir: address,
        /// Inactivity window in milliseconds. After this many ms without a
        /// check-in the heir may execute succession.
        timeout_ms: u64,
        /// Last time the founder called check_in_entry (or created the deed).
        last_checkin_ms: u64,
        /// Set to true once execute_succession_entry is called by the heir.
        executed: bool,
        /// Creation timestamp (ms).
        created_ms: u64,
        /// Optional message from founder to heir / tribe.
        notes: String,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct WillCreated has copy, drop {
        deed_id:    ID,
        vault_id:   ID,
        founder:    address,
        heir:       address,
        timeout_ms: u64,
    }

    public struct CheckIn has copy, drop {
        deed_id:         ID,
        vault_id:        ID,
        founder:         address,
        last_checkin_ms: u64,
    }

    public struct HeirUpdated has copy, drop {
        deed_id:  ID,
        vault_id: ID,
        old_heir: address,
        new_heir: address,
    }

    public struct WillRevoked has copy, drop {
        deed_id:  ID,
        vault_id: ID,
        founder:  address,
    }

    public struct SuccessionExecuted has copy, drop {
        deed_id:     ID,
        vault_id:    ID,
        heir:        address,
        executed_ms: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Create a WillDeed for a vault.
    /// Only the vault founder may call.  timeout_days is converted to ms internally.
    entry fun create_will_entry(
        vault:        &TribeVault,
        heir:         address,
        timeout_days: u64,
        notes:        vector<u8>,
        clock:        &Clock,
        ctx:          &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(sender == cradleos::tribe_vault::founder(vault), ENotFounder);

        let vault_id      = object::id(vault);
        let now_ms        = sui::clock::timestamp_ms(clock);
        let timeout_ms    = timeout_days * MS_PER_DAY;

        let deed_uid = object::new(ctx);
        let deed_id  = object::uid_to_inner(&deed_uid);

        event::emit(WillCreated {
            deed_id,
            vault_id,
            founder: sender,
            heir,
            timeout_ms,
        });

        transfer::share_object(WillDeed {
            id: deed_uid,
            vault_id,
            founder: sender,
            heir,
            timeout_ms,
            last_checkin_ms: now_ms,
            executed: false,
            created_ms: now_ms,
            notes: string::utf8(notes),
        });
    }

    /// Founder check-in: resets the inactivity clock.
    /// Only the deed founder may call.
    entry fun check_in_entry(
        deed:  &mut WillDeed,
        vault: &TribeVault,
        clock: &Clock,
        ctx:   &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(sender == deed.founder, ENotFounder);
        assert!(object::id(vault) == deed.vault_id, EVaultMismatch);

        let now_ms = sui::clock::timestamp_ms(clock);
        deed.last_checkin_ms = now_ms;

        event::emit(CheckIn {
            deed_id:         object::uid_to_inner(&deed.id),
            vault_id:        deed.vault_id,
            founder:         sender,
            last_checkin_ms: now_ms,
        });
    }

    /// Update the designated heir.  Also counts as a check-in.
    /// Only the deed founder may call.
    entry fun update_heir_entry(
        deed:     &mut WillDeed,
        vault:    &TribeVault,
        new_heir: address,
        clock:    &Clock,
        ctx:      &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(sender == deed.founder, ENotFounder);
        assert!(object::id(vault) == deed.vault_id, EVaultMismatch);

        let old_heir = deed.heir;
        deed.heir = new_heir;
        deed.last_checkin_ms = sui::clock::timestamp_ms(clock);

        event::emit(HeirUpdated {
            deed_id:  object::uid_to_inner(&deed.id),
            vault_id: deed.vault_id,
            old_heir,
            new_heir,
        });
    }

    /// Revoke and destroy the deed.
    /// Only the deed founder may call.
    entry fun revoke_will_entry(
        deed:  WillDeed,
        vault: &TribeVault,
        clock: &Clock,
        ctx:   &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(sender == deed.founder, ENotFounder);
        assert!(object::id(vault) == deed.vault_id, EVaultMismatch);
        let _ = clock; // consumed for uniformity

        event::emit(WillRevoked {
            deed_id:  object::uid_to_inner(&deed.id),
            vault_id: deed.vault_id,
            founder:  sender,
        });

        let WillDeed { id, vault_id: _, founder: _, heir: _, timeout_ms: _,
                       last_checkin_ms: _, executed: _, created_ms: _, notes: _ } = deed;
        object::delete(id);
    }

    /// Heir executes succession after the founder has been inactive longer than
    /// timeout_ms.  Sets deed.executed = true and emits SuccessionExecuted.
    ///
    /// NOTE: This records the heir's claim on-chain as trustless evidence.
    /// The actual vault founder transfer still requires tribe coordination via
    /// tribe_vault::transfer_founder — the deed is accepted as social proof.
    entry fun execute_succession_entry(
        deed:  &mut WillDeed,
        clock: &Clock,
        ctx:   &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(sender == deed.heir, ENotHeir);
        assert!(!deed.executed, EAlreadyExecuted);

        let now_ms = sui::clock::timestamp_ms(clock);
        assert!(now_ms >= deed.last_checkin_ms + deed.timeout_ms, ETimeoutNotElapsed);

        deed.executed = true;

        event::emit(SuccessionExecuted {
            deed_id:     object::uid_to_inner(&deed.id),
            vault_id:    deed.vault_id,
            heir:        sender,
            executed_ms: now_ms,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id(d: &WillDeed): ID          { d.vault_id }
    public fun founder(d: &WillDeed): address       { d.founder }
    public fun heir(d: &WillDeed): address          { d.heir }
    public fun timeout_ms(d: &WillDeed): u64        { d.timeout_ms }
    public fun last_checkin_ms(d: &WillDeed): u64   { d.last_checkin_ms }
    public fun executed(d: &WillDeed): bool         { d.executed }
    public fun created_ms(d: &WillDeed): u64        { d.created_ms }
    public fun notes(d: &WillDeed): &String         { &d.notes }
}
