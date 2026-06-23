#!/usr/bin/env node
/**
 * Refresh static solar-system snapshots from world-api.
 *
 * The EVE Frontier universe geometry (~24,500 systems × {id, name,
 * constellationId, regionId, location}) is fixed map data — it changes
 * only when Fenris alters the map. Bundling a static snapshot eliminates:
 *   - MapPanel's 25-call paginated cold load (then sessionStorage-cached)
 *   - PlayerCardModal, IntelDashboardPanel, KeeperCipherPanel, lib.ts —
 *     each previously fetched per-system on demand.
 *
 * Output: public/data/solarsystems-<world>.json
 *   Format: a flat object keyed by system id for O(1) lookup. Fields
 *   match the world-api bulk-list response (no `gateLinks`, which is
 *   dynamic on-chain state read live from the per-system endpoint when
 *   the system detail card is opened).
 *
 * Runtime fetched (not JS-bundled) so the ~1MB payload doesn't bloat the
 * initial dApp boot. Same pattern as `public/data/planet-index.json`.
 *
 * Run: node scripts/refresh-solar-systems.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/data");

const SERVERS = [
  { key: "stillness", base: "https://world-api-stillness.live.pub.evefrontier.com" },
  { key: "utopia",    base: "https://world-api-utopia.uat.pub.evefrontier.com" },
];

const PAGE_SIZE = 1000;
const CONCURRENCY = 4;

async function fetchPage(server, offset) {
  const url = `${server.base}/v2/solarsystems?limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ offset=${offset}`);
  const json = await res.json();
  return {
    data: Array.isArray(json.data) ? json.data : [],
    total: Number(json.metadata?.total ?? 0),
  };
}

async function fetchAllSystems(server) {
  const first = await fetchPage(server, 0);
  const total = first.total;
  if (!total) return [];

  const all = [...first.data];
  const pages = Math.ceil(total / PAGE_SIZE);

  // Concurrent pagination
  for (let wave = 1; wave < pages; wave += CONCURRENCY) {
    const fns = [];
    for (let p = wave; p < Math.min(wave + CONCURRENCY, pages); p++) {
      fns.push(fetchPage(server, p * PAGE_SIZE));
    }
    const results = await Promise.all(fns);
    for (const r of results) all.push(...r.data);
    process.stdout.write(
      `\r  [${server.key}] ${all.length}/${total} (${Math.round((all.length / total) * 100)}%)`
    );
  }
  process.stdout.write("\n");

  // De-dup defensively
  const seen = new Set();
  return all.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function toRecord(systems) {
  const out = {};
  for (const s of systems) {
    if (!s?.id) continue;
    out[s.id] = {
      id: s.id,
      name: s.name ?? `System ${s.id}`,
      constellationId: s.constellationId ?? null,
      regionId: s.regionId ?? null,
      x: s.location?.x ?? null,
      y: s.location?.y ?? null,
      z: s.location?.z ?? null,
    };
  }
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const server of SERVERS) {
    try {
      console.log(`[${server.key}] fetching ...`);
      const systems = await fetchAllSystems(server);
      const rec = toRecord(systems);
      const stamp = new Date().toISOString();
      const payload = {
        _generated: stamp,
        _world: server.key,
        _count: Object.keys(rec).length,
        systems: rec,
      };
      const outPath = join(OUT_DIR, `solarsystems-${server.key}.json`);
      await writeFile(outPath, JSON.stringify(payload), "utf8");
      console.log(`[${server.key}] ✓ ${Object.keys(rec).length} systems → ${outPath}`);
    } catch (err) {
      console.warn(`[${server.key}] ✗ ${err.message ?? err}`);
      console.warn(`[${server.key}]   keeping previous snapshot (if any)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
