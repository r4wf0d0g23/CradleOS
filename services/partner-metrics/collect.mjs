import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync,renameSync,chmodSync} from 'node:fs';
import {readSource,ingest,walletReport,websiteReport} from './report.mjs';
const data=process.env.PARTNER_STATE_DIR||'/home/rawdata/.local/share/cradleos-partner-metrics';
const sourcePath=process.env.PARTNER_SOURCE_DB||'/home/rawdata/cradleos-agent-proxy/telemetry.db';
mkdirSync(data,{recursive:true,mode:0o700});process.umask(0o077);
const now=Date.now(),db=new DatabaseSync(sourcePath,{readOnly:true}),state=new DatabaseSync(data+'/archive.db');
db.exec('PRAGMA busy_timeout=5000');state.exec('PRAGMA busy_timeout=5000');
try{
 const source=readSource(db,now);ingest(state,source.rows);
 let token='';try{token=readFileSync('/home/rawdata/.config/cradleos-partner-metrics/cloudflare-token','utf8').trim();}catch{/* Website unavailable; wallet history remains independently collectable. */}
 const website=await websiteReport(token,now);
 const report={schema_version:1,generated_at:new Date(now).toISOString(),website,cycles:walletReport(state,source,now)};
 const temp=data+'/report.json.tmp';writeFileSync(temp,JSON.stringify(report,null,2)+'\n',{mode:0o600});renameSync(temp,data+'/report.json');chmodSync(data+'/archive.db',0o600);
 console.log(JSON.stringify({at:report.generated_at,websiteStatus:website.status,websitePageViews:website.page_views,cycles:report.cycles.map(c=>({cycle:c.cycle,archived:c.archived_wallets,verified:c.verified_union_wallets,status:c.status}))}));
}finally{db.close();state.close();}
