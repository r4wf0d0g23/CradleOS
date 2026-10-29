import { GrpcTypes, SuiGrpcClient } from "@mysten/sui/grpc";
import { fromBase64, normalizeSuiAddress } from "@mysten/sui/utils";
import { CURRENT_WORLD } from "./cycle";
import type { PlayerStructure } from "../lib";

// Dedicated read client: the legacy /sui JSON-RPC proxy is not a gRPC endpoint.
const client = new SuiGrpcClient({ network: "testnet", baseUrl: "https://fullnode.testnet.sui.io:443" });
export type StructureReadClient = Pick<SuiGrpcClient, "stateService" | "ledgerService">;
const mask = { paths: ["object_id", "object_type", "version", "owner", "json"] };
const kinds = {
  network_node: ["NetworkNode", "Network Node"], gate: ["Gate", "Gate"],
  assembly: ["Assembly", "Assembly"], turret: ["Turret", "Turret"],
  storage_unit: ["StorageUnit", "Storage Unit"],
} as const;
const structureTypes = new Map(Object.entries(kinds).map(([module, [kind, label]]) =>
  [`${CURRENT_WORLD}::${module}::${kind}`, { kind, label }]));

function fail(): never { throw new Error("Structure data unavailable. Retry."); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) return fail();
  return normalizeSuiAddress(value);
}
function uint(value: unknown): number {
  if (!(typeof value === "number" || typeof value === "string" && /^\d+$/.test(value))) return fail();
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) return fail();
  return n;
}
function text(value: unknown): string { if (typeof value !== "string") return fail(); return value; }
type ReadObject = { id: string; type: string; version: bigint; owner: GrpcTypes.Owner; fields: Record<string, unknown> };
function decode(object: GrpcTypes.Object): ReadObject {
  if (!object.objectType || object.version === undefined || !object.owner || !object.json) return fail();
  const json = record(GrpcTypes.Object.toJson(object));
  const fields = record(json.json);
  const objectId = id(object.objectId);
  if (id(fields.id) !== objectId) return fail();
  return { id: objectId, type: object.objectType, version: object.version, owner: object.owner, fields };
}
function assertOwner(object: ReadObject, owner: string) {
  if (![1, 2].includes(object.owner.kind ?? 0) || id(object.owner.address) !== owner) fail();
}

/** Complete pages only. No partial holdings after a timeout or stalled cursor. */
async function owned(owner: string, api: StructureReadClient, type?: string, signal?: AbortSignal): Promise<ReadObject[]> {
  const out: ReadObject[] = [], seen = new Set<string>(), cursors = new Set<string>();
  let pageToken: Uint8Array | undefined;
  for (let page = 0; page < 100; page++) {
    const response = await api.stateService.listOwnedObjects({ owner, objectType: type, pageSize: 100, pageToken, readMask: mask }, { timeout: 15_000, abort: signal }).response;
    if (!Array.isArray(response.objects)) return fail();
    for (const raw of response.objects) {
      const object = decode(raw);
      assertOwner(object, owner);
      if (seen.has(object.id) || type && object.type !== type) return fail();
      seen.add(object.id); out.push(object);
    }
    if (!response.nextPageToken?.length) return out;
    const key = Array.from(response.nextPageToken).join(",");
    if (cursors.has(key)) return fail();
    cursors.add(key); pageToken = response.nextPageToken;
  }
  return fail();
}

/** Preserve protobuf status: the SDK's higher-level getObjects drops error codes. */
async function objects(ids: string[], api: StructureReadClient, signal?: AbortSignal): Promise<Map<string, ReadObject | null>> {
  const out = new Map<string, ReadObject | null>();
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const response = await api.ledgerService.batchGetObjects({ requests: batch.map(objectId => ({ objectId })), readMask: mask }, { timeout: 15_000, abort: signal }).response;
    if (!Array.isArray(response.objects) || response.objects.length !== batch.length) return fail();
    response.objects.forEach((entry, i) => {
      if (entry.result.oneofKind === "error") {
        // NOT_FOUND alone means explicitly absent. All other failures fail the whole snapshot.
        if (entry.result.error.code !== 5) return fail();
        out.set(batch[i], null);
      } else if (entry.result.oneofKind === "object") {
        const object = decode(entry.result.object);
        if (object.id !== batch[i]) return fail();
        out.set(object.id, object);
      } else fail();
    });
  }
  return out;
}

function structure(object: ReadObject, cap: ReadObject): PlayerStructure {
  const entry = structureTypes.get(object.type);
  if (!entry || cap.type !== `${CURRENT_WORLD}::access::OwnerCap<${object.type}>` ||
      id(object.fields.owner_cap_id) !== cap.id || id(cap.fields.authorized_object_id) !== object.id ||
      object.owner.kind !== 3 || object.owner.version === undefined) return fail();
  const f = object.fields, metadata = f.metadata === null ? { name: "", url: "" } : record(f.metadata), key = record(f.key);
  const status = record(record(f.status).status)["@variant"];
  if (status !== "ONLINE" && status !== "OFFLINE") return fail();
  const hash = fromBase64(text(record(f.location).location_hash));
  if (hash.length !== 32) return fail();
  const name = text(metadata.name).trim(), url = text(metadata.url).trim();
  const itemId = text(key.item_id);
  if (!/^\d+$/.test(itemId) || key.tenant !== "stillness") return fail();
  const s: PlayerStructure = {
    objectId: object.id, ownerCapId: cap.id, kind: entry.kind, label: entry.label, typeFull: object.type,
    displayName: name || entry.label, hasCustomName: !!name, metadataUrl: url || undefined,
    isOnline: status === "ONLINE", locationHash: Array.from(hash, b => b.toString(16).padStart(2, "0")).join(""),
    gameItemId: itemId, typeId: uint(f.type_id), initialSharedVersion: uint(object.owner.version.toString()),
  };
  if (entry.kind === "NetworkNode") {
    const fuel = record(f.fuel), qty = uint(fuel.quantity), capacity = uint(fuel.max_capacity);
    // A never-fueled node has an explicit None unit volume and zero quantity.
    // Missing/malformed fields and positive stock without a volume still fail.
    const volume = fuel.unit_volume === null && qty === 0 ? 0 : uint(fuel.unit_volume);
    if (!capacity) return fail();
    s.fuelLevelPct = Math.min(100, qty * volume / capacity * 100);
    s.runtimeHoursRemaining = qty * uint(fuel.burn_rate_in_ms) / 3_600_000;
  } else if (f.energy_source_id !== null) s.energySourceId = id(f.energy_source_id);
  if (entry.kind === "Gate" && f.linked_gate_id !== null) s.linkedGateId = id(f.linked_gate_id);
  return s;
}

export type StructureSnapshot = { characterId: string; structures: PlayerStructure[] };
export async function readStructureSnapshot(wallet: string, api: StructureReadClient = client, signal?: AbortSignal): Promise<StructureSnapshot> {
  const owner = id(wallet);
  const profiles = await owned(owner, api, `${CURRENT_WORLD}::character::PlayerProfile`, signal);
  const charIds = [...new Set(profiles.map(p => id(p.fields.character_id)))];
  const chars = await objects(charIds, api, signal);
  for (const c of chars.values()) if (c && c.type !== `${CURRENT_WORLD}::character::Character`) fail();
  const candidates = [...chars.values()].filter((c): c is ReadObject => c !== null && id(c.fields.character_address) === owner);
  candidates.sort((a, b) => a.version === b.version ? a.id.localeCompare(b.id) : a.version > b.version ? -1 : 1);
  if (!candidates.length) return { characterId: "", structures: [] };
  let selected: StructureSnapshot | null = null;
  for (const character of candidates) {
  const caps = (await owned(character.id, api, undefined, signal)).filter(c => {
    const prefix = `${CURRENT_WORLD}::access::OwnerCap<`;
    return c.type.startsWith(prefix) && c.type.endsWith(">") && structureTypes.has(c.type.slice(prefix.length, -1));
  });
  const targets = caps.map(c => id(c.fields.authorized_object_id));
  if (new Set(targets).size !== targets.length) return fail();
  const found = await objects(targets, api, signal);
  const structures: PlayerStructure[] = [];
  for (let i = 0; i < caps.length; i++) {
    const object = found.get(targets[i]);
    if (object === undefined) return fail();
    if (object !== null) structures.push(structure(object, caps[i]));
  }
  const nodes = new Map(structures.filter(s => s.kind === "NetworkNode").map(s => [s.objectId, s]));
  for (const s of structures) if (s.energySourceId) s.energySourceInitialSharedVersion = nodes.get(s.energySourceId)?.initialSharedVersion;
  signal?.throwIfAborted();
  // Prefer the still-authorized character with live structures, never mix identities.
  if (!selected || structures.length > selected.structures.length) selected = { characterId: character.id, structures };
  }
  return selected!;
}
