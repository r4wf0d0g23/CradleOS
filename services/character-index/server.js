// HTTP server for the CradleOS Character index.
//
//   GET /health                          → simple liveness
//   GET /character-search?q=&server=     → search results
//   GET /character-count?server=         → row counts
//   GET /character-by-id?id=...&server=  → exact lookup
//   POST /character-bulk-by-item-ids       → batch resolve item_ids → names
//   GET /character-list?cursor=&limit=&server=  → paginated full corpus dump
//   GET /characters-by-tribe?server=&tribe_id=&limit=  → tribe roster lookup
//   POST /character-bulk-by-character-addrs  → batch resolve in-game character addresses
//
// All search responses are served from SQLite (which lives in this process's
// FS). The indexer runs in the same process on a 60s interval, plus an
// optional cold-start backfill if --backfill-on-start is passed.

import express from "express";
import { openDb, searchByPrefix, listAll, countRows, countKills, queryKills, getState, getOwnedObjects, countOwnedObjects, getOwnedStructuresViaCap, resolveLiveCharacterByWallet, getCatalogById, listCatalog, countCatalog } from "./db.js";
import { backfillServer, pollIncrement, backfillKills, pollKillsIncrement, backfillOwned, pollOwnedIncrement, syncWorldCatalogs, WORLD_API, STILLNESS_WORLD } from "./indexer.js";
import { OwnershipCache } from "./ownership-cache.js";
import { OwnershipGrpc } from "./ownership-grpc.js";
import { OwnershipRouter } from "./ownership-router.js";
import { IndexedReads, INDEXED_METHODS } from "./indexed-reads.js";
import { installOriginsMediaProxy } from "./origins-media-proxy.js";

const PUBLIC_GRAPHQL = process.env.SUI_GRAPHQL_URL || "https://graphql.testnet.sui.io/graphql";

const PORT = Number(process.env.PORT || 8004);
// 2026-07-08: Utopia disabled per Raw — not in use for the foreseeable future.
// Existing utopia rows remain in the DB; API calls with server=utopia now get
// "bad server", and the 60s poll loop skips it. Restore by re-adding "utopia".
const SERVERS = ["stillness"];

const db = openDb();
if (getState(db, "world:stillness") !== STILLNESS_WORLD) throw new Error("Index database world origin mismatch; backfill the isolated Cycle 7 database first");
const ownershipCache = new OwnershipCache(db);
const ownershipGrpc = new OwnershipGrpc();
const ownershipRouter = new OwnershipRouter(ownershipGrpc, ownershipCache);
const indexedReads = new IndexedReads({ objectReader: async objectId => {
  // Object content is ledger data (not an indexed listing). Preserve the RPC
  // struct encoding existing clients expect, using the loopback-only proxy.
  const r = await fetch("http://127.0.0.1:8002/", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({jsonrpc:"2.0",id:1,method:"sui_getObject",params:[objectId,{showContent:true,showType:true,showOwner:true}]}), signal:AbortSignal.timeout(20000) });
  const j = await r.json(); if(!r.ok || j.error || !j.result) throw new Error(j.error?.message || "Object read unavailable"); return j.result;
}});
const app = express();
app.use(express.json());

const OWNERSHIP_METHODS = new Set([
  "suix_getOwnedObjects", "suix_getCoins", "suix_getAllCoins",
  "suix_getBalance", "suix_getAllBalances",
]);
function isLoopback(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}
function requireLoopback(req, res, next) {
  if (!isLoopback(req)) return res.status(403).json({ error: 'local endpoint' });
  next();
}

// Specialized JSON-RPC adapter for the caching proxy. Unknown methods are
// rejected so a routing mistake cannot silently turn this into a partial node.
app.post("/ownership-rpc", requireLoopback, async (req, res) => {
  const calls = Array.isArray(req.body) ? req.body : [req.body];
  const replies = await Promise.all(calls.map(async (call) => {
    if (!call || !OWNERSHIP_METHODS.has(call.method) && !INDEXED_METHODS.has(call.method)) {
      return { jsonrpc: "2.0", id: call?.id ?? null, error: { code: -32601, message: "ownership method not supported" } };
    }
    try {
      return { jsonrpc: "2.0", id: call.id ?? null, result: await (INDEXED_METHODS.has(call.method) ? indexedReads : ownershipRouter).handle(call.method, call.params || []) };
    } catch (error) {
      return { jsonrpc: "2.0", id: call.id ?? null, error: { code: -32010, message: `ownership providers unavailable: ${error.message}` } };
    }
  }));
  res.json(Array.isArray(req.body) ? replies : replies[0]);
});

app.post("/ownership-refresh", requireLoopback, async (req, res) => {
  try { res.json({ ok: true, state: await ownershipCache.ensureFresh(req.body?.owner, { force: true }) }); }
  catch (error) { res.status(502).json({ ok: false, error: error.message }); }
});
app.get("/ownership-health", (_req, res) => res.json({
  ok: true, primary: { provider: 'local-sui-grpc', url: ownershipGrpc.url },
  fallback: { provider: 'alchemy-recovery-cache', ...ownershipCache.health() },
  stats: ownershipRouter.stats,
}));

// Proactively refresh recently-used wallets. This bounds user-facing cold
// refreshes without walking every historical character wallet or wasting paid
// Alchemy capacity. Requests remain the source of truth for the hot set.
const OWNERSHIP_HOT_REFRESH_MS = Number(process.env.OWNERSHIP_HOT_REFRESH_MS || 60_000);
let hotRefreshRunning = false;
async function refreshHotWallets() {
  if (hotRefreshRunning) return;
  hotRefreshRunning = true;
  try {
    const cutoff = Date.now() - 3_600_000;
    const staleBefore = Date.now() - ownershipCache.ttlMs;
    const rows = db.prepare(`SELECT owner FROM wallet_sync_state
      WHERE last_access_ms >= ? AND last_ok_ms < ? ORDER BY last_access_ms DESC LIMIT 20`).all(cutoff, staleBefore);
    for (const row of rows) {
      try { await ownershipCache.ensureFresh(row.owner, { force: true }); }
      catch (error) { console.error(`[ownership-refresh] ${row.owner.slice(0, 10)}…: ${error.message}`); }
    }
  } finally { hotRefreshRunning = false; }
}
setInterval(refreshHotWallets, OWNERSHIP_HOT_REFRESH_MS).unref();

// CORS — allow only the published dApp origins. The browser does CORS
// preflight against the public Cloudflare ingress, not directly against this
// origin (DGX2 tail-net hostname), so the CF rule must mirror this list.
// Adding here for defense-in-depth + dev-server cases.
const ALLOWED_ORIGINS = new Set([
  "https://r4wf0d0g23.github.io",
  "https://cradleos.io",
  "https://www.cradleos.io",
  "https://spark-2def.tail587192.ts.net:4173",
  "http://localhost:5173",
  "http://localhost:4173",
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // 2026-07-19: robust cross-origin support for the owned-objects index so the
  // dApp can call it from ANY deploy target (cradleos.io same-origin via Pages
  // Function, github.io mirror cross-origin, and the in-game EVE Vault webview).
  //   - Allow-listed origins get echoed back (credentialed-safe).
  //   - The EVE Vault webview often sends Origin: null (or none) — for a
  //     read-only public index that's safe to serve with a wildcard.
  //   - Access-Control-Allow-Private-Network: true is MANDATORY when a
  //     public-origin page (github.io) hits a CGNAT/tunnel-fronted endpoint;
  //     Chrome Private Network Access blocks the request otherwise (per
  //     TOOLS.md 2026-05-03 tail-net/PNA lesson).
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  } else {
    // No/'null'/unknown origin (in-game webview, curl) — read-only public data.
    res.set("Access-Control-Allow-Origin", "*");
  }
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────

// Routes mirror under /index/* so the same service can be reached either
// directly (DGX2 localhost) or via the Cloudflare ingress on DGX1
// (`keeper.reapers.shop/index/*`) without a prefix-strip in cloudflared.
app.use((req, res, next) => {
  if (req.url.startsWith("/index/")) req.url = req.url.slice("/index".length);
  else if (req.url === "/index") req.url = "/";
  next();
});

// ── Reverse-proxy passthroughs (2026-07-19 data-path refactor) ─────────────
// keeper.reapers.shop/world/* and /graphql broke when cradleos-agent dropped
// them; this service now fronts them (CF ingress /world* + /graphql* → :8004).
// Thin passthroughs: same body, same status, CORS handled by the middleware
// above. Authorization is forwarded for the per-player authed world-api calls
// (/v2/characters/me/*), which can't be pre-indexed.
async function proxyTo(upstreamBase, req, res, pathAndQuery) {
  try {
    const headers = { accept: "application/json" };
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    const init = { method: req.method, headers, signal: AbortSignal.timeout(30_000) };
    if (req.method !== "GET" && req.method !== "HEAD") {
      headers["content-type"] = req.headers["content-type"] || "application/json";
      init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    }
    const r = await fetch(upstreamBase + pathAndQuery, init);
    res.status(r.status);
    res.set("Content-Type", r.headers.get("content-type") || "application/json");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: `upstream ${upstreamBase}: ${e.message}` });
  }
}
app.use("/world", (req, res) => proxyTo(WORLD_API, req, res, req.url === "/" ? "" : req.url));
app.all("/graphql", (req, res) => proxyTo(PUBLIC_GRAPHQL, req, res, ""));
installOriginsMediaProxy(app);

// ── L2 static-data catalog endpoints (2026-07-19) ───────────────────────
// Served from SQLite mirrors of the world-api catalogs. Response shapes match
// the live world-api exactly ({data,metadata} for lists, bare object for
// ?id=), so the dApp swap is mechanical. Reachable directly and via the CF
// /index/* wildcard (the /index prefix-strip middleware above handles both).
function catalogHandler(table) {
  return (req, res) => {
    const server = String(req.query.server || "stillness");
    if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
    if (req.query.id != null) {
      const item = getCatalogById(db, table, server, req.query.id);
      if (!item) return res.status(404).json({ error: "not found" });
      return res.json(item);
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "100"), 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);
    const q = String(req.query.q || "");
    const { total, items } = listCatalog(db, table, server, { limit, offset, q });
    res.json({ data: items, metadata: { total, limit, offset } });
  };
}
app.get("/world-types",  catalogHandler("world_types"));
app.get("/solarsystems", (_req, res) => res.status(410).json({error: "Public universe data retired in Cycle 7"}));
app.get("/tribes",       catalogHandler("tribes"));

app.get("/health", (req, res) => {
  const out = { ok: true, ts: Date.now(), cycle: 7, worldPackage: "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92" };
  for (const s of SERVERS) {
    out[s] = {
      count: countRows(db, s),
      kills: countKills(db, s),
      last_backfill_ms: Number(getState(db, `backfill:${s}:last_run_ms`) || 0),
      last_poll_ms:     Number(getState(db, `poll:${s}:last_run_ms`) || 0),
      last_kills_poll_ms: Number(getState(db, `kills-poll:${s}:last_run_ms`) || 0),
      catalogs: {
        world_types:  countCatalog(db, "world_types", s),
        solarsystems: countCatalog(db, "solarsystems", s),
        tribes:       countCatalog(db, "tribes", s),
        last_ok_ms:   Number(getState(db, `catalog:${s}:last_ok_ms`) || 0),
      },
    };
  }
  res.json(out);
});

app.get("/character-count", (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  res.json({ server, count: countRows(db, server) });
});

app.get("/character-search", (req, res) => {
  const q = String(req.query.q || "").trim();
  const server = String(req.query.server || "stillness");
  const limit = Math.min(Number(req.query.limit || 50), 200);
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });

  if (q === "*") {
    const matches = listAll(db, server, limit);
    return res.json({ server, q, limit, total: countRows(db, server), matches });
  }
  if (q.length < 2) return res.json({ server, q, limit, total: 0, matches: [] });
  const matches = searchByPrefix(db, server, q, limit);
  res.json({ server, q, limit, total: countRows(db, server), matches });
});

app.get("/character-by-id", (req, res) => {
  const id = String(req.query.id || "");
  const server = String(req.query.server || "stillness");
  if (!id || !SERVERS.includes(server)) return res.status(400).json({ error: "bad id or server" });
  const row = db.prepare("SELECT object_id, character_addr, name, tribe_id, item_id FROM characters WHERE server = ? AND object_id = ?").get(server, id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// 2026-07-19: resolve a WALLET -> its LIVE Character from the index (bypasses
// the flaky public RPC PlayerProfile query that returned NULL_RESULT and made
// the casino/panels show "No live Character found"). Exposes `stale` like
// /owned-structures so the dApp can fall back to RPC if the index is behind.
// Staleness threshold (module-scoped so both this and ownedStructuresHandler
// use it; const isn't hoisted, so it must be declared before first use).
const OWNED_STALE_MS = Number(process.env.OWNED_STALE_MS || 15 * 60 * 1000);
const resolveCharacterHandler = (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  const wallet = String(req.query.wallet || req.query.owner || "").trim();
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const live = resolveLiveCharacterByWallet(db, server, wallet);
  // 2026-07-27 FIX: this handler answers from the `characters` table, which the
  // incremental CharacterCreatedEvent poller keeps current (seconds old). It was
  // reading its freshness from `owned_backfill_ok_ms_${server}` -- the OWNED-OBJECTS
  // sweep watermark, a different subsystem that had been cold ~5 days. That stamped
  // stale:true on correct answers, the dApp discarded them (lib.ts
  // _resolveCharacterFromIndex: `if (json.stale === true) return null`), and every
  // casino game showed "No live Character found for this wallet".
  // Character freshness must come from the character poller, with the last full
  // backfill as the floor for wallets the poller has never seen.
  const pollMs = Number(getState(db, `poll:${server}:last_run_ms`) || 0);
  const backfillMs = Number(getState(db, `backfill:${server}:last_run_ms`) || 0);
  const okMs = Math.max(pollMs, backfillMs);
  const ageMs = okMs ? (Date.now() - okMs) : Infinity;
  const stale = ageMs > OWNED_STALE_MS;
  res.json({ server, wallet, character: live, stale, ageMs: Number.isFinite(ageMs) ? ageMs : null });
};
app.get("/resolve-character", resolveCharacterHandler);
app.get("/character-resolve", resolveCharacterHandler); // CF allow-list alias (/index/character-*)

// Bulk resolve a list of in-game character item_ids (the u32-as-string ids
// surfaced on kill events) to their on-chain Character objects. One round
// trip, sub-50ms for 500 item_ids since idx_item_id covers the lookup.
// Body: { server: "stillness"|"utopia", item_ids: string[] }
// Reply: { server, found: number, missing: string[],
//          characters: { [item_id]: { object_id, character_addr, name, tribe_id, item_id } } }
app.post("/character-bulk-by-item-ids", (req, res) => {
  const body = req.body || {};
  const server = String(body.server || "stillness");
  const itemIdsRaw = body.item_ids;
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  if (!Array.isArray(itemIdsRaw)) return res.status(400).json({ error: "item_ids must be an array" });
  // Defensive: cap at 500 per call. Caller can chunk for larger sets.
  if (itemIdsRaw.length > 500) return res.status(400).json({ error: "too many ids (max 500)" });
  const itemIds = [...new Set(itemIdsRaw.map(String).filter(Boolean))];
  if (itemIds.length === 0) return res.json({ server, found: 0, missing: [], characters: {} });
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT object_id, character_addr, name, tribe_id, item_id FROM characters WHERE server = ? AND item_id IN (${placeholders})`
  ).all(server, ...itemIds);
  const characters = {};
  for (const r of rows) characters[r.item_id] = r;
  const missing = itemIds.filter(id => !(id in characters));
  res.json({ server, found: rows.length, missing, characters });
});

// Paginated full corpus dump. Cursor is an opaque base64-encoded object_id
// of the last row in the previous page. Pages are ordered by object_id ASC
// so a stable scan never skips rows even when new chars get inserted.
// Use case: autocomplete UIs that want every Character ever created on
// this server warmed up at startup.
app.get("/character-list", (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "500"), 10) || 500, 1), 1000);
  const cursorRaw = String(req.query.cursor || "");
  let cursor = "";
  if (cursorRaw) {
    try { cursor = Buffer.from(cursorRaw, "base64").toString("utf8"); }
    catch { return res.status(400).json({ error: "bad cursor" }); }
  }
  const rows = cursor
    ? db.prepare(
        "SELECT object_id, character_addr, name, tribe_id, item_id FROM characters WHERE server = ? AND object_id > ? ORDER BY object_id ASC LIMIT ?"
      ).all(server, cursor, limit)
    : db.prepare(
        "SELECT object_id, character_addr, name, tribe_id, item_id FROM characters WHERE server = ? ORDER BY object_id ASC LIMIT ?"
      ).all(server, limit);
  const last = rows[rows.length - 1];
  const nextCursor = rows.length >= limit && last
    ? Buffer.from(last.object_id, "utf8").toString("base64")
    : null;
  res.json({ server, count: rows.length, rows, nextCursor, hasMore: !!nextCursor });
});

// Tribe roster lookup. Returns every Character belonging to the requested
// tribe on the requested server. The (server, tribe_id) index covers this
// in O(log n) lookup + result-size traversal — sub-50ms warm even for the
// largest tribes. Limit caps at 5000 since some tribes have thousands of
// members and we don't want to OOM the client.
app.get("/characters-by-tribe", (req, res) => {
  const server = String(req.query.server || "stillness");
  const tribeIdRaw = String(req.query.tribe_id || "");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  const tribeId = parseInt(tribeIdRaw, 10);
  if (!Number.isFinite(tribeId) || tribeId <= 0) {
    return res.status(400).json({ error: "bad tribe_id" });
  }
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "1000"), 10) || 1000, 1), 5000);
  const rows = db.prepare(
    "SELECT object_id, character_addr, name, tribe_id, item_id FROM characters WHERE server = ? AND tribe_id = ? ORDER BY name COLLATE NOCASE ASC LIMIT ?"
  ).all(server, tribeId, limit);
  res.json({ server, tribe_id: tribeId, count: rows.length, rows });
});

// Bulk resolve in-game character addresses (the 32-byte address stored on
// Character.character_address). Mirror of /character-bulk-by-item-ids but
// keyed on character_addr instead. The (server, character_addr) index
// already exists.
// Body: { server: "stillness"|"utopia", character_addrs: string[] }
// Reply: { server, found, missing, characters: { [character_addr]: row } }
app.post("/character-bulk-by-character-addrs", (req, res) => {
  const body = req.body || {};
  const server = String(body.server || "stillness");
  const addrsRaw = body.character_addrs;
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  if (!Array.isArray(addrsRaw)) return res.status(400).json({ error: "character_addrs must be an array" });
  if (addrsRaw.length > 500) return res.status(400).json({ error: "too many addrs (max 500)" });
  // Normalize: lowercase and dedupe. Sui addresses are case-insensitive but
  // stored lowercased; callers may pass either.
  const addrs = [...new Set(addrsRaw.map(a => String(a || "").toLowerCase()).filter(Boolean))];
  if (addrs.length === 0) return res.json({ server, found: 0, missing: [], characters: {} });
  // character_addr can have multiple Character rows if a player destroys and
  // re-creates a Character on the same in-game address (post-wipe reroll, etc).
  // Return the NEWEST per character_addr by first_seen_ms — destroyed Characters
  // stay on chain but should never be surfaced as the canonical identity.
  // Same semantics as findLatestCharacterForWallet in the dApp.
  const placeholders = addrs.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT object_id, character_addr, name, tribe_id, item_id, first_seen_ms FROM characters WHERE server = ? AND character_addr IN (${placeholders}) ORDER BY first_seen_ms DESC`
  ).all(server, ...addrs);
  const characters = {};
  for (const r of rows) {
    const key = r.character_addr.toLowerCase();
    if (!(key in characters)) {
      // Strip first_seen_ms from the wire shape — it's an internal field
      // used only for this dedupe ordering.
      characters[key] = {
        object_id: r.object_id,
        character_addr: r.character_addr,
        name: r.name,
        tribe_id: r.tribe_id,
        item_id: r.item_id,
      };
    }
  }
  const missing = addrs.filter(a => !(a in characters));
  res.json({ server, found: Object.keys(characters).length, missing, characters });
});

// Killmail feed — kills newest-first with killer/victim names + tribe ids
// pre-joined from the characters table (one query, no client-side resolve
// fanout). The killmails table is fed from the LOCAL fullnode (the only
// complete source — public proxies prune old tx events and poison deep
// pagination), so this endpoint serves the FULL history.
//   GET /kills?server=stillness&since=<unixSeconds>&limit=N&q=<name substring>
// Reply: { server, total, count, kills: [...] }
app.get("/kills", (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  const sinceTs = Math.max(parseInt(String(req.query.since || "0"), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "2000"), 10) || 2000, 1), 5000);
  const q = String(req.query.q || "");
  const kills = queryKills(db, server, { sinceTs, limit, q });
  res.json({ server, total: countKills(db, server), count: kills.length, kills });
});

// ── Owned-objects endpoints (2026-07-19) ───────────────────────────────────
// Drop-in replacement for suix_getOwnedObjects for EVE Frontier types. Query
// by owner (wallet address OR character object id), optionally filtered by
// type module/struct. Served from the local SQLite index — sub-ms, no rate
// limit, complete (the fullnode's native index is incomplete post-snapshot).
// 2026-07-19: registered under BOTH /owned-objects and /character-owned. The
// Cloudflare token-tunnel forwards a fixed allow-list of paths (all the
// /index/character-* paths route; brand-new paths 404 until added in the CF
// dashboard). Aliasing under /character-owned* lets the owned-objects index go
// public immediately via the already-allowed /index/character-* prefix, with
// no dashboard change. /owned-* kept for direct/local + future CF wildcard.
const ownedObjectsHandler = (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  const owner = String(req.query.owner || "").trim();
  if (!owner) return res.status(400).json({ error: "owner required" });
  const mod = req.query.module ? String(req.query.module) : undefined;
  const struct = req.query.struct ? String(req.query.struct) : undefined;
  // typeLike disambiguates OwnerCap<NetworkNode> vs OwnerCap<Assembly> etc.
  const typeLike = req.query.typeLike ? String(req.query.typeLike) : undefined;
  const rows = getOwnedObjects(db, server, owner, { module: mod, struct, typeLike });
  res.json({ server, owner, count: rows.length, objects: rows });
};

// Combined resolver: owner's OwnerCaps + the FULL content of the structures
// they control, in one call. The robust structure-discovery path — no flaky
// per-structure RPC fan-out. Returns rows: { capId, structureId, kind,
// typeFull, fields (parsed content_json) }.
const ownedStructuresHandler = (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  const owner = String(req.query.owner || "").trim();
  if (!owner) return res.status(400).json({ error: "owner required" });
  const typeLike = req.query.typeLike ? String(req.query.typeLike) : undefined;
  const rows = getOwnedStructuresViaCap(db, server, owner, { typeLike });
  const structures = rows.map((r) => {
    let fields = null;
    if (r.content_json) { try { fields = JSON.parse(r.content_json); } catch { fields = null; } }
    return {
      capId: r.cap_id,
      structureId: r.struct_id,
      capType: r.cap_type,
      typeFull: r.struct_type,
      typeModule: r.struct_module,
      typeStruct: r.struct_struct,
      version: r.struct_version,
      fields,                 // full structure content.fields, or null if not resolved
    };
  });
  // 2026-07-19 (fable review C-2): expose staleness so the dApp can fall back to
  // RPC when the index hasn't had a fully-successful pass recently (a type's
  // enumeration has been persistently failing). okMs = last FULLY-successful
  // pass; attemptMs = last attempted pass (may be partial).
  const okMs = Number(getState(db, `owned_backfill_ok_ms_${server}`) || 0);
  const attemptMs = Number(getState(db, `owned_backfill_ms_${server}`) || 0);
  const ageMs = okMs ? (Date.now() - okMs) : Infinity;
  const stale = ageMs > OWNED_STALE_MS;
  res.json({ server, owner, count: structures.length, structures, stale, lastOkMs: okMs, lastAttemptMs: attemptMs, ageMs: Number.isFinite(ageMs) ? ageMs : null });
};
const ownedCountHandler = (req, res) => {
  const server = String(req.query.server || "stillness");
  if (!SERVERS.includes(server)) return res.status(400).json({ error: "bad server" });
  res.json({ server, total: countOwnedObjects(db, server) });
};
app.get("/owned-objects", ownedObjectsHandler);
app.get("/owned-count", ownedCountHandler);
app.get("/owned-structures", ownedStructuresHandler);   // caps + full structure content, one call
app.get("/character-owned", ownedObjectsHandler);        // CF allow-list alias
app.get("/character-owned-count", ownedCountHandler);    // CF allow-list alias
app.get("/character-owned-structures", ownedStructuresHandler); // CF allow-list alias

// ── Background poller ─────────────────────────────────────────────────────

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 60_000);
const OWNED_POLL_INTERVAL_MS = Number(process.env.OWNED_POLL_INTERVAL_MS || 300_000);
let pollInFlight = false;
async function runPollOnce() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    for (const s of SERVERS) {
      try { await pollIncrement(db, s); }
      catch (e) { console.error(`[poll] ${s}: ${e.message}`); }
      try { await pollKillsIncrement(db, s); }
      catch (e) { console.error(`[kills-poll] ${s}: ${e.message}`); }
    }
  } finally { pollInFlight = false; }
}

let ownedPollInFlight = false;
async function runOwnedPollOnce() {
  if (ownedPollInFlight) return;
  ownedPollInFlight = true;
  try {
    for (const s of SERVERS) {
      try { await pollOwnedIncrement(db, s, () => {}); }
      catch (e) { console.error(`[owned-poll] ${s}: ${e.message}`); }
    }
  } finally { ownedPollInFlight = false; }
}

// ── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, process.env.HOST || "127.0.0.1", () => {
  console.log(`[character-index] listening on :${PORT}`);
  for (const s of SERVERS) console.log(`  ${s}: ${countRows(db, s)} chars, ${countKills(db, s)} kills`);

  // One-time kills backfill: if the killmails table is empty for a server,
  // walk the full history from the local fullnode in the background.
  (async () => {
    for (const s of SERVERS) {
      if (countKills(db, s) === 0) {
        try { await backfillKills(db, s); }
        catch (e) { console.error(`[kills-backfill] ${s}: ${e.message}`); }
      }
    }
  })();

  // Optional cold-start backfill — only runs if explicitly requested via env.
  // Normal operation: backfill is run once manually, then poller keeps it fresh.
  if (process.env.BACKFILL_ON_START === "1") {
    (async () => {
      for (const s of SERVERS) {
        try { await backfillServer(db, s); }
        catch (e) { console.error(`[backfill] ${s}: ${e.message}`); }
      }
    })();
  }

  // One-time owned-objects backfill if the index is empty for a server.
  (async () => {
    for (const s of SERVERS) {
      if (countOwnedObjects(db, s) === 0) {
        try { await backfillOwned(db, s); }
        catch (e) { console.error(`[owned-backfill] ${s}: ${e.message}`); }
      }
    }
  })();

  // Poll every 60s after a 30s warmup.
  setTimeout(() => {
    runPollOnce();
    setInterval(runPollOnce, POLL_INTERVAL_MS);
  }, 30_000);

  // L2 catalog sync: backfill on boot if empty, then hourly (catalogs only
  // change on game patches).
  const CATALOG_POLL_MS = Number(process.env.CATALOG_POLL_MS || 3_600_000);
  let catalogInFlight = false;
  const runCatalogSync = async () => {
    if (catalogInFlight) return;
    catalogInFlight = true;
    try {
      for (const s of SERVERS) {
        try { await syncWorldCatalogs(db, s); }
        catch (e) { console.error(`[catalog] ${s}: ${e.message}`); }
      }
    } finally { catalogInFlight = false; }
  };
  runCatalogSync();
  setInterval(runCatalogSync, CATALOG_POLL_MS);

  // Owned-objects re-index every 5min after a 90s warmup (staggered off the
  // char/kills poll to avoid fanning out all GraphQL enumerations at once).
  setTimeout(() => {
    runOwnedPollOnce();
    setInterval(runOwnedPollOnce, OWNED_POLL_INTERVAL_MS);
  }, 90_000);
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT",  () => process.exit(0));
