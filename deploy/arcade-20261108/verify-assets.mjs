import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origins=['https://cradleos.io',process.argv[2]].filter(Boolean),dist=new URL('../../cradleos-dapp/dist/',import.meta.url),results=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const refs=s=>[...s.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]).sort();
for(const origin of origins){
 for(const path of ['/','/arcade','/partners/metrics/']){
  const r=await fetch(origin+path);assert.equal(r.status,200);const html=await r.text(),local=readFileSync(new URL(path==='/partners/metrics/'?'partners/metrics/index.html':'index.html',dist),'utf8');assert.deepEqual(refs(html),refs(local));
  if(path.includes('partners'))assert.match(r.headers.get('x-robots-tag'),/noindex/);
  results.push({origin,path,status:r.status,htmlReferencesMatch:true});
 }
 for(const path of [...readdirSync(new URL('assets/',dist)).filter(f=>/\.(js|css)$/.test(f)).map(f=>'assets/'+f),'arcade/frontier-drift.webp','arcade/rift-run.webp']){
  const r=await fetch(origin+'/'+path);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),expected=readFileSync(new URL(path,dist));assert.equal(hash(bytes),hash(expected),path);results.push({origin,path,sha256:hash(bytes),matches:true});
 }
}
writeFileSync(new URL('live-assets.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results));
