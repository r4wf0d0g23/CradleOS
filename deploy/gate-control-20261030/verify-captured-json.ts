// Real captured route JSON; metadata/registry links are synthetic for offline reader replay.
import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {GrpcTypes} from '@mysten/sui/grpc';import{readGateRoute,GATE_COIN}from'../../cradleos-dapp/src/lib/gateControl';import{idFieldId,type StorageReadClient}from'../../cradleos-dapp/src/lib/storageRead';
const read=(n:string)=>JSON.parse(readFileSync(new URL(n,import.meta.url),'utf8')),d=read('onchain.json'),bodies=read('raw-route-bodies.json').bodies;
const body=bodies.filter((b:any)=>b.active&&b.activity.length===3).at(-1);assert.ok(body);
const objects=new Map();const put=(objectId:string,objectType:string,json:any,owner:any={kind:'SHARED',version:'1'})=>objects.set(objectId,{objectId,objectType,version:'1',owner,json});
put(body.id,`${d.originalId}::route::Route<${GATE_COIN}>`,body);
put(d.registryId,`${d.originalId}::route::Registry`,{id:d.registryId,routes:{id:d.routesTable,size:'2'},history:{id:d.historyTable,size:'1'}});
for(const gate of [body.gate_a,body.gate_b]){const id=idFieldId(d.routesTable,gate);put(id,'0x2::dynamic_field::Field<0x2::object::ID,0x2::object::ID>',{id,name:gate,value:body.id},{kind:'OBJECT',address:d.routesTable});}
const hid=idFieldId(d.historyTable,body.id);put(hid,'0x2::dynamic_field::Field<0x2::object::ID,bool>',{id:hid,name:body.id,value:true},{kind:'OBJECT',address:d.historyTable});
const api={ledgerService:{batchGetObjects:({requests}:any)=>({response:Promise.resolve({objects:requests.map(({objectId}:any)=>({result:objects.has(objectId)?{oneofKind:'object',object:GrpcTypes.Object.fromJson(objects.get(objectId))}:{oneofKind:'error',error:{code:5,message:'Fixture not found'}}}))})})}} as unknown as StorageReadClient;
const r=await readGateRoute(body.id,d,api);assert.equal(r.permitsIssued,'2');assert.equal(r.passesSold,'1');assert.equal(r.activity.length,3);assert.equal(r.proceeds,'0');assert.equal(r.rates.passDuration,3600000);assert.equal(r.rules.mode,4);
const receipt={at:new Date().toISOString(),pass:true,actualGrpcRouteBody:true,registryMetadataFixtures:true,productionReader:'readGateRoute',signed:false,submitted:false,networkRequests:0};writeFileSync(new URL('captured-json-reader.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
