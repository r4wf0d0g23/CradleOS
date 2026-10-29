import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {Transaction} from '@mysten/sui/transactions';
import {storageClient as client,storageObject} from '../../cradleos-dapp/src/lib/storageRead';
import {fetchSsuSnapshot} from '../../cradleos-dapp/src/lib/ssuSafety';
import {buildOwnerStorageTransfer} from '../../cradleos-dapp/src/lib/storageOwnerRouting';
import {readStoragePolicy} from '../../cradleos-dapp/src/lib/storageAccess';
import {STORAGE_ACCESS_DEPLOYMENT as d} from '../../cradleos-dapp/src/lib/storageAccessDeployment';
const sid='0xda43c01a71b703083b3196985e821169c7093a7687fee47498fedf143e7247ed',cid='0x753a02cc4a064d09704eb7333fb3bfee41317ee60a094571b85b120c4cea1ce5';
const evidence=[];
for(const kind of ['personal_to_owner','wrong_sender','owner_withdraw','owner_recover'] as const){
 const character=await storageObject(cid),state=await fetchSsuSnapshot(sid),policy=await readStoragePolicy(sid),pc=character.fields.owner_cap_id,wallet=character.fields.character_address;
 const own=state.slots.find(s=>s.key===pc)!,rows=own.items.filter(i=>i.quantity>0);
 assert.equal(rows.length,13);
 const preparing=kind==='owner_withdraw'||kind==='owner_recover';
 const projected=structuredClone(state),selected=preparing?[{typeId:rows[0].typeId,quantity:1}]:rows.map(i=>({typeId:i.typeId,quantity:i.quantity}));
 if(preparing){const slot=projected.slots.find(s=>s.partition==='open')!;slot.items=[{...rows[0],quantity:1,partition:'open',partitionKey:slot.key}];slot.used=rows[0].volume;}
 let tx=buildOwnerStorageTransfer(projected,policy,cid,kind==='wrong_sender'?'0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a':wallet,preparing?kind:'personal_to_owner',selected,state.ownerCapId,pc);
 if(preparing){
  // Simulate a legitimate personal deposit before this builder's shared withdrawal.
  // No admin mint, signing or live stock changes. Reuse its single borrowed cap.
  const data=tx.getData();const sharedCall=data.commands[2].MoveCall!;
  const args=sharedCall.arguments;
  const obj=(id:string)=>{id='0x'+id.slice(2).padStart(64,'0');let n=data.inputs.findIndex((i:any)=>i.UnresolvedObject?.objectId===id);if(n<0){n=data.inputs.length;data.inputs.push({$kind:'UnresolvedObject',UnresolvedObject:{objectId:id}} as any)}return {$kind:'Input',Input:n,type:'object'} as any};
  const typeArg=args[kind==='owner_recover'?3:3],qtyArg=args[4];
  for(const c of data.commands)if(c.MoveCall)for(const a of c.MoveCall.arguments){if(a.$kind==='Result'&&a.Result>=2)a.Result++;if(a.$kind==='NestedResult'&&a.NestedResult[0]>=2)a.NestedResult[0]++;}
  data.commands.splice(2,0,{$kind:'MoveCall',MoveCall:{package:d!.packageId,module:'storage_access',function:'deposit',typeArguments:[],arguments:[obj(sid),obj(policy!.id),obj(cid),{$kind:'NestedResult',NestedResult:[0,0]},typeArg,qtyArg,obj('0x6')]}} as any);
  tx=Transaction.from(JSON.stringify(data));
 }
 tx.setGasOwner(wallet);tx.setGasBudget(100000000);
 const result=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true}}),out=result.Transaction??result.FailedTransaction;
 assert.equal(out?.status.success,kind!=='wrong_sender',JSON.stringify(out?.status));
 if(kind!=='wrong_sender')for(const row of selected){const deposits=out!.events!.filter(e=>e.eventType.endsWith('::ItemDepositedEventV2')&&e.json?.inventory_key===state.ownerCapId&&e.json?.type_id===String(row.typeId));assert.equal(deposits.length,1);assert.equal(deposits[0].json?.quantity,row.quantity);}
 evidence.push({kind,at:new Date().toISOString(),preparatoryPersonalDepositSimulated:preparing,rows:selected,transaction:tx.getData(),result});
 console.log(JSON.stringify({kind,success:out?.status.success,rows:selected.length,submitted:false}));
}
writeFileSync(new URL('builder-simulations.json',import.meta.url),JSON.stringify({signed:false,submitted:false,evidence},(_,v)=>typeof v==='bigint'?v.toString():v,2));
