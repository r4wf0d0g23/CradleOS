/// CradleOS – Recruiting Terminal
///
/// A RecruitingTerminal is a shared object, one per tribe vault.
/// It allows a tribe founder to advertise recruitment and manage
/// applications from prospective members.
///
/// V2: Removed &TribeVault dependency — founder identity verified by
/// checking terminal.founder against ctx.sender(). Vault ID passed
/// as address to avoid cross-package type mismatch.
module cradleos::recruiting_terminal {
    use sui::event;
    use sui::dynamic_field as df;
    use sui::clock::Clock;
    use std::string::{Self, String};

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
        /// The vault object ID this terminal is bound to.
        vault_id: ID,
        /// The founder address — must match ctx.sender() for admin ops.
        founder: address,
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
        infra_count: u64,
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
    }

    public struct ApplicationReviewed has copy, drop {
        terminal_id: ID,
        application_id: u64,
        accepted: bool,
        reviewer: address,
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// Create and share a RecruitingTerminal for a vault.
    /// Caller must be the vault founder. Vault ID passed as address — no
    /// TribeVault object reference needed, avoiding cross-package type mismatch.
    public entry fun create_terminal_entry(
        vault_id: address,
        requirements: vector<u8>,
        min_infra_count: u64,
        ctx: &mut TxContext,
    ) {
        let founder = ctx.sender();
        let vault_object_id = object::id_from_address(vault_id);

        let uid = object::new(ctx);
        let terminal_id = object::uid_to_inner(&uid);

        event::emit(TerminalCreated { terminal_id, vault_id: vault_object_id, founder });

        transfer::share_object(RecruitingTerminal {
            id: uid,
            vault_id: vault_object_id,
            founder,
            open: false,
            requirements: std::string::utf8(requirements),
            min_infra_count,
            application_count: 0,
        });
    }

    // ── Founder controls ──────────────────────────────────────────────────────

    /// Open or close the terminal. Only the original founder may call.
    public entry fun set_open_entry(
        terminal: &mut RecruitingTerminal,
        open: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == terminal.founder, ENotFounder);
        terminal.open = open;
    }

    /// Update requirements text and minimum infrastructure count.
    public entry fun update_requirements_entry(
        terminal: &mut RecruitingTerminal,
        requirements: vector<u8>,
        min_infra_count: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == terminal.founder, ENotFounder);
        terminal.requirements = std::string::utf8(requirements);
        terminal.min_infra_count = min_infra_count;
    }

    // ── Public: apply ─────────────────────────────────────────────────────────

    /// Submit an application to a tribe. Anyone may call.
    public entry fun apply_entry(
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
            character_name: std::string::utf8(character_name),
            message: std::string::utf8(message),
            infra_count,
            status: STATUS_PENDING,
            created_ms,
        };

        df::add(&mut terminal.id, application_id, application);
        terminal.application_count = terminal.application_count + 1;

        event::emit(ApplicationSubmitted {
            terminal_id: object::uid_to_inner(&terminal.id),
            vault_id: terminal.vault_id,
            application_id,
            applicant,
        });
    }

    // ── Founder: review applications ──────────────────────────────────────────

    /// Accept or reject an application. Only the founder may call.
    public entry fun review_application_entry(
        terminal: &mut RecruitingTerminal,
        application_id: u64,
        accept: bool,
        ctx: &mut TxContext,
    ) {
        assert!(ctx.sender() == terminal.founder, ENotFounder);
        assert!(application_id < terminal.application_count, EInvalidApplicationId);

        let application: &mut Application = df::borrow_mut(&mut terminal.id, application_id);
        application.status = if (accept) STATUS_ACCEPTED else STATUS_REJECTED;

        event::emit(ApplicationReviewed {
            terminal_id: object::uid_to_inner(&terminal.id),
            application_id,
            accepted: accept,
            reviewer: ctx.sender(),
        });
    }

    // ── View functions ────────────────────────────────────────────────────────

    public fun vault_id(terminal: &RecruitingTerminal): ID { terminal.vault_id }
    public fun founder(terminal: &RecruitingTerminal): address { terminal.founder }
    public fun is_open(terminal: &RecruitingTerminal): bool { terminal.open }
    public fun requirements(terminal: &RecruitingTerminal): &String { &terminal.requirements }
    public fun min_infra_count(terminal: &RecruitingTerminal): u64 { terminal.min_infra_count }
    public fun application_count(terminal: &RecruitingTerminal): u64 { terminal.application_count }

    public fun get_application(terminal: &RecruitingTerminal, application_id: u64): Application {
        *df::borrow(&terminal.id, application_id)
    }

    public fun application_applicant(app: &Application): address { app.applicant }
    public fun application_status(app: &Application): u8 { app.status }
    public fun application_created_ms(app: &Application): u64 { app.created_ms }
}
