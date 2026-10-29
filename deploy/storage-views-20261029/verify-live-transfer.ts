// Unsigned simulation only. Uses real deposited stock; no signer or execution.
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fetchSsuSnapshot} from '../../cradleos-dapp/src/lib/ssuSafety';
import {readStoragePolicy,storagePermits,buildStorageTransfer} from '../../cradleos-dapp/src/lib/storageAccess';
import {storageClient,storageObject,storageId} from '../../cradleos-dapp/src/lib/storageRead';
const sid='0x573d25ba9bafd0f01de44b81090a5ea2bfac42c6c07a84267a5b95b9e1be18c5';
const sponsor=JSON.parse(readFileSync(new URL('../storage-config-20261029/onchain.json',import.meta.url))).publisher;
const results=[];
const snapshot=await fetchSsuSnapshot(sid),policy=await readStoragePolicy(sid);assert.ok(policy);
for(const slot of snapshot.slots.filter(s=>s.partition==='unknown'&&s.items.some(i=>i.quantity>0))){
 const cap=await storageObject(slot.key),cid=storageId(cap.fields.authorized_object_id),c=await storageObject(cid),wallet=storageId(c.fields.character_address);
 if(!storagePermits(policy.rules,cid,Number(c.fields.tribe_id),false))continue;
 const state=await fetchSsuSnapshot(sid),row=slot.items.find(i=>i.quantity>0)!;
 const tx=buildStorageTransfer(state,policy,cid,wallet,'deposit',[{typeId:row.typeId,quantity:1}],slot.key);
 tx.setGasOwner(sponsor);tx.setGasBudget(100000000);
 const r=await storageClient.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true}});
 const result=r.Transaction??r.FailedTransaction;
 results.push({label:'exact one-item personal -> shared, real deposited stock',success:result.status.success,error:result.status.error??null});
 assert.equal(result.status.success,true,JSON.stringify(result.status));
 break;
}
assert.equal(results.length,1,'No eligible actual personal stock');
const out={at:new Date().toISOString(),unsigned:true,submitted:false,stockSeeded:false,results};
writeFileSync(new URL('live-transfer-simulation.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out));
