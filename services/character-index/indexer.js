import { readEvents, collectEventsSince } from "./event-reader.js";
// Cycle 7: new world; use a NEW database. Prior database remains an untouched archive.
// Indexer task — backfills the SQLite character table and increments it
// forward by polling new CharacterCreatedEvent. Runs as a child task inside
// server.js (intervaled) or standalone via `node indexer.js --backfill`.
//
// Data sources:
//   • Initial backfill walks object IDs via PUBLIC Sui GraphQL (the only
//     way to enumerate all current Character objects of a given type).
//   • For each batch of IDs, content is fetched via LOCAL JSON-RPC
//     multiGetObjects (no rate limit, ~30ms per 50 objects).
//   • Incremental polling reads recent CharacterCreatedEvents from the
//     LOCAL JSON-RPC (local fullnode keeps recent events only, which is
//     fine for incrementing).

import { openDb, upsertCharacters, insertKillmails, countKills, getState, setState } from "./db.js";

// ── Config ────────────────────────────────────────────────────────────────

const LOCAL_RPC      = process.env.SUI_LOCAL_RPC   || "http://127.0.0.1:9000";
const PUBLIC_GRAPHQL = process.env.SUI_GRAPHQL_URL || "https://graphql.testnet.sui.io/graphql";
export const WORLD_API = process.env.WORLD_API_URL || "https://world-api-stillness.live.pub.evefrontier.com";

// Tenant pkg ids — kept in sync with cradleos-dapp/src/lib/tenantConfig.ts.
// 2026-06-25 wipe-day: Stillness republished as fresh v1 per PR #189.
// Setting v1 == active for stillness because the pre-wipe Character objects
// are orphaned (game won't accept them anymore); indexing them would just
// confuse search results with names attached to dead object ids.
export const STILLNESS_WORLD = "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92";
const TENANTS = {
  stillness: {
    active: "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92",
    v1:     "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92",
  },
  utopia: {
    active: "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75",
    v1:     "0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75",
  },
};

// ── HTTP helpers ──────────────────────────────────────────────────────────

async function postJson(url, body, timeoutMs = 30_000) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

async function graphql(query) {
  const j = await postJson(PUBLIC_GRAPHQL, { query });
  if (j.errors) throw new Error(`GraphQL: ${j.errors.map(e => e.message).join("; ")}`);
  return j.data;
}

async function rpc(method, params) {
  if (method === "suix_queryEvents") return readEvents(graphql, params);
  const j = await postJson(LOCAL_RPC, { jsonrpc: "2.0", id: 1, method, params });
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message}`);
  return j.result;
}

// ── ID enumeration via public GraphQL ─────────────────────────────────────

async function* iterateCharacterIds(pkg) {
  let cursor = null;
  const type = `${pkg}::character::Character`;
  while (true) {
    const query = `{
      objects(filter: { type: "${type}" } first: 50 ${cursor ? `after: "${cursor}"` : ""}) {
        nodes { address }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const data = await graphql(query);
    if (!Array.isArray(data?.objects?.nodes) || !data.objects.pageInfo) throw new Error("Incomplete object enumeration");
    const nodes = data.objects.nodes;
    for (const n of nodes) yield n.address;
    const pi = data?.objects?.pageInfo;
    if (!pi?.hasNextPage) break;
    if (!pi.endCursor || pi.endCursor === cursor) throw new Error("Object enumeration stalled");
    cursor = pi.endCursor;
  }
}

// ── Content fetch via local JSON-RPC ──────────────────────────────────────

function parseCharacter(obj, pkgOrigin, server) {
  const f = obj?.data?.content?.fields;
  if (!f) return null;
  const meta = f.metadata?.fields ?? {};
  return {
    server,
    object_id:      obj.data.objectId,
    character_addr: String(f.character_address ?? ""),
    name:           String(meta.name ?? ""),
    tribe_id:       Number(f.tribe_id ?? 0),
    item_id:        String(f.key?.fields?.item_id ?? ""),
    pkg_origin:     pkgOrigin,
  };
}

async function fetchCharacterContents(ids, pkgOrigin, server) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const result = await rpc("sui_multiGetObjects", [batch, { showContent: true }]);
    if (!Array.isArray(result) || result.length !== batch.length) throw new Error("Incomplete character object batch");
    for (const obj of result) {
      const type = obj?.data?.content?.type || obj?.data?.type || "";
      if (type !== `${TENANTS[server].active}::character::Character`) throw new Error("Wrong-world or unresolved character in backfill");
      const row = parseCharacter(obj, pkgOrigin, server);
      if (row) out.push(row);
    }
  }
  return out;
}

// ── Stale-row refresh (re-read existing characters for tribe-change visibility) ──
// Sui's Character.update_tribe mutates the field with NO emitted event. Pure event-driven
// indexing therefore freezes tribe_id at creation time and goes stale on every tribe change.
// To keep the index current, every poll cycle also re-fetches the N oldest-stale rows and
// upserts (which updates tribe_id and last_seen_ms). With N=200 and a 60s poll the entire
// ~15k Stillness corpus refreshes every ~75 minutes — good enough for kill-feed UX without
// hammering the RPC.
export async function refreshStaleRows(db, server, batchSize = 200, log = console.log) {
  const tenants = TENANTS[server];
  if (!tenants) throw new Error(`unknown server: ${server}`);

  // Pick the N rows with the oldest last_seen_ms for this server. New chars just
  // upserted by pollIncrement will have last_seen_ms=now, so they sort to the back
  // and don't get fetched twice in the same cycle.
  const rows = db.prepare(
    "SELECT object_id, pkg_origin FROM characters WHERE server = ? ORDER BY last_seen_ms ASC LIMIT ?"
  ).all(server, batchSize);
  if (!rows.length) return 0;

  // Group by pkg_origin so we read from the right package context for parsing.
  const byOrigin = new Map();
  for (const r of rows) {
    if (!byOrigin.has(r.pkg_origin)) byOrigin.set(r.pkg_origin, []);
    byOrigin.get(r.pkg_origin).push(r.object_id);
  }

  let totalUpdated = 0;
  for (const [origin, ids] of byOrigin.entries()) {
    const fetched = await fetchCharacterContents(ids, origin, server);
    const n = upsertCharacters(db, fetched);
    totalUpdated += n;
    log(`[refresh] ${server}/${origin} requested=${ids.length} upserted=${n}`);
  }
  return totalUpdated;
}

// ── Backfill ───────────────────────────────────────────────────────────────

export async function backfillServer(db, server, log = console.log) {
  const tenants = TENANTS[server];
  if (!tenants) throw new Error(`unknown server: ${server}`);
  let totalUpserted = 0;

  // Walk both pkg versions. (For utopia they're the same id, so we skip v1.)
  const pkgs = [{ pkg: tenants.active, origin: "active" }];
  if (tenants.v1 !== tenants.active) pkgs.push({ pkg: tenants.v1, origin: "v1" });

  for (const { pkg, origin } of pkgs) {
    log(`[backfill] ${server}/${origin} pkg=${pkg.slice(0, 12)}…`);
    let buf = [];
    let walked = 0;
    const t0 = Date.now();
    for await (const id of iterateCharacterIds(pkg)) {
      buf.push(id);
      walked++;
      if (buf.length >= 200) {
        const rows = await fetchCharacterContents(buf, origin, server);
        const n = upsertCharacters(db, rows);
        totalUpserted += n;
        log(`[backfill] ${server}/${origin} walked=${walked} upserted+=${n} elapsed=${((Date.now()-t0)/1000).toFixed(1)}s`);
        buf = [];
      }
    }
    if (buf.length) {
      const rows = await fetchCharacterContents(buf, origin, server);
      totalUpserted += upsertCharacters(db, rows);
    }
    log(`[backfill] ${server}/${origin} DONE walked=${walked} totalUpserted=${totalUpserted} elapsed=${((Date.now()-t0)/1000).toFixed(1)}s`);
  }

  setState(db, `world:${server}`, tenants.active);
  setState(db, `backfill:${server}:last_run_ms`, Date.now());
  setState(db, `backfill:${server}:row_count`, db.prepare("SELECT COUNT(*) AS n FROM characters WHERE server = ?").get(server).n);
  return totalUpserted;
}

// ── Increment via local CharacterCreatedEvent polling ─────────────────────

export async function pollIncrement(db, server, log = console.log) {
  const tenants = TENANTS[server];
  if (!tenants) throw new Error(`unknown server: ${server}`);

  const lastDigest = getState(db, `poll:${server}:last_event_digest`);
  const marker = lastDigest ? {txDigest:lastDigest,eventSeq:getState(db, `poll:${server}:last_event_seq`)} : null;
  const {events, latest} = await collectEventsSince(cursor => rpc("suix_queryEvents", [
    {MoveEventType:`${tenants.active}::character::CharacterCreatedEvent`}, cursor, 50, true]), marker);
  const ids = [...new Set(events.map(e => e.parsedJson?.character_id).filter(Boolean))];
  const fetched = ids.length ? await fetchCharacterContents(ids, "active", server) : [];
  const totalNew = db.transaction(() => {
    const n = upsertCharacters(db, fetched);
    if (latest) {
      setState(db, `poll:${server}:last_event_seq`, latest.eventSeq);
      setState(db, `poll:${server}:last_event_digest`, latest.txDigest);
    }
    setState(db, `poll:${server}:last_run_ms`, Date.now());
    return n;
  })();
  if (totalNew) log(`[poll] ${server} upserted=${totalNew}`);

  // Refresh oldest-stale rows for tribe-change visibility. Best-effort: any error
  // is logged but doesn't fail the poll cycle, so creation polling stays robust.
  try {
    await refreshStaleRows(db, server, 500, log);
  } catch (e) {
    log(`[poll] ${server} stale-refresh failed: ${e.message}`);
  }

  return totalNew;
}

// ── L2 static-data catalog sync (2026-07-19 data-path refactor) ─────────────
// Mirrors the EVE world-api catalogs into SQLite. Catalogs only change on
// game patches, so a 1h poll is generous. Idempotent upserts; a mid-walk
// failure aborts that catalog's pass (completed pages stay upserted).

import { upsertCatalogRows, countCatalog } from "./db.js";

async function getJson(url, timeoutMs = 30_000) {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const CATALOG_DEFS = [
  { table: "world_types",  path: "/v2/types",        pageSize: 500  },
  { table: "tribes",       path: "/v2/tribes",       pageSize: 500  },
];

export async function syncWorldCatalogs(db, server = "stillness", log = console.log) {
  let grand = 0;
  let allOk = true;
  for (const def of CATALOG_DEFS) {
    try {
      let offset = 0, total = Infinity, upserted = 0;
      while (offset < total) {
        const j = await getJson(`${WORLD_API}${def.path}?limit=${def.pageSize}&offset=${offset}`);
        const items = j?.data ?? [];
        total = Number(j?.metadata?.total ?? items.length);
        if (!items.length) break;
        upserted += upsertCatalogRows(db, def.table, server, items);
        offset += items.length;
      }
      grand += upserted;
      log(`[catalog] ${server}/${def.table}: upserted=${upserted} rows=${countCatalog(db, def.table, server)}`);
    } catch (e) {
      allOk = false;
      console.error(`[catalog] ${server}/${def.table} FAILED: ${e.message}`);
    }
  }
  if (allOk) setState(db, `catalog:${server}:last_ok_ms`, Date.now());
  setState(db, `catalog:${server}:last_run_ms`, Date.now());
  return grand;
}

// ── Killmail indexing ──────────────────────────────────────────────
// Killmails are immutable on-chain events (KillmailCreatedEvent). The LOCAL
// fullnode is the only complete source — public proxies/fallbacks prune old
// tx events and poison deep pagination (-32603). We walk the local node once
// (backfill) then increment forward every poll cycle. INSERT OR IGNORE makes
// overlapping walks harmless.

function parseKillEvent(e, server) {
  const pj = e.parsedJson ?? {};
  const itemOf = (v) => String(v?.item_id ?? "");
  return {
    server,
    tx_digest:           String(e.id?.txDigest ?? ""),
    event_seq:           String(e.id?.eventSeq ?? "0"),
    kill_timestamp:      parseInt(String(pj.kill_timestamp ?? "0"), 10) || 0,
    block_time_ms:       e.timestampMs ? (parseInt(String(e.timestampMs), 10) || 0) : 0,
    key_item_id:         itemOf(pj.key),
    killer_item_id:      itemOf(pj.killer_id),
    victim_item_id:      itemOf(pj.victim_id),
    reported_by_item_id: itemOf(pj.reported_by_character_id),
    solar_system_id:     itemOf(pj.solar_system_id),
    loss_type:           String(pj.loss_type?.variant ?? pj.loss_type?.["@variant"] ?? ""),
  };
}

// Full walk of KillmailCreatedEvent history from the local fullnode.
// Safe to re-run any time (idempotent via INSERT OR IGNORE).
export async function backfillKills(db, server, log = console.log) {
  const tenants = TENANTS[server];
  if (!tenants) throw new Error(`unknown server: ${server}`);
  const eventType = `${tenants.active}::killmail::KillmailCreatedEvent`;
  let cursor = null;
  let inserted = 0, walked = 0, pages = 0;
  const t0 = Date.now();
  while (pages < 2000) {
    pages++;
    const result = await rpc("suix_queryEvents", [{ MoveEventType: eventType }, cursor, 50, true]);
    const events = result?.data ?? [];
    walked += events.length;
    inserted += insertKillmails(db, events.map(e => parseKillEvent(e, server)).filter(r => r.tx_digest));
    if (!result?.hasNextPage || !result?.nextCursor) break;
    if (pages === 2000) throw new Error("Kill backfill pagination limit reached; incomplete history");
    cursor = result.nextCursor;
  }
  setState(db, `kills-backfill:${server}:last_run_ms`, Date.now());
  log(`[kills-backfill] ${server} pages=${pages} walked=${walked} inserted=${inserted} total=${countKills(db, server)} elapsed=${((Date.now()-t0)/1000).toFixed(1)}s`);
  return inserted;
}

// Incremental: walk newest-first, stop at the last-seen event marker. Marker
// mirrors the character poll pattern.
export async function pollKillsIncrement(db, server, log = console.log) {
  const tenants = TENANTS[server];
  if (!tenants) throw new Error(`unknown server: ${server}`);
  const eventType = `${tenants.active}::killmail::KillmailCreatedEvent`;
  const lastDigest = getState(db, `kills-poll:${server}:last_event_digest`);
  const marker = lastDigest ? {txDigest:lastDigest,eventSeq:getState(db, `kills-poll:${server}:last_event_seq`)} : null;
  const {events,latest} = await collectEventsSince(cursor => rpc("suix_queryEvents", [
    {MoveEventType:eventType}, cursor, 50, true]), marker);
  const inserted = db.transaction(() => {
    const n = insertKillmails(db, events.map(e=>parseKillEvent(e,server)).filter(r=>r.tx_digest));
    if (latest) {
      setState(db, `kills-poll:${server}:last_event_seq`, latest.eventSeq);
      setState(db, `kills-poll:${server}:last_event_digest`, latest.txDigest);
    }
    setState(db, `kills-poll:${server}:last_run_ms`, Date.now());
    return n;
  })();
  if (inserted) log(`[kills-poll] ${server} inserted=${inserted}`);
  return inserted;
}

// ══════════════════════════════════════════════════════════════════════════
// OWNED-OBJECTS INDEX (2026-07-19)
//
// The snapshot-restored fullnode's native suix_getOwnedObjects index is
// incomplete for objects that existed before the snapshot. We rebuild a
// complete owned-objects index for all EVE Frontier-relevant types by:
//   1. enumerating every current object of each type via public GraphQL
//      (the only way to list-by-type), and
//   2. resolving each object's owner + fields via the LOCAL fullnode's
//      multiGetObjects (which serves object-by-id perfectly, no rate limit).
// Increment: poll recent CradleOS/world events + re-derive ownership for
// touched objects. Serves the dApp's rpcGetOwnedObjects near-instantly.
// ══════════════════════════════════════════════════════════════════════════

import { upsertOwnedObjects, markOwnedDeleted, countOwnedObjects } from "./db.js";

// EVE Frontier owned-object types to index. "module::Struct" under the world
// pkg, plus OwnerCap<T> wrappers (which are what a Character actually owns for
// each structure). CradleOS-specific owned types can be appended here later.
// pkgKey 'world' resolves to TENANTS[server].active at runtime.
const OWNED_TYPE_DEFS = [
  // Directly-owned world objects
  { pkgKey: "world", module: "character",    struct: "Character"        },
  { pkgKey: "world", module: "character",    struct: "PlayerProfile"    },
  { pkgKey: "world", module: "network_node", struct: "NetworkNode"      },
  { pkgKey: "world", module: "gate",         struct: "Gate"             },
  { pkgKey: "world", module: "assembly",     struct: "Assembly"         },
  { pkgKey: "world", module: "turret",       struct: "Turret"           },
  { pkgKey: "world", module: "storage_unit", struct: "StorageUnit"      },
  // OwnerCaps: access::OwnerCap<world::<mod>::<Struct>> — owned by the Character
  { pkgKey: "world", module: "access", struct: "OwnerCap", generic: "network_node::NetworkNode" },
  { pkgKey: "world", module: "access", struct: "OwnerCap", generic: "gate::Gate"                },
  { pkgKey: "world", module: "access", struct: "OwnerCap", generic: "assembly::Assembly"        },
  { pkgKey: "world", module: "access", struct: "OwnerCap", generic: "turret::Turret"            },
  { pkgKey: "world", module: "access", struct: "OwnerCap", generic: "storage_unit::StorageUnit" },
];

function resolveTypeString(def, worldPkg) {
  const base = `${worldPkg}::${def.module}::${def.struct}`;
  if (def.generic) return `${base}<${worldPkg}::${def.generic}>`;
  return base;
}

async function* iterateObjectIdsByType(typeStr) {
  let cursor = null;
  while (true) {
    const query = `{
      objects(filter: { type: "${typeStr}" } first: 50 ${cursor ? `after: "${cursor}"` : ""}) {
        nodes { address }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const data = await graphql(query);
    if (!Array.isArray(data?.objects?.nodes) || !data.objects.pageInfo) throw new Error("Incomplete object enumeration");
    const nodes = data.objects.nodes;
    for (const n of nodes) yield n.address;
    const pi = data?.objects?.pageInfo;
    if (!pi?.hasNextPage) break;
    if (!pi.endCursor || pi.endCursor === cursor) throw new Error("Object enumeration stalled");
    cursor = pi.endCursor;
  }
}

// Parse owner + type from a getObject result into an owned_objects row.
function parseOwnedRow(obj, server, worldPkg) {
  const d = obj?.data;
  if (!d) return null;
  const typeFull = d.type ?? "";
  if (!typeFull) return null;
  // owner classification
  const owner = d.owner;
  let ownerAddr = "", ownerKind = "";
  if (owner?.AddressOwner) { ownerAddr = owner.AddressOwner; ownerKind = "address"; }
  else if (owner?.ObjectOwner) { ownerAddr = owner.ObjectOwner; ownerKind = "object"; }
  else if (owner?.Shared) { ownerAddr = "shared"; ownerKind = "shared"; }
  else if (owner === "Immutable") { ownerAddr = "immutable"; ownerKind = "immutable"; }
  else return null;
  // type module/struct (strip pkg + generics)
  const head = typeFull.split("<")[0]; // pkg::mod::Struct
  const parts = head.split("::");
  const pkg = parts[0] ?? "";
  const typeModule = parts[1] ?? "";
  const typeStruct = parts[2] ?? "";
  // OwnerCap: authorized_object_id points at the controlled structure
  const f = d.content?.fields ?? {};
  const authorized = typeof f.authorized_object_id === "string" ? f.authorized_object_id : null;
  // 2026-07-19: store the FULL content.fields so the dApp can read structure
  // fields (energy_source_id, status, metadata, fuel, type_id, connected_*)
  // straight from the index — no flaky per-object RPC fan-out. Only for
  // structure objects (they carry the fields the dashboard needs); OwnerCaps
  // and character/profile objects don't need the blob.
  let contentJson = null;
  if (["NetworkNode", "Gate", "Assembly", "Turret", "StorageUnit"].includes(typeStruct)) {
    try { contentJson = JSON.stringify(f); } catch { contentJson = null; }
  }
  return {
    server,
    object_id: d.objectId,
    owner: ownerAddr,
    owner_kind: ownerKind,
    type_full: typeFull,
    type_module: typeModule,
    type_struct: typeStruct,
    pkg,
    authorized_object_id: authorized,
    content_json: contentJson,
    obj_type: typeFull,
    version: Number(d.version ?? 0),
  };
}

async function fetchOwnedRows(ids, server, worldPkg, { mixedCandidates = false } = {}) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const result = await rpc("sui_multiGetObjects", [batch, { showContent: true, showOwner: true, showType: true }]);
    if (!Array.isArray(result) || result.length !== batch.length) throw new Error("Incomplete owned-object batch");
    for (const obj of result) {
      if (["deleted", "notExists"].includes(obj?.error?.code)) continue;
      if (mixedCandidates && obj.data?.type && !typeMatchesTarget(obj.data.type, worldPkg)) continue;
      const row = parseOwnedRow(obj, server, worldPkg);
      if (!row || row.pkg !== worldPkg || !obj.data?.content?.fields) throw new Error("Wrong-world or unresolved owned object");
      out.push(row);
    }
  }
  return out;
}

// ── Phase 5 (2026-07-19): local-node enumeration ────────────────────────
// The public GraphQL endpoint (list-objects-by-type) was the last public
// dependency in the owned-objects backfill — and it 429s constantly. The
// LOCAL node has the COMPLETE event stream, so we enumerate from it instead:
// ⚠ MEASURED 2026-07-19: the snapshot-restored node's event history is
// INCOMPLETE for pre-snapshot events (1,692 character events vs 7,563 live
// Characters), so events alone CANNOT enumerate the full object set. The
// robust zero-public-dependency design is therefore a HYBRID:
//   1. seed the candidate id set from the DB ITSELF (every non-deleted row —
//      the DB is the authoritative enumeration, originally GraphQL-seeded);
//   2. add NEW ids from local events (post-snapshot creations ARE complete)
//      + tx objectChanges (captures silently-created objects, e.g.
//      PlayerProfile alongside Character);
//   3. multiGetObjects the union for current owner/content, upsert; ids that
//      resolve notExists are skipped → swept deleted.
// GraphQL is used ONLY for cold-start seeding of an EMPTY server (or as the
// last-resort fallback if the local node is down).

const OWNED_TARGET_STRUCTS = new Set([
  "Character", "PlayerProfile", "NetworkNode", "Gate", "Assembly", "Turret", "StorageUnit", "OwnerCap",
]);

function typeMatchesTarget(typeFull, worldPkg) {
  if (typeof typeFull !== "string" || !typeFull.startsWith(worldPkg + "::")) return false;
  const head = typeFull.split("<")[0].split("::");
  return OWNED_TARGET_STRUCTS.has(head[2]);
}

function collectHexIds(v, out) {
  if (typeof v === "string") {
    if (v.startsWith("0x") && v.length >= 40) out.add(v);
  } else if (Array.isArray(v)) {
    for (const x of v) collectHexIds(x, out);
  } else if (v && typeof v === "object") {
    for (const x of Object.values(v)) collectHexIds(x, out);
  }
}

async function enumerateOwnedIdsViaLocalNode(server, worldPkg, log = console.log) {
  const digests = new Set();
  const ids = new Set();
  for (const mod of OWNED_EVENT_MODULES) {
    let cursor = null, pages = 0, events = 0;
    while (pages < 20_000) {
      pages++;
      const res = await rpc("suix_queryEvents", [{ MoveModule: { package: worldPkg, module: mod } }, cursor, 50, true]);
      const evs = res?.data ?? [];
      events += evs.length;
      for (const ev of evs) {
        if (ev.id?.txDigest) digests.add(ev.id.txDigest);
        collectHexIds(ev.parsedJson, ids);
      }
      if (!res?.hasNextPage || !res?.nextCursor) break;
      cursor = res.nextCursor;
    }
    log(`  [owned-enum] ${server}/${mod}: events=${events} (ids so far ${ids.size}, digests ${digests.size})`);
  }
  // Resolve tx objectChanges to catch silently-created objects (PlayerProfile).
  const digArr = [...digests];
  for (let i = 0; i < digArr.length; i += 50) {
    const batch = digArr.slice(i, i + 50);
    const res = await rpc("sui_multiGetTransactionBlocks", [batch, { showObjectChanges: true }]);
    for (const tx of (res ?? [])) {
      for (const ch of (tx?.objectChanges ?? [])) {
        if (ch?.objectId && typeMatchesTarget(ch.objectType, worldPkg)) ids.add(ch.objectId);
      }
    }
  }
  return ids;
}

export async function backfillOwned(db, server, log = console.log) {
  const worldPkg = TENANTS[server]?.active;
  if (!worldPkg) throw new Error(`no world pkg for server ${server}`);
  const passStartMs = Date.now();

  // ── Primary path: LOCAL node + DB hybrid (zero public dependency) ──
  // Requires an already-seeded DB; cold-start on an empty server falls
  // through to the GraphQL seeding path below.
  const seeded = process.env.OWNED_EVENT_ENUMERATION === "1" && countOwnedObjects(db, server) > 0;
  if (seeded) try {
    const t0 = Date.now();
    const ids = await enumerateOwnedIdsViaLocalNode(server, worldPkg, log);
    const evCount = ids.size;
    for (const r of db.prepare(`SELECT object_id FROM owned_objects WHERE server = ? AND deleted = 0`).all(server)) {
      ids.add(r.object_id);
    }
    log(`[owned] hybrid enumeration: ${ids.size} candidate ids (${evCount} from local events, rest from DB) in ${((Date.now()-t0)/1000).toFixed(1)}s`);
    const rows = (await fetchOwnedRows([...ids], server, worldPkg))
      .filter((r) => typeMatchesTarget(r.type_full, worldPkg));
    const grand = upsertOwnedObjects(db, rows);
    // Deletion sweep — full pass touched every live target object; anything
    // untouched no longer exists on-chain (or left the target set).
    const res = db.prepare(
      `UPDATE owned_objects SET deleted = 1, last_seen_ms = ? WHERE server = ? AND deleted = 0 AND last_seen_ms < ?`
    ).run(Date.now(), server, passStartMs);
    setState(db, `owned_full_backfill_started_ms_${server}`, passStartMs);
    setState(db, `owned_backfill_ok_ms_${server}`, passStartMs);
    setState(db, `owned_backfill_ms_${server}`, Date.now());
    log(`[owned] backfill ${server} complete (LOCAL): ${grand} upserts, ${res.changes ?? 0} swept-deleted (total live: ${countOwnedObjects(db, server)})`);
    return grand;
  } catch (e) {
    console.error(`[owned] LOCAL enumeration failed (${server}): ${e.message} — falling back to public GraphQL`);
  }

  // ── Fallback path: public GraphQL per-type enumeration (legacy) ──
  let grand = 0;
  let allOk = true; // true only if EVERY type enumerated without error
  for (const def of OWNED_TYPE_DEFS) {
    const typeStr = resolveTypeString(def, worldPkg);
    const label = `${def.module}::${def.struct}${def.generic ? "<" + def.generic + ">" : ""}`;
    const ids = [];
    try {
      for await (const id of iterateObjectIdsByType(typeStr)) ids.push(id);
    } catch (e) {
      // 2026-07-19 (fable review C-2): log enumerate failures via console.error
      // UNCONDITIONALLY (not the injected logger, which the poller silences),
      // and mark the pass as NOT fully successful so we (a) never run the
      // deletion sweep on a partial pass, and (b) can flag staleness.
      console.error(`[owned] enumerate FAILED (${server}) ${label}: ${e.message}`);
      allOk = false;
      continue;
    }
    if (!ids.length) { log(`  [owned] ${label}: 0`); continue; }
    const rows = await fetchOwnedRows(ids, server, worldPkg);
    const n = upsertOwnedObjects(db, rows);
    grand += n;
    log(`  [owned] ${label}: ${n}`);
  }
  // 2026-07-19 (fable review C-1): deletion sweep. Rows not touched this pass
  // (last_seen_ms < passStartMs) no longer exist on-chain (dismantled / burned)
  // -> mark deleted. ONLY on a fully successful pass, else a transient 429 on
  // one type would mass-delete that entire live type.
  let swept = 0;
  if (allOk) {
    const res = db.prepare(
      `UPDATE owned_objects SET deleted = 1, last_seen_ms = ? WHERE server = ? AND deleted = 0 AND last_seen_ms < ?`
    ).run(Date.now(), server, passStartMs);
    swept = res.changes ?? 0;
    setState(db, `owned_full_backfill_started_ms_${server}`, passStartMs);
    // Record the last FULLY-SUCCESSFUL pass timestamp (used for staleness).
    setState(db, `owned_backfill_ok_ms_${server}`, passStartMs);
  }
  // Attempt timestamp (always) — distinct from success timestamp above.
  setState(db, `owned_backfill_ms_${server}`, Date.now());
  log(`[owned] backfill ${server} complete: ${grand} upserts, ${swept} swept-deleted, allOk=${allOk} (total live: ${countOwnedObjects(db, server)})`);
  return grand;
}

// Incremental poll via the LOCAL fullnode's event stream (2026-07-19 rewrite).
//
// The old implementation re-ran the full backfill, which re-enumerates every
// owned type via the PUBLIC GraphQL endpoint. That endpoint 429s on nearly
// every 5-min pass, so `owned_backfill_ok_ms` never advanced -> the index
// perpetually reported `stale:true` -> the dApp fell back to the flaky public
// RPC -> "character not found" / 0 structures. The public GraphQL dependency
// in the HOT PATH was the bug.
//
// Robust fix: poll recent world events from the LOCAL node (complete stream, no
// rate limit), collect the object ids they touched (structures + their caps +
// characters/profiles), re-read just those via the local node's
// multiGetObjects, and upsert. This keeps the index fresh with ZERO public
// GraphQL calls. On success we advance `owned_backfill_ok_ms` (clears
// staleness) WITHOUT running the deletion sweep (that stays owned by the full
// backfill, which has the complete picture; incremental only adds/updates).
//
// Deletions still self-heal via the periodic full backfill (run out-of-band /
// on demand); the incremental poller's job is freshness, not GC.
const OWNED_EVENT_MODULES = [
  "network_node", "gate", "assembly", "turret", "storage_unit", "access", "character",
];
export async function pollOwnedIncrement(db, server, log = console.log) {
  const worldPkg = TENANTS[server]?.active;
  if (!worldPkg) throw new Error(`no world pkg for server ${server}`);
  const passStartMs = Date.now();
  const touched = new Set();
  const markers = [];
  // A failed module/read aborts the entire pass; no cursor/freshness changes.
  for (const mod of OWNED_EVENT_MODULES) {
    const key = `owned_evt_cursor_${server}_${mod}`;
    const raw = getState(db,key);
    const marker = raw ? JSON.parse(raw) : null;
    const {events,latest} = await collectEventsSince(cursor => rpc("suix_queryEvents", [
      {MoveModule:{package:worldPkg,module:mod}},cursor,50,true]), marker, 2000,
      Number(getState(db, `owned_full_backfill_started_ms_${server}`) || 0));
    for (const ev of events) for (const v of Object.values(ev.parsedJson || {})) {
      if (typeof v === "string" && /^0x[0-9a-fA-F]{40,64}$/.test(v)) touched.add(v);
    }
    if (latest) markers.push([key,JSON.stringify(latest)]);
  }
  const rows = touched.size ? await fetchOwnedRows([...touched],server,worldPkg,{mixedCandidates:true}) : [];
  const upserts = db.transaction(() => {
    const n = upsertOwnedObjects(db,rows.filter(r=>typeMatchesTarget(r.type_full,worldPkg)));
    for (const [key,value] of markers) setState(db,key,value);
    setState(db, `owned_backfill_ok_ms_${server}`, passStartMs);
    setState(db, `owned_backfill_ms_${server}`, Date.now());
    return n;
  })();
  if (upserts) log(`[owned-poll] ${server} upserts=${upserts}`);
  return upserts;
}

// ── CLI entry ──────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const db = openDb();
  const servers = argv.includes("--utopia") ? ["utopia"] : argv.includes("--stillness") ? ["stillness"] : ["stillness"];
  const main = async () => {
    if (argv.includes("--sync-catalogs")) {
      for (const s of servers) await syncWorldCatalogs(db, s);
    } else if (argv.includes("--backfill-owned")) {
      for (const s of servers) await backfillOwned(db, s);
    } else if (argv.includes("--backfill")) {
      for (const s of servers) await backfillServer(db, s);
    } else if (argv.includes("--backfill-kills")) {
      for (const s of servers) await backfillKills(db, s);
    } else if (argv.includes("--poll-once")) {
      for (const s of servers) await pollIncrement(db, s);
    } else if (argv.includes("--poll-owned")) {
      for (const s of servers) await pollOwnedIncrement(db, s);
    } else {
      console.log("usage: node indexer.js [--backfill | --backfill-owned | --backfill-kills | --poll-once | --poll-owned | --sync-catalogs] [--stillness | --utopia]");
      process.exit(1);
    }
  };
  main().catch((e) => { console.error(e); process.exit(1); });
}
