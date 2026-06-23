/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Snapshot of EnergyConfig.assembly_energy (type_id → energy_cost) per world.
 * Refreshed via: `node scripts/refresh-energy-costs.mjs`
 *
 * This table changes only when the world package is upgraded. Bundling a
 * snapshot eliminates ~20 Sui RPCs per dApp cold load (one for the field
 * list + one per entry). Unknown type ids still fall back to a live RPC
 * read inside `fetchEnergyCostMap`.
 *
 * Generated: 2026-06-23T16:59:00.723Z
 */

export type WorldKey = "stillness" | "utopia";

export const STILLNESS_ENERGY_COSTS: Record<number, number> = {
  "77917": 500,
  "84556": 10,
  "84955": 950,
  "87119": 50,
  "87120": 250,
  "88063": 100,
  "88064": 200,
  "88067": 100,
  "88068": 200,
  "88069": 100,
  "88070": 200,
  "88071": 300,
  "88082": 50,
  "88083": 100,
  "90184": 1,
  "91978": 100,
  "92279": 10,
  "92401": 20,
  "92404": 40
};

export const UTOPIA_ENERGY_COSTS: Record<number, number> = {
  "77917": 500,
  "84556": 10,
  "84955": 950,
  "87119": 50,
  "87120": 250,
  "88063": 100,
  "88064": 200,
  "88067": 100,
  "88068": 200,
  "88069": 100,
  "88070": 200,
  "88071": 300,
  "88082": 50,
  "88083": 100,
  "90184": 1,
  "91978": 100,
  "92279": 10,
  "92401": 20,
  "92404": 40
};

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

/** Snapshot size — for telemetry/debug. */
export function getEnergyCostSnapshotSize(world: WorldKey): number {
  return Object.keys(ALL_ENERGY_COSTS[world] ?? {}).length;
}
