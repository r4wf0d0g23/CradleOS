// Explicit one-shot isolated publication. No SSU configuration or asset transfer.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../cradleos-dapp/package.json',import.meta.url));
const { SuiGrpcClient }=require('@mysten/sui/grpc');
const { Transaction }=require('@mysten/sui/transactions');
const { Ed25519Keypair }=require('@mysten/sui/keypairs/ed25519');
const { verifyPersonalMessageSignature }=require('@mysten/sui/verify');
const dir=new URL('./',import.meta.url), root=new URL('../../',dir);
const read=n=>JSON.parse(readFileSync(new URL(n,dir)));
const save=(n,v)=>writeFileSync(new URL(n,dir),JSON.stringify(v,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
const custody=read('custody.json'), publisher=custody.publisher;
assert.equal(publisher,'0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a');
assert.equal(custody.upgradeCapDestination,publisher);
assert.equal(custody.operatorMessage,'1565366765733675169');
const proof=read('restored-signing-proof.json');
assert.ok(proof.restoredFromBackup && !proof.transactionSubmitted);
assert.ok(Date.now()-Date.parse(proof.checkedAt)>=0 && Date.now()-Date.parse(proof.checkedAt)<3600000);
assert.equal((await verifyPersonalMessageSignature(Buffer.from(proof.challengeBase64,'base64'),proof.signature)).toSuiAddress(),publisher);
assert.equal(custody.backupProof,proof.digestHex);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain','--untracked-files=no'),'');
const source=git('rev-parse','HEAD');
assert.equal(git('rev-parse','publish/cradleos-storage-access-2026-10-29'),source);
const build=read('package-build.json');
assert.deepEqual(build,read('fresh-build.json'));
assert.equal(build.modules.length,1);
const moduleBytes=Buffer.from(build.modules[0],'base64');
assert.equal(createHash('sha256').update(moduleBytes).digest('hex'),'be9db0cc9bef0d3610c8e3a5f5cf9e4c34b325ffe9c8f514aabda19fbf8166ad');
assert.equal(build.dependencies.filter(p=>!/^0x0+[12]$/.test(p)).join(','),'0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92');
assert.ok(!existsSync(new URL('publish-pending.json',dir)) && !existsSync(new URL('onchain.json',dir)),'Reconcile prior attempt; never blindly retry.');
const client=new SuiGrpcClient({network:'testnet',baseUrl:'https://fullnode.testnet.sui.io:443'});
assert.equal((await client.core.getChainIdentifier()).chainIdentifier,'69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD');
const tx=new Transaction();tx.setSender(publisher);tx.setGasBudget(500000000);
const cap=tx.publish(build);tx.transferObjects([cap],publisher);
const bytes=await tx.build({client});
const sim=await client.core.simulateTransaction({transaction:bytes,checksEnabled:true,include:{effects:true,objectTypes:true}});
save('final-publish-simulation.json',sim);
assert.ok(sim.Transaction?.status?.success,'Publication simulation failed');
if(process.env.STORAGE_RELEASE_SIGN!=='1'){console.log(JSON.stringify({simulation:true,signed:false,source}));process.exit(0);}
const journal=openSync(new URL('publish-pending.json',dir),'wx',0o600);
let signer;
try{
 const keys=JSON.parse(readFileSync('/home/rawdata/.sui/sui_config/sui.keystore','utf8'));
 for(const k of keys){const b=Buffer.from(k,'base64');if(b.length===33&&b[0]===0){const s=Ed25519Keypair.fromSecretKey(b.subarray(1));if(s.toSuiAddress()===publisher)signer=s;}}
 assert.ok(signer,'Publisher key unavailable');
}catch{closeSync(journal);throw Error('Publisher unavailable; secret-bearing details suppressed');}
const signed=await signer.signTransaction(bytes),digest=await tx.getDigest();
writeSync(journal,JSON.stringify({digest,source,transactionBytes:Buffer.from(bytes).toString('base64'),signature:signed.signature}));fsyncSync(journal);closeSync(journal);
const directory=openSync(dir,'r');fsyncSync(directory);closeSync(directory);
const result=await client.core.executeTransaction({transaction:bytes,signatures:[signed.signature],include:{effects:true,objectTypes:true}});
save('publication.json',result);
assert.equal(result.Transaction?.digest,digest);
assert.ok(result.Transaction?.status?.success,'Publication did not succeed; reconcile receipt');
console.log(JSON.stringify({digest,source,success:true,receipt:'publication.json'}));
