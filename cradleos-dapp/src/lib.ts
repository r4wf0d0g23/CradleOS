import { Transaction } from "@mysten/sui/transactions";
import { SUI_GRAPHQL } from "./graphql";
import {
  CLOCK,
  CRADLEOS_PKG,
  CRADLEOS_ORIGINAL,
  CRADLEOS_UPGRADE_ORIGIN,
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

/** Try to find a PlayerProfile owned by walletAddress for a given world package. */
async function findPlayerProfileForPkg(walletAddress: string, pkg: string): Promise<CharacterInfo | null> {
  const ppRes = await fetch(SUI_TESTNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "suix_getOwnedObjects",
      params: [
        walletAddress,
        { filter: { StructType: `${pkg}::character::PlayerProfile` }, options: { showContent: true } },
        null, 5,
      ],
    }),
  });
  const ppJson = await ppRes.json() as {
    result: { data: Array<{ data: { objectId: string; content: { fields: { character_id: string } } } }> }
  };
  const pp = ppJson.result?.data?.[0];
  if (!pp?.data?.content?.fields?.character_id) return null;
  const charId = pp.data.content.fields.character_id;
  const charFields = await rpcGetObject(charId);
  const tribeId = numish(charFields["tribe_id"]) ?? 0;
  return { characterId: charId, tribeId };
}

export async function findCharacterForWallet(walletAddress: string): Promise<CharacterInfo | null> {
  // Primary: query PlayerProfile owned object — try BOTH world package versions (v2 then v1)
  // Characters created before the v0.0.21 upgrade have PlayerProfiles from the v1 package.
  const current = await findPlayerProfileForPkg(walletAddress, WORLD_PKG);
  if (current) return current;

  // Fallback to v1 Utopia package (characters created before world-contracts v0.0.21 upgrade)
  const v1 = await findPlayerProfileForPkg(walletAddress, WORLD_PKG_UTOPIA_V1);
  if (v1) return v1;

  // Last resort: scan CharacterCreatedEvent for both packages
  for (const pkg of [WORLD_PKG, WORLD_PKG_UTOPIA_V1]) {
    let cursor: string | null = null;
    do {
      const res = await fetch(SUI_TESTNET_RPC, {
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
export async function fetchEveBalance(address: string): Promise<{ balance: number; coinId: string | null }> {
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
    // Get the specific coin object ID for use in transactions
    const coinsRes = await fetch(SUI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "suix_getCoins",
        params: [address, EVE_COIN_TYPE, null, 1],
      }),
    });
    const coinsJ = await coinsRes.json() as { result?: { data?: Array<{ coinObjectId: string }> } };
    const coinId = coinsJ.result?.data?.[0]?.coinObjectId ?? null;
    return { balance, coinId };
  } catch { return { balance: 0, coinId: null }; }
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
  // Check cache first
  const cached = getCachedVaultId(tribeId);
  if (cached) return cached;
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
      result?: { data?: Array<{ parsedJson?: { vault_id?: string; tribe_id?: string | number } }> }
    };
    const tribeVaults = (json.result?.data ?? []).filter(
      e => Number(e.parsedJson?.tribe_id) === tribeId
    );
    // Prefer vault with non-empty coin name (the "real" launch, not accidental empty ones)
    const named = tribeVaults.find(e => ((e.parsedJson as Record<string,unknown>)?.coin_name as string ?? "").length > 0);
    const match = named ?? tribeVaults[0];
    const vaultId = match?.parsedJson?.vault_id ?? null;
    if (vaultId) setCachedVaultId(tribeId, vaultId);
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
    const seen = new Set<number>();
    const tribes: RegisteredTribe[] = [];
    for (const e of json.result?.data ?? []) {
      const tribeId = Number(e.parsedJson?.tribe_id ?? 0);
      if (!tribeId || seen.has(tribeId)) continue;
      seen.add(tribeId);
      const vaultId = String(e.parsedJson?.vault_id ?? "");
      if (vaultId) setCachedVaultId(tribeId, vaultId);
      tribes.push({
        tribeId,
        coinSymbol: String(e.parsedJson?.coin_symbol ?? "?"),
        coinName:   String(e.parsedJson?.coin_name   ?? ""),
        vaultId,
      });
    }
    return tribes.sort((a, b) => a.tribeId - b.tribeId);
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
export async function fetchPlayerRelations(vaultId: string): Promise<PlayerRelation[]> {
  try {
    const [setRes, rmRes] = await Promise.all([
      fetch(SUI_TESTNET_RPC, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
          params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::defense_policy::PlayerRelationSet` }, null, 200, true] }) }).then(r => r.json()),
      fetch(SUI_TESTNET_RPC, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
          params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::defense_policy::PlayerRelationRemoved` }, null, 200, true] }) }).then(r => r.json()),
    ]);
    // Latest-first: build map from events
    const map = new Map<string, number>();
    for (const e of (setRes?.result?.data ?? []) as Array<{parsedJson?: Record<string,unknown>}>) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const player = String(e.parsedJson?.player ?? "");
      if (!map.has(player)) map.set(player, Number(e.parsedJson?.value ?? 0));
    }
    // Remove events (mark as deleted)
    const removed = new Set<string>();
    for (const e of (rmRes?.result?.data ?? []) as Array<{parsedJson?: Record<string,unknown>}>) {
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

/** Fetch hostile characters from HostileCharacterSet events. */
export async function fetchHostileCharacters(vaultId: string): Promise<HostileCharacter[]> {
  try {
    const res = await fetch(SUI_TESTNET_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "suix_queryEvents",
        params: [{ MoveEventType: `${CRADLEOS_ORIGINAL}::defense_policy::HostileCharacterSet` }, null, 200, true] }),
    });
    const j = await res.json() as { result?: { data?: Array<{ parsedJson: Record<string, unknown> }> } };
    // Most recent event per character_id wins (descending order)
    const map = new Map<number, boolean>();
    for (const e of (j.result?.data ?? [])) {
      if (String(e.parsedJson?.vault_id) !== vaultId) continue;
      const charId = Number(e.parsedJson?.character_id ?? 0);
      if (!map.has(charId)) map.set(charId, Boolean(e.parsedJson?.hostile));
    }
    // Only return characters that are currently hostile
    return [...map.entries()]
      .filter(([, hostile]) => hostile)
      .map(([characterId, hostile]) => ({ characterId, hostile }));
  } catch { return []; }
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
  coinObjectId: string,
  recipient: string,
  amountRaw: bigint, // exact amount in raw EVE units (9 decimals) to deposit
): Transaction {
  const tx = new Transaction();
  // Split exact amount from the coin — prevents entire coin balance being consumed
  const [exactCoin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure.u64(amountRaw)]);
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
export function buildDepositCollateralTx(cvId: string, coinObjectId: string, amountRaw: bigint): Transaction {
  const tx = new Transaction();
  // Split exact amount from the coin — prevents entire coin balance being consumed
  const [exactCoin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure.u64(amountRaw)]);
  tx.moveCall({
    target: `${CRADLEOS_PKG}::collateral_vault::deposit_collateral_entry`,
    typeArguments: [EVE_COIN_TYPE],
    arguments: [tx.object(cvId), exactCoin],
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
