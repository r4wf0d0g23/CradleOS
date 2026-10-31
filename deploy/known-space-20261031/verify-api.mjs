import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import CONFIG from '../../services/known-space/config.json' with {type:'json'};
const endpoint='https://keeper.reapers.shop/known-space';
const r=await fetch(endpoint,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'*');const s=await r.json();
assert.equal(s.world,CONFIG.world);assert.equal(s.chainId,CONFIG.chainId);assert.equal(s.tenant,'stillness');assert.ok(s.gates.length>0);assert.equal(s.edges.reduce((n,e)=>n+e.count,0),s.coverage.jumpCount);
const ids=new Set(s.gates.map(g=>g.id));assert.equal(ids.size,s.gates.length);for(const e of s.edges){assert.ok(ids.has(e.source)&&ids.has(e.target));assert.ok(e.firstSeen<=e.lastSeen);}
assert.ok(!JSON.stringify(s).includes('character_id'));assert.ok(!JSON.stringify(s).includes('characterId'));
const at=Math.floor((s.coverage.firstEventAt+s.coverage.lastEventAt)/2),rr=await fetch(endpoint+'?at='+at);assert.equal(rr.status,200);const replay=await rr.json();assert.equal(replay.coverage.requestedAt,at);assert.ok(replay.gates.every(g=>g.name===null&&g.typeId===null&&g.status==='UNKNOWN'&&g.checkedAt===null&&g.linkedGateId===null));assert.ok(replay.edges.every(e=>e.lastSeen<=at));assert.ok(replay.gates.every(g=>g.locationAt===null||g.locationAt<=at));
assert.equal((await fetch(endpoint,{method:'POST'})).status,405);assert.equal((await fetch(endpoint+'?at=bad')).status,400);
const unchanged=[];for(const path of ['/health','/index/health']){const r=await fetch('https://keeper.reapers.shop'+path);assert.equal(r.status,200);unchanged.push(path);}
const result={at:new Date().toISOString(),endpoint,status:s.status,world:s.world,events:s.coverage.eventCount,jumps:s.coverage.jumpCount,gates:s.gates.length,systems:new Set(s.gates.filter(g=>g.systemId!==null).map(g=>g.systemId)).size,backfillComplete:s.backfillComplete,coverageGaps:s.coverage.gaps,countsReconciled:true,replayNoLookahead:true,pilotIdentifiersOmitted:true,readonlyMethods:true,unrelatedHealthRoutesUnchanged:unchanged};writeFileSync(new URL('live-api.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
