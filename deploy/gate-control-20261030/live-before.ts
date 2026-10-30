// Read-only production evidence; no signer or transaction execution.
import { readFileSync,writeFileSync } from 'node:fs';
import { readStructureSnapshot } from '../../cradleos-dapp/src/lib/structureRead';
import { readGatePair,readGate,verifyGatePairHistory } from '../../cradleos-dapp/src/lib/gateControl';
import { storageObject } from '../../cradleos-dapp/src/lib/storageRead';
const prior=JSON.parse(readFileSync(new URL('../storefront-20261029/live-before.json',import.meta.url),'utf8'));
const wallet=prior.candidate.wallet,snapshot=await readStructureSnapshot(wallet);
const gates=snapshot.structures.filter(s=>s.kind==='Gate');
const evidence:any={at:new Date().toISOString(),wallet,characterId:snapshot.characterId,gateCount:gates.length,gates:[],submitted:false};
for(const g of gates){
  const gate=await readGate(g.objectId);const row:any={gate,raw:await storageObject(g.objectId)};
  if(gate.linkedGateId){const p=await readGatePair(g.objectId,null);row.peer=p.b;
    row.bothOwned=gates.some(s=>s.objectId===p.b.id);
    try{await verifyGatePairHistory(p,null);row.cleanHistory=true;}catch(e){row.cleanHistory=false;row.historyError=String(e);}
  }
  evidence.gates.push(row);
}
writeFileSync(new URL('live-before.json',import.meta.url),JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2));
console.log(JSON.stringify({gateCount:gates.length,candidates:evidence.gates.map((g:any)=>({id:g.gate.id,linked:!!g.peer,ownedPair:g.bothOwned,clean:g.cleanHistory,error:g.historyError})),submitted:false}));
