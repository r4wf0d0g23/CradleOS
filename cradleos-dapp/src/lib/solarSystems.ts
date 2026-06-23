/**
 * Solar-system catalog loader (runtime-fetched static snapshot).
 *
 * The full EVE Frontier universe (~24,500 systems × {id, name,
 * constellationId, regionId, location}) is fixed map data — it changes
 * only when Fenris alters the map. Bundling it at build time would add
 * ~1 MB gz to the dApp boot bundle, so instead we fetch the snapshot
 * once at runtime from `public/data/solarsystems-<world>.json` and keep
 * it in-memory + sessionStorage (same pattern MapPanel already uses for
 * its own load).
 *
 * Resolution order for any system lookup:
 *   1. In-memory cache (loaded on first call)
 *   2. sessionStorage (survives reloads in same tab)
 *   3. Static JSON in public/data (one HTTP fetch, ~1 MB gz)
 *   4. Live world-api fallback (handles ids missing from the snapshot —
 *      shouldn't happen for static universe data but defends against
 *      drift between snapshot refreshes).
 *
 * Refresh the bundled snapshot via: `node scripts/refresh-solar-systems.mjs`
 */
import { SERVER_ENV, WORLD_API } from "../constants";

export interface SolarSystemRecord {
  id: number;
  name: string;
  constellationId: number | null;
  regionId: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
}

type WorldKey = "stillness" | "utopia";

const CACHE_KEY_PREFIX = "cradleos:solarsystem-catalog:";
const STORAGE_VERSION = "v1";

let _cache: Map<number, SolarSystemRecord> | null = null;
let _loadingPromise: Promise<Map<number, SolarSystemRecord>> | null = null;

function cacheKey(world: WorldKey): string {
  return `${CACHE_KEY_PREFIX}${world}:${STORAGE_VERSION}`;
}

function buildMap(systems: Record<string, SolarSystemRecord>): Map<number, SolarSystemRecord> {
  const m = new Map<number, SolarSystemRecord>();
  for (const [k, v] of Object.entries(systems)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    m.set(id, v);
  }
  return m;
}

function loadFromSession(world: WorldKey): Map<number, SolarSystemRecord> | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(world));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { systems: Record<string, SolarSystemRecord> };
    if (!parsed?.systems) return null;
    return buildMap(parsed.systems);
  } catch {
    return null;
  }
}

function saveToSession(world: WorldKey, systems: Record<string, SolarSystemRecord>): void {
  try {
    sessionStorage.setItem(cacheKey(world), JSON.stringify({ systems }));
  } catch {
    /* quota or storage disabled — fine, in-memory cache still wins this session */
  }
}

async function fetchSnapshot(world: WorldKey): Promise<Map<number, SolarSystemRecord>> {
  // Vite's BASE_URL is e.g. "/CradleOS/" on gh-pages, "/" in dev.
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/data/solarsystems-${world}.json`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`solar-systems snapshot HTTP ${res.status}`);
  const json = (await res.json()) as {
    systems: Record<string, SolarSystemRecord>;
    _count?: number;
    _world?: string;
  };
  if (!json?.systems) throw new Error("solar-systems snapshot malformed");
  saveToSession(world, json.systems);
  return buildMap(json.systems);
}

/**
 * Load the solar-system catalog for the active world. Idempotent and
 * coalesced — concurrent callers share a single load.
 */
export async function loadSolarSystemCatalog(): Promise<Map<number, SolarSystemRecord>> {
  if (_cache) return _cache;
  if (_loadingPromise) return _loadingPromise;
  const world = (SERVER_ENV as WorldKey) ?? "stillness";

  _loadingPromise = (async () => {
    const fromSession = loadFromSession(world);
    if (fromSession) {
      _cache = fromSession;
      return fromSession;
    }
    try {
      const fresh = await fetchSnapshot(world);
      _cache = fresh;
      return fresh;
    } catch (err) {
      console.warn("[solarSystems] snapshot load failed:", err);
      _cache = new Map();
      return _cache;
    } finally {
      _loadingPromise = null;
    }
  })();

  return _loadingPromise;
}

/**
 * Resolve a single solar system by id.
 *
 * Tries (in order): in-memory cache → snapshot load → live world-api
 * fallback. Returns null only if every path fails (network down +
 * unknown id).
 */
export async function resolveSolarSystem(
  systemId: number
): Promise<SolarSystemRecord | null> {
  if (!Number.isFinite(systemId)) return null;
  const catalog = await loadSolarSystemCatalog();
  const hit = catalog.get(systemId);
  if (hit) return hit;
  // Snapshot miss — live fallback (shouldn't happen for static universe
  // data, but defends against drift between snapshot refreshes).
  try {
    const res = await fetch(`${WORLD_API}/v2/solarsystems/${systemId}`);
    if (!res.ok) return null;
    const d = (await res.json()) as {
      id?: number;
      name?: string;
      constellationId?: number;
      regionId?: number;
      location?: { x?: number; y?: number; z?: number };
    };
    const rec: SolarSystemRecord = {
      id: d.id ?? systemId,
      name: d.name ?? `System ${systemId}`,
      constellationId: d.constellationId ?? null,
      regionId: d.regionId ?? null,
      x: d.location?.x ?? null,
      y: d.location?.y ?? null,
      z: d.location?.z ?? null,
    };
    // Cache the fallback hit so subsequent lookups are sync.
    catalog.set(systemId, rec);
    return rec;
  } catch {
    return null;
  }
}

/**
 * Resolve a solar-system name (most common use case). Returns
 * `System ${id}` if nothing resolves.
 */
export async function resolveSolarSystemName(systemId: number): Promise<string> {
  const rec = await resolveSolarSystem(systemId);
  return rec?.name ?? `System ${systemId}`;
}

/**
 * Batch resolve. Loads the catalog once and looks up all ids; no per-id
 * network requests on the happy path.
 */
export async function resolveSolarSystemsBatch(
  ids: number[]
): Promise<Map<number, SolarSystemRecord>> {
  await loadSolarSystemCatalog();
  const out = new Map<number, SolarSystemRecord>();
  // Use resolveSolarSystem so unknowns still hit the live fallback once
  // each. Concurrency is fine — the catalog load is already done.
  await Promise.all(
    ids.map(async (id) => {
      const rec = await resolveSolarSystem(id);
      if (rec) out.set(id, rec);
    })
  );
  return out;
}

/** Telemetry: catalog size at last load. */
export function solarSystemCatalogSize(): number {
  return _cache?.size ?? 0;
}
