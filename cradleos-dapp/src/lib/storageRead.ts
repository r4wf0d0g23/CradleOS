/** Supported, uncached storage reads. Never convert transport failures to empty data. */
import { GrpcTypes, SuiGrpcClient } from '@mysten/sui/grpc';
import { bcs } from '@mysten/sui/bcs';
import { deriveDynamicFieldID, normalizeSuiAddress, normalizeStructTag } from '@mysten/sui/utils';
export const storageClient = new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });
export type StorageReadClient = Pick<SuiGrpcClient, 'ledgerService' | 'stateService'>;
export type StorageObject = { id: string; type: string; version: string; owner: GrpcTypes.Owner; fields: Record<string, any> };
const mask = { paths: ['object_id', 'object_type', 'version', 'owner', 'json'] };
export function unavailable(): never { throw new Error('Storage unavailable. Retry.'); }
export function storageId(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[\da-f]{1,64}$/i.test(value)) return unavailable();
  return normalizeSuiAddress(value);
}
export function storageRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  return value as Record<string, any>;
}
export function storageUint(value: unknown): number {
  if (!['string','number'].includes(typeof value) || !/^\d+$/.test(String(value))) return unavailable();
  const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) return unavailable(); return n;
}
function decode(raw: GrpcTypes.Object): StorageObject {
  if (!raw.objectType || raw.version === undefined || raw.version <= 0n || !raw.owner || raw.owner.kind === undefined) return unavailable();
  const fields = storageRecord((GrpcTypes.Object.toJson(raw) as any).json), id = storageId(raw.objectId);
  if (storageId(fields.id) !== id) return unavailable();
  return { id, type: normalizeStructTag(raw.objectType), version: raw.version.toString(), owner: raw.owner, fields };
}
export async function storageObjects(ids: string[], api: StorageReadClient = storageClient, signal?: AbortSignal): Promise<(StorageObject | null)[]> {
  const out: (StorageObject | null)[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).map(storageId);
    const r = await api.ledgerService.batchGetObjects({ requests: batch.map(objectId => ({ objectId })), readMask: mask }, { timeout: 15000, abort: signal }).response;
    if (!Array.isArray(r.objects) || r.objects.length !== batch.length) return unavailable();
    for (const [n, entry] of r.objects.entries()) {
      if (entry.result?.oneofKind === 'error' && entry.result.error.code === 5) out.push(null);
      else if (entry.result?.oneofKind === 'object') {
        const object = decode(entry.result.object); if (object.id !== batch[n]) return unavailable(); out.push(object);
      } else return unavailable();
    }
  }
  signal?.throwIfAborted(); return out;
}
export async function storageObject(id: string, api: StorageReadClient = storageClient, signal?: AbortSignal): Promise<StorageObject> {
  return (await storageObjects([id], api, signal))[0] ?? unavailable();
}
export function assertStorageType(object: StorageObject, type: string) {
  if (object.type !== normalizeStructTag(type)) unavailable();
}
export function assertStorageOwner(object: StorageObject, owner: string, objectOnly = false) {
  if (!(objectOnly ? object.owner.kind === 2 : [1, 2].includes(object.owner.kind!)) || storageId(object.owner.address) !== storageId(owner)) unavailable();
}
export function idFieldId(parent: string, key: string): string {
  return deriveDynamicFieldID(storageId(parent), '0x2::object::ID', bcs.Address.serialize(storageId(key)).toBytes());
}
export function assertIdField(object: StorageObject, parent: string, key: string, valueType: string) {
  assertStorageType(object, `0x2::dynamic_field::Field<0x2::object::ID,${valueType}>`);
  assertStorageOwner(object, parent, true);
  if (object.id !== idFieldId(parent, key) || storageId(object.fields.name) !== storageId(key)) unavailable();
}
export async function storageOwned(owner: string, type: string, api: StorageReadClient = storageClient, signal?: AbortSignal): Promise<StorageObject[]> {
  const out: StorageObject[] = [], seen = new Set<string>(), cursors = new Set<string>();
  let pageToken: Uint8Array | undefined;
  for (let page = 0; page < 100; page++) {
    const r = await api.stateService.listOwnedObjects({ owner: storageId(owner), objectType: type, pageSize: 100, pageToken, readMask: mask }, { timeout: 15000, abort: signal }).response;
    if (!Array.isArray(r.objects)) return unavailable();
    for (const raw of r.objects) {
      const o = decode(raw); assertStorageOwner(o, owner); assertStorageType(o, type);
      if (seen.has(o.id)) return unavailable(); seen.add(o.id); out.push(o);
    }
    if (!r.nextPageToken?.length) return out;
    const key = Array.from(r.nextPageToken).join(','); if (cursors.has(key)) return unavailable();
    cursors.add(key); pageToken = r.nextPageToken;
  }
  return unavailable();
}
export async function storageFields(parent: string, valueType: string, api: StorageReadClient = storageClient): Promise<StorageObject[]> {
  const out: StorageObject[] = [], seen = new Set<string>(), cursors = new Set<string>(); let pageToken: Uint8Array | undefined;
  for (let page = 0; page < 100; page++) {
    const r = await api.stateService.listDynamicFields({ parent: storageId(parent), pageSize: 100, pageToken, readMask: { paths: ['field_id','parent','field_object.object_id','field_object.object_type','field_object.version','field_object.owner','field_object.json'] } }, { timeout: 15000 }).response;
    if (!Array.isArray(r.dynamicFields)) return unavailable();
    for (const field of r.dynamicFields) {
      if (!field.fieldObject || storageId(field.parent) !== storageId(parent)) return unavailable();
      const o = decode(field.fieldObject); assertIdField(o, parent, o.fields.name, valueType);
      if (storageId(field.fieldId) !== o.id || seen.has(o.id)) return unavailable(); seen.add(o.id); out.push(o);
    }
    if (!r.nextPageToken?.length) return out;
    const key = Array.from(r.nextPageToken).join(','); if (cursors.has(key)) return unavailable(); cursors.add(key); pageToken = r.nextPageToken;
  }
  return unavailable();
}
