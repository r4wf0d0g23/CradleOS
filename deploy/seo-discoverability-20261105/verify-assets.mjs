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
const staticPages=[];
for(const path of ['guide/index.html','guide/features/index.html','guide/getting-started/index.html','guide/faq/index.html','guide/guide.css','sitemap.xml']) {
 const urlPath=path.replace(/index\.html$/,'');
 const r=await fetch(origin+'/'+urlPath,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());
 assert.equal(hash(bytes),hash(readFileSync(new URL(path,dist))));
 staticPages.push({path:urlPath,status:r.status,sha256:hash(bytes),matches:true,type:r.headers.get('content-type')});
}
const robotsResponse=await fetch(origin+'/robots.txt');const robots=await robotsResponse.text();assert.equal(robotsResponse.status,200);assert.match(robotsResponse.headers.get('content-type'),/text\/plain/);assert.ok(!robots.includes('<html'));assert.ok(robots.includes(readFileSync(new URL('robots.txt',dist),'utf8')));assert.match(robots,/User-agent: GPTBot\s+Disallow: \//);
const hostRedirects=[];
for(const path of ['/?source=seo-check','/guide/features/?source=seo-check']) {
 const r=await fetch('https://www.cradleos.io'+path,{redirect:'manual'});assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location'),'https://www.cradleos.io').href,origin+path);hostRedirects.push({path,status:r.status,location:r.headers.get('location')});
}
const receipt={staticPages,hostRedirects,robots:{status:robotsResponse.status,clean:true,managedTrainingRuleRetained:true},at:new Date().toISOString(),sourceCommit:process.env.RELEASE_SHA,origin,routes,redirect:{status:redirect.status,location},assets};
writeFileSync(new URL('live-assets.json',import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
