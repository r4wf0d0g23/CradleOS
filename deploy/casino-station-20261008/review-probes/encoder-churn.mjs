import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {once} from 'node:events';import assert from 'node:assert/strict';
import {WebSocket} from '../../../services/casino-station/node_modules/ws/wrapper.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms)),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'station-review-'));
const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
await fs.mkdir(path.join(tmp,'bin'));await fs.mkdir(path.join(tmp,'ipc'));const logfile=path.join(tmp,'pids');
await fs.writeFile(path.join(tmp,'bin/ffmpeg'),`#!/usr/bin/env node\nimport fs from 'node:fs';process.on('SIGTERM',()=>{});fs.appendFileSync(process.env.STATION_REVIEW_PIDS,process.pid+'\\n');process.stdin.resume();setInterval(()=>{},1000);\n`,{mode:0o700});
const pulse=()=>fs.writeFile(path.join(tmp,'ipc/heartbeat.json'),JSON.stringify({at:Date.now()}));await pulse();const heart=setInterval(()=>void pulse(),200);
const server=spawn(process.execPath,['services/casino-station/server.mjs',path.join(tmp,'ipc')],{env:{...process.env,PATH:path.join(tmp,'bin')+':'+process.env.PATH,STATION_REVIEW_PIDS:logfile,STATION_PORT:String(port),STATION_LOCAL:'1'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
const pids=async()=>{try{return (await fs.readFile(logfile,'utf8')).trim().split('\n').filter(Boolean).map(Number);}catch{return [];}};
const alive=p=>{try{process.kill(p,0);return true;}catch{return false;}};const health=async()=>{try{return await(await fetch(`http://127.0.0.1:${port}/health`)).json();}catch{return {};}};
async function join(){const ws=new WebSocket(`ws://127.0.0.1:${port}/join`,{origin:`http://127.0.0.1:${port}`});return await new Promise(resolve=>{ws.on('open',()=>resolve({ws,opened:true}));ws.on('error',e=>resolve({ws,opened:false,error:e.message}));});}
try{
 for(let i=0;i<100&&!(await health()).ready;i++)await delay(20);assert.equal((await health()).ready,true,log);
 for(let i=0;i<2;i++){
  const {ws,opened}=await join();assert.equal(opened,true);
  for(let j=0;j<100&&(await pids()).length<=i;j++)await delay(5);
  ws.terminate();await once(ws,'close');await delay(230);
 }
 const live=(await pids()).filter(alive),h=await health(),third=await join();third.ws.terminate();
 assert.equal(live.length,2);assert.equal(h.active,2);assert.equal(third.opened,false);
 await delay(1800);const after=(await pids()).filter(alive).length;assert.equal(after,0);assert.equal((await health()).active,0);
 const rejoin=await join();assert.equal(rejoin.opened,true);rejoin.ws.terminate();await delay(50);
 console.log(JSON.stringify({isolated:true,nativeRenderer:false,encoder:'test stub ignores TERM; no ffmpeg/GPU work',cap:h.capacity,drainingEncoders:live.length,reportedReservedSlots:h.active,thirdRejected:!third.opened,remainingAfterKillDeadline:after,rejoinAfterDrain:rejoin.opened},null,2));
}finally{
 clearInterval(heart);server.kill('SIGTERM');await Promise.race([once(server,'exit'),delay(3000)]);if(server.exitCode===null&&server.signalCode===null)server.kill('SIGKILL');
 for(const pid of await pids())if(alive(pid))process.kill(pid,'SIGKILL');
}
