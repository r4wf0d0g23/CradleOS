/**
 * characterDirectory — shared character search source for autocomplete UIs.
 *
 * Fetches all on-chain Character objects (both world v1 + v2 packages) via
 * Sui GraphQL, caches them in localStorage with a 15-minute TTL keyed by
 * server (stillness/utopia), and exposes a single useCharacterDirectory()
 * hook that any component can mount cheaply.
 *
 * The data is the same source the Chain Query panel uses. Sharing the cache
 * key (`cradleos:querycache:<env>:characters`) means a single cold-load
 * warms both Chain Query and any autocomplete that consumes this hook.
 *
 * Output shape matches what defense_policy contract expects:
 * - characterId: u32 (the in-game pilot id, fits in 32 bits)
 * - name: string  (display name from Character.metadata)
 * - tribeId: number (their on-chain tribe)
 * - characterAddress: string (the in-game character address, NOT wallet)
 * - objectId: string (the Character shared-object id)
 */
import { useQuery } from "@tanstack/react-query";
import {
  SUI_GRAPHQL,
  WORLD_PKG,
  WORLD_PKG_UTOPIA_V1,
  SERVER_ENV,
} from "../constants";
import { numish } from "../lib";

export type CharacterDirectoryEntry = {
  /** Character shared-object id (0x... 32 bytes). */
  objectId: string;
  /** In-game character_id (Character.key.item_id, fits in u32). */
  characterId: number;
  /** Display name from Character.metadata.name. */
  name: string;
  /** Free-text description from Character.metadata. */
  description: string;
  /** Tribe this character belongs to. */
  tribeId: number;
  /** In-game character address (NOT wallet). */
  characterAddress: string;
};

const LS_TTL_MS = 15 * 60_000;
const LS_KEY = `cradleos:querycache:${SERVER_ENV}:characters`;

function lsCacheGet(): CharacterDirectoryEntry[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: CharacterDirectoryEntry[] };
    if (Date.now() - ts > LS_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function lsCacheSet(data: CharacterDirectoryEntry[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Quota exceeded or storage disabled — silently skip; next load re-fetches.
  }
}

async function fetchByPkg(charType: string): Promise<CharacterDirectoryEntry[]> {
  const out: CharacterDirectoryEntry[] = [];
  let cursor: string | null = null;
  do {
    const query = `{
      objects(filter: { type: "${charType}" }
        first: 50
        ${cursor ? `after: "${cursor}"` : ""}
      ) {
        nodes { address asMoveObject { contents { json } } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const res = await fetch(SUI_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await res.json() as {
      data?: { objects?: {
        nodes?: Array<{ address: string; asMoveObject?: { contents?: { json?: Record<string, unknown> } } }>;
        pageInfo?: { hasNextPage: boolean; endCursor: string };
      } }
    };
    const nodes = json.data?.objects?.nodes ?? [];
    for (const n of nodes) {
      const j = n.asMoveObject?.contents?.json ?? {};
      const meta = (j.metadata as Record<string, unknown>) ?? {};
      const itemId = numish((j.key as Record<string, unknown>)?.item_id) ?? 0;
      // characterId is the same value the world contract emits as
      // TargetCandidate.character_id (u32 downcast of Character.key.item_id).
      // Defense_policy is keyed by this value.
      out.push({
        objectId: n.address,
        characterId: itemId,
        name: String(meta.name ?? ""),
        description: String(meta.description ?? ""),
        tribeId: numish(j.tribe_id) ?? 0,
        characterAddress: String(j.character_address ?? ""),
      });
    }
    const pageInfo = json.data?.objects?.pageInfo;
    cursor = pageInfo?.hasNextPage ? (pageInfo.endCursor ?? null) : null;
  } while (cursor);
  return out;
}

/** Fetch every Character object on chain (paginated, deduped, cached). */
export async function fetchAllCharacters(): Promise<CharacterDirectoryEntry[]> {
  const cached = lsCacheGet();
  if (cached && cached.length > 0) return cached;

  // Two world package lineages cohabit on Stillness — pre-v0.0.21 characters are
  // typed against the v1 origin and post-v0.0.21 characters against the v2 origin.
  // Fetch both, merge by objectId.
  const [v2, v1] = await Promise.all([
    fetchByPkg(`${WORLD_PKG}::character::Character`),
    fetchByPkg(`${WORLD_PKG_UTOPIA_V1}::character::Character`),
  ]);
  const seen = new Set<string>();
  const merged = [...v2, ...v1].filter(c => {
    if (seen.has(c.objectId)) return false;
    seen.add(c.objectId);
    return true;
  });
  lsCacheSet(merged);
  return merged;
}

/** React Query hook for character directory. Cheap to mount in many places. */
export function useCharacterDirectory() {
  return useQuery<CharacterDirectoryEntry[]>({
    queryKey: ["character-directory", SERVER_ENV],
    queryFn: fetchAllCharacters,
    // 15-minute staleTime mirrors the localStorage TTL — a fresh tab uses cache,
    // a long-running tab will refetch in the background after 15 min without
    // blocking renders.
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Lookup by characterId. Returns the first match (ids should be unique). */
export function findCharacterById(
  directory: CharacterDirectoryEntry[] | undefined,
  characterId: number,
): CharacterDirectoryEntry | undefined {
  if (!directory) return undefined;
  return directory.find(c => c.characterId === characterId);
}

/** Substring filter on name/address/id. Capped at maxResults to keep render fast. */
export function searchCharacters(
  directory: CharacterDirectoryEntry[] | undefined,
  query: string,
  maxResults = 30,
): CharacterDirectoryEntry[] {
  if (!directory) return [];
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  // Numeric query → match characterId or itemId exactly first, then fall back to substring.
  const isNum = /^\d+$/.test(q);
  const matches: CharacterDirectoryEntry[] = [];
  for (const c of directory) {
    if (isNum) {
      const idStr = String(c.characterId);
      if (idStr === q) { matches.unshift(c); continue; }      // exact match → top
      if (idStr.includes(q)) { matches.push(c); continue; }
    }
    if (
      c.name.toLowerCase().includes(q) ||
      c.characterAddress.toLowerCase().includes(q)
    ) {
      matches.push(c);
    }
    if (matches.length >= maxResults) break;
  }
  return matches.slice(0, maxResults);
}
