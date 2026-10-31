// Exercise the real bundled CLI through the deployment symlink with a mock read provider.
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {CONFIG} from './core.mjs';
const root=mkdtempSync(join(tmpdir(),'known-space-runtime-')),preload=join(root,'mock.mjs'),entry=join(root,'server.mjs');
const data={chainIdentifier:CONFIG.chainId,serviceConfig:{availableRange:{first:{sequenceNumber:1,timestamp:new Date(Date.now()-10000).toISOString()},last:{sequenceNumber:2,timestamp:new Date().toISOString()}}},events:{nodes:[],pageInfo:{hasPreviousPage:false,hasNextPage:false,startCursor:null,endCursor:null}},objects:{nodes:[],pageInfo:{hasNextPage:false}}};
writeFileSync(preload,`globalThis.fetch=async()=>new Response(JSON.stringify({data:${JSON.stringify(data)}}),{status:200,headers:{'content-type':'application/json'}});`);
symlinkSync(new URL('./dist/server.mjs',import.meta.url).pathname,entry);
const child=spawn(process.execPath,['--import',preload,entry],{env:{...process.env,KNOWN_SPACE_DB:join(root,'test.sqlite'),KNOWN_SPACE_PORT:'0'},stdio:['ignore','pipe','pipe']});
let output='',stderr='';child.stderr.on('data',x=>stderr+=x);
const timer=setTimeout(()=>child.kill('SIGKILL'),10000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('"eventCount"'))child.kill('SIGTERM');});
try{const [code,signal]=await once(child,'exit');assert.equal(signal,null,stderr);assert.equal(code,0,stderr);assert.match(output,/"eventCount":0/);console.log('PASS: symlink CLI starts collector and exits gracefully on SIGTERM');}
finally{clearTimeout(timer);rmSync(root,{recursive:true,force:true});}
