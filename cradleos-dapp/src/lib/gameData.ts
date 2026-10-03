import { CURRENT_WORLD } from "./cycle";

export const GAME_DATA_BUILD = "3573151";
export const GAME_DATA_BASE = `${import.meta.env.BASE_URL ?? "/"}data/game-data-cycle7-${GAME_DATA_BUILD}`;

export type GameDataMeta = {
  schemaVersion: number; cycle: number; name: string; server: string; world: string;
  build: string; clientVersion: string; extractedAt: string; manifestSha256: string;
  manifestRows: number;
  officialApi: { url: string; fetchedAt: string; sha256: string };
  counts: { items: number; unnamedItems: number; strings: number; stringsTotal: number; numericPlaceholdersExcluded: number; eventTypes: number };
  clientFiles: Array<{ resource: string; bytes: number; md5: string; sha256: string; decodeStatus?: string }>;
  coverage: string[];
  native?: { file: string; sha256: string; extractedAt: string; recipes: number; typesWithAttributes: number };
};

export function validateGameDataMeta(meta: GameDataMeta): GameDataMeta {
  if (meta.schemaVersion !== 1 || meta.cycle !== 7 || meta.name !== "Vestiges" ||
      meta.server !== "Stillness" || meta.world !== CURRENT_WORLD || meta.build !== GAME_DATA_BUILD) {
    throw new Error("This snapshot does not match the current Stillness cycle. No archived data was substituted.");
  }
  return meta;
}

export type GameItem = {
  id: number; name: string; description: string; categoryName: string; groupName: string;
  mass: number; volume: number; radius: number; portionSize: number;
};

export function itemLabel(item: Pick<GameItem, "id" | "name">): string {
  return item.name.trim() || `Unnamed type #${item.id}`;
}

export type GameDataChanges = {
  checkedAt: string; latestPatch: string;
  patches: Array<{ version: string; date: string; url: string; title: string; changes: string[] }>;
  github: Array<{ repo: string; sha: string; url: string; note: string }>;
};

export type NativeType = {
  id: number; name: string; apiPublished: boolean; clientRecord: boolean;
  clientName: string | null; group: string | null; category: string | null;
  graphicID: number | null; attributes: Array<{ id: number; value: number }>;
};
export type NativeRecipe = {
  id: number; primaryTypeID: number; runTime: number;
  inputs: Array<{ typeID: number; quantity: number }>;
  outputs: Array<{ typeID: number; quantity: number }>;
};
export type NativeSnapshot = {
  schemaVersion: number; cycle: number; name: string; server: string; world: string; build: string;
  extractedAt: string; scope: string;
  counts: { recipes: number; linkedTypes: number; apiTypes: number; nativeTypes: number; typesWithAttributes: number; attributeDefinitions: number };
  types: Record<string, NativeType>;
  attributes: Record<string, { id: number; name: string; label: string | null; unitID: number | null }>;
  units: Record<string, { id: number; name: string; label: string | null; description: string | null }>;
  graphics: Record<string, { sofHullName?: string; sofFactionName?: string; sofRaceName?: string; sofLayout?: string[]; graphicFile?: string }>;
  recipes: NativeRecipe[];
  apiDifferences: Array<{ typeID: number; field: string; api: number | string; client: number | string | null }>;
  missingClientTypeIDs: number[];
  patchChecks: Array<{ recipeID: number; fields: string; url: string }>;
};

export function validateNativeSnapshot(data: NativeSnapshot): NativeSnapshot {
  if (data?.schemaVersion !== 1 || data.cycle !== 7 || data.name !== "Vestiges" ||
      data.server !== "Stillness" || data.world !== CURRENT_WORLD || data.build !== GAME_DATA_BUILD) {
    throw new Error("Native data does not match the current Stillness cycle.");
  }
  if (!data.types || !data.attributes || !data.units || !data.graphics || !Array.isArray(data.recipes) ||
      !data.counts || data.recipes.length !== data.counts.recipes || !Array.isArray(data.apiDifferences)) {
    throw new Error("Incomplete native reference snapshot.");
  }
  const ids = new Set<number>();
  for (const r of data.recipes) {
    if (!Number.isSafeInteger(r.id) || r.id <= 0 || ids.has(r.id) || !data.types[r.primaryTypeID] ||
        !Number.isFinite(r.runTime) || r.runTime < 0 || !Array.isArray(r.inputs) || !r.inputs.length || !Array.isArray(r.outputs) || !r.outputs.length) {
      throw new Error("Invalid native recipe reference.");
    }
    ids.add(r.id);
    for (const side of [r.inputs, r.outputs]) {
      const typeIDs = new Set<number>();
      for (const line of side) {
        if (!Number.isSafeInteger(line.typeID) || !data.types[line.typeID]?.clientRecord || typeIDs.has(line.typeID) ||
            !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Invalid native recipe quantity or item.");
        typeIDs.add(line.typeID);
      }
    }
  }
  for (const [id, type] of Object.entries(data.types)) {
    if (String(type.id) !== id || typeof type.name !== "string" || !Array.isArray(type.attributes)) throw new Error("Invalid native item.");
    const attrs = new Set<number>();
    for (const a of type.attributes) {
      const def = data.attributes[a.id];
      if (!Number.isFinite(a.value) || attrs.has(a.id) || !def || (def.unitID !== null && !data.units[def.unitID])) {
        throw new Error("Invalid native attribute or unit reference.");
      }
      attrs.add(a.id);
    }
  }
  return data;
}

export function filterNativeRecipes(data: NativeSnapshot, query: string): NativeRecipe[] {
  const q = query.trim().toLowerCase();
  if (!q) return data.recipes;
  return data.recipes.filter(r => String(r.id) === q || [...r.inputs, ...r.outputs].some(line =>
    String(line.typeID) === q || data.types[line.typeID].name.toLowerCase().includes(q)));
}
