// UNSIGNED, checks-enabled live-world simulation only. No keystore, signer or execute.
import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {GrpcTypes} from '@mysten/sui/grpc';
import {Transaction,coinWithBalance} from '@mysten/sui/transactions';
import {storageClient as client,storageObject} from '../../cradleos-dapp/src/lib/storageRead';
import {readGatePair,verifyGatePairHistory,assertGateOwner,buildGateAction,discoverGateRoutes,GATE_TYPE,GATE_COIN} from '../../cradleos-dapp/src/lib/gateControl';
import {WORLD_PKG,ENERGY_CONFIG} from '../../cradleos-dapp/src/constants';
const d=JSON.parse(readFileSync(new URL('onchain.json',import.meta.url),'utf8'));
const candidate=JSON.parse(readFileSync(new URL('live-candidate.json',import.meta.url),'utf8')).candidate;
const c=candidate.character,pair=await readGatePair(candidate.pair.a.id,null),a=pair.a,b=pair.b,evidence:any[]=[];
await assertGateOwner(pair,c,c.address);await verifyGatePairHistory(pair,null);
async function simulate(label:string,tx:Transaction,want:boolean,abort?:string){tx.setGasOwner(d.publisher);tx.setGasBudget(100000000);
 const out=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true,commandResults:true}});const r=out.Transaction??out.FailedTransaction;
 evidence.push({label,want,success:r?.status.success,simulation:out});writeFileSync(new URL('live-flows.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),signed:false,submitted:false,evidence},(_,v)=>typeof v==='bigint'?v.toString():v,2));
 assert.equal(r?.status.success,want,JSON.stringify(r?.status));if(abort)assert.equal((r?.status.error as any)?.MoveAbort?.location?.functionName,abort);console.log(JSON.stringify({label,success:r?.status.success,submitted:false}));
}
const activation=buildGateAction(pair,{kind:'activate',name:'Unsigned proof'},c,c.address,d);await simulate('production activation builder',activation,true);
const wrong=buildGateAction(pair,{kind:'activate',name:'Unsigned proof'},c,c.address,d);wrong.setSender(d.publisher);await simulate('wrong wallet cannot borrow gate caps',wrong,false,'borrow_owner_cap');
function flow(kind:string){const tx=new Transaction();tx.setSender(c.address);const coin=kind==='eve-free'?GATE_COIN:kind.startsWith('eve')?GATE_COIN:'0x2::sui::SUI';const amount=kind==='eve-free'?0:1;
const target=(n:string)=>`${d.packageId}::route::${n}` as `${string}::${string}::${string}`;
const char=tx.object(c.id),ga=tx.object(a.id),gb=tx.object(b.id),reg=tx.object(d.registryId),clock=tx.object('0x6');
const[ca,ra]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[GATE_TYPE],arguments:[char,tx.object(a.ownerCapId)]});
const[cb,rb]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[GATE_TYPE],arguments:[char,tx.object(b.ownerCapId)]});
const[r]=tx.moveCall({target:target('create'),typeArguments:[coin],arguments:[reg,ga,gb,ca,cb,tx.pure.string('Unsigned proof')]});
const[ru]=tx.moveCall({target:target('rules'),arguments:[tx.pure.u8(4),tx.pure.u32(c.tribe),tx.pure.vector('u32',[]),tx.pure.vector('address',[]),tx.pure.vector('u32',[]),tx.pure.vector('address',[]),tx.pure.u64(0),tx.pure.u64(0),tx.pure.u64(0),tx.pure.u64(0)]});
const[rt]=tx.moveCall({target:target('rates'),arguments:[tx.pure.u64(amount),tx.pure.u64(amount),tx.pure.u64(3600000),tx.pure.u64(0)]});
tx.moveCall({target:target('configure'),typeArguments:[coin],arguments:[r,ca,cb,tx.pure.u64(0),tx.pure.string('Unsigned proof'),ru,rt]});
tx.moveCall({target:target('set_locked'),typeArguments:[coin],arguments:[r,ca,cb,tx.pure.u64(1),tx.pure.bool(false)]});
const pay=(n:number)=>n===0?tx.moveCall({target:'0x2::coin::zero',typeArguments:[coin]})[0]:coin===GATE_COIN?coinWithBalance({type:coin,balance:BigInt(n),useGasCoin:false}):tx.splitCoins(tx.gas,[tx.pure.u64(n)])[0];
tx.moveCall({target:target('request_permit'),typeArguments:[coin],arguments:[reg,r,ga,gb,char,tx.pure.u64(kind==='stale'?1:2),pay(kind==='underpayment'?0:amount),clock]});
if(!['stale','underpayment'].includes(kind)){
 tx.moveCall({target:target('buy_pass'),typeArguments:[coin],arguments:[reg,r,ga,gb,char,tx.pure.u64(2),pay(amount),clock]});
 tx.moveCall({target:target('request_permit'),typeArguments:[coin],arguments:[reg,r,ga,gb,char,tx.pure.u64(2),pay(0),clock]});
 tx.moveCall({target:target('claim'),typeArguments:[coin],arguments:[r,ca,cb]});
 tx.moveCall({target:target('lockdown'),typeArguments:[coin],arguments:[r,ga,gb,ca,cb,tx.object(a.parentId!),tx.object(ENERGY_CONFIG),tx.pure.u64(2)]});
 if(kind==='locked')tx.moveCall({target:target('request_permit'),typeArguments:[coin],arguments:[reg,r,ga,gb,char,tx.pure.u64(3),pay(0),clock]});
 tx.moveCall({target:target('deactivate'),typeArguments:[coin],arguments:[reg,r,ga,gb,ca,cb,tx.pure.u64(3)]});
 tx.moveCall({target:target('claim'),typeArguments:[coin],arguments:[r,ca,cb]});
}
tx.moveCall({target:target('share'),typeArguments:[coin],arguments:[r]});
for(const[cap,receipt]of[[ca,ra],[cb,rb]])tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[GATE_TYPE],arguments:[char,cap,receipt]});return tx;}
await simulate('current EVE free permit pass lockdown deactivate and claim',flow('eve-free'),true);
await simulate('paid permit pass zero-fee subsequent permit and proceeds',flow('sui-paid'),true);
await simulate('underpayment rejected',flow('underpayment'),false,'request_permit');
await simulate('stale revision rejected',flow('stale'),false,'exact');
await simulate('lockdown rejects existing pass use',flow('locked'),false,'ready');
const eveBalance=await client.core.getBalance({owner:c.address,coinType:GATE_COIN});
if(BigInt(eveBalance.balance.balance)>=2n)await simulate('current EVE paid permit pass and claim',flow('eve-paid'),true);
// Capture the real full gRPC JSON representation, not a fabricated route body.
const probe=flow('eve-free');probe.setGasOwner(d.publisher);probe.setGasBudget(100000000);
const bytes=await probe.build({client});const rawResponse=await client.transactionExecutionService.simulateTransaction({transaction:{bcs:{value:bytes}},checks:0,doGasSelection:false,readMask:{paths:['transaction.effects.status','transaction.signatures','command_outputs']}});
const raw:any=GrpcTypes.SimulateTransactionResponse.toJson(rawResponse.response);assert.equal(raw.transaction.effects.status.success,true);assert.equal(raw.transaction.signatures?.length??0,0);
const bodies=raw.commandOutputs.flatMap((x:any)=>[...(x.returnValues??[]),...(x.mutatedByRef??[])].map((v:any)=>v.json).filter((j:any)=>j?.gate_a&&j?.rates&&j?.rules));
assert.ok(bodies.some((b:any)=>b.active&&b.activity.length===3));writeFileSync(new URL('raw-route-bodies.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),bodies,signed:false,submitted:false},null,2));
const after=await readGatePair(a.id,null);assert.equal(after.a.version,a.version);assert.equal(after.b.version,b.version);
assert.deepEqual(await discoverGateRoutes(d),{routes:[],unavailable:0});
const receipt={at:new Date().toISOString(),simulations:evidence.length,rawShapeSimulation:true,registryEmpty:true,gateVersionsUnchanged:true,realPairHistoryVerified:true,signed:false,submitted:false,liveOwnerLink:false,livePlayerJump:false};
writeFileSync(new URL('live-flow-summary.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
