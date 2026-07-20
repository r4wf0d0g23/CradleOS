/**
 * dataClient — single data-access layer for L2 static/world data.
 *
 * 2026-07-19 data-path refactor: all catalog-style reads (item types, solar
 * systems, tribes, killmails) go INDEX-FIRST against the local character-index
 * service (SQLite mirrors on DGX1/DGX2, sub-ms, no rate limits), with the
 * keeper /world reverse-proxy to the live EVE world-api as the only fallback.
 *
 * Rules:
 *  - Components import from HERE, never fetch() world-api/catalog endpoints
 *    directly. One place to change endpoints.
 *  - Per-player AUTHED world-api calls (/v2/characters/me/*) stay LIVE and are
 *    NOT routed here — they can't be pre-indexed (per-player bearer token).
 *  - Index response shapes match the live world-api exactly ({data, metadata}
 *    lists, bare objects for by-id), so fallbacks are transparent.
 */

import { WORLD_API } from "../constants";

/** Base URL of the character-index service (same host as characterDirectory). */
export const INDEX_BASE = "https://keeper.reapers.shop/index";

const SERVER = "stillness";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EFTypeRow {
  id: number;
  name: string;
  description?: string;
  mass?: number;
  radius?: number;
  volume?: number;
  portionSize?: number;
  groupName?: string;
  groupId?: number;
  categoryName?: string;
  categoryId?: number;
  iconUrl?: string;
}

export interface EFSolarSystem {
  id: number;
  name: string;
  constellationId?: number;
  regionId?: number;
  location?: { x: number; y: number; z: number };
}

export interface EFTribe {
  id: number;
  name: string;
  nameShort: string;
  description?: string;
  taxRate?: number;
  tribeUrl?: string;
}

interface ListReply<T> { data: T[]; metadata: { total: number; limit: number; offset: number } }

// ── Internals ────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json() as Promise<T>;
}

/** Index-first with live-proxy fallback. `notFoundNull` maps 404 → null. */
async function indexFirst<T>(indexUrl: string, fallbackUrl: string, notFoundNull = false): Promise<T | null> {
  for (const url of [indexUrl, fallbackUrl]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 404 && notFoundNull) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json() as T;
    } catch { /* try next source */ }
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Full item-type catalog (~420 rows). One index call; falls back to live API. */
export async function getTypeCatalog(): Promise<EFTypeRow[]> {
  const j = await indexFirst<ListReply<EFTypeRow>>(
    `${INDEX_BASE}/world-types?server=${SERVER}&limit=1000`,
    `${WORLD_API}/v2/types?limit=1000`,
  );
  return j?.data ?? [];
}

/** Single item type by id, or null if it doesn't exist. */
export async function getType(typeId: number): Promise<EFTypeRow | null> {
  return indexFirst<EFTypeRow>(
    `${INDEX_BASE}/world-types?server=${SERVER}&id=${typeId}`,
    `${WORLD_API}/v2/types/${typeId}`,
    true,
  );
}

/** Single solar system by id, or null. */
export async function getSolarSystem(systemId: number | string): Promise<EFSolarSystem | null> {
  return indexFirst<EFSolarSystem>(
    `${INDEX_BASE}/solarsystems?server=${SERVER}&id=${systemId}`,
    `${WORLD_API}/v2/solarsystems/${systemId}`,
    true,
  );
}

/**
 * Solar-system DETAIL (includes gateLinks, securityClass, region) — fields
 * the catalog mirror doesn't carry (the world-api LIST endpoint omits them,
 * and the mirror is fed from list pages). Live-proxy first, index fallback
 * for the basic fields if the live API is down.
 */
export async function getSolarSystemDetail(systemId: number | string): Promise<(EFSolarSystem & { gateLinks?: number[]; securityClass?: string; region?: { name?: string } }) | null> {
  return indexFirst(
    `${WORLD_API}/v2/solarsystems/${systemId}`,
    `${INDEX_BASE}/solarsystems?server=${SERVER}&id=${systemId}`,
    true,
  );
}

/** Full tribe roster. */
export async function getTribes(limit = 1000): Promise<EFTribe[]> {
  const j = await indexFirst<ListReply<EFTribe>>(
    `${INDEX_BASE}/tribes?server=${SERVER}&limit=${limit}`,
    `${WORLD_API}/v2/tribes?limit=${limit}`,
  );
  return j?.data ?? [];
}

/** Single tribe by id, or null. */
export async function getTribe(tribeId: number): Promise<EFTribe | null> {
  return indexFirst<EFTribe>(
    `${INDEX_BASE}/tribes?server=${SERVER}&id=${tribeId}`,
    `${WORLD_API}/v2/tribes/${tribeId}`,
    true,
  );
}

// ── Killmails (served ONLY by the index — full history, names pre-joined) ────

export interface IndexKillRow {
  tx_digest: string;
  event_seq: string;
  kill_timestamp: number;
  block_time_ms: number;
  key_item_id: string;
  killer_item_id: string;
  victim_item_id: string;
  reported_by_item_id: string;
  solar_system_id: string;
  loss_type: string;
  killer_name: string | null;
  killer_tribe_id: number | null;
  victim_name: string | null;
  victim_tribe_id: number | null;
}

export async function getKills(opts: { since?: number; limit?: number; q?: string } = {}): Promise<IndexKillRow[]> {
  const p = new URLSearchParams({ server: SERVER });
  if (opts.since) p.set("since", String(opts.since));
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.q) p.set("q", opts.q);
  const j = await fetchJson<{ kills: IndexKillRow[] }>(`${INDEX_BASE}/kills?${p}`);
  return j.kills ?? [];
}
