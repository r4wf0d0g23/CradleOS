/// CradleOS – Announcement Board
///
/// Each tribe vault may have one AnnouncementBoard where the founder can post,
/// edit, delete, and pin announcements visible to all members.
///
/// Announcements are stored as dynamic fields on the board keyed by u64 post_id.
/// Post IDs are monotonically increasing (never reused after deletion).
/// Events drive off-chain indexing; on-chain storage holds the full content.
module cradleos::announcement_board {
    use sui::event;
    use sui::dynamic_field as df;
    use std::string::{Self, String};
    use cradleos::tribe_vault::TribeVault;
    use sui::clock::Clock;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotFounder:    u64 = 0;
    const ENotFound:      u64 = 1;
    const EAlreadyExists: u64 = 2;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One per TribeVault. Holds all announcements as dynamic fields.
    public struct AnnouncementBoard has key {
        id: UID,
        /// The vault this board is bound to.
        vault_id: ID,
        /// Monotonically increasing. Used as the next post_id key.
        post_count: u64,
    }

    /// Stored as a dynamic field on AnnouncementBoard keyed by u64 post_id.
    public struct Announcement has store, drop, copy {
        title: String,
        body: String,
        author: address,
        pinned: bool,
        created_ms: u64,
        edited_ms: u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct BoardCreated has copy, drop {
        board_id: ID,
        vault_id: ID,
        founder: address,
    }

    public struct AnnouncementPosted has copy, drop {
        board_id: ID,
        vault_id: ID,
        post_id: u64,
        title: String,
        author: address,
        pinned: bool,
        created_ms: u64,
    }

    public struct AnnouncementEdited has copy, drop {
        board_id: ID,
        vault_id: ID,
        post_id: u64,
        new_title: String,
        edited_by: address,
        edited_ms: u64,
    }

    public struct AnnouncementDeleted has copy, drop {
        board_id: ID,
        vault_id: ID,
        post_id: u64,
        deleted_by: address,
    }

    public struct AnnouncementPinned has copy, drop {
        board_id: ID,
        vault_id: ID,
        post_id: u64,
        pinned: bool,
        changed_by: address,
    }

    // ── Board lifecycle ───────────────────────────────────────────────────────

    /// Create and share an AnnouncementBoard for a vault.
    /// Only the vault founder may call this. One board per vault.
    entry fun create_board_entry(
        vault: &TribeVault,
        ctx: &mut TxContext,
    ) {
        let founder = ctx.sender();
        assert!(founder == cradleos::tribe_vault::founder(vault), ENotFounder);

        let vault_id = object::id(vault);
        let board_uid = object::new(ctx);
        let board_id  = object::uid_to_inner(&board_uid);

        event::emit(BoardCreated { board_id, vault_id, founder });

        transfer::share_object(AnnouncementBoard {
            id: board_uid,
            vault_id,
            post_count: 0,
        });
    }

    // ── Announcement management ───────────────────────────────────────────────

    /// Post a new announcement. Only the vault founder may call.
    entry fun post_announcement_entry(
        board: &mut AnnouncementBoard,
        vault: &TribeVault,
        title: vector<u8>,
        body: vector<u8>,
        pinned: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let author = ctx.sender();
        assert!(author == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == board.vault_id, ENotFounder);

        let now = sui::clock::timestamp_ms(clock);
        let post_id = board.post_count;

        let announcement = Announcement {
            title: string::utf8(title),
            body: string::utf8(body),
            author,
            pinned,
            created_ms: now,
            edited_ms: now,
        };

        df::add(&mut board.id, post_id, announcement);
        board.post_count = post_id + 1;

        event::emit(AnnouncementPosted {
            board_id: object::uid_to_inner(&board.id),
            vault_id: board.vault_id,
            post_id,
            title: string::utf8(title),
            author,
            pinned,
            created_ms: now,
        });
    }

    /// Edit an existing announcement's title and body. Only the vault founder may call.
    entry fun edit_announcement_entry(
        board: &mut AnnouncementBoard,
        vault: &TribeVault,
        post_id: u64,
        new_title: vector<u8>,
        new_body: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let editor = ctx.sender();
        assert!(editor == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == board.vault_id, ENotFounder);
        assert!(df::exists_(&board.id, post_id), ENotFound);

        let now = sui::clock::timestamp_ms(clock);
        let ann: &mut Announcement = df::borrow_mut(&mut board.id, post_id);
        ann.title = string::utf8(new_title);
        ann.body = string::utf8(new_body);
        ann.edited_ms = now;

        event::emit(AnnouncementEdited {
            board_id: object::uid_to_inner(&board.id),
            vault_id: board.vault_id,
            post_id,
            new_title: string::utf8(new_title),
            edited_by: editor,
            edited_ms: now,
        });
    }

    /// Delete an announcement by post_id. Removes the dynamic field.
    /// Only the vault founder may call.
    entry fun delete_announcement_entry(
        board: &mut AnnouncementBoard,
        vault: &TribeVault,
        post_id: u64,
        ctx: &mut TxContext,
    ) {
        let deleter = ctx.sender();
        assert!(deleter == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == board.vault_id, ENotFounder);
        assert!(df::exists_(&board.id, post_id), ENotFound);

        df::remove<u64, Announcement>(&mut board.id, post_id);

        event::emit(AnnouncementDeleted {
            board_id: object::uid_to_inner(&board.id),
            vault_id: board.vault_id,
            post_id,
            deleted_by: deleter,
        });
    }

    /// Set the pinned status of an announcement. Only the vault founder may call.
    entry fun pin_announcement_entry(
        board: &mut AnnouncementBoard,
        vault: &TribeVault,
        post_id: u64,
        pinned: bool,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        assert!(sender == cradleos::tribe_vault::founder(vault), ENotFounder);
        assert!(object::id(vault) == board.vault_id, ENotFounder);
        assert!(df::exists_(&board.id, post_id), ENotFound);

        let ann: &mut Announcement = df::borrow_mut(&mut board.id, post_id);
        ann.pinned = pinned;

        event::emit(AnnouncementPinned {
            board_id: object::uid_to_inner(&board.id),
            vault_id: board.vault_id,
            post_id,
            pinned,
            changed_by: sender,
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun vault_id(b: &AnnouncementBoard): ID   { b.vault_id }
    public fun post_count(b: &AnnouncementBoard): u64 { b.post_count }

    public fun get_announcement(b: &AnnouncementBoard, post_id: u64): &Announcement {
        df::borrow(&b.id, post_id)
    }

    public fun announcement_exists(b: &AnnouncementBoard, post_id: u64): bool {
        df::exists_(&b.id, post_id)
    }

    public fun title(a: &Announcement): &String   { &a.title }
    public fun body(a: &Announcement): &String    { &a.body }
    public fun author(a: &Announcement): address  { a.author }
    public fun pinned(a: &Announcement): bool     { a.pinned }
    public fun created_ms(a: &Announcement): u64  { a.created_ms }
    public fun edited_ms(a: &Announcement): u64   { a.edited_ms }
}
