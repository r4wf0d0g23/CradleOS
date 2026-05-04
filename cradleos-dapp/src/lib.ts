import { Transaction } from "@mysten/sui/transactions";
import { SUI_GRAPHQL } from "./graphql";
import {
  CLOCK,
  CRADLEOS_PKG,
  CRADLEOS_ORIGINAL,
  CRADLEOS_UPGRADE_ORIGIN,
  CRADLEOS_EVENT_PKGS,
  TRIBE_ROLES_PKG,
  GATE_POLICY_PKG,
  EVE_COIN_TYPE,
  ENERGY_CONFIG,
  ENERGY_CONFIG_INITIAL_SHARED_VERSION,
  FUEL_CONFIG,
  NETWORK_NODE_TYPE,
  RAW_CHARACTER_ID,
  RAW_NETWORK_NODE_ID,
  RAW_NODE_OWNER_CAP,
  SUI_TESTNET_RPC,
  WORLD_API,
  WORLD_PKG,
  WORLD_PKG_UTOPIA_V1,
  STRUCTURE_TYPES,
  type StructureKind,
} from "./constants";

export type NodeDashboardData = {
  objectId: string;
  objectType: string;
  isOnline: boolean;
  fuelLevelPct: number;
  runtimeHoursRemaining: number;
  raw: Record<string, unknown> | null;
};

export type TribeOverviewData = {
  objectId: string;
  name: string;
  tribeId: string;
  memberCount: number;
  commander: string;
  raw: Record<string, unknown> | null;
};

type CoreLikeClient = {
  getObject: (options: { objectId: string; include?: Record<string, boolean> }) => Promise<{ object: { objectId: string; type: string; owner?: unknown; json?: Record<string, unknown> | null } }>;
  listOwnedObjects: (options: { owner: string; type?: string; include?: Record<string, boolean>; limit?: number }) => Promise<{ objects: Array<{ objectId: string; type?: string; json?: Record<string, unknown> | null }> }>;
};

export async function rpcGetObject(objectId: string): Promise<Record<string, unknown>> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "sui_getObject",
      params: [objectId, { showContent: true, showType: true, showOwner: true }],
    }),
  });
  const json = await res.json() as { result: { data: { content?: { fields?: Record<string, unknown>; type?: string } | null; type?: string; owner?: unknown } | null } };
  // Object deleted/not found — return empty sentinel
  if (!json.result?.data || !json.result.data.content?.fields) return { _deleted: true };
  const objType = json.result.data.type ?? json.result.data.content?.type ?? "";
  return { ...json.result.data.content.fields, _type: objType, _owner: json.result.data.owner };
}

async function rpcGetOwnedObjects(owner: string, typeFilter: string, limit = 50): Promise<Array<{ objectId: string; fields: Record<string, unknown> }>> {
  const res = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getOwnedObjects",
      params: [owner, { filter: { StructType: typeFilter }, options: { showContent: true, showType: true } }, null, limit],
    }),
  });
  const json = await res.json() as { result: { data: Array<{ data: { objectId: string; content: { fields: Record<string, unknown> } } }> } };
  return (json.result.data ?? []).map(item => ({
    objectId: item.data.objectId,
    fields: item.data.content?.fields ?? {},
  }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath(obj: unknown, ...path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    const rec = asRecord(current);
    if (!rec || !(key in rec)) return undefined;
    current = rec[key];
  }
  return current;
}

export function numish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}



function stringish(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "—";
}

function extractNodeMetrics(fields: Record<string, unknown>): NodeDashboardData {
  // Status: fields.status.fields.status.variant = "ONLINE" | "OFFLINE"
  const statusVariant = readPath(fields, "status", "fields", "status", "variant");
  const isOnline = statusVariant === "ONLINE";

  // Fuel: fields.fuel.fields.{quantity, max_capacity, unit_volume, burn_rate_in_ms}
  const fuelFields = asRecord(readPath(fields, "fuel", "fields")) ?? {};
  const quantity = numish(fuelFields["quantity"]) ?? 0;           // items
  const unitVolume = numish(fuelFields["unit_volume"]) ?? 28;     // cu per item
  const maxCapacity = numish(fuelFields["max_capacity"]) ?? 100000; // cu
  const burnRateMs = numish(fuelFields["burn_rate_in_ms"]) ?? 3600000; // ms per item

  const fuelVolume = quantity * unitVolume;
  const fuelLevelPct = maxCapacity > 0
    ? Math.max(0, Math.min(100, (fuelVolume / maxCapacity) * 100))
    : 0;

  // Runtime: quantity items × burn_rate_in_ms per item → hours
  const runtimeHours = (quantity * burnRateMs) / (1000 * 60 * 60);

  return {
    objectId: RAW_NETWORK_NODE_ID,
    objectType: stringish(readPath(fields, "_type")) || NETWORK_NODE_TYPE,
    isOnline,
    fuelLevelPct: Number(fuelLevelPct.toFixed(1)),
    runtimeHoursRemaining: Number(runtimeHours.toFixed(1)),
    raw: fields,
  };
}

function decodeMaybeAscii(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    try {
      return new TextDecoder().decode(new Uint8Array(value as number[]));
    } catch {
      return value.join(",");
    }
  }
  return "Unknown Tribe";
}

function extractCorpMetrics(fields: Record<string, unknown>, objectId: string): TribeOverviewData {
  const membersValue = readPath(fields, "members") ?? readPath(fields, "member_table");
  const memberCount =
    numish(readPath(fields, "member_count")) ??
    (Array.isArray(membersValue) ? membersValue.length : null) ??
    numish(readPath(membersValue, "size")) ??
    0;

  return {
    objectId,
    name: decodeMaybeAscii(readPath(fields, "name")),
    tribeId: stringish(readPath(fields, "tribe_id") ?? readPath(fields, "tribeId")),
    memberCount,
    commander: stringish(readPath(fields, "commander") ?? readPath(fields, "owner") ?? readPath(fields, "admin")),
    raw: fields,
  };
}

/** @deprecated — orphan component removed, kept for historical reference */
export async function fetchNodeDashboard(_client: CoreLikeClient): Promise<NodeDashboardData> {
  const fields = await rpcGetObject(RAW_NETWORK_NODE_ID);
  return extractNodeMetrics(fields);
}

/** @deprecated — orphan component removed, kept for historical reference */
export async function fetchCorpOverview(_client: CoreLikeClient): Promise<TribeOverviewData | null> {
  const results = await rpcGetOwnedObjects(
    RAW_CHARACTER_ID,
    `${CRADLEOS_ORIGINAL}::corp_registry::CorpRegistry`,
  );
  if (!results.length) return null;
  const { objectId, fields } = results[0];
  return extractCorpMetrics(fields, objectId);
}

/**
 * EnergyConfig is a shared object but functions accept it as &EnergyConfig (immutable).
 * tx.object() defaults to mutable for shared objects causing TypeMismatch.
 * Use this helper to pass it as an immutable shared object ref.
 */
function energyConfigRef(tx: Transaction) {
  return tx.sharedObjectRef({
    objectId: ENERGY_CONFIG,
    initialSharedVersion: ENERGY_CONFIG_INITIAL_SHARED_VERSION,
    mutable: false,
  });
}

/**
 * Extract the world package ID from a structure's typeFull string.
 * e.g. "0xd12a70c7...::network_node::NetworkNode" → "0xd12a70c7..."
 * Falls back to WORLD_PKG if parsing fails.
 */
function worldPkgFromType(typeFull: string): string {
  const match = typeFull.match(/^(0x[0-9a-fA-F]+)::/);
  return match ? match[1] : WORLD_PKG;
}

export function buildBringOnlineTransaction() {
  const tx = new Transaction();

  const [cap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [NETWORK_NODE_TYPE],
    arguments: [tx.object(RAW_CHARACTER_ID), tx.object(RAW_NODE_OWNER_CAP)],
  });

  tx.moveCall({
    target: `${WORLD_PKG}::network_node::online`,
    arguments: [tx.object(RAW_NETWORK_NODE_ID), cap, tx.object(CLOCK)],
  });

  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [NETWORK_NODE_TYPE],
    arguments: [tx.object(RAW_CHARACTER_ID), cap, receipt],
  });

  return tx;
}

const GATE_TYPE_FULL = `${WORLD_PKG}::gate::Gate`;
const GATE_TYPE_FULL_V1 = `${WORLD_PKG_UTOPIA_V1}::gate::Gate`;
const ASSEMBLY_TYPE_FULL = `${WORLD_PKG}::assembly::Assembly`;
const ASSEMBLY_TYPE_FULL_V1 = `${WORLD_PKG_UTOPIA_V1}::assembly::Assembly`;
const isGateType = (t: string) => t === GATE_TYPE_FULL || t === GATE_TYPE_FULL_V1;
const isAssemblyType = (t: string) => t === ASSEMBLY_TYPE_FULL || t === ASSEMBLY_TYPE_FULL_V1;

export async function buildBringOfflineTransaction(): Promise<Transaction> {
  // Fetch live connected assembly IDs and their types
  const fields = await rpcGetObject(RAW_NETWORK_NODE_ID);
  const connectedIds = (fields["connected_assembly_ids"] as string[] | undefined) ?? [];

  // Resolve type for each connected assembly
  const assemblyMeta: Array<{ id: string; type: string }> = await Promise.all(
    connectedIds.map(async (id) => {
      const res = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showType: true }] }),
      });
      const json = await res.json() as { result: { data: { type: string } } };
      return { id, type: json.result.data.type };
    })
  );

  const tx = new Transaction();

  const [cap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [NETWORK_NODE_TYPE],
    arguments: [tx.object(RAW_CHARACTER_ID), tx.object(RAW_NODE_OWNER_CAP)],
  });

  let offlineHotPotato = tx.moveCall({
    target: `${WORLD_PKG}::network_node::offline`,
    arguments: [tx.object(RAW_NETWORK_NODE_ID), tx.object(FUEL_CONFIG), cap, tx.object(CLOCK)],
  })[0];

  // Drain connected assemblies from the hot potato
  for (const { id, type } of assemblyMeta) {
    if (isGateType(type)) {
      offlineHotPotato = tx.moveCall({
        target: `${WORLD_PKG}::gate::offline_connected_gate`,
        arguments: [tx.object(id), offlineHotPotato, tx.object(RAW_NETWORK_NODE_ID), energyConfigRef(tx)],
      })[0];
    } else if (isAssemblyType(type)) {
      offlineHotPotato = tx.moveCall({
        target: `${WORLD_PKG}::assembly::offline_connected_assembly`,
        arguments: [tx.object(id), offlineHotPotato, tx.object(RAW_NETWORK_NODE_ID), energyConfigRef(tx)],
      })[0];
    }
    // other assembly types (turret, storage_unit) can be added here
  }

  tx.moveCall({
    target: `${WORLD_PKG}::network_node::destroy_offline_assemblies`,
    arguments: [offlineHotPotato],
  });

  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [NETWORK_NODE_TYPE],
    arguments: [tx.object(RAW_CHARACTER_ID), cap, receipt],
  });

  return tx;
}

// ─── Dynamic Player Structures ───────────────────────────────────────────────

export type PlayerStructure = {
  objectId: string;
  ownerCapId: string;
  kind: StructureKind;
  typeFull: string;
  label: string;        // kind label (e.g. "Network Node")
  displayName: string;  // metadata.name if set, else typeName if resolved, else label
  typeName?: string;    // resolved from World API /v2/types (e.g. "Mini Turret", "Heavy Storage")
  hasCustomName: boolean; // true if user set a custom metadata.name
  isOnline: boolean;
  locationHash: string;
  solarSystemId?: number;
  energySourceId?: string;
  fuelLevelPct?: number;
  runtimeHoursRemaining?: number;
  typeId?: number;      // on-chain type_id for energy cost lookup
  energyCost?: number;  // energy units required to bring online
  gameItemId?: string;  // key.item_id — the numeric game ID used by uat.dapps.evefrontier.com
  linkedGateId?: string; // linked_gate_id if this is a Gate — the Sui object ID of the paired gate
  metadataUrl?: string;  // metadata.url — used for kiosk/link attachment
  initialSharedVersion?: number;            // for shared objects — needed for explicit shared object refs
  energySourceInitialSharedVersion?: number; // initialSharedVersion of the energy source (node/gate)
};

// Cache for type names from World API
let _typeNameCache: Map<number, string> | null = null;

export async function fetchTypeNames(): Promise<Map<number, string>> {
  if (_typeNameCache) return _typeNameCache;
  const m = new Map<number, string>();
  try {
    // Fetch all types (deployables + structures)
    const url = `${WORLD_API}/v2/types?limit=500`;
    const res = await fetch(url);
    const data = await res.json() as { data: Array<{ id: number; name: string; categoryName: string }> };
    for (const t of data.data ?? []) {
      if (t.categoryName === "Deployable" || t.categoryName === "Structure") {
        m.set(t.id, t.name);
      }
    }
  } catch (e) {
    console.error("[fetchTypeNames] Failed:", e);
  }
  _typeNameCache = m;
  return m;
}

/** Fetch the EnergyConfig table and return a map: typeId -> energyCost */
export async function fetchEnergyCostMap(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  try {
    // EnergyConfig assembly_energy table id
    const TABLE_ID = "0x885c80a9c99b4fd24a0026981cceb73ebdc519b59656adfbbcce0061a87a1ed9";
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getDynamicFields", params: [TABLE_ID, null, 50] }),
    });
    const j = await res.json() as { result: { data: Array<{ name: { value: string }; objectId: string }> } };
    const entries = j.result.data;
    // Fetch all entry values in parallel
    await Promise.all(entries.map(async ({ name, objectId }) => {
      const r = await fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [objectId, { showContent: true }] }),
      });
      const rj = await r.json() as { result: { data: { content: { fields: { value: string } } } } };
      const cost = parseInt(rj.result.data.content.fields.value, 10);
      if (!isNaN(cost)) map.set(parseInt(name.value, 10), cost);
    }));
  } catch { /* return partial map on error */ }
  return map;
}

/** Fetch available energy for a NetworkNode: current_production - total_reserved */
export function parseAvailableEnergy(nodeFields: Record<string, unknown>): number {
  const es = (nodeFields["energy_source"] as { fields?: Record<string, unknown> } | undefined)?.fields ?? {};
  const prod = numish(es["current_energy_production"]) ?? 0;
  const reserved = numish(es["total_reserved_energy"]) ?? 0;
  return Math.max(0, prod - reserved);
}

export type LocationGroup = {
  key: string;               // solarSystemId as string, or "unknown"
  solarSystemId?: number;
  tabLabel: string;
  structures: PlayerStructure[];
};

export type CharacterInfo = {
  characterId: string;
  tribeId: number;
};

/** Try to find a PlayerProfile owned by walletAddress for a given world package.
 *
 * Robustness: CCP's `delete_character` (and `update_address`) intentionally do NOT
 * clean up wallet-owned PlayerProfiles. When a player destroys + remakes a character,
 * the old PlayerProfile lingers on the wallet, pointing at a now-deleted Character
 * object. Naively picking `data[0]` causes CradleOS to operate on the dead character
 * (no structures visible, vault unreachable). World API fix is unrelated to this:
 * the bug is purely in client-side discovery.
 *
 * Strategy: fetch ALL PlayerProfiles on the wallet, dereference each linked Character
 * in parallel, drop any whose Character object is deleted on chain, and return the
 * surviving one. If multiple live characters exist (multi-character wallet — rare),
 * tiebreak on Sui object `version` (newest wins; version strictly increases per
 * object so it correlates with creation/state recency).
 *
 * Tribe is NEVER used to filter or score. NPC-tribe players (tribe_id in the 1000xxx
 * range, e.g. Clonebank 86 = 1000167) are valid CradleOS users and must have full
 * access. Tribe is read off the live Character and returned as-is to the caller. */
async function findPlayerProfileForPkg(walletAddress: string, pkg: string): Promise<CharacterInfo | null> {
  // Use _ssuFetchWithRetry on this critical boot path — a single
  // transient fetch error here trips both the dashboard "Failed to fetch"
  // banner and the ServerMismatchBanner "Character Not Found" warning.
  const ppRes = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getOwnedObjects",
      params: [
        walletAddress,
        { filter: { StructType: `${pkg}::character::PlayerProfile` }, options: { showContent: true } },
        null, 50,
      ],
    }),
  });
  const ppJson = await ppRes.json() as {
    result: { data: Array<{ data: { objectId: string; content: { fields: { character_id: string } } } }> }
  };
  const profiles = ppJson.result?.data ?? [];
  if (profiles.length === 0) return null;

  // Dereference each PlayerProfile's Character in parallel.
  // We need version for the tiebreaker, so we hit sui_getObject directly here
  // (rpcGetObject helper strips version). We still rely on the same `_deleted`
  // semantics: missing/null Character data == deleted.
  type Resolved = { characterId: string; tribeId: number; version: number };
  const resolved: Resolved[] = (await Promise.all(
    profiles.map(async (pp): Promise<Resolved | null> => {
      const charId = pp?.data?.content?.fields?.character_id;
      if (!charId) return null;
      const res = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "sui_getObject",
          params: [charId, { showContent: true, showOwner: true }],
        }),
      });
      const json = await res.json() as {
        result?: {
          data?: {
            version?: string;
            content?: { fields?: Record<string, unknown> } | null;
          } | null;
        };
      };
      const data = json.result?.data;
      // Deleted/non-existent: sui_getObject returns null data (or null content).
      // This is THE ONLY filter we apply. Do not filter on tribe_id.
      if (!data?.content?.fields) return null;
      const tribeId = numish(data.content.fields["tribe_id"]) ?? 0;
      const version = Number(data.version ?? 0);
      return { characterId: charId, tribeId, version };
    })
  )).filter((x): x is Resolved => x !== null);

  if (resolved.length === 0) return null;
  if (resolved.length === 1) {
    return { characterId: resolved[0].characterId, tribeId: resolved[0].tribeId };
  }

  // Multi-character wallet: prefer newest by Sui object version.
  resolved.sort((a, b) => b.version - a.version);
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      `[findPlayerProfileForPkg] wallet ${walletAddress.slice(0, 10)}\u2026 has ${resolved.length} live characters on pkg ${pkg.slice(0, 10)}\u2026; using newest`,
      resolved.map(r => ({ id: r.characterId.slice(0, 10) + "\u2026", tribe: r.tribeId, ver: r.version })),
    );
  }
  return { characterId: resolved[0].characterId, tribeId: resolved[0].tribeId };
}

export async function findCharacterForWallet(walletAddress: string): Promise<CharacterInfo | null> {
  // Primary: query PlayerProfile owned object — try BOTH world package versions (v2 then v1)
  // Characters created before the v0.0.21 upgrade have PlayerProfiles from the v1 package.
  const current = await findPlayerProfileForPkg(walletAddress, WORLD_PKG);
  if (current) return current;

  // Fallback to v1 Utopia package (characters created before world-contracts v0.0.21 upgrade)
  const v1 = await findPlayerProfileForPkg(walletAddress, WORLD_PKG_UTOPIA_V1);
  if (v1) return v1;

  // Last resort: scan CharacterCreatedEvent for both packages.
  // Use _ssuFetchWithRetry so a transient network blip on the very first
  // load doesn't fail the entire dashboard with "Failed to fetch".
  for (const pkg of [WORLD_PKG, WORLD_PKG_UTOPIA_V1]) {
    let cursor: string | null = null;
    do {
      const res = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "suix_queryEvents",
          params: [
            { MoveEventType: `${pkg}::character::CharacterCreatedEvent` },
            cursor, 50, false,
          ],
        }),
      });
      const json = await res.json() as {
        result: {
          data: Array<{ parsedJson: { character_address: string; character_id: string; tribe_id: string | number } }>;
          hasNextPage: boolean;
          nextCursor: string | null;
        }
      };
      const match = json.result?.data?.find(
        e => e.parsedJson.character_address.toLowerCase() === walletAddress.toLowerCase()
      );
      if (match) return {
        characterId: match.parsedJson.character_id,
        tribeId: Number(match.parsedJson.tribe_id),
      };
      cursor = json.result?.hasNextPage ? json.result.nextCursor : null;
    } while (cursor);
  }
  return null;
}

/** Fetch the wallet's character's *current* tribe_id.
 *  Reads from the Character object directly (not CharacterCreatedEvent) so it
 *  reflects the current tribe after creation/switch, not just the spawn tribe.
 */
export async function fetchCharacterTribeId(walletAddress: string): Promise<number | null> {
  const charInfo = await findCharacterForWallet(walletAddress);
  if (!charInfo) return null;
  const fields = await rpcGetObject(charInfo.characterId);
  return numish(fields["tribe_id"]);
}

/** Fetch all LocationRevealedEvents and return a map: assemblyId -> solarSystemId */
async function buildLocationEventMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let cursor: string | null = null;
  do {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${WORLD_PKG}::location::LocationRevealedEvent` },
          cursor, 100, false,
        ],
      }),
    });
    const json = await res.json() as {
      result: {
        data: Array<{ parsedJson: { assembly_id: string; solarsystem: string | number } }>;
        hasNextPage: boolean;
        nextCursor: string | null;
      };
    };
    for (const e of json.result.data) {
      const sysId = Number(e.parsedJson.solarsystem);
      if (e.parsedJson.assembly_id && sysId && !isNaN(sysId)) {
        map.set(e.parsedJson.assembly_id, sysId);
      }
    }
    cursor = json.result.hasNextPage ? json.result.nextCursor : null;
  } while (cursor);
  return map;
}

async function resolveSystemName(solarSystemId: number): Promise<string> {
  try {
    const res = await fetch(`${WORLD_API}/v2/solarsystems/${solarSystemId}`);
    if (res.ok) {
      const json = await res.json() as { name?: string };
      if (json.name) return json.name;
    }
  } catch { /* fallback */ }
  return `System ${solarSystemId}`;
}

/** Fetch tribe metadata from the World API. Returns null if not found. */
export async function fetchTribeInfo(tribeId: number): Promise<{
  name: string; nameShort: string; description: string; taxRate: number; tribeUrl: string;
} | null> {
  try {
    const res = await fetch(`${WORLD_API}/v2/tribes/${tribeId}`);
    if (res.ok) {
      const j = await res.json() as {
        id: number; name: string; nameShort: string;
        description: string; taxRate: number; tribeUrl: string;
      };
      return { name: j.name, nameShort: j.nameShort, description: j.description, taxRate: j.taxRate, tribeUrl: j.tribeUrl };
    }
  } catch { /* fallback */ }
  return null;
}

/** Server-membership check: returns true if the given (tribeId, vaultCoin)
 *  pair belongs to the active server.
 *
 *  IMPORTANT: existence-only checks are NOT sufficient. The CradleOS Move
 *  package is shared across Stillness and Utopia, and the SAME tribe_id can
 *  refer to entirely different tribes on each server (e.g. 98000013 =
 *  'Nirvana' on Stillness, 'DemoCorp' on Utopia). A previous version of
 *  this function only checked whether the tribe existed on the active
 *  server's API — which let cross-server vaults leak through whenever a
 *  same-numbered tribe coincidentally existed on both.
 *
 *  The cleanest discriminator is the vault's `coin_symbol` (or `coin_name`):
 *  when a tribe creates a CradleOS vault, the on-chain coin_symbol mirrors
 *  the in-game tribe ticker. We compare it against the active server's
 *  `nameShort` (and `name` as a fallback) for that tribe_id. Mismatch →
 *  the vault belongs to the OTHER server's tribe with the same id.
 *
 *  When `vaultCoinSymbol` is empty (legacy/empty vaults that bypassed the
 *  named-vault filter), we fall back to existence-only — better to show a
 *  potentially-cross-server tribe than to hide a legitimate one with no
 *  coin_symbol set.
 *
 *  Memoized per-process to avoid re-querying the World API. */
const _tribeOnServerMemo = new Map<string, boolean>();
export async function isTribeOnActiveServer(
  tribeId: number,
  vaultCoinSymbol?: string,
  vaultCoinName?: string,
): Promise<boolean> {
  const memoKey = `${tribeId}|${(vaultCoinSymbol ?? "").toLowerCase()}|${(vaultCoinName ?? "").toLowerCase()}`;
  if (_tribeOnServerMemo.has(memoKey)) return _tribeOnServerMemo.get(memoKey)!;
  const info = await fetchTribeInfo(tribeId);
  if (!info) {
    _tribeOnServerMemo.set(memoKey, false);
    return false;
  }
  // No vault coin to compare against — existence is best we have. Used by
  // legacy callers that don't have the vault data on hand.
  if (!vaultCoinSymbol && !vaultCoinName) {
    _tribeOnServerMemo.set(memoKey, true);
    return true;
  }
  // Compare vault coin_symbol/coin_name against the active server's tribe
  // identity. Match either nameShort (ticker) or name. Case-insensitive.
  const apiShort = info.nameShort?.toLowerCase() ?? "";
  const apiName = info.name?.toLowerCase() ?? "";
  const vaultSym = (vaultCoinSymbol ?? "").toLowerCase();
  const vaultName = (vaultCoinName ?? "").toLowerCase();
  // The vault's coin_name is often a versioned/decorated form of the tribe
  // name (e.g. 'Reapers_v2' for the 'Reapers' tribe), so we match by
  // prefix-or-substring rather than equality. coin_symbol matches the
  // ticker more strictly.
  const symbolMatches = !!(vaultSym && (vaultSym === apiShort || vaultSym === apiName));
  const nameMatches = !!(vaultName && (
    vaultName === apiName ||
    vaultName.startsWith(apiName) ||
    apiName.startsWith(vaultName)
  ));
  const onServer = symbolMatches || nameMatches;
  _tribeOnServerMemo.set(memoKey, onServer);
  return onServer;
}

/** Fetch solar system details (name, constellation, region, gateLinks). */
export async function fetchSolarSystem(systemId: number): Promise<{
  id: number; name: string; constellationId: number; regionId: number;
} | null> {
  try {
    const res = await fetch(`${WORLD_API}/v2/solarsystems/${systemId}`);
    if (res.ok) return await res.json() as { id: number; name: string; constellationId: number; regionId: number };
  } catch { /* */ }
  return null;
}

export async function fetchPlayerStructures(walletAddress: string): Promise<LocationGroup[]> {
  const charInfo = await findCharacterForWallet(walletAddress);
  const characterId = charInfo?.characterId ?? null;
  if (!characterId) return [];

  // Discover all OwnerCaps
  const capEntries: Array<{ capId: string; structureId: string; kind: StructureKind; typeFull: string; label: string }> = [];
  // Query OwnerCaps for both world package versions — characters created before v0.0.21
  // have OwnerCaps typed against the v1 package (WORLD_PKG_UTOPIA_V1).
  const worldPkgsToCheck = Array.from(new Set([WORLD_PKG, WORLD_PKG_UTOPIA_V1]));
  await Promise.all(
    STRUCTURE_TYPES.flatMap(({ type: structType, kind, label }) =>
      worldPkgsToCheck.map(async (wpkg) => {
        // Build the struct type using the current pkg prefix but override the world pkg
        const structTypePkgSwapped = structType.replace(WORLD_PKG, wpkg);
        const ownerCapType = `${wpkg}::access::OwnerCap<${structTypePkgSwapped}>`;
        const caps = await rpcGetOwnedObjects(characterId, ownerCapType, 50);
        for (const { objectId: capId, fields } of caps) {
          const structureId = fields["authorized_object_id"] as string;
          if (structureId && !capEntries.some(e => e.structureId === structureId)) {
            capEntries.push({ capId, structureId, kind, typeFull: structTypePkgSwapped, label });
          }
        }
      })
    )
  );
  if (!capEntries.length) return [];

  // Fetch location events + structure objects in parallel
  const [locationMap, structureObjects] = await Promise.all([
    buildLocationEventMap(),
    Promise.all(
      capEntries.map(async ({ capId, structureId, kind, typeFull, label }) => {
        const fields = await rpcGetObject(structureId);
        // Skip objects deleted on-chain (dismantled structures)
        if (fields._deleted) return null;

        // Location hash
        const locFields = asRecord(readPath(fields, "location", "fields")) ?? {};
        const locationHashBytes = (locFields["location_hash"] as number[] | undefined) ?? [];
        const locationHash = locationHashBytes.map((b: number) => b.toString(16).padStart(2, "0")).join("");

        // Status
        const statusVariant = readPath(fields, "status", "fields", "status", "variant");
        const isOnline = statusVariant === "ONLINE";

        // Connected NetworkNode
        const esRaw = fields["energy_source_id"];
        const energySourceId = typeof esRaw === "string" ? esRaw : undefined;

        // Display name: metadata.name if set by user, else kind label (type name resolved later)
        const metaName = stringish(readPath(fields, "metadata", "fields", "name")).trim();
        const hasCustomName = metaName.length > 0;
        const displayName = metaName || label;

        // Fuel (NetworkNode only)
        let fuelLevelPct: number | undefined;
        let runtimeHoursRemaining: number | undefined;
        if (kind === "NetworkNode") {
          const fuelFields = asRecord(readPath(fields, "fuel", "fields")) ?? {};
          const qty = numish(fuelFields["quantity"]) ?? 0;
          const uv = numish(fuelFields["unit_volume"]) ?? 28;
          const mc = numish(fuelFields["max_capacity"]) ?? 100000;
          const br = numish(fuelFields["burn_rate_in_ms"]) ?? 3600000;
          fuelLevelPct = mc > 0 ? (qty * uv / mc) * 100 : 0;
          runtimeHoursRemaining = qty * br / 3_600_000;
        }

        // type_id for energy cost lookup
        const typeId = numish(fields["type_id"]) ?? undefined;

        // game item_id (key.item_id) — needed for uat.dapps.evefrontier.com links
        const keyFields = asRecord(readPath(fields, "key", "fields")) ?? {};
        const gameItemId = stringish(keyFields["item_id"]) || undefined;

        // linked gate id (Gate only)
        const linkedGateIdRaw = fields["linked_gate_id"];
        const linkedGateId = typeof linkedGateIdRaw === "string" && linkedGateIdRaw.length > 0 ? linkedGateIdRaw : undefined;

        const metaUrl = stringish(readPath(fields, "metadata", "fields", "url"))?.trim() ?? "";
        return { objectId: structureId, ownerCapId: capId, kind, typeFull, label, displayName, hasCustomName, isOnline, locationHash, energySourceId, fuelLevelPct, runtimeHoursRemaining, typeId, gameItemId, linkedGateId, metadataUrl: metaUrl || undefined } as PlayerStructure;
      })
    ),
  ]);

  // Filter out deleted objects (dismantled), then resolve type names + energy costs
  const validStructures = structureObjects.filter((s): s is PlayerStructure => s !== null);
  const [energyCostMap, typeNameMap] = await Promise.all([fetchEnergyCostMap(), fetchTypeNames()]);

  // Resolve type names for structures without custom names
  let typeResolved = 0;
  for (const s of validStructures) {
    if (s.typeId !== undefined && typeNameMap.has(s.typeId)) {
      s.typeName = typeNameMap.get(s.typeId);
      if (!s.hasCustomName && s.typeName) {
        s.displayName = s.typeName;
        typeResolved++;
      }
    }
  }
  const structuresWithCost = validStructures.map(s => ({
    ...s,
    energyCost: s.typeId !== undefined ? (energyCostMap.get(s.typeId) ?? 0) : 0,
  }));

  // Attach solarSystemId from event map
  const structures = structuresWithCost.map((s: PlayerStructure & { energyCost: number }) => ({
    ...s,
    solarSystemId: locationMap.get(s.objectId),
  }));

  // Group by solarSystemId (resolved) or "unknown" (all unresolved together)
  const groups = new Map<string, { solarSystemId?: number; structs: PlayerStructure[] }>();
  for (const s of structures) {
    const key = s.solarSystemId ? String(s.solarSystemId) : "unknown";
    if (!groups.has(key)) groups.set(key, { solarSystemId: s.solarSystemId, structs: [] });
    groups.get(key)!.structs.push(s);
  }

  // Resolve tab labels
  const result: LocationGroup[] = await Promise.all(
    Array.from(groups.entries()).map(async ([key, { solarSystemId, structs }]) => {
      let tabLabel = "Your Structures";
      if (solarSystemId) {
        tabLabel = await resolveSystemName(solarSystemId);
      }
      return { key, solarSystemId, tabLabel, structures: structs };
    })
  );

  // Sort: resolved systems first, unknown last
  result.sort((a, b) => (a.key === "unknown" ? 1 : 0) - (b.key === "unknown" ? 1 : 0));
  return result;
}

// ─── Batch Tx Builders (single PTB, one signature) ───────────────────────────

/**
 * Online all given structures in a single PTB.
 * Each structure's borrow_owner_cap → online → return_owner_cap is chained
 * sequentially inside the block. Character (shared object) is reused across
 * commands — valid in Sui since commands execute sequentially and each
 * borrow/return pair completes before the next begins.
 */
export function buildBatchOnlineTransaction(
  structures: PlayerStructure[],
  characterId: string,
): Transaction {
  if (!characterId || characterId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Character ID not yet resolved — please wait a moment and try again.");
  }
  const tx = new Transaction();
  for (const s of structures) {
    const wpkg = worldPkgFromType(s.typeFull);
    const [cap, receipt] = tx.moveCall({
      target: `${wpkg}::character::borrow_owner_cap`,
      typeArguments: [s.typeFull],
      arguments: [tx.object(characterId), tx.object(s.ownerCapId)],
    });

    if (s.kind === "NetworkNode") {
      tx.moveCall({
        target: `${wpkg}::network_node::online`,
        arguments: [tx.object(s.objectId), cap, tx.object(CLOCK)],
      });
    } else if (s.kind === "Gate") {
      tx.moveCall({
        target: `${wpkg}::gate::online`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    } else if (s.kind === "Assembly") {
      tx.moveCall({
        target: `${wpkg}::assembly::online`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    } else if (s.kind === "Turret") {
      tx.moveCall({
        target: `${wpkg}::turret::online`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    } else if (s.kind === "StorageUnit") {
      tx.moveCall({
        target: `${wpkg}::storage_unit::online`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    }

    tx.moveCall({
      target: `${wpkg}::character::return_owner_cap`,
      typeArguments: [s.typeFull],
      arguments: [tx.object(characterId), cap, receipt],
    });
  }
  return tx;
}

/** Offline all given structures in a single PTB (async — NetworkNode requires RPC prefetch). */
export async function buildBatchOfflineTransaction(
  structures: PlayerStructure[],
  characterId: string,
): Promise<Transaction> {
  if (!characterId || characterId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Character ID not yet resolved — please wait a moment and try again.");
  }
  const tx = new Transaction();

  for (const s of structures) {
    const wpkg = worldPkgFromType(s.typeFull);
    const [cap, receipt] = tx.moveCall({
      target: `${wpkg}::character::borrow_owner_cap`,
      typeArguments: [s.typeFull],
      arguments: [tx.object(characterId), tx.object(s.ownerCapId)],
    });

    if (s.kind === "NetworkNode") {
      const fields = await rpcGetObject(s.objectId);
      const connectedIds = (fields["connected_assembly_ids"] as string[] | undefined) ?? [];
      const assemblyMeta: Array<{ id: string; type: string }> = await Promise.all(
        connectedIds.map(async (id) => {
          const res = await fetch(SUI_TESTNET_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showType: true }] }),
          });
          const j = await res.json() as { result: { data: { type: string } } };
          return { id, type: j.result.data.type };
        })
      );
      let hotPotato = tx.moveCall({
        target: `${wpkg}::network_node::offline`,
        arguments: [tx.object(s.objectId), tx.object(FUEL_CONFIG), cap, tx.object(CLOCK)],
      })[0];
      for (const { id, type } of assemblyMeta) {
        const cwpkg = worldPkgFromType(type);
        if (isGateType(type)) {
          hotPotato = tx.moveCall({
            target: `${cwpkg}::gate::offline_connected_gate`,
            arguments: [tx.object(id), hotPotato, tx.object(s.objectId), energyConfigRef(tx)],
          })[0];
        } else if (isAssemblyType(type)) {
          hotPotato = tx.moveCall({
            target: `${cwpkg}::assembly::offline_connected_assembly`,
            arguments: [tx.object(id), hotPotato, tx.object(s.objectId), energyConfigRef(tx)],
          })[0];
        }
      }
      tx.moveCall({ target: `${wpkg}::network_node::destroy_offline_assemblies`, arguments: [hotPotato] });
    } else if (s.kind === "Gate") {
      tx.moveCall({
        target: `${wpkg}::gate::offline`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    } else if (s.kind === "Assembly") {
      tx.moveCall({
        target: `${wpkg}::assembly::offline`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    } else if (s.kind === "Turret") {
      tx.moveCall({
        target: `${wpkg}::turret::offline`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    } else if (s.kind === "StorageUnit") {
      tx.moveCall({
        target: `${wpkg}::storage_unit::offline`,
        arguments: [tx.object(s.objectId), tx.object(s.energySourceId!), energyConfigRef(tx), cap],
      });
    }

    tx.moveCall({
      target: `${wpkg}::character::return_owner_cap`,
      typeArguments: [s.typeFull],
      arguments: [tx.object(characterId), cap, receipt],
    });
  }

  return tx;
}

// ─── Generic Structure Tx Builders ───────────────────────────────────────────

/** Fetch initialSharedVersion for a Sui object (needed for explicit shared object refs) */
export async function fetchInitialSharedVersion(objectId: string): Promise<number | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [objectId, { showOwner: true }] }),
    });
    const d = await res.json() as { result?: { data?: { owner?: { Shared?: { initial_shared_version?: number } } } } };
    return d?.result?.data?.owner?.Shared?.initial_shared_version ?? null;
  } catch { return null; }
}

/** Build a shared object ref — mutable by default (most structures take &mut) */
export function sharedRef(tx: Transaction, objectId: string, initialSharedVersion: number, mutable = true) {
  return tx.sharedObjectRef({ objectId, initialSharedVersion, mutable });
}

export async function buildStructureOnlineTransaction(
  structure: PlayerStructure,
  characterId: string,
): Promise<Transaction> {
  if (!characterId || characterId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Character ID not yet resolved — please wait a moment and try again.");
  }

  // Derive the correct world pkg from the structure's type — handles v1 and v2 packages
  const wpkg = worldPkgFromType(structure.typeFull);

  // Fetch shared versions if not already on the structure
  const structureISV = structure.initialSharedVersion
    ?? (await fetchInitialSharedVersion(structure.objectId));
  const energyISV = structure.energySourceInitialSharedVersion
    ?? (structure.energySourceId ? await fetchInitialSharedVersion(structure.energySourceId) : null);

  const tx = new Transaction();

  const [cap, receipt] = tx.moveCall({
    target: `${wpkg}::character::borrow_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), tx.object(structure.ownerCapId)],
  });

  // Helper: get object ref — use sharedRef if we have an ISV, otherwise fall back to tx.object
  const structRef = structureISV
    ? sharedRef(tx, structure.objectId, structureISV)
    : tx.object(structure.objectId);
  const energyRef = (energyISV && structure.energySourceId)
    ? sharedRef(tx, structure.energySourceId, energyISV)
    : structure.energySourceId ? tx.object(structure.energySourceId) : null;

  if (structure.kind === "NetworkNode") {
    tx.moveCall({
      target: `${wpkg}::network_node::online`,
      arguments: [structRef, cap, tx.object(CLOCK)],
    });
  } else if (structure.kind === "Gate") {
    tx.moveCall({
      target: `${wpkg}::gate::online`,
      arguments: [structRef, energyRef!, energyConfigRef(tx), cap],
    });
  } else if (structure.kind === "Assembly") {
    tx.moveCall({
      target: `${wpkg}::assembly::online`,
      arguments: [structRef, energyRef!, energyConfigRef(tx), cap],
    });
  } else if (structure.kind === "Turret") {
    tx.moveCall({
      target: `${wpkg}::turret::online`,
      arguments: [structRef, energyRef!, energyConfigRef(tx), cap],
    });
  } else if (structure.kind === "StorageUnit") {
    tx.moveCall({
      target: `${wpkg}::storage_unit::online`,
      arguments: [structRef, energyRef!, energyConfigRef(tx), cap],
    });
  }

  tx.moveCall({
    target: `${wpkg}::character::return_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), cap, receipt],
  });

  return tx;
}

export async function buildStructureOfflineTransaction(
  structure: PlayerStructure,
  characterId: string,
): Promise<Transaction> {
  if (!characterId || characterId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("Character ID not yet resolved — please wait a moment and try again.");
  }
  const wpkg = worldPkgFromType(structure.typeFull);
  const tx = new Transaction();

  const [cap, receipt] = tx.moveCall({
    target: `${wpkg}::character::borrow_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), tx.object(structure.ownerCapId)],
  });

  if (structure.kind === "NetworkNode") {
    const fields = await rpcGetObject(structure.objectId);
    const connectedIds = (fields["connected_assembly_ids"] as string[] | undefined) ?? [];
    const assemblyMeta: Array<{ id: string; type: string }> = await Promise.all(
      connectedIds.map(async (id) => {
        const res = await fetch(SUI_TESTNET_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [id, { showType: true }] }),
        });
        const j = await res.json() as { result: { data: { type: string } } };
        return { id, type: j.result.data.type };
      })
    );

    let hotPotato = tx.moveCall({
      target: `${wpkg}::network_node::offline`,
      arguments: [tx.object(structure.objectId), tx.object(FUEL_CONFIG), cap, tx.object(CLOCK)],
    })[0];

    for (const { id, type } of assemblyMeta) {
      const connectedWpkg = worldPkgFromType(type);
      if (isGateType(type)) {
        hotPotato = tx.moveCall({
          target: `${connectedWpkg}::gate::offline_connected_gate`,
          arguments: [tx.object(id), hotPotato, tx.object(structure.objectId), energyConfigRef(tx)],
        })[0];
      } else if (isAssemblyType(type)) {
        hotPotato = tx.moveCall({
          target: `${connectedWpkg}::assembly::offline_connected_assembly`,
          arguments: [tx.object(id), hotPotato, tx.object(structure.objectId), energyConfigRef(tx)],
        })[0];
      }
    }
    tx.moveCall({ target: `${wpkg}::network_node::destroy_offline_assemblies`, arguments: [hotPotato] });
  } else if (structure.kind === "Gate") {
    tx.moveCall({
      target: `${wpkg}::gate::offline`,
      arguments: [tx.object(structure.objectId), tx.object(structure.energySourceId!), energyConfigRef(tx), cap],
    });
  } else if (structure.kind === "Assembly") {
    tx.moveCall({
      target: `${wpkg}::assembly::offline`,
      arguments: [tx.object(structure.objectId), tx.object(structure.energySourceId!), energyConfigRef(tx), cap],
    });
  } else if (structure.kind === "Turret") {
    tx.moveCall({
      target: `${wpkg}::turret::offline`,
      arguments: [tx.object(structure.objectId), tx.object(structure.energySourceId!), energyConfigRef(tx), cap],
    });
  } else if (structure.kind === "StorageUnit") {
    tx.moveCall({
      target: `${wpkg}::storage_unit::offline`,
      arguments: [tx.object(structure.objectId), tx.object(structure.energySourceId!), energyConfigRef(tx), cap],
    });
  }

  tx.moveCall({
    target: `${wpkg}::character::return_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), cap, receipt],
  });

  return tx;
}

// ─── Rename Transaction ───────────────────────────────────────────────────────

export function buildRenameTransaction(
  structure: PlayerStructure,
  characterId: string,
  newName: string,
): Transaction {
  const tx = new Transaction();

  const [cap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), tx.object(structure.ownerCapId)],
  });

  const MOD: Record<string, string> = {
    NetworkNode: "network_node",
    Gate: "gate",
    Assembly: "assembly",
    Turret: "turret",
    StorageUnit: "storage_unit",
  };
  const mod = MOD[structure.kind];
  if (mod) {
    tx.moveCall({
      target: `${WORLD_PKG}::${mod}::update_metadata_name`,
      arguments: [tx.object(structure.objectId), cap, tx.pure.string(newName)],
    });
  }

  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), cap, receipt],
  });

  return tx;
}

export function buildSetUrlTransaction(
  structure: PlayerStructure,
  characterId: string,
  url: string,
): Transaction {
  const tx = new Transaction();

  const [cap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), tx.object(structure.ownerCapId)],
  });

  const MOD: Record<string, string> = {
    NetworkNode: "network_node",
    Gate: "gate",
    Assembly: "assembly",
    Turret: "turret",
    StorageUnit: "storage_unit",
  };
  const mod = MOD[structure.kind];
  if (mod) {
    tx.moveCall({
      target: `${WORLD_PKG}::${mod}::update_metadata_url`,
      arguments: [tx.object(structure.objectId), cap, tx.pure.string(url)],
    });
  }

  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [structure.typeFull],
    arguments: [tx.object(characterId), cap, receipt],
  });

  return tx;
}

// ─── Corp & Treasury ──────────────────────────────────────────────────────────

import {
  CORP_TYPE,
  MEMBER_CAP_TYPE,
  TREASURY_TYPE,
  REGISTRY_TYPE,

} from "./constants";

export type MemberCapInfo = {
  objectId: string;
  corpId: string;
  member: string;
  role: number;   // 0=member, 1=officer, 2=director
};

export type CorpState = {
  corpId: string;
  name: string;
  founder: string;
  memberCount: number;
  active: boolean;
};

export type TreasuryState = {
  objectId: string;
  corpId: string;
  balanceMist: bigint;
  totalDepositedMist: bigint;
  totalWithdrawnMist: bigint;
  balanceSui: number;
};

export type TreasuryActivity = {
  kind: "deposit" | "withdraw";
  amount: number;
  actor: string;
  newBalance: number;
  timestampMs: number;
};

/** Find MemberCap owned by the connected wallet for a given corp (or first found). */
export async function fetchMemberCap(walletAddress: string): Promise<MemberCapInfo | null> {
  const caps = await rpcGetOwnedObjects(walletAddress, MEMBER_CAP_TYPE, 10);
  if (!caps.length) return null;
  const { objectId, fields } = caps[0];
  return {
    objectId,
    corpId: fields["corp_id"] as string,
    member: fields["member"] as string,
    role: numish(fields["role"]) ?? 0,
  };
}

/** Fetch Corp state by shared object ID. */
export async function fetchCorpState(corpId: string): Promise<CorpState | null> {
  try {
    const fields = await rpcGetObject(corpId);
    const nameBytes = fields["name"];
    const name = Array.isArray(nameBytes)
      ? new TextDecoder().decode(new Uint8Array(nameBytes as number[]))
      : String(nameBytes ?? "");
    return {
      corpId,
      name,
      founder: String(fields["founder"] ?? ""),
      memberCount: (fields["members"] as unknown[])?.length ?? 0,
      active: fields["active"] as boolean,
    };
  } catch { return null; }
}

/** Fetch Treasury state by shared object ID. */
export async function fetchTreasuryState(treasuryId: string): Promise<TreasuryState | null> {
  try {
    const fields = await rpcGetObject(treasuryId);
    const balanceMist = BigInt(
      (asRecord(fields["balance"])?.["value"] as string | number) ?? 0
    );
    const totalDeposited = BigInt(String(fields["total_deposited"] ?? 0));
    const totalWithdrawn = BigInt(String(fields["total_withdrawn"] ?? 0));
    return {
      objectId: treasuryId,
      corpId: fields["corp_id"] as string,
      balanceMist,
      totalDepositedMist: totalDeposited,
      totalWithdrawnMist: totalWithdrawn,
      balanceSui: Number(balanceMist) / 1e9,
    };
  } catch { return null; }
}

/** Fetch recent deposit/withdraw events for a treasury. */
export async function fetchTreasuryActivity(treasuryId: string): Promise<TreasuryActivity[]> {
  const activities: TreasuryActivity[] = [];
  for (const eventType of ["DepositRecord", "WithdrawRecord"] as const) {
    try {
      const res = await fetch(SUI_TESTNET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "suix_queryEvents",
          params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::treasury::${eventType}` }, null, 20, false],
        }),
      });
      const json = await res.json() as { result: { data: Array<{ parsedJson: Record<string, unknown>; timestampMs: number }> } };
      for (const e of json.result.data) {
        if (e.parsedJson["treasury_id"] !== treasuryId) continue;
        activities.push({
          kind: eventType === "DepositRecord" ? "deposit" : "withdraw",
          amount: (numish(e.parsedJson["amount"]) ?? 0) / 1e9,
          actor: (e.parsedJson["depositor"] ?? e.parsedJson["recipient"]) as string,
          newBalance: (numish(e.parsedJson["new_balance"]) ?? 0) / 1e9,
          timestampMs: e.timestampMs,
        });
      }
    } catch { /* best effort */ }
  }
  return activities.sort((a, b) => b.timestampMs - a.timestampMs);
}

/** All-in-one: found_corp + create_treasury + share all objects. */
export function buildInitializeCorpTransaction(corpName: string, senderAddress: string): Transaction {
  const tx = new Transaction();

  const registry = tx.moveCall({
    target: `${CRADLEOS_PKG}::registry::create_registry`,
  });

  const [corp, memberCap] = tx.moveCall({
    target: `${CRADLEOS_PKG}::corp::found_corp`,
    arguments: [
      registry,
      tx.pure.vector("u8", [...new TextEncoder().encode(corpName)]),
    ],
  });

  const treasury = tx.moveCall({
    target: `${CRADLEOS_PKG}::treasury::create_treasury`,
    arguments: [corp],
  });

  // Share Registry, Corp, Treasury
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    typeArguments: [REGISTRY_TYPE],
    arguments: [registry],
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    typeArguments: [CORP_TYPE],
    arguments: [corp],
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    typeArguments: [TREASURY_TYPE],
    arguments: [treasury],
  });

  // Keep MemberCap (director) in sender's wallet
  tx.transferObjects([memberCap], tx.pure.address(senderAddress));

  return tx;
}

/** Deposit SUI (any corp member). amountSui is human-readable SUI (not MIST). */
export function buildDepositTransaction(
  treasuryId: string,
  corpId: string,
  amountSui: number,
): Transaction {
  const tx = new Transaction();
  const amountMist = BigInt(Math.floor(amountSui * 1e9));
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::treasury::deposit`,
    arguments: [tx.object(treasuryId), tx.object(corpId), coin],
  });
  return tx;
}

/** Withdraw SUI (directors only). amountSui is human-readable SUI. */
export function buildWithdrawTransaction(
  treasuryId: string,
  corpId: string,
  memberCapId: string,
  amountSui: number,
  recipientAddress: string,
): Transaction {
  const tx = new Transaction();
  const amountMist = BigInt(Math.floor(amountSui * 1e9));
  const [coin] = tx.moveCall({
    target: `${CRADLEOS_PKG}::treasury::withdraw`,
    arguments: [
      tx.object(treasuryId),
      tx.object(corpId),
      tx.pure.u64(amountMist),
      tx.object(memberCapId),
    ],
  });
  tx.transferObjects([coin], tx.pure.address(recipientAddress));
  return tx;
}

/** Treasury ID cache — keyed by corpId in localStorage. */
export function getCachedTreasuryId(corpId: string): string | null {
  try { return localStorage.getItem(`cradleos:treasury:${corpId}`); } catch { return null; }
}
export function setCachedTreasuryId(corpId: string, treasuryId: string): void {
  try { localStorage.setItem(`cradleos:treasury:${corpId}`, treasuryId); } catch { /* */ }
}

// ─── Tribe Vault ──────────────────────────────────────────────────────────────

// TRIBE_VAULT_TYPE no longer needed after switching to create_vault entry fun

export type TribeVaultState = {
  objectId: string;
  tribeId: number;
  founder: string;
  coinName: string;
  coinSymbol: string;
  totalSupply: number;
  infraCredits: number;
  /** Full on-chain type string — used to detect stale-package vaults */
  _type: string;
  /** Inner UID of the balances Table — needed to query member balances as dynamic fields */
  balancesTableId: string;
  /** Inner UID of the registered_infra Table — needed to query registered structure IDs */
  registeredInfraTableId: string;
};

export type CoinIssuedEvent = {
  vaultId: string;
  recipient: string;
  amount: number;
  reason: string;
  newBalance: number;
  totalSupply: number;
  timestampMs: number;
};

/** Fetch TribeVault state by shared object ID. */
export async function fetchTribeVault(vaultId: string): Promise<TribeVaultState | null> {
  try {
    const fields = await rpcGetObject(vaultId);
    // Extract the balances Table's inner UID so we can query member balances as dynamic fields
    const balancesField = fields["balances"] as { fields?: { id?: { id?: string } } } | undefined;
    const balancesTableId = balancesField?.fields?.id?.id ?? "";
    const infraField = fields["registered_infra"] as { fields?: { id?: { id?: string } } } | undefined;
    const registeredInfraTableId = infraField?.fields?.id?.id ?? "";
    return {
      objectId: vaultId,
      tribeId: numish(fields["tribe_id"]) ?? 0,
      founder: String(fields["founder"] ?? ""),
      coinName: String(fields["coin_name"] ?? ""),
      coinSymbol: String(fields["coin_symbol"] ?? ""),
      totalSupply: numish(fields["total_supply"]) ?? 0,
      infraCredits: numish(fields["infra_credits"]) ?? 0,
      _type: String(fields["_type"] ?? ""),
      balancesTableId,
      registeredInfraTableId,
    };
  } catch { return null; }
}

/** Fetch the set of structure IDs already registered to a vault.
 *  Uses Sui GraphQL dynamic fields — one query, no pagination needed for
 *  typical tribe sizes (<200 structures). Falls back to JSON-RPC. */
export async function fetchRegisteredInfraIds(registeredInfraTableId: string): Promise<Set<string>> {
  if (!registeredInfraTableId) return new Set();
  try {
    const res = await fetch(SUI_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{
        object(address: "${registeredInfraTableId}") {
          dynamicFields(first: 200) {
            nodes { name { json } }
          }
        }
      }` }),
    });
    const data = await res.json() as { data?: { object?: { dynamicFields?: { nodes?: Array<{ name: { json: unknown } }> } } } };
    const nodes = data?.data?.object?.dynamicFields?.nodes ?? [];
    const ids = nodes.map(n => String(n.name.json ?? "").toLowerCase()).filter(Boolean);
    if (ids.length > 0) return new Set(ids);
  } catch { /* fall through to RPC */ }

  // Fallback: JSON-RPC
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFields",
        params: [registeredInfraTableId, null, 100],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ name: { value: string } }> } };
    const ids = (j.result?.data ?? []).map(e => String(e.name.value).toLowerCase());
    return new Set(ids);
  } catch { return new Set(); }
}

/** Fetch member balance from the vault's balances Table. */
export async function fetchMemberBalance(balancesTableId: string, memberAddress: string): Promise<number> {
  if (!balancesTableId) return 0;
  try {
    // Sui Table entries are dynamic fields on the TABLE's inner UID, not the vault object ID
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFieldObject",
        params: [balancesTableId, { type: "address", value: memberAddress }],
      }),
    });
    const json = await res.json() as { result?: { data?: { content?: { fields?: { value?: unknown } } } } };
    const value = json.result?.data?.content?.fields?.["value"];
    return numish(value) ?? 0;
  } catch { return 0; }
}

// ─── Turret Extension Authorization ──────────────────────────────────────────

/**
 * Fetch OwnerCap<Turret> objects for a wallet's character.
 * OwnerCaps are held by the Character object, not the wallet directly.
 * Returns [{ capId, turretId }] for each turret OwnerCap found.
 */
export async function fetchOwnerCapsForWallet(walletAddress: string): Promise<{ capId: string; turretId: string; characterId: string }[]> {
  const charInfo = await findCharacterForWallet(walletAddress);
  if (!charInfo) return [];
  // Check both world pkg versions for OwnerCaps
  const worldPkgs = Array.from(new Set([WORLD_PKG, WORLD_PKG_UTOPIA_V1]));
  const allCaps: { capId: string; turretId: string; characterId: string }[] = [];
  for (const wpkg of worldPkgs) {
    const ownerCapType = `${wpkg}::access::OwnerCap<${wpkg}::turret::Turret>`;
    const caps = await rpcGetOwnedObjects(charInfo.characterId, ownerCapType, 50);
    for (const { objectId: capId, fields } of caps) {
      const turretId = String(fields["authorized_object_id"] ?? "");
      if (turretId && !allCaps.some(c => c.turretId === turretId)) {
        allCaps.push({ capId, turretId, characterId: charInfo.characterId });
      }
    }
  }
  return allCaps;
}

/**
 * Build a single PTB that:
 * 1. Creates a TurretConfig shared object via turret_ext::create_config_entry
 * 2. Authorizes the turret_ext extension via turret::authorize_extension<TurretAuth>
 *
 * @param turretId   - Object ID of the Turret (shared)
 * @param ownerCapId - Object ID of the OwnerCap<Turret>
 * @param policyId   - Object ID of the TribeDefensePolicy to link the config to
 * @param preset     - Targeting preset (default 0 = AUTOCANNON)
 */
export function buildAuthorizeExtensionTx(
  turretId: string,
  ownerCapId: string,
  characterId: string,
  policyId: string,
  preset: number = 0,
): Transaction {
  const tx = new Transaction();

  // Step 1: create TurretConfig shared object (turret_id: ID, policy_id: ID, preset: u8)
  tx.moveCall({
    target: `${CRADLEOS_PKG}::turret_ext::create_config_entry`,
    arguments: [
      tx.pure.address(turretId),
      tx.pure.address(policyId),
      tx.pure.u8(preset),
    ],
  });

  // Step 2: Borrow OwnerCap from the Character (OwnerCap is owned by Character, not wallet)
  // borrow_owner_cap<T: key>(character: &mut Character, owner_cap_ticket: Receiving<OwnerCap<T>>, ctx)
  // Returns (OwnerCap<T>, ReturnOwnerCapReceipt)
  const turretType = `${WORLD_PKG}::turret::Turret`;
  const [borrowedCap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [turretType],
    arguments: [
      tx.object(characterId),
      tx.object(ownerCapId),
    ],
  });

  // Step 3: Authorize the CradleOS turret extension on the world contract
  // authorize_extension<Auth: drop>(turret: &mut Turret, owner_cap: &OwnerCap<Turret>)
  tx.moveCall({
    target: `${WORLD_PKG}::turret::authorize_extension`,
    typeArguments: [`${CRADLEOS_PKG}::turret_ext::TurretAuth`],
    arguments: [
      tx.object(turretId),
      borrowedCap,
    ],
  });

  // Step 4: Return the OwnerCap back to the Character
  // return_owner_cap<T: key>(character: &Character, owner_cap: OwnerCap<T>, receipt: ReturnOwnerCapReceipt)
  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [turretType],
    arguments: [
      tx.object(characterId),
      borrowedCap,
      receipt,
    ],
  });

  return tx;
}

/** Fetch the caller's EVE coin balance and best coin object ID for transactions. */
export async function fetchEveBalance(address: string): Promise<{ balance: number; coinId: string | null; allCoinIds: string[] }> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getBalance",
        params: [address, EVE_COIN_TYPE],
      }),
    });
    const j = await res.json() as { result?: { totalBalance?: string } };
    const balance = numish(j.result?.totalBalance) ?? 0;
    // Fetch ALL coin objects — wallet may have multiple EVE coins from splits/merges
    const coinsRes = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getCoins",
        params: [address, EVE_COIN_TYPE, null, 50],
      }),
    });
    const coinsJ = await coinsRes.json() as { result?: { data?: Array<{ coinObjectId: string; balance: string }> } };
    const coins = coinsJ.result?.data ?? [];
    // Sort by balance descending — pick the largest as primary
    coins.sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));
    const allCoinIds = coins.map(c => c.coinObjectId);
    const coinId = allCoinIds[0] ?? null;
    return { balance, coinId, allCoinIds };
  } catch { return { balance: 0, coinId: null, allCoinIds: [] }; }
}

/** @deprecated Use fetchEveBalance instead. */
export const fetchCrdlBalance = fetchEveBalance;

/** Fetch recent CoinIssued events for a vault. */
export async function fetchCoinIssuedEvents(vaultId: string): Promise<CoinIssuedEvent[]> {
  const events: CoinIssuedEvent[] = [];
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinIssued` }, null, 50, false],
      }),
    });
    const json = await res.json() as { result: { data: Array<{ parsedJson: Record<string, unknown>; timestampMs: number }> } };
    for (const e of json.result.data) {
      if (e.parsedJson["vault_id"] !== vaultId) continue;
      events.push({
        vaultId,
        recipient: e.parsedJson["recipient"] as string,
        amount: (numish(e.parsedJson["amount"]) ?? 0),
        reason: String(e.parsedJson["reason"] ?? ""),
        newBalance: numish(e.parsedJson["new_balance"]) ?? 0,
        totalSupply: numish(e.parsedJson["total_supply"]) ?? 0,
        timestampMs: e.timestampMs,
      });
    }
  } catch { /* best effort */ }
  return events.sort((a, b) => b.timestampMs - a.timestampMs);
}

/** Launch tribe vault: creates TribeVault + shares it in one entry call.
 *  Uses `tribe_vault::create_vault` (entry fun) because TribeVault only has
 *  `key` (not `store`), making `public_share_object` unavailable from a PTB.
 */
export function buildLaunchCoinTransaction(
  tribeId: number,
  coinName: string,
  coinSymbol: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::create_vault`,
    arguments: [
      tx.pure.u32(tribeId),
      tx.pure.vector("u8", [...new TextEncoder().encode(coinName)]),
      tx.pure.vector("u8", [...new TextEncoder().encode(coinSymbol)]),
    ],
  });
  return tx;
}

/** Founder issues coin to a member. amount is raw units (no decimals). */
export function buildIssueCoinTransaction(
  vaultId: string,
  recipientAddress: string,
  amount: number,
  reason: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::issue_coin_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.address(recipientAddress),
      tx.pure.u64(BigInt(Math.floor(amount))),
      tx.pure.vector("u8", [...new TextEncoder().encode(reason)]),
    ],
  });
  return tx;
}

/** Register a structure to back the vault's supply cap.
 *  energyCost: raw energy units from EnergyConfig (e.g. 950 for Gate).
 *  Credits added = energyCost × 1000. */
export function buildRegisterStructureTransaction(
  vaultId: string,
  structureObjectId: string,
  energyCost: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::register_structure_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.address(structureObjectId),
      tx.pure.u64(BigInt(Math.floor(energyCost))),
    ],
  });
  return tx;
}

/** Deregister a structure (destroyed / removed from service). */
export function buildDeregisterStructureTransaction(
  vaultId: string,
  structureObjectId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::deregister_structure_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.address(structureObjectId),
    ],
  });
  return tx;
}

/** Member transfers coins to another address. */
export function buildTransferCoinsTransaction(
  vaultId: string,
  toAddress: string,
  amount: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::transfer_coins_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.address(toAddress),
      tx.pure.u64(BigInt(Math.floor(amount))),
    ],
  });
  return tx;
}

/** Founder burns coins from a member's balance (decay / governance). */
export function buildBurnCoinTransaction(
  vaultId: string,
  memberAddress: string,
  amount: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::burn_coin_entry`,
    arguments: [
      tx.object(vaultId),
      tx.pure.address(memberAddress),
      tx.pure.u64(BigInt(Math.floor(amount))),
    ],
  });
  return tx;
}

/** Cache vault ID by tribeId. */
// ── Cache-buster: clear stale data when package or cache version changes ──────
// Bump CACHE_VERSION any time cached data shape changes or needs forced invalidation.
const CACHE_VERSION = 6;
const CACHE_PKG_KEY = "cradleos:pkg";
const CACHE_VER_KEY = "cradleos:cache-version";
try {
  const cachedPkg = localStorage.getItem(CACHE_PKG_KEY);
  const cachedVer = Number(localStorage.getItem(CACHE_VER_KEY) ?? "0");
  if ((cachedPkg && cachedPkg !== CRADLEOS_PKG) || cachedVer < CACHE_VERSION) {
    // Wipe all cradleos cached IDs + delegation state
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("cradleos:") || k.startsWith("delegation:"))) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  }
  localStorage.setItem(CACHE_PKG_KEY, CRADLEOS_PKG);
  localStorage.setItem(CACHE_VER_KEY, String(CACHE_VERSION));
} catch { /* */ }

export function getCachedVaultId(tribeId: number): string | null {
  try { return localStorage.getItem(`cradleos:vault:${tribeId}`); } catch { return null; }
}
export function setCachedVaultId(tribeId: number, vaultId: string): void {
  try { localStorage.setItem(`cradleos:vault:${tribeId}`, vaultId); } catch { /* */ }
}

// ── TribeDex types ────────────────────────────────────────────────────────────

export type DexState = {
  objectId: string;
  vaultId: string;
  nextOrderId: number;
  lastPrice: number;
  totalVolumeRaw: number;
  totalVolumePayment: number;
  /** Inner UID of sell_orders Table — needed to query orders as dynamic fields */
  sellOrdersTableId: string;
};

export type SellOrder = {
  orderId: number;
  seller: string;
  rawAmount: number;
  rawRemaining: number;
  pricePerUnit: number;
};

export type OrderFilledEvent = {
  dexId: string;
  orderId: number;
  buyer: string;
  seller: string;
  fillAmount: number;
  pricePerUnit: number;
  paymentPaid: number;
  rawRemaining: number;
  timestampMs: number;
};

// ── TribeDex fetch helpers ────────────────────────────────────────────────────

/** Fetch TribeDex state by object ID. */
export async function fetchDexState(dexId: string): Promise<DexState | null> {
  try {
    const fields = await rpcGetObject(dexId);
    const ordersField = fields["sell_orders"] as { fields?: { id?: { id?: string } } } | undefined;
    const sellOrdersTableId = ordersField?.fields?.id?.id ?? "";
    return {
      objectId: dexId,
      vaultId: String(fields["vault_id"] ?? ""),
      nextOrderId: numish(fields["next_order_id"]) ?? 0,
      lastPrice: numish(fields["last_price"]) ?? numish(fields["last_price_crdl"]) ?? 0,
      totalVolumeRaw: numish(fields["total_volume_raw"]) ?? 0,
      totalVolumePayment: numish(fields["total_volume_payment"]) ?? numish(fields["total_volume_crdl"]) ?? 0,
      sellOrdersTableId,
    };
  } catch { return null; }
}

/** Fetch open sell orders from a TribeDex's sell_orders Table dynamic fields. */
export async function fetchOpenOrders(sellOrdersTableId: string): Promise<SellOrder[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFields",
        params: [sellOrdersTableId, null, 50],
      }),
    });
    const j = await res.json() as {
      result: { data: Array<{ name: { value: string | number }; objectId: string }> };
    };
    if (!j.result?.data?.length) return [];

    const orders = await Promise.all(
      j.result.data.map(async (entry) => {
        const objRes = await fetch(SUI_TESTNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "sui_getObject",
            params: [entry.objectId, { showContent: true }],
          }),
        });
        const obj = await objRes.json() as {
          result: { data: { content: { fields: Record<string, unknown> } } };
        };
        const f = obj.result?.data?.content?.fields ?? {};
        // Dynamic field stores struct value as {type, fields:{...}} — unwrap one level
        const valueWrapper = f["value"] as { fields?: Record<string, unknown> } | Record<string, unknown> | undefined;
        const inner = (valueWrapper as { fields?: Record<string, unknown> })?.fields ?? (valueWrapper as Record<string, unknown>) ?? f;
        return {
          orderId: numish(entry.name.value) ?? 0,
          seller: String(inner["seller"] ?? ""),
          rawAmount: numish(inner["raw_amount"]) ?? 0,
          rawRemaining: numish(inner["raw_remaining"]) ?? 0,
          pricePerUnit: numish(inner["price_per_unit"]) ?? numish(inner["price_crdl_per_raw"]) ?? 0,
        } as SellOrder;
      })
    );
    return orders.filter(o => o.rawRemaining > 0);
  } catch { return []; }
}

/** Fetch OrderFilled events for a dex. */
export async function fetchOrderFilledEvents(dexId: string): Promise<OrderFilledEvent[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_dex::OrderFilled` }, null, 50, false],
      }),
    });
    const j = await res.json() as {
      result: {
        data: Array<{
          timestampMs: string;
          parsedJson: Record<string, unknown>;
        }>;
      };
    };
    return (j.result?.data ?? [])
      .filter(e => String(e.parsedJson["dex_id"]) === dexId)
      .map(e => ({
        dexId: String(e.parsedJson["dex_id"] ?? ""),
        orderId: numish(e.parsedJson["order_id"]) ?? 0,
        buyer: String(e.parsedJson["buyer"] ?? ""),
        seller: String(e.parsedJson["seller"] ?? ""),
        fillAmount: numish(e.parsedJson["fill_amount"]) ?? 0,
        pricePerUnit: numish(e.parsedJson["price_per_unit"]) ?? numish(e.parsedJson["price_crdl_per_raw"]) ?? 0,
        paymentPaid: numish(e.parsedJson["payment_paid"]) ?? numish(e.parsedJson["crdl_paid"]) ?? 0,
        rawRemaining: numish(e.parsedJson["raw_remaining"]) ?? 0,
        timestampMs: parseInt(String(e.timestampMs ?? "0"), 10),
      }));
  } catch { return []; }
}

// ── TribeDex transaction builders ─────────────────────────────────────────────

/** Create and share a TribeDex for the given vault. */
export function buildCreateDexTransaction(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_dex::create_dex_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(vaultId)],
  });
  return tx;
}

/** Post a sell order: escrows `amount` RAW from caller's vault balance at `priceMist` per unit. */
export function buildPostSellOrderTransaction(
  dexId: string,
  vaultId: string,
  amount: number,
  priceCrdlPerRaw: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_dex::post_sell_order_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(dexId),
      tx.object(vaultId),
      tx.pure.u64(BigInt(Math.floor(amount))),
      tx.pure.u64(BigInt(Math.floor(priceCrdlPerRaw))),
    ],
  });
  return tx;
}

/** Fill a sell order with EVE. Buyer provides a Coin<EVE_COIN> from their wallet.
 *  fillAmount: number of tribe coin units to buy.
 *  The payment coin is split by the contract; change is returned. */
export function buildFillSellOrderTransaction(
  dexId: string,
  vaultId: string,
  orderId: number,
  fillAmount: number,
  priceCrdlPerRaw: number,
  paymentCoinId: string,   // object ID of buyer's Coin<EVE_COIN>
): Transaction {
  const tx = new Transaction();
  const totalCost = BigInt(Math.floor(fillAmount)) * BigInt(Math.floor(priceCrdlPerRaw));
  // Split exact EVE payment from the buyer's coin object
  const [payment] = tx.splitCoins(tx.object(paymentCoinId), [tx.pure.u64(totalCost)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_dex::fill_sell_order_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(dexId),
      tx.object(vaultId),
      tx.pure.u64(BigInt(orderId)),
      payment,
      tx.pure.u64(BigInt(Math.floor(fillAmount))),
    ],
  });
  return tx;
}

/** Cancel a sell order and refund remaining RAW to seller's vault balance. */
export function buildCancelOrderTransaction(
  dexId: string,
  vaultId: string,
  orderId: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_dex::cancel_sell_order_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(dexId),
      tx.object(vaultId),
      tx.pure.u64(BigInt(orderId)),
    ],
  });
  return tx;
}

/** Cache DEX ID by vaultId. */
export function getCachedDexId(vaultId: string): string | null {
  try { return localStorage.getItem(`cradleos:dex:${vaultId}`); } catch { return null; }
}
export function setCachedDexId(vaultId: string, dexId: string): void {
  try { localStorage.setItem(`cradleos:dex:${vaultId}`, dexId); } catch { /* */ }
}

/** Discover a TribeDex ID for a vault by querying DexCreated events on-chain. */
export async function discoverDexIdForVault(vaultId: string): Promise<string | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_dex::DexCreated` }, null, 50, false],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson?: { dex_id?: string; vault_id?: string } }> } };
    const mine = (j.result?.data ?? []).find(e => e.parsedJson?.vault_id === vaultId);
    return mine?.parsedJson?.dex_id ?? null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER REGISTRY — proof-based tribe vault ownership (v6)
// ─────────────────────────────────────────────────────────────────────────────

export const CHARACTER_REGISTRY_ID = "0x2e988f290955c6bf8ccf00ed3b847494016eb907c36d81d3774fcc8cead82ef5";

export type TribeClaim = {
  claimer: string;
  characterId: string;
  claimEpoch: number;
  vaultCreated: boolean;
};

/** Fetch the registry object and return claim for a given tribe_id. */
export async function fetchTribeClaim(tribeId: number): Promise<TribeClaim | null> {
  try {
    await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFields",
        params: [
          // Claims table inner UID — need to fetch registry first to get it
          CHARACTER_REGISTRY_ID, null, 200,
        ],
      }),
    });
    // The claims table inner UID must be extracted from the registry object
    const reg = await rpcGetObject(CHARACTER_REGISTRY_ID);
    const claimsField = reg["claims"] as { fields?: { id?: { id?: string } } } | undefined;
    const claimsTableId = claimsField?.fields?.id?.id ?? "";
    if (!claimsTableId) return null;

    // Look for dynamic field with key == tribeId
    const dfRes = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getDynamicFieldObject",
        params: [claimsTableId, { type: "u32", value: tribeId }],
      }),
    });
    const dfJson = await dfRes.json() as { result?: { data?: { content?: { fields?: Record<string, unknown> } } } };
    const f = dfJson.result?.data?.content?.fields ?? {};
    const val = (f["value"] as { fields?: Record<string, unknown> })?.fields ?? {};
    if (!val["claimer"]) return null;
    return {
      claimer: String(val["claimer"] ?? ""),
      characterId: String(val["character_id"] ?? ""),
      claimEpoch: numish(val["claim_epoch"]) ?? 0,
      vaultCreated: Boolean(val["vault_created"]),
    };
  } catch { return null; }
}

/** Build register_claim transaction. */
export function buildRegisterClaimTransaction(
  tribeId: number,
  characterId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::character_registry::register_claim`,
    arguments: [
      tx.object(CHARACTER_REGISTRY_ID),
      tx.pure.u32(tribeId >>> 0),
      tx.pure.address(characterId),
    ],
  });
  return tx;
}

/** Build create_vault_with_registry transaction (replaces bare create_vault for v6). */
export function buildCreateVaultWithRegistryTransaction(
  tribeId: number,
  coinName: string,
  coinSymbol: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::character_registry::create_vault_with_registry`,
    arguments: [
      tx.object(CHARACTER_REGISTRY_ID),
      tx.pure.u32(tribeId >>> 0),
      tx.pure.vector("u8", [...new TextEncoder().encode(coinName)]),
      tx.pure.vector("u8", [...new TextEncoder().encode(coinSymbol)]),
    ],
  });
  return tx;
}

/** Build issue_attestation transaction (attestor only). */
export function buildIssueAttestationTransaction(
  beneficiary: string,
  tribeId: number,
  characterId: string,
  joinEpoch: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::character_registry::issue_attestation`,
    arguments: [
      tx.object(CHARACTER_REGISTRY_ID),
      tx.pure.address(beneficiary),
      tx.pure.u32(tribeId >>> 0),
      tx.pure.address(characterId),
      tx.pure.u64(BigInt(joinEpoch)),
    ],
  });
  return tx;
}

/** Build challenge_and_take_vault transaction. */
export function buildChallengeAndTakeVaultTransaction(
  vaultId: string,
  attestationId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::character_registry::challenge_and_take_vault`,
    arguments: [
      tx.object(CHARACTER_REGISTRY_ID),
      tx.object(vaultId),
      tx.object(attestationId),
    ],
  });
  return tx;
}

/** Build invalidate_claim transaction (attestor only). */
export function buildInvalidateClaimTransaction(tribeId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::character_registry::invalidate_claim`,
    arguments: [
      tx.object(CHARACTER_REGISTRY_ID),
      tx.pure.u32(tribeId >>> 0),
    ],
  });
  return tx;
}

/** Build set_attestor transaction (admin only). */
export function buildSetAttestorTransaction(newAttestor: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::character_registry::set_attestor`,
    arguments: [
      tx.object(CHARACTER_REGISTRY_ID),
      tx.pure.address(newAttestor),
    ],
  });
  return tx;
}

/** Fetch owned EpochAttestation objects for a wallet. */
export async function fetchAttestationsForWallet(walletAddress: string): Promise<Array<{
  objectId: string; tribeId: number; joinEpoch: number; characterId: string;
}>> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getOwnedObjects",
        params: [walletAddress, {
          filter: { StructType: `${CRADLEOS_ORIGINAL}::character_registry::EpochAttestation` },
          options: { showContent: true },
        }, null, 20],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ data?: { objectId?: string; content?: { fields?: Record<string, unknown> } } }> } };
    return (j.result?.data ?? []).map(item => {
      const f = item.data?.content?.fields ?? {};
      return {
        objectId: item.data?.objectId ?? "",
        tribeId: numish(f["tribe_id"]) ?? 0,
        joinEpoch: numish(f["join_epoch"]) ?? 0,
        characterId: String(f["character_id"] ?? ""),
      };
    }).filter(a => a.objectId);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSE POLICY — security levels + aggression mode (v7)
// ─────────────────────────────────────────────────────────────────────────────

export const SEC_GREEN  = 1;
export const SEC_YELLOW = 2;
export const SEC_RED    = 3;

export type SecurityConfig = {
  level: number;        // 1=GREEN 2=YELLOW 3=RED
  aggressionMode: boolean;
};

/** Read security_level and aggression_mode from a TribeDefensePolicy object. */
export async function fetchSecurityConfig(policyId: string): Promise<SecurityConfig> {
  try {
    const [levelDf, aggrDf] = await Promise.all([
      fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "suix_getDynamicFieldObject",
          params: [policyId, {
            type: `${CRADLEOS_ORIGINAL}::defense_policy::SecurityLevelKey`,
            value: { dummy_field: false },
          }],
        }),
      }).then(r => r.json()) as Promise<{ result?: { data?: { content?: { fields?: { value?: unknown } } } } }>,
      fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "suix_getDynamicFieldObject",
          params: [policyId, {
            type: `${CRADLEOS_ORIGINAL}::defense_policy::AggressionModeKey`,
            value: { dummy_field: false },
          }],
        }),
      }).then(r => r.json()) as Promise<{ result?: { data?: { content?: { fields?: { value?: unknown } } } } }>,
    ]);
    const level = numish(levelDf.result?.data?.content?.fields?.value) ?? SEC_GREEN;
    const aggressionMode = Boolean(aggrDf.result?.data?.content?.fields?.value ?? false);
    return { level, aggressionMode };
  } catch { return { level: SEC_GREEN, aggressionMode: false }; }
}

/** Build set_security_level_entry transaction. */
export async function buildSetSecurityLevelTransaction(
  policyId: string,
  vaultId: string,
  level: number,
): Promise<Transaction> {
  const [pISV, vISV] = await Promise.all([fetchInitialSharedVersion(policyId), fetchInitialSharedVersion(vaultId)]);
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_security_level_entry`,
    arguments: [
      pISV ? sharedRef(tx, policyId, pISV) : tx.object(policyId),
      vISV ? sharedRef(tx, vaultId, vISV, false) : tx.object(vaultId),
      tx.pure.u8(level),
    ],
  });
  return tx;
}

/** Build set_aggression_mode_entry transaction. */
export async function buildSetAggressionModeTransaction(
  policyId: string,
  vaultId: string,
  enabled: boolean,
): Promise<Transaction> {
  const [pISV, vISV] = await Promise.all([fetchInitialSharedVersion(policyId), fetchInitialSharedVersion(vaultId)]);
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_aggression_mode_entry`,
    arguments: [
      pISV ? sharedRef(tx, policyId, pISV) : tx.object(policyId),
      vISV ? sharedRef(tx, vaultId, vISV, false) : tx.object(vaultId),
      tx.pure.bool(enabled),
    ],
  });
  return tx;
}

// ─────────────────────────────────────────────────────────────────────────────
// VAULT DISCOVERY BY TRIBE ID (for Registry cross-check)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discover vault ID for a tribe by scanning CoinLaunched events.
 * Used by RegistryPanel to cross-check vault existence independently of
 * the TribeClaim.vault_created flag (which is only set via create_vault_with_registry).
 */
export async function discoverVaultIdForTribe(tribeId: number): Promise<string | null> {
  // Check cache first — fast path. New cache writes only contain "real"
  // (named) vaults; legacy cache writes from before the bug fix may still
  // contain an empty/aborted-launch vault. Validate the cache by checking
  // the vault's coin_name; clear and re-discover if it's empty.
  const cached = getCachedVaultId(tribeId);
  if (cached) {
    try {
      const fields = await rpcGetObject(cached);
      const coinName = String(fields["coin_name"] ?? "");
      if (coinName.length > 0) return cached;
      // Cached vault has no coin_name — stale. Clear and fall through to
      // re-discover the canonical (named) vault for this tribe.
      try { localStorage.removeItem(`cradleos:vault:${tribeId}`); } catch { /* */ }
    } catch {
      // If RPC fails on the cache lookup, fall back to the cached value
      // rather than blocking the user entirely.
      return cached;
    }
  }
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinLaunched` },
          null, 50, true,
        ],
      }),
    });
    const json = await res.json() as {
      result?: { data?: Array<{ parsedJson?: { vault_id?: string; tribe_id?: string | number; coin_name?: string } }> }
    };
    const tribeVaults = (json.result?.data ?? []).filter(
      e => Number(e.parsedJson?.tribe_id) === tribeId
    );
    // Prefer vault with non-empty coin name (the "real" launch, not aborted
    // empty test launches). Among multiple named entries, the first (newest
    // by descending sort) wins.
    const named = tribeVaults.find(
      e => String((e.parsedJson as Record<string, unknown>)?.coin_name ?? "").length > 0,
    );
    const match = named ?? tribeVaults[0];
    const vaultId = match?.parsedJson?.vault_id ?? null;
    // Only cache when the chosen vault is named — we don't want an empty
    // test launch poisoning the cache and shadowing a real vault that
    // gets created later.
    if (vaultId && named) setCachedVaultId(tribeId, vaultId);
    return vaultId;
  } catch { return null; }
}

/** Fetch all registered tribes from CoinLaunched events — deduplicated by tribeId, latest vault wins. */
export type RegisteredTribe = { tribeId: number; coinSymbol: string; coinName: string; vaultId: string };

export async function fetchAllRegisteredTribes(): Promise<RegisteredTribe[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinLaunched` },
          null, 200, true, // descending=true → newest first
        ],
      }),
    });
    const json = await res.json() as {
      result?: { data?: Array<{ parsedJson?: { vault_id?: string; tribe_id?: string | number; coin_symbol?: string; coin_name?: string } }> }
    };
    // Group all CoinLaunched events by tribeId, then pick the canonical
    // vault per tribe. A tribe can have multiple CoinLaunched events (e.g.
    // an aborted/empty test launch followed by a real one). Prefer the
    // event with a non-empty coin_name; among those, prefer the newest.
    // If none have a non-empty name, fall back to the newest empty one.
    type RawEvt = { parsedJson?: { vault_id?: string; tribe_id?: string | number; coin_symbol?: string; coin_name?: string } };
    const byTribe = new Map<number, RawEvt[]>();
    for (const e of (json.result?.data ?? []) as RawEvt[]) {
      const tribeId = Number(e.parsedJson?.tribe_id ?? 0);
      if (!tribeId) continue;
      if (!byTribe.has(tribeId)) byTribe.set(tribeId, []);
      byTribe.get(tribeId)!.push(e);
    }
    const tribes: RegisteredTribe[] = [];
    for (const [tribeId, events] of byTribe) {
      // Events arrive in descending timestamp order (newest first). Find
      // the first one with a non-empty coin_name, falling back to the
      // newest event when all are empty.
      const named = events.find(e => String(e.parsedJson?.coin_name ?? "").length > 0);
      const chosen = named ?? events[0];
      const vaultId = String(chosen.parsedJson?.vault_id ?? "");
      // Only cache when the chosen vault is named. Prevents an empty test
      // launch from poisoning the cache and shadowing a real vault.
      if (vaultId && named) setCachedVaultId(tribeId, vaultId);
      tribes.push({
        tribeId,
        coinSymbol: String(chosen.parsedJson?.coin_symbol ?? "?"),
        coinName:   String(chosen.parsedJson?.coin_name   ?? ""),
        vaultId,
      });
    }
    // Server-membership gate: the CradleOS Move package is shared across
    // Stillness and Utopia, but tribe IDs use independent ID spaces per
    // server. Drop tribes whose tribeId is not registered on the active
    // server's World API. Memoized so this only costs one round-trip per
    // tribe per session.
    // Pass each vault's coin_symbol + coin_name so isTribeOnActiveServer
    // can match against the World API's tribe nameShort/name. Without this,
    // tribes whose numeric IDs collide between Stillness and Utopia would
    // leak through (existence on the active server is necessary but not
    // sufficient).
    const onServerFlags = await Promise.all(
      tribes.map(t => isTribeOnActiveServer(t.tribeId, t.coinSymbol, t.coinName)),
    );
    const filtered = tribes.filter((_, i) => onServerFlags[i]);
    return filtered.sort((a, b) => a.tribeId - b.tribeId);
  } catch { return []; }
}

// ── Tribe Roles ───────────────────────────────────────────────────────────────

export const TRIBE_ROLE_NAMES: Record<number, string> = {
  0: "Admin",
  1: "Officer",
  2: "Treasurer",
  3: "Recruiter",
};

export type TribeRoleAssignment = {
  address: string;
  roles: number[]; // list of role numbers
};

export type TribeRolesState = {
  objectId: string;
  vaultId: string;
  tribeId: number;
  assignments: TribeRoleAssignment[];
};

/** Fetch TribeRoles object ID for a vault from RoleGranted events. */
export async function fetchTribeRolesObjectId(vaultId: string): Promise<string | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_roles::TribeRolesCreated` },
          null, 50, false,
        ],
      }),
    });
    const json = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
    const match = (json.result?.data ?? []).find(e => String(e.parsedJson?.vault_id) === vaultId);
    return match ? String(match.parsedJson?.roles_id ?? "") : null;
  } catch { return null; }
}

/** Fetch all role assignments from RoleGranted/RoleRevoked events for a vault. */
export async function fetchTribeRoles(vaultId: string): Promise<TribeRolesState | null> {
  const rolesId = await fetchTribeRolesObjectId(vaultId);
  if (!rolesId) return null;
  try {
    // Build role map from events
    const [grantRes, revokeRes] = await Promise.all([
      fetch(SUI_TESTNET_RPC, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
          params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_roles::RoleGranted` }, null, 200, false] }) }).then(r => r.json()),
      fetch(SUI_TESTNET_RPC, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
          params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_roles::RoleRevoked` }, null, 200, false] }) }).then(r => r.json()),
    ]);
    const grants = (grantRes?.result?.data ?? []) as Array<{ parsedJson?: Record<string, unknown> }>;
    const revokes = (revokeRes?.result?.data ?? []) as Array<{ parsedJson?: Record<string, unknown> }>;
    // Build map: address → Set<role>
    const roleMap = new Map<string, Set<number>>();
    for (const e of grants.filter(e => String(e.parsedJson?.vault_id) === vaultId)) {
      const addr = String(e.parsedJson?.grantee ?? "");
      const role = Number(e.parsedJson?.role ?? -1);
      if (!addr || role < 0) continue;
      if (!roleMap.has(addr)) roleMap.set(addr, new Set());
      roleMap.get(addr)!.add(role);
    }
    for (const e of revokes.filter(e => String(e.parsedJson?.vault_id) === vaultId)) {
      const addr = String(e.parsedJson?.revokee ?? "");
      const role = Number(e.parsedJson?.role ?? -1);
      roleMap.get(addr)?.delete(role);
    }
    const assignments: TribeRoleAssignment[] = [];
    for (const [address, roles] of roleMap.entries()) {
      if (roles.size > 0) assignments.push({ address, roles: [...roles].sort() });
    }
    return { objectId: rolesId, vaultId, tribeId: 0, assignments };
  } catch { return null; }
}

/** Build create_roles transaction. */
export function buildCreateRolesTx(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${TRIBE_ROLES_PKG}::tribe_roles::create_roles`,
    arguments: [tx.object(vaultId)],
  });
  return tx;
}

/** Build grant_role transaction. */
export function buildGrantRoleTx(rolesId: string, vaultId: string, grantee: string, role: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${TRIBE_ROLES_PKG}::tribe_roles::grant_role`,
    arguments: [tx.object(rolesId), tx.object(vaultId), tx.pure.address(grantee), tx.pure.u8(role)],
  });
  return tx;
}

/** Build revoke_role transaction. */
export function buildRevokeRoleTx(rolesId: string, vaultId: string, revokee: string, role: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${TRIBE_ROLES_PKG}::tribe_roles::revoke_role`,
    arguments: [tx.object(rolesId), tx.object(vaultId), tx.pure.address(revokee), tx.pure.u8(role)],
  });
  return tx;
}

// ── Player-level policy relations ─────────────────────────────────────────────

export type PlayerRelation = { player: string; value: number }; // 0=hostile 1=friendly

/** Build set_player_relation transaction. */
export function buildSetPlayerRelationTx(
  policyId: string, vaultId: string, player: string, value: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_player_relation_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.address(player), tx.pure.u8(value)],
  });
  return tx;
}

/** Build remove_player_relation transaction. */
export function buildRemovePlayerRelationTx(
  policyId: string, vaultId: string, player: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::remove_player_relation_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.address(player)],
  });
  return tx;
}

/** Fetch per-player relations from PlayerRelationSet events. */
// Sui indexes events under the package id where the emitting struct was
// FIRST DEFINED, not under the latest published-at. CradleOS has been
// upgraded many times and several event structs were introduced in mid-life
// upgrades (HostileCharacterSet @ v5, FriendlyCharacterSet @ v13, etc.).
// Querying only under CRADLEOS_ORIGINAL silently misses every event from
// upgrade-introduced structs. The full list of defining packages is in
// constants.ts (CRADLEOS_EVENT_PKGS) so it has a single canonical home.

type RawEvent = { parsedJson?: Record<string, unknown>; timestampMs?: string; id?: { txDigest?: string; eventSeq?: string } };

/**
 * Query a defense_policy/turret_ext/etc event type under every CradleOS
 * package version we know about and merge results. Returns events newest-first
 * (by timestampMs descending) so the caller's "first match wins" loops still
 * resolve to the latest state.
 */
async function fetchEventAcrossPackages(
  module: string,
  event: string,
  limit = 200,
): Promise<RawEvent[]> {
  // Dedup the package list — some entries may alias each other (CRADLEOS_PKG
  // could equal CRADLEOS_ORIGINAL early in the lifecycle), and identical
  // queries waste an RPC round trip.
  const uniquePkgs = Array.from(new Set(CRADLEOS_EVENT_PKGS));
  const queries = uniquePkgs.map(pkg =>
    fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
        params: [{ MoveEventType: `${pkg}::${module}::${event}` }, null, limit, true],
      }),
    }).then(r => r.json()).catch(() => null),
  );
  const responses = await Promise.all(queries);
  const all: RawEvent[] = [];
  const seen = new Set<string>();
  for (const j of responses) {
    const data = (j as { result?: { data?: RawEvent[] } } | null)?.result?.data ?? [];
    for (const e of data) {
      // Dedup by (txDigest, eventSeq) in case the same event somehow surfaces
      // under two type queries (defensive; shouldn't happen in practice).
      const key = `${e.id?.txDigest ?? ""}#${e.id?.eventSeq ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(e);
    }
  }
  // Newest first.
  all.sort((a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0));
  return all;
}

export async function fetchPlayerRelations(vaultId: string): Promise<PlayerRelation[]> {
  try {
    const [setEvents, rmEvents] = await Promise.all([
      fetchEventAcrossPackages("defense_policy", "PlayerRelationSet"),
      fetchEventAcrossPackages("defense_policy", "PlayerRelationRemoved"),
    ]);
    // Newest event per (player) wins.
    const map = new Map<string, number>();
    for (const e of setEvents) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const player = String(e.parsedJson?.player ?? "");
      if (!map.has(player)) map.set(player, Number(e.parsedJson?.value ?? 0));
    }
    // Suppress entries that have a NEWER remove event than their last set event.
    // (Walking timestamp-ordered events would be cleaner, but the current
    // map-then-suppress matches prior behavior with the new event sources.)
    const removed = new Set<string>();
    for (const e of rmEvents) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      removed.add(String(e.parsedJson?.player ?? ""));
    }
    return [...map.entries()]
      .filter(([p]) => !removed.has(p))
      .map(([player, value]) => ({ player, value }));
  } catch { return []; }
}

// ── Hostile Characters (turret same-tribe override) ───────────────────────────

export type HostileCharacter = { characterId: number; hostile: boolean };

/** Build set_hostile_character_entry transaction. */
export function buildSetHostileCharacterTx(
  policyId: string, vaultId: string, characterId: number, hostile: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_hostile_character_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.u32(characterId), tx.pure.bool(hostile)],
  });
  return tx;
}

/** Build batch set_hostile_characters_batch_entry transaction. */
export function buildSetHostileCharactersBatchTx(
  policyId: string, vaultId: string, characterIds: number[], hostileFlags: boolean[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_hostile_characters_batch_entry`,
    arguments: [
      tx.object(policyId), tx.object(vaultId),
      tx.pure.vector("u32", characterIds),
      tx.pure.vector("bool", hostileFlags),
    ],
  });
  return tx;
}

/** Fetch hostile characters from HostileCharacterSet events.
 *  HostileCharacterSet was introduced in a mid-life upgrade and may live under
 *  any of the historical package ids — we query all and merge.
 */
export async function fetchHostileCharacters(vaultId: string): Promise<HostileCharacter[]> {
  try {
    const events = await fetchEventAcrossPackages("defense_policy", "HostileCharacterSet");
    // Most recent event per character_id wins (events arrive newest-first).
    const map = new Map<number, boolean>();
    for (const e of events) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const charId = Number(e.parsedJson?.character_id ?? 0);
      if (!map.has(charId)) map.set(charId, Boolean(e.parsedJson?.hostile));
    }
    // Only return characters that are currently hostile.
    return [...map.entries()]
      .filter(([, hostile]) => hostile)
      .map(([characterId, hostile]) => ({ characterId, hostile }));
  } catch { return []; }
}

// ── Friendly Characters (cross-tribe FRIENDLY override, v13+) ────────────────
//
// Mirrors Hostile Characters infrastructure exactly, inverted. Marks an
// in-game character_id as FRIENDLY — turrets will skip them even when their
// tribe is hostile or unlisted. This is the data path that fixes the
// "per-player FRIENDLY did nothing" bug from v12 and earlier: wallet-keyed
// PlayerRelationKey was structurally unusable (TargetCandidate exposes
// character_id u32, not wallet address), so v13 added FriendlyCharacterKey<u32>
// + a new branch in turret_ext::get_target_priority_list that consults it.

export type FriendlyCharacter = { characterId: number; friendly: boolean };

/** Build set_friendly_character_entry transaction (v13+). */
export function buildSetFriendlyCharacterTx(
  policyId: string, vaultId: string, characterId: number, friendly: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_friendly_character_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.u32(characterId), tx.pure.bool(friendly)],
  });
  return tx;
}

/** Build batch set_friendly_characters_batch_entry transaction (v13+). */
export function buildSetFriendlyCharactersBatchTx(
  policyId: string, vaultId: string, characterIds: number[], friendlyFlags: boolean[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::set_friendly_characters_batch_entry`,
    arguments: [
      tx.object(policyId), tx.object(vaultId),
      tx.pure.vector("u32", characterIds),
      tx.pure.vector("bool", friendlyFlags),
    ],
  });
  return tx;
}

/** Fetch friendly characters from FriendlyCharacterSet events.
 *  FriendlyCharacterSet was introduced in v13. Sui types it under the v13
 *  package id (CRADLEOS_PKG), NOT CRADLEOS_ORIGINAL. The first deploy of this
 *  fetcher queried only the original and silently returned zero rows even
 *  though the on-chain state was correct. fetchEventAcrossPackages handles it.
 */
export async function fetchFriendlyCharacters(vaultId: string): Promise<FriendlyCharacter[]> {
  try {
    const events = await fetchEventAcrossPackages("defense_policy", "FriendlyCharacterSet");
    const map = new Map<number, boolean>();
    for (const e of events) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const charId = Number(e.parsedJson?.character_id ?? 0);
      if (!map.has(charId)) map.set(charId, Boolean(e.parsedJson?.friendly));
    }
    return [...map.entries()]
      .filter(([, friendly]) => friendly)
      .map(([characterId, friendly]) => ({ characterId, friendly }));
  } catch { return []; }
}

// ── Turret Config discovery + bulk reassignment (v13 migration helper) ────────
//
// After a CradleOS package upgrade, existing TurretConfig objects keep working
// because they reference the policy by *object id* (a shared object, not a
// type tag). The defense_policy shared object survives upgrades unchanged, so
// in the common case no turret reassignment is required — v13's bug fix
// activates immediately on existing on-chain state.
//
// Helper below lets a tribe leader bulk-retarget all of their TurretConfigs
// at one new policy_id in a single signed PTB — useful if they recreated their
// policy at some point and need to fix stale config references.

export type TurretConfigInfo = {
  configId: string;
  turretId: string;
  policyId: string;
  preset: number;
  owner: string;
};

/** Discover all TurretConfig shared objects created by `owner` via ConfigCreated events. */
export async function fetchOwnedTurretConfigs(owner: string): Promise<TurretConfigInfo[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::turret_ext::ConfigCreated` }, null, 200, true] }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    const seen = new Set<string>();
    const out: TurretConfigInfo[] = [];
    for (const e of (j.result?.data ?? [])) {
      if (String(e.parsedJson?.owner) !== owner) continue;
      const configId = String(e.parsedJson?.config_id ?? "");
      if (!configId || seen.has(configId)) continue;
      seen.add(configId);
      out.push({
        configId,
        turretId: String(e.parsedJson?.turret_id ?? ""),
        policyId: String(e.parsedJson?.policy_id ?? ""),
        preset: Number(e.parsedJson?.preset ?? 0),
        owner,
      });
    }
    return out;
  } catch { return []; }
}

/**
 * Build a single PTB that calls `update_policy_entry` on every TurretConfig in
 * `configIds`, retargeting them all to `newPolicyId`. Caller must own every
 * TurretConfig (contract enforces with assert!).
 */
export function buildReassignTurretConfigsTx(
  configIds: string[], newPolicyId: string,
): Transaction {
  const tx = new Transaction();
  for (const configId of configIds) {
    tx.moveCall({
      target: `${CRADLEOS_PKG}::turret_ext::update_policy_entry`,
      arguments: [tx.object(configId), tx.pure.address(newPolicyId)],
    });
  }
  return tx;
}

// ── Gate Policy ───────────────────────────────────────────────────────────────

export const GATE_ACCESS_LABELS: Record<number, string> = {
  0: "OPEN",
  1: "TRIBE ONLY",
  2: "ALLIES",
  3: "CLOSED",
};

export type GatePolicyState = {
  objectId: string;
  vaultId: string;
  tribeId: number;
  accessLevel: number;
  version: number;
  tribeOverrides: { tribeId: number; value: number }[];
  playerOverrides: { player: string; value: number }[];
};

export type GateDelegationObj = {
  objectId: string;
  gateId: string;
  vaultId: string;
  tribeId: number;
};

/** Fetch TribeGatePolicy for a vault (from GatePolicyCreated events). */
export async function fetchGatePolicy(vaultId: string): Promise<GatePolicyState | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::gate_policy::GatePolicyCreated` }, null, 50, false] }),
    });
    const json = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
    const match = (json.result?.data ?? []).find(e => String(e.parsedJson?.vault_id) === vaultId);
    if (!match) return null;
    const policyId = String(match.parsedJson?.policy_id ?? "");

    const obj = await rpcGetObject(policyId);
    return {
      objectId: policyId,
      vaultId,
      tribeId: numish(obj["tribe_id"]) ?? 0,
      accessLevel: Number(obj["access_level"] ?? 1),
      version: Number(obj["version"] ?? 0),
      tribeOverrides: [],
      playerOverrides: [],
    };
  } catch { return null; }
}

/** Fetch GateDelegation objects owned by a wallet. */
export async function fetchGateDelegations(walletAddress: string): Promise<GateDelegationObj[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_getOwnedObjects",
        params: [walletAddress, { filter: { StructType: `${CRADLEOS_ORIGINAL}::gate_policy::GateDelegation` }, options: { showContent: true } }, null, 50] }),
    });
    const json = await res.json() as { result?: { data?: Array<{ data?: { objectId?: string; content?: { fields?: Record<string, unknown> } } }> } };
    return (json.result?.data ?? []).map(o => ({
      objectId: String(o.data?.objectId ?? ""),
      gateId: String(o.data?.content?.fields?.gate_id ?? ""),
      vaultId: String(o.data?.content?.fields?.vault_id ?? ""),
      tribeId: numish(o.data?.content?.fields?.tribe_id) ?? 0,
    })).filter(o => o.objectId);
  } catch { return []; }
}

export function buildCreateGatePolicyTx(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::create_gate_policy`,
    arguments: [tx.object(vaultId)] });
  return tx;
}

export function buildSetGateAccessLevelTx(policyId: string, vaultId: string, level: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::set_access_level`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.u8(level)] });
  return tx;
}

export function buildSetGateTribeOverrideTx(policyId: string, vaultId: string, targetTribeId: number, value: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::set_tribe_override`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.u32(targetTribeId >>> 0), tx.pure.u8(value)] });
  return tx;
}

export function buildSetGatePlayerOverrideTx(policyId: string, vaultId: string, player: string, value: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::set_player_override`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.address(player), tx.pure.u8(value)] });
  return tx;
}

export function buildDelegateGateTx(gateId: string, vaultId: string, clockId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::delegate_gate`,
    arguments: [tx.pure.address(gateId), tx.object(vaultId), tx.object(clockId)] });
  return tx;
}

export function buildRemoveGatePlayerOverrideTx(policyId: string, vaultId: string, player: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::remove_player_override`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.address(player)] });
  return tx;
}

export function buildRevokeGateDelegationTx(delegationObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({ target: `${GATE_POLICY_PKG}::gate_policy::revoke_gate_delegation`,
    arguments: [tx.object(delegationObjectId)] });
  return tx;
}

// ── v14: gate policy character-keyed friendly/hostile (mirrors defense_policy v13) ──
//
// The original gate_policy used wallet-keyed PlayerGateKey<address> for
// per-player overrides which couldn't be enforced (world::gate flow exposes
// character_id u32, not wallet). v14 adds GateFriendlyCharacterKey<u32> +
// GateHostileCharacterKey<u32> with the same UX shape as defense_policy.
// is_allowed() consumes them; request_jump_permit_entry() mints a permit
// when allowed.

export type GateFriendlyCharacter = { characterId: number; friendly: boolean };
export type GateHostileCharacter = { characterId: number; hostile: boolean };

export function buildSetGateFriendlyCharacterTx(
  policyId: string, vaultId: string, characterId: number, friendly: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${GATE_POLICY_PKG}::gate_policy::set_friendly_character_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.u32(characterId), tx.pure.bool(friendly)],
  });
  return tx;
}

export function buildSetGateHostileCharacterTx(
  policyId: string, vaultId: string, characterId: number, hostile: boolean,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${GATE_POLICY_PKG}::gate_policy::set_hostile_character_entry`,
    arguments: [tx.object(policyId), tx.object(vaultId), tx.pure.u32(characterId), tx.pure.bool(hostile)],
  });
  return tx;
}

export async function fetchGateFriendlyCharacters(vaultId: string): Promise<GateFriendlyCharacter[]> {
  try {
    const events = await fetchEventAcrossPackages("gate_policy", "GateFriendlyCharacterSet");
    const map = new Map<number, boolean>();
    for (const e of events) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const cid = Number(e.parsedJson?.character_id ?? 0);
      if (!map.has(cid)) map.set(cid, Boolean(e.parsedJson?.friendly));
    }
    return [...map.entries()]
      .filter(([, friendly]) => friendly)
      .map(([characterId, friendly]) => ({ characterId, friendly }));
  } catch { return []; }
}

export async function fetchGateHostileCharacters(vaultId: string): Promise<GateHostileCharacter[]> {
  try {
    const events = await fetchEventAcrossPackages("gate_policy", "GateHostileCharacterSet");
    const map = new Map<number, boolean>();
    for (const e of events) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const cid = Number(e.parsedJson?.character_id ?? 0);
      if (!map.has(cid)) map.set(cid, Boolean(e.parsedJson?.hostile));
    }
    return [...map.entries()]
      .filter(([, hostile]) => hostile)
      .map(([characterId, hostile]) => ({ characterId, hostile }));
  } catch { return []; }
}

/**
 * Build a single PTB that:
 *  1. Borrows the OwnerCap from the gate's owning Character
 *  2. Calls world::gate::authorize_extension<CradleOSAuth>
 *  3. Returns the OwnerCap to the Character
 *
 * Mirrors `buildAuthorizeExtensionTx` for turrets. After this tx confirms,
 * the gate requires a CradleOS-issued JumpPermit; default world::gate::jump
 * is rejected. Pilots get permits via request_jump_permit_entry below.
 */
export function buildAuthorizeGateExtensionTx(
  gateId: string,
  ownerCapId: string,
  characterId: string,
): Transaction {
  const tx = new Transaction();

  const gateType = `${WORLD_PKG}::gate::Gate`;
  const [borrowedCap, receipt] = tx.moveCall({
    target: `${WORLD_PKG}::character::borrow_owner_cap`,
    typeArguments: [gateType],
    arguments: [tx.object(characterId), tx.object(ownerCapId)],
  });

  // CradleOSAuth witness comes from gate_control module
  tx.moveCall({
    target: `${WORLD_PKG}::gate::authorize_extension`,
    typeArguments: [`${CRADLEOS_PKG}::gate_control::CradleOSAuth`],
    arguments: [tx.object(gateId), borrowedCap],
  });

  tx.moveCall({
    target: `${WORLD_PKG}::character::return_owner_cap`,
    typeArguments: [gateType],
    arguments: [tx.object(characterId), borrowedCap, receipt],
  });

  return tx;
}

/**
 * Pilot's "request transit" tx — runs the policy check on chain and mints
 * a JumpPermit to the pilot's character_address if `is_allowed` returns true.
 * If denied the tx aborts with E_ACCESS_DENIED (10) and the pilot sees an
 * "access denied" wallet error.
 *
 * The permit is short-lived (24h hardcoded in the contract) but the dApp
 * surfaces this as access-state, not time. If a permit expires before the
 * pilot uses it, they re-request — the access state on chain is what matters.
 */
export function buildRequestGatePermitTx(
  policyId: string,
  sourceGateId: string,
  destinationGateId: string,
  characterId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${GATE_POLICY_PKG}::gate_policy::request_jump_permit_entry`,
    arguments: [
      tx.object(policyId),
      tx.object(sourceGateId),
      tx.object(destinationGateId),
      tx.object(characterId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/**
 * Query a Gate object's `extension` field to determine whether CradleOSAuth
 * is currently authorized. Returns:
 *   - { authorized: true, extensionType }  if any extension is set
 *   - { authorized: false } if extension is None (default open transit)
 *   - null if the gate object can't be fetched.
 *
 * The dApp surfaces this as a status badge: "✓ CradleOS-enforced" / "⚠ Open transit".
 */
export async function fetchGateExtensionStatus(
  gateId: string,
): Promise<{ authorized: boolean; extensionType: string | null } | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "sui_getObject",
        params: [gateId, { showContent: true }],
      }),
    });
    const j = await res.json() as { result?: { data?: { content?: { fields?: Record<string, unknown> } } } };
    const fields = j.result?.data?.content?.fields ?? {};
    const ext = fields["extension"] as { fields?: { name?: string }; type?: string } | null | undefined;
    if (!ext) return { authorized: false, extensionType: null };
    // Sui represents Option<TypeName> as either null/None or { fields: { name: "<typetag>" } }
    const inner = (ext as { fields?: { name?: string } })?.fields?.name;
    if (!inner) return { authorized: false, extensionType: null };
    return { authorized: true, extensionType: String(inner) };
  } catch { return null; }
}

/**
 * Discover all gates owned by a wallet (via PlayerStructures fetch, filter to
 * gate kind). Used by the "Authorize CradleOS" widget so pilots can see which
 * of their gates are currently CradleOS-enforced vs open.
 */
export async function fetchOwnedGates(
  ownerAddress: string,
): Promise<Array<{ objectId: string; ownerCapId: string; label: string; isOnline: boolean }>> {
  try {
    const groups = await fetchPlayerStructures(ownerAddress);
    const gates: Array<{ objectId: string; ownerCapId: string; label: string; isOnline: boolean }> = [];
    for (const g of groups ?? []) {
      for (const s of g.structures ?? []) {
        if (s.kind === "Gate" && s.ownerCapId) {
          gates.push({
            objectId: s.objectId,
            ownerCapId: s.ownerCapId,
            label: s.displayName || s.label || `Gate ${s.objectId.slice(-6)}`,
            isOnline: !!s.isOnline,
          });
        }
      }
    }
    return gates;
  } catch { return []; }
}

// ── v14: Pilot transit ─ discover all CradleOSAuth-authorized gates ──────────────
//
// Pilots transit a CradleOS-enforced gate by:
//   1. Calling cradleos::gate_policy::request_jump_permit_entry to mint a permit
//      (this fetcher discovers gates the pilot CAN consider transiting)
//   2. Then jumping in-game with world::gate::jump_with_permit (game client handles)
//
// The discovery problem: there's no on-chain index of "all gates with extension X".
// We solve it by querying world::gate::ExtensionAuthorizedEvent (every authorize
// emits one) filtered to the CradleOSAuth type, then verifying each gate's current
// extension still matches CradleOSAuth (in case it was revoked or replaced).

export type CradleOSGate = {
  objectId: string;
  label: string;
  ownerAddress: string | null;        // gate owner's character_address
  linkedGateId: string | null;        // paired gate (jump destination)
  isOnline: boolean;
  extensionAuthorized: boolean;       // current state — still CradleOSAuth
  authorizedAtMs: number;             // when the authorize tx landed
};

/** Return true if the TypeName string identifies our CradleOSAuth witness, regardless
 *  of whether it's the v14 published-at or an earlier upgrade revision. The defining
 *  package id is what Sui types it under — v14 added the gate-permit flow but the
 *  CradleOSAuth witness is in gate_control which has been around longer. We compare
 *  the type tail (`gate_control::CradleOSAuth`) AND require the package id to be one
 *  of the known CradleOS packages. */
function isCradleOSAuthType(typeStr: string | null | undefined): boolean {
  if (!typeStr) return false;
  // Type format: `<pkgId>::gate_control::CradleOSAuth`
  if (!typeStr.endsWith("::gate_control::CradleOSAuth")) return false;
  const pkgPrefix = typeStr.slice(0, typeStr.indexOf("::"));
  // Strip leading "0x" if present and pad / normalize for comparison.
  const norm = (s: string) => (s.startsWith("0x") ? s : "0x" + s).toLowerCase();
  const target = norm(pkgPrefix);
  for (const pkg of CRADLEOS_EVENT_PKGS) {
    if (norm(pkg) === target) return true;
  }
  return false;
}

/**
 * Discover every gate that currently has CradleOSAuth authorized as its
 * extension. Pilots use this list to decide where they need to request a
 * permit. We:
 *  1. Query ExtensionAuthorizedEvent (across all known world packages)
 *  2. Filter by extension_type == CradleOSAuth
 *  3. Dedup by gate_id, keeping the latest event
 *  4. Verify each gate's current extension is still CradleOSAuth (revocations
 *     emit ExtensionRevokedEvent but it's cheaper to just re-check the field)
 *  5. Hydrate label / owner / linkedGateId / online state from the gate object
 */
export async function fetchCradleOSAuthorizedGates(): Promise<CradleOSGate[]> {
  // Query ExtensionAuthorizedEvent under both world package versions — same
  // multi-pkg pattern we use for CradleOS events. world's ExtensionAuthorizedEvent
  // was defined at the original world publish (so type tag is anchored to that).
  const worldPkgs = Array.from(new Set([WORLD_PKG, WORLD_PKG_UTOPIA_V1]));
  const eventQueries = worldPkgs.map(pkg =>
    fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
        params: [{ MoveEventType: `${pkg}::gate::ExtensionAuthorizedEvent` }, null, 500, true],
      }),
    }).then(r => r.json()).catch(() => null),
  );
  type Evt = { parsedJson?: Record<string, unknown>; timestampMs?: string };
  const allEvents: Evt[] = [];
  for (const j of await Promise.all(eventQueries)) {
    const data = (j as { result?: { data?: Evt[] } } | null)?.result?.data ?? [];
    for (const e of data) allEvents.push(e);
  }

  // Latest-event-per-gate wins.
  const gateLatest = new Map<string, { ext: string; ts: number }>();
  for (const e of allEvents) {
    const ts = Number(e.timestampMs ?? 0);
    const gateId = String(e.parsedJson?.assembly_id ?? "");
    if (!gateId) continue;
    // extension_type is parsed as `{ name: "<typestr>" }` by Sui
    const extObj = e.parsedJson?.extension_type as { name?: string } | string | undefined;
    const extStr = typeof extObj === "string" ? extObj : (extObj?.name ?? "");
    const prev = gateLatest.get(gateId);
    if (!prev || ts > prev.ts) gateLatest.set(gateId, { ext: extStr, ts });
  }

  // Keep only gates whose latest extension event is for CradleOSAuth.
  const candidateGateIds = [...gateLatest.entries()]
    .filter(([, v]) => isCradleOSAuthType(v.ext))
    .map(([gateId, v]) => ({ gateId, ts: v.ts }));

  if (candidateGateIds.length === 0) return [];

  // Hydrate gate state — batch via multiGetObjects to keep RPC count small.
  const ids = candidateGateIds.map(c => c.gateId);
  const idChunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) idChunks.push(ids.slice(i, i + 50));
  const hydrated: Array<{ objectId: string; fields: Record<string, unknown> | null }> = [];
  for (const chunk of idChunks) {
    try {
      const res = await fetch(SUI_TESTNET_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "sui_multiGetObjects",
          params: [chunk, { showContent: true }],
        }),
      });
      const j = await res.json() as { result?: Array<{ data?: { objectId?: string; content?: { fields?: Record<string, unknown> } } }> };
      for (const entry of j.result ?? []) {
        hydrated.push({
          objectId: String(entry.data?.objectId ?? ""),
          fields: entry.data?.content?.fields ?? null,
        });
      }
    } catch { /* fall through; affected gates will be skipped */ }
  }

  const tsByGate = new Map(candidateGateIds.map(c => [c.gateId, c.ts]));
  const out: CradleOSGate[] = [];
  for (const h of hydrated) {
    if (!h.fields) continue;
    // Verify current extension is still CradleOSAuth.
    const ext = h.fields["extension"] as { fields?: { name?: string } } | null | undefined;
    const extStr = ext?.fields?.name ?? "";
    const stillAuthorized = isCradleOSAuthType(extStr);
    if (!stillAuthorized) continue;

    // Linked gate (jump pair).
    const linkedRaw = h.fields["linked_gate_id"];
    let linked: string | null = null;
    if (linkedRaw && typeof linkedRaw === "object" && "fields" in linkedRaw) {
      const inner = (linkedRaw as { fields?: { id?: { id?: string } | string } }).fields;
      const v = inner?.id;
      if (typeof v === "string") linked = v;
      else if (v && typeof v === "object" && "id" in v) linked = String((v as { id: string }).id);
    } else if (typeof linkedRaw === "string" && linkedRaw.length > 0) {
      linked = linkedRaw;
    }

    // Owner cap id and online state can be derived from the gate's status field;
    // for the transit list the pilot only needs the gate id + its linked target.
    // We expose isOnline best-effort.
    const status = h.fields["status"] as { fields?: Record<string, unknown> } | undefined;
    const isOnline = Boolean((status?.fields ?? {})["online"] ?? false);

    // Owner address is stored on the OwnerCap, not on the Gate. We skip it here
    // (the dApp can show "unknown owner" for arbitrary gates; the pilot only
    // needs to know the gate id + linked destination + that it's CradleOS-gated).
    out.push({
      objectId: h.objectId,
      label: `Gate ${h.objectId.slice(-6)}`,
      ownerAddress: null,
      linkedGateId: linked,
      isOnline,
      extensionAuthorized: true,
      authorizedAtMs: tsByGate.get(h.objectId) ?? 0,
    });
  }

  // Newest authorize first.
  out.sort((a, b) => b.authorizedAtMs - a.authorizedAtMs);
  return out;
}

// ── v14: Discover candidate TribeGatePolicy objects + pre-flight is_allowed ──────
//
// Pilots requesting a permit must pass a TribeGatePolicy as the first arg. The
// gate owner could use any policy; there's no on-chain binding gate → policy.
// We discover candidate policies via GatePolicyCreated events (under v1 origin
// since that struct was defined there) and let the dApp surface them.

export type GatePolicyCandidate = {
  policyId: string;
  vaultId: string;
  tribeId: number;
  createdAtMs: number;
};

export async function fetchAllGatePolicies(): Promise<GatePolicyCandidate[]> {
  try {
    const events = await fetchEventAcrossPackages("gate_policy", "GatePolicyCreated", 500);
    const seen = new Set<string>();
    const out: GatePolicyCandidate[] = [];
    for (const e of events) {
      const pid = String(e.parsedJson?.policy_id ?? "");
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      out.push({
        policyId: pid,
        vaultId: String(e.parsedJson?.vault_id ?? ""),
        tribeId: Number(e.parsedJson?.tribe_id ?? 0),
        createdAtMs: Number(e.timestampMs ?? 0),
      });
    }
    return out;
  } catch { return []; }
}

/**
 * Pre-flight is_allowed check. Replicates cradleos::gate_policy::is_allowed
 * client-side by reading the policy + its dynamic fields, no signing required.
 *
 * Same precedence as the Move source:
 *   1. Hostile char override → DENY
 *   2. Friendly char override → ALLOW
 *   3. Same tribe (unless CLOSED) → ALLOW
 *   4. Tribe override → follow override
 *   5. Default access_level (OPEN allows; everything else denies)
 *
 * The dApp uses this for a green/red badge BEFORE the pilot signs, so they
 * don't waste gas on a tx that'll abort with E_ACCESS_DENIED.
 */
export async function previewIsAllowed(
  policyId: string,
  characterId: number,
  characterTribeId: number,
): Promise<{ allowed: boolean; error: string | null }> {
  try {
    const fields = await rpcGetObject(policyId);
    const policyTribeId = numish(fields["tribe_id"]) ?? 0;
    const accessLevel = numish(fields["access_level"]) ?? 1;
    const tribeOverridesField = fields["tribe_overrides"] as { fields?: { id?: { id?: string } } } | undefined;
    const tribeOverridesTableId = tribeOverridesField?.fields?.id?.id ?? "";

    // GateHostileCharacterKey + GateFriendlyCharacterKey were defined in v14.
    // Sui types dynamic-field keys under the package id where the struct was
    // first defined — so the lookup must use CRADLEOS_PKG (v14), not
    // CRADLEOS_ORIGINAL. If a future upgrade redefines them, this needs the
    // same multi-pkg fan-out the event fetchers use.
    const [hostile, friendly] = await Promise.all([
      checkDfBoolKey(policyId, `${CRADLEOS_PKG}::gate_policy::GateHostileCharacterKey`, characterId),
      checkDfBoolKey(policyId, `${CRADLEOS_PKG}::gate_policy::GateFriendlyCharacterKey`, characterId),
    ]);
    if (hostile === true) return { allowed: false, error: null };
    if (friendly === true) return { allowed: true, error: null };
    if (characterTribeId !== 0 && characterTribeId === policyTribeId) {
      return { allowed: accessLevel !== 3 /* CLOSED */, error: null };
    }
    if (characterTribeId !== 0 && tribeOverridesTableId) {
      const v = await checkTribeOverride(tribeOverridesTableId, characterTribeId);
      if (v !== null) return { allowed: v === 1, error: null };
    }
    if (accessLevel === 0 /* OPEN */) return { allowed: true, error: null };
    return { allowed: false, error: null };
  } catch (e) {
    return { allowed: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkDfBoolKey(
  parentId: string,
  keyType: string,
  characterId: number,
): Promise<boolean | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "suix_getDynamicFieldObject",
        params: [parentId, { type: keyType, value: { character_id: characterId } }],
      }),
    });
    const j = await res.json() as { result?: { data?: { content?: { fields?: { value?: boolean } } } }; error?: unknown };
    if (j.error) return null;
    const v = j.result?.data?.content?.fields?.value;
    return typeof v === "boolean" ? v : null;
  } catch { return null; }
}

async function checkTribeOverride(tableId: string, tribeId: number): Promise<number | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "suix_getDynamicFieldObject",
        params: [tableId, { type: "u32", value: tribeId }],
      }),
    });
    const j = await res.json() as { result?: { data?: { content?: { fields?: { value?: number | string } } } } };
    const v = j.result?.data?.content?.fields?.value;
    return v === undefined ? null : Number(v);
  } catch { return null; }
}

// ── Tribe member roster via on-chain Character objects ────────────────────────

export type CharacterMember = {
  characterId: string;
  characterAddress: string;
  tribeId: number;
};

/** Query all Character objects for a tribe using Sui GraphQL — paginated. */
export async function fetchTribeMembersByTribeId(tribeId: number): Promise<CharacterMember[]> {
  const results: CharacterMember[] = [];
  let cursor: string | null = null;
  // Paginate through ALL characters and filter by tribe_id
  // GraphQL doesn't support field-level filtering on MoveObject contents directly
  do {
    try {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const query = `{
        objects(filter: { type: "${WORLD_PKG}::character::Character" }, first: 50${afterClause}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            address
            asMoveObject { contents { json } }
          }
        }
      }`;
      const res = await fetch(SUI_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json() as { data?: { objects?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string }; nodes?: Array<{ address: string; asMoveObject?: { contents?: { json?: Record<string, unknown> } } }> } } };
      const page = json.data?.objects;
      for (const n of page?.nodes ?? []) {
        if (Number(n.asMoveObject?.contents?.json?.tribe_id) === tribeId) {
          results.push({
            characterId: String(n.address),
            characterAddress: String(n.asMoveObject?.contents?.json?.character_address ?? ""),
            tribeId,
          });
        }
      }
      cursor = page?.pageInfo?.hasNextPage ? (page?.pageInfo?.endCursor ?? null) : null;
    } catch { break; }
  } while (cursor);
  return results;
}

// ── Bounty Contract Tx Builders ───────────────────────────────────────────────

// ── Personal Vault & Policy Discovery ────────────────────────────────────────

/** Find a vault where this wallet is the founder (personal vault).
 *  Queries CoinLaunched events; falls back to fetching vault objects to check founder field.
 */
export async function fetchPersonalVaultForWallet(walletAddress: string): Promise<{ objectId: string; tribeId: number } | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_ORIGINAL}::tribe_vault::CoinLaunched` },
          null, 200, true,
        ],
      }),
    });
    const json = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
    const events = json.result?.data ?? [];

    // Fast path: some event versions embed founder field directly
    for (const e of events) {
      if (String(e.parsedJson?.founder ?? "").toLowerCase() === walletAddress.toLowerCase()) {
        const vaultId = String(e.parsedJson?.vault_id ?? "");
        const tribeId = Number(e.parsedJson?.tribe_id ?? 0);
        if (vaultId) return { objectId: vaultId, tribeId };
      }
    }

    // Slow path: personal vaults have empty coin name/symbol — filter candidates and verify founder
    const candidates = events
      .filter(e => String(e.parsedJson?.coin_name ?? "").length === 0 || String(e.parsedJson?.coin_symbol ?? "").length === 0)
      .slice(0, 30);

    for (const e of candidates) {
      const vaultId = String(e.parsedJson?.vault_id ?? "");
      if (!vaultId) continue;
      try {
        const fields = await rpcGetObject(vaultId);
        if (String(fields["founder"] ?? "").toLowerCase() === walletAddress.toLowerCase()) {
          return { objectId: vaultId, tribeId: numish(fields["tribe_id"]) ?? 0 };
        }
      } catch { /* */ }
    }
    return null;
  } catch { return null; }
}

/** Find defense policy object ID for a vault by querying PolicyCreated events. */
export async function fetchDefensePolicyForVault(vaultId: string): Promise<string | null> {
  const DEFENSE_POLICY_ORIGIN = CRADLEOS_ORIGINAL;
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${DEFENSE_POLICY_ORIGIN}::defense_policy::PolicyCreated` }, null, 50, true],
      }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
    const match = (j.result?.data ?? []).find(e => String(e.parsedJson?.vault_id) === vaultId);
    return match ? (String(match.parsedJson?.policy_id ?? "") || null) : null;
  } catch { return null; }
}

/** Find gate policy object ID for a vault by querying GatePolicyCreated events. */
export async function fetchGatePolicyForVault(vaultId: string): Promise<string | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::gate_policy::GatePolicyCreated` }, null, 50, false],
      }),
    });
    const json = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
    const match = (json.result?.data ?? []).find(e => String(e.parsedJson?.vault_id) === vaultId);
    return match ? (String(match.parsedJson?.policy_id ?? "") || null) : null;
  } catch { return null; }
}

/** Create a personal vault tx (uses player's tribeId, empty coin name/symbol). */
export function buildCreatePersonalVaultTx(tribeId: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::tribe_vault::create_vault`,
    arguments: [
      tx.pure.u32(tribeId >>> 0),
      tx.pure.vector("u8", []),
      tx.pure.vector("u8", []),
    ],
  });
  return tx;
}

/** Create defense policy for a vault. Vault is passed as immutable sharedRef. */
export async function buildCreatePersonalDefensePolicyTx(vaultId: string): Promise<Transaction> {
  const vISV = await fetchInitialSharedVersion(vaultId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::defense_policy::create_policy_entry`,
    arguments: [vISV ? sharedRef(tx, vaultId, vISV, false) : tx.object(vaultId)],
  });
  return tx;
}

/** Create gate policy for a vault. Vault is passed as object ref (TribeVault). */
export function buildCreatePersonalGatePolicyTx(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${GATE_POLICY_PKG}::gate_policy::create_gate_policy`,
    arguments: [tx.object(vaultId)],
  });
  return tx;
}

/**
 * Build a trustless bounty claim transaction.
 * Calls cradleos::bounty_contract::claim_bounty_trustless_entry.
 *
 * @param bountyId       - Object ID of the shared Bounty
 * @param killmailId     - Object ID of the shared Killmail (world::killmail::Killmail)
 * @param killerCharId   - Object ID of the killer's Character (world::character::Character)
 */
export function buildClaimBountyTrustlessTransaction(
  bountyId: string,
  killmailId: string,
  killerCharId: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::bounty_contract::claim_bounty_trustless_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(bountyId),
      tx.object(killmailId),
      tx.object(killerCharId),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

// ── Keeper Shrine ─────────────────────────────────────────────────────────────

export type KeeperShrineState = {
  objectId: string;
  keeper: string;
  balance: number;       // raw units (divide by 1e9 for EVE display)
  totalDonated: number;
  donationCount: number;
};

export type DonationEvent = {
  shrineId: string;
  donor: string;
  amount: number;
  newBalance: number;
  totalDonated: number;
  donationCount: number;
  timestampMs: number;
};

/**
 * Fetch the current state of a KeeperShrine shared object.
 * Returns null if the shrine ID is empty or the object is not found.
 */
export async function fetchKeeperShrine(shrineId: string): Promise<KeeperShrineState | null> {
  if (!shrineId) return null;
  try {
    const fields = await rpcGetObject(shrineId);
    if (fields._deleted) return null;
    return {
      objectId: shrineId,
      keeper: String(fields.admin ?? fields.keeper ?? ""),
      balance: Number(fields.offerings ?? fields.balance ?? 0),
      totalDonated: Number(fields.total_offered ?? fields.total_donated ?? 0),
      donationCount: Number(fields.offering_count ?? fields.donation_count ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch recent Donation events for a KeeperShrine, most recent first.
 * Returns up to `limit` events (default 20).
 */
export async function fetchRecentDonations(shrineId: string, limit = 20): Promise<DonationEvent[]> {
  if (!shrineId) return [];
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_UPGRADE_ORIGIN}::keeper_shrine::OfferingMade` },
          null,
          limit,
          true, // descending
        ],
      }),
    });
    const json = await res.json() as {
      result?: {
        data?: Array<{
          parsedJson?: Record<string, unknown>;
          timestampMs?: string | number;
        }>;
      };
    };
    return (json.result?.data ?? [])
      .filter(e => {
        const pj = e.parsedJson ?? {};
        // Filter by shrine_id if available in event
        return !pj.shrine_id || String(pj.shrine_id) === shrineId;
      })
      .map(e => {
        const pj = e.parsedJson ?? {};
        return {
          shrineId: String(pj.shrine_id ?? shrineId),
          donor: String(pj.pilgrim ?? pj.donor ?? ""),
          amount: Number(pj.amount ?? 0),
          newBalance: Number(pj.new_balance ?? 0),
          totalDonated: Number(pj.total_offered ?? pj.total_donated ?? 0),
          donationCount: Number(pj.offering_number ?? pj.donation_count ?? 0),
          timestampMs: Number(e.timestampMs ?? 0),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Build a donation transaction for a KeeperShrine.
 * Splits `amount` from the provided eveCoinId and calls keeper_shrine::make_offering.
 *
 * @param shrineId   - Object ID of the shared KeeperShrine
 * @param eveCoinId  - Object ID of the Coin<EVE> to split from
 * @param amount     - Amount in raw units (e.g. 1_000_000_000n = 1 EVE)
 */
export function buildDonateTransaction(shrineId: string, eveCoinId: string, amount: bigint): Transaction {
  const tx = new Transaction();
  const [splitCoin] = tx.splitCoins(tx.object(eveCoinId), [tx.pure.u64(amount)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::keeper_shrine::make_offering`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(shrineId),
      splitCoin,
    ],
  });
  return tx;
}

// ─── Collateral Vault ─────────────────────────────────────────────────────────

export type CollateralVaultState = {
  objectId: string;
  collateralBalance: number;  // raw EVE units
  mintRatio: number;          // tribe tokens per 1 EVE (raw unit)
  totalMinted: number;
  totalRedeemed: number;
  mintCapacity: number;       // remaining mintable = collateralBalance*mintRatio/1e9 - totalMinted
};

/**
 * Discover the CollateralVault linked to a TribeVault by scanning CollateralVaultCreated events.
 * Returns null if no collateral vault has been created yet.
 */
export async function fetchCollateralVault(vaultId: string): Promise<CollateralVaultState | null> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${CRADLEOS_UPGRADE_ORIGIN}::collateral_vault::CollateralVaultCreated` },
          null, 50, false,
        ],
      }),
    });
    const json = await res.json() as { result?: { data?: Array<{ parsedJson?: Record<string, unknown> }> } };
    const match = (json.result?.data ?? []).find(e => String(e.parsedJson?.vault_id) === vaultId);
    if (!match) return null;

    const cvId = String(match.parsedJson?.collateral_vault_id ?? match.parsedJson?.cv_id ?? "");
    if (!cvId) return null;

    // Fetch the CollateralVault object
    const fields = await rpcGetObject(cvId);
    if (fields._deleted) return null;

    // Extract collateral balance — may be string "0", nested Balance object, or direct field
    const collateralField = fields["collateral"];
    const collateralBalance = typeof collateralField === "string" || typeof collateralField === "number"
      ? numish(collateralField) ?? 0
      : numish((asRecord(collateralField) ?? {})["value"]) ?? numish(fields["collateral_balance"]) ?? 0;
    const mintRatio = numish(fields["mint_ratio"]) ?? 0;
    const totalMinted = numish(fields["total_minted"]) ?? 0;
    const totalRedeemed = numish(fields["total_redeemed"]) ?? 0;
    // mintCapacity: how many tribe tokens can still be minted given current collateral
    // collateral is in raw EVE units (9 decimals), mintRatio is tokens per 1 EVE (1e9 raw)
    const mintableFromCollateral = Math.floor((collateralBalance * mintRatio) / 1e9);
    const mintCapacity = Math.max(0, mintableFromCollateral - totalMinted);

    return { objectId: cvId, collateralBalance, mintRatio, totalMinted, totalRedeemed, mintCapacity };
  } catch { return null; }
}

/** Create a CollateralVault for a TribeVault. mintRatio = tribe tokens per 1 EVE. */
export function buildCreateCollateralVaultTx(tribeVaultId: string, mintRatio: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::create_collateral_vault_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(tribeVaultId), tx.pure.u64(BigInt(Math.floor(mintRatio)))],
  });
  return tx;
}

/**
 * Mint tribe tokens using EVE collateral (founder only).
 * coinObjectId: a Coin<EVE> object owned by the sender.
 */
export function buildMintWithCollateralTx(
  cvId: string,
  tribeVaultId: string,
  coinObjectIds: string[], // ALL eve coin objects — will be merged before split
  recipient: string,
  amountRaw: bigint, // exact amount in raw EVE units (9 decimals) to deposit
): Transaction {
  const tx = new Transaction();
  // Merge all coin objects into one, then split exact amount
  const primary = tx.object(coinObjectIds[0]);
  if (coinObjectIds.length > 1) {
    tx.mergeCoins(primary, coinObjectIds.slice(1).map(id => tx.object(id)));
  }
  const [exactCoin] = tx.splitCoins(primary, [tx.pure.u64(amountRaw)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::mint_with_collateral_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(cvId),
      tx.object(tribeVaultId),
      exactCoin,
      tx.pure.address(recipient),
    ],
  });
  return tx;
}

/** Deposit EVE into the collateral vault (increases capacity without minting). */
export function buildDepositCollateralTx(cvId: string, coinObjectIds: string[], amountRaw: bigint): Transaction {
  const tx = new Transaction();
  const primary = tx.object(coinObjectIds[0]);
  if (coinObjectIds.length > 1) {
    tx.mergeCoins(primary, coinObjectIds.slice(1).map(id => tx.object(id)));
  }
  const [exactCoin] = tx.splitCoins(primary, [tx.pure.u64(amountRaw)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::deposit_collateral_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(cvId), exactCoin],
  });
  return tx;
}

/** Mint tribe tokens against already-locked collateral (no new EVE deposit needed).
 *  amount is in raw tribe token units (9 decimals). */
export function buildMintFromCollateralTx(
  cvId: string,
  tribeVaultId: string,
  amountRaw: bigint,
  recipient: string,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::mint_from_collateral_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(cvId),
      tx.object(tribeVaultId),
      tx.pure.u64(amountRaw),
      tx.pure.address(recipient),
    ],
  });
  return tx;
}

/** Founder accounting reset — zeroes total_minted and total_redeemed when supply is 0. */
export function buildResetAccountingTx(cvId: string, tribeVaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::founder_reset_accounting_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(cvId), tx.object(tribeVaultId)],
  });
  return tx;
}

/** Founder emergency drain — withdraw all locked EVE collateral back to founder wallet. */
export function buildDrainCollateralTx(cvId: string, tribeVaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::drain_collateral_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(cvId),
      tx.object(tribeVaultId),
    ],
  });
  return tx;
}

/** Redeem tribe tokens → burn → receive EVE at floor price (1/mintRatio per token). */
export function buildRedeemTx(cvId: string, tribeVaultId: string, amount: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::redeem_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(cvId),
      tx.object(tribeVaultId),
      tx.pure.u64(BigInt(Math.floor(amount))),
    ],
  });
  return tx;
}

/** Update the mint ratio (founder only — affects future mints only). */
export function buildSetMintRatioTx(cvId: string, tribeVaultId: string, newRatio: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::set_mint_ratio_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [
      tx.object(cvId),
      tx.object(tribeVaultId),
      tx.pure.u64(BigInt(Math.floor(newRatio))),
    ],
  });
  return tx;
}

// ──────────────────────────────────────────────────────────────────────────
// Shared-SSU synthesizer (added 2026-04-26)
//
// Build a PlayerStructure-shaped record for an SSU the caller does NOT own
// but DOES have shared access to via cradleos::ssu_access. Used by
// InventoryPanel to render shared SSUs alongside owned ones. ownerCapId is
// intentionally an empty string — the existing rendering already treats
// empty/undefined ownerCapId as "non-owner" and exposes only the
// tribemate-withdraw path (no batch ALL→SHARED, no rename, no online/
// offline buttons).
// ──────────────────────────────────────────────────────────────────────────
export async function synthesizeSharedSsuStructure(ssuObjectId: string): Promise<PlayerStructure | null> {
  const fields = await rpcGetObject(ssuObjectId);
  if (fields._deleted || !Object.keys(fields).length) return null;

  const locFields = asRecord(readPath(fields, "location", "fields")) ?? {};
  const locationHashBytes = (locFields["location_hash"] as number[] | undefined) ?? [];
  const locationHash = locationHashBytes
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");

  const statusVariant = readPath(fields, "status", "fields", "status", "variant");
  const isOnline = statusVariant === "ONLINE";

  const metaName = stringish(readPath(fields, "metadata", "fields", "name")).trim();
  const hasCustomName = metaName.length > 0;

  const typeId = numish(fields["type_id"]) ?? undefined;

  const keyFields = asRecord(readPath(fields, "key", "fields")) ?? {};
  const gameItemId = stringish(keyFields["item_id"]) || undefined;

  // Resolve type name lazily so the synthesizer stays cheap when called for
  // many SSUs in parallel — the caller is expected to call fetchTypeNames()
  // once and patch typeName/displayName afterward. We provide a sane
  // fallback label so the card has *something* to display before the type
  // map resolves.
  const fallbackLabel = "Storage Unit (shared)";
  const displayName = metaName || fallbackLabel;

  return {
    objectId: ssuObjectId,
    ownerCapId: "", // explicit non-owner sentinel
    kind: "StorageUnit",
    typeFull: `${WORLD_PKG}::storage_unit::StorageUnit`,
    label: "Storage Unit",
    displayName,
    hasCustomName,
    isOnline,
    locationHash,
    typeId,
    gameItemId,
  };
}

/**
 * Resolve the operator (owner) of a Storage Unit to a display name + a
 * stable grouping key. Mirrors the partition-owner resolver behavior so
 * names match what shows on inventory partition rows.
 *
 * Strategy:
 *   1. Read the SSU object's `owner_cap_id` field.
 *   2. Fetch that OwnerCap, extract its `AddressOwner` (the operator's
 *      wallet/character address). This is the grouping key.
 *   3. Resolve the OwnerCap via the same `_resolveSinglePartitionKey`
 *      logic used for inventory partitions — covers Stillness's
 *      Character-as-shared-object pattern, OwnerCap-attached-to-Character
 *      pattern, and wallet→PlayerProfile fallback.
 *
 * Returns { name, key } on success. `name` is the resolved display
 * string (Character.metadata.name or `Rider XXXX` or abbreviated
 * address as last resort). `key` is the lowercased AddressOwner of the
 * cap, used by the UI to group SSUs by operator.
 *
 * Returns null when the SSU has no readable `owner_cap_id` or the cap
 * itself doesn't exist on chain (e.g., deleted SSU). Callers should
 * fall back to leaving the operator field undefined in that case.
 *
 * Cached at module scope via the shared partition-owner cache so the
 * same operator across many SSUs only resolves once per session.
 */
export async function resolveSsuOperator(
  ssuObjectId: string,
): Promise<{ name: string; key: string } | null> {
  // Step 1: read SSU object to get owner_cap_id.
  let capId: string | null = null;
  try {
    const ssuRes = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getObject",
        params: [ssuObjectId, { showContent: true }],
      }),
    });
    const ssuJson = (await ssuRes.json()) as {
      result?: {
        data?: {
          content?: { fields?: { owner_cap_id?: string } };
        };
      };
    };
    capId = ssuJson.result?.data?.content?.fields?.owner_cap_id ?? null;
  } catch {
    return null;
  }
  if (!capId) return null;

  // Step 2: fetch the cap to get AddressOwner (the grouping key).
  let key: string | null = null;
  try {
    const capRes = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getObject",
        params: [capId, { showOwner: true }],
      }),
    });
    const capJson = (await capRes.json()) as {
      result?: {
        data?: {
          owner?:
            | { AddressOwner?: string }
            | { ObjectOwner?: string }
            | { Shared?: unknown }
            | string;
        };
      };
    };
    const owner = capJson.result?.data?.owner;
    if (owner && typeof owner === "object") {
      if ("AddressOwner" in owner) {
        key = (owner as { AddressOwner?: string }).AddressOwner ?? null;
      } else if ("ObjectOwner" in owner) {
        key = (owner as { ObjectOwner?: string }).ObjectOwner ?? null;
      }
    }
  } catch {
    return null;
  }
  if (!key) return null;

  // Step 3: resolve the cap to a display name. Reuses the partition-owner
  // resolver's full logic + cache.
  const name = await _resolveSinglePartitionKey(capId);
  if (name) {
    return { name, key: key.toLowerCase() };
  }

  // Resolver returned null — fall back to wallet→Character one more time
  // (it might have hit a transient RPC error). Worst case: abbreviated key.
  const fallbackName = await _fetchCharacterName(key);
  if (fallbackName) {
    return { name: fallbackName, key: key.toLowerCase() };
  }
  return {
    name: `${key.slice(0, 6)}\u2026${key.slice(-4)}`,
    key: key.toLowerCase(),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Resolve partition owners → character names
//
// Storage Unit inventory partitions are keyed by OwnerCap object IDs:
//   - owner_main partition → keyed by SSU's OwnerCap<StorageUnit> id (held
//     by the SSU operator wallet; that wallet has a Character)
//   - per-character lockboxes → keyed by depositor's OwnerCap<Character> id
//     (parented to the depositor's Character object)
//   - open partition → keyed by blake2b256(ssu_id || "open_inventory"); not
//     resolved here, callers should skip these.
//
// `resolvePartitionOwnerNames` takes a set of partition keys and returns a
// Map<key, displayName> with the best-effort character name for each.
// Callers can render this next to items in the UI instead of the generic
// "owner" / "locked" badges.
//
// Module-level cache so we don't refetch the same OwnerCap → name lookup on
// every render. Cache is keyed by partitionKey and never expires within a
// session (character names rarely change; the worst case is a stale name
// across a rename, which is acceptable).
// ──────────────────────────────────────────────────────────────────────────

const _partitionOwnerNameCache = new Map<string, string>();

// ── Local helpers (mirrored from InventoryPanel) ─────────────────────────
//
// `fetchWithRetry` and `_pMap` mirror the same patterns used in
// `InventoryPanel.tsx` so partition-owner resolution stays robust under
// public-fullnode rate limits and doesn't fan out unbounded RPC calls.
// Kept as private module-local copies to avoid widening the public lib API
// surface and to keep the resolver self-contained.

/** Public alias for the private `_ssuFetchWithRetry` helper.
 *  Use this in any panel that fans out >5 RPCs to the public Sui testnet
 *  endpoint. Adds AbortController per-attempt timeout (default 8s),
 *  exponential backoff on 429/5xx, and retry on network error.
 *
 *  Pair with `rpcPMap` for concurrency control. The public testnet
 *  endpoint will rate-limit anything more than ~3 simultaneous in-flight
 *  requests; do NOT use bare `Promise.all(...map)` for >5 RPC calls.
 */
export function rpcFetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
  backoffMs = 600,
  perAttemptTimeoutMs = 8000,
): Promise<Response> {
  return _ssuFetchWithRetry(url, init, retries, backoffMs, perAttemptTimeoutMs);
}

async function _ssuFetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
  backoffMs = 600,
  perAttemptTimeoutMs = 8000,
): Promise<Response> {
  // Per-attempt timeout via AbortController. Browser `fetch()` has no
  // default timeout, so a stalled connection (common in the in-game
  // webview when the public Sui RPC chokes) would otherwise hang the
  // resolver indefinitely — leaving SSUs stuck in the 'Resolving…'
  // group. With a per-attempt timeout, an aborted fetch surfaces as
  // an AbortError caught below, which triggers retry/backoff like any
  // other transient failure.
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), perAttemptTimeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      // Retry on 429 (rate limit) and 5xx (server transient).
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr;
}

/** Public alias for the private `_ssuPMap` helper.
 *  Concurrency-limited Promise.all replacement. Default concurrency=3 is
 *  safe for the public Sui testnet RPC endpoint. Lower (2) for
 *  fan-outs >100 items.
 */
export function rpcPMap<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  concurrency = 3,
): Promise<R[]> {
  return _ssuPMap(items, fn, concurrency);
}

async function _ssuPMap<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  concurrency = 3,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Public helper: fetch a Character object directly by id and return its
 * on-chain metadata.name (or a `Rider XXXX` fallback when the character
 * has no display name). Returns null when the object is deleted/missing.
 *
 * Used by InventoryPanel to stamp the caller's character name on owned
 * SSUs without paying a per-SSU `resolveSsuOperator` RPC pair (the owned
 * SSUs are all by the same character, so one fetch is enough).
 */
export async function fetchCharacterDisplayName(
  charObjectId: string,
): Promise<string | null> {
  return _fetchCharacterName(charObjectId);
}

// Fetch a Character object directly by id and return its on-chain metadata
// name (or a `Rider XXXX` fallback). Uses fetchWithRetry. Returns null when
// the object is deleted/missing.
async function _fetchCharacterName(charObjectId: string): Promise<string | null> {
  try {
    const res = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "sui_getObject",
        params: [charObjectId, { showContent: true, showOwner: true }],
      }),
    });
    const json = await res.json() as {
      result?: { data?: { content?: { fields?: Record<string, unknown> } | null } | null };
    };
    const fields = json.result?.data?.content?.fields;
    if (!fields) return null;
    const name = stringish(readPath(fields, "metadata", "fields", "name")).trim();
    if (name && name !== "—") return name;
    const charId = stringish(readPath(fields, "key", "fields", "item_id"));
    if (charId && charId !== "—") return `Rider ${charId.slice(-4)}`;
    return null;
  } catch {
    return null;
  }
}

// Find the active Character object id for a wallet on a given world package,
// using the SAME multi-character / version-tiebreak strategy as
// `findPlayerProfileForPkg`: fetch all PlayerProfiles, dereference each
// linked Character in parallel, drop deleted, prefer newest by Sui object
// version. Returns the Character object id (so callers can read `metadata.name`).
async function _findCharacterObjectIdForPkg(
  walletAddress: string,
  pkg: string,
): Promise<string | null> {
  let ppRes: Response;
  try {
    ppRes = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getOwnedObjects",
        params: [
          walletAddress,
          { filter: { StructType: `${pkg}::character::PlayerProfile` }, options: { showContent: true } },
          null, 50,
        ],
      }),
    });
  } catch {
    return null;
  }
  const ppJson = await ppRes.json() as {
    result?: { data?: Array<{ data?: { content?: { fields?: { character_id?: string } } } }> };
  };
  const profiles = ppJson.result?.data ?? [];
  if (profiles.length === 0) return null;

  type Resolved = { characterObjectId: string; version: number };
  const resolved: Resolved[] = (await _ssuPMap(
    profiles,
    async (pp): Promise<Resolved | null> => {
      const charId = pp?.data?.content?.fields?.character_id;
      if (!charId) return null;
      try {
        const r = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "sui_getObject",
            params: [charId, { showContent: true, showOwner: true }],
          }),
        });
        const json = await r.json() as {
          result?: { data?: { version?: string; content?: { fields?: Record<string, unknown> } | null } | null };
        };
        const data = json.result?.data;
        // Deleted/non-existent: filter out (matches findPlayerProfileForPkg).
        if (!data?.content?.fields) return null;
        const version = Number(data.version ?? 0);
        return { characterObjectId: charId, version };
      } catch {
        return null;
      }
    },
    3,
  )).filter((x): x is Resolved => x !== null);

  if (resolved.length === 0) return null;
  if (resolved.length === 1) return resolved[0].characterObjectId;

  // Multi-character wallet: prefer newest by Sui object version.
  resolved.sort((a, b) => b.version - a.version);
  if (typeof console !== "undefined" && console.warn) {
    console.warn(
      `[resolvePartitionOwnerNames] wallet ${walletAddress.slice(0, 10)}\u2026 has ${resolved.length} live characters on pkg ${pkg.slice(0, 10)}\u2026; using newest`,
      resolved.map(r => ({ id: r.characterObjectId.slice(0, 10) + "\u2026", ver: r.version })),
    );
  }
  return resolved[0].characterObjectId;
}

async function _resolveSinglePartitionKey(partitionKey: string): Promise<string | null> {
  // Cached?
  if (_partitionOwnerNameCache.has(partitionKey)) {
    return _partitionOwnerNameCache.get(partitionKey) ?? null;
  }

  let resolved: string | null = null;
  try {
    // Get the OwnerCap object — we need its type and owner. Use fetchWithRetry
    // so we ride out 429/5xx bursts when many partitions resolve at once.
    const res = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getObject",
        params: [partitionKey, { showType: true, showOwner: true }],
      }),
    });
    const json = await res.json() as {
      result?: {
        data?: {
          type?: string;
          owner?:
            | { AddressOwner?: string }
            | { ObjectOwner?: string }
            | { Shared?: unknown }
            | string;
        } | null;
      };
    };
    const data = json.result?.data;
    if (!data) {
      _partitionOwnerNameCache.set(partitionKey, "");
      return null;
    }
    const objType = data.type ?? "";
    const owner = data.owner;

    // Branch A: partitionKey is itself a Character shared object.
    // On Stillness (and any tenant where SSU partitions are keyed by
    // character_id directly rather than by OwnerCap), the partition key
    // resolves to a `::character::Character` object whose `metadata.name`
    // is what we want. This is the most direct case — try it first.
    //
    // Detection: type ends in `::character::Character` (no `OwnerCap<` prefix).
    if (
      objType.endsWith("::character::Character") ||
      /::character::Character$/.test(objType)
    ) {
      // Read metadata.name directly from the object content. Use a single
      // RPC call — we don't need to walk an OwnerCap chain because the
      // Character itself is the partition key.
      try {
        const charRes = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sui_getObject",
            params: [partitionKey, { showContent: true }],
          }),
        });
        const charJson = await charRes.json() as {
          result?: {
            data?: {
              content?: {
                fields?: {
                  metadata?: { fields?: { name?: string } };
                };
              };
            };
          };
        };
        const name = charJson.result?.data?.content?.fields?.metadata?.fields?.name?.trim();
        if (name) {
          resolved = name;
        }
      } catch {
        // Fall through — leave resolved null, caller falls back to badge.
      }
    } else if (objType.includes("::access::OwnerCap<") && objType.includes("::character::Character>")) {
      // Branch B: OwnerCap<Character>. Three sub-shapes observed:
      //   B.1 Owner is the parent Character object (ObjectOwner) — cap
      //       attached to its character, walk to it.
      //   B.2 Owner is an address (AddressOwner) and the cap's
      //       `authorized_object_id` field is a Character object id.
      //       This is the Stillness pattern — character_address and
      //       AddressOwner happen to match because Character objects
      //       and wallets share the same address space, but the field
      //       still resolves as a Character. Always try this fetch.
      //   B.3 Owner is a wallet (AddressOwner) and authorized_object_id
      //       is the wallet itself, with a separate Character object
      //       elsewhere. Fall back to wallet→PlayerProfile lookup.
      const parentChar =
        owner && typeof owner === "object" && "ObjectOwner" in owner
          ? (owner as { ObjectOwner?: string }).ObjectOwner
          : null;
      if (parentChar) {
        // B.1
        resolved = await _fetchCharacterName(parentChar);
      } else if (owner && typeof owner === "object" && "AddressOwner" in owner) {
        const walletAddr = (owner as { AddressOwner?: string }).AddressOwner ?? null;
        // Read authorized_object_id from cap content.
        let authorizedId: string | null = null;
        try {
          const capRes = await _ssuFetchWithRetry(SUI_TESTNET_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "sui_getObject",
              params: [partitionKey, { showContent: true }],
            }),
          });
          const capJson = await capRes.json() as {
            result?: {
              data?: {
                content?: {
                  fields?: { authorized_object_id?: string };
                };
              };
            };
          };
          authorizedId =
            capJson.result?.data?.content?.fields?.authorized_object_id ?? null;
        } catch {
          // Ignore — fall through.
        }

        // B.2: ALWAYS try authorized_object_id as a Character first.
        // Stillness uses Character objects whose addresses overlap with
        // wallet space, so equality between authorizedId and walletAddr
        // does NOT mean it isn't a Character. Let _fetchCharacterName
        // verify by reading the object type.
        if (authorizedId) {
          resolved = await _fetchCharacterName(authorizedId);
        }

        // B.3: If authorized_object_id wasn't a Character, try the wallet
        // address itself as a Character (some tenants), then fall back
        // to wallet→PlayerProfile lookup.
        if (!resolved && walletAddr) {
          resolved = await _fetchCharacterName(walletAddr);
        }
        if (!resolved && walletAddr) {
          let charObjectId =
            await _findCharacterObjectIdForPkg(walletAddr, WORLD_PKG);
          if (!charObjectId) {
            charObjectId =
              await _findCharacterObjectIdForPkg(walletAddr, WORLD_PKG_UTOPIA_V1);
          }
          if (charObjectId) {
            resolved = await _fetchCharacterName(charObjectId);
          }
          // If still unresolved, leave null — caller renders the generic
          // "locked" badge rather than a hex string for OwnerCap<Character>.
        }
      }
    } else if (objType.includes("::access::OwnerCap<") && objType.includes("::storage_unit::StorageUnit>")) {
      // Branch C: OwnerCap<StorageUnit>. Owner is a wallet (AddressOwner).
      // Two resolution strategies in order:
      //   C.1 Try the wallet address itself as a Character object id.
      //       This is the Stillness pattern — the SSU operator's
      //       Character is a shared object whose id matches the wallet
      //       address (same address space).
      //   C.2 Wallet→PlayerProfile→Character lookup, current world pkg
      //       first then Utopia v1 fallback. This is the
      //       multi-character / version-tiebreak strategy from
      //       findPlayerProfileForPkg.
      // Only abbreviate the address as a last resort.
      const walletAddr =
        owner && typeof owner === "object" && "AddressOwner" in owner
          ? (owner as { AddressOwner?: string }).AddressOwner
          : null;
      if (walletAddr) {
        // C.1
        resolved = await _fetchCharacterName(walletAddr);
        // C.2
        if (!resolved) {
          let charObjectId =
            await _findCharacterObjectIdForPkg(walletAddr, WORLD_PKG);
          if (!charObjectId) {
            charObjectId =
              await _findCharacterObjectIdForPkg(walletAddr, WORLD_PKG_UTOPIA_V1);
          }
          if (charObjectId) {
            resolved = await _fetchCharacterName(charObjectId);
          }
        }
        // Last resort: abbreviated address. Some SSU operators are not
        // game players (deployer-only wallets) and have no Character.
        if (!resolved) {
          resolved = `${walletAddr.slice(0, 6)}\u2026${walletAddr.slice(-4)}`;
        }
      }
    }
  } catch {
    // Swallow — return null and the UI keeps the generic badge label.
  }

  _partitionOwnerNameCache.set(partitionKey, resolved ?? "");
  return resolved;
}

/**
 * Resolve a set of inventory partition keys to display names for their owners.
 *
 * Skip the open-partition key (caller should not pass it). For each key we:
 *   - fetch the underlying OwnerCap object,
 *   - inspect its type (OwnerCap<Character> vs OwnerCap<StorageUnit>),
 *   - walk to the controlling Character object (multi-char / version-tiebreak
 *     for wallet-typed OwnerCaps, matching findPlayerProfileForPkg),
 *   - return its on-chain `metadata.name` (or a `Rider XXXX` / `0xabcd…1234`
 *     fallback).
 *
 * Concurrency-capped at 3 simultaneous resolutions to stay under public Sui
 * fullnode rate limits, mirroring the InventoryPanel `pMap` strategy. Each
 * resolution itself uses `fetchWithRetry` so transient 429/5xx don't bubble
 * up as missing names.
 *
 * Returns a Map<partitionKey, displayName>. Keys we couldn't resolve are
 * intentionally absent from the map so callers can fall back to the generic
 * badge label.
 */
export async function resolvePartitionOwnerNames(
  partitionKeys: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(partitionKeys));
  if (!unique.length) return out;

  // Concurrency-cap at 3 — matches InventoryPanel pMap default and prevents
  // resolver fan-out from compounding with the panel's own RPC traffic.
  const results = await _ssuPMap(
    unique,
    async (k) => [k, await _resolveSinglePartitionKey(k)] as const,
    3,
  );
  for (const [k, name] of results) {
    if (name) out.set(k, name);
  }
  return out;
}
