import {readStructureSnapshot,fetchSsuSnapshot,loadPolicyForSsu,discoverSharedSsus,readInventoryCharacter,fetchStuckItems,WORLD_PKG} from './read-bundle.mjs';
import {writeFileSync} from 'node:fs';
const wallet='0x9eb4912cc02e0e82c0dec9a97a0b4c5ac3e5fbebc4cde4089cfbc0150e382c33';
const {characterId,structures}=await readStructureSnapshot(wallet),character=await readInventoryCharacter(characterId);
const owned=structures.filter(s=>s.kind==='StorageUnit');
const shared=await discoverSharedSsus({characterObjectId:characterId,ownTribeId:character.tribeId},new Set(owned.map(s=>s.objectId)));
const summary=[];
for(const s of [...owned.map(s=>({id:s.objectId,name:s.displayName,owned:true})),...shared.map(s=>({id:s.ssuObjectId,owned:false}))]) {
 const state=await fetchSsuSnapshot(s.id),policy=await loadPolicyForSsu(s.id);
 summary.push({...s,partitions:state.slots.length,stacks:state.slots.reduce((n,s)=>n+s.items.filter(i=>i.quantity>0).length,0),frozen:state.frozen,policy});
}
const walletItems=await fetchStuckItems(wallet,WORLD_PKG);
const receipt={at:new Date().toISOString(),wallet,characterId,characterTribeId:character.tribeId,summary,storageUnits:summary.length,stacks:summary.reduce((n,s)=>n+s.stacks,0),walletItems:walletItems.length,sharedCount:shared.length};
writeFileSync(new URL('current-read.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
