import { afterEach, expect, it, vi } from 'vitest';
import { SSU_ACCESS_ORIGINAL as P, SSU_POLICY_REGISTRY as R, WORLD_PKG as W } from '../constants';
import { loadPolicyForSsu, discoverSharedSsus, fetchStuckItems } from './ssuAccess';
import * as read from './storageRead';
vi.mock('./storageRead', async original => ({ ...await original<typeof import('./storageRead')>(), storageObject:vi.fn(),storageObjects:vi.fn(),storageFields:vi.fn(),storageOwned:vi.fn() }));
const id=(n:number) => '0x'+n.toString(16).padStart(64,'0');
const ssu=id(1), table=id(2), pid=id(3);
function fixture() {
 const registry={id:R,type:`${P}::ssu_access::SsuPolicyRegistry`,version:'1',owner:{kind:3},fields:{id:R,policies:{id:table,size:'1'}}};
 const field={id:read.idFieldId(table,ssu),type:'0x2::dynamic_field::Field<0x2::object::ID,0x2::object::ID>',version:'1',owner:{kind:2,address:table},fields:{name:ssu,value:pid}};
 // Reader normalizes all type tags; normalize this fixture through real assertion expectation.
 field.type='0x'+ '2'.padStart(64,'0')+'::dynamic_field::Field<0x'+ '2'.padStart(64,'0')+'::object::ID,0x'+ '2'.padStart(64,'0')+'::object::ID>';
 const policy={id:pid,type:`${P}::ssu_access::SsuPolicy`,version:'1',owner:{kind:3},fields:{ssu_id:ssu,mode:1,tribe_id:7,deny:[],allow:[]}};
 vi.mocked(read.storageObject).mockImplementation(async objectId => (objectId===R?registry:policy));
 vi.mocked(read.storageObjects).mockResolvedValue([field]);
 return {registry,field,policy};
}
afterEach(()=>vi.resetAllMocks());
it('loads a live single-tribe policy with exact SSU binding', async()=>{
 fixture(); expect(await loadPolicyForSsu(ssu)).toEqual({policyId:pid,mode:{kind:'tribe_alliance',tribeIds:[7]}});
});
it('absence is distinct from registry/field transport failure',async()=>{
 fixture(); vi.mocked(read.storageObjects).mockResolvedValue([null]); expect((await loadPolicyForSsu(ssu)).policyId).toBeNull();
 vi.mocked(read.storageObjects).mockRejectedValue(Error('unavailable')); await expect(loadPolicyForSsu(ssu)).rejects.toThrow();
});
it.each(['binding','mode','allow','parent','registry'])('rejects malformed policy %s', async bad=>{
 const f=fixture();
 if(bad==='binding')f.policy.fields.ssu_id=id(9);
 if(bad==='mode')f.policy.fields.mode=9;
 if(bad==='allow')(f.policy.fields.allow as any)=[{character_id:id(8),expires_at:'0',can_deposit:'false',can_withdraw:false}];
 if(bad==='parent')f.field.owner.address=id(9);
 if(bad==='registry')f.registry.type=`${id(9)}::ssu_access::SsuPolicyRegistry`;
 await expect(loadPolicyForSsu(ssu)).rejects.toThrow();
});
it('shared discovery never accepts an unverified failed batch',async()=>{
 const f=fixture();vi.mocked(read.storageFields).mockResolvedValue([f.field]);
 vi.mocked(read.storageObjects).mockRejectedValue(Error('unavailable'));
 await expect(discoverSharedSsus({characterObjectId:id(9),ownTribeId:7},new Set())).rejects.toThrow();
});
it('wallet recovery reports failed enumeration rather than no items',async()=>{
 vi.mocked(read.storageOwned).mockRejectedValue(Error('unavailable'));
 await expect(fetchStuckItems(id(9),W)).rejects.toThrow();
});
