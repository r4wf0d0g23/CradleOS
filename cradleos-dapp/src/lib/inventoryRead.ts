import { fromBase64 } from '@mysten/sui/utils';
import { WORLD_PKG } from '../constants';
import type { PlayerStructure } from '../lib';
import { storageObject, storageId, storageUint, storageRecord, assertStorageType, unavailable } from './storageRead';

export async function readInventoryCharacter(characterId: string) {
  const o = await storageObject(characterId);
  assertStorageType(o, `${WORLD_PKG}::character::Character`);
  if (o.owner.kind !== 3) return unavailable();
  const metadata = o.fields.metadata === null ? {} : storageRecord(o.fields.metadata);
  if (o.fields.metadata !== null && typeof metadata.name !== 'string') return unavailable();
  return { name: typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : `Pilot …${o.id.slice(-6)}`, tribeId: storageUint(o.fields.tribe_id) };
}
export async function readSharedStorage(ssuId: string): Promise<{ structure: PlayerStructure; operator: { name: string; key: string } }> {
  const o = await storageObject(ssuId); assertStorageType(o, `${WORLD_PKG}::storage_unit::StorageUnit`);
  if (o.owner.kind !== 3 || o.owner.version === undefined) return unavailable();
  const f = o.fields, cap = await storageObject(storageId(f.owner_cap_id));
  assertStorageType(cap, `${WORLD_PKG}::access::OwnerCap<${o.type}>`);
  if (![1,2].includes(cap.owner.kind!) || storageId(cap.fields.authorized_object_id) !== o.id) return unavailable();
  const characterId = storageId(cap.owner.address), character = await readInventoryCharacter(characterId);
  const metadata = f.metadata === null ? {} : storageRecord(f.metadata), key = storageRecord(f.key);
  if (f.metadata !== null && (typeof metadata.name !== 'string' || typeof metadata.url !== 'string')) return unavailable();
  if (key.tenant !== 'stillness' || typeof key.item_id !== 'string' || !/^\d+$/.test(key.item_id)) return unavailable();
  const hash = fromBase64(storageRecord(f.location).location_hash);
  const status = f.status?.status?.['@variant'];
  if (hash.length !== 32 || !['ONLINE','OFFLINE'].includes(status)) return unavailable();
  return { structure: { objectId: o.id, ownerCapId: cap.id, kind: 'StorageUnit', label: 'Storage Unit', typeFull: o.type,
    displayName: metadata.name || 'Storage Unit', hasCustomName: !!metadata.name, metadataUrl: metadata.url || undefined,
    typeId: storageUint(f.type_id), gameItemId: key.item_id, initialSharedVersion: storageUint(o.owner.version.toString()),
    isOnline: status === 'ONLINE', locationHash: Array.from(hash,b => b.toString(16).padStart(2,'0')).join('') },
    operator: { name: character.name, key: characterId } };
}
