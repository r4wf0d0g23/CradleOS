// Live reads and unsigned simulations only: no signing or execute API.
import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
import{storageClient as client,storageObject,storageId}from'../../cradleos-dapp/src/lib/storageRead';
import{fetchSsuSnapshot}from'../../cradleos-dapp/src/lib/ssuSafety';
import{buildStorageTransfer,readStoragePolicy,secureStorageExtension}from'../../cradleos-dapp/src/lib/storageAccess';
const d=JSON.parse(readFileSync(new URL('onchain.json',import.meta.url),'utf8'));
const sid='0x573d25ba9bafd0f01de44b81090a5ea2bfac42c6c07a84267a5b95b9e1be18c5',cid='0x753a02cc4a064d09704eb7333fb3bfee41317ee60a094571b85b120c4cea1ce5';
const character=await storageObject(cid),wallet=storageId(character.fields.character_address),evidence:any[]=[];
for(const kind of ['deposit','deposit then withdraw','wrong sender']){
 const state=await fetchSsuSnapshot(sid),policy=await readStoragePolicy(sid,d);assert.ok(policy);assert.ok(secureStorageExtension(state.extension,d));assert.ok(state.extension!.includes(d.originalId.slice(2)));
 const row=state.slots.find(s=>s.partition==='owner_main'&&s.key===state.ownerCapId)?.items.find(i=>i.quantity>0);assert.ok(row);
 const tx=buildStorageTransfer(state,policy,cid,kind==='wrong sender'?d.upgradeCapOwner:wallet,'owner_deposit',[{typeId:row.typeId,quantity:1}],state.ownerCapId,d);
 if(kind==='deposit then withdraw')tx.moveCall({target:`${d.packageId}::storage_access::withdraw`,arguments:[tx.object(sid),tx.object(policy.id),tx.object(cid),tx.pure.u64(row.typeId),tx.pure.u32(1),tx.object('0x6')]});
 const calls=tx.getData().commands.filter(c=>c.$kind==='MoveCall').map(c=>c.MoveCall!.function);assert.ok(!calls.includes('authorize')&&!calls.includes('configure')&&!calls.includes('authorize_extension'));
 tx.setGasOwner(d.upgradeCapOwner);tx.setGasBudget(100000000);
 const simulation=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true,commandResults:true}});const out=simulation.Transaction??simulation.FailedTransaction;
 evidence.push({kind,ssuId:sid,originalBinding:state.extension,existingPolicy:policy.id,policyRevision:policy.revision,ownerCap:state.ownerCapId,typeId:row.typeId,quantity:1,success:out?.status.success,calls,simulation});
 writeFileSync(new URL('owner-flow-simulations.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),submitted:false,signed:false,evidence},(_,v)=>typeof v==='bigint'?v.toString():v,2));
 assert.equal(out?.status.success,kind!=='wrong sender',JSON.stringify(out?.status));
 if(kind==='wrong sender')assert.equal((out?.status.error as any)?.MoveAbort?.location?.functionName,'borrow_owner_cap');
 else {const events=out!.events!;assert.ok(events.some((e:any)=>e.eventType?.endsWith('::storage_access::OwnerDeposit')||e.type?.endsWith('::storage_access::OwnerDeposit')),'OwnerDeposit event absent');}
 console.log(JSON.stringify({kind,success:out?.status.success,submitted:false}));
}
