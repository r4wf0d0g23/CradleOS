import { CONFIG,SOURCES,requireValue,object,number,date,id,uint,decode,stateOf,saveState,commitPage,saveGate,recordGap } from './core.mjs';
import { storageObjects,assertIdField,idFieldId } from '../../cradleos-dapp/src/lib/storageRead.ts';
export async function graphql(query,variables={},fetcher=fetch) {
 const response=await fetcher(CONFIG.graphql,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000)});
 requireValue(response.ok,'Event provider unavailable');const body=await response.json();
 if(body.errors?.length){const messages=body.errors.map(e=>String(e.message)).join(' ');throw Error(/cursor|retention|outside.*available range|pruned/i.test(messages)?'Retention or cursor unavailable':'Event provider rejected query');}
 requireValue(body.data,'Event provider rejected query');
 requireValue(body.data.chainIdentifier===CONFIG.chainId,'Unexpected chain');return body.data;
}
const WATERMARK=`chainIdentifier serviceConfig {availableRange(type:"Query",field:"events",filters:["type"]) {first {sequenceNumber timestamp} last {sequenceNumber timestamp}}}`;
export function bounds(data,now=Date.now()) {
 const range=object(object(object(data.serviceConfig).availableRange));const low=number(range.first.sequenceNumber),high=number(range.last.sequenceNumber),start=date(range.first.timestamp),end=date(range.last.timestamp);
 requireValue(low>0 && low<=high && start<=end && end<=now+30000);return {low,high,start,end};
}
export async function readPage(source,window,backwards,cursor,fetcher=fetch) {
 const direction=backwards?'last:$count,before:$cursor':'first:$count,after:$cursor';
 const query=`query MapEvents($type:String!,$cursor:String,$count:Int!) {${WATERMARK}
 events(${direction},filter:{type:$type,afterCheckpoint:${window.low-1},beforeCheckpoint:${window.high+1}}) {
 nodes {sequenceNumber timestamp transaction {digest effects {checkpoint {sequenceNumber}}} contents {type {repr} json}}
 pageInfo {hasPreviousPage hasNextPage startCursor endCursor}}}`;
 const data=await graphql(query,{type:`${CONFIG.world}::${source}`,cursor,count:50},fetcher),range=bounds(data);
 requireValue(range.low<=window.low,'Retention crossed scan window');requireValue(range.high>=window.high,'Source watermark regressed');
 const page=object(data.events),info=object(page.pageInfo);
 requireValue(Array.isArray(page.nodes) && page.nodes.length<=50 && typeof info.hasNextPage==='boolean' && typeof info.hasPreviousPage==='boolean');
 const next=backwards?info.startCursor:info.endCursor,more=backwards?info.hasPreviousPage:info.hasNextPage;
 requireValue(next===null || typeof next==='string' && next.length>0 && next.length<4096);
 requireValue(!more || page.nodes.length>0 && next && next!==cursor,'Cursor did not advance');
 const events=page.nodes.map(n=>decode(n,source,window.low,window.high,range.end));
 requireValue(new Set(events.map(e=>e.id)).size===events.length,'Duplicate in provider page');
 for(let i=1;i<events.length;i++)requireValue(events[i].checkpoint>=events[i-1].checkpoint && events[i].at>=events[i-1].at,'Event order invalid');
 return {events,next,more,range};
}
export async function scanSource(db,source,fetcher=fetch,{historyPages=2,headPages=4}={}) {
 let state=stateOf(db,source);
 try {
  const head=bounds(await graphql(`query {${WATERMARK}}`,{},fetcher));
  if(!state) {
   const p=await readPage(source,{low:head.low,high:head.high},true,null,fetcher);
   state={high:head.high,historyLow:head.low,historyHigh:head.high,historyCursor:p.next,historyCheckpoint:p.events[0]?.checkpoint??head.high,historyDone:!p.more,retainedFrom:head.start,indexedAt:p.range.end,okAt:Date.now(),error:false,gap:false,rejected:0,pending:null};
   commitPage(db,source,p.events,state,p.next?{lane:'history',window:head.high,cursor:p.next}:null);
  } else {
   if(state.pending && state.pending.low<head.low){
    const win=state.pending,remaining=win.lastCheckpoint??win.low;
    recordGap(db,source,Math.max(remaining,win.low),Math.min(head.low-1,win.high));
    if(head.low>win.high){state.high=win.high;state.pending=null;}
    else state.pending={...win,low:head.low,cursor:remaining>=head.low?win.cursor:null};
   }
   if(!state.pending && head.high>state.high){
    recordGap(db,source,state.high+1,Math.min(head.low-1,head.high));
    state.pending={low:Math.max(state.high+1,head.low),high:head.high,cursor:null};
   }
   if(!state.historyDone && state.historyLow<head.low){
    const remaining=state.historyCheckpoint??state.historyHigh;
    recordGap(db,source,state.historyLow,Math.min(head.low-1,remaining));
    state.historyLow=head.low;if(head.low>remaining)state.historyDone=true;
   }
   // Archive start never advances when the provider prunes data already stored here.
   state.providerFrom=head.start;saveState(db,source,state);
   for(let i=0;state.pending && i<headPages;i++) {
    const win=state.pending;requireValue(win.low>=head.low,'Retention crossed scan window');
    const p=await readPage(source,win,false,win.cursor,fetcher);
    state={...state,indexedAt:p.range.end,okAt:Date.now(),error:false,pending:p.more?{...win,cursor:p.next,lastCheckpoint:p.events.at(-1)?.checkpoint??win.lastCheckpoint}:null,high:p.more?state.high:win.high};
    commitPage(db,source,p.events,state,p.more&&p.next?{lane:'head',window:win.high,cursor:p.next}:null);
   }
  }
  for(let i=0;!state.historyDone && i<historyPages;i++) {
   requireValue(state.historyLow>=head.low,'Retention crossed scan window');
   const p=await readPage(source,{low:state.historyLow,high:state.historyHigh},true,state.historyCursor,fetcher);
   state={...state,historyCursor:p.next,historyCheckpoint:p.events[0]?.checkpoint??state.historyCheckpoint,historyDone:!p.more,indexedAt:p.range.end,okAt:Date.now(),error:false};
   commitPage(db,source,p.events,state,p.more&&p.next?{lane:'history',window:state.historyHigh,cursor:p.next}:null);
  }
  state={...state,indexedAt:head.end,okAt:Date.now(),error:false};saveState(db,source,state);
 } catch(error) {
  const previous=stateOf(db,source);
  // Never overwrite committed cursor state with a failed in-memory page.
  if(previous)saveState(db,source,{...previous,error:true,gap:previous.gap || /Retention|Cursor|UNIQUE constraint failed: page_cursors/.test(error.message)});
  throw error;
 }
}
export async function refreshGates(db,fetcher=fetch,limit=200) {
 const addresses=new Set();for(const r of db.prepare("SELECT payload FROM events WHERE source='gate::JumpEvent'").all()){const e=JSON.parse(r.payload);addresses.add(e.from);addresses.add(e.to);}
 const list=[...addresses].sort((a,b)=>(db.prepare('SELECT checked_at FROM gates WHERE id=?').get(a)?.checked_at??0)-(db.prepare('SELECT checked_at FROM gates WHERE id=?').get(b)?.checked_at??0)).slice(0,limit);
 for(let i=0;i<list.length;i+=20) {
  const batch=list.slice(i,i+20);const data=await graphql(`query {chainIdentifier ${batch.map((a,j)=>`g${j}:object(address:"${a}"){asMoveObject{contents{type{repr}json}}}`).join(' ')}}`,{},fetcher);
  for(let j=0;j<batch.length;j++)saveGate(db,batch[j],data[`g${j}`]);
 }
 return list;
}
export async function bootstrapLocations(db,fetcher=fetch,readObjects=storageObjects) {
 const type=`${CONFIG.world}::location::LocationRegistry`;
 const data=await graphql(`query {chainIdentifier objects(first:2,filter:{type:"${type}"}) {nodes{asMoveObject{contents{type{repr}json}}}pageInfo{hasNextPage}}}`,{},fetcher);
 requireValue(data.objects.nodes.length===1 && !data.objects.pageInfo.hasNextPage);const contents=data.objects.nodes[0].asMoveObject.contents;requireValue(contents.type.repr===type);
 const table=id(contents.json.locations.id);number(contents.json.locations.size);
 const candidates=db.prepare('SELECT * FROM gates WHERE checked_at>?').all(Date.now()-180000).map(row=>JSON.parse(row.payload)).filter(o=>o.valid);
 for(let i=0;i<candidates.length;i+=50) {
  const batch=candidates.slice(i,i+50),objects=await readObjects(batch.map(o=>idFieldId(table,o.id)));
  requireValue(objects.length===batch.length);
  for(let j=0;j<batch.length;j++) {
   const field=objects[j];if(!field)continue;const gate=batch[j];assertIdField(field,table,gate.id,`${CONFIG.world}::location::Coordinates`);
   const system=uint(field.fields.value.solarsystem,true);
   const previous=db.prepare('SELECT * FROM disclosures WHERE gate=? ORDER BY at DESC LIMIT 1').get(gate.id);
   if(!previous || previous.system!==system || previous.hash!==gate.locationHash)db.prepare('INSERT INTO disclosures VALUES(?,?,?,?)').run(gate.id,system,gate.locationHash,Date.now());
  }
 }
}
export async function collect(db,options={}) {
 const errors=[];
 for(const source of SOURCES)try{await scanSource(db,source,options.fetcher??fetch,options);}catch(e){errors.push({source,error:e.message.slice(0,160)});}
 try{await refreshGates(db,options.fetcher??fetch);await bootstrapLocations(db,options.fetcher??fetch);db.prepare("INSERT INTO meta VALUES('objectHealth',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({okAt:Date.now(),error:false}));}catch(e){errors.push({source:'objects',error:e.message.slice(0,160)});const old=db.prepare("SELECT value FROM meta WHERE key='objectHealth'").get();db.prepare("INSERT INTO meta VALUES('objectHealth',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({okAt:old?JSON.parse(old.value).okAt:0,error:true}));}
 return errors;
}
