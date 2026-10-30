import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://cradleos.io',dist=new URL('../../cradleos-dapp/dist/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const refs=s=>[...s.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]).sort();
const routes=[];
for(const path of ['/','/partners/metrics/']){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const html=await r.text();
 assert.deepEqual(refs(html),refs(readFileSync(new URL(path.slice(1)+'index.html',dist),'utf8')));
 if(path.includes('partners')){assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.match(html,/<title>CradleOS · Partner metrics<\/title>/);assert.equal(r.headers.get('set-cookie'),null);}
 routes.push({path,status:r.status,htmlReferencesMatch:true,robots:r.headers.get('x-robots-tag')});
}
const redirect=await fetch(origin+'/partners/metrics',{redirect:'manual',signal:AbortSignal.timeout(20000)});
assert.equal(redirect.status,301);const location=redirect.headers.get('location');assert.equal(new URL(location,origin).href,origin+'/partners/metrics/');
const assets=[];
for(const file of readdirSync(new URL('assets/',dist)).filter(n=>/\.(js|css)$/.test(n))){
 const path='assets/'+file,expected=readFileSync(new URL(path,dist)),r=await fetch(origin+'/'+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);
 const bytes=Buffer.from(await r.arrayBuffer());assert.equal(hash(bytes),hash(expected));assets.push({path,bytes:bytes.length,sha256:hash(bytes),matches:true});
}
const receipt={at:new Date().toISOString(),sourceCommit:process.env.RELEASE_SHA,origin,routes,redirect:{status:redirect.status,location},assets};
writeFileSync(new URL('live-assets.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
