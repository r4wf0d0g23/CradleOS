// Actual live reads and unsigned simulation only; no signer/execution API.
import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
import{storageClient as client,storageObject,storageId}from'../../cradleos-dapp/src/lib/storageRead';
import{fetchSsuSnapshot}from'../../cradleos-dapp/src/lib/ssuSafety';
import{buildStorageTransfer,readStoragePolicy}from'../../cradleos-dapp/src/lib/storageAccess';
const d=JSON.parse(readFileSync(new URL('../storage-owner-deposit-20261029/onchain.json',import.meta.url),'utf8'));
const sid='0x573d25ba9bafd0f01de44b81090a5ea2bfac42c6c07a84267a5b95b9e1be18c5',cid='0x753a02cc4a064d09704eb7333fb3bfee41317ee60a094571b85b120c4cea1ce5';
const state=await fetchSsuSnapshot(sid),policy=await readStoragePolicy(sid,d),character=await storageObject(cid);assert.ok(policy);
const owner=state.slots.find(s=>s.partition==='owner_main'&&s.key===state.ownerCapId),personal=state.slots.find(s=>s.partition==='unknown'&&s.key===storageId(character.fields.owner_cap_id));
const candidate=owner&&owner.items.filter(i=>i.quantity>0).length>=2?{direction:'owner_deposit' as const,slot:owner,cap:state.ownerCapId}:personal&&personal.items.filter(i=>i.quantity>0).length>=2?{direction:'deposit' as const,slot:personal,cap:personal.key}:null;
const evidence:any={at:new Date().toISOString(),ssuId:sid,packageId:d.packageId,originalBinding:state.extension,ownerStacks:owner?.items.filter(i=>i.quantity>0).length??0,personalStacks:personal?.items.filter(i=>i.quantity>0).length??0,sharedStacks:state.slots.find(s=>s.partition==='open')?.items.length??0,submitted:false,signed:false};
if(candidate){const rows=candidate.slot.items.filter(i=>i.quantity>0).slice(0,2).map(i=>({typeId:i.typeId,quantity:1}));const tx=buildStorageTransfer(state,policy,cid,storageId(character.fields.character_address),candidate.direction,rows,candidate.cap,d);tx.setGasOwner(d.upgradeCapOwner);tx.setGasBudget(100000000);
 const simulation=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true}});const out=simulation.Transaction??simulation.FailedTransaction;
 Object.assign(evidence,{direction:candidate.direction,rows,simulation,success:out?.status.success});
 writeFileSync(new URL('live-batch.json',import.meta.url),JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2));assert.equal(out?.status.success,true,JSON.stringify(out?.status));
}else{evidence.simulationUnavailable='Fewer than two caller-owned stacks; no stock seeded or moved.';writeFileSync(new URL('live-batch.json',import.meta.url),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify({...evidence,simulation:undefined}));
