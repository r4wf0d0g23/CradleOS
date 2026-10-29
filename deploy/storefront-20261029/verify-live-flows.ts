// Only supported live reads and UNSIGNED simulation. No signer, keystore, execute or broadcast.
import{readFileSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
import{Transaction}from'@mysten/sui/transactions';import{storageClient as client,storageObject}from'../../cradleos-dapp/src/lib/storageRead';import{fetchSsuSnapshot,SSU_TYPE}from'../../cradleos-dapp/src/lib/ssuSafety';import{buildShopAction,readShop,discoverShops}from'../../cradleos-dapp/src/lib/storefront';import{WORLD_PKG,EVE_COIN_TYPE}from'../../cradleos-dapp/src/constants';
const d=JSON.parse(readFileSync(new URL('onchain.json',import.meta.url),'utf8')),before=JSON.parse(readFileSync(new URL('live-before.json',import.meta.url),'utf8')),candidate=before.candidate,evidence:any[]=[];
const save=()=>writeFileSync(new URL('live-flows.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),signed:false,submitted:false,evidence},(_,v)=>typeof v==='bigint'?v.toString():v,2));
async function simulate(label:string,tx:Transaction,want:boolean,abort?:string){tx.setGasOwner(d.publisher);tx.setGasBudget(100000000);const r=await client.core.simulateTransaction({transaction:tx,checksEnabled:true,include:{effects:true,events:true,commandResults:true}});const out=r.Transaction??r.FailedTransaction;evidence.push({label,want,success:out?.status.success,simulation:r});save();assert.equal(out?.status.success,want,JSON.stringify(out?.status));if(abort)assert.equal((out?.status.error as any)?.MoveAbort?.location?.functionName,abort);console.log(JSON.stringify({label,success:out?.status.success,submitted:false}));}
const state=await fetchSsuSnapshot(candidate.ssuId);assert.equal(state.extension,null);assert.ok(!state.slots.some(s=>s.partition==='open'&&s.items.length));const row=state.slots.find(s=>s.partition==='owner_main')?.items.find(i=>i.quantity>=2);assert.ok(row);
const nativeBefore=await storageObject(candidate.ssuId);
const create=buildShopAction(state,null,{kind:'create',name:'Unsigned storefront proof'},candidate.characterId,candidate.wallet,state.ownerCapId,candidate.characterCap,d);
await simulate('production activation builder',create,true);
const denied=buildShopAction(await fetchSsuSnapshot(candidate.ssuId),null,{kind:'create',name:'Unsigned rejection'},candidate.characterId,d.publisher,state.ownerCapId,candidate.characterCap,d);
await simulate('wrong wallet cannot activate',denied,false,'borrow_owner_cap');
const c=candidate.characterId,sid=candidate.ssuId;
function flow(kind:string){const tx=new Transaction();tx.setSender(candidate.wallet);const target=(name:string)=>`${d.packageId}::storefront::${name}` as `${string}::${string}::${string}`;
const[cap,r]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[SSU_TYPE],arguments:[tx.object(c),tx.object(state.ownerCapId)]});
const[p]=tx.moveCall({target:target('create'),arguments:[tx.object(d.registryId),tx.object(sid),cap,tx.pure.string('Unsigned storefront flow')]});
tx.moveCall({target:target('configure'),arguments:[p,cap,tx.pure.u64(0),tx.pure.string('Unsigned storefront flow'),tx.pure.bool(true),tx.pure.u8(4),tx.pure.vector('u32',[]),tx.pure.vector('address',[]),tx.pure.vector('address',[])]});
const currency=kind==='eve-underpayment'?EVE_COIN_TYPE:'0x2::sui::SUI';
tx.moveCall({target:target('set_listing'),typeArguments:[currency],arguments:[p,cap,tx.pure.u64(row!.typeId),tx.pure.u64(0),tx.pure.u64(1),tx.pure.bool(true),tx.pure.u32(1),tx.pure.u32(2),tx.pure.u32(1),tx.pure.u64(0),tx.pure.u64(0),tx.pure.u64(0)]});
tx.moveCall({target:target('stock_owner'),arguments:[p,tx.object(sid),cap,tx.object(c),tx.pure.u64(row!.typeId),tx.pure.u32(2)]});
const payment=kind==='eve-underpayment'?tx.moveCall({target:'0x2::coin::zero',typeArguments:[currency],arguments:[]})[0]:tx.splitCoins(tx.gas,[tx.pure.u64(1)])[0];
tx.moveCall({target:target('buy'),typeArguments:[currency],arguments:[p,tx.object(sid),tx.object(c),tx.pure.u64(row!.typeId),tx.pure.u32(1),tx.pure.u64(1),tx.pure.u64(kind==='stale-quote'?0:1),payment,tx.object('0x6')]});
if(kind==='roundtrip'){
 tx.moveCall({target:target('unstock'),arguments:[p,tx.object(sid),cap,tx.object(c),tx.pure.u64(row!.typeId),tx.pure.u32(1)]});
 const ccType=`${WORLD_PKG}::character::Character`,[cc,cr]=tx.moveCall({target:`${WORLD_PKG}::character::borrow_owner_cap`,typeArguments:[ccType],arguments:[tx.object(c),tx.object(candidate.characterCap)]});
 tx.moveCall({target:target('stock_personal'),arguments:[p,tx.object(sid),cap,tx.object(c),cc,tx.pure.u64(row!.typeId),tx.pure.u32(1)]});
 tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[ccType],arguments:[tx.object(c),cc,cr]});
 tx.moveCall({target:target('unstock'),arguments:[p,tx.object(sid),cap,tx.object(c),tx.pure.u64(row!.typeId),tx.pure.u32(1)]});
 tx.moveCall({target:target('proceeds'),typeArguments:[currency],arguments:[p]});
 tx.moveCall({target:target('claim'),typeArguments:[currency],arguments:[p,cap]});
 tx.moveCall({target:target('proceeds'),typeArguments:[currency],arguments:[p]});
 tx.moveCall({target:target('stock'),arguments:[p,tx.pure.u64(row!.typeId)]});
 tx.moveCall({target:target('permits'),arguments:[p,tx.pure.id(c),tx.pure.u32(100)]});
 tx.moveCall({target:target('shop_id'),arguments:[tx.object(d.registryId),tx.pure.id(sid)]});
}
tx.moveCall({target:target('share_shop'),arguments:[p]});tx.moveCall({target:`${WORLD_PKG}::character::return_owner_cap`,typeArguments:[SSU_TYPE],arguments:[tx.object(c),cap,r]});return tx;}
await simulate('native stock purchase recovery personal stock proceeds and views',flow('roundtrip'),true);
await simulate('stale quote rejected',flow('stale-quote'),false,'buy');
await simulate('current EVE type and exact payment rejection',flow('eve-underpayment'),false,'buy');
assert.equal(await readShop(sid,d),null);assert.deepEqual(await discoverShops(d),{shops:[],unavailable:0});
const registry=await storageObject(d.registryId);assert.equal(Number(registry.fields.shops.size),0);
const after=await storageObject(sid);assert.equal(after.version,nativeBefore.version,'SSU independently changed during proof; inspect before claiming unchanged');
const receipt={at:new Date().toISOString(),simulations:evidence.length,registryEmpty:true,ssuVersionUnchanged:true,signed:false,submitted:false,livePlayerPurchase:false};writeFileSync(new URL('live-flow-summary.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
