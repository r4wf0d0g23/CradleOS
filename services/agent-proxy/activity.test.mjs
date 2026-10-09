import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync as Database } from 'node:sqlite';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { createActivity, address, DAY, WINDOW, FRESH_MS } from './activity.mjs';
const databases = new Set();
after(() => { for (const db of databases) if (db.isOpen) db.close(); });
const NOW = Date.parse('2026-10-09T12:00:00Z');
const config = {chainId:'4c78adac',cycle:7,graphql:'https://test.invalid',packages:{core:address('0x1'),other:address('0x2')}};
const tx = (digest,who='0xa',ts=NOW-1000,status='SUCCESS') => ({digest,sender:{address:who},effects:{status,timestamp:new Date(ts).toISOString()}});
const page = (nodes=[],more=false,cursor=null) => ({transactions:{nodes,pageInfo:{hasPreviousPage:more,startCursor:cursor}}});
function setup(options={}) {
  let clock=NOW;
  const db=options.db || new Database(':memory:'); databases.add(db);
  const root = {chainIdentifier:'69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD',checkpoints:{nodes:[{sequenceNumber:100,timestamp:new Date(clock-100).toISOString()}]},earliest:{nodes:[{timestamp:'2023-05-10T00:00:00Z'}]}};
  const calls=[];
  let handler = () => page([]);
  const activity=createActivity({db,config,now:()=>clock,verify:(bytes,signature,address)=>verifyPersonalMessageSignature(bytes,signature,{address}),fetchImpl:async (_url,opts)=>{
    const request=JSON.parse(opts.body); calls.push(request);
    if (!request.variables.pkg) return {ok:true,json:async()=>({data:root})};
    const data = await handler(request.variables);
    return {ok:true,json:async()=>data?.errors ? data : ({data})};
  },...options});
  return {db,root,calls,activity,clock:v=>clock=v,handler:fn=>handler=fn};
}
function response(){ return {statusCode:200,setHeader(){},status(c){this.statusCode=c;return this;},json(v){this.body=v;return this;}}; }
async function proof(key,at=NOW){const bytes=Buffer.from(`CradleOS identity verification\nNonce: 10000000-0000-4000-8000-000000000001\nTimestamp: ${at}`);const s=await key.signPersonalMessage(bytes);return {address:key.toSuiAddress(),signature:s.signature,challenge:bytes.toString('base64')};}
async function ping(h,body){const res=response();await h.activity.verifyPing({body},res);return res;}

test('real signatures: reject wrong sender, corruption, arbitrary/expired challenges; never count a failure',async()=>{
 const h=setup(),key=Ed25519Keypair.generate(),valid=await proof(key);
 assert.equal((await ping(h,{...valid,address:address('0xb')})).statusCode,401);
 assert.equal((await ping(h,{...valid,signature:'invalid'})).statusCode,401);
 assert.equal((await ping(h,{...valid,challenge:Buffer.from('unrelated signed content').toString('base64')})).statusCode,400);
 assert.equal((await ping(h,await proof(key,NOW-300001))).statusCode,400);
 assert.equal((await ping(h,await proof(key,NOW+30001))).statusCode,400);
 assert.equal(h.activity.summary().wallet_mau,0);
 assert.equal((await ping(h,valid)).body.verified,true);
 assert.equal((await ping(h,valid)).statusCode,200);
 assert.equal(h.activity.summary().wallet_mau,1);
});

test('replay across UTC midnight retains signed day; late async verifier cannot insert expired proof',async()=>{
 const h=setup(),at=Date.parse('2026-10-08T23:59:30Z'),key=Ed25519Keypair.generate();h.clock(at);const signed=await proof(key,at);
 await ping(h,signed);h.clock(at+60000);await ping(h,signed);
 assert.equal(h.activity.summary().wallet_dau,0);
 assert.equal(h.db.prepare('SELECT count(*) AS n FROM activity_wallet_v2').get().n,1);
 const late=setup({verify:async()=>{late.clock(NOW+300001);}});assert.equal((await ping(late,await proof(key))).statusCode,401);
 assert.equal(late.activity.summary().wallet_mau,0);
});

test('unsupported verification never becomes counted; legacy tables stay intact and excluded',async()=>{
 const h=setup({verify:async()=>{throw new Error('unsupported');}});
 h.db.exec("CREATE TABLE wallet_pings(address TEXT, verified INTEGER); INSERT INTO wallet_pings VALUES ('0xa',0),('0xb',1)");
 assert.equal((await ping(h,await proof(Ed25519Keypair.generate()))).statusCode,401);
 assert.equal(h.activity.summary().wallet_mau,0);
 assert.equal(h.db.prepare('SELECT count(*) AS n FROM wallet_pings').get().n,2);
});

test('successful eventless calls, repeat calls and overlapping sources form normalized address union',async()=>{
 const h=setup();h.handler(v=>page(v.pkg===address('0x1')?[tx('one','0xA'),tx('two','0xa'),tx('bad','0xf',NOW-500,'FAILURE')]:[tx('three','0xb')]));
 h.db.prepare('INSERT INTO activity_wallet_v2 VALUES (?,?,?)').run(address('0xa'),'2026-10-09',NOW-500);
 h.db.prepare('INSERT INTO activity_wallet_v2 VALUES (?,?,?)').run(address('0xc'),'2026-10-09',NOW-500);
 assert.equal((await h.activity.poll()).ok,true);const s=h.activity.summary();
 assert.equal(s.onchain_mau,2);assert.equal(s.wallet_mau,2);assert.equal(s.combined_mau,3);
 assert(h.calls.filter(x=>x.variables.pkg).every(x=>x.variables.checkpoint===101));
});

test('rolling 30 days uses exact milliseconds, excludes future timestamps and old calendar-day tail',async()=>{
 const h=setup();for(const [who,ts] of [['0xa',NOW-WINDOW],['0xb',NOW-WINDOW-1],['0xc',NOW+1]]) h.db.prepare('INSERT INTO activity_wallet_v2 VALUES (?,?,?)').run(address(who),new Date(ts).toISOString().slice(0,10),ts);
 await h.activity.poll();assert.equal(h.activity.summary().wallet_mau,1);assert.equal(h.activity.summary().combined_mau,1);
 h.clock(NOW+1);assert.equal(h.activity.summary().wallet_mau,1); // boundary expires as future proof enters
});

test('backward pages process chronological nodes after cutoff before stopping; use startCursor',async()=>{
 const h=setup();h.handler(v=>v.pkg!==address('0x1')?page([]):v.before===null?page([tx('recent','0xa')],true,'page2'):page([tx('old','0xf',NOW-WINDOW-1),tx('edge','0xb',NOW-WINDOW)],true,'page3'));
 assert.equal((await h.activity.poll()).ok,true);assert.equal(h.activity.summary().onchain_mau,2);
 assert.equal(h.calls.filter(x=>x.variables.pkg===address('0x1')).length,2);
});

for(const mode of ['errors','bad_timestamp','missing_sender','missing_status','page_limit','stalled','pruned','old_index','wrong_chain']) test(`incomplete scan: ${mode} preserves last snapshot but never claims zero/current total`,async()=>{
 const h=setup({maxPages:2});h.handler(()=>page([tx('one')]));await h.activity.poll();assert.equal(h.activity.summary().combined_mau,1);
 if(mode==='pruned')h.root.earliest.nodes[0].timestamp=new Date(NOW-DAY).toISOString();
 else if(mode==='old_index')h.root.checkpoints.nodes[0].timestamp=new Date(NOW-FRESH_MS-1).toISOString();
 else if(mode==='wrong_chain')h.root.chainIdentifier='11111111111111111111111111111111';
 else h.handler(v=>mode==='errors'?{errors:[{message:'partial'}],data:page([])}:mode==='bad_timestamp'?page([{...tx('bad'),effects:{status:'SUCCESS',timestamp:'not a date'}}]):mode==='missing_sender'?page([{...tx('bad'),sender:null}]):mode==='missing_status'?page([{...tx('bad'),effects:null}]):page([tx('new')],true,mode==='stalled'?'same':`${v.before}x`));
 assert.equal((await h.activity.poll()).ok,false);const s=h.activity.summary();assert.equal(s.onchain_status,'stale');assert.equal(s.combined_mau,null);assert.equal(s.onchain_mau,null);
 assert.equal(h.db.prepare('SELECT count(*) AS n FROM activity_chain_v2').get().n,2);
});

test('zero is a valid complete result; freshness expires and changed package scope invalidates snapshot',async()=>{
 const h=setup();assert.equal(h.activity.summary().combined_mau,null);await h.activity.poll();assert.equal(h.activity.summary().combined_mau,0);
 h.clock(NOW+FRESH_MS);assert.equal(h.activity.summary().combined_mau,null);
 const changed=setup({db:h.db,config:{...config,packages:{new:address('0x3')}}});assert.equal(changed.activity.summary().onchain_status,'unavailable');
});

test('polls coalesce while running and all packages commit atomically',async()=>{
 const h=setup();let unblock;h.handler(()=>new Promise(r=>{unblock=()=>r(page([]));}));
 const one=h.activity.poll(),two=h.activity.poll();assert.equal(one,two);
 await new Promise(r=>setImmediate(r));assert.equal(h.activity.summary().combined_mau,null);unblock();
 await new Promise(r=>setImmediate(r));assert.equal(h.activity.summary().combined_mau,null);unblock();await one;assert.equal(h.activity.summary().combined_mau,0);
});

test('deployment config matches current app package set and chain',()=>{
 const cfg=JSON.parse(readFileSync(new URL('./telemetry-config.json',import.meta.url)));
 const source=readFileSync(new URL('../../cradleos-dapp/src/lib/cycleDeployment.ts',import.meta.url),'utf8');
 const packages=Object.fromEntries([...source.split('packages: {')[1].split('}')[0].matchAll(/(\w+): "(0x[0-9a-f]{64})"/g)].map(m=>[m[1],m[2]]));
 assert.deepEqual(cfg.packages,packages);assert.equal(cfg.chainId,source.match(/chainId: "([^"]+)"/)[1]);
});
