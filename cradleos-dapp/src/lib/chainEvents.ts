import { bcs } from '@mysten/sui/bcs';
import { deriveObjectID, isValidTransactionDigest, normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';
import { CURRENT_WORLD, CURRENT_EVE_COIN_TYPE, CYCLE_STARTED } from './cycle';
import { OBJECT_REGISTRY, SUI_GRAPHQL } from '../constants';
import { GATE_DEPLOYMENT } from './gateDeployment';
import { storageObjects, type StorageObject } from './storageRead';
import { TESTNET_CHAIN_ID } from './headerStatus';
import { resolveCurrentSystemName } from './currentSystemNames';

export const EVENT_PAGE_SIZE = 30;
export const EVENT_STALE_MS = 180_000;
export const EVENT_MAX_PAGES = 10;
export const EVENT_SOURCES = [
  { id: 'gates', label: 'Gates', type: `${CURRENT_WORLD}::gate` },
  { id: 'losses', label: 'Loss reports', type: `${CURRENT_WORLD}::killmail` },
  { id: 'structures', label: 'Structures', type: `${CURRENT_WORLD}::status::StatusChangedEvent` },
  ...(GATE_DEPLOYMENT ? [{ id: 'routes', label: 'CradleOS routes', type: `${GATE_DEPLOYMENT.originalId}::route` }] : []),
] as const;
export type EventSource = typeof EVENT_SOURCES[number];
export type EventCategory = 'Jumps' | 'Gates' | 'Structures' | 'Access' | 'Payments' | 'Losses';
export type EventRef = { role: string; id: string; kind: 'character' | 'gate' | 'structure' | 'route' | 'system' | 'wallet' | 'entity'; itemId?: string };
export type ChainEvent = { id: string; digest: string; sequence: number; type: string; source: string; category: EventCategory;
  kind: string; recordedAt: number; occurredAt?: number; refs: EventRef[]; paid?: string; expiresAt?: number; permitId?: string;
  notable: boolean; detail?: string };
export type EventPage = { events: ChainEvent[]; cursor: string | null; more: boolean; observedAt: number; indexedAt: number; skipped: number };
export type EventStream = EventPage & { error: boolean; pages: number; cursors: string[] };
export type EntityInfo = { name: string; kind: EventRef['kind']; itemId?: string; coin?: 'EVE' | 'SUI'; gateIds?: string[] };
export type EntityNames = Record<string, EntityInfo>;
export const emptyStream = (): EventStream => ({ events: [], cursor: null, more: false, observedAt: 0, indexedAt: 0, skipped: 0, error: false, pages: 0, cursors: [] });
const routePrefix = GATE_DEPLOYMENT ? `${GATE_DEPLOYMENT.originalId}::route::` : '';
const tenantKey = bcs.struct('TenantItemId', { item_id: bcs.u64(), tenant: bcs.string() });
function fail(): never { throw Error('Events unavailable'); }
function record(v: unknown): Record<string, any> { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v as Record<string, any>; }
function id(v: unknown): string { if (typeof v !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(v)) fail(); return normalizeSuiAddress(v); }
function uint(v: unknown): string {
  if (!['number', 'string'].includes(typeof v) || !/^(0|[1-9]\d*)$/.test(String(v)) || typeof v === 'number' && !Number.isSafeInteger(v)) fail();
  if (BigInt(v as string) > 18446744073709551615n) fail(); return String(v);
}
function safe(v: unknown): number { const n = Number(uint(v)); if (!Number.isSafeInteger(n)) fail(); return n; }
function date(v: unknown): number {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(v)) fail();
  const n = Date.parse(v); if (!Number.isFinite(n) || n <= 0) fail(); return n;
}
function bool(v: unknown): boolean { if (typeof v !== 'boolean') fail(); return v; }
function key(v: unknown): string { const k = record(v); if (k.tenant !== 'stillness') fail(); return uint(k.item_id); }
function variant(v: unknown, values: string[]): string { const s = record(v)['@variant']; if (!values.includes(s)) fail(); return s; }
export function eventObjectId(itemId: string): string {
  return deriveObjectID(OBJECT_REGISTRY, `${CURRENT_WORLD}::in_game_id::TenantItemId`, tenantKey.serialize({ item_id: uint(itemId), tenant: 'stillness' }).toBytes());
}
function ref(role: string, objectId: unknown, kind: EventRef['kind'], itemKey?: unknown): EventRef {
  const itemId = itemKey === undefined ? undefined : key(itemKey), object = id(objectId);
  if (itemId !== undefined && eventObjectId(itemId) !== object) fail();
  return { role, id: object, kind, itemId };
}
function itemRef(role: string, itemKey: unknown, kind: EventRef['kind']): EventRef {
  const itemId = key(itemKey); return { role, id: eventObjectId(itemId), kind, itemId };
}

/** Exact event allowlist. Unknown future event types are counted as skipped. */
export function decodeChainEvent(raw: unknown, source: EventSource): ChainEvent | null {
  const n = record(raw), contents = record(n.contents), type = record(contents.type).repr;
  if (typeof type !== 'string' || !(type === source.type || type.startsWith(`${source.type}::`))) fail();
  const digest = record(n.transaction).digest;
  if (typeof digest !== 'string' || !isValidTransactionDigest(digest)) fail();
  const sequence = safe(n.sequenceNumber), recordedAt = date(n.timestamp), f = record(contents.json);
  if (recordedAt < Date.parse(CYCLE_STARTED)) fail();
  const e: ChainEvent = { id: `${digest}#${sequence}`, digest, sequence, type, source: source.id, recordedAt,
    category: 'Gates', kind: '', refs: [], notable: false };
  const pair = () => [ref('From', f.source_gate_id, 'gate', f.source_gate_key), ref('To', f.destination_gate_id, 'gate', f.destination_gate_key)];
  switch (type) {
    case `${CURRENT_WORLD}::gate::JumpEvent`:
      return { ...e, kind: 'jump', category: 'Jumps', refs: [ref('Pilot', f.character_id, 'character', f.character_key), ...pair()] };
    case `${CURRENT_WORLD}::gate::GateLinkedEvent`:
    case `${CURRENT_WORLD}::gate::GateUnlinkedEvent`:
      return { ...e, kind: type.endsWith('::GateLinkedEvent') ? 'linked' : 'unlinked', refs: pair(), notable: true };
    case `${CURRENT_WORLD}::gate::GateCreatedEvent`:
      return { ...e, kind: 'gate-created', refs: [ref('Gate', f.assembly_id, 'gate', f.assembly_key)], notable: true };
    case `${CURRENT_WORLD}::gate::JumpPermitIssuedEvent`:
      return { ...e, kind: 'permit', category: 'Access', refs: [ref('Pilot', f.character_id, 'character', f.character_key), ...pair()],
        permitId: id(f.jump_permit_id), expiresAt: safe(f.expires_at_timestamp_ms) };
    case `${CURRENT_WORLD}::gate::ExtensionAuthorizedEvent`:
    case `${CURRENT_WORLD}::gate::ExtensionRevokedEvent`:
      return { ...e, kind: type.endsWith('::ExtensionAuthorizedEvent') ? 'extension-set' : 'extension-removed', category: 'Access', refs: [ref('Gate', f.assembly_id, 'gate', f.assembly_key)], notable: true };
    case `${CURRENT_WORLD}::status::StatusChangedEvent`: {
      const action = variant(f.action, ['ANCHORED', 'UNANCHORED', 'ONLINE', 'OFFLINE']);
      variant(f.status, ['NULL', 'OFFLINE', 'ONLINE']);
      return { ...e, kind: action.toLowerCase(), category: 'Structures', refs: [ref('Structure', f.assembly_id, 'structure', f.assembly_key)], notable: action === 'UNANCHORED' };
    }
    case `${CURRENT_WORLD}::killmail::KillmailCreatedEvent`: {
      key(f.key); key(f.reported_by_character_id);
      const loss = variant(f.loss_type, ['SHIP', 'STRUCTURE']), occurredAt = safe(f.kill_timestamp) * 1000;
      if (!Number.isSafeInteger(occurredAt) || occurredAt <= 0 || occurredAt > recordedAt + 60_000) fail();
      return { ...e, kind: 'loss', category: 'Losses', occurredAt, detail: loss === 'SHIP' ? 'Ship loss' : 'Structure loss', notable: true,
        refs: [itemRef('Killer', f.killer_id, 'entity'), itemRef('Victim', f.victim_id, 'entity'), itemRef('System', f.solar_system_id, 'system')] };
    }
    case `${routePrefix}RouteCreated`:
      return { ...e, kind: 'route-created', refs: [ref('Route', f.route_id, 'route'), ref('From', f.gate_a, 'gate'), ref('To', f.gate_b, 'gate')], notable: true };
    case `${routePrefix}Changed`:
      safe(f.revision);
      return { ...e, kind: 'route-changed', category: 'Access', detail: !bool(f.active) ? 'Inactive' : bool(f.locked) ? 'Paused' : 'Active', refs: [ref('Route', f.route_id, 'route')], notable: true };
    case `${routePrefix}PermitIssued`:
    case `${routePrefix}PassPurchased`:
      return { ...e, kind: type.endsWith('::PermitIssued') ? 'permit' : 'pass', category: 'Access', refs: [ref('Pilot', f.character, 'character'), ref('Route', f.route_id, 'route')],
        paid: uint(f.paid), expiresAt: safe(f.expires_at), ...(type.endsWith('::PermitIssued') ? { permitId: id(f.permit_id) } : {}) };
    case `${routePrefix}Claimed`:
      return { ...e, kind: 'claimed', category: 'Payments', refs: [ref('Route', f.route_id, 'route'), ref('Recipient', f.recipient, 'wallet')], paid: uint(f.amount) };
    default: return null;
  }
}

export const EVENT_QUERY = `query ChainEventLog($type:String!,$before:String,$count:Int!) {
  chainIdentifier
  serviceConfig { availableRange(type:"Query",field:"events",filters:["type"]) { last { sequenceNumber timestamp } } }
  events(last:$count,before:$before,filter:{type:$type}) {
    nodes { sequenceNumber timestamp transaction { digest } contents { type { repr } json } }
    pageInfo { hasPreviousPage startCursor }
  }
}`;
export async function readEventPage(source: EventSource, before: string | null, signal: AbortSignal, fetcher: typeof fetch = fetch,
  verifyRoutes: typeof verifyRouteEventTenants = verifyRouteEventTenants): Promise<EventPage> {
  const response = await fetcher(SUI_GRAPHQL, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: EVENT_QUERY, variables: { type: source.type, before, count: EVENT_PAGE_SIZE } }), signal });
  if (!response.ok) fail();
  const json = record(await response.json());
  if (json.errors !== undefined && (!Array.isArray(json.errors) || json.errors.length)) fail();
  const data = record(json.data), page = record(data.events), pageInfo = record(page.pageInfo);
  if (data.chainIdentifier !== TESTNET_CHAIN_ID || !Array.isArray(page.nodes) || page.nodes.length > EVENT_PAGE_SIZE) fail();
  const watermark = record(record(record(data.serviceConfig).availableRange).last);
  const indexedAt = date(watermark.timestamp), observedAt = Date.now();
  safe(watermark.sequenceNumber);
  if (indexedAt > observedAt + 30_000) fail();
  const more = bool(pageInfo.hasPreviousPage), cursor = pageInfo.startCursor;
  if (cursor !== null && (typeof cursor !== 'string' || !cursor || cursor.length > 4096) || more && (!cursor || cursor === before || !page.nodes.length)) fail();
  const events: ChainEvent[] = [], seen = new Set<string>(); let skipped = 0;
  for (const node of page.nodes) {
    const event = decodeChainEvent(node, source);
    if (!event) { skipped++; continue; }
    if (seen.has(event.id) || event.recordedAt > indexedAt + 1000) fail();
    seen.add(event.id); events.push(event);
  }
  if (source.id === 'routes' && events.length) await verifyRoutes(events, signal);
  signal.throwIfAborted();
  return { events: sortEvents(events), cursor, more, observedAt, indexedAt, skipped };
}
export function sortEvents(events: ChainEvent[]): ChainEvent[] {
  return [...events].sort((a,b) => b.recordedAt - a.recordedAt || a.digest.localeCompare(b.digest) || b.sequence - a.sequence);
}
export function mergeEventPage(previous: EventStream, page: EventPage, older: boolean): EventStream {
  if (!older) return { ...page, error: false, pages: 1, cursors: page.cursor ? [page.cursor] : [] };
  if (!previous.pages || !previous.more || page.more && previous.cursors.includes(page.cursor!) || page.events.some(e => previous.events.some(p => e.id === p.id))) fail();
  return { ...page, events: sortEvents([...previous.events, ...page.events]), skipped: previous.skipped + page.skipped, error: false,
    pages: previous.pages + 1, cursors: [...previous.cursors, ...(page.cursor ? [page.cursor] : [])], observedAt: previous.observedAt, indexedAt: previous.indexedAt };
}
export function combinedEvents(streams: Record<string, EventStream>): ChainEvent[] {
  const all = sortEvents(Object.values(streams).flatMap(s => s.events));
  const paidPermits = new Set(all.filter(e => e.permitId && e.paid !== undefined).map(e => `${e.digest}:${e.permitId}`));
  return all.filter(e => !(e.permitId && e.paid === undefined && paidPermits.has(`${e.digest}:${e.permitId}`)));
}
export function streamStatus(stream: EventStream, now: number, history = false): string {
  if (stream.error) return stream.pages ? 'Stale' : 'Unavailable';
  if (!stream.pages) return 'Loading';
  if (history) return 'History';
  return now - stream.observedAt > EVENT_STALE_MS || now - stream.indexedAt > EVENT_STALE_MS ? 'Stale' : 'Current';
}

export function cleanEventName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0,80) : '';
}
export function decodeEventEntity(object: StorageObject): EntityInfo | null {
  const f = object.fields, type = normalizeStructTag(object.type);
  if (id(f.id) !== object.id || object.owner.kind !== 3) fail();
  const kinds: Record<string, EventRef['kind']> = { character: 'character', gate: 'gate', storage_unit: 'structure', network_node: 'structure', turret: 'structure', assembly: 'structure' };
  for (const [module, kind] of Object.entries(kinds)) {
    const struct = { character: 'Character', gate: 'Gate', storage_unit: 'StorageUnit', network_node: 'NetworkNode', turret: 'Turret', assembly: 'Assembly' }[module];
    if (type === `${CURRENT_WORLD}::${module}::${struct}`) {
      const itemId = key(f.key); if (eventObjectId(itemId) !== object.id) fail();
      return { kind, itemId, name: cleanEventName(f.metadata?.name) };
    }
  }
  if (routePrefix && type.startsWith(`${routePrefix}Route<`) && type.endsWith('>')) {
    const coin = type === normalizeStructTag(`${routePrefix}Route<${CURRENT_EVE_COIN_TYPE}>`) ? 'EVE'
      : type === normalizeStructTag(`${routePrefix}Route<0x2::sui::SUI>`) ? 'SUI' : undefined;
    return { name: cleanEventName(f.name), kind: 'route', coin, gateIds: [id(f.gate_a), id(f.gate_b)] };
  }
  return null;
}
/** Route events omit tenant and currency. Resolve authoritative route/gates first. */
export async function verifyRouteEventTenants(events: ChainEvent[], signal: AbortSignal, read = storageObjects): Promise<void> {
  const ids = [...new Set(events.flatMap(e => e.refs.filter(r => r.kind === 'route').map(r => r.id)))];
  const routes = await read(ids, undefined, signal);
  const infos = routes.map((route, i) => {
    if (!route || route.id !== ids[i] || route.owner.kind !== 3) fail();
    const info = decodeEventEntity(route); if (info?.kind !== 'route' || info.gateIds?.length !== 2) fail();
    return info;
  });
  const gates = [...new Set(infos.flatMap(info => info.gateIds!))];
  const objects = await read(gates, undefined, signal);
  objects.forEach((gate, i) => {
    if (!gate || gate.id !== gates[i] || gate.owner.kind !== 3 || decodeEventEntity(gate)?.kind !== 'gate') fail();
  });
  events.forEach(e => {
    const index = ids.indexOf(e.refs.find(r => r.kind === 'route')!.id), info = infos[index];
    if (e.kind === 'route-created' && (e.refs.find(r=>r.role==='From')?.id !== info.gateIds![0] || e.refs.find(r=>r.role==='To')?.id !== info.gateIds![1])) fail();
  });
  routes.forEach((route, i) => entityCache.set(route!.id, { value: infos[i], at: Date.now() }));
}
const entityCache = new Map<string, { value: EntityInfo | null; at: number }>();
export async function readEventNames(events: ChainEvent[], signal: AbortSignal): Promise<{ names: EntityNames; failed: boolean }> {
  const refs = [...new Set(events.flatMap(e => e.refs.filter(r => r.kind !== 'system' && r.kind !== 'wallet').map(r => r.id)))];
  const missing = refs.filter(id => !entityCache.has(id) || Date.now() - entityCache.get(id)!.at > 600_000).slice(0,300);
  let failed = false;
  try {
    if (missing.length) {
      const objects = await storageObjects(missing, undefined, signal);
      objects.forEach((object, i) => {
        let value: EntityInfo | null = null;
        try { value = object ? decodeEventEntity(object) : null; } catch { failed = true; }
        entityCache.set(missing[i], { value, at: Date.now() });
      });
    }
  } catch { signal.throwIfAborted(); failed = true; }
  while (entityCache.size > 2400) entityCache.delete(entityCache.keys().next().value!);
  const names: EntityNames = {};
  for (const id of refs) { const cached = entityCache.get(id); if (cached?.value && Date.now() - cached.at <= 600_000) names[id] = cached.value; }
  const systems = [...new Map(events.flatMap(e=>e.refs.filter(r=>r.kind==='system')).map(r=>[r.id,r])).values()];
  if (systems.length) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (()=>void) | undefined;
    try {
      const resolved = await Promise.race([
        Promise.all(systems.map(async r=>({ref:r,name:await resolveCurrentSystemName(Number(r.itemId))}))),
        new Promise<never>((_,reject)=>{ stop=()=>reject(Error('Names unavailable')); timer=setTimeout(stop,8000); signal.addEventListener('abort',stop,{once:true}); if(signal.aborted)stop(); }),
      ]);
      for (const {ref,name} of resolved) if(name) names[ref.id]={name:cleanEventName(name),kind:'system',itemId:ref.itemId};
    } catch { signal.throwIfAborted(); failed=true; }
    finally { if(timer)clearTimeout(timer); if(stop)signal.removeEventListener('abort',stop); }
  }
  return { names, failed };
}
export function eventLabel(ref: EventRef | undefined, names: EntityNames): string {
  if (!ref) return 'Unknown';
  const entity = names[ref.id], compatible = entity && (ref.kind === 'entity' || entity.kind === ref.kind || ref.kind === 'structure' && entity.kind === 'gate');
  if (compatible && entity.name) return entity.name;
  const prefix = { character: 'Pilot', gate: 'Gate', route: 'Route', structure: 'Structure', system: 'System', wallet: 'Wallet', entity: ref.role }[ref.kind];
  return `${prefix} ${ref.itemId ?? (compatible ? entity.itemId : undefined) ?? `${ref.id.slice(0,8)}…${ref.id.slice(-6)}`}`;
}
export function eventAmount(event: ChainEvent, names: EntityNames): string | null {
  if (event.paid === undefined) return null;
  const route = event.refs.find(r => r.kind === 'route'), coin = route ? names[route.id]?.coin : undefined;
  if (!coin) return `${event.paid} units · Token unknown`;
  const n = BigInt(event.paid), fraction = (n % 1000000000n).toString().padStart(9,'0').replace(/0+$/, '');
  return `${n / 1000000000n}${fraction ? `.${fraction}` : ''} ${coin === 'EVE' ? '$EVE' : 'SUI'}`;
}
export function eventSentence(e: ChainEvent, names: EntityNames): string {
  const label = (role: string) => eventLabel(e.refs.find(r => r.role === role), names);
  switch(e.kind) {
    case 'jump': return `${label('Pilot')} jumped · ${label('From')} → ${label('To')}`;
    case 'linked': return `${label('From')} linked to ${label('To')}`;
    case 'unlinked': return `${label('From')} unlinked from ${label('To')}`;
    case 'gate-created': return `${label('Gate')} anchored`;
    case 'permit': return `${label('Pilot')} obtained a jump permit · ${e.refs.some(r=>r.role==='Route') ? label('Route') : `${label('From')} ↔ ${label('To')}`}`;
    case 'pass': return `${label('Pilot')} bought a timed pass · ${label('Route')}`;
    case 'claimed': return `${label('Route')} proceeds claimed · ${eventAmount(e,names)}`;
    case 'route-created': return `${label('Route')} created · ${label('From')} ↔ ${label('To')}`;
    case 'route-changed': return `${label('Route')} settings updated · ${e.detail}`;
    case 'extension-set': return `${label('Gate')} access extension configured`;
    case 'extension-removed': return `${label('Gate')} access extension removed`;
    case 'loss': return `${e.detail} reported · ${label('Killer')} → ${label('Victim')} · ${label('System')}`;
    default: return `${label('Structure')} ${e.kind}`;
  }
}
export function eventMatches(e: ChainEvent, query: string, names: EntityNames): boolean {
  const q = query.trim().toLowerCase();
  return !q || [eventSentence(e,names), e.digest, e.type, ...e.refs.flatMap(r => [r.id, r.itemId ?? '', ...(names[r.id]?.gateIds ?? [])])].some(s => s.toLowerCase().includes(q));
}
export function tickerEvents(events: ChainEvent[], streams: Record<string, EventStream>, now: number, history: boolean): ChainEvent[] {
  if (history) return [];
  return events.filter(e => e.notable && streamStatus(streams[e.source],now) === 'Current' && now - e.recordedAt < 86400000).slice(0,8);
}
