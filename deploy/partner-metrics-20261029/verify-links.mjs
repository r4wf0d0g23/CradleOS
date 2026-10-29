import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { RELEASES, SOURCE_BRANCH,ARCHIVE_URL } from './data.bundle.mjs';
const urls=[SOURCE_BRANCH,ARCHIVE_URL,...RELEASES.flatMap(r=>[r.source,r.evidence])];
const results=[];
for(let at=0;at<urls.length;at+=3){const batch=await Promise.all(urls.slice(at,at+3).map(async url=>{const r=await fetch(url,{method:'HEAD',headers:{'user-agent':'CradleOS-release-link-verification'},signal:AbortSignal.timeout(20000)});return {url,status:r.status,finalUrl:r.url,public:true};}));results.push(...batch);}
writeFileSync(new URL('public-links.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),authenticated:false,results},null,2));assert.ok(results.every(r=>r.status===200));console.log(JSON.stringify({publicLinks:results.length,pass:true}));
