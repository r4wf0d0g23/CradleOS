#!/usr/bin/env node
/**
 * Refresh static EnergyConfig assembly-energy snapshots from on-chain
 * Sui state (Stillness + Utopia worlds).
 *
 * EnergyConfig.assembly_energy is a u64 → u64 table mapping
 * structure type_id → energy_cost. It changes only when the world package
 * is upgraded (rare and signaled clearly). Bundling a snapshot eliminates
 * ~20 Sui RPC calls per dApp cold load and fixes a pre-existing bug where
 * the table_id was hardcoded to Utopia, silently returning 0 cost on
 * Stillness.
 *
 * Run: node scripts/refresh-energy-costs.mjs
 * Output: src/data/energyCosts.ts
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_PATH = join(ROOT, "src/data/energyCosts.ts");

const SUI_RPC = "https://fullnode.testnet.sui.io:443";

const SERVERS = [
  { key: "stillness", energyConfig: "0xd77693d0df5656d68b1b833e2a23cc81eb3875d8d767e7bd249adde82bdbc952" },
  { key: "utopia",    energyConfig: "0x9285364e8104c04380d9cc4a001bbdfc81a554aad441c2909c2d3bd52a0c9c62" },
];

async function rpc(method, params) {
  const res = await fetch(SUI_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

async function fetchAssemblyTableId(energyConfigId) {
  const r = await rpc("sui_getObject", [energyConfigId, { showContent: true }]);
  return r.data.content.fields.assembly_energy.fields.id.id;
}

async function fetchEnergyCosts(server) {
  try {
    const tableId = await fetchAssemblyTableId(server.energyConfig);
    const fields = [];
    let cursor = null;
    while (true) {
      const page = await rpc("suix_getDynamicFields", [tableId, cursor, 50]);
      fields.push(...page.data);
      if (!page.hasNextPage) break;
      cursor = page.nextCursor;
    }
    // Parallel-fetch values
    const entries = await Promise.all(
      fields.map(async (f) => {
        const r = await rpc("sui_getObject", [f.objectId, { showContent: true }]);
        const cost = parseInt(r.data.content.fields.value, 10);
        const typeId = parseInt(f.name.value, 10);
        return [typeId, cost];
      })
    );
    const map = Object.fromEntries(entries.sort((a, b) => a[0] - b[0]));
    console.log(`[${server.key}] \u2713 ${entries.length} energy entries (table ${tableId.slice(0, 10)}...)`);
    return map;
  } catch (err) {
    console.warn(`[${server.key}] \u2717 ${err.message ?? err}`);
    return null;
  }
}

async function loadExisting(serverKey) {
  if (!existsSync(OUT_PATH)) return {};
  try {
    const src = await readFile(OUT_PATH, "utf8");
    const re = new RegExp(
      `export const ${serverKey.toUpperCase()}_ENERGY_COSTS\\s*:\\s*Record<number,\\s*number>\\s*=\\s*(\\{[\\s\\S]*?\\});`,
      "m"
    );
    const m = re.exec(src);
    return m ? JSON.parse(m[1]) : {};
  } catch {
    return {};
  }
}

async function main() {
  await mkdir(join(ROOT, "src/data"), { recursive: true });
  const sources = {};
  for (const server of SERVERS) {
    const fresh = await fetchEnergyCosts(server);
    if (fresh && Object.keys(fresh).length > 0) {
      sources[server.key] = fresh;
    } else {
      const prev = await loadExisting(server.key);
      console.log(`[${server.key}] keeping previous snapshot (${Object.keys(prev).length} entries)`);
      sources[server.key] = prev;
    }
  }

  const stamp = new Date().toISOString();
  const header = `/**
 * AUTO-GENERATED \u2014 DO NOT EDIT BY HAND.
 *
 * Snapshot of EnergyConfig.assembly_energy (type_id \u2192 energy_cost) per world.
 * Refreshed via: \`node scripts/refresh-energy-costs.mjs\`
 *
 * This table changes only when the world package is upgraded. Bundling a
 * snapshot eliminates ~20 Sui RPCs per dApp cold load (one for the field
 * list + one per entry). Unknown type ids still fall back to a live RPC
 * read inside \`fetchEnergyCostMap\`.
 *
 * Generated: ${stamp}
 */

export type WorldKey = "stillness" | "utopia";

`;
  const exports = [];
  for (const [key, map] of Object.entries(sources)) {
    exports.push(
      `export const ${key.toUpperCase()}_ENERGY_COSTS: Record<number, number> = ${JSON.stringify(map, null, 2)};`
    );
  }
  const helper = `
const ALL_ENERGY_COSTS: Record<WorldKey, Record<number, number>> = {
  stillness: STILLNESS_ENERGY_COSTS,
  utopia: UTOPIA_ENERGY_COSTS,
};

/** Sync lookup. Returns undefined if unknown (caller falls back to RPC). */
export function getEnergyCost(world: WorldKey, typeId: number): number | undefined {
  const cost = ALL_ENERGY_COSTS[world]?.[typeId];
  return cost === undefined ? undefined : cost;
}

/** Build a Map<typeId, energyCost> view for the given world. */
export function getEnergyCostMap(world: WorldKey): Map<number, number> {
  const src = ALL_ENERGY_COSTS[world] ?? {};
  return new Map(Object.entries(src).map(([k, v]) => [Number(k), v]));
}

/** Snapshot size \u2014 for telemetry/debug. */
export function getEnergyCostSnapshotSize(world: WorldKey): number {
  return Object.keys(ALL_ENERGY_COSTS[world] ?? {}).length;
}
`;

  await writeFile(OUT_PATH, header + exports.join("\n\n") + "\n" + helper, "utf8");
  console.log(`\n\u2713 wrote ${OUT_PATH}`);
  for (const [key, map] of Object.entries(sources)) {
    console.log(`  ${key}: ${Object.keys(map).length} entries`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
