const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const code=fs.readFileSync(__dirname+'/stream-controller.cjs','utf8');
function setup({pending=false,supported=false}={}){
 const sockets=[],support=[],bitmaps=[],draws=[],timers=new Map(),intervals=new Map(),decoders=[],statuses=[],terminals=[];let id=0;
 class WS{static OPEN=1;constructor(url){this.url=url;this.readyState=1;this.bufferedAmount=0;sockets.push(this);}close(){this.closed=true;this.readyState=3;this.onclose?.({reason:'closed'});}send(){}}
 class VD{static isConfigSupported(){return pending?new Promise(resolve=>support.push(resolve)):Promise.resolve({supported});}constructor(o){this.o=o;this.state='unconfigured';this.decodeQueueSize=0;decoders.push(this);}configure(c){this.config=c;this.state='configured';}close(){this.state='closed';}reset(){this.state='unconfigured';}decode(c){this.last=c;}}
 const c={module:{exports:{}},exports:{},console,WebSocket:WS,VideoDecoder:VD,EncodedVideoChunk:class {constructor(c){Object.assign(this,c);}},Blob,Uint8Array,DataView,performance:{now:()=>100},createImageBitmap:()=>new Promise((resolve,reject)=>bitmaps.push({resolve,reject})),setInterval:f=>{intervals.set(++id,f);return id;},clearInterval:i=>intervals.delete(i),setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i)};
 vm.createContext(c);vm.runInContext(code,c);const C=c.module.exports.StationStream,canvas={getContext:()=>({drawImage:i=>draws.push(i)})};const s=new C(canvas,'https://media.invalid',(state,message)=>statuses.push({state,message}),x=>terminals.push(x));
 return {s,sockets,support,bitmaps,draws,timers,intervals,decoders,statuses,terminals};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const a=setup({pending:true});const p=a.s.join();void a.s.join();assert.equal(a.support.length,1);a.support.shift()({supported:true});await p;assert.equal(a.sockets.length,1);a.s.close();
 const b=setup({pending:true});const q=b.s.join();b.s.close();b.support.shift()({supported:true});await q;assert.equal(b.sockets.length,0);
 const c=setup();await c.s.join(true);c.sockets[0].onmessage({data:new ArrayBuffer(4)});c.s.close();let bitmapClosed=false;c.bitmaps[0].resolve({close(){bitmapClosed=true;}});await tick();assert.equal(c.draws.length,0);assert.equal(bitmapClosed,true);
 const d=setup({supported:true});await d.s.join();const old=d.sockets[0];old.onmessage({data:JSON.stringify({type:'video-config',codec:'av01.0.08M.08'})});let frameClosed=false;d.decoders[0].o.error(Error('decode'));assert.equal(old.closed,true);assert.equal(d.timers.size,1);d.decoders[0].o.output({close(){frameClosed=true;}});assert.equal(d.draws.length,0);assert.equal(frameClosed,true);const [timer,f]=[...d.timers][0];d.timers.delete(timer);f();await tick();assert.equal(d.sockets.length,2);assert.ok(!d.sockets[1].url.includes('codec='));d.sockets[1].onmessage({data:new ArrayBuffer(4)});d.bitmaps[0].reject(Error('bad jpeg'));await tick();assert.equal(d.timers.size,0);assert.equal(d.sockets[1].closed,true);
 const e=setup({supported:true});await e.s.join();e.sockets[0].onmessage({data:JSON.stringify({type:'video-config',codec:'av01.0.08M.08'})});e.decoders[0].o.error(Error('decode'));assert.equal(e.timers.size,1);e.s.close();assert.equal(e.timers.size,0);
 const res={source:crypto.createHash('sha256').update(fs.readFileSync('cradleos-dapp/src/lib/casinoStationStream.ts')).digest('hex'),method:'isolated compiled controller mocks, no real decoder/network',rapidJoinOneSocket:true,leaveDuringCapabilityNoSocket:true,staleJpegNoDrawAndClosed:true,oldVideoFrameClosedWithoutDraw:true,decoderFailureOneJpegFallback:true,jpegFailureNoLoop:true,explicitCloseCancelsFallback:true};
 console.log(JSON.stringify(res,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
