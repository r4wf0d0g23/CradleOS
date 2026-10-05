import { useEffect, useSyncExternalStore } from "react";
import { CURRENT_WORLD } from "./cycle";
import { GAME_DATA_BUILD } from "./gameData";

export const GAME_ICON_BASE = `${import.meta.env.BASE_URL ?? "/"}data/icons-cycle7-${GAME_DATA_BUILD}`;
export type IconReference = { asset: string; source: string };
export type TypeIconReference = { name: string; apiPublished: boolean; asset: string | null; source: string | null; reason?: string; method?: string };
export type GameIcons = {
  schemaVersion: number; build: string; cycle: number; world: string; server: string; name: string;
  types: Record<string, TypeIconReference>; ui: Record<string, IconReference>; library: Record<string, IconReference>;
  counts: { types: number; resolved: number; ui: number; library: number; assets: number; assetBytes: number };
};
const ASSET = /^assets\/[a-f0-9]{64}\.png$/;
export function iconAssetUrl(asset: string | null | undefined, base = GAME_ICON_BASE): string | null {
  return typeof asset === "string" && ASSET.test(asset) ? `${base}/${asset}` : null;
}

export function validateGameIcons(data: GameIcons): GameIcons {
  if (!data || data.schemaVersion !== 1 || data.build !== GAME_DATA_BUILD || data.cycle !== 7 ||
      data.world !== CURRENT_WORLD || data.server !== "Stillness" || data.name !== "Vestiges") {
    throw new Error("Icon pack does not match the current Stillness cycle.");
  }
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!object(data.types) || !object(data.ui) || !object(data.library) || !object(data.counts)) throw new Error("Incomplete icon pack.");
  let resolved = 0;
  const assets = new Set<string>();
  for (const [id, row] of Object.entries(data.types)) {
    if (!object(row) || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || typeof row.name !== "string" || typeof row.apiPublished !== "boolean") throw new Error("Invalid type icon reference.");
    if (row.asset === null) {
      if (typeof row.reason !== "string" || row.source !== null) throw new Error("Missing icon reason.");
    } else {
      if (typeof row.asset !== "string" || !ASSET.test(row.asset) || typeof row.source !== "string" || !row.source.startsWith("res:/")) throw new Error("Unsafe icon path.");
      assets.add(row.asset); resolved++;
    }
  }
  for (const group of [data.ui, data.library]) for (const row of Object.values(group)) {
    if (!object(row) || typeof row.asset !== "string" || !ASSET.test(row.asset) || typeof row.source !== "string" || !row.source.startsWith("res:/")) throw new Error("Invalid UI icon reference.");
    assets.add(row.asset);
  }
  if (data.counts.types !== Object.keys(data.types).length || data.counts.resolved !== resolved ||
      data.counts.ui !== Object.keys(data.ui).length || data.counts.library !== Object.keys(data.library).length ||
      data.counts.assets !== assets.size || !Number.isSafeInteger(data.counts.assetBytes) || data.counts.assetBytes <= 0) throw new Error("Icon pack coverage mismatch.");
  return data;
}

type State = { data: GameIcons | null; error: string | null; loading: boolean };
let state: State = { data: null, error: null, loading: false };
let failedAt = 0;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();
function update(next: State) { state = next; listeners.forEach(fn => fn()); }
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const snapshot = () => state;

export function loadGameIcons(retry = false): Promise<void> {
  if (request) return request;
  if (state.data || (state.error && !retry && Date.now() - failedAt < 30_000)) return Promise.resolve();
  update({ data: null, error: null, loading: true });
  request = fetch(`${GAME_ICON_BASE}/manifest.json`, { signal: AbortSignal.timeout(15_000) })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(validateGameIcons)
    .then(data => update({ data, error: null, loading: false }))
    .catch(e => { failedAt = Date.now(); update({ data: null, error: String(e.message ?? e), loading: false }); })
    .finally(() => { request = null; });
  return request;
}

export function useGameIcons() {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void loadGameIcons(); }, []);
  return { ...value, retry: () => { void loadGameIcons(true); } };
}
