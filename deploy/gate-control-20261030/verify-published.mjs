import {effectBytes,publicationScope} from './publication-scope.mjs';
// Read-only package/registry/custody verification. Run before frontend pinning.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../cradleos-dapp/package.json',import.meta.url));
const { SuiGrpcClient, GrpcTypes }=require('@mysten/sui/grpc');
const dir=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,dir)));
const save=(n,v)=>writeFileSync(new URL(n,dir),JSON.stringify(v,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
const c=new SuiGrpcClient({network:'testnet',baseUrl:'https://fullnode.testnet.sui.io:443'});
assert.equal((await c.core.getChainIdentifier()).chainIdentifier,'69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD');
const result=read('publication.json').Transaction;assert.ok(result.status.success);
assert.equal(result.digest,read('publish-pending.json').digest);
const confirmed=await c.core.getTransaction({digest:result.digest,include:{effects:true,objectTypes:true}});
assert.equal(confirmed.Transaction?.digest,result.digest);assert.ok(confirmed.Transaction?.status.success);
assert.deepEqual(confirmed.Transaction.objectTypes,result.objectTypes);
assert.deepEqual(effectBytes(confirmed.Transaction),effectBytes(result),"Independently confirmed effects differ");
const scope=publicationScope(confirmed.Transaction,read("custody.json").publisher);
assert.equal(scope.effects.transactionDigest,result.digest);
// SDK objectTypes records all newly published/created types from execution.
const types=result.objectTypes;
assert.ok(types && typeof types==='object');
const registries=Object.entries(types).filter(([,t])=>t.endsWith('::route::Registry'));
const caps=Object.entries(types).filter(([,t])=>/^0x0*2::package::UpgradeCap$/.test(t));
assert.equal(registries.length,1);assert.equal(caps.length,1);
const [registryId,registryType]=registries[0], [upgradeCap]=caps[0], packageId=registryType.split('::')[0];
const publisher=read('custody.json').publisher;
const get=async id=>(await c.ledgerService.getObject({objectId:id,readMask:{paths:['object_id','owner','json','object_type','package']}}).response).object;
const [pkg,reg,cap]=await Promise.all([get(packageId),get(registryId),get(upgradeCap)]);
assert.equal(cap.owner.address,publisher);assert.equal(cap.owner.kind,1);
assert.equal(GrpcTypes.Object.toJson(cap).json.package,packageId);
assert.equal(reg.objectType,`${packageId}::route::Registry`);assert.equal(reg.owner.kind,3);
const fields=GrpcTypes.Object.toJson(reg).json;assert.equal(Number(fields.routes.size),0);assert.equal(Number(fields.history.size),0);assert.deepEqual([fields.routes.id,fields.history.id].sort(),scope.tableIds.sort());
for (const parent of [fields.routes.id,fields.history.id]) {
const table=await c.stateService.listDynamicFields({parent,pageSize:100}).response;
assert.equal(table.dynamicFields.length,0);assert.ok(!table.nextPageToken?.length);
}
assert.equal(pkg.package.modules.length,1);assert.equal(pkg.package.modules[0].name,'route');
const live=Buffer.from(pkg.package.modules[0].contents),local=Buffer.from(read('package-build.json').modules[0],'base64'), normalized=Buffer.from(live), address=Buffer.from(packageId.slice(2),'hex');
let count=0;for(let at=normalized.indexOf(address);at!==-1;at=normalized.indexOf(address,at+32)){normalized.fill(0,at,at+32);count++;}
assert.equal(count,1,'Unexpected self-address table');assert.deepEqual(normalized,local,'Published bytecode differs from reviewed bytecode');
const sha=b=>createHash('sha256').update(b).digest('hex');
const out={at:new Date().toISOString(),packageId,originalId:packageId,registryId,upgradeCap,publisher,upgradeCapOwner:cap.owner.address,publishDigest:result.digest,sourceCommit:read('publish-pending.json').source,sourceTag:'publish/cradleos-gate-2026-10-30-reviewed',worldId:read('package-build.json').dependencies.find(p=>!/^0x0+[12]$/.test(p)),registryType,routesTable:fields.routes.id,historyTable:fields.history.id,routeCount:0,registryReadSucceeded:true,normalizedBytecodeExact:true,compiledSha256:sha(local),liveSha256:sha(live),abiSource:'Full ABI identical because all relocated bytecode matches exactly',gateWrites:scope.gateWrites,changedExistingObjects:scope.changedExistingObjects,independentlyConfirmedEffectsExact:true};
save('onchain.json',out);
save('published-package.json',GrpcTypes.Object.toJson(pkg));
console.log(JSON.stringify(out));
