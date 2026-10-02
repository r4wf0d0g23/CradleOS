// SQLite-backed persistent index of on-chain Character objects.
//
// One row per (server, object_id). Reads and updates are synchronous
// because better-sqlite3 is sync-API; everything wraps a single connection
// shared between server.js and indexer.js.

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.CHARACTER_INDEX_DB || path.join(__dirname, "data", "characters.sqlite");

export function openDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      server          TEXT NOT NULL,
      object_id       TEXT NOT NULL,
      character_addr  TEXT NOT NULL,
      name            TEXT NOT NULL,
      name_lc         TEXT NOT NULL,
      tribe_id        INTEGER NOT NULL,
      item_id         TEXT NOT NULL,
      pkg_origin      TEXT NOT NULL, -- which world-pkg the type was matched against (active/v1)
      first_seen_ms   INTEGER NOT NULL,
      last_seen_ms    INTEGER NOT NULL,
      PRIMARY KEY (server, object_id)
    );
    CREATE INDEX IF NOT EXISTS idx_name_lc      ON characters(server, name_lc);
    CREATE INDEX IF NOT EXISTS idx_addr         ON characters(server, character_addr);
    CREATE INDEX IF NOT EXISTS idx_item_id      ON characters(server, item_id);
    CREATE INDEX IF NOT EXISTS idx_tribe        ON characters(server, tribe_id);

    CREATE TABLE IF NOT EXISTS indexer_state (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      updated_ms INTEGER NOT NULL
    );

    -- Killmails are immutable events: insert-once, never updated.
    -- kill_timestamp is unix SECONDS (as emitted on-chain); block_time_ms is
    -- the tx checkpoint time in ms (may be 0 for older rows if unavailable).
    CREATE TABLE IF NOT EXISTS killmails (
      server              TEXT NOT NULL,
      tx_digest           TEXT NOT NULL,
      event_seq           TEXT NOT NULL,
      kill_timestamp      INTEGER NOT NULL,
      block_time_ms       INTEGER NOT NULL DEFAULT 0,
      key_item_id         TEXT NOT NULL DEFAULT '',
      killer_item_id      TEXT NOT NULL DEFAULT '',
      victim_item_id      TEXT NOT NULL DEFAULT '',
      reported_by_item_id TEXT NOT NULL DEFAULT '',
      solar_system_id     TEXT NOT NULL DEFAULT '',
      loss_type           TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (server, tx_digest, event_seq)
    );
    CREATE INDEX IF NOT EXISTS idx_kills_ts     ON killmails(server, kill_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_kills_killer ON killmails(server, killer_item_id);
    CREATE INDEX IF NOT EXISTS idx_kills_victim ON killmails(server, victim_item_id);

    -- Owned-objects index (2026-07-19): the snapshot-restored fullnode's native
    -- suix_getOwnedObjects index is incomplete for pre-snapshot objects, so we
    -- build our own. One row per (server, object_id). owner = the address that
    -- owns it (wallet OR character object id for OwnerCap<T>). type_module +
    -- type_struct identify the EVE Frontier object kind. authorized_object_id
    -- is set for OwnerCap<T> rows (points at the structure the cap controls).
    CREATE TABLE IF NOT EXISTS owned_objects (
      server          TEXT NOT NULL,
      object_id       TEXT NOT NULL,
      owner           TEXT NOT NULL,       -- AddressOwner or ObjectOwner (char id) that owns this object
      owner_kind      TEXT NOT NULL,       -- 'address' | 'object' | 'shared' | 'immutable'
      type_full       TEXT NOT NULL,       -- full canonical type string
      type_module     TEXT NOT NULL,       -- e.g. 'network_node', 'access'
      type_struct     TEXT NOT NULL,       -- e.g. 'NetworkNode', 'OwnerCap'
      pkg             TEXT NOT NULL,       -- world/cradleos pkg the type belongs to
      authorized_object_id TEXT,           -- for OwnerCap<T>: the controlled structure id
      content_json    TEXT,                -- full object content.fields JSON (structures) so
                                           -- the dApp can read energy_source_id/status/metadata/
                                           -- fuel/type_id/etc WITHOUT a flaky per-object RPC call
      obj_type        TEXT,                -- canonical type string of the object (for _type)
      version         INTEGER NOT NULL DEFAULT 0,
      deleted         INTEGER NOT NULL DEFAULT 0,
      first_seen_ms   INTEGER NOT NULL,
      last_seen_ms    INTEGER NOT NULL,
      PRIMARY KEY (server, object_id)
    );
    CREATE INDEX IF NOT EXISTS idx_owned_owner   ON owned_objects(server, owner, deleted);
    CREATE INDEX IF NOT EXISTS idx_owned_type    ON owned_objects(server, type_module, type_struct, deleted);
    CREATE INDEX IF NOT EXISTS idx_owned_auth    ON owned_objects(server, authorized_object_id);
    CREATE INDEX IF NOT EXISTS idx_owned_ownertype ON owned_objects(server, owner, type_module, type_struct, deleted);

    -- Generic wallet ownership cache seeded from Alchemy. Successful refreshes
    -- replace one wallet atomically, so a failed paginated walk cannot expose
    -- partial ownership state.
    CREATE TABLE IF NOT EXISTS wallet_objects (
      owner TEXT NOT NULL,
      object_id TEXT NOT NULL,
      type_full TEXT NOT NULL DEFAULT '',
      object_json TEXT NOT NULL,
      refreshed_ms INTEGER NOT NULL,
      PRIMARY KEY (owner, object_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_objects_type ON wallet_objects(owner, type_full, object_id);
    CREATE TABLE IF NOT EXISTS wallet_sync_state (
      owner TEXT PRIMARY KEY,
      last_ok_ms INTEGER NOT NULL DEFAULT 0,
      last_attempt_ms INTEGER NOT NULL DEFAULT 0,
      last_access_ms INTEGER NOT NULL DEFAULT 0,
      object_count INTEGER NOT NULL DEFAULT 0,
      checkpoint INTEGER,
      balances_json TEXT,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_wallet_sync_hot ON wallet_sync_state(last_access_ms DESC, last_ok_ms ASC);
  `);
  // ── L2 static-data catalogs (2026-07-19 data-path refactor) ─────────────
  // Local mirrors of the EVE world-api catalogs (/v2/types, /v2/solarsystems,
  // /v2/tribes). They change only on game patches; a slow poller (1h) keeps
  // them fresh. data_json stores the full upstream item verbatim so the dApp
  // gets byte-equivalent shapes to the live API.
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_types (
      server     TEXT NOT NULL,
      id         INTEGER NOT NULL,
      name       TEXT NOT NULL,
      data_json  TEXT NOT NULL,
      updated_ms INTEGER NOT NULL,
      PRIMARY KEY (server, id)
    );
    CREATE INDEX IF NOT EXISTS idx_wt_name ON world_types(server, name);
    CREATE TABLE IF NOT EXISTS solarsystems (
      server     TEXT NOT NULL,
      id         INTEGER NOT NULL,
      name       TEXT NOT NULL,
      data_json  TEXT NOT NULL,
      updated_ms INTEGER NOT NULL,
      PRIMARY KEY (server, id)
    );
    CREATE INDEX IF NOT EXISTS idx_ss_name ON solarsystems(server, name);
    CREATE TABLE IF NOT EXISTS tribes (
      server     TEXT NOT NULL,
      id         INTEGER NOT NULL,
      name       TEXT NOT NULL,
      data_json  TEXT NOT NULL,
      updated_ms INTEGER NOT NULL,
      PRIMARY KEY (server, id)
    );
  `);
  // Idempotent migration: add content_json/obj_type to pre-existing tables
  // (CREATE TABLE IF NOT EXISTS won't add columns to an existing table).
  const cols = db.prepare(`PRAGMA table_info(owned_objects)`).all().map((c) => c.name);
  if (!cols.includes("content_json")) db.exec(`ALTER TABLE owned_objects ADD COLUMN content_json TEXT`);
  if (!cols.includes("obj_type"))     db.exec(`ALTER TABLE owned_objects ADD COLUMN obj_type TEXT`);
  const walletStateCols = db.prepare(`PRAGMA table_info(wallet_sync_state)`).all().map((c) => c.name);
  if (!walletStateCols.includes("balances_json")) db.exec(`ALTER TABLE wallet_sync_state ADD COLUMN balances_json TEXT`);
  return db;
}

// ── L2 catalog helpers (2026-07-19 data-path refactor) ─────────────────────

const CATALOG_TABLES = new Set(["world_types", "solarsystems", "tribes"]);

function assertCatalogTable(table) {
  if (!CATALOG_TABLES.has(table)) throw new Error(`bad catalog table: ${table}`);
}

export function upsertCatalogRows(db, table, server, items) {
  assertCatalogTable(table);
  if (!items.length) return 0;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO ${table} (server, id, name, data_json, updated_ms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(server, id) DO UPDATE SET
      name = excluded.name, data_json = excluded.data_json, updated_ms = excluded.updated_ms
  `);
  const tx = db.transaction((rows) => {
    let n = 0;
    for (const it of rows) {
      if (it == null || it.id == null) continue;
      stmt.run(server, Number(it.id), String(it.name ?? ""), JSON.stringify(it), now);
      n++;
    }
    return n;
  });
  return tx(items);
}

export function getCatalogById(db, table, server, id) {
  assertCatalogTable(table);
  const r = db.prepare(`SELECT data_json FROM ${table} WHERE server = ? AND id = ?`).get(server, Number(id));
  return r ? JSON.parse(r.data_json) : null;
}

export function listCatalog(db, table, server, { limit = 100, offset = 0, q = "" } = {}) {
  assertCatalogTable(table);
  const qLc = String(q || "").trim().toLowerCase();
  let where = "server = ?";
  const args = [server];
  if (qLc) { where += " AND LOWER(name) LIKE ?"; args.push(`%${qLc}%`); }
  const total = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args).n;
  const rows = db.prepare(`SELECT data_json FROM ${table} WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  return { total, items: rows.map((r) => JSON.parse(r.data_json)) };
}

export function countCatalog(db, table, server) {
  assertCatalogTable(table);
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE server = ?`).get(server).n;
}

// ── Owned-objects helpers (2026-07-19) ──────────────────────────────────────

export function upsertOwnedObjects(db, rows) {
  if (!rows.length) return 0;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO owned_objects (server, object_id, owner, owner_kind, type_full, type_module, type_struct, pkg, authorized_object_id, content_json, obj_type, version, deleted, first_seen_ms, last_seen_ms)
    VALUES (@server, @object_id, @owner, @owner_kind, @type_full, @type_module, @type_struct, @pkg, @authorized_object_id, @content_json, @obj_type, @version, 0, @now, @now)
    ON CONFLICT(server, object_id) DO UPDATE SET
      owner                = excluded.owner,
      owner_kind           = excluded.owner_kind,
      type_full            = excluded.type_full,
      type_module          = excluded.type_module,
      type_struct          = excluded.type_struct,
      pkg                  = excluded.pkg,
      authorized_object_id = excluded.authorized_object_id,
      content_json         = excluded.content_json,
      obj_type             = excluded.obj_type,
      version              = excluded.version,
      deleted              = 0,
      last_seen_ms         = excluded.last_seen_ms
  `);
  const tx = db.transaction((items) => {
    let n = 0;
    for (const r of items) {
      stmt.run({
        server:               r.server,
        object_id:            r.object_id,
        owner:                r.owner,
        owner_kind:           r.owner_kind || "address",
        type_full:            r.type_full,
        type_module:          r.type_module,
        type_struct:          r.type_struct,
        pkg:                  r.pkg || "",
        authorized_object_id: r.authorized_object_id || null,
        content_json:         r.content_json || null,
        obj_type:             r.obj_type || null,
        version:              r.version ?? 0,
        now,
      });
      n++;
    }
    return n;
  });
  return tx(rows);
}

export function markOwnedDeleted(db, server, objectIds) {
  if (!objectIds.length) return 0;
  const now = Date.now();
  const stmt = db.prepare(`UPDATE owned_objects SET deleted = 1, last_seen_ms = ? WHERE server = ? AND object_id = ?`);
  const tx = db.transaction((ids) => {
    let n = 0;
    for (const id of ids) { stmt.run(now, server, id); n++; }
    return n;
  });
  return tx(objectIds);
}

// Resolve an owner's OwnerCaps AND the full content of the structures they
// control, in ONE query (join on authorized_object_id). This is the robust
// path for the dApp's structure discovery: caps are owned by the character,
// but the structures themselves are SHARED objects (owner='shared'), so they
// can't be found by owner=char. This resolver bridges that gap entirely from
// the index — no per-structure RPC fan-out (the flaky step that dropped
// structures every refresh). Returns one row per cap with the structure's
// object_id, type, and content_json inlined.
export function getOwnedStructuresViaCap(db, server, owner, opts = {}) {
  const { typeLike, includeDeleted = false } = opts;
  let sql = `
    SELECT cap.object_id       AS cap_id,
           cap.type_full       AS cap_type,
           cap.authorized_object_id AS struct_id,
           s.type_full         AS struct_type,
           s.type_module       AS struct_module,
           s.type_struct       AS struct_struct,
           s.content_json      AS content_json,
           s.version           AS struct_version
    FROM owned_objects cap
    LEFT JOIN owned_objects s
      ON s.server = cap.server AND s.object_id = cap.authorized_object_id
         AND s.deleted = 0
    WHERE cap.server = ? AND cap.owner = ? AND cap.type_struct = 'OwnerCap'`;
  const args = [server, owner];
  // 2026-07-19 (fable review C-1): exclude deleted caps AND join only to
  // non-deleted structures (the `AND s.deleted = 0` in the JOIN condition).
  // A dismantled structure's cap is swept deleted -> excluded here; a
  // dismantled structure whose cap somehow lingers joins to NULL content ->
  // the server handler drops fields===null rows.
  if (!includeDeleted) sql += ` AND cap.deleted = 0`;
  if (typeLike) { sql += ` AND cap.type_full LIKE ?`; args.push(`%${typeLike}%`); }
  return db.prepare(sql).all(...args);
}

// 2026-07-19: resolve a WALLET to its LIVE Character entirely from the index,
// bypassing the flaky public RPC (which was returning NULL_RESULT for the
// PlayerProfile query -> casino/panels showed "No live Character found").
// `characters` table is keyed by character_addr (= wallet); `owned_objects`
// carries each Character's Sui object version. Join them, pick the highest
// version = the live identity (older = destroyed/rerolled). Returns
// { characterId, tribeId, name } or null.
export function resolveLiveCharacterByWallet(db, server, wallet) {
  const rows = db.prepare(`
    SELECT c.object_id AS object_id, c.name AS name, c.tribe_id AS tribe_id,
           COALESCE(o.version, 0) AS version
    FROM characters c
    LEFT JOIN owned_objects o
      ON o.server = c.server AND o.object_id = c.object_id AND o.deleted = 0
    WHERE c.server = ? AND c.character_addr = ?
  `).all(server, wallet);
  if (!rows.length) return null;
  rows.sort((a, b) => (b.version || 0) - (a.version || 0));
  const live = rows[0];
  return { characterId: live.object_id, tribeId: live.tribe_id, name: live.name, version: live.version };
}

// Query owned objects for an owner, optionally filtered by type module/struct.
export function getOwnedObjects(db, server, owner, opts = {}) {
  const { module: mod, struct, typeLike, includeDeleted = false } = opts;
  let sql = `SELECT object_id, owner, owner_kind, type_full, type_module, type_struct, pkg, authorized_object_id, content_json, obj_type, version
             FROM owned_objects WHERE server = ? AND owner = ?`;
  const args = [server, owner];
  if (!includeDeleted) sql += ` AND deleted = 0`;
  if (mod)    { sql += ` AND type_module = ?`; args.push(mod); }
  if (struct) { sql += ` AND type_struct = ?`; args.push(struct); }
  // typeLike lets callers disambiguate generics, e.g. OwnerCap<...NetworkNode>
  // vs OwnerCap<...Assembly> (both type_struct='OwnerCap'). Matches a
  // substring of the full canonical type. Critical for the dApp, which queries
  // each OwnerCap<T> separately and tags results by T's kind — without this the
  // index returns ALL caps for every query and every structure gets mis-tagged
  // as the first kind, flattening the mother/daughter hierarchy.
  if (typeLike) { sql += ` AND type_full LIKE ?`; args.push(`%${typeLike}%`); }
  return db.prepare(sql).all(...args);
}

export function countOwnedObjects(db, server) {
  return db.prepare(`SELECT COUNT(*) AS n FROM owned_objects WHERE server = ? AND deleted = 0`).get(server)?.n ?? 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function upsertCharacters(db, rows) {
  if (!rows.length) return 0;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO characters (server, object_id, character_addr, name, name_lc, tribe_id, item_id, pkg_origin, first_seen_ms, last_seen_ms)
    VALUES (@server, @object_id, @character_addr, @name, @name_lc, @tribe_id, @item_id, @pkg_origin, @now, @now)
    ON CONFLICT(server, object_id) DO UPDATE SET
      character_addr = excluded.character_addr,
      name           = excluded.name,
      name_lc        = excluded.name_lc,
      tribe_id       = excluded.tribe_id,
      item_id        = excluded.item_id,
      pkg_origin     = excluded.pkg_origin,
      last_seen_ms   = excluded.last_seen_ms
  `);
  const tx = db.transaction((items) => {
    let n = 0;
    for (const r of items) {
      stmt.run({
        server:         r.server,
        object_id:      r.object_id,
        character_addr: r.character_addr,
        name:           r.name,
        name_lc:        (r.name || "").toLowerCase(),
        tribe_id:       r.tribe_id ?? 0,
        item_id:        r.item_id || "",
        pkg_origin:     r.pkg_origin || "active",
        now,
      });
      n++;
    }
    return n;
  });
  return tx(rows);
}

export function getState(db, key) {
  const r = db.prepare("SELECT value FROM indexer_state WHERE key = ?").get(key);
  return r ? r.value : null;
}

export function setState(db, key, value) {
  db.prepare(`
    INSERT INTO indexer_state (key, value, updated_ms) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_ms = excluded.updated_ms
  `).run(key, String(value), Date.now());
}

export function searchByPrefix(db, server, q, limit) {
  // Case-insensitive substring on name + suffix on character_addr + suffix on object_id.
  // Order: exact name match first, then prefix, then substring; secondary by name length.
  const qLc = q.toLowerCase();
  const wildcard = `%${qLc}%`;
  // Single SQL with computed rank.
  return db.prepare(`
    SELECT object_id, character_addr, name, tribe_id, item_id,
      CASE
        WHEN name_lc = ?            THEN 0
        WHEN name_lc LIKE ? || '%'  THEN 1
        ELSE 2
      END AS rank
    FROM characters
    WHERE server = ?
      AND ( name_lc LIKE ?
         OR character_addr LIKE ?
         OR object_id LIKE ? )
    ORDER BY rank, LENGTH(name) ASC
    LIMIT ?
  `).all(qLc, qLc, server, wildcard, `%${qLc}%`, `%${qLc}%`, limit);
}

export function listAll(db, server, limit) {
  return db.prepare(`
    SELECT object_id, character_addr, name, tribe_id, item_id
    FROM characters WHERE server = ?
    ORDER BY name COLLATE NOCASE ASC
    LIMIT ?
  `).all(server, limit);
}

export function countRows(db, server) {
  return db.prepare("SELECT COUNT(*) AS n FROM characters WHERE server = ?").get(server).n;
}

// ── Killmails ──────────────────────────────────────────────────────────────────────

export function insertKillmails(db, rows) {
  if (!rows.length) return 0;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO killmails
      (server, tx_digest, event_seq, kill_timestamp, block_time_ms, key_item_id,
       killer_item_id, victim_item_id, reported_by_item_id, solar_system_id, loss_type)
    VALUES (@server, @tx_digest, @event_seq, @kill_timestamp, @block_time_ms, @key_item_id,
            @killer_item_id, @victim_item_id, @reported_by_item_id, @solar_system_id, @loss_type)
  `);
  const tx = db.transaction((items) => {
    let n = 0;
    for (const r of items) n += stmt.run(r).changes;
    return n;
  });
  return tx(rows);
}

export function countKills(db, server) {
  return db.prepare("SELECT COUNT(*) AS n FROM killmails WHERE server = ?").get(server).n;
}

// Kills newest-first with killer/victim names + tribe ids pre-joined from the
// characters table in the same DB. `sinceTs` (unix seconds) bounds the window
// (0 = all). Optional `q` does a case-insensitive substring match on killer
// name, victim name, or either item_id — server-side equivalent of the kill
// feed's search box. Character item_ids are unique per Character (destroyed +
// recreated characters get NEW item_ids), but we still dedupe defensively by
// picking the most-recently-seen row per item_id.
export function queryKills(db, server, { sinceTs = 0, limit = 2000, q = "" } = {}) {
  const qLc = q.trim().toLowerCase();
  const wildcard = `%${qLc}%`;
  const base = `
    WITH ch AS (
      SELECT item_id, name, tribe_id, MAX(last_seen_ms) AS _ls
      FROM characters WHERE server = @server AND item_id != ''
      GROUP BY item_id
    )
    SELECT k.tx_digest, k.event_seq, k.kill_timestamp, k.block_time_ms, k.key_item_id,
           k.killer_item_id, k.victim_item_id, k.reported_by_item_id,
           k.solar_system_id, k.loss_type,
           ck.name AS killer_name, ck.tribe_id AS killer_tribe_id,
           cv.name AS victim_name, cv.tribe_id AS victim_tribe_id
    FROM killmails k
    LEFT JOIN ch ck ON ck.item_id = k.killer_item_id
    LEFT JOIN ch cv ON cv.item_id = k.victim_item_id
    WHERE k.server = @server AND k.kill_timestamp >= @sinceTs`;
  const search = qLc
    ? ` AND (LOWER(COALESCE(ck.name,'')) LIKE @wildcard
         OR LOWER(COALESCE(cv.name,'')) LIKE @wildcard
         OR k.killer_item_id LIKE @wildcard
         OR k.victim_item_id LIKE @wildcard)`
    : "";
  const rows = db.prepare(
    base + search + " ORDER BY k.kill_timestamp DESC LIMIT @limit"
  ).all({ server, sinceTs, limit, ...(qLc ? { wildcard } : {}) });
  return rows;
}
