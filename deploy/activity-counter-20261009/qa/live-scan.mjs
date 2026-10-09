import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createActivity} from '../../../services/agent-proxy/activity.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../../../services/agent-proxy/telemetry-config.json',import.meta.url)));
const db=new DatabaseSync(':memory:');
try{
 const service=createActivity({db,config,verify:async()=>{throw new Error('Read-only probe');}});
 const result=await service.poll();
 const report={mode:'Official GraphQL read-only; isolated in-memory DB; no wallet or chain writes',result,summary:service.summary()};
 fs.writeFileSync(new URL('../live-scan.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(!result.ok)process.exitCode=1;
}finally{db.close();}
