import test from 'node:test';
import assert from 'node:assert/strict';
import { readEvents } from '../event-reader.js';
const node = digest => ({transaction:{digest},sequenceNumber:0,timestamp:'2026-10-02T12:00:00Z',contents:{json:{character_id:'0x1'}}});
test('newest-first pages retain actual event IDs and opaque previous cursor', async()=>{
  let query;
  const result=await readEvents(async q=>{query=q;return {events:{nodes:[node('older'),node('newer')],pageInfo:{hasPreviousPage:true,startCursor:'opaque'}}};},[{MoveEventType:'0x1::character::CharacterCreatedEvent'},null,50,true]);
  assert.match(query,/last: 50/);assert.deepEqual(result.data.map(x=>x.id.txDigest),['newer','older']);assert.equal(result.nextCursor,'opaque');assert.equal(result.hasNextPage,true);
});
test('unresolved events and stalled pagination fail rather than look empty',async()=>{
  await assert.rejects(readEvents(async()=>({events:{nodes:[{}],pageInfo:{}}}),[{MoveEventType:'x'},null,1,true]),/Unresolved/);
  await assert.rejects(readEvents(async()=>({events:{nodes:[],pageInfo:{hasPreviousPage:true,startCursor:'same'}}}),[{MoveEventType:'x'},'same',1,true]),/stalled/);
});
test('legacy RPC cursor cannot be silently reused as GraphQL cursor',async()=>{
  await assert.rejects(readEvents(async()=>({}),[{MoveEventType:'x'},{txDigest:'old'},50,true]),/Incompatible/);
});

import { collectEventsSince } from '../event-reader.js';
test('event window persists only the newest event actually processed, never a second fetch', async () => {
 const events=[{id:{txDigest:'new',eventSeq:'2'}},{id:{txDigest:'old',eventSeq:'1'}}]; let calls=0;
 const result=await collectEventsSince(async()=>{calls++;return {data:events,hasNextPage:false}},events[1].id);
 assert.equal(calls,1);assert.deepEqual(result.events,[events[0]]);assert.deepEqual(result.latest,events[0].id);
});
test('event window refuses to advance on capped or failing backlogs', async()=>{
 let n=0; await assert.rejects(collectEventsSince(async()=>({data:[{id:{txDigest:'x',eventSeq:String(n++)}}],hasNextPage:true,nextCursor:String(n)}),null,2),/limit reached/);
 await assert.rejects(collectEventsSince(async()=>{throw new Error('upstream down')},null),/upstream down/);
});
test('initial owned poll includes events during snapshot and stops only before its start',async()=>{
 const es=[{id:{txDigest:'new',eventSeq:'2'},timestampMs:'200'},{id:{txDigest:'during',eventSeq:'1'},timestampMs:'100'},{id:{txDigest:'old',eventSeq:'0'},timestampMs:'99'}];
 const r=await collectEventsSince(async()=>({data:es,hasNextPage:true,nextCursor:'next'}),null,2,100);
 assert.deepEqual(r.events,es.slice(0,2)); assert.deepEqual(r.latest,es[0].id);
});
