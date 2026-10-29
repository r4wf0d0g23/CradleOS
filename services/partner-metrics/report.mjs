// Aggregate-only reporting. Source DB opened read-only by the collector.
export const DAY=86400000, MAX_AGE=2*60*60*1000;
export const CYCLES=[
 {cycle:5,name:'Shroud of Fear',start:'2026-03-11T00:00:00.000Z',end:'2026-06-25T00:00:00.000Z'},
 {cycle:6,name:'Sanctuary',start:'2026-06-25T00:00:00.000Z',end:'2026-09-29T00:00:00.000Z'},
 {cycle:7,name:'Vestiges',start:'2026-09-29T00:00:00.000Z',end:null},
];
export const ARCHIVE_PACKAGES=[
 '0x70d0797bf1772c94f15af6549ace9117a6f6c43c4786355004d14e9a5c0f97b3',
 '0xbf4249b176bf2c7594dbd46615f825b456da4bbba035fdb968c0e812e34dab8d',
 '0xd4f46821b371c776887922a5ac8e2e405b86b30f9066b9e5f5563f30921fc41e',
];
export const ACCOUNT='c9931cf81700e54630061f2fb036959b';
export const SITE='bee75c3f34014fdcaf8bf51553807747';
export const HOST='cradleos.io';
export const CURRENT_PACKAGES=[
 '0x2581b5d820e604306efa2604970387055e20830f9e3b424b7fed3f78e68361a6',
 '0x58fec9cb6c4026d6951d6df86442c281dfd69b6c7a2225d7016c08674e1b3e35',
 '0x9628fb3b5c589d627d2127581e0c3eb46c3af1f0c1171ce78d0992aebaedbec3',
 '0xd73c02463c1c679c94a5d7a133a944798870a2da302a6f4f52f626aa0010721e',
 '0xf1166f0e22b5c1407ee16d2ff5ce0a3a1d101827b82747df53ff636883b5abec',
].sort();
const iso=n=>new Date(n).toISOString();
const canonical=a=>{if(typeof a!=='string'||!/^0x[0-9a-f]{1,64}$/i.test(a))throw Error('Invalid stored address');return '0x'+a.slice(2).toLowerCase().padStart(64,'0');};
export function validRow(row,kind,now){
 const ts=row.ts,day=row.day||iso(ts).slice(0,10),pkg=kind==='sign_in'?'':row.pkg;
 if(!Number.isSafeInteger(ts)||ts<Date.parse(CYCLES[0].start)||ts>now||day!==iso(ts).slice(0,10))throw Error('Invalid stored timestamp');
 if(kind==='archive'&&!ARCHIVE_PACKAGES.includes(pkg)||kind==='chain'&&!CURRENT_PACKAGES.includes(pkg))throw Error('Unknown stored scope');
 if(kind==='archive'&&!(pkg===ARCHIVE_PACKAGES[2]?ts>=Date.parse(CYCLES[1].start)&&ts<Date.parse(CYCLES[1].end):ts<Date.parse(CYCLES[0].end)))throw Error('Archive cycle mismatch');
 if(kind!=='archive'&&ts<Date.parse(CYCLES[2].start))throw Error('Current cycle mismatch');
 return {kind,address:canonical(row.address),ts,day,pkg};
}
export function readSource(db,now){
 db.exec('BEGIN');
 try{
  const meta=Object.fromEntries(db.prepare('SELECT key,value FROM activity_meta_v2').all().map(r=>[r.key,r.value]));
  const scope=JSON.parse(meta.scope||'null');
  if(scope?.chainId!=='4c78adac'||JSON.stringify(scope.packages)!==JSON.stringify(CURRENT_PACKAGES))throw Error('Source scope mismatch');
  const indexed=JSON.parse(meta.snapshot||'null')?.indexed_at;
  const chainCurrent=!meta.poll_error&&typeof indexed==='string'&&Date.parse(indexed)<=now&&now-Date.parse(indexed)<=25*60*1000;
  const since=Date.parse(meta.wallet_since);
  if(!Number.isFinite(since)||since<Date.parse(CYCLES[2].start)||since>now)throw Error('Invalid proof coverage');
  const rows=[...db.prepare('SELECT address,day,pkg,last_seen AS ts FROM onchain_pings').all().map(r=>validRow(r,'archive',now)),
   ...db.prepare('SELECT address,day,ts FROM activity_wallet_v2').all().map(r=>{if(r.ts<since)throw Error('Proof predates verified coverage');return validRow(r,'sign_in',now);}),
   ...(chainCurrent?db.prepare('SELECT address,pkg,ts FROM activity_chain_v2').all().map(r=>validRow(r,'chain',now)):[])];
  db.exec('COMMIT');return {rows,chainCurrent,chainIndexedAt:chainCurrent?indexed:null,signInSince:iso(since)};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function ingest(state,rows){
 state.exec('CREATE TABLE IF NOT EXISTS observations(kind TEXT,address TEXT,day TEXT,pkg TEXT,ts INTEGER,PRIMARY KEY(kind,address,day,pkg));BEGIN IMMEDIATE');
 try{const insert=state.prepare('INSERT INTO observations VALUES(?,?,?,?,?) ON CONFLICT(kind,address,day,pkg) DO UPDATE SET ts=MAX(ts,excluded.ts)');for(const r of rows)insert.run(r.kind,r.address,r.day,r.pkg,r.ts);state.exec('COMMIT');}catch(e){state.exec('ROLLBACK');throw e;}
}
export function walletReport(state,source,now){
 const rows=state.prepare('SELECT * FROM observations').all();
 return CYCLES.map(c=>{
  const matching=rows.filter(r=>r.ts>=Date.parse(c.start)&&r.ts<(c.end?Date.parse(c.end):now+1));
  const count=kind=>new Set(matching.filter(r=>kind.includes(r.kind)).map(r=>r.address)).size;
  const ts=matching.map(r=>r.ts),current=c.cycle===7,chainKnown=source.chainCurrent||count(['chain'])>0;
  return {...c,coverage:'partial',status:current?(source.chainCurrent?'current':'chain_unavailable'):'archive',
   archived_wallets:current?null:(matching.length?count(['archive']):null),
   verified_sign_in_wallets:current?count(['sign_in']):null,
   recorded_chain_wallets:current&&chainKnown?count(['chain']):null,
   verified_union_wallets:current&&chainKnown?count(['chain','sign_in']):null,
   first_observed:ts.length?iso(ts.reduce((a,b)=>Math.min(a,b),Infinity)):null,last_observed:ts.length?iso(ts.reduce((a,b)=>Math.max(a,b),-Infinity)):null,
   sign_in_since:current?source.signInSince:null,chain_indexed_at:current?source.chainIndexedAt:null,
   collected_at:iso(now),source:current?'Verified proof and transaction observations':'Archived event-sender observations',
   scope:current?'Core, turrets, casino, legacy storage, voting':'Legacy core packages',
  };
 });
}
export async function websiteReport(token,now,fetchImpl=fetch){
 const start=iso(now-30*DAY),end=iso(now);
 const base={source:'Cloudflare Web Analytics',host:HOST,window_start:start,window_end:end,collected_at:end,site_since:'2026-07-06T01:42:43.766Z',sampling:'adaptive',visits:null,page_views:null,status:'unavailable'};
 const query=`{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){rumPageloadEventsAdaptiveGroups(limit:1,filter:{siteTag:"${SITE}",requestHost:"${HOST}",datetime_geq:"${start}",datetime_lt:"${end}"}){count sum{visits}}}}}`;
 try{
  if(!token)throw Error('Missing analytics credential');
  const response=await fetchImpl('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Analytics unavailable');const r=await response.json(),accounts=r.data?.viewer?.accounts;
  if(r.errors!=null&&(!Array.isArray(r.errors)||r.errors.length)||!Array.isArray(accounts)||accounts.length!==1)throw Error('Incomplete analytics');
  const groups=accounts[0].rumPageloadEventsAdaptiveGroups;
  if(!Array.isArray(groups)||groups.length>1)throw Error('Unexpected aggregate');
  const views=groups.length?groups[0]?.count:0,visits=groups.length?groups[0]?.sum?.visits:0;
  if(![views,visits].every(v=>Number.isSafeInteger(v)&&v>=0)||visits>views)throw Error('Invalid analytics');
  return {...base,status:'current',visits,page_views:views};
 }catch{return base;}
}
