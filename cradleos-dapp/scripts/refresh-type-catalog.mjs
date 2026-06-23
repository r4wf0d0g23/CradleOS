#!/usr/bin/env node
/**
 * Refresh static type catalog snapshots from Stillness + Utopia world-api.
 *
 * Type metadata (id → name, volume, group, category) is effectively static
 * data per world release. Bundling a snapshot eliminates 1-RPC-per-item-name
 * resolution in InventoryPanel/StructurePanel/etc., which was producing
 * `type_id NNNNN` fallback rows whenever the API timed out or rate-limited.
 *
 * Run: node scripts/refresh-type-catalog.mjs
 * Output: src/data/typeCatalog.ts  (single bundled module for all worlds)
 *
 * If a world's world-api is unreachable, that world's snapshot is left
 * unchanged (we don't blow away good data with empty).
 *
 * Re-run before every dApp build (or via a release SOP step).
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "src/data/typeCatalog.ts");

const SERVERS = [
  {
    key: "stillness",
    base: "https://world-api-stillness.live.pub.evefrontier.com",
  },
  {
    key: "utopia",
    base: "https://world-api-utopia.uat.pub.evefrontier.com",
  },
];

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // runaway guard — 50k types ceiling

async function fetchTypes(server) {
  try {
    const all = [];
    let offset = 0;
    let total = Infinity;
    let pages = 0;
    while (offset < total && pages < MAX_PAGES) {
      const url = `${server.base}/v2/types?limit=${PAGE_SIZE}&offset=${offset}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error("missing data array");
      all.push(...json.data);
      total = Number(json.metadata?.total ?? all.length);
      offset += json.data.length;
      pages += 1;
      if (json.data.length === 0) break; // defensive
    }
    const minified = all
      .map((t) => ({
        id: Number(t.id),
        name: String(t.name ?? ""),
        volume: Number(t.volume ?? 0),
        groupName: t.groupName ?? "",
        categoryName: t.categoryName ?? "",
        categoryId: Number(t.categoryId ?? 0),
      }))
      .filter((t) => Number.isFinite(t.id) && t.name)
      .sort((a, b) => a.id - b.id);
    // De-dup defensively (paginated APIs occasionally repeat boundaries)
    const seen = new Set();
    const unique = minified.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    console.log(`[${server.key}] ✓ ${unique.length} types (${pages} pages)`);
    return unique;
  } catch (err) {
    console.warn(`[${server.key}] ✗ ${err.message ?? err}`);
    return null;
  }
}

async function loadExistingSnapshot(serverKey) {
  if (!existsSync(OUT_PATH)) return [];
  try {
    const src = await readFile(OUT_PATH, "utf8");
    const re = new RegExp(
      `export const ${serverKey.toUpperCase()}_TYPES\\s*:\\s*TypeCatalogEntry\\[\\]\\s*=\\s*(\\[[\\s\\S]*?\\]);`,
      "m"
    );
    const m = re.exec(src);
    if (!m) return [];
    // Strip TS satisfies / as const tails (defensive)
    return JSON.parse(m[1]);
  } catch {
    return [];
  }
}

async function main() {
  await mkdir(join(ROOT, "src/data"), { recursive: true });
  const sources = {};
  for (const server of SERVERS) {
    const fresh = await fetchTypes(server);
    if (fresh && fresh.length > 0) {
      sources[server.key] = fresh;
    } else {
      const prev = await loadExistingSnapshot(server.key);
      console.log(
        `[${server.key}] ${
          prev.length > 0
            ? `keeping previous snapshot (${prev.length} types)`
            : `no snapshot available (empty)`
        }`
      );
      sources[server.key] = prev;
    }
  }

  const stamp = new Date().toISOString();
  const header = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Snapshot of EVE Frontier type catalog from world-api.
 * Refreshed via: \`node scripts/refresh-type-catalog.mjs\`
 *
 * Type metadata (id → name, volume, group, category) is treated as static
 * per world release. Bundling a snapshot eliminates 1-RPC-per-item lookups
 * in InventoryPanel/StructurePanel item-name resolution. Unknown ids still
 * fall back to live world-api (handles new content added between deploys).
 *
 * Generated: ${stamp}
 */

export interface TypeCatalogEntry {
  id: number;
  name: string;
  volume: number;
  groupName: string;
  categoryName: string;
  categoryId: number;
}

export type WorldKey = "stillness" | "utopia";

`;

  const exports = [];
  for (const [key, list] of Object.entries(sources)) {
    const literal = JSON.stringify(list, null, 0);
    exports.push(
      `export const ${key.toUpperCase()}_TYPES: TypeCatalogEntry[] = ${literal};`
    );
  }

  const map = `
const CATALOGS: Record<WorldKey, TypeCatalogEntry[]> = {
  stillness: STILLNESS_TYPES,
  utopia: UTOPIA_TYPES,
};

const NAME_MAPS: Record<WorldKey, Map<number, string>> = {
  stillness: new Map(STILLNESS_TYPES.map((t) => [t.id, t.name])),
  utopia: new Map(UTOPIA_TYPES.map((t) => [t.id, t.name])),
};

const FULL_MAPS: Record<WorldKey, Map<number, TypeCatalogEntry>> = {
  stillness: new Map(STILLNESS_TYPES.map((t) => [t.id, t])),
  utopia: new Map(UTOPIA_TYPES.map((t) => [t.id, t])),
};

/** Look up an item name synchronously from the bundled catalog. Returns undefined if unknown. */
export function getTypeName(world: WorldKey, typeId: number): string | undefined {
  return NAME_MAPS[world]?.get(typeId);
}

/** Look up full type metadata synchronously from the bundled catalog. */
export function getTypeMetadata(world: WorldKey, typeId: number): TypeCatalogEntry | undefined {
  return FULL_MAPS[world]?.get(typeId);
}

/** Snapshot size — for telemetry/debug. */
export function getCatalogSize(world: WorldKey): number {
  return CATALOGS[world]?.length ?? 0;
}
`;

  const out = header + exports.join("\n\n") + "\n" + map;
  await writeFile(OUT_PATH, out, "utf8");
  console.log(`\n✓ wrote ${OUT_PATH}`);
  console.log(`  stillness: ${sources.stillness?.length ?? 0} types`);
  console.log(`  utopia:    ${sources.utopia?.length ?? 0} types`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
