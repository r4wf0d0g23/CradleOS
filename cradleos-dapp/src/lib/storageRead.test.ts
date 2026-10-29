import { expect, it, vi } from 'vitest';
import { GrpcTypes } from '@mysten/sui/grpc';
import { storageObjects, storageOwned, storageFields, idFieldId, type StorageReadClient } from './storageRead';
const id = (n: number) => '0x' + n.toString(16).padStart(64,'0');
function object(n=1) { return GrpcTypes.Object.fromJson({ objectId: id(n), objectType:'0x2::test::Thing',version:'1',owner:{kind:'ADDRESS',address:id(9)},json:{id:id(n)} }); }
function batch(entries: any[]) { return { ledgerService: { batchGetObjects: vi.fn(() => ({ response: Promise.resolve({ objects: entries }) })) } } as unknown as StorageReadClient; }
it.each([7,13,14,16])('rejects status %s, never interprets its message as absence', async code => {
  await expect(storageObjects([id(1)],batch([{ result:{oneofKind:'error',error:{code,message:'Object not found'}} }]))).rejects.toThrow();
});
it('accepts only typed NOT_FOUND as absence', async () => {
  expect(await storageObjects([id(1)],batch([{result:{oneofKind:'error',error:{code:5}}}]))).toEqual([null]);
});
it('rejects partial responses and wrong IDs', async () => {
  await expect(storageObjects([id(1)],batch([]))).rejects.toThrow();
  await expect(storageObjects([id(1)],batch([{result:{oneofKind:'object',object:object(2)}}]))).rejects.toThrow();
});
it('completes owned pages and rejects stalled cursors or failure after a page', async () => {
  const list = vi.fn().mockReturnValueOnce({response:Promise.resolve({objects:[object(1)],nextPageToken:new Uint8Array([1])})})
    .mockReturnValueOnce({response:Promise.resolve({objects:[object(2)]})});
  const api={stateService:{listOwnedObjects:list}} as unknown as StorageReadClient;
  expect(await storageOwned(id(9),'0x2::test::Thing',api)).toHaveLength(2);
  list.mockReturnValue({response:Promise.resolve({objects:[],nextPageToken:new Uint8Array([1])})});
  await expect(storageOwned(id(9),'0x2::test::Thing',api)).rejects.toThrow();
  list.mockReset().mockReturnValueOnce({response:Promise.resolve({objects:[object(1)],nextPageToken:new Uint8Array([1])})})
    .mockImplementationOnce(() => { throw Error('unavailable'); });
  await expect(storageOwned(id(9),'0x2::test::Thing',api)).rejects.toThrow();
});
it('checks owned object owner and exact type', async () => {
  const api={stateService:{listOwnedObjects:() => ({response:Promise.resolve({objects:[object()]})})}} as unknown as StorageReadClient;
  await expect(storageOwned(id(8),'0x2::test::Thing',api)).rejects.toThrow();
  await expect(storageOwned(id(9),'0x2::test::Other',api)).rejects.toThrow();
});
it('checks registry field parent, name, ID and type while paginating', async () => {
  const parent=id(8), key=id(7), fieldId=idFieldId(parent,key);
  const field={fieldId,parent,fieldObject:GrpcTypes.Object.fromJson({objectId:fieldId,objectType:'0x2::dynamic_field::Field<0x2::object::ID,0x2::object::ID>',version:'1',owner:{kind:'OBJECT',address:parent},json:{id:fieldId,name:key,value:id(6)}})};
  const list=vi.fn(() => ({response:Promise.resolve({dynamicFields:[field]})}));
  const api={stateService:{listDynamicFields:list}} as unknown as StorageReadClient;
  expect(await storageFields(parent,'0x2::object::ID',api)).toHaveLength(1);
  field.parent=id(4); await expect(storageFields(parent,'0x2::object::ID',api)).rejects.toThrow();
});
