// Public chain read-only candidate selection; never signs or submits.
import {readFileSync,writeFileSync} from 'node:fs';
import {readGatePair,readGateCharacter,verifyGatePairHistory,assertGateOwner} from '../../cradleos-dapp/src/lib/gateControl';
import {gateGraph} from '../../cradleos-dapp/src/lib/gateHistory';
import {storageObject} from '../../cradleos-dapp/src/lib/storageRead';
const rows=[];
const recent=JSON.parse(readFileSync(new URL('recent-gates.json',import.meta.url),'utf8')).events.nodes.map(n=>n.contents.json.assembly_id).reverse();
for(const id of recent){
 try{const pair=await readGatePair(id,null);const caps=await Promise.all([storageObject(pair.a.ownerCapId),storageObject(pair.b.ownerCapId)]);
 if(![1,2].includes(caps[0].owner.kind??0)||caps[0].owner.address!==caps[1].owner.address)throw Error('Different cap controllers');
 const character=await readGateCharacter(caps[0].owner.address);await assertGateOwner(pair,character,character.address);await verifyGatePairHistory(pair,null);
 const row={pair,character,caps,clean:true};rows.push(row);console.log(JSON.stringify({id,clean:true,online:pair.a.online&&pair.b.online}));
 if(pair.a.online&&pair.b.online)break;
 }catch(e){console.log(JSON.stringify({id,error:String(e)}));}
}
writeFileSync(new URL('live-candidate.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),candidate:rows.find(r=>r.pair.a.online&&r.pair.b.online)??rows[0],submitted:false},null,2));
