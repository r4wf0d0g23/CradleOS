import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
import{readStructureSnapshot as before}from'before-structure-read';
import{readStructureSnapshot}from'../../cradleos-dapp/src/lib/structureRead';
const wallet='0x29a4be9bf591d1409319b4f763b041a82f64225bc4868cf86875f834833bd676';
let previousError='';try{await before(wallet)}catch(e){previousError=String(e)}assert.match(previousError,/unavailable/);
const fixed=await readStructureSnapshot(wallet),control=await readStructureSnapshot('0x9eb4912cc02e0e82c0dec9a97a0b4c5ac3e5fbebc4cde4089cfbc0150e382c33');
assert.equal(fixed.structures.length,31);const empty=fixed.structures.find(s=>s.objectId==='0xc4c9f9345e3ef413dff95d8820132b245ddd93bce29559be4beab0e967c67e51');assert.ok(empty);assert.equal(empty.fuelLevelPct,0);assert.equal(empty.runtimeHoursRemaining,0);assert.equal(empty.isOnline,false);assert.ok(control.structures.length>=139);
const receipt={at:new Date().toISOString(),wallet,previousError,characterId:fixed.characterId,count:fixed.structures.length,kinds:fixed.structures.reduce((a:any,s)=>(a[s.kind]=(a[s.kind]??0)+1,a),{}),emptyNode:empty,control:{wallet:'0x9eb4912cc02e0e82c0dec9a97a0b4c5ac3e5fbebc4cde4089cfbc0150e382c33',count:control.structures.length},submitted:false};
writeFileSync(new URL('live-read.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
