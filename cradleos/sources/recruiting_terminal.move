/// CradleOS – Recruiting Terminal
///
/// A RecruitingTerminal is a shared object, one per tribe vault.
/// It allows a tribe founder to advertise recruitment and manage
/// applications from prospective members.
///
/// Applications are stored as dynamic fields on the terminal,
/// keyed by a monotonically incrementing u64 application_id.
module cradleos::recruiting_terminal {
    use sui::event;
    use sui::dynamic_field as df;
    use sui::clock::Clock;
    use std::string::{Self, String};
    use cradleos::tribe_vault::TribeVault;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:       u64 = 0;
    const EVaultMismatch:    u64 = 1;
    const ETerminalClosed:   u64 = 2;
    const EInvalidApplicationId: u64 = 3;

    // ── Application status constants ──────────────────────────────────────────

    const STATUS_PENDING:  u8 = 0;
    const STATUS_ACCEPTED: u8 = 1;
    const STATUS_REJECTED: u8 = 2;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One per TribeVault. Manages recruitment state and applications.
    public struct RecruitingTerminal has key {
        id: UID,
        /// The vault this terminal is bound to.
        vault_id: ID,
        /// When true, the terminal is accepting new applications.
        open: bool,
        /// Free-text requirements displayed on the public board.
        requirements: String,
        /// Minimum self-reported infrastructure count for applicants.
        min_infra_count: u64,
        /// Monotonic counter — also serves as the next application_id.
        application_count: u64,
    }

    /// Stored as a dynamic field on RecruitingTerminal keyed by u64 application_id.
    public struct Application has store, drop, copy {
        applicant: address,
        character_name: String,
        message: String,
        /// Self-reported; honor system.
        infra_count: u64,
        /// 0=pending, 1=accepted, 2=rejected
        status: u8,
        created_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct TerminalCreated has copy, drop {
        terminal_id: ID,
        vault_id: ID,
        founder: address,
    }

    public struct ApplicationSubmitted has copy, drop {
        terminal_id: ID,
        vault_id: ID,
        application_id: u64,
        applicant: address,
        character_name: String,
    }

    public struct ApplicationReviewed has copy, drop {
        terminal_id: ID,
        application_id: u64,
        accepted: bool,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create and share a RecruitingTerminal for a vault.
    /// Only the vault founder may call this.
    entry fun create_terminal_entry(
        vault: &TribeVault,
        requirements: vector<u8>,
        min_infra_count: u64,
        ctx: &mut TxContext,
    ) {
        let founder = ctx.sender();
        assert!(founder == cradleos::tribe_vault::founder(vault), ENotFounder);

        let vault_id = object::id(vault);

        let uid = object::new(ctx);
        let terminal_id = object::uid_to_inner(&uid);

        event::emit(TerminalCreated { terminal_id, vault_id, founder });

        transfer::share_object(RecruitingTerminal {
            id: uid,
            vault_id,
            open: false,
            requirements: string::utf8(requirements),
            min_infra_count,
            application_count: 0,
        });
    }

    // ── Founder controls ──────────────────────────────────────────────────────

    /// Open or close the terminal. Only the vault founder may call.
    entry fun set_open_entry(
        terminal: &mut RecruitingTerminal,
        vault: &TribeVault,
        open: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == terminal.vault_id, EVaultMismatch);
        terminal.open = open;
    }

    /// Update requirements text and minimum infrastructure count.
    /// Only the vault founder may call.
    entry fun update_requirements_entry(
        terminal: &mut RecruitingTerminal,
        vault: &TribeVault,
        requirements: vector<u8>,
        min_infra_count: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == terminal.vault_id, EVaultMismatch);
        terminal.requirements = string::utf8(requirements);
        terminal.min_infra_count = min_infra_count;
    }

    // ── Public: apply ─────────────────────────────────────────────────────────

    /// Submit an application to a tribe. Anyone may call.
    /// Fails if the terminal is not open.
    entry fun apply_entry(
        terminal: &mut RecruitingTerminal,
        character_name: vector<u8>,
        message: vector<u8>,
        infra_count: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(terminal.open, ETerminalClosed);

        let applicant = ctx.sender();
        let application_id = terminal.application_count;
        let created_ms = clock.timestamp_ms();

        let application = Application {
            applicant,
            character_name: string::utf8(character_name),
            message: string::utf8(message),
            infra_count,
            status: STATUS_PENDING,
            created_ms,
        };

        df::add(&mut terminal.id, application_id, application);
        terminal.application_count = application_id + 1;

        event::emit(ApplicationSubmitted {
            terminal_id: object::uid_to_inner(&terminal.id),
            vault_id: terminal.vault_id,
            application_id,
            applicant,
            character_name: string::utf8(character_name),
        });
    }

    // ── Founder: review ───────────────────────────────────────────────────────

    /// Accept or reject a pending application.
    /// Only the vault founder may call. Emits ApplicationReviewed.
    entry fun review_application_entry(
        terminal: &mut RecruitingTerminal,
        vault: &TribeVault,
        application_id: u64,
        accept: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == terminal.vault_id, EVaultMismatch);
        assert!(df::exists_(&terminal.id, application_id), EInvalidApplicationId);

        let app: &mut Application = df::borrow_mut(&mut terminal.id, application_id);
        app.status = if (accept) { STATUS_ACCEPTED } else { STATUS_REJECTED };

        event::emit(ApplicationReviewed {
            terminal_id: object::uid_to_inner(&terminal.id),
            application_id,
            accepted: accept,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id(t: &RecruitingTerminal): ID          { t.vault_id }
    public fun open(t: &RecruitingTerminal): bool             { t.open }
    public fun requirements(t: &RecruitingTerminal): &String  { &t.requirements }
    public fun min_infra_count(t: &RecruitingTerminal): u64   { t.min_infra_count }
    public fun application_count(t: &RecruitingTerminal): u64 { t.application_count }
}
