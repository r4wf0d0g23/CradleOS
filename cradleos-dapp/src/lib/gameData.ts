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
