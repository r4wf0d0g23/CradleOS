import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(new URL('../../cradleos-dapp/package.json',import.meta.url));const{bcs}=require('@mysten/sui/bcs');
export function effectBytes(t){const raw=t.effects.bcs;if(raw instanceof Uint8Array)return raw;assert.ok(raw&&typeof raw==='object');const keys=Object.keys(raw).sort((a,b)=>Number(a)-Number(b));assert.deepEqual(keys,keys.map((_,i)=>String(i)));return Uint8Array.from(keys.map(k=>raw[k]));}
export function publicationScope(t,publisher){const e=bcs.TransactionEffects.parse(effectBytes(t)).V2;assert.ok(e&&e.status.$kind==='Success');const types=t.objectTypes;
 const reg=Object.entries(types).filter(([,v])=>v.endsWith('::route::Registry')),pkg=Object.entries(types).filter(([,v])=>v==='package'),cap=Object.entries(types).filter(([,v])=>/^0x0*2::package::UpgradeCap$/.test(v));
 assert.equal(reg.length,1);assert.equal(pkg.length,1);assert.equal(cap.length,1);assert.equal(reg[0][1],`${pkg[0][0]}::route::Registry`);
 const gas=e.changedObjects[e.gasObjectIndex],persistent=e.changedObjects.filter(([,v])=>v.inputState.$kind==='NotExist'&&v.outputState.$kind!=='NotExist'),existing=e.changedObjects.filter(([,v])=>v.inputState.$kind!=='NotExist');
 assert.equal(existing.length,1);assert.equal(existing[0][0],gas[0]);assert.match(types[gas[0]],/^0x0*2::coin::Coin<0x0*2::sui::SUI>$/);assert.equal(gas[1].inputState.Exist[1].AddressOwner,publisher);assert.equal(gas[1].outputState.ObjectWrite[1].AddressOwner,publisher);
 assert.deepEqual(persistent.map(([id])=>id).sort(),[reg[0][0],pkg[0][0],cap[0][0]].sort());assert.ok(persistent.every(([,v])=>v.idOperation.$kind==='Created'));
 assert.deepEqual(Object.keys(types).sort(),[gas[0],...persistent.map(([id])=>id)].sort());
 const ephemeral=e.changedObjects.filter(([,v])=>v.inputState.$kind==='NotExist'&&v.outputState.$kind==='NotExist');assert.equal(ephemeral.length,2);assert.ok(ephemeral.every(([,v])=>v.idOperation.$kind==='Created'));
 assert.equal(e.unchangedConsensusObjects.length,0);
 return {registryId:reg[0][0],packageId:pkg[0][0],upgradeCap:cap[0][0],gasId:gas[0],tableIds:ephemeral.map(([id])=>id),changedExistingObjects:1,gateWrites:0,effects:e};
}
