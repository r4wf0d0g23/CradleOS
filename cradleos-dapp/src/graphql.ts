// graphql.ts — Shared GraphQL data layer for EVE Frontier on-chain data (Sui testnet)

export const SUI_GRAPHQL = "https://graphql.testnet.sui.io/graphql";
// WORLD_PKG is env-driven — always use the one from constants
import { WORLD_PKG as _WORLD_PKG } from "./constants";
export { WORLD_PKG } from "./constants";
const WORLD_PKG = _WORLD_PKG;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Killmail {
  objectId: string;
  killmailId: string;    // key.item_id
  killTimestamp: number; // unix seconds
  killerId: string;      // killer_id.item_id
  victimId: string;      // victim_id.item_id
  lossType: "SHIP" | "STRUCTURE" | "UNKNOWN";
  solarSystemId: string; // solar_system_id.item_id
  reportedBy: string;    // reported_by_character_id.item_id
}

export interface EFCharacter {
  objectId: string;
  charId: string;        // key.item_id
  name: string;          // metadata.name
  tribeId: number;
  walletAddress: string; // character_address
}

export interface NetworkNode {
  objectId: string;
  nodeId: string;        // key.item_id
  name: string;          // metadata.name
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  fuelQty: number;
  fuelMax: number;
  fuelBurning: boolean;
  energyCurrent: number;
  energyMax: number;
  connections: number;   // connected_assembly_ids.length
  typeId: string;
}

// ---------------------------------------------------------------------------
// Internal GraphQL helper
// ---------------------------------------------------------------------------

async function gql(query: string): Promise<any> {
  const res = await fetch(SUI_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

// ---------------------------------------------------------------------------
// Killmail helpers
// ---------------------------------------------------------------------------

function parseLossType(variant: string): "SHIP" | "STRUCTURE" | "UNKNOWN" {
  if (variant === "SHIP") return "SHIP";
  if (variant === "STRUCTURE") return "STRUCTURE";
  return "UNKNOWN";
}

function parseNodeAsKillmail(node: any): Killmail | null {
  try {
    const json = node?.asMoveObject?.contents?.json;
    if (!json) return null;
    return {
      objectId: node.address ?? "",
      killmailId: String(json.key?.item_id ?? ""),
      killTimestamp: Number(json.kill_timestamp ?? 0),
      killerId: String(json.killer_id?.item_id ?? ""),
      victimId: String(json.victim_id?.item_id ?? ""),
      lossType: parseLossType(String(json.loss_type?.["@variant"] ?? "")),
      solarSystemId: String(json.solar_system_id?.item_id ?? ""),
      reportedBy: String(json.reported_by_character_id?.item_id ?? ""),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchKillmails
// ---------------------------------------------------------------------------

export async function fetchKillmails(
  limit = 50,
  after?: string
): Promise<{ kills: Killmail[]; hasNext: boolean; endCursor: string | null }> {
  try {
    const afterClause = after ? `, after: "${after}"` : "";
    const data = await gql(`{
      objects(filter: { type: "${WORLD_PKG}::killmail::Killmail" }, first: ${limit}${afterClause}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          address
          asMoveObject { contents { json } }
        }
      }
    }`);

    const kills: Killmail[] = (data?.objects?.nodes ?? [])
      .map(parseNodeAsKillmail)
      .filter((k: Killmail | null): k is Killmail => k !== null);

    return {
      kills,
      hasNext: data?.objects?.pageInfo?.hasNextPage ?? false,
      endCursor: data?.objects?.pageInfo?.endCursor ?? null,
    };
  } catch {
    return { kills: [], hasNext: false, endCursor: null };
  }
}

// ---------------------------------------------------------------------------
// Character helpers
// ---------------------------------------------------------------------------

function parseNodeAsCharacter(node: any): EFCharacter | null {
  try {
    const json = node?.asMoveObject?.contents?.json;
    if (!json) return null;
    return {
      objectId: node.address ?? "",
      charId: String(json.key?.item_id ?? ""),
      name: String(json.metadata?.name ?? ""),
      tribeId: Number(json.tribe_id ?? 0),
      walletAddress: String(json.character_address ?? ""),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchCharacters
// ---------------------------------------------------------------------------

export async function fetchCharacters(
  limit = 50,
  after?: string
): Promise<{ chars: EFCharacter[]; hasNext: boolean; endCursor: string | null }> {
  try {
    const afterClause = after ? `, after: "${after}"` : "";
    const data = await gql(`{
      objects(filter: { type: "${WORLD_PKG}::character::Character" }, first: ${limit}${afterClause}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          address
          asMoveObject { contents { json } }
        }
      }
    }`);

    const chars: EFCharacter[] = (data?.objects?.nodes ?? [])
      .map(parseNodeAsCharacter)
      .filter((c: EFCharacter | null): c is EFCharacter => c !== null);

    return {
      chars,
      hasNext: data?.objects?.pageInfo?.hasNextPage ?? false,
      endCursor: data?.objects?.pageInfo?.endCursor ?? null,
    };
  } catch {
    return { chars: [], hasNext: false, endCursor: null };
  }
}

// ---------------------------------------------------------------------------
// NetworkNode helpers
// ---------------------------------------------------------------------------

function parseNodeStatus(variant: string): "ONLINE" | "OFFLINE" | "UNKNOWN" {
  if (variant === "ONLINE") return "ONLINE";
  if (variant === "OFFLINE") return "OFFLINE";
  return "UNKNOWN";
}

function parseNodeAsNetworkNode(node: any): NetworkNode | null {
  try {
    const json = node?.asMoveObject?.contents?.json;
    if (!json) return null;
    return {
      objectId: node.address ?? "",
      nodeId: String(json.key?.item_id ?? ""),
      name: String(json.metadata?.name ?? ""),
      status: parseNodeStatus(String(json.status?.status?.["@variant"] ?? "")),
      fuelQty: Number(json.fuel?.quantity ?? 0),
      fuelMax: Number(json.fuel?.max_capacity ?? 0),
      fuelBurning: Boolean(json.fuel?.is_burning ?? false),
      energyCurrent: Number(json.energy_source?.current_energy_production ?? 0),
      energyMax: Number(json.energy_source?.max_energy_production ?? 0),
      connections: Number(json.connected_assembly_ids?.length ?? 0),
      typeId: String(json.type_id ?? ""),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetchNetworkNodes
// ---------------------------------------------------------------------------

export async function fetchNetworkNodes(
  limit = 50,
  after?: string
): Promise<{ nodes: NetworkNode[]; hasNext: boolean; endCursor: string | null }> {
  try {
    const afterClause = after ? `, after: "${after}"` : "";
    const data = await gql(`{
      objects(filter: { type: "${WORLD_PKG}::network_node::NetworkNode" }, first: ${limit}${afterClause}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          address
          asMoveObject { contents { json } }
        }
      }
    }`);

    const nodes: NetworkNode[] = (data?.objects?.nodes ?? [])
      .map(parseNodeAsNetworkNode)
      .filter((n: NetworkNode | null): n is NetworkNode => n !== null);

    return {
      nodes,
      hasNext: data?.objects?.pageInfo?.hasNextPage ?? false,
      endCursor: data?.objects?.pageInfo?.endCursor ?? null,
    };
  } catch {
    return { nodes: [], hasNext: false, endCursor: null };
  }
}

// ---------------------------------------------------------------------------
// buildCharacterMap
// ---------------------------------------------------------------------------

export async function buildCharacterMap(): Promise<Map<string, EFCharacter>> {
  const map = new Map<string, EFCharacter>();
  let cursor: string | undefined;
  let total = 0;

  try {
    while (total < 500) {
      const { chars, hasNext, endCursor } = await fetchCharacters(50, cursor);
      for (const c of chars) {
        map.set(c.charId, c);
      }
      total += chars.length;
      if (!hasNext || !endCursor) break;
      cursor = endCursor;
    }
  } catch {
    // return whatever we have so far
  }

  return map;
}

// ---------------------------------------------------------------------------
// resolveCharacterNames
// ---------------------------------------------------------------------------

export async function resolveCharacterNames(
  charIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const all = await buildCharacterMap();
    for (const id of charIds) {
      const char = all.get(id);
      if (char && char.name !== "") {
        result.set(id, char.name);
      } else {
        result.set(id, `Unknown #${id}`);
      }
    }
  } catch {
    for (const id of charIds) {
      result.set(id, `Unknown #${id}`);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// findKillsForVictim
// ---------------------------------------------------------------------------

export async function findKillsForVictim(victimCharId: string): Promise<Killmail[]> {
  const all: Killmail[] = [];
  try {
    let cursor: string | undefined;
    while (all.length < 200) {
      const remaining = 200 - all.length;
      const batchSize = Math.min(50, remaining);
      const { kills, hasNext, endCursor } = await fetchKillmails(batchSize, cursor);
      all.push(...kills);
      if (!hasNext || !endCursor) break;
      cursor = endCursor;
    }
  } catch {
    // return filtered subset of what we have
  }
  return all.filter((k) => k.victimId === victimCharId);
}

// ---------------------------------------------------------------------------
// findKillsByKiller
// ---------------------------------------------------------------------------

export async function findKillsByKiller(killerCharId: string): Promise<Killmail[]> {
  const all: Killmail[] = [];
  try {
    let cursor: string | undefined;
    while (all.length < 200) {
      const remaining = 200 - all.length;
      const batchSize = Math.min(50, remaining);
      const { kills, hasNext, endCursor } = await fetchKillmails(batchSize, cursor);
      all.push(...kills);
      if (!hasNext || !endCursor) break;
      cursor = endCursor;
    }
  } catch {
    // return filtered subset of what we have
  }
  return all.filter((k) => k.killerId === killerCharId);
}

// ---------------------------------------------------------------------------
// TribeMember — returned by fetchTribeMembers
// ---------------------------------------------------------------------------

export interface TribeMember {
  address: string;    // wallet address (key in balances Table)
  balance: number;    // current CRDL balance
  // Enriched after fetchCharactersByTribeId
  charId?: string;
  charName?: string;
}

// ---------------------------------------------------------------------------
// fetchTribeMembers
// Read ALL members + balances from a vault's balancesTable in ONE GraphQL call.
// Replaces the event-scanning approach in MemberRosterCard — returns current state,
// includes everyone with any balance, skips the historical issued/burned scan.
// ---------------------------------------------------------------------------

export async function fetchTribeMembers(
  balancesTableId: string,
  maxMembers = 200,
): Promise<TribeMember[]> {
  if (!balancesTableId) return [];
  const members: TribeMember[] = [];
  let cursor: string | undefined;

  try {
    while (members.length < maxMembers) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const data = await gql(`{
        object(address: "${balancesTableId}") {
          dynamicFields(first: 50${afterClause}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              name { json }
              value {
                ... on MoveObject {
                  contents { json }
                }
              }
            }
          }
        }
      }`);

      const fields = data?.object?.dynamicFields;
      const nodes: Array<{ name: { json: unknown }; value?: { contents?: { json: unknown } } }> =
        fields?.nodes ?? [];

      for (const node of nodes) {
        const addr = String(node.name?.json ?? "");
        const bal = Number((node.value?.contents?.json as Record<string, unknown>)?.["value"] ?? 0);
        if (addr && addr !== "null") {
          members.push({ address: addr, balance: bal });
        }
      }

      if (!fields?.pageInfo?.hasNextPage || !fields?.pageInfo?.endCursor) break;
      cursor = fields.pageInfo.endCursor;
    }
  } catch {
    // return whatever we have
  }

  return members;
}

// ---------------------------------------------------------------------------
// fetchCharactersByTribeId
// Returns all Character objects that have tribe_id === tribeId.
// Paginates until exhausted (up to maxScan objects total).
// Used to enrich member roster with in-game names.
// ---------------------------------------------------------------------------

export async function fetchCharactersByTribeId(
  tribeId: number,
  maxScan = 500,
): Promise<EFCharacter[]> {
  const result: EFCharacter[] = [];
  let cursor: string | undefined;
  let scanned = 0;

  try {
    while (scanned < maxScan) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const data = await gql(`{
        objects(filter: { type: "${WORLD_PKG}::character::Character" }, first: 50${afterClause}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            address
            asMoveObject { contents { json } }
          }
        }
      }`);

      const nodes: Array<{ address: string; asMoveObject?: { contents?: { json: unknown } } }> =
        data?.objects?.nodes ?? [];

      for (const node of nodes) {
        const c = parseNodeAsCharacter(node);
        if (c && c.tribeId === tribeId) result.push(c);
      }
      scanned += nodes.length;

      if (!data?.objects?.pageInfo?.hasNextPage || !data?.objects?.pageInfo?.endCursor) break;
      cursor = data.objects.pageInfo.endCursor;
    }
  } catch {
    // return whatever we have
  }

  return result;
}

// ---------------------------------------------------------------------------
// fetchCharactersByIds
// Batch-fetch specific Character objects by their Sui object IDs.
// Much cheaper than fetching all characters when you already know the IDs.
// ---------------------------------------------------------------------------

export async function fetchCharactersByIds(
  objectIds: string[],
): Promise<EFCharacter[]> {
  if (!objectIds.length) return [];
  // Sui GraphQL allows filtering by objectIds list
  const idList = objectIds.map(id => `"${id}"`).join(", ");
  try {
    const data = await gql(`{
      objects(filter: { objectIds: [${idList}] }, first: ${Math.min(objectIds.length, 50)}) {
        nodes {
          address
          asMoveObject { contents { json } }
        }
      }
    }`);
    return (data?.objects?.nodes ?? [])
      .map(parseNodeAsCharacter)
      .filter((c: EFCharacter | null): c is EFCharacter => c !== null);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// resolveCharacterNamesForSet
// Targeted name lookup — only fetches chars we actually need.
// Replaces buildCharacterMap() calls where you know the specific addresses.
// ---------------------------------------------------------------------------

export async function resolveCharacterNamesForSet(
  walletAddresses: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!walletAddresses.length) return result;

  // Scan characters, match by character_address field
  // (Sui doesn't support field-value filters, so we scan with early-exit once all found)
  const needed = new Set(walletAddresses.map(a => a.toLowerCase()));
  let cursor: string | undefined;
  let scanned = 0;

  try {
    while (needed.size > result.size && scanned < 600) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const data = await gql(`{
        objects(filter: { type: "${WORLD_PKG}::character::Character" }, first: 50${afterClause}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            address
            asMoveObject { contents { json } }
          }
        }
      }`);
      const nodes = data?.objects?.nodes ?? [];
      for (const node of nodes) {
        const c = parseNodeAsCharacter(node);
        if (c && needed.has(c.walletAddress.toLowerCase())) {
          result.set(c.walletAddress.toLowerCase(), c.name || `Rider ${c.charId.slice(-4)}`);
        }
      }
      scanned += nodes.length;
      if (!data?.objects?.pageInfo?.hasNextPage || !data?.objects?.pageInfo?.endCursor) break;
      cursor = data.objects.pageInfo.endCursor;
    }
  } catch { /* return whatever we found */ }

  // Fill in unknowns
  for (const addr of walletAddresses) {
    if (!result.has(addr.toLowerCase())) {
      result.set(addr.toLowerCase(), `${addr.slice(0, 6)}…${addr.slice(-4)}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// fetchTribeMembersEnriched
// One-call convenience: reads balances table → enriches with character names.
// Returns members sorted by balance desc, founder flagged.
// ---------------------------------------------------------------------------

export async function fetchTribeMembersEnriched(
  balancesTableId: string,
  founderAddress: string,
  tribeId: number,
): Promise<(TribeMember & { isFounder: boolean })[]> {
  const [members, chars] = await Promise.all([
    fetchTribeMembers(balancesTableId),
    fetchCharactersByTribeId(tribeId),
  ]);

  // Build address → name map from character scan
  const nameMap = new Map<string, string>();
  for (const c of chars) {
    if (c.walletAddress) {
      nameMap.set(c.walletAddress.toLowerCase(), c.name || `Rider ${c.charId.slice(-4)}`);
    }
  }

  return members
    .map(m => ({
      ...m,
      charName: nameMap.get(m.address.toLowerCase()) ?? undefined,
      isFounder: m.address.toLowerCase() === founderAddress.toLowerCase(),
    }))
    .sort((a, b) => {
      // Founder always first, then by balance desc
      if (a.isFounder && !b.isFounder) return -1;
      if (!a.isFounder && b.isFounder) return 1;
      return b.balance - a.balance;
    });
}
