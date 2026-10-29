// Unsigned checks against live objects only. No signing or execute API exists here.
import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Transaction } from '@mysten/sui/transactions';
import { storageClient as client,storageObject,storageId } from '../../cradleos-dapp/src/lib/storageRead';
import { fetchSsuSnapshot,SSU_TYPE } from '../../cradleos-dapp/src/lib/ssuSafety';
import { buildStorageConfiguration,CLOSED_RULES } from '../../cradleos-dapp/src/lib/storageAccess';
import { WORLD_PKG } from '../../cradleos-dapp/src/constants';
const d=JSON.parse(readFileSync(new URL('onchain.json',import.meta.url),'utf8'));
const before=JSON.parse(readFileSync(new URL('live-before.json',import.meta.url),'utf8'));
const evidence:any[]=[];
async function simulate(label:string,tx:Transaction,want:boolean){
 tx.setGasOwner(d.publisher);tx.setGasBudget(100000000);
 const r=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true,commandResults:true}});
 const outcome=r.Transaction??r.FailedTransaction;
 evidence.push({label,success:outcome?.status.success,error:outcome?.status.error??null,simulation: r});
 writeFileSync(new URL('owner-flow-simulations.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),unsigned:true,submitted:false,evidence},(_,v)=>typeof v==='bigint'?v.toString():v,2));
 assert.equal(outcome?.status.success,want,`${label}: ${JSON.stringify(outcome?.status)}`);
 if(!want){assert.equal((outcome?.status.error as any)?.MoveAbort?.cleverError?.constantName,'ESenderCannotAccessCharacter');assert.equal((outcome?.status.error as any)?.MoveAbort?.location?.functionName,'borrow_owner_cap');}
 console.log(JSON.stringify({label,success:outcome?.status.success,expected:want,error:outcome?.status.error??null}));
}
for(const target of [before.target,...before.legacyAdopters]){
 const sid=target.ssuId,cid=target.characterId??target.ownerCharacter;
 const character=await storageObject(cid), wallet=storageId(character.fields.character_address);
 let state=await fetchSsuSnapshot(sid);
 const tx=buildStorageConfiguration(state,null,CLOSED_RULES,cid,state.ownerCapId,wallet,true,d);
 await simulate(`owner atomic closed configuration ${sid}`,tx,true);
 state=await fetchSsuSnapshot(sid);
 const denied=buildStorageConfiguration(state,null,CLOSED_RULES,cid,state.ownerCapId,d.publisher,true,d);
 await simulate(`wrong sender cannot borrow SSU cap ${sid}`,denied,false);
}
const target=before.target, cid=target.characterId,character=await storageObject(cid),wallet=storageId(character.fields.character_address),charCap=storageId(character.fields.owner_cap_id);
let state=await fetchSsuSnapshot(target.ssuId);
let row=state.slots.find(s=>s.key===charCap)?.items.find(i=>i.quantity>0);
// This owner currently has no personal stock. If needed, seed ONE item from
// owner-main into owner-personal ONLY INSIDE THIS UNSIGNED SIMULATION using the
// official owner cap + temporary native extension. This is fixture preparation,
// never part of the product transaction or any broadcast. Then replace the
// temporary extension with the real private-witness extension before testing it.
const simulatedSeed=!row;
if(simulatedSeed) row=state.slots.find(s=>s.partition==='owner_main')?.items.find(i=>i.quantity>0);
assert.ok(row,'Need current stock for simulation fixture');
console.log(JSON.stringify({roundtripSsu:state.id,simulatedSeed,submitted:false}));
const tx=new Transaction();tx.setSender(wallet);
const [cap,receipt]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[SSU_TYPE],arguments:[tx.object(cid),tx.object(state.ownerCapId)]});
const [cc,cr]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[`${WORLD_PKG}::character::Character`],arguments:[tx.object(cid),tx.object(charCap)]});
if(simulatedSeed){
 tx.moveCall({target:`${WORLD_PKG}::storage_unit::authorize_extension`,typeArguments:['u8'],arguments:[tx.object(state.id),cap]});
 const [item]=tx.moveCall({target:`${WORLD_PKG}::storage_unit::withdraw_by_owner`,typeArguments:[SSU_TYPE],arguments:[tx.object(state.id),tx.object(cid),cap,tx.pure.u64(row.typeId),tx.pure.u32(1)]});
 tx.moveCall({target:`${WORLD_PKG}::storage_unit::deposit_to_owned`,typeArguments:['u8'],arguments:[tx.object(state.id),tx.object(cid),item,tx.pure.u8(0)]});
}
const [policy]=tx.moveCall({target:`${d.packageId}::storage_access::create_policy`,arguments:[tx.object(d.registryId),tx.object(state.id),cap]});
function configure(mode:number,revision:number){tx.moveCall({target:`${d.packageId}::storage_access::configure`,arguments:[policy,cap,tx.pure.u64(revision),tx.pure.u8(mode),tx.pure.vector('u32',[]),tx.pure.vector('address',[]),tx.pure.vector('address',[]),tx.pure.vector('u64',[]),tx.pure.vector('bool',[]),tx.pure.vector('bool',[])]});}
configure(4,0);
tx.moveCall({target:`${d.packageId}::storage_access::authorize`,arguments:[policy,tx.object(state.id),cap]});
const deposit=()=>tx.moveCall({target:`${d.packageId}::storage_access::deposit`,arguments:[tx.object(state.id),policy,tx.object(cid),cc,tx.pure.u64(row.typeId),tx.pure.u32(1),tx.object('0x6')]});
deposit();
tx.moveCall({target:`${d.packageId}::storage_access::withdraw`,arguments:[tx.object(state.id),policy,tx.object(cid),tx.pure.u64(row.typeId),tx.pure.u32(1),tx.object('0x6')]});
deposit();configure(0,1);
tx.moveCall({target:`${d.packageId}::storage_access::recover_shared`,arguments:[tx.object(state.id),cap,tx.object(cid),tx.pure.u64(row.typeId),tx.pure.u32(1)]});
tx.moveCall({target:`${d.packageId}::storage_access::revision`,arguments:[policy]});
tx.moveCall({target:`${d.packageId}::storage_access::permits`,arguments:[policy,tx.pure.id(cid),tx.pure.u32(1),tx.pure.u64(Date.now()),tx.pure.bool(true)]});
tx.moveCall({target:`${d.packageId}::storage_access::policy_id`,arguments:[tx.object(d.registryId),tx.pure.id(state.id)]});
tx.moveCall({target:`${d.packageId}::storage_access::share_policy`,arguments:[policy]});
tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[`${WORLD_PKG}::character::Character`],arguments:[tx.object(cid),cc,cr]});
tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[SSU_TYPE],arguments:[tx.object(cid),cap,receipt]});
await simulate('all public functions: new policy, public deposit/withdraw, closed owner recovery (live objects, simulation-only personal-stock seed, unsigned)',tx,true);
const reg=await storageObject(d.registryId);assert.equal(Number(reg.fields.policies.size),0);
console.log(JSON.stringify({registryStillEmpty:true,realTransactions:0,simulations:evidence.length}));
