/// CradleOS – Lore Wiki
///
/// A community knowledge base for the EVE Frontier universe. Anyone can publish
/// articles covering lore, mechanics, locations, factions, ships, history, and more.
///
/// Articles are stored as dynamic fields on a single shared WikiBoard keyed by u64.
/// Tags (up to 5) and categories enable filtering. Upvotes/downvotes are honor-system counters.
/// Authors may edit or delete their own articles. Moderator (WikiModCap holder) can delete any article.
module cradleos::lore_wiki {
    use sui::event;
    use sui::dynamic_field as df;
    use std::string::{Self, String};
    use sui::clock::Clock;

    // ── Error codes ───────────────────────────────────────────────────────────

    const ENotAuthor:     u64 = 0;
    const ENotFound:      u64 = 1;
    const ETitleTooLong:  u64 = 2;
    const EContentTooLong: u64 = 3;
    const ETooManyTags:   u64 = 4;
    const ENotMod:        u64 = 5;

    // ── Constants ─────────────────────────────────────────────────────────────

    const MAX_CONTENT_LEN: u64 = 4000;
    const MAX_TITLE_LEN:   u64 = 200;
    const MAX_TAGS:        u64 = 5;

    // ── Structs ───────────────────────────────────────────────────────────────

    /// Shared. One global instance. All articles stored as dynamic fields.
    public struct WikiBoard has key {
        id: UID,
        /// Monotonically increasing. Used as the next article_id key.
        article_count: u64,
    }

    /// Stored as a dynamic field on WikiBoard keyed by u64 article_id.
    public struct WikiArticle has store, drop, copy {
        title: String,
        content: String,
        category: String,
        author: address,
        tribe_id: u32,
        tags: vector<String>,
        created_ms: u64,
        edited_ms: u64,
        upvotes: u64,
        downvotes: u64,
    }

    /// Held by the wiki moderator. Grants power to delete any article.
    public struct WikiModCap has key, store {
        id: UID,
        board_id: ID,
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public struct ArticlePublished has copy, drop {
        board_id: ID,
        article_id: u64,
        author: address,
        title: String,
        category: String,
        tribe_id: u32,
        created_ms: u64,
    }

    public struct ArticleEdited has copy, drop {
        board_id: ID,
        article_id: u64,
        author: address,
        edited_ms: u64,
    }

    public struct ArticleUpvoted has copy, drop {
        board_id: ID,
        article_id: u64,
        upvotes: u64,
    }

    public struct ArticleDownvoted has copy, drop {
        board_id: ID,
        article_id: u64,
        downvotes: u64,
    }

    public struct ArticleDeleted has copy, drop {
        board_id: ID,
        article_id: u64,
    }

    public struct ArticleModDeleted has copy, drop {
        board_id: ID,
        article_id: u64,
        mod_address: address,
    }

    // ── Board lifecycle ───────────────────────────────────────────────────────

    /// Create and share the global WikiBoard. Mints a WikiModCap to the caller.
    entry fun create_wiki_board_entry(ctx: &mut TxContext) {
        let board = WikiBoard {
            id: object::new(ctx),
            article_count: 0,
        };
        let board_id = object::uid_to_inner(&board.id);
        transfer::share_object(board);
        transfer::transfer(WikiModCap {
            id: object::new(ctx),
            board_id,
        }, ctx.sender());
    }

    // ── Article management ────────────────────────────────────────────────────

    /// Publish a new article. Anyone may call.
    entry fun publish_article_entry(
        board: &mut WikiBoard,
        title: vector<u8>,
        content: vector<u8>,
        category: vector<u8>,
        tribe_id: u32,
        tags: vector<vector<u8>>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(title.length() <= MAX_TITLE_LEN, ETitleTooLong);
        assert!(content.length() <= MAX_CONTENT_LEN, EContentTooLong);
        assert!(tags.length() <= MAX_TAGS, ETooManyTags);

        let now = sui::clock::timestamp_ms(clock);
        let author = ctx.sender();
        let article_id = board.article_count;

        let mut tag_strings: vector<String> = vector[];
        let mut i = 0;
        while (i < tags.length()) {
            tag_strings.push_back(string::utf8(*tags.borrow(i)));
            i = i + 1;
        };

        let title_str    = string::utf8(title);
        let category_str = string::utf8(category);

        let article = WikiArticle {
            title: title_str,
            content: string::utf8(content),
            category: category_str,
            author,
            tribe_id,
            tags: tag_strings,
            created_ms: now,
            edited_ms: now,
            upvotes: 0,
            downvotes: 0,
        };

        df::add(&mut board.id, article_id, article);
        board.article_count = article_id + 1;

        event::emit(ArticlePublished {
            board_id: object::uid_to_inner(&board.id),
            article_id,
            author,
            title: title_str,
            category: category_str,
            tribe_id,
            created_ms: now,
        });
    }

    /// Edit an existing article. Only the original author may call.
    entry fun edit_article_entry(
        board: &mut WikiBoard,
        article_id: u64,
        new_title: vector<u8>,
        new_content: vector<u8>,
        new_category: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(new_title.length() <= MAX_TITLE_LEN, ETitleTooLong);
        assert!(new_content.length() <= MAX_CONTENT_LEN, EContentTooLong);
        assert!(df::exists_(&board.id, article_id), ENotFound);

        let article: &mut WikiArticle = df::borrow_mut(&mut board.id, article_id);
        assert!(ctx.sender() == article.author, ENotAuthor);

        let now = sui::clock::timestamp_ms(clock);
        let editor = ctx.sender();

        article.title    = string::utf8(new_title);
        article.content  = string::utf8(new_content);
        article.category = string::utf8(new_category);
        article.edited_ms = now;

        event::emit(ArticleEdited {
            board_id: object::uid_to_inner(&board.id),
            article_id,
            author: editor,
            edited_ms: now,
        });
    }

    /// Upvote an article. Anyone may call; no dedup (honor system).
    entry fun upvote_article_entry(
        board: &mut WikiBoard,
        article_id: u64,
        _ctx: &mut TxContext,
    ) {
        assert!(df::exists_(&board.id, article_id), ENotFound);
        let board_id = object::uid_to_inner(&board.id);
        let article: &mut WikiArticle = df::borrow_mut(&mut board.id, article_id);
        article.upvotes = article.upvotes + 1;
        let upvotes = article.upvotes;
        event::emit(ArticleUpvoted { board_id, article_id, upvotes });
    }

    /// Downvote an article. Anyone may call; no dedup (honor system).
    entry fun downvote_article_entry(
        board: &mut WikiBoard,
        article_id: u64,
        _ctx: &mut TxContext,
    ) {
        assert!(df::exists_(&board.id, article_id), ENotFound);
        let board_id = object::uid_to_inner(&board.id);
        let article: &mut WikiArticle = df::borrow_mut(&mut board.id, article_id);
        article.downvotes = article.downvotes + 1;
        let downvotes = article.downvotes;
        event::emit(ArticleDownvoted { board_id, article_id, downvotes });
    }

    /// Delete an article. Only the original author may call.
    entry fun delete_article_entry(
        board: &mut WikiBoard,
        article_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(df::exists_(&board.id, article_id), ENotFound);

        {
            let article: &WikiArticle = df::borrow(&board.id, article_id);
            assert!(ctx.sender() == article.author, ENotAuthor);
        };

        df::remove<u64, WikiArticle>(&mut board.id, article_id);

        event::emit(ArticleDeleted {
            board_id: object::uid_to_inner(&board.id),
            article_id,
        });
    }

    /// Delete any article. Requires WikiModCap. Emergency moderation tool.
    entry fun mod_delete_entry(
        board: &mut WikiBoard,
        _cap: &WikiModCap,
        article_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(df::exists_(&board.id, article_id), ENotFound);
        df::remove<u64, WikiArticle>(&mut board.id, article_id);

        event::emit(ArticleModDeleted {
            board_id: object::uid_to_inner(&board.id),
            article_id,
            mod_address: ctx.sender(),
        });
    }

    // ── Public reads ──────────────────────────────────────────────────────────

    public fun article_count(b: &WikiBoard): u64 { b.article_count }

    public fun article_exists(b: &WikiBoard, article_id: u64): bool {
        df::exists_(&b.id, article_id)
    }

    public fun get_article(b: &WikiBoard, article_id: u64): &WikiArticle {
        df::borrow(&b.id, article_id)
    }

    public fun title(a: &WikiArticle): &String        { &a.title }
    public fun content(a: &WikiArticle): &String      { &a.content }
    public fun category(a: &WikiArticle): &String     { &a.category }
    public fun author(a: &WikiArticle): address       { a.author }
    public fun tribe_id(a: &WikiArticle): u32         { a.tribe_id }
    public fun tags(a: &WikiArticle): &vector<String> { &a.tags }
    public fun created_ms(a: &WikiArticle): u64       { a.created_ms }
    public fun edited_ms(a: &WikiArticle): u64        { a.edited_ms }
    public fun upvotes(a: &WikiArticle): u64          { a.upvotes }
    public fun downvotes(a: &WikiArticle): u64        { a.downvotes }
}
