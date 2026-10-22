import {readFile,rename,mkdir,open,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {Transaction} from '@mysten/sui/transactions';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
import {deriveDynamicFieldID} from '@mysten/sui/utils';
import {bcs} from '@mysten/sui/bcs';
import {journalRunner} from './journal.mjs';
import {assertCanonicalChain,canonicalObject,marketAction,deliveryAction,selectProof,FEEDS,uint} from './engine.mjs';
const PUBLIC_GRAPHQL='https://graphql.testnet.sui.io/graphql';
const PYTH='https://pyth.dourolabs.app/hermes';
const fields='address owner{__typename} asMoveObject{contents{type{repr} json}}';
const status={startedAt:new Date().toISOString(),mode:'read-only',state:'starting',submitted:0,paid:0,proofs:0,finalized:0,refunds:0,errors:[]};
const stateDir=resolve(process.env.BOOK_KEEPER_STATE_DIR??'./.book-keeper');
// OS lock is held across the whole process, including signing and journal writes.
await mkdir(stateDir,{recursive:true,mode:0o700});
const lockPath=resolve(stateDir,"keeper.lock");
if(!process.argv.includes("--lock-held")) {
 const child=spawnSync('/usr/bin/flock',['-n','-F',lockPath,process.execPath,fileURLToPath(import.meta.url),'--lock-held'],{stdio:'inherit',env:process.env});
 process.exit(child.status??1);
}
const lockStat=await stat(lockPath),locks=await readFile('/proc/locks','utf8');
if(!locks.split('\n').some(line=>{const p=line.trim().split(/\s+/);return p[1]==='FLOCK'&&p[4]===String(process.pid)&&p[5]?.split(':').at(-1)===String(lockStat.ino);})) throw Error('KERNEL_LOCK_REQUIRED');
let cfg,state,client,signer,journal;
const id=v=>{if(typeof v!=='string'||!/^0x[0-9a-f]{64}$/.test(v))throw Error('INVALID_OBJECT_ID');return v;};
async function atomic(path,value){const temp=path+'.new';const f=await open(temp,'w',0o600);try{await f.writeFile(JSON.stringify(value,null,2));await f.sync();}finally{await f.close();}await rename(temp,path);const d=await open(dirname(path),'r');try{await d.sync();}finally{await d.close();}}
async function query(query,variables={}){const r=await fetch(PUBLIC_GRAPHQL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('CHAIN_HTTP_'+r.status);const d=await r.json();if(d.errors||!d.data)throw Error('CHAIN_QUERY');return d.data;}
async function objects(ids){const result=[];for(let i=0;i<ids.length;i+=25){const batch=ids.slice(i,i+25);const q='query{'+batch.map((x,j)=>`n${j}:object(address:"${id(x)}"){${fields}}`).join(' ')+'}';const d=await query(q);batch.forEach((_,j)=>result.push(d['n'+j]));}return result;}
async function loadState(){try{return JSON.parse(await readFile(resolve(stateDir,'state.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return {bookId:cfg.bookId,claimCursors:{},deliveryCursor:0,pending:null};}}
const save=()=>atomic(resolve(stateDir,'state.json'),state);
async function submit(action,fn,args){
 if(status.submitted>=16)return false;
 if(!cfg.liveEnabled){status.planned=(status.planned??0)+1;return false;}
 if(state.pending)throw Error('PENDING_TRANSACTION');
 const tx=new Transaction();tx.setSender(signer.toSuiAddress());tx.setGasBudget(100_000_000);
 tx.moveCall({target:`${cfg.packageId}::${fn}`,typeArguments:[cfg.coinType],arguments:args(tx)});
 const success=await journal.submit(action,tx);status.submitted++;return success;
}
async function proof(f,node){
 if(!process.env.PYTH_API_KEY){status.errors.push('ORACLE_KEY_MISSING');return;}
 const url=new URL(`${PYTH}/v2/updates/price/${f.ends}`);url.searchParams.set('ids[]',FEEDS[f.asset]);url.searchParams.set('encoding','hex');url.searchParams.set('parsed','false');
 const r=await fetch(url,{headers:{Authorization:'Bearer '+process.env.PYTH_API_KEY},signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!r.ok)throw Error('ORACLE_HTTP_'+r.status);const data=await r.json();if(data?.binary?.encoding!=='hex'||!Array.isArray(data.binary.data)||data.binary.data.length!==1)throw Error('ORACLE_RESPONSE');
 const bytes=selectProof(data.binary.data[0],FEEDS[f.asset],Number(f.ends));
 if(await submit('proof:'+node.address,'price::submit',tx=>[tx.object(node.address),tx.object(cfg.pythState),tx.object(cfg.wormholeState),tx.pure.vector('u8',bytes),tx.object('0x6')]))status.proofs++;
}
async function payouts(f,node){
 const count=Number(uint(f.claim_count));let cursor=state.claimCursors[node.address]??0;
 for(let checked=0;cursor<count&&checked<32&&status.submitted<16;cursor++,checked++){
  const field=deriveDynamicFieldID(id(f.claims.id),'u64',bcs.u64().serialize(cursor).toBytes());
  const [slot]=await objects([field]);const v=slot?.asMoveObject?.contents?.json;
  if(!v||Number(v.name)!==cursor)throw Error('CLAIM_INDEX');const [claim]=await objects([id(v.value)]);
  const e=canonicalObject(claim,`${cfg.packageId}::book::Entitlement<${cfg.coinType}>`);
  if(e.market_id!==node.address||Number(e.index)!==cursor||typeof e.paid!=='boolean'||!['1','2'].includes(String(e.side))||uint(e.stake)===0n)throw Error('CLAIM_PROVENANCE');
  id(e.bettor);
  if(!e.paid){const paid=await submit('claim:'+claim.address,'book::claim_for',tx=>[tx.object(node.address),tx.object(claim.address)]);if(!paid)break;status.paid++;}
  state.claimCursors[node.address]=cursor+1;await save();
 }
}
async function run(){
 await mkdir(stateDir,{recursive:true,mode:0o700});
 const configPath=process.env.BOOK_KEEPER_CONFIG;if(!configPath)throw Error('CONFIG_MISSING');cfg=JSON.parse(await readFile(configPath,'utf8'));
 if(cfg.chainId!=='4c78adac'||cfg.tenant!=='stillness'||cfg.coinType!=='0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE')throw Error('CONFIG_CHAIN');
 for(const key of ['packageId','bookId','pythState','wormholeState'])id(cfg[key]);
 if(cfg.pythState!=='0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e'||cfg.wormholeState!=='0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0')throw Error('CONFIG_ORACLE');
 client=new SuiGrpcClient({network:'testnet',baseUrl:'https://fullnode.testnet.sui.io:443'});
 assertCanonicalChain((await client.core.getChainIdentifier()).chainIdentifier);
 state=await loadState();if(state.bookId!==cfg.bookId)throw Error('STATE_BOOK_MISMATCH');
 if(cfg.liveEnabled){
  const path=process.env.BOOK_KEEPER_KEYSTORE_PATH;if(!path)throw Error('SIGNER_MISSING');const info=await stat(path);if((info.mode&0o077)!==0)throw Error('SIGNER_PERMISSIONS');
  const entries=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(entries)||entries.length!==1)throw Error('DEDICATED_SIGNER_REQUIRED');
  const bytes=Buffer.from(entries[0],'base64');if(bytes.length!==33||bytes[0]!==0)throw Error('SIGNER_FORMAT');signer=Ed25519Keypair.fromSecretKey(bytes.subarray(1));
  if(signer.toSuiAddress()!==id(cfg.signer)||signer.toSuiAddress()==='0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a')throw Error('DEDICATED_SIGNER_REQUIRED');
  status.mode='live';journal=journalRunner({client,signer,bookId:cfg.bookId,state,save});await journal.recover();
 }
 const [book]=await objects([cfg.bookId]);const b=canonicalObject(book,`${cfg.packageId}::book::Book<${cfg.coinType}>`);
 if(uint(b.version)!==1n||b.tenant!==cfg.tenant||!Array.isArray(b.markets)||!Array.isArray(b.deliveries))throw Error('BOOK_PROVENANCE');
 const now=Math.floor(Date.now()/1000),markets=await objects(b.markets);const jobs=[];
 for(const n of markets){const f=canonicalObject(n,`${cfg.packageId}::book::Market<${cfg.coinType}>`,cfg.bookId);if(f.tenant!==cfg.tenant)throw Error('MARKET_TENANT');const a=marketAction(f,now);if(a)jobs.push({a,n,f});}
 const rank={proof:0,finalize:1,payout:2};jobs.sort((a,b)=>rank[a.a]-rank[b.a]||Number(a.f.proof_deadline)-Number(b.f.proof_deadline));
 for(const {a,n,f} of jobs){if(status.submitted>=16)break;try{
  if(a==='proof')await proof(f,n);
  else if(a==='finalize'){if(await submit('finalize:'+n.address,'book::finalize',tx=>[tx.object(n.address),tx.object('0x6')]))status.finalized++;}
  else await payouts(f,n);
 }catch(e){status.errors.push(String(e.message).slice(0,100));if(state.pending)throw Error('TRANSACTION_PENDING');}}
 const start=state.deliveryCursor%b.deliveries.length||0,deliveryIds=b.deliveries.slice(start,start+128);
 for(const n of await objects(deliveryIds)){if(status.submitted>=16)break;const f=canonicalObject(n,`${cfg.packageId}::delivery::Delivery<${cfg.coinType}>`,cfg.bookId);
  if(f.tenant!==cfg.tenant)throw Error('REWARD_TENANT');if(deliveryAction(f,now)&&await submit('refund:'+n.address,'delivery::refund',tx=>[tx.object(n.address),tx.object('0x6')]))status.refunds++;}
 if(status.submitted<16){state.deliveryCursor=start+deliveryIds.length;await save();}
 status.state=status.errors.length?'degraded':'healthy';
}
try{await run();}catch(e){status.state='blocked';status.errors.push(String(e.message).slice(0,100));process.exitCode=1;}
if(state?.pending)status.pending={digest:state.pending.digest,action:state.pending.action};
status.finishedAt=new Date().toISOString();status.errors=[...new Set(status.errors)].slice(0,20);
try{await atomic(resolve(stateDir,'status.json'),status);}catch{process.exitCode=1;}
console.log(JSON.stringify(status));
