import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {marketAction,deliveryAction,selectProof,FEEDS,receipt} from './engine.mjs';
import {journalRunner} from './journal.mjs';
import {Transaction} from '@mysten/sui/transactions';import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
const market=()=>({version:'1',asset:1,price_feed:Buffer.from(FEEDS[1],'hex').toString('base64'),price_exponent:8,ends:'1000',proof_deadline:'4600',claim_count:'2',result:0,price_time:'0'});
test('clock gates proof, deadline refund and permissionless payments',()=>{assert.equal(marketAction(market(),999),null);assert.equal(marketAction(market(),1000),'proof');assert.equal(marketAction(market(),4600),'finalize');assert.equal(marketAction({...market(),result:3},4700),'payout');assert.equal(marketAction({...market(),price_time:'1000'},1100),null);assert.equal(deliveryAction({status:0,deadline:'1000'},999),null);assert.equal(deliveryAction({status:0,deadline:'1000'},1000),'refund');assert.equal(deliveryAction({status:1,deadline:'1000'},2000),null);});
test('closed feed catalog and fixed deadline cannot be reinterpreted',()=>{for(const bad of [{...market(),asset:3},{...market(),price_feed:'AA=='},{...market(),proof_deadline:'9000'},{...market(),result:99}])assert.throws(()=>marketAction(bad,5000));});
test('ambiguous network response is not a successful payout',()=>{assert.throws(()=>receipt({}));assert.throws(()=>receipt({Transaction:{digest:'x',status:{}}}));assert.deepEqual(receipt({FailedTransaction:{digest:'x',status:{success:false}}}),{digest:'x',success:false});});
test('signed public leaf selects exact first-crossing; later quote and extra bytes fail',async()=>{
 const source=await readFile(new URL('../../../cradleos_book/tests/price_tests.move',import.meta.url),'utf8');const hex=source.match(/const DATA:vector<u8> = x"([a-f0-9]+)"/)[1];const feed='eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';
 assert.equal(selectProof(hex,feed,1792629879).toString('hex'),hex);assert.throws(()=>selectProof(hex,feed,1792629878));assert.throws(()=>selectProof(hex,FEEDS[1],1792629879));assert.throws(()=>selectProof(hex+'00',feed,1792629879));
});
async function fixture(){const signer=Ed25519Keypair.generate();const tx=new Transaction();tx.setSender(signer.toSuiAddress());tx.setGasPrice(1000);tx.setGasBudget(10000000);tx.setGasPayment([{objectId:'0x1',version:'1',digest:'11111111111111111111111111111111'}]);tx.transferObjects([tx.gas],signer.toSuiAddress());await tx.build();return {tx,signer};}
test('persist before broadcast, retain unknown, replay identical bytes after restart',async()=>{
 const {tx,signer}=await fixture();const state={pending:null};let saved;let sent;
 const client={executeTransaction:async p=>{assert.ok(saved?.pending);sent=Buffer.from(p.transaction);throw Error('connection lost');}};
 const runner=journalRunner({client,signer,bookId:'book',state,save:async()=>{saved=structuredClone(state);}});
 await assert.rejects(runner.submit('pay',tx),/connection lost/);assert.ok(state.pending);await assert.rejects(runner.submit('pay-again',tx),/PENDING/);
 const restored=structuredClone(saved);let reads=0;
 const after={getTransaction:async()=>{reads++;throw Error('not found');},executeTransaction:async p=>{assert.deepEqual(Buffer.from(p.transaction),sent);assert.equal(p.signatures[0],saved.pending.signature);return {Transaction:{digest:restored.pending.digest,status:{success:true}}};}};
 await journalRunner({client:after,signer,bookId:'book',state:restored,save:async()=>{}}).recover();assert.equal(reads,1);assert.equal(restored.pending,null);assert.equal(restored.lastTransaction.success,true);
});
test('definitive failure clears pending; a receipt with another digest never does',async()=>{
 const {tx,signer}=await fixture();let state={pending:null};let bad=true;
 const client={executeTransaction:async()=>({FailedTransaction:{digest:bad?'wrong':state.pending.digest,status:{success:false}}})};
 const runner=journalRunner({client,signer,bookId:'book',state,save:async()=>{}});await assert.rejects(runner.submit('pay',tx),/DIGEST_MISMATCH/);assert.ok(state.pending);
 client.getTransaction=async()=>{throw Error('not found');};bad=false;assert.equal(await runner.recover(),false);assert.equal(state.pending,null);
});
