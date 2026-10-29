// Unsigned simulation, never execute/sign. Actual live stock, no seeding.
import {writeFileSync} from 'node:fs';
import {Transaction} from '@mysten/sui/transactions';
import {storageClient as client,storageObject} from '../../cradleos-dapp/src/lib/storageRead';
import {fetchSsuSnapshot,SSU_TYPE} from '../../cradleos-dapp/src/lib/ssuSafety';
import {WORLD_PKG} from '../../cradleos-dapp/src/constants';
const sid='0xda43c01a71b703083b3196985e821169c7093a7687fee47498fedf143e7247ed',cid='0x753a02cc4a064d09704eb7333fb3bfee41317ee60a094571b85b120c4cea1ce5';
const character=await storageObject(cid),state=await fetchSsuSnapshot(sid),personalCap=character.fields.owner_cap_id;
const rows=state.slots.find(s=>s.key===personalCap)!.items.filter(i=>i.quantity>0),tx=new Transaction();
tx.setSender(character.fields.character_address);tx.setGasBudget(100000000);
const characterType=`${WORLD_PKG}::character::Character`;
const [pc,pr]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[characterType],arguments:[tx.object(cid),tx.object(personalCap)]});
const [sc,sr]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[SSU_TYPE],arguments:[tx.object(cid),tx.object(state.ownerCapId)]});
for(const row of rows){
 const item=tx.moveCall({target:`${WORLD_PKG}::storage_unit::withdraw_by_owner`,typeArguments:[characterType],arguments:[tx.object(sid),tx.object(cid),pc,tx.pure.u64(row.typeId),tx.pure.u32(row.quantity)]});
 tx.moveCall({target:`${WORLD_PKG}::storage_unit::deposit_by_owner`,typeArguments:[SSU_TYPE],arguments:[tx.object(sid),item,tx.object(cid),sc]});
}
for(const [type,cap,receipt] of [[characterType,pc,pr],[SSU_TYPE,sc,sr]] as const)tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[type],arguments:[tx.object(cid),cap,receipt]});
const result=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true,commandResults:true}});
const r={at:new Date().toISOString(),signed:false,submitted:false,ssuId:sid,rows,tx:tx.getData(),result};
writeFileSync(new URL('recovery-simulation.json',import.meta.url),JSON.stringify(r,(_,v)=>typeof v==='bigint'?v.toString():v,2));
console.log(JSON.stringify({status:(result.Transaction??result.FailedTransaction)?.status,rows:rows.length,events:(result.Transaction??result.FailedTransaction)?.events?.map(e=>({type:e.eventType,json:e.json})),submitted:false}));
