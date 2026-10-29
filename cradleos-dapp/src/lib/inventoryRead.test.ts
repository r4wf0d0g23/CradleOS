import { afterEach, expect, it, vi } from 'vitest';
import { WORLD_PKG as W } from '../constants';
import { readSharedStorage } from './inventoryRead';
import * as read from './storageRead';
vi.mock('./storageRead', async original => ({ ...await original<typeof import('./storageRead')>(),storageObject:vi.fn() }));
const id=(n:number)=>'0x'+n.toString(16).padStart(64,'0');
function fixture() {
 const ssu={id:id(1),type:`${W}::storage_unit::StorageUnit`,version:'1',owner:{kind:3,version:1n},fields:{owner_cap_id:id(2),metadata:{name:'Shared Store',url:''},key:{tenant:'stillness',item_id:'123'},location:{location_hash:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='},status:{status:{'@variant':'ONLINE'}},type_id:'88083'}};
 const cap={id:id(2),type:`${W}::access::OwnerCap<${ssu.type}>`,version:'1',owner:{kind:1,address:id(3)},fields:{authorized_object_id:id(1)}};
 const char={id:id(3),type:`${W}::character::Character`,version:'1',owner:{kind:3},fields:{metadata:{name:'Pilot'},tribe_id:7}};
 const map=new Map<string,any>([[ssu.id,ssu],[cap.id,cap],[char.id,char]]);
 vi.mocked(read.storageObject).mockImplementation(async objectId=>{if(!map.has(objectId))throw Error('unavailable');return map.get(objectId);});
 return {ssu,cap,char};
}
afterEach(()=>vi.resetAllMocks());
it('synthesizes current shared structure from exact cap and operator',async()=>{
 fixture();expect(await readSharedStorage(id(1))).toMatchObject({structure:{objectId:id(1),displayName:'Shared Store',ownerCapId:id(2),isOnline:true},operator:{name:'Pilot',key:id(3)}});
});
it.each(['metadata','cap','owner','character'])('rejects invalid shared descriptor %s',async bad=>{
 const f=fixture();
 if(bad==='metadata')(f.ssu.fields.metadata.name as any)=9;
 if(bad==='cap')f.cap.fields.authorized_object_id=id(9);
 if(bad==='owner')f.cap.owner.kind=3;
 if(bad==='character')f.char.type=`${id(99)}::character::Character`;
 await expect(readSharedStorage(id(1))).rejects.toThrow();
});
