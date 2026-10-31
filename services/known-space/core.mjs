import { DatabaseSync } from 'node:sqlite';
import { bcs } from '@mysten/sui/bcs';
import { deriveObjectID, isValidTransactionDigest, normalizeSuiAddress } from '@mysten/sui/utils';
import CONFIG from './config.json' with { type: 'json' };
export { CONFIG };
export const STALE = 180_000;
export const SOURCES = ['gate::JumpEvent','gate::GateCreatedEvent','gate::GateLinkedEvent','gate::GateUnlinkedEvent','location::LocationRevealedEvent','status::StatusChangedEvent'];
export function requireValue(ok, message = 'Invalid source data') { if (!ok) throw Error(message); }
export const object = x => { requireValue(x && typeof x === 'object' && !Array.isArray(x)); return x; };
export function uint(x, positive = false) { requireValue(typeof x === 'string' || typeof x === 'number' && Number.isSafeInteger(x)); const s=String(x);requireValue(/^(0|[1-9]\d*)$/.test(s) && BigInt(s)<=18446744073709551615n && (!positive || BigInt(s)>0n));return s; }
export function number(x) { const n=Number(uint(x));requireValue(Number.isSafeInteger(n));return n; }
export function id(x) { requireValue(typeof x==='string' && /^0x[0-9a-f]{1,64}$/i.test(x));return normalizeSuiAddress(x); }
export function date(x) { requireValue(typeof x==='string' && /^\d{4}-\d\d-\d\dT/.test(x)); const n=Date.parse(x);requireValue(Number.isFinite(n));return n; }
export function digest(x) { requireValue(typeof x==='string' && isValidTransactionDigest(x));return x; }
const keyBcs=bcs.struct('TenantItemId',{item_id:bcs.u64(),tenant:bcs.string()});
export function objectId(item) { return deriveObjectID(CONFIG.registry,`${CONFIG.world}::in_game_id::TenantItemId`,keyBcs.serialize({item_id:uint(item,true),tenant:CONFIG.tenant}).toBytes()); }
function bound(address,key) { const k=object(key);requireValue(k.tenant===CONFIG.tenant);const item=uint(k.item_id,true),addressId=id(address);requireValue(objectId(item)===addressId);return [addressId,item]; }
function hash(x) { requireValue(typeof x==='string' && Buffer.from(x,'base64').length===32 && Buffer.from(x,'base64').toString('base64')===x);return x; }
function status(x) { const v=object(x)['@variant'];requireValue(['NULL','OFFLINE','ONLINE'].includes(v));return v; }
export function decode(raw, source, low, high, indexedAt) {
 const r=object(raw),contents=object(r.contents),f=object(contents.json),tx=object(r.transaction);
 requireValue(object(contents.type).repr===`${CONFIG.world}::${source}`);
 const at=date(r.timestamp),checkpoint=number(object(object(tx.effects).checkpoint).sequenceNumber),seq=number(r.sequenceNumber),d=digest(tx.digest);
 requireValue(at>=Date.parse(CONFIG.cycleStart) && at<=indexedAt+1000 && checkpoint>=low && checkpoint<=high);
 const out={id:`${d}#${seq}`,source,at,checkpoint,sequence:seq,digest:d};
 if (['gate::JumpEvent','gate::GateLinkedEvent','gate::GateUnlinkedEvent'].includes(source)) {
  [out.from,out.fromItem]=bound(f.source_gate_id,f.source_gate_key);[out.to,out.toItem]=bound(f.destination_gate_id,f.destination_gate_key);requireValue(out.from!==out.to);
  if(source==='gate::JumpEvent')bound(f.character_id,f.character_key); // Validate, but do not persist pilot identity.
 } else if(source==='location::LocationRevealedEvent') {
  [out.assembly,out.item]=bound(f.assembly_id,f.assembly_key);out.typeId=uint(f.type_id,true);out.systemId=uint(f.solarsystem,true);out.locationHash=hash(f.location_hash);id(f.owner_cap_id);
  for(const axis of ['x','y','z'])requireValue(typeof f[axis]==='string' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(f[axis]) && Number.isFinite(Number(f[axis])));
 } else if(source==='gate::GateCreatedEvent') {
  [out.assembly,out.item]=bound(f.assembly_id,f.assembly_key);out.typeId=uint(f.type_id,true);out.locationHash=hash(f.location_hash);id(f.owner_cap_id);status(f.status);
 } else if(source==='status::StatusChangedEvent') {
  [out.assembly,out.item]=bound(f.assembly_id,f.assembly_key);status(f.status);out.action=object(f.action)['@variant'];requireValue(['ANCHORED','UNANCHORED','ONLINE','OFFLINE'].includes(out.action));
 } else throw Error('Unexpected event type');
 return out;
}
export function openStore(path) {
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
 db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS streams(source TEXT PRIMARY KEY,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,source TEXT NOT NULL,at INTEGER NOT NULL,checkpoint INTEGER NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS event_source_time ON events(source,at);
 CREATE TABLE IF NOT EXISTS gates(id TEXT PRIMARY KEY,checked_at INTEGER NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS disclosures(gate TEXT NOT NULL,system TEXT NOT NULL,hash TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(gate,at));
 CREATE TABLE IF NOT EXISTS coverage_gaps(source TEXT NOT NULL,low INTEGER NOT NULL,high INTEGER NOT NULL,PRIMARY KEY(source,low));
 CREATE TABLE IF NOT EXISTS page_cursors(source TEXT NOT NULL,lane TEXT NOT NULL,window INTEGER NOT NULL,cursor TEXT NOT NULL,PRIMARY KEY(source,lane,window,cursor));`);
 const scope=JSON.stringify({world:CONFIG.world,registry:CONFIG.registry,tenant:CONFIG.tenant,chainId:CONFIG.chainId,cycle:CONFIG.cycle});
 const old=db.prepare("SELECT value FROM meta WHERE key='scope'").get();requireValue(!old || old.value===scope,'Database namespace mismatch');
 db.prepare("INSERT OR IGNORE INTO meta VALUES('scope',?)").run(scope);return db;
}
export function stateOf(db, source) { const r=db.prepare('SELECT state FROM streams WHERE source=?').get(source);return r?JSON.parse(r.state):null; }
export function saveState(db,source,state) { db.prepare('INSERT INTO streams VALUES(?,?) ON CONFLICT(source) DO UPDATE SET state=excluded.state').run(source,JSON.stringify(state)); }
export function recordGap(db,source,low,high) {
 if(low>high)return;db.exec('BEGIN IMMEDIATE');
 try{const overlaps=db.prepare('SELECT low,high FROM coverage_gaps WHERE source=? AND low<=? AND high>=?').all(source,high+1,low-1);
 for(const r of overlaps){low=Math.min(low,r.low);high=Math.max(high,r.high);db.prepare('DELETE FROM coverage_gaps WHERE source=? AND low=?').run(source,r.low);}
 db.prepare('INSERT INTO coverage_gaps VALUES(?,?,?)').run(source,low,high);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export function commitPage(db,source,events,state,cursorRecord=null) {
 db.exec('BEGIN IMMEDIATE');
 try {
  if(cursorRecord)db.prepare('INSERT INTO page_cursors VALUES(?,?,?,?)').run(source,cursorRecord.lane,cursorRecord.window,cursorRecord.cursor);
  const get=db.prepare('SELECT payload FROM events WHERE id=?'),put=db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)');
  for(const e of events) {
   const payload=JSON.stringify(e),old=get.get(e.id);requireValue(!old || old.payload===payload,'Conflicting event identity');
   if(!old)put.run(e.id,e.source,e.at,e.checkpoint,e.digest,payload);
  }
  saveState(db,source,state);db.exec('COMMIT');
 } catch(e){db.exec('ROLLBACK');throw e;}
}
export function saveGate(db, address, raw, now=Date.now()) {
 const contents=raw?.asMoveObject?.contents;
 let result={id:address,valid:false};
 if(contents) {
  requireValue(contents.type?.repr===`${CONFIG.world}::gate::Gate`,'Wrong object type');const f=object(contents.json);const [gate,item]=bound(f.id,f.key);requireValue(gate===address);
  const s=status(object(f.status).status),name=f.metadata?.name;
  requireValue(name===undefined || name===null || typeof name==='string');
  const label=typeof name==='string'?name.slice(0,120).replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'').trim():'';
  result={id:gate,itemId:item,typeId:uint(f.type_id,true),name:label||null,status:s==='NULL'?'UNKNOWN':s,linkedGateId:f.linked_gate_id===null?null:id(f.linked_gate_id),locationHash:hash(object(f.location).location_hash),valid:true};
 }
 db.prepare('INSERT INTO gates VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,payload=excluded.payload').run(address,now,JSON.stringify(result));
}
export function snapshot(db, at=null, now=Date.now()) {
 requireValue(at===null || Number.isSafeInteger(at) && at>=Date.parse(CONFIG.cycleStart) && at<=now,'Invalid replay time');
 const cutoff=at??now,streams=SOURCES.map(s=>stateOf(db,s));
 const loaded=streams.filter(Boolean),indexedAt=loaded.length===SOURCES.length?Math.min(...loaded.map(s=>s.indexedAt??0))||null:null;
 const backfillComplete=loaded.length===SOURCES.length && loaded.every(s=>s.historyDone && !s.pending);
 const gapRanges=db.prepare('SELECT source,low,high FROM coverage_gaps ORDER BY source,low').all(),gaps=gapRanges.length,rejected=loaded.reduce((n,s)=>n+(s.rejected??0),0);
 const objectHealth=db.prepare("SELECT value FROM meta WHERE key='objectHealth'").get();const oh=objectHealth?JSON.parse(objectHealth.value):null;
 const stale=loaded.some(s=>s.error || !s.okAt || now-s.okAt>STALE) || indexedAt!==null && now-indexedAt>STALE || rejected>0 || !oh || oh.error || now-oh.okAt>STALE;
 const statusValue=!indexedAt?'unavailable':stale?'stale':backfillComplete?'live':'backfilling';
 const rows=db.prepare('SELECT payload FROM events WHERE source=? AND at<=? ORDER BY at,id').all('gate::JumpEvent',cutoff);
 const jumps=rows.map(r=>JSON.parse(r.payload)),gateMap=new Map(),edges=new Map();
 for(const e of jumps) {
  for(const [g,item] of [[e.from,e.fromItem],[e.to,e.toItem]])if(!gateMap.has(g))gateMap.set(g,{id:g,itemId:item,typeId:null,name:null,systemId:null,locationDigest:null,locationAt:null,status:'UNKNOWN',linkedGateId:null,checkedAt:null});
  const key=`${e.from}>${e.to}`,old=edges.get(key);
  if(old){old.count++;old.lastSeen=e.at;old.lastDigest=e.digest;}else edges.set(key,{id:key,source:e.from,target:e.to,count:1,firstSeen:e.at,lastSeen:e.at,firstDigest:e.digest,lastDigest:e.digest});
 }
 requireValue(gateMap.size<=20000 && edges.size<=100000,'Graph capacity exceeded');
 const reveals=new Map();
 for(const r of db.prepare('SELECT payload FROM events WHERE source=? AND at<=? ORDER BY at,id').all('location::LocationRevealedEvent',cutoff)) {
  const e=JSON.parse(r.payload);if(!gateMap.has(e.assembly))continue;
  const prior=reveals.get(e.assembly);
  if(!prior || e.at>prior.at)reveals.set(e.assembly,e);
  else if(e.at===prior.at && (e.systemId!==prior.systemId || e.locationHash!==prior.locationHash || e.typeId!==prior.typeId))reveals.set(e.assembly,{...prior,ambiguous:true});
 }
 for(const r of db.prepare('SELECT * FROM disclosures WHERE at<=? ORDER BY at').all(cutoff)) {
  const previous=reveals.get(r.gate);if(previous && previous.systemId===r.system && previous.locationHash===r.hash)continue;
  if(!previous || r.at>previous.at)reveals.set(r.gate,{systemId:r.system,locationHash:r.hash,at:r.at,digest:null});
 }
 for(const g of gateMap.values()) {
  const r=db.prepare('SELECT checked_at,payload FROM gates WHERE id=?').get(g.id),o=r?JSON.parse(r.payload):null;
  const live=at===null && r && now-r.checked_at<=STALE && o.valid;
  if(live)Object.assign(g,{typeId:o.typeId,name:o.name,status:o.status,linkedGateId:o.linkedGateId,checkedAt:r.checked_at});
  const reveal=reveals.get(g.id);
  if(reveal && !reveal.ambiguous && (at!==null || live && o.locationHash===reveal.locationHash && (!reveal.typeId || o.typeId===reveal.typeId)))Object.assign(g,{systemId:reveal.systemId,locationDigest:reveal.digest,locationAt:reveal.at});
 }
 const extent=db.prepare('SELECT min(at) first,max(at) last,count(*) count FROM events').get();
 return {schemaVersion:1,world:CONFIG.world,tenant:CONFIG.tenant,chainId:CONFIG.chainId,cycle:CONFIG.cycle,generatedAt:now,indexedAt,status:statusValue,backfillComplete,
  coverage:{retainedFrom:loaded.length?Math.max(...loaded.map(s=>s.retainedFrom??0)):null,firstEventAt:extent.first??null,lastEventAt:extent.last??null,eventCount:extent.count,jumpCount:jumps.length,rejected,gaps,gapRanges,requestedAt:at},
  gates:[...gateMap.values()],edges:[...edges.values()],recentJumps:jumps.slice(-100).map(e=>({id:e.id,source:e.from,target:e.to,at:e.at,digest:e.digest}))};
}
