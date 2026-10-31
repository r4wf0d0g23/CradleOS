import { createServer } from 'node:http';
import { mkdirSync,realpathSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore,snapshot,CONFIG,SOURCES,stateOf } from './core.mjs';
import { collect } from './collector.mjs';
// Bound expensive graph materialization independently of caller-controlled timestamps/IPs.
export function snapshotCache(db,read=snapshot,clock=Date.now) {
 const cache=new Map();let tokens=4,refillAt=clock();
 return at=>{
  const now=clock(),key=at??'live',revision=db.prepare('SELECT total_changes() n').get().n;
  const old=cache.get(key);
  if(old && old.revision===revision && now-old.time<10000)return old.body;
  tokens=Math.min(4,tokens+(now-refillAt)/1000);refillAt=now;
  if(tokens<1)return null;tokens--;
  const body=JSON.stringify(read(db,at,now));cache.delete(key);cache.set(key,{body,revision,time:now});
  if(cache.size>32)cache.delete(cache.keys().next().value);
  return body;
 };
}
export function serve(db,port=8045) {
 const cached=snapshotCache(db);
 const server=createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('X-Content-Type-Options','nosniff');
  try {
   if(req.method!=='GET'){res.writeHead(405);return res.end('{"error":"method_not_allowed"}');}
   const url=new URL(req.url,'http://localhost');if(!['/known-space','/health'].includes(url.pathname)){res.writeHead(404);return res.end('{"error":"not_found"}');}
   if(url.pathname==='/health')return res.end(JSON.stringify({ok:true,world:CONFIG.world,initialized:SOURCES.every(s=>stateOf(db,s))}));
   if([...url.searchParams.keys()].some(k=>k!=='at') || url.searchParams.getAll('at').length>1){res.writeHead(400);return res.end('{"error":"invalid_query"}');}
   const param=url.searchParams.get('at');if(param!==null && !/^[1-9]\d{0,15}$/.test(param)){res.writeHead(400);return res.end('{"error":"invalid_time"}');}
   const at=param===null?null:Number(param);if(at!==null && (!Number.isSafeInteger(at)||at<Date.parse(CONFIG.cycleStart)||at>Date.now())){res.writeHead(400);return res.end('{"error":"invalid_time"}');}
   const body=cached(at);if(body===null){res.setHeader('Retry-After','1');res.writeHead(429);return res.end('{"error":"retry_later"}');}
   res.end(body);
  } catch {res.writeHead(503);res.end('{"error":"map_unavailable"}');}
 });server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=64;server.listen(port,'127.0.0.1');return server;
}
if(process.argv[1] && realpathSync(resolve(process.argv[1]))===fileURLToPath(import.meta.url)) {
 process.umask(0o077);
 const path=process.env.KNOWN_SPACE_DB || `${process.env.HOME}/.local/share/cradleos-known-space/cycle7.sqlite`;
 mkdirSync(dirname(path),{recursive:true,mode:0o700});const db=openStore(path);
 const once=process.argv.includes('--once');const server=once?null:serve(db,Number(process.env.KNOWN_SPACE_PORT||8045));let stopping=false,timer,running=null;
 async function tick(){
  try{const errors=await collect(db);console.log(JSON.stringify({at:new Date().toISOString(),...snapshot(db).coverage,errors}));}
  catch(error){console.error(JSON.stringify({at:new Date().toISOString(),error:String(error.message).slice(0,160)}));}
  if(!once && !stopping)timer=setTimeout(()=>{running=tick();},SOURCES.every(s=>stateOf(db,s)?.historyDone)?60000:1500);
 }
 async function stop(){if(stopping)return;stopping=true;clearTimeout(timer);server?.close();await running;db.close();process.exit(0);}
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,stop);
 running=tick();await running;if(once)db.close();
}
